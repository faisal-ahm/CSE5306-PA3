import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

interface ParticipantInfo {
  id: string;
  host: string;
  port: number;
}

interface TxnPayload {
  txId: string;
  operation: string;
  question: string;
  options: string[];
}

export class TwoPcClient {
  private coordinatorId: string;
  private participants: ParticipantInfo[];
  private votingStubs: any[];
  private decisionStubs: any[];

  constructor(coordinatorId: string, participants: ParticipantInfo[]) {
    this.coordinatorId = coordinatorId;
    this.participants = participants;

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

    this.votingStubs = participants.map((p) => {
      const addr = `${p.host}:${p.port}`;
      return new twoPc.VotingPhase(addr, grpc.credentials.createInsecure());
    });

    this.decisionStubs = participants.map((p) => {
      const addr = `${p.host}:${p.port}`;
      return new twoPc.DecisionPhase(addr, grpc.credentials.createInsecure());
    });
  }

  private logClient(phase: string, rpcName: string, toNode: string) {
    console.log(
      `Phase ${phase} of Node ${this.coordinatorId} sends RPC ${rpcName} to Phase ${phase} of Node ${toNode}`
    );
  }

  async runTwoPhaseCommit(
    payload: TxnPayload
  ): Promise<{ globalCommit: boolean; reason?: string }> {
    const txId = payload.txId;

    // Voting phase
    let allCommit = true;
    let failReason: string | undefined = undefined;

    for (let participantIndex = 0; participantIndex < this.participants.length; participantIndex++) {
      const p = this.participants[participantIndex];
      const stub = this.votingStubs[participantIndex];

      this.logClient("Voting", "RequestVote", p.id);

      try {
        const res: any = await new Promise((resolve, reject) => {
          stub.RequestVote(
            {
              from_node_id: this.coordinatorId,
              to_node_id: p.id,
              payload: {
                tx_id: txId,
                operation: payload.operation,
                question: payload.question,
                options: payload.options,
              },
            },
            (err: any, response: any) => {
              if (err) reject(err);
              else resolve(response);
            }
          );
        });

        if (!res.vote_commit) {
          allCommit = false;
          failReason = res.reason;
        }
      } catch (err: any) {
        allCommit = false;
        failReason = err.message || "RPC failure";
      }
    }

    // Decision phase
    for (let participantIndex = 0; participantIndex < this.participants.length; participantIndex++) {
      const p = this.participants[participantIndex];
      const stub = this.decisionStubs[participantIndex];

      this.logClient("Decision", "SendDecision", p.id);

      await new Promise((resolve, reject) => {
        stub.SendDecision(
          {
            from_node_id: this.coordinatorId,
            to_node_id: p.id,
            tx_id: txId,
            global_commit: allCommit,
          },
          (err: any, response: any) => {
            if (err) reject(err);
            else resolve(response);
          }
        );
      });
    }

    return { globalCommit: allCommit, reason: failReason };
  }
}
