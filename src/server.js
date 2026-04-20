import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { ACTION_MAP, ALLOWED_ACTIONS } from './actionmap.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

global.isSending = false;
global.buffer = global.buffer || [];

// =======================
// ⚙️ ENV CONFIG
// =======================
const PORT = process.env.PORT || 5000;
const RPC = process.env.RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ADMIN_WALLET_ADDRESS = (process.env.ADMIN_WALLET_ADDRESS || "").toLowerCase();
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 10);

if (!PRIVATE_KEY) {
  throw new Error("❌ PRIVATE_KEY missing");
}

const ABI = ["function logBatch(string,string,uint8[])"];



// =======================
// 📁 FILES
// =======================
const STATE_FILE = path.resolve('./did-state.json');
const DB_FILE = path.resolve('./identity-store.json');
const AUDIT_FILE = path.resolve('./factory_audit.log');

// =======================
// 📁 LOAD STATE
// =======================
const loadState = () => {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE));
  }
  return { activeDids: [], inactiveDids: [] };
};

let { activeDids, inactiveDids } = loadState();

const saveState = () => {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ activeDids, inactiveDids }, null, 2)
  );
};

// =======================
// 📁 LOAD DB
// =======================
const loadDB = () => {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE));
  }
  return { operators: [], machines: [], pending: [] };
};

const saveDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// =======================
// 🛠 HELPERS
// =======================
const isAdmin = (addr) => addr?.toLowerCase() === ADMIN_WALLET_ADDRESS;

const appendLog = (line) => {
  fs.appendFileSync(AUDIT_FILE, `${line}\n`);
};

const normalizeMachineActions = (actions = []) => {
  if (!Array.isArray(actions)) return [];
  return actions.filter((a) => typeof a === 'string' && a.trim());
};

// =======================
// 🔐 ADMIN CHECK
// =======================
app.post('/api/is-admin', (req, res) => {
  res.json({ isAdmin: isAdmin(req.body.address) });
});

// =======================
// 🆕 REGISTER
// type = operator | machine
// machine ke saath allowedActions save honge
// =======================
app.post('/api/register', async (req, res) => {
  try {
    const { alias, type, allowedActions = [] } = req.body;

    if (!alias || !type) {
      return res.status(400).json({ error: "alias + type required" });
    }

    if (!["operator", "machine"].includes(type)) {
      return res.status(400).json({ error: "type must be operator or machine" });
    }

    const identity = await agent.didManagerCreate({
      alias,
      provider: 'did:ethr:sepolia'
    });

    const db = loadDB();

    db.pending.push({
      alias,
      did: identity.did,
      type,
      status: "PENDING",
      allowedActions: type === "machine" ? normalizeMachineActions(allowedActions) : []
    });

    saveDB(db);

    res.json({
      success: true,
      did: identity.did,
      status: "PENDING"
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================
// 📜 GET ALL
// endpoint same
// =======================
app.get('/api/identity/all', (req, res) => {
  res.json(loadDB());
});

// =======================
// ✅ APPROVE
// pending se active operators/machines me move
// =======================
app.post('/api/approve', (req, res) => {
  const { did, address } = req.body;

  if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
    return res.status(403).json({ error: "Only admin can approve" });
  }

  const db = loadDB();
  const index = db.pending.findIndex(i => i.did === did);

  if (index === -1) {
    return res.status(404).json({ error: "Not found" });
  }

  const item = db.pending.splice(index, 1)[0];
  item.status = "ACTIVE";

  if (item.type === "operator") {
    db.operators.push(item);
  } else {
    db.machines.push(item);
  }

  if (!activeDids.includes(item.did)) {
    activeDids.push(item.did);
    saveState();
  }

  saveDB(db);

  res.json({ success: true });
});

// =======================
// 🔍 ACCESS CHECK
// endpoint same
// global ALLOWED_ACTIONS hard block remove
// actual permission VC se hoga
// =======================
app.post('/api/check-access', async (req, res) => {
  const { operatorDid, deviceDid, action } = req.body;

  if (!operatorDid || !deviceDid || !action) {
    return res.json({ success: false, reason: "MISSING_FIELDS" });
  }

  if (typeof action !== "string" || !action.trim()) {
    return res.json({ success: false, reason: "INVALID_ACTION" });
  }

  if (inactiveDids.includes(operatorDid)) {
    return res.json({ success: false, reason: "INACTIVE" });
  }

  return res.json({ success: true });
});

// =======================
// 🔐 ISSUE PERMIT
// machine ke stored allowedActions use honge
// endpoint same
// =======================
app.post('/api/issue-permit', async (req, res) => {
  try {
    const { operatorDid, deviceDid, address } = req.body;

    if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
      return res.status(403).json({ error: "Only admin can issue permit" });
    }

    const db = loadDB();
    const operator = db.operators.find(o => o.did === operatorDid);
    const machine = db.machines.find(m => m.did === deviceDid);

    if (!operator) {
      return res.status(404).json({ error: "Operator not found or not active" });
    }

    if (!machine) {
      return res.status(404).json({ error: "Machine not found or not active" });
    }

    const machineActions = normalizeMachineActions(machine.allowedActions);

    if (machineActions.length === 0) {
      return res.status(400).json({ error: "Machine has no allowedActions configured" });
    }

    const identifiers = await agent.didManagerFind();
    const admin = identifiers.find(i => i.alias === 'factory-admin');

    if (!admin) {
      return res.status(500).json({ error: "Admin DID not found" });
    }

    const credential = await agent.createVerifiableCredential({
      credential: {
        issuer: { id: admin.did },
        type: ['VerifiableCredential', 'FactoryPermit'],
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: operatorDid,
          authorizedDeviceId: deviceDid,
          allowedActions: machineActions
        }
      },
      proofFormat: 'jwt'
    });

    await agent.dataStoreSaveVerifiableCredential({
      verifiableCredential: credential
    });

    res.json({
      success: true,
      allowedActions: machineActions
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================
// 1️⃣ DID RESOLUTION
// =======================
app.post('/api/resolve-did', async (req, res) => {
  try {
    const { operatorDid, deviceDid } = req.body;

    if (!operatorDid || !deviceDid) {
      return res.json({ success: false, step: "INPUT" });
    }

    const operator = await agent.didManagerGet({ did: operatorDid });
    const device = await agent.didManagerGet({ did: deviceDid });

    if (!operator || !device) {
      return res.json({
        success: false,
        step: "DID_RESOLUTION"
      });
    }

    res.json({ success: true, step: "DID_RESOLVED" });
  } catch (e) {
    console.error("❌ RESOLVE ERROR:", e);
    res.status(500).json({ success: false, step: "RESOLVE_ERROR", error: e.message });
  }
});

// =======================
// 2️⃣ VERIFY VC
// endpoint same
// =======================
app.post('/api/verify-vc', async (req, res) => {
  try {
    const { operatorDid } = req.body;

    const vcs = await agent.dataStoreORMGetVerifiableCredentials({
      where: [{ column: 'subject', value: [operatorDid] }]
    });

    if (!vcs.length) {
      return res.json({
        success: false,
        step: "VC"
      });
    }

    res.json({
      success: true,
      step: "VC_VERIFIED",
      vcs
    });
  } catch (e) {
    console.error("❌ VC ERROR:", e);
    res.status(500).json({ success: false, step: "VC_ERROR", error: e.message });
  }
});

// =======================
// 3️⃣ AUTHORIZE
// endpoint same
// VC allowedActions ke basis pe
// =======================
app.post('/api/authorize', (req, res) => {
  try {
    const { vcs, deviceDid, action } = req.body;

    const valid = vcs.find(vc => {
      const cred = vc.verifiableCredential || vc;
      const allowed = Array.isArray(cred?.credentialSubject?.allowedActions)
        ? cred.credentialSubject.allowedActions
        : [];

      return (
        cred?.credentialSubject?.authorizedDeviceId === deviceDid &&
        allowed.includes(action)
      );
    });

    if (!valid) {
      return res.json({
        success: false,
        step: "AUTHORIZATION"
      });
    }

    res.json({
      success: true,
      step: "AUTHORIZED"
    });
  } catch (e) {
    console.error("❌ AUTH ERROR:", e);
    res.status(500).json({ success: false, step: "AUTH_ERROR", error: e.message });
  }
});

// =======================
// 4️⃣ LOG
// endpoint same
// names show honge, DID nahi
// =======================
app.post('/api/log', async (req, res) => {
  try {
    const { operatorDid, deviceDid, action } = req.body;

    const db = loadDB();

    const operator = db.operators.find(o => o.did === operatorDid);
    const machine = db.machines.find(m => m.did === deviceDid);

    const operatorName = operator?.alias || operatorDid;
    const machineName = machine?.alias || deviceDid;

    appendLog(`[${new Date().toLocaleTimeString()}] ${operatorName} → ${machineName} → ${action}`);

    res.json({
      success: true,
      step: "LOGGED"
    });
  } catch (e) {
    console.error("LOG ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// =======================
// 5️⃣ BATCH
// endpoint same
// bug fix: 0 falsy issue removed
// =======================
app.post('/api/batch', (req, res) => {
  try {
    const { action } = req.body;

    if (!global.buffer) global.buffer = [];

    if (!(action in ACTION_MAP)) {
      return res.json({ success: false, step: "INVALID_ACTION" });
    }

    global.buffer.push(ACTION_MAP[action]);

    res.json({
      success: true,
      step: "BATCHED",
      size: global.buffer.length
    });
  } catch (e) {
    console.error("❌ BATCH ERROR:", e);
    res.status(500).json({ success: false, step: "BATCH_ERROR", error: e.message });
  }
});

// =======================
// 6️⃣ BLOCKCHAIN
// endpoint same
// =======================
app.post('/api/blockchain', async (req, res) => {
  try {
    if (!global.buffer) global.buffer = [];
    if (typeof global.isSending !== "boolean") global.isSending = false;

    if (global.isSending) {
      return res.json({
        success: true,
        step: "BLOCKCHAIN_BUSY"
      });
    }

    if (global.buffer.length < BATCH_SIZE) {
      return res.json({
        success: true,
        step: "WAITING_BATCH",
        size: global.buffer.length
      });
    }

    global.isSending = true;

    appendLog(`[${new Date().toLocaleTimeString()}] ⏳ Sending to blockchain...`);

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    const batchToSend = [...global.buffer];
    global.buffer = [];

    const tx = await contract.logBatch(
      req.body.operatorDid,
      req.body.deviceDid,
      batchToSend
    );

    appendLog(`[${new Date().toLocaleTimeString()}] ⏳ TX Pending: ${tx.hash}`);

    await tx.wait();

    appendLog(`[${new Date().toLocaleTimeString()}] ✅ TX Confirmed: ${tx.hash}`);

    global.isSending = false;

    res.json({
      success: true,
      step: "BLOCKCHAIN_DONE",
      tx: tx.hash
    });
  } catch (e) {
    global.isSending = false;

    appendLog(`[${new Date().toLocaleTimeString()}] ❌ Blockchain Failed`);

    res.status(500).json({
      success: false,
      step: "BLOCKCHAIN_ERROR"
    });
  }
});

// =======================
// 📜 GET LOGS
// endpoint same
// =======================
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      return res.json([]);
    }

    const data = fs.readFileSync(AUDIT_FILE, "utf-8");

    const lines = data
      .split("\n")
      .filter(Boolean)
      .reverse();

    res.json(lines.slice(0, 50));
  } catch (e) {
    console.error("LOG FETCH ERROR:", e.message);
    res.status(500).json([]);
  }
});

// =======================
// 🚀 START
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});