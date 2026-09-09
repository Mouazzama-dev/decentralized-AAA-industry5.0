import IdentityModel from "../models/Identity.js";
import { checkAuthorization } from "./authorization.service.js";
import { createAuditEvent } from "./audit.service.js";
import { getDB } from "../database/sqlite.js";

const logDenied = async ({ operatorDid, machineDid, action, reason }) => {
    const db = getDB();
    const timestamp = new Date().toISOString();
    await db.run(
        `INSERT INTO denied_events (operatorDid, machineDid, action, reason, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [operatorDid, machineDid, action, reason, timestamp]
    );
};

const performAction = async ({
    credential,
    operatorDid,
    machineDid,
    action
}) => {

    // Step 1 — operator must be an approved identity
    const store = await IdentityModel.findOne({ key: "main_store" });

    const operatorActive = store?.operators.some(o => o.did === operatorDid);
    if (!operatorActive) {
        const reason = "Operator DID not registered or not yet approved";
        await logDenied({ operatorDid, machineDid, action, reason });
        return { authorized: false, reason, auditEventId: null };
    }

    // Step 2 — machine must be an approved identity
    const machineActive = store?.machines.some(m => m.did === machineDid);
    if (!machineActive) {
        const reason = "Machine DID not registered or not yet approved";
        await logDenied({ operatorDid, machineDid, action, reason });
        return { authorized: false, reason, auditEventId: null };
    }

    // Step 3 & 4 — verify VC signature + check claims (operator, machine, action)
    const authResult = await checkAuthorization({
        credential,
        operatorDid,
        machineDid,
        action
    });

    if (!authResult.authorized) {
        await logDenied({ operatorDid, machineDid, action, reason: authResult.reason });
        return { authorized: false, reason: authResult.reason, auditEventId: null };
    }

    // Step 5 — all checks passed: log the audit event
    const event = await createAuditEvent({
        operatorDid,
        deviceDid: machineDid,
        action
    });

    return {
        authorized: true,
        reason: "Access granted",
        auditEventId: event.id,
        operatorDid,
        machineDid,
        action,
        timestamp: event.timestamp
    };
};

export { performAction };
