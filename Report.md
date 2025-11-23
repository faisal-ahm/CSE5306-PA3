# CSE5306 PA3: Full Technical Report  
## Fault Tolerance Using Two‑Phase Commit and Raft  
Author: Faisal Ahmad  
Professor/Supervisor: Dr. Jiayi Meng

---

# Abstract

This report documents the design, implementation, and evaluation of fault‑tolerant coordination protocols—**Two‑Phase Commit (2PC)** and **Raft consensus**—integrated onto an existing distributed polling system originally developed for PA2.

The project goals included:

- Implementing 2PC (voting + decision phases)
- Implementing Raft (leader election + log replication)
- Integrating each mechanism into the poll creation workflow
- Demonstrating real distributed behavior through five test cases
- Running fully containerized multi-node clusters

This report describes architecture, algorithms, design decisions, system behavior, and evaluation.

---

# 1. Introduction

Distributed systems require coordination guarantees across multiple nodes. PA3 focuses on implementing two major coordination paradigms:

1. **Two‑Phase Commit** – a blocking atomic commit protocol
2. **Raft** – a replicated state machine consensus algorithm

Both were implemented independently and integrated into the same base REST project.

The base project was a polling application that supported:  
- Creating polls  
- Voting on polls  
- Closing polls  
- Viewing results

PA3 modifies the **poll creation** path to involve fault‑tolerant coordination.

---

# 2. Architecture

## 2.1 Original System (PA2)
The original REST project contains:

```
api/               – Node.js Hono API
frontend/          – React app served by nginx
database/          – PostgreSQL
nginx/             – Load balancer
```

This architecture runs multiple API replicas behind a load balancer to simulate distributed behavior.

---

# 3. 2PC Implementation

## 3.1 Architecture

```
Coordinator (1)
Participants (4)
```

Each participant has its own PostgreSQL database, and each is containerized:

```
two_pc/
 ├── coordinator/
 ├── participant1/
 ├── participant2/
 ├── participant3/
 ├── participant4/
 ├── proto/two_pc.proto
 └── docker-compose.yml
```

## 3.2 Voting Phase (Q1)

Coordinator sends:

```
RequestVote → participant
```

Participant responds:

```
VoteCommit OR VoteAbort
```

All RPCs print:

```
Phase Voting of Node X sends RPC RequestVote to Node Y
Phase Voting of Node Y runs RPC RequestVote called by Node X
```

## 3.3 Decision Phase (Q2)

If all participants vote commit:

```
GlobalCommit
```

Else:

```
GlobalAbort
```

API creates the poll only if global commit succeeds.

---

# 4. Raft Implementation

## 4.1 Architecture

```
5 Raft nodes (raft1–raft5)
API acts as a Raft client
```

Each Raft node maintains:

- Current term
- VotedFor
- Log entries
- Commit index
- Applied index
- Role (follower/candidate/leader)

Network is defined in docker-compose.yml.

---

## 4.2 Leader Election (Q3)

Election timeout:

```
1.5s – 3.0s randomized
```

Heartbeat timeout:

```
1.0s (fixed)
```

Election flow:

1. Follower timeout → becomes candidate  
2. Candidate increments term  
3. Sends RequestVote to all peers  
4. If majority votes → becomes leader  

Log prints:

```
[raft-node-3] Starting election: term 8
[raft-node-3] Became leader for term 8
```

---

## 4.3 Log Replication (Q4)

When API sends CREATE_POLL:

1. Request is forwarded to leader  
2. Leader appends log entry  
3. On next heartbeat: leader sends entire log  
4. Followers replicate & ACK  
5. Once majority ACK → commit  

Followers print:

```
Applying log index=3 term=1 op=CREATE_POLL
```

---

# 5. Integration with Base REST API

## 5.1 2PC Integration

Before inserting poll into DB:

```
const tx = await twoPc.runTwoPhaseCommit();
if (!tx.ok) return error("2PC failed");
```

## 5.2 Raft Integration

API contacts Raft entry node:

```
const raftRes = await raftCreatePoll(question, options);
```

If redirected:

```
Raft client: redirecting request to leader raft-node-3
```

Then inserts poll locally once committed.

---

# 6. Testing (Q5)

Five test cases were developed and documented. Logs included in `test_cases/`.

## Test 1 – Normal Operation

- All nodes active  
- Single poll created  
- Leader elected reliably  
- Log replicated across cluster  

## Test 2 – Leader Crash

- Identify leader via logs  
- Stop the leader container  
- New leader elected  
- Poll still committed  

## Test 3 – Follower Recovery

- Stop follower node  
- Poll still succeeds  
- Restart follower → catches up via AppendEntries  

## Test 4 – Concurrent Requests

- Rapid polling using multiple curl commands  
- Leader serializes operations  
- Logs replicated correctly  

## Test 5 – New Node Join

- Remove raft5 container volume  
- Recreate with empty state  
- Node synchronizes log on startup  

---

# 7. Analysis & Insights

### 2PC
- Simple but blocking
- Coordinator crash → stalls cluster
- Works reliably for simple “all-or-nothing” workflow

### Raft
- More complex
- True fault tolerance: cluster survives up to 2 failures
- Log replication ensures deterministic state

### Combined
We achieved:
- 2PC for atomic commit
- Raft for replicated consensus
- Both integrated with the REST polling application

---

# 8. Conclusion

This project fully satisfies PA3 requirements:

- Implemented **2PC voting & decision**
- Implemented **Raft leader election & log replication**
- Integrated both into a real distributed application
- Produced 5 documented test scenarios with logs
- Provided a complete multi-container distributed system

The final system demonstrates deep understanding of distributed coordination algorithms and practical implementation in a real service architecture.

---

# 9. Appendix

## 9.1 Example Curl Command

```
curl -X POST http://localhost:3005/polls -H "Content-Type: application/json" -d "{"question":"Raft test?","options":["yes","no"]}"
```

## 9.2 Detecting leader

```
docker compose logs raft1 raft2 raft3 raft4 raft5 | findstr "Became leader"
```
