import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";


const NODE_ID = process.env.NODE_ID || "participant-unknown";
const PORT = parseInt(process.env.GRPC_PORT || "50051", 10);

const protoPath = path.join(__dirname, "..", "proto", "two_pc.proto");
const packageDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const grpcObj = grpc.loadPackageDefinition(packageDef) as any;
const twoPc = grpcObj.two_pc;

function logServer(
  phase: string,
  rpcName: string,
  toNode: string
) {
  // follow assignment's format: "Phase <phase_name> of Node <node_id> sends RPC ..."
  console.log(
    `Phase ${phase} of Node ${NODE_ID} sends RPC ${rpcName} to Phase ${phase} of Node ${toNode}`
  );
}

const votingImpl = {
  RequestVote: (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) => {
    const req = call.request;

    logServer("Voting", "RequestVote", req.from_node_id);

    // For now, always vote commit (you could add logic here if needed)
    const voteCommit = true;
    const reason = "always commit (demo)";

    callback(null, {
      from_node_id: NODE_ID,
      to_node_id: req.from_node_id,
      vote_commit: voteCommit,
      reason,
    });
  },
};

const decisionImpl = {
  SendDecision: async (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ) => {
    const req = call.request;

    logServer("Decision", "SendDecision", req.from_node_id);

    const txId = req.tx_id as string;
    const globalCommit = req.global_commit as boolean;

    if (globalCommit) {
      console.log(
        `[${NODE_ID}] COMMIT for tx=${txId} (local commit simulated)`
      );
    } else {
      console.log(
        `[${NODE_ID}] ABORT for tx=${txId} (local abort simulated)`
      );
    }

    callback(null, {
      from_node_id: NODE_ID,
      to_node_id: req.from_node_id,
      ack: true,
    });
  },
};

function main() {
  const server = new grpc.Server();
  server.addService(twoPc.VotingPhase.service, votingImpl);
  server.addService(twoPc.DecisionPhase.service, decisionImpl);

  const addr = `0.0.0.0:${PORT}`;
  server.bindAsync(
    addr,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("gRPC server bind error:", err);
        process.exit(1);
      }
      console.log(
        `🚀 Participant ${NODE_ID} gRPC server listening on ${addr}`
      );
      server.start();
    }
  );
}

main();
