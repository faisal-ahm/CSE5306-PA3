FROM node:20-alpine

WORKDIR /app

COPY raft_node/package*.json ./
COPY raft_node/tsconfig.json ./
RUN npm install

COPY raft_node/src ./src

# copy proto from api
COPY api/proto ./proto

CMD ["npm", "run", "dev"]
