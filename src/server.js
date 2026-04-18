import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_WALLET_ADDRESS = "0x5d1a7e1b7dc23d2e1f677e1ed919fb501d36205e";

// =======================
// STATE FILE
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
// ADMIN CHECK
// =======================
app.post('/api/is-admin', (req, res) => {
    const { address } = req.body;
    res.json({ isAdmin: address?.toLowerCase() === ADMIN_WALLET_ADDRESS });
});

// =======================
// GET IDENTITIES
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
// ACTIVATE
// =======================
app.post('/api/activate-did', (req, res) => {
    const { did, address } = req.body;

    if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
        return res.status(403).json({ error: "Only admin" });
    }

    inactiveDids = inactiveDids.filter(d => d !== did);
    if (!activeDids.includes(did)) activeDids.push(did);

    saveState();
    res.json({ success: true });
});

// =======================
// DEACTIVATE
// =======================
app.post('/api/deactivate-did', (req, res) => {
    const { did, address } = req.body;

    if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
        return res.status(403).json({ error: "Only admin" });
    }

    activeDids = activeDids.filter(d => d !== did);
    if (!inactiveDids.includes(did)) inactiveDids.push(did);

    saveState();
    res.json({ success: true });
});

// =======================
// REGISTER
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
// ISSUE VC (🔥 FIXED)
// =======================
app.post('/api/issue-permit', async (req, res) => {
    try {
        const { operatorDid, deviceDid, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin can issue" });
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

        // 🔥 THIS WAS MISSING
        await agent.dataStoreSaveVerifiableCredential({
            verifiableCredential: credential
        });

        console.log("✅ VC SAVED");

        res.json(credential);

    } catch (e) {
        console.error("❌ VC ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

// =======================
// ACCESS CHECK
// =======================
app.post('/api/check-access', async (req, res) => {
    try {
        const { operatorDid, deviceDid, action } = req.body;

        const identifiers = await agent.didManagerFind();
        const admin = identifiers.find(i => i.alias === 'factory-admin');

        const vcs = await agent.dataStoreORMGetVerifiableCredentials({
            where: [{ column: 'subject', value: [operatorDid] }]
        });

        console.log("VC COUNT:", vcs.length);

        const validPermit = vcs.find(vc => {
            const c = vc.verifiableCredential;
            return (
                c.issuer.id === admin.did &&
                c.credentialSubject.authorizedDeviceId === deviceDid
            );
        });

        if (!validPermit) {
            return res.json({ success: false, reason: "NO_PERMIT" });
        }

        const allowed = validPermit.verifiableCredential.credentialSubject.allowedActions;

        if (!allowed.includes(action)) {
            return res.json({ success: false, reason: "INVALID_ACTION" });
        }

        return res.json({ success: true });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(5000, () => console.log("🚀 Server running on 5000"));