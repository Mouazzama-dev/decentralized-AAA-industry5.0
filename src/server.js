import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js';
import fs from 'fs';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_WALLET_ADDRESS = "0x5d1a7e1b7dc23d2e1f677e1ed919fb501d36205e";

// =======================
// 🔗 BLOCKCHAIN CONFIG
// =======================
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const PRIVATE_KEY = "0xf58599b4f5d5b15d7158226f7dc3e611ffdd8ff608def33bab39f1add282eff1"; // 🔥 move key to .env
const CONTRACT_ADDRESS = "0x5b23fFb4956E20dC719b4d09c48829871aD244C3";

const ABI = ["function logBatch(string,string,uint8[])"];

const ACTION_MAP = {
    "MOVE_UP": 0,
    "MOVE_DOWN": 1,
    "SWITCH_ON": 2,
    "SWITCH_OFF": 3,
    "ROTATE": 4,
    "CUT": 5
};

let sessionBuffer = [];

// =======================
// 📁 STATE
// =======================
const STATE_FILE = './did-state.json';

const loadState = () => {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        }
    } catch {}
    return { activeDids: ['factory-admin'], inactiveDids: [] };
};

const saveState = () => {
    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({ activeDids, inactiveDids }, null, 2)
    );
};

let { activeDids, inactiveDids } = loadState();

// =======================
// 🔐 ADMIN CHECK
// =======================
app.post('/api/is-admin', (req, res) => {
    const { address } = req.body;
    res.json({ isAdmin: address?.toLowerCase() === ADMIN_WALLET_ADDRESS });
});

// =======================
// 📜 GET IDENTITIES
// =======================
app.get('/api/identities', async (req, res) => {
    try {
        const identifiers = await agent.didManagerFind();

        const formatted = identifiers.map(i => ({
            alias: i.alias,
            did: i.did,
            type: i.alias.includes('robot') ? 'device' : 'operator',
            status: inactiveDids.includes(i.did)
                ? 'INACTIVE'
                : activeDids.includes(i.did) || i.alias === 'factory-admin'
                ? 'ACTIVE'
                : 'PENDING'
        }));

        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =======================
// 🆕 REGISTER
// =======================
app.post('/api/register', async (req, res) => {
    try {
        const { alias } = req.body;

        const identity = await agent.didManagerCreate({
            alias,
            provider: 'did:ethr:sepolia'
        });

        res.json({ alias, did: identity.did });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =======================
// 🔐 ISSUE VC
// =======================
app.post('/api/issue-permit', async (req, res) => {
    try {
        const { operatorDid, deviceDid, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin" });
        }

        const identifiers = await agent.didManagerFind();
        const admin = identifiers.find(i => i.alias === 'factory-admin');

        const credential = await agent.createVerifiableCredential({
            credential: {
                issuer: { id: admin.did },
                credentialSubject: {
                    id: operatorDid,
                    authorizedDeviceId: deviceDid,
                    allowedActions: ["SWITCH_ON","SWITCH_OFF","MOVE_UP","MOVE_DOWN"]
                }
            },
            proofFormat: 'jwt'
        });

        await agent.dataStoreSaveVerifiableCredential({
            verifiableCredential: credential
        });

        console.log("✅ VC SAVED");
        res.json(credential);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =======================
// 🔍 ACCESS CHECK
// =======================
const checkAccessInternal = async (operatorDid, deviceDid, action) => {
    const identifiers = await agent.didManagerFind();
    const admin = identifiers.find(i => i.alias === 'factory-admin');

    const vcs = await agent.dataStoreORMGetVerifiableCredentials({
        where: [{ column: 'subject', value: [operatorDid] }]
    });

    const validPermit = vcs.find(vc => {
        const c = vc.verifiableCredential;
        return (
            c.issuer.id === admin.did &&
            c.credentialSubject.authorizedDeviceId === deviceDid
        );
    });

    if (!validPermit) {
        return { success: false, reason: "NO_PERMIT" };
    }

    const allowed = validPermit.verifiableCredential.credentialSubject.allowedActions;

    if (!allowed.includes(action)) {
        return { success: false, reason: "INVALID_ACTION" };
    }

    return { success: true };
};

app.post('/api/check-access', async (req, res) => {
    try {
        const { operatorDid, deviceDid, action } = req.body;
        const result = await checkAccessInternal(operatorDid, deviceDid, action);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =======================
// 🔗 BLOCKCHAIN FUNCTION
// =======================
async function sendBatchToBlockchain(opDid, devDid, batch) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

        const tx = await contract.logBatch(opDid, devDid, batch);
        console.log("⏳ TX:", tx.hash);

        await tx.wait();
        console.log("✅ ON-CHAIN LOGGED");

    } catch (e) {
        console.error("❌ Blockchain Error:", e.message);
    }
}

// =======================
// 🚀 EXECUTE + BLOCKCHAIN
// =======================
app.post('/api/execute', async (req, res) => {
    try {
        const { operatorDid, deviceDid, action } = req.body;

        console.log("\n🚀 EXECUTION START");

        // 🔐 verify
        const check = await checkAccessInternal(operatorDid, deviceDid, action);

        if (!check.success) {
            console.log("❌ BLOCKED:", check.reason);
            return res.json(check);
        }

        // 🧾 local log
        fs.appendFileSync('factory_audit.log',
            `[${new Date().toISOString()}] ${operatorDid} → ${deviceDid} → ${action}\n`
        );

        console.log("💾 LOCAL LOG SAVED");

        // 📦 batching
        sessionBuffer.push(ACTION_MAP[action]);

        console.log(`📊 Buffer: ${sessionBuffer.length}/10`);

        if (sessionBuffer.length >= 10) {
            console.log("📦 Sending batch to blockchain...");
            await sendBatchToBlockchain(operatorDid, deviceDid, sessionBuffer);
            sessionBuffer = [];
        }

        return res.json({ success: true });

    } catch (e) {
        console.error("❌ EXECUTION ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(5000, () => console.log("🚀 Server running on 5000"));