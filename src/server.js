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
// 🚀 START
// =======================
app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});