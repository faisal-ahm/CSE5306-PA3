import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

const RAFT_CLIENT_NODE_ID = process.env.RAFT_CLIENT_NODE_ID || "api-client-1";
const RAFT_ENTRY_NODE_HOST = process.env.RAFT_ENTRY_NODE_HOST || "raft1";
const RAFT_ENTRY_NODE_PORT = parseInt(process.env.RAFT_ENTRY_NODE_PORT || "6000", 10);

const protoPath = path.join(__dirname, "..", "proto", "raft.proto");
const packageDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: Number as any, // important so terms are numbers, not strings
  enums: String,
  defaults: true,
  oneofs: true,
});
const grpcObj = grpc.loadPackageDefinition(packageDef) as any;
const raft = grpcObj.raft;

function logClient(fromId: string, rpcName: string, toId: string) {
  console.log(`Node ${fromId} sends RPC ${rpcName} to Node ${toId}`);
}

export interface RaftCreatePollResult {
  ok: boolean;
  logIndex?: number;
  message?: string;
  leaderId?: string;
}

/**
 * Helper to call HandleClient on a specific host:port
 */
function callHandleClient(
  host: string,
  port: number,
  question: string,
  options: string[],
  isLeaderAttempt: boolean
): Promise<RaftCreatePollResult> {
  return new Promise((resolve) => {
    const client = new raft.RaftNode(
      `${host}:${port}`,
      grpc.credentials.createInsecure()
    );

    const toNode = `raft-entry@${host}:${port}`;
    logClient(RAFT_CLIENT_NODE_ID, "HandleClient", toNode);

    client.HandleClient(
      {
        node_id: RAFT_CLIENT_NODE_ID,
        operation: "CREATE_POLL",
        question,
        options,
      },
      (err: any, res: any) => {
        if (err) {
          console.error("Raft HandleClient error:", err.message);
          return resolve({
            ok: false,
            message: err.message,
          });
        }

        // If not accepted and we got a leader_id, and this was NOT yet a direct leader attempt,
        // tell caller to retry on leader.
        if (!res.accepted && res.leader_id && !isLeaderAttempt) {
          return resolve({
            ok: false,
            message: res.message,
            leaderId: res.leader_id,
          });
        }

        return resolve({
          ok: !!res.accepted,
          logIndex: res.log_index,
          message: res.message,
          leaderId: res.leader_id,
        });
      }
    );
  });
}

export async function raftCreatePoll(
  question: string,
  options: string[]
): Promise<RaftCreatePollResult> {
  // 1) First try the entry node (raft1)
  const first = await callHandleClient(
    RAFT_ENTRY_NODE_HOST,
    RAFT_ENTRY_NODE_PORT,
    question,
    options,
    false
  );

  // If accepted, done
  if (first.ok) {
    return first;
  }

  // If not accepted but we know the leader, retry on leader
  if (first.leaderId) {
    const leaderId = first.leaderId as string;

    // Map "raft-node-4" -> service "raft4"
    let leaderHost: string | null = null;
    const m = leaderId.match(/^raft-node-(\d+)$/);
    if (m) {
      leaderHost = `raft${m[1]}`;
    }

    if (leaderHost) {
      console.log(
        `Raft client: redirecting request from entry node to leader ${leaderId} at ${leaderHost}:${RAFT_ENTRY_NODE_PORT}`
      );

      const second = await callHandleClient(
        leaderHost,
        RAFT_ENTRY_NODE_PORT,
        question,
        options,
        true
      );

      return second;
    }
  }

  // No leader info or leader call also failed
  return first;
}
