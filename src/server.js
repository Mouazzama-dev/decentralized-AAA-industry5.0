import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_WALLET_ADDRESS = "0x5d1a7e1b7dc23d2e1f677e1ed919fb501d36205e";

// 📁 FILE PATH
const STATE_FILE = './did-state.json';

// 🔄 LOAD STATE
const loadState = () => {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error("❌ Error loading state:", err);
    }
    return { activeDids: ['factory-admin'], inactiveDids: [] };
};

// 💾 SAVE STATE
const saveState = () => {
    try {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify({ activeDids, inactiveDids }, null, 2)
        );
    } catch (err) {
        console.error("❌ Error saving state:", err);
    }
};

// ✅ INITIALIZE (ONLY ONCE)
let { activeDids, inactiveDids } = loadState();

console.log("📦 Loaded State:", activeDids);

// =======================
// 🔐 ADMIN CHECK
// =======================
app.post('/api/is-admin', (req, res) => {
    const { address } = req.body;
    res.json({
        isAdmin: address?.toLowerCase() === ADMIN_WALLET_ADDRESS
    });
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
            type: i.alias.includes('robot') || i.alias.includes('lathe')
                ? 'device'
                : 'operator',

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
// ✅ ACTIVATE
// =======================
app.post('/api/activate-did', async (req, res) => {
    try {
        const { did, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin can activate!" });
        }

        inactiveDids = inactiveDids.filter(d => d !== did);

        if (!activeDids.includes(did)) {
            activeDids.push(did);
        }

        saveState(); // 🔥 IMPORTANT

        console.log(`✅ Activated: ${did}`);
        res.json({ success: true });

    } catch (e) {
        res.status(500).json({ error: "Activation Error" });
    }
});

// =======================
// ❌ DEACTIVATE
// =======================
app.post('/api/deactivate-did', async (req, res) => {
    try {
        const { did, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin can deactivate!" });
        }

        activeDids = activeDids.filter(d => d !== did);

        if (!inactiveDids.includes(did)) {
            inactiveDids.push(did);
        }

        saveState(); // 🔥 IMPORTANT

        console.log(`❌ Deactivated: ${did}`);
        res.json({ success: true });

    } catch (e) {
        res.status(500).json({ error: "Deactivation Error" });
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
        const { operatorDid, deviceDid } = req.body;

        const identifiers = await agent.didManagerFind();
        const adminDid = identifiers[0].did;

        const credential = await agent.createVerifiableCredential({
            credential: {
                issuer: { id: adminDid },
                credentialSubject: {
                    id: operatorDid,
                    permit: {
                        resource: deviceDid,
                        access: "EXECUTE",
                        validUntil: "2026-12-31"
                    }
                }
            },
            proofFormat: 'jwt'
        });

        res.json(credential);

    } catch (e) {
        console.error("❌ VC ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

// =======================
// 🔍 VERIFY VC
// =======================
app.post('/api/verify-permit', async (req, res) => {
    try {
        const { vc } = req.body;

        const result = await agent.verifyCredential({ credential: vc });

        if (result.verified) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false });
        }

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));