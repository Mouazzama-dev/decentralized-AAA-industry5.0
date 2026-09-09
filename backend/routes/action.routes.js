import express from "express";
import { performAction } from "../services/action.service.js";
import { getDB } from "../database/sqlite.js";

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

/*
 * GET /api/action/denied
 *
 * Returns the full denied-access log from SQLite.
 * Useful for security audits — shows every blocked attempt with reason.
 */
router.get("/denied", async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all(
            `SELECT * FROM denied_events ORDER BY id DESC`
        );
        res.json({ count: rows.length, denied: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
