FROM node:20-alpine

WORKDIR /app

# package + tsconfig from participant folder
COPY two_pc_participant/package*.json ./
COPY two_pc_participant/tsconfig.json ./

RUN npm install

# source code
COPY two_pc_participant/src ./src

# proto from the api project
COPY api/proto ./proto

CMD ["npm", "run", "dev"]
