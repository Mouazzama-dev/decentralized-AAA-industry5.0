import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

global.isSending = false;

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

const ACTION_MAP = {
    MOVE_UP: 0,
    MOVE_DOWN: 1,
    SWITCH_ON: 2,
    SWITCH_OFF: 3,
    ROTATE: 4,
    CUT: 5
};

const ALLOWED_ACTIONS = Object.keys(ACTION_MAP);

// =======================
// 📁 FILES
// =======================
const STATE_FILE = path.resolve('./did-state.json');
const DB_FILE = path.resolve('./identity-store.json');

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
    fs.writeFileSync(STATE_FILE, JSON.stringify({ activeDids, inactiveDids }, null, 2));
};

// =======================
// 📁 LOAD DB (NEW)
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
// 🔐 ADMIN CHECK
// =======================
const isAdmin = (addr) => addr?.toLowerCase() === ADMIN_WALLET_ADDRESS;

app.post('/api/is-admin', (req, res) => {
    res.json({ isAdmin: isAdmin(req.body.address) });
});

// =======================
// 🆕 REGISTER (UPDATED)
// =======================
app.post('/api/register', async (req, res) => {
    try {
        const { alias, type } = req.body;

        if (!alias || !type) {
            return res.status(400).json({ error: "alias + type required" });
        }

        const identity = await agent.didManagerCreate({
            alias,
            provider: 'did:ethr:sepolia'
        });

        const db = loadDB();

        db.pending.push({
            alias,
            did: identity.did,
            type, // operator / machine
            status: "PENDING"
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
// 📜 GET ALL (UPDATED)
// =======================
app.get('/api/identity/all', (req, res) => {
    res.json(loadDB());
});

// =======================
// ✅ APPROVE (NEW)
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
// 📜 GET IDENTITIES (OLD + ACTIVE)
// =======================
app.get('/api/identity/all', (req, res) => {
    res.json(loadDB());
});
// =======================
// 🔍 ACCESS CHECK
// =======================
app.post('/api/check-access', async (req, res) => {
    const { operatorDid, deviceDid, action } = req.body;

    if (!operatorDid || !deviceDid || !action) {
        return res.json({ success: false, reason: "MISSING_FIELDS" });
    }

    if (!ALLOWED_ACTIONS.includes(action)) {
        return res.json({ success: false, reason: "UNKNOWN_ACTION" });
    }

    if (inactiveDids.includes(operatorDid)) {
        return res.json({ success: false, reason: "INACTIVE" });
    }

    return res.json({ success: true });
});

// =======================
// 🚀 EXECUTE OPERATION
// =======================
// app.post('/api/execute', async (req, res) => {
//     try {
//         const { operatorDid, deviceDid, action } = req.body;

//         if (!operatorDid || !deviceDid || !action) {
//             return res.json({ success: false, step: "INPUT", reason: "Missing fields" });
//         }

//         // 1️⃣ DID RESOLUTION
//         const operator = await agent.didManagerGet({ did: operatorDid });
//         const device = await agent.didManagerGet({ did: deviceDid });

//         if (!operator || !device) {
//             return res.json({ success: false, step: "DID_RESOLUTION", reason: "DID not found" });
//         }

//         // 2️⃣ VC FETCH
//         const vcs = await agent.dataStoreORMGetVerifiableCredentials({
//             where: [{ column: 'subject', value: [operatorDid] }]
//         });

//         if (!vcs.length) {
//             return res.json({ success: false, step: "VC", reason: "No permit" });
//         }

//         // 3️⃣ VALIDATE VC
//         const validVC = vcs.find(vc => {
//             const cred = vc.verifiableCredential;

//             return (
//                 cred.credentialSubject.authorizedDeviceId === deviceDid &&
//                 cred.credentialSubject.allowedActions.includes(action)
//             );
//         });

//         if (!validVC) {
//             return res.json({
//                 success: false,
//                 step: "AUTHORIZATION",
//                 reason: "Not allowed"
//             });
//         }

//         // 4️⃣ LOCAL LOG
//         const log = `[${new Date().toISOString()}] ${operatorDid} → ${deviceDid} → ${action}\n`;
//         fs.appendFileSync("factory_audit.log", log);

//         // 5️⃣ BATCH
//         if (!global.buffer) global.buffer = [];

//         global.buffer.push(ACTION_MAP[action]);

//         let blockchain = null;

//         // 6️⃣ SEND TO BLOCKCHAIN
//         if (global.buffer.length >= BATCH_SIZE) {
//             const provider = new ethers.JsonRpcProvider(RPC);
//             const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
//             const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

//             const tx = await contract.logBatch(operatorDid, deviceDid, global.buffer);

//             await tx.wait();

//             blockchain = tx.hash;
//             global.buffer = [];
//         }

//         res.json({
//             success: true,
//             step: "COMPLETED",
//             bufferSize: global.buffer.length,
//             tx: blockchain
//         });

//     } catch (e) {
//         res.status(500).json({ error: e.message });
//     }
// });

// =======================
// 🔐 ISSUE PERMIT (NEW)
// =======================
app.post('/api/issue-permit', async (req, res) => {
    try {
        const { operatorDid, deviceDid, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin can issue permit" });
        }

        const identifiers = await agent.didManagerFind();
        const admin = identifiers.find(i => i.alias === 'factory-admin');

        const credential = await agent.createVerifiableCredential({
            credential: {
                issuer: { id: admin.did },
                type: ['VerifiableCredential', 'FactoryPermit'],
                issuanceDate: new Date().toISOString(),
                credentialSubject: {
                    id: operatorDid,
                    authorizedDeviceId: deviceDid,
                    allowedActions: ["SWITCH_ON", "SWITCH_OFF", "MOVE_UP", "MOVE_DOWN"]
                }
            },
            proofFormat: 'jwt'
        });

        await agent.dataStoreSaveVerifiableCredential({
            verifiableCredential: credential
        });

        res.json({ success: true });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
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

app.post('/api/authorize', (req, res) => {
  try {
    const { vcs, deviceDid, action } = req.body;

    const valid = vcs.find(vc => {
      const cred = vc.verifiableCredential || vc;

      return (
        cred.credentialSubject.authorizedDeviceId === deviceDid &&
        cred.credentialSubject.allowedActions.includes(action)
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

// app.post('/api/log', (req, res) => {
//   try {
//     const { operatorDid, deviceDid, action } = req.body;

//     const log = `[${new Date().toISOString()}] ${operatorDid} → ${deviceDid} → ${action}\n`;
//     fs.appendFileSync("factory_audit.log", log);

//     res.json({
//       success: true,
//       step: "LOGGED"
//     });

//   } catch (e) {
//     console.error("❌ LOG ERROR:", e);
//     res.status(500).json({ success: false, step: "LOG_ERROR", error: e.message });
//   }
// });

app.post('/api/batch', (req, res) => {
  try {
    const { action } = req.body;

    if (!global.buffer) global.buffer = [];

    if (!ACTION_MAP[action]) {
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


app.post('/api/blockchain', async (req, res) => {
    try {
        if (!global.buffer) global.buffer = [];
        if (!global.isSending) global.isSending = false;

        // 🔴 already sending → don't send again
        if (global.isSending) {
            return res.json({
                success: true,
                step: "BLOCKCHAIN_BUSY"
            });
        }

        // 🟡 not enough batch
        if (global.buffer.length < BATCH_SIZE) {
            return res.json({
                success: true,
                step: "WAITING_BATCH",
                size: global.buffer.length
            });
        }

        // 🚀 start sending
        global.isSending = true;

        fs.appendFileSync(
            "factory_audit.log",
            `[${new Date().toLocaleTimeString()}] ⏳ Sending to blockchain...\n`
        );

        const provider = new ethers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

        const batchToSend = [...global.buffer];
        global.buffer = []; // 🔥 important: free buffer immediately

        const tx = await contract.logBatch(
            req.body.operatorDid,
            req.body.deviceDid,
            batchToSend
        );

        fs.appendFileSync(
            "factory_audit.log",
            `[${new Date().toLocaleTimeString()}] ⏳ TX Pending: ${tx.hash}\n`
        );

        await tx.wait();

        fs.appendFileSync(
            "factory_audit.log",
            `[${new Date().toLocaleTimeString()}] ✅ TX Confirmed: ${tx.hash}\n`
        );

        global.isSending = false;

        res.json({
            success: true,
            step: "BLOCKCHAIN_DONE",
            tx: tx.hash
        });

    } catch (e) {
        global.isSending = false;

        fs.appendFileSync(
            "factory_audit.log",
            `[${new Date().toLocaleTimeString()}] ❌ Blockchain Failed\n`
        );

        res.status(500).json({
            success: false,
            step: "BLOCKCHAIN_ERROR"
        });
    }
});

app.post('/api/log', async (req, res) => {
    try {
        const { operatorDid, deviceDid, action } = req.body;

        const db = loadDB();

        const operator = db.operators.find(o => o.did === operatorDid);
        const machine = db.machines.find(m => m.did === deviceDid);

        const operatorName = operator?.alias || operatorDid;
        const machineName = machine?.alias || deviceDid;

        const log = `[${new Date().toLocaleTimeString()}] ${operatorName} → ${machineName} → ${action}\n`;

        fs.appendFileSync("factory_audit.log", log);

        res.json({
            success: true,
            step: "LOGGED"
        });

    } catch (e) {
        console.error("LOG ERROR:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/logs', (req, res) => {
    try {
        if (!fs.existsSync("factory_audit.log")) {
            return res.json([]);
        }

        const data = fs.readFileSync("factory_audit.log", "utf-8");

        const lines = data
            .split("\n")
            .filter(Boolean)
            .reverse(); // latest first

        res.json(lines.slice(0, 50)); // last 50 logs

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