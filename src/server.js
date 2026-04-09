import express from 'express';
import cors from 'cors';
import { agent } from '../agent.js'; // Aapke agent ka path

const app = express();
app.use(cors());
app.use(express.json());

// 1. Get all Identities (Registry)
app.get('/api/identities', async (req, res) => {
    try {
        const identifiers = await agent.didManagerFind();
        const formatted = identifiers.map(i => ({
            alias: i.alias,
            did: i.did,
            // Simple logic to detect type based on alias
            type: i.alias.includes('robot') || i.alias.includes('lathe') ? 'device' : 'operator'
        }));
        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Create New DID
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

// 3. Issue Verifiable Credential (Permit)
app.post('/api/issue-permit', async (req, res) => {
    try {
        const { operatorDid, deviceDid } = req.body;

        const credential = await agent.createVerifiableCredential({
            credential: {
                issuer: { id: 'did:ethr:sepolia:0xYOUR_ADMIN_DID_HERE' }, // Yahan Admin ka DID dalien ya agent se fetch karein
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
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Verify a Permit (The Machine's Gatekeeper)
app.post('/api/verify-permit', async (req, res) => {
    try {
        const { vc } = req.body; // The JWT string from the frontend
        
        const result = await agent.verifyCredential({
            credential: vc
        });

        if (result.verified) {
            res.json({ success: true, message: "Credential Verified!" });
        } else {
            res.status(401).json({ success: false, message: "Invalid Signature!" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Backend Bridge running on http://localhost:${PORT}`));