import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js';

const app = express();
app.use(cors());
app.use(express.json());

// ✅ STATE MANAGEMENT
let activeDids = ['factory-admin'];
let inactiveDids = []; // 🔥 NEW

const ADMIN_WALLET_ADDRESS = "0x5d1a7e1b7dc23d2e1f677e1ed919fb501d36205e";

// ✅ ADMIN CHECK
app.post('/api/is-admin', (req, res) => {
    const { address } = req.body;
    res.json({
        isAdmin: address?.toLowerCase() === ADMIN_WALLET_ADDRESS
    });
});

// ✅ GET IDENTITIES (3 STATES)
app.get('/api/identities', async (req, res) => {
    try {
        const identifiers = await agent.didManagerFind();

        const formatted = identifiers.map(i => ({
            alias: i.alias,
            did: i.did,
            type: i.alias.includes('robot') || i.alias.includes('lathe') ? 'device' : 'operator',

            // 🔥 3 STATE LOGIC
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

// ✅ ACTIVATE
app.post('/api/activate-did', async (req, res) => {
    try {
        const { did, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin can activate!" });
        }

        // remove from inactive
        inactiveDids = inactiveDids.filter(d => d !== did);

        // add to active
        if (!activeDids.includes(did)) {
            activeDids.push(did);
        }

        console.log(`✅ Activated: ${did}`);

        res.json({ success: true });

    } catch {
        res.status(500).json({ error: "Activation Error" });
    }
});

// ✅ DEACTIVATE
app.post('/api/deactivate-did', async (req, res) => {
    try {
        const { did, address } = req.body;

        if (!address || address.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
            return res.status(403).json({ error: "Only admin can deactivate!" });
        }

        // remove from active
        activeDids = activeDids.filter(d => d !== did);

        // add to inactive
        if (!inactiveDids.includes(did)) {
            inactiveDids.push(did);
        }

        console.log(`❌ Deactivated: ${did}`);

        res.json({ success: true });

    } catch {
        res.status(500).json({ error: "Deactivation Error" });
    }
});

// ✅ REGISTER
app.post('/api/register', async (req, res) => {
    try {
        const { alias, type } = req.body;

        const identity = await agent.didManagerCreate({
            alias,
            provider: 'did:ethr:sepolia'
        });

        res.json({ alias, type, did: identity.did });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ✅ ISSUE VC
app.post('/api/issue-permit', async (req, res) => {
    try {
        const { operatorDid, deviceDid } = req.body;

        const credential = await agent.createVerifiableCredential({
            credential: {
                issuer: { id: 'did:ethr:sepolia:0xYOUR_ADMIN_DID_HERE' },
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
        res.status(500).json({ error: e.message });
    }
});

// ✅ VERIFY
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