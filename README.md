# CSE5306 PA3 — Distributed Polling System with 2PC and Raft

## Overview
This repository contains three versions of the distributed polling system:

- **base_rest/** — Original Project 2 implementation (REST + PostgreSQL + Nginx load balancer).
- **base_rest_2pc/** — Extended version with **Two‑Phase Commit (2PC)** integrated into the `CreatePoll` operation.
- **base_rest_raft/** — Extended version with a **full Raft leader election + log replication system** integrated into `CreatePoll`.

Each extension is isolated in its own folder and can be run independently.

---

## Directory Structure
(Shortened — see report for full diagrams)

```
CSE5306-PA3/
├── base_rest/
├── base_rest_2pc/
└── base_rest_raft/
```

Inside each folder:
- `api/` — REST backend (Hono/Node.js)
- `frontend/` — React web app
- `database/` — PostgreSQL schema
- `docker-compose.yml` — runs the entire system
- `nginx/` — load balancer
- (2pc) `two_pc_participant/` — 2PC participant nodes  
- (raft) `raft_node/` — Raft cluster nodes  
- (raft) `logs/` — execution logs for test cases  

---

## How to Run Any Version

### 1. Navigate into the version you want:
```
cd base_rest
# or
cd base_rest_2pc
# or
cd base_rest_raft
```

### 2. Build and start:
```
docker compose up --build
```

### 3. Access the frontend:
```
http://localhost:3002
```

### 4. API endpoints:
- Create poll: `POST /polls`
- Vote: `POST /polls/:id/votes`
- Get results: `GET /polls/:id/results`

---

## 2PC (base_rest_2pc)

### What was implemented
- Added `two_pc.proto`
- Added 4 participant nodes
- Added 2PC coordinator logic inside `api/src/index.ts`
- REST `/polls` now triggers:
  - Phase 1: RequestVote (Prepare)
  - Phase 2: SendDecision (Commit/Abort)

### How to run 2PC version:
```
cd base_rest_2pc
docker compose up --build
```

Test:
```
curl -X POST http://localhost:3005/polls   -H "Content-Type: application/json"   -d "{"question":"Test 2PC","options":["yes","no"]}"
```

---

## Raft (base_rest_raft)

### What was implemented
- `raft_node/` contains a full Raft node implementation:
  - Leader election
  - Randomized election timeout
  - Heartbeats
  - Log replication
- API forwards CREATE_POLL to Raft leader via gRPC

### How to run Raft version:
```
cd base_rest_raft
docker compose up --build
```

Test:
```
curl -X POST http://localhost:3005/polls   -H "Content-Type: application/json"   -d "{"question":"Raft test","options":["yes","no"]}"
```

---

## Raft Test Cases (Q5)

All test cases produce logs stored in:
```
base_rest_raft/logs/
```

---

## Student Info
- **Student ID:** 1002239354
