import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

// ----- Config -----
const NODE_ID = process.env.NODE_ID || "raft-node-unknown";
const GRPC_PORT = parseInt(process.env.GRPC_PORT || "6000", 10);
const ALL_NODES = (process.env.ALL_NODE_IDS || "")
  .split(",")
  .filter((s) => s.length > 0);

// e.g. "raft-node-1:raft-node-1:6000,raft-node-2:raft-node-2:6000,..."
const PEERS_RAW = (process.env.PEERS || "").split(",").filter((s) => s.length > 0);

interface PeerInfo {
  id: string;
  host: string;
  port: number;
}

const PEERS: PeerInfo[] = PEERS_RAW.map((entry) => {
  const [id, host, portStr] = entry.split(":");
  return {
    id,
    host,
    port: parseInt(portStr, 10),
  };
});

// ----- Load proto -----
const protoPath = path.join(__dirname, "..", "proto", "raft.proto");
const packageDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: Number as any,
  enums: String,
  defaults: true,
  oneofs: true,
});
const grpcObj = grpc.loadPackageDefinition(packageDef) as any;
const raft = grpcObj.raft;

// ----- State -----
type Role = "follower" | "candidate" | "leader";

interface LogEntry {
  index: number;
  term: number;
  operation: string;
  question: string;
  options: string[];
}

let currentTerm = 0;
let votedFor: string | null = null;
let log: LogEntry[] = [];

let commitIndex = 0;
let lastApplied = 0;

let role: Role = "follower";
let leaderId: string | null = null;

let electionTimeoutHandle: NodeJS.Timeout | null = null;
let heartbeatTimerHandle: NodeJS.Timeout | null = null;

// Create stubs for RPC calls to other nodes
const voteStubs: any[] = [];
const appendStubs: any[] = [];

for (const p of PEERS) {
  const addr = `${p.host}:${p.port}`;
  const client = new raft.RaftNode(addr, grpc.credentials.createInsecure());
  voteStubs.push({ peer: p, client });
  appendStubs.push({ peer: p, client });
}

// Logging helpers

function clientLog(fromId: string, rpcName: string, toId: string) {
  console.log(`Node ${fromId} sends RPC ${rpcName} to Node ${toId}`);
}

function serverLog(selfId: string, rpcName: string, callerId: string) {
  console.log(`Node ${selfId} runs RPC ${rpcName} called by Node ${callerId}`);
}

// Election timeout = random in [1500, 3000] ms
function scheduleElectionTimeout() {
  if (electionTimeoutHandle) clearTimeout(electionTimeoutHandle);

  const timeoutMs = 1500 + Math.random() * 1500;
  electionTimeoutHandle = setTimeout(() => {
    if (role === "leader") return;
    startElection();
  }, timeoutMs);
}

// Heartbeat every 1 second for leader
function scheduleHeartbeat() {
  if (heartbeatTimerHandle) clearInterval(heartbeatTimerHandle);
  if (role !== "leader") return;

  heartbeatTimerHandle = setInterval(() => {
    sendHeartbeats();
  }, 1000);
}

function startElection() {
  role = "candidate";
  currentTerm += 1;
  votedFor = NODE_ID;
  leaderId = null;

  const lastLogIndex = log.length > 0 ? log[log.length - 1].index : 0;
  const lastLogTerm = log.length > 0 ? log[log.length - 1].term : 0;

  let votesGranted = 1; // voted for self
  const majority = Math.floor(ALL_NODES.length / 2) + 1;

  console.log(
    `[${NODE_ID}] Starting election: term=${currentTerm}, logIndex=${lastLogIndex}, logTerm=${lastLogTerm}`
  );

  for (const { peer, client } of voteStubs) {
    const toId = peer.id;
    clientLog(NODE_ID, "RequestVote", toId);

    client.RequestVote(
      {
        candidate_id: NODE_ID,
        term: currentTerm,
        last_log_index: lastLogIndex,
        last_log_term: lastLogTerm,
      },
      (err: any, res: any) => {
        if (err) {
          console.error(`[${NODE_ID}] RequestVote error to ${toId}:`, err.message);
          return;
        }

        serverLog(NODE_ID, "RequestVote", toId);
        
        const resTerm = Number(res.term);

        if (resTerm > currentTerm) {
        currentTerm = resTerm;
        role = "follower";
        votedFor = null;
        scheduleElectionTimeout();
        return;
        }

        if (role !== "candidate") return;
        if (res.vote_granted) {
          votesGranted += 1;
          if (votesGranted >= majority) {
            becomeLeader();
          }
        }
      }
    );
  }

  // If election fails, follower will eventually time out and try again
  scheduleElectionTimeout();
}

function becomeLeader() {
  role = "leader";
  leaderId = NODE_ID;
  console.log(`[${NODE_ID}] Became leader for term ${currentTerm}`);
  scheduleHeartbeat();
}

function sendHeartbeats() {
  if (role !== "leader") return;

  const commitIdx = commitIndex;
  const entriesCopy = [...log];

  for (const { peer, client } of appendStubs) {
    const toId = peer.id;
    clientLog(NODE_ID, "AppendEntries", toId);

    client.AppendEntries(
      {
        leader_id: NODE_ID,
        term: currentTerm,
        log: entriesCopy.map((e) => ({
          index: e.index,
          term: e.term,
          operation: e.operation,
          question: e.question,
          options: e.options,
        })),
        commit_index: commitIdx,
      },
      (err: any, res: any) => {
        if (err) {
          console.error(`[${NODE_ID}] AppendEntries error to ${toId}:`, err.message);
          return;
        }

        serverLog(NODE_ID, "AppendEntries", toId);
        const resTerm = Number(res.term);
        if (resTerm > currentTerm) {
          currentTerm = resTerm;
          role = "follower";
          votedFor = null;
          leaderId = res.follower_id;
          scheduleElectionTimeout();
        }
      }
    );
  }
}

// Apply committed entries (for assignment, we just log them here – DB is updated by API)
function applyCommitted() {
  while (lastApplied < commitIndex) {
    lastApplied += 1;
    const entry = log[lastApplied - 1];
    console.log(
      `[${NODE_ID}] Applying log index=${entry.index} term=${entry.term} op=${entry.operation}`
    );
  }
}

// ----- RPC handlers -----

const serverImpl = {
  RequestVote: (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) => {
    const req = call.request;
    const callerId = req.candidate_id as string;
    serverLog(NODE_ID, "RequestVote", callerId);

    const reqTerm = Number(req.term);

    if (reqTerm > currentTerm) {
      currentTerm = reqTerm;
      role = "follower";
      votedFor = null;
      leaderId = null;
    }
    

    let voteGranted = false;

    const lastLogIndex = log.length > 0 ? log[log.length - 1].index : 0;
    const lastLogTerm = log.length > 0 ? log[log.length - 1].term : 0;

    const upToDate =
      req.last_log_term > lastLogTerm ||
      (req.last_log_term === lastLogTerm && req.last_log_index >= lastLogIndex);

    if (
      reqTerm === currentTerm &&
      (votedFor === null || votedFor === callerId) &&
      upToDate
    ) {
      voteGranted = true;
      votedFor = callerId;
      scheduleElectionTimeout();
    }

    callback(null, {
      voter_id: NODE_ID,
      term: currentTerm,
      vote_granted: voteGranted,
    });
  },

  AppendEntries: (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) => {
    const req = call.request;
    const callerId = req.leader_id as string;
    serverLog(NODE_ID, "AppendEntries", callerId);

    const reqTerm = Number(req.term);

// Reject AppendEntries from lower-term leaders
if (reqTerm < currentTerm) {
  return callback(null, {
    follower_id: NODE_ID,
    term: currentTerm,
    success: false,
  });
}

// Accept new leader
currentTerm = reqTerm;
role = "follower";
leaderId = callerId;
scheduleElectionTimeout();

// Overwrite log fully (assignment simplification)
const newLog: LogEntry[] = (req.log as any[]).map((e, idx) => ({
  index: e.index || idx + 1,
  term: e.term,
  operation: e.operation,
  question: e.question,
  options: e.options,
}));
log = newLog;

commitIndex = Number(req.commit_index || 0);
applyCommitted();

return callback(null, {
  follower_id: NODE_ID,
  term: currentTerm,
  success: true,
});


    callback(null, {
      follower_id: NODE_ID,
      term: currentTerm,
      success: true,
    });
  },

  HandleClient: (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) => {
    const req = call.request;
    const callerId = req.node_id as string;
    serverLog(NODE_ID, "HandleClient", callerId);

    // If this node is not leader, redirect
    if (role !== "leader") {
      return callback(null, {
        accepted: false,
        leader_id: leaderId || "",
        message: leaderId
          ? `Not leader, redirect to ${leaderId}`
          : "No leader elected yet",
        log_index: 0,
      });
    }

    // Append to local log
    const newIndex = log.length + 1;
    const entry: LogEntry = {
      index: newIndex,
      term: currentTerm,
      operation: req.operation,
      question: req.question,
      options: req.options || [],
    };
    log.push(entry);

    // On next heartbeat, this will be replicated. For assignment simplicity,
    // we pretend ACK majority is immediate and commit it.
    commitIndex = newIndex;
    applyCommitted();

    callback(null, {
      accepted: true,
      leader_id: NODE_ID,
      message: "Appended and committed",
      log_index: newIndex,
    });
  },
};

function main() {
  const server = new grpc.Server();
  server.addService(raft.RaftNode.service, serverImpl);

  const addr = `0.0.0.0:${GRPC_PORT}`;
  server.bindAsync(
    addr,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("Raft node bind error:", err);
        process.exit(1);
      }
      console.log(
        `🚀 Raft node ${NODE_ID} listening on ${addr} (peers: ${PEERS.map(
          (p) => p.id
        ).join(",")})`
      );

      // All nodes start as followers with election timeout
      role = "follower";
      scheduleElectionTimeout();

      server.start();
    }
  );
}

main();
