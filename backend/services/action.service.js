import IdentityModel from "../models/Identity.js";
import { checkAuthorization } from "./authorization.service.js";
import { createAuditEvent } from "./audit.service.js";

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
        return {
            authorized: false,
            reason: "Operator DID not registered or not yet approved",
            auditEventId: null
        };
    }

    // Step 2 — machine must be an approved identity
    const machineActive = store?.machines.some(m => m.did === machineDid);
    if (!machineActive) {
        return {
            authorized: false,
            reason: "Machine DID not registered or not yet approved",
            auditEventId: null
        };
    }

    // Step 3 & 4 — verify VC signature + check claims (operator, machine, action)
    const authResult = await checkAuthorization({
        credential,
        operatorDid,
        machineDid,
        action
    });

    if (!authResult.authorized) {
        return {
            authorized: false,
            reason: authResult.reason,
            auditEventId: null
        };
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
