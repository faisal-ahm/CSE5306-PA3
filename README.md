# CSE5306 PA3 – Distributed Systems Extension  
## Two-Phase Commit (2PC) + Raft Integration on REST Architecture  
Author: Faisal Ahmad  
Professor/Supervisor: Dr. Jiayi Meng  

---

# 1. Overview

This project extends an existing distributed polling system (base REST architecture) to implement **fault‑tolerant distributed transaction protocols** as required in PA3:

- **Q1–Q2:** Two‑Phase Commit (2PC) – Voting + Decision Phase  
- **Q3–Q4:** Raft – Leader Election + Log Replication  
- **Q5:** Five manual test cases with logs  

The base project was one of multiple provided implementations for PA2, and this assignment requires extending one such project with two independent fault‑tolerance systems.

We chose the **REST Resource‑Based Architecture**.

Both 2PC and Raft are implemented *as extensions* and integrated into the poll‑creation workflow.

---

# 2. Repository Structure

```
CSE5306-PA3/
│
├── base_rest/               # Original PA2 project
│   ├── api/
│   ├── frontend/
│   ├── database/
│   └── docker-compose.yml
│
├── base_rest_2pc/           # PA3 Extension – 2PC integrated
│   ├── api/
│   ├── two_pc/
│   └── docker-compose.yml
│
├── base_rest_raft/          # PA3 Extension – Raft integrated
│   ├── api/
│   ├── raft_node/
│   └── docker-compose.yml
│
├── test_cases/
│   ├── test1_normal.log
│   ├── test2_leader_crash.log
│   ├── test3_follower_recovery.log
│   ├── test4_concurrent.log
│   └── test5_new_node_join.log
│
└── report.md
```

Each fault‑tolerance mechanism is isolated in its own “extension folder” while retaining the original project intact for comparison.

---

# 3. Implemented Components

## 3.1 Two‑Phase Commit (2PC)
Implemented in:
```
base_rest_2pc/two_pc/
```

### Features:
- Coordinator + 4 Participants (5-node cluster)
- Fully containerized
- Voting Phase (RequestVote / Vote-Commit / Vote-Abort)
- Decision Phase (Global-Commit / Global-Abort)
- Integrated into API:  
  ✔ Every **/polls POST** triggers a 2PC transaction.  
- CLI testing using curl
- Node failure handling (crash simulation)

### Workflow Summary
1. API receives `POST /polls`
2. API launches 2PC transaction
3. Coordinator sends `RequestVote` to all participants
4. Participants respond with commit/abort
5. Coordinator decides global commit or abort
6. Poll is created only if global commit succeeds

---

## 3.2 Raft Protocol
Implemented in:
```
base_rest_raft/raft_node/
```

### Features:
- 5-node Raft cluster
- Leader election with randomized timeouts:
  - Election timeout: 1500ms–3000ms  
  - Heartbeat: 1000ms
- Log replication system
- Cluster‑wide committed log for CREATE_POLL operations
- Redirect-to-leader logic in API
- Supports:
  ✔ Leader crash  
  ✔ Follower crash  
  ✔ Concurrent operations  
  ✔ New node joining cluster  

### Workflow Summary
1. API receives `POST /polls`
2. API contacts “entry node” → Node redirects to real leader
3. Leader appends CREATE_POLL to its log
4. Log replicated on followers
5. Majority acknowledgment → commit
6. API inserts poll into DB

---

# 4. Integration Points

## 4.1 2PC Integration (API code)
`api/src/index.ts`:

```ts
const twoPc = new TwoPcClient();
const tx = await twoPc.runTwoPhaseCommit();
if (!tx.ok) return error("2PC Failed");
```

## 4.2 Raft Integration (API code)
```ts
const raftRes = await raftCreatePoll(question, options);
if (!raftRes.ok) return error("Raft cluster did not accept operation");
```

---

# 5. Test Cases (Q5)

All test cases produce `.log` files stored in `test_cases/`.

## Test Case 1 – Normal Operation
- All nodes running
- Poll created successfully through Raft
- Shows consistent election, replication, commit

✔ Log: `test1_normal.log`

---

## Test Case 2 – Leader Crash
- Determine current leader using:
```
docker compose logs raft1 raft2 raft3 raft4 raft5 | findstr "Became leader"
```
- Stop leader:
```
docker compose stop raft3
```
- Issue poll request → cluster elects new leader

✔ Log: `test2_leader_crash.log`

---

## Test Case 3 – Follower Recovery
- Stop follower (not leader)
- Submit poll → still succeeds (Raft tolerates up to 2 failures)
- Restart follower → log catches up via AppendEntries

✔ Log: `test3_follower_recovery.log`

---

## Test Case 4 – Concurrent Poll Creation
Run multiple curl commands rapidly:
```
for /L %i in (1,1,10) do curl ...
```
- Leader serializes operations
- All followers replicate cleanly

✔ Log: `test4_concurrent.log`

---

## Test Case 5 – New Node Join
- Bring up fresh node with empty log
- Node syncs from leader on startup

✔ Log: `test5_new_node_join.log`

---

# 6. How to Run

### Start 2PC version:
```
cd base_rest_2pc
docker compose up --build
```

### Start Raft version:
```
cd base_rest_raft
docker compose up --build
```

### Test API:
```
curl -X POST http://localhost:3005/polls -H "Content-Type: application/json" -d "{"question":"test?","options":["yes","no"]}"
```

---

# 7. Known Caveats / Notes

- Raft node startup order may cause several rapid election terms initially — this is expected.  
- Only one API operation (CREATE_POLL) was required and implemented in Raft.  
- 2PC/RAFT systems were intentionally kept simple to satisfy the assignment without unnecessary overengineering.

---

# 8. Conclusion

This project satisfies **all PA3 requirements**:

- ✔ 2PC Voting Phase  
- ✔ 2PC Decision Phase  
- ✔ Raft Leader Election  
- ✔ Raft Log Replication  
- ✔ 5 Real Test Cases  
- ✔ Integration with base PA2 architecture  
- ✔ Full containerization (multi-container clusters)  

Both systems run independently, extend the original project, and demonstrate fault‑tolerant distributed coordination.