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

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Backend Bridge running on http://localhost:${PORT}`));