import express from "express";
import { performAction } from "../services/action.service.js";

const router = express.Router();

/*
 * POST /api/action/perform
 *
 * Body:
 *   credential   – the JWT VC issued by admin via POST /api/permit/issue
 *   operatorDid  – did:ethr:sepolia:0x...
 *   machineDid   – did:ethr:sepolia:0x...
 *   action       – e.g. "WELD", "CUT", "MOVE_UP"
 *
 * Checks (in order):
 *   1. operatorDid is ACTIVE in the identity store
 *   2. machineDid  is ACTIVE in the identity store
 *   3. VC signature is valid
 *   4. VC grants this operator → this machine → this action
 *   5. If all pass: write audit event to SQLite (picked up by batch worker)
 *
 * Response 200:
 *   { authorized: true,  reason, auditEventId, operatorDid, machineDid, action, timestamp }
 *   { authorized: false, reason, auditEventId: null }
 */
router.post("/perform", async (req, res) => {
    try {
        const { credential, operatorDid, machineDid, action } = req.body;

        if (!credential || !operatorDid || !machineDid || !action) {
            return res.status(400).json({
                error: "credential, operatorDid, machineDid and action are all required"
            });
        }

        const result = await performAction({
            credential,
            operatorDid,
            machineDid,
            action
        });

        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
