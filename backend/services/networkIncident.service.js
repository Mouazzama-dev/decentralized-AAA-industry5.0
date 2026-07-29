import NetworkIncident from "../models/NetworkIncident.js";

import {
    logNetworkFailureOnBlockchain,
    logNetworkRecoveryOnBlockchain
} from "./networkIncident.blockchain.service.js";


let activeIncident = null;


/**
 * RPC unavailable hone par incident MongoDB mein create hota hai.
 * Is waqt blockchain transaction possible nahi hoti.
 */
const createNetworkIncident = async (reason) => {

    // Memory mein already active incident ho
    if (activeIncident) {
        return null;
    }

    // Server restart ke baad existing OPEN incident check karo
    const existingIncident =
        await NetworkIncident.findOne({
            status: "OPEN"
        });

    if (existingIncident) {
        activeIncident = existingIncident._id;
        return existingIncident;
    }

    const incident =
        await NetworkIncident.create({
            incidentId: `INC_${Date.now()}`,
            reason,
            blockchainStatus: "WAITING"
        });

    activeIncident = incident._id;

    console.log(
        `Network incident created: ${incident.incidentId}`
    );

    return incident;
};


/**
 * RPC recover hone par:
 *
 * 1. Failure transaction blockchain par
 * 2. Recovery transaction blockchain par
 * 3. MongoDB incident CLOSED
 */
const resolveNetworkIncident = async () => {

    const incident =
        await NetworkIncident.findOne({
            status: "OPEN"
        });

    if (!incident) {
        activeIncident = null;
        return null;
    }

    const resolvedAt = new Date();

    try {

        /*
         * TX 1 — NETWORK_FAILURE
         */
        const failureResult =
            await logNetworkFailureOnBlockchain({
                incidentId: incident.incidentId,
                reason: incident.reason,
                startedAt: incident.startedAt
            });

        /*
         * Failure TX details immediately save karo.
         * Agar recovery TX fail ho, failure TX record lost nahi hoga.
         */
        if (failureResult.transactionHash) {
            incident.failureTxHash =
                failureResult.transactionHash;
        }

        if (failureResult.blockNumber) {
            incident.failureBlockNumber =
                failureResult.blockNumber;
        }

        await incident.save();

        console.log(
            `Network failure anchored: ${incident.incidentId}`
        );


        /*
         * TX 2 — NETWORK_RECOVERY
         */
        const recoveryResult =
            await logNetworkRecoveryOnBlockchain({
                incidentId: incident.incidentId,
                resolvedAt
            });

        if (recoveryResult.transactionHash) {
            incident.recoveryTxHash =
                recoveryResult.transactionHash;
        }

        if (recoveryResult.blockNumber) {
            incident.recoveryBlockNumber =
                recoveryResult.blockNumber;
        }

        incident.resolvedAt = resolvedAt;

        incident.duration =
            recoveryResult.downtime;

        incident.status = "CLOSED";

        incident.blockchainStatus =
            "CONFIRMED";

        incident.lastBlockchainError = null;

        await incident.save();

        activeIncident = null;

        console.log(
            `Network incident resolved: ${incident.incidentId}`
        );

        console.log(
            `Downtime: ${incident.duration} seconds`
        );

        return incident;

    } catch (error) {

        incident.blockchainStatus =
            "WAITING_RETRY";

        incident.lastBlockchainError =
            error.shortMessage ||
            error.reason ||
            error.message;

        await incident.save();

        console.error(
            "Network incident blockchain sync failed:",
            incident.lastBlockchainError
        );

        // Incident OPEN rahega taa ke worker retry kare
        return null;
    }
};


export {
    createNetworkIncident,
    resolveNetworkIncident
};