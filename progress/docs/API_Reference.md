# Batch & Audit API Reference

### Decentralized AAA System — Industry 5.0
*Tamper-Evident Audit Logging with Offline Resilience and Admin Resolution*

Base URL: `http://localhost:5000`  
All batch endpoints are mounted at `/api/batch`.  
Audit event creation is at `/api/audit`.

---

## Page 1 — Core Batch Pipeline

These endpoints drive the normal audit lifecycle: creating events, batching them, and verifying the main chain.

---

### POST `/api/audit/event`

Creates a single audit event and stores it in SQLite with status `PENDING`.

**Request body**
```json
{
  "operatorDid": "did:ethr:sepolia:operator1",
  "deviceDid":   "did:ethr:sepolia:robot1",
  "action":      "WELD"
}
```

**Response**
```json
{
  "id": 42,
  "operatorDid": "did:ethr:sepolia:operator1",
  "deviceDid":   "did:ethr:sepolia:robot1",
  "action":      "WELD",
  "timestamp":   "2026-09-03T01:22:00.000Z",
  "status":      "PENDING",
  "batchId":     null
}
```

**Notes**  
Events accumulate as `PENDING` until `GET /api/batch/create` is called. Once batched, status becomes `BATCHED` and `batchId` is set. The `batchId` links events back to their batch in SQLite — this is the trusted source used by `/recover`.

---

### GET `/api/batch/create`

Pulls up to 10 `PENDING` events from SQLite, assigns a `batchId`, computes the Merkle root, and routes the block based on a **live RPC ping**.

- **Network UP** → block goes to the MAIN chain (`MerkleChain` collection). Signed with Ed25519. Worker anchors it on Sepolia within ~10 s.
- **Network DOWN** → opens a `NetworkIncident` if none is open, then stages the block on the incident's LOCAL chain (`LocalChain` collection). Signed. Held as `PENDING_VERIFICATION` until recovery.

**Response — network UP**
```json
{
  "chain":       "MAIN",
  "batchId":     "batch_1787185119032",
  "merkleRoot":  "a3f9...",
  "chainedRoot": {
    "batchId":      "batch_1787185119032",
    "previousRoot": "0x0000...0000",
    "currentRoot":  "cc24...",
    "eventCount":   3,
    "signature":    "base64...",
    "publicKey":    "-----BEGIN PUBLIC KEY-----...",
    "status":       "PENDING"
  }
}
```

**Response — network DOWN**
```json
{
  "chain":      "LOCAL",
  "note":       "Network down — block staged on local chain, will be verified and merged on recovery.",
  "incidentId": "INC_1787185119372",
  "batchId":    "batch_1787185119032",
  "merkleRoot": "a3f9...",
  "localBlock": {
    "batchId":      "batch_1787185119032",
    "incidentId":   "INC_1787185119372",
    "previousRoot": "0x0000...0000",
    "currentRoot":  "cc24...",
    "eventCount":   3,
    "signature":    "base64...",
    "status":       "PENDING_VERIFICATION"
  }
}
```

**Notes**  
The RPC ping is live — it does not rely on a stored incident flag. This catches the gap between when the network goes down and when the worker opens the incident (the worker cycles every 10 s; a batch can arrive in that window).

---

### GET `/api/batch/network-status`

Pings the RPC endpoint and reports the current network state. Used by tests and admin UIs to read real state rather than assuming.

**Response**
```json
{
  "networkUp": true,
  "rpcState":  "UP"
}
```

`rpcState` is `"UP"` or `"DOWN"`. No side effects.

---

### GET `/api/batch/verify`

Walks the entire `MerkleChain` collection in creation order and performs two checks on every block:

1. **Signature validity** — rebuilds the signed payload (`batchId|previousRoot|currentRoot|eventCount`) and verifies the Ed25519 signature against the stored public key. Catches any field mutation.
2. **Chain continuity** — each block's `previousRoot` must equal the previous block's `currentRoot` (or genesis for the first block). Catches deletion, insertion, and reordering.

**Response — valid**
```json
{
  "valid":       true,
  "totalBlocks": 7,
  "checked":     7,
  "errors":      []
}
```

**Response — invalid (200 OK → 409 Conflict)**
```json
{
  "valid":       false,
  "totalBlocks": 7,
  "checked":     7,
  "errors": [
    {
      "batchId":  "batch_1787185119032",
      "blockId":  "664a...",
      "type":     "SIGNATURE_INVALID",
      "detail":   "Signature does not match block contents"
    }
  ]
}
```

`type` is either `SIGNATURE_INVALID` or `CHAIN_BREAK`. HTTP 200 for valid, 409 for invalid.

---

### GET `/api/batch/verify-local?incidentId=INC_xxx`

Same two-check verification as above, but scoped to one incident's LOCAL chain. Only considers **active** blocks (`PENDING_VERIFICATION` and `VERIFIED`) — `TAMPERED`, `DISCARDED`, and `ACKNOWLEDGED` blocks are excluded from continuity checking.

**Query parameter:** `incidentId` (required)

**Response**
```json
{
  "valid":       false,
  "incidentId":  "INC_1787185119372",
  "totalBlocks": 2,
  "checked":     2,
  "finalRoot":   "cc24...",
  "errors": [
    {
      "batchId":  "batch_1787185119032",
      "blockId":  "664a...",
      "type":     "SIGNATURE_INVALID",
      "detail":   "Signature does not match block contents"
    }
  ]
}
```

`finalRoot` is the last active block's `currentRoot` — the epoch's final root, used during merge.

---

---

## Page 2 — Admin Resolution: Tampered Blocks

These endpoints implement the human-in-the-loop resolution workflow for `TAMPERED` local blocks. They are called after the sync worker detects tampering during recovery and halts anchoring.

**Typical workflow:**
```
GET  /api/batch/tampered                   ← see what needs a decision
GET  /api/batch/local/:batchId/inspect     ← understand what changed
POST /api/batch/local/:batchId/recover     ← fix it  (OR)
POST /api/batch/local/:batchId/acknowledge ← accept it as tampered  (OR)
POST /api/batch/local/:batchId/discard     ← permanently drop it
```

Resolve blocks in **chronological order** (oldest first). Recovering block N re-computes its `currentRoot`, which cascades to fix subsequent blocks automatically — but only up to the next `TAMPERED` block. Each tampered block needs its own explicit decision.

---

### GET `/api/batch/tampered`

Lists all local chain blocks currently in `TAMPERED` status. Sorted oldest-first so the admin can resolve them in chain order.

**Response**
```json
{
  "count": 1,
  "blocks": [
    {
      "_id":          "664a...",
      "batchId":      "batch_1787185119032",
      "incidentId":   "INC_1787185119372",
      "previousRoot": "0x0000...",
      "currentRoot":  "cc24...",
      "merkleRoot":   "a3f9...",
      "eventCount":   10,
      "signature":    "base64...",
      "status":       "TAMPERED",
      "createdAt":    "2026-09-03T01:22:00.000Z"
    }
  ]
}
```

**Notes**  
`count: 0` means no blocks need resolution. The worker automatically resumes merging once all tampered blocks are resolved.

---

### GET `/api/batch/local/:batchId/inspect`

**Read-only dry run.** Compares the stored (potentially tampered) block with what it should look like if rebuilt from the trusted SQLite event store. No data is changed.

**Path parameter:** `batchId`

**Response**
```json
{
  "batchId":    "batch_1787185119032",
  "incidentId": "INC_1787185119372",
  "status":     "TAMPERED",

  "stored": {
    "previousRoot": "0x0000...",
    "currentRoot":  "cc24...",
    "merkleRoot":   "a3f9...",
    "eventCount":   10,
    "signature":    "base64_of_tampered_block"
  },

  "recomputed": {
    "previousRoot": "0x0000...",
    "currentRoot":  "NEW_ROOT_if_recovered",
    "merkleRoot":   "a3f9...",
    "eventCount":   3,
    "sqliteEvents": [
      { "id": 1, "operatorDid": "did:ethr:...", "action": "WELD", "batchId": "batch_..." },
      "..."
    ]
  },

  "tamperAnalysis": {
    "merkleRootMatch":        true,
    "previousRootMatch":      true,
    "eventsMissingInSQLite":  false,
    "canRecover":             true
  }
}
```

**Reading the tamper analysis**

| Field | Meaning |
|---|---|
| `merkleRootMatch: true` | Raw events in SQLite match the stored Merkle root — the *events themselves* were not changed, only chain fields (e.g. `eventCount`, `previousRoot`) were mutated |
| `merkleRootMatch: false` | The events in SQLite produce a different root — the event data itself may have been altered |
| `previousRootMatch: false` | The block's chain link was tampered — the stored `previousRoot` does not match what the active chain expects |
| `canRecover: true` | SQLite has events for this `batchId`; recovery is technically possible |
| `canRecover: false` | No events in SQLite — recovery is impossible; use `/acknowledge` or `/discard` |

**Errors**  
`400` if the block does not exist or is not in `TAMPERED` status.

---

### POST `/api/batch/local/:batchId/recover`

Rebuilds a `TAMPERED` block from the trusted SQLite event store and queues it for re-merge.

**Steps performed internally:**
1. Re-fetch original events from SQLite for this `batchId`.
2. Recompute the Merkle root from those events.
3. Find the previous **active** block in the same incident (last `PENDING_VERIFICATION` or `VERIFIED` block before this one chronologically). `DISCARDED` and `ACKNOWLEDGED` blocks are excluded from this lookup.
4. Recompute `chainedRoot = SHA256(previousRoot + merkleRoot)`.
5. Re-sign with the gateway's Ed25519 private key.
6. Update the block: new `previousRoot`, `currentRoot`, `merkleRoot`, `eventCount`, `signature`, `publicKey`, `status → PENDING_VERIFICATION`.
7. **Cascade:** walk all subsequent `PENDING_VERIFICATION` blocks in the same incident chronologically. For each: re-chain from the running tail root, re-sign, update. Stop at the first `TAMPERED` block encountered. Skip `DISCARDED` / `ACKNOWLEDGED` blocks without updating the running root.

**Path parameter:** `batchId`

**Response**
```json
{
  "batchId":           "batch_1787185119032",
  "recovered":         true,
  "incidentId":        "INC_1787185119372",
  "previousRoot":      "0x0000...",
  "newCurrentRoot":    "NEW_ROOT_aa12...",
  "eventCount":        3,
  "cascadeRechained":  ["batch_1787185220001", "batch_1787185330002"]
}
```

`cascadeRechained` lists the `batchId`s of subsequent blocks that were automatically re-chained. An empty array means the recovered block was the last one in the incident.

**After this call:** the block has status `PENDING_VERIFICATION`. The sync worker picks it up on the next 10 s cycle, runs `verifyLocalChain` (which now passes), and merges it into the main chain. No manual trigger is needed.

**Errors**  
`400` if the block is not `TAMPERED`, or if no SQLite events are found (in which case, use `/discard`).  
`500` for unexpected errors.

---

### POST `/api/batch/local/:batchId/acknowledge`

Admin explicitly acknowledges the tampering and accepts the block as-is. The block is **never anchored** and remains in the database as a permanent forensic record.

Use this when:
- The tampered state has been reviewed and noted.
- The admin consciously decides not to recover (e.g. the data is irrelevant or the incident is already fully documented).
- You want a clear audit trail distinguishing "admin reviewed" from "automatically discarded".

**Path parameter:** `batchId`

**Response**
```json
{
  "batchId":      "batch_1787185119032",
  "acknowledged": true,
  "incidentId":   "INC_1787185119372",
  "status":       "ACKNOWLEDGED"
}
```

**Notes**  
`ACKNOWLEDGED` blocks are excluded from `verifyLocalChain` and from all future merge attempts. They do not break chain continuity for subsequent blocks. The worker automatically resumes merging the remaining PENDING blocks for this incident on the next cycle.

**Errors**  
`400` if the block is not `TAMPERED`.

---

### POST `/api/batch/local/:batchId/discard`

Permanently drops a `TAMPERED` block from the anchoring pipeline. The block is retained in the database as a forensic record but will never be merged or anchored.

Use this when:
- No SQLite events exist for the `batchId` (`canRecover: false` from `/inspect`).
- Recovery is not desired.
- The admin wants to close the incident without anchoring the affected batch.

**Path parameter:** `batchId`

**Response**
```json
{
  "batchId":    "batch_1787185119032",
  "discarded":  true,
  "incidentId": "INC_1787185119372",
  "status":     "DISCARDED"
}
```

**Notes**  
Identical behaviour to `ACKNOWLEDGED` from the system's perspective — excluded from verification and merge. The distinction is semantic: `DISCARDED` = could not or did not recover; `ACKNOWLEDGED` = admin reviewed and accepted the tampered state.

**Errors**  
`400` if the block is not `TAMPERED`.

---

---

## Page 3 — Block Status Lifecycle & Worker Behaviour

### LocalChain Block Status Reference

| Status | Set by | Meaning |
|---|---|---|
| `PENDING_VERIFICATION` | `/create` (network DOWN) or `/recover` | Active, waiting to be verified and merged |
| `VERIFIED` | Reserved for future intermediate step | Verified but not yet merged |
| `TAMPERED` | `mergeIncidentLocalChain` | Signature or chain check failed; awaiting admin decision |
| `MERGED` | `mergeIncidentLocalChain` | Successfully re-chained onto MAIN chain; local block deleted |
| `ACKNOWLEDGED` | `POST /acknowledge` | Admin reviewed; accepted tampered state; forensic record only |
| `DISCARDED` | `POST /discard` | Permanently dropped; forensic record only |

`verifyLocalChain` considers only `PENDING_VERIFICATION` and `VERIFIED` blocks. All other statuses are excluded from continuity checking.

---

### Sync Worker Cycle (10 s)

```
every 10 s:
  1. Ping RPC
     - FAIL → open/reuse NetworkIncident, mark MAIN blocks WAITING_RETRY, return
     - PASS → continue

  2. If an OPEN incident exists → resolveNetworkIncident()
     (anchor failure TX + recovery TX on-chain; incident → CLOSED)

  3. mergeAllPendingLocalChains()
     - getIncidentsWithPendingLocalBlocks()
       → only CLOSED incidents with PENDING_VERIFICATION / VERIFIED blocks
     - for each incident:
         if TAMPERED blocks exist → skip (log warning, return)
         else → verifyLocalChain() → if valid → merge → anchor
                                  → if invalid → flag TAMPERED, log alarm

     - if anyTampered → halt anchoring this cycle (return)

  4. Pick oldest PENDING / WAITING_RETRY MerkleChain block
     → sendMerkleRoot() → on-chain TX → block → CONFIRMED
```

**Key design decisions:**

- Step 3 runs **every cycle**, not only when an incident was just closed. This is what allows admin-recovered blocks to be picked up automatically — the incident is already CLOSED from a previous cycle; the worker finds PENDING_VERIFICATION blocks from that CLOSED incident and merges them without needing a new incident or manual trigger.
- `getIncidentsWithPendingLocalBlocks` cross-references `NetworkIncident` to filter for `CLOSED` incidents only. An OPEN incident's blocks are never touched mid-outage.
- The skip guard (`unresolvedTampered > 0`) prevents the worker from flagging innocent subsequent blocks as TAMPERED before the admin resolves the actual tampered one.

---

### Cascade Re-Chain Logic

When `POST /recover` is called on block B:

```
B rebuilt → new B.currentRoot

walk subsequent blocks in same incident (createdAt > B.createdAt), sorted oldest first:
  PENDING_VERIFICATION → re-chain from runningRoot → re-sign → update → runningRoot = new root
  DISCARDED / ACKNOWLEDGED → skip (runningRoot unchanged — active chain jumps over them)
  TAMPERED → STOP
```

This automatically repairs the chain break caused by B's new root without requiring the admin to manually recover every subsequent block. Blocks after the next TAMPERED one are left untouched until that block is resolved.

---

### Complete API Quick Reference

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/audit/event` | Create a single audit event (PENDING in SQLite) |
| `GET` | `/api/batch/create` | Batch PENDING events → MAIN or LOCAL chain |
| `GET` | `/api/batch/network-status` | Live RPC ping: UP or DOWN |
| `GET` | `/api/batch/verify` | Verify entire MAIN chain (sig + continuity) |
| `GET` | `/api/batch/verify-local` | Verify one incident's LOCAL chain (`?incidentId=`) |
| `GET` | `/api/batch/tampered` | List all TAMPERED blocks awaiting admin decision |
| `GET` | `/api/batch/local/:batchId/inspect` | Compare tampered block vs SQLite (dry run) |
| `POST` | `/api/batch/local/:batchId/recover` | Rebuild from SQLite + cascade re-chain |
| `POST` | `/api/batch/local/:batchId/acknowledge` | Accept tampered state → ACKNOWLEDGED |
| `POST` | `/api/batch/local/:batchId/discard` | Permanently drop → DISCARDED |
