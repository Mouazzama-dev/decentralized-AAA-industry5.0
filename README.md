# Decentralized AAA for Industry 5.0 — Tamper-Evident Audit Logging

A blockchain-anchored audit logging system for a smart-factory access-control (AAA) scenario. Audit events (an operator acting on a machine) are batched, hashed into a Merkle root, and anchored on the Ethereum **Sepolia** testnet, producing a tamper-evident record.

This branch (`Batching-txs`) adds **resilience and tamper detection for network outages**: while the blockchain is unreachable, events are buffered locally, cryptographically signed and chained, and verified before they are ever anchored — so tampering with the offline database is detected and blocked.

---

## Key Idea

The blockchain stores only integrity proofs (roots); raw events stay off-chain in a database. The risk is the window during a network outage, when data must be buffered locally and could be tampered with. Two mechanisms protect it:

- **Hash chaining (integrity)** — each block embeds the previous block's root, so any modification, deletion, or reordering breaks the chain.
- **Ed25519 signatures (authenticity)** — each block is signed by the gateway. An attacker who edits the database cannot forge a valid signature without the private key.

During an outage, blocks are staged on a **per-incident local chain** (an "epoch"). On recovery, each local chain is verified; only valid chains are merged into the main chain and anchored. Tampered chains are refused and quarantined, and never reach the blockchain.

> For the full design, diagrams, and the research background, see the design report (`docs/`).

---

## Architecture Overview

```
Audit event ──▶ SQLite (raw events, PENDING)
                     │
                     ▼
              Batch + Merkle root
                     │
              live RPC ping ──── network UP ──▶ MAIN chain ──▶ signed ──▶ anchored on Sepolia
                     │
                network DOWN
                     ▼
        LOCAL chain (per incident, signed, quarantined)
                     │
              network restored
                     ▼
        verify local chain ── valid ──▶ re-chain + re-sign ──▶ MAIN chain ──▶ anchored
                     │
                  tampered ──▶ merge refused, flagged TAMPERED, never anchored
```

**Two-tier chains**
- **MAIN chain** (`MerkleChain`) — verified blocks only; anchored on-chain.
- **LOCAL chains** (`LocalChain`) — one independent chain per network incident (epoch); quarantine buffer during outages.

---

## Tech Stack

- **Backend:** Node.js (ES modules), Express 5
- **Databases:** MongoDB (chains, incidents), SQLite (raw audit events)
- **Blockchain:** Ethereum Sepolia testnet, `ethers.js`
- **Smart contracts** (Foundry / Solidity, in `access-log/`): `AccessLog.sol`, `NetworkIncidentLog.sol`
- **Crypto:** Ed25519 (Node built-in `crypto`)

---

## Prerequisites

- Node.js 18+ (Node 22 recommended — the test script uses the built-in `fetch`)
- A running MongoDB instance (local or Atlas)
- A Sepolia RPC URL (e.g. Infura / Alchemy) and a funded Sepolia test account
- The contracts deployed on Sepolia (see `access-log/`), or existing deployed addresses

---

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

The backend reads its configuration from `backend/config/env.js` (git-ignored). Create it and export the following values:

```js
// backend/config/env.js
export const PORT = 5000;
export const MONGO_URI = "mongodb://localhost:27017/aaa-industry5";

// Sepolia
export const RPC = "https://sepolia.infura.io/v3/<your-key>";
export const PRIVATE_KEY = "<sepolia-account-private-key>";

// Deployed contract addresses (Sepolia)
export const CONTRACT_ADDRESS = "0x...";                    // AccessLog
export const NETWORK_INCIDENT_CONTRACT_ADDRESS = "0x...";   // NetworkIncidentLog
```

> **Never commit this file or any private key.** `env.js`, `*.pem`, `*.key`, and `*.sqlite` are already in `.gitignore`.

### 3. Signing key

No manual step is needed. On first run the gateway generates an Ed25519 keypair in `backend/keys/` automatically. The `keys/` folder is git-ignored.

> **Security note:** in development the key lives on the same machine as the database. In production it must sit in a separate trust boundary (HSM / TPM / secure element). The whole tamper-detection guarantee depends on the signing key staying out of an attacker's reach.

---

## Running

Start MongoDB, then:

```bash
cd backend
npm run dev      # nodemon (auto-reload)
# or
npm start        # node server.js
```

On startup the server connects to MongoDB and SQLite, starts the background sync worker (RPC heartbeat every ~10s), and listens on `PORT` (default 5000).

---

## API (relevant endpoints)

Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/audit/event` | Create an audit event (`operatorDid`, `deviceDid`, `action`). Stored as `PENDING`. |
| `GET`  | `/api/audit/pending` | List pending events. |
| `GET`  | `/api/batch/create` | Batch pending events, build a signed block, route to MAIN (network up) or LOCAL (network down). |
| `GET`  | `/api/batch/verify` | Verify the whole MAIN chain (signatures + continuity). |
| `GET`  | `/api/batch/verify-local?incidentId=INC_xxx` | Verify one incident's LOCAL chain. |
| `GET`  | `/api/batch/network-status` | Report the live RPC state (UP / DOWN). |

Example — create an event:

```bash
curl -X POST http://localhost:5000/api/audit/event \
  -H "Content-Type: application/json" \
  -d '{"operatorDid":"did:ethr:sepolia:operator1","deviceDid":"did:ethr:sepolia:robot1","action":"WELD"}'
```

---

## How the flow works

**Normal (network up)** — `POST /api/audit/event` a few times, then `GET /api/batch/create`. The block goes to the MAIN chain, is signed, and the worker anchors it on Sepolia (the `txHash` is stored on the block).

**Incident, clean data** — with the RPC unreachable, `GET /api/batch/create` stages the block on the incident's LOCAL chain. When the network returns, the worker anchors the incident, verifies the local chain, re-chains + re-signs the blocks onto the MAIN chain, anchors them, saves the epoch root on the incident, and drops the local blocks.

**Incident, tampered data** — if a local block is altered in the database, verification fails on recovery: the merge is refused, the offending `batchId` is reported, the block and incident are flagged `TAMPERED`, and nothing tampered is anchored.

---

## End-to-End Test

An interactive script drives all three scenarios: it generates its own events, detects the real network state, waits for the worker, and prints Sepolia Etherscan links for anchored transactions.

```bash
cd backend
node test-e2e.mjs
```

Choose `a` (all) and follow the prompts. The script pauses only when you need to toggle the RPC (break/fix the RPC in `env.js` and restart the server); it confirms the real network state before proceeding, so a scenario never runs against the wrong state.

Tip: clear the `merklechains` and `localchains` MongoDB collections before a clean demo run.

---

## Project Structure

```
.
├── access-log/                 # Foundry project — Solidity contracts
│   └── src/
│       ├── AccessLog.sol
│       └── NetworkIncidentLog.sol
├── backend/
│   ├── config/                 # env.js (git-ignored), mongodb.js
│   ├── database/               # sqlite.js
│   ├── models/                 # MerkleChain, LocalChain, NetworkIncident, Identity, DidState
│   ├── services/
│   │   ├── signingKey.service.js     # Ed25519 sign / verify
│   │   ├── merkle.service.js         # Merkle root
│   │   ├── merkleChain.service.js    # MAIN chain: create + verifyChain
│   │   ├── localChain.service.js     # LOCAL chains: create / verify / merge / drop
│   │   ├── networkIncident.service.js
│   │   └── ...
│   ├── routes/                 # audit, batch, identity, permit, authorization
│   ├── workers/
│   │   └── sync.worker.js      # RPC heartbeat, anchor, merge on recovery
│   ├── blockchain/             # contract configs + on-chain calls
│   ├── server.js
│   ├── app.js
│   └── test-e2e.mjs            # end-to-end scenario test
└── docs/                       # design report + diagrams
```

---

## Security Model (summary)

- **Detection is guaranteed** as long as the signing key is safe: any tampering breaks either the signature or the chain continuity, even if the attacker alters both the raw store and the chain block.
- **Recovery** of tampered data is only possible from a clean source in a separate trust boundary; otherwise a tampered block is quarantined and kept as a forensic record.
- **Single critical assumption:** the signing key must be protected (separate trust boundary). If the key is compromised, detection can be bypassed — this is the core limitation, documented deliberately. Already-anchored blocks remain safe regardless, since the blockchain ledger is immutable.

See the design report in `docs/` for the full threat model, the epoch-based rationale, the open decision on tampered-block handling, and references.
