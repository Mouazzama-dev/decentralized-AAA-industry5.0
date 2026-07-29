import { ethers } from "ethers";

import {
    networkIncidentContract
} from "../blockchain/networkIncident.contract.js";


/**
 * Date, milliseconds ya Unix seconds ko
 * Unix seconds mein convert karta hai.
 */
const toUnixSeconds = (value) => {

    if (!value) {
        throw new Error("TIMESTAMP_REQUIRED");
    }

    if (value instanceof Date) {
        return Math.floor(value.getTime() / 1000);
    }

    if (typeof value === "string") {

        const numericValue = Number(value);

        if (!Number.isNaN(numericValue)) {
            return toUnixSeconds(numericValue);
        }

        const parsedDate = new Date(value);

        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error("INVALID_TIMESTAMP");
        }

        return Math.floor(parsedDate.getTime() / 1000);
    }

    if (typeof value === "number") {

        // Milliseconds timestamp
        if (value > 10_000_000_000) {
            return Math.floor(value / 1000);
        }

        // Already Unix seconds
        return Math.floor(value);
    }

    throw new Error("INVALID_TIMESTAMP");
};


/**
 * Network failure ko blockchain par anchor karta hai.
 *
 * Is function ko RPC recovery ke baad call karna hai,
 * kyun ke failure ke waqt RPC unavailable hota hai.
 */
export const logNetworkFailureOnBlockchain = async ({
    incidentId,
    reason,
    startedAt
}) => {

    if (!incidentId) {
        throw new Error("INCIDENT_ID_REQUIRED");
    }

    if (!reason) {
        throw new Error("INCIDENT_REASON_REQUIRED");
    }

    const failureObservedAt =
        toUnixSeconds(startedAt);

    const reasonHash =
        ethers.keccak256(
            ethers.toUtf8Bytes(reason)
        );

    /*
     * Retry protection:
     * Check karta hai ke incident pehle se
     * blockchain par logged to nahi.
     */
    const existingIncident =
        await networkIncidentContract.getIncident(
            incidentId
        );

    const exists = existingIncident[0];

    if (exists) {

        return {
            success: true,
            alreadyLogged: true,
            incidentId,
            reasonHash: existingIncident[2],
            failureObservedAt:
                Number(existingIncident[3])
        };
    }

    const transaction =
        await networkIncidentContract
            .logNetworkFailure(
                incidentId,
                reasonHash,
                failureObservedAt
            );

    const receipt =
        await transaction.wait();

    return {
        success: true,
        alreadyLogged: false,
        incidentId,
        reasonHash,
        failureObservedAt,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
    };
};


/**
 * Network recovery ko blockchain par anchor karta hai.
 *
 * Contract downtime khud calculate karega:
 *
 * recoveryObservedAt - failureObservedAt
 */
export const logNetworkRecoveryOnBlockchain = async ({
    incidentId,
    resolvedAt
}) => {

    if (!incidentId) {
        throw new Error("INCIDENT_ID_REQUIRED");
    }

    const recoveryObservedAt =
        toUnixSeconds(resolvedAt);

    const existingIncident =
        await networkIncidentContract.getIncident(
            incidentId
        );

    const exists = existingIncident[0];
    const isOpen = existingIncident[1];

    if (!exists) {
        throw new Error(
            "FAILURE_NOT_ANCHORED_ON_BLOCKCHAIN"
        );
    }

    /*
     * Recovery already logged ho to
     * duplicate transaction send nahi hogi.
     */
    if (!isOpen) {

        return {
            success: true,
            alreadyLogged: true,
            incidentId,
            recoveryObservedAt:
                Number(existingIncident[4]),
            downtime:
                Number(existingIncident[5])
        };
    }

    const transaction =
        await networkIncidentContract
            .logNetworkRecovery(
                incidentId,
                recoveryObservedAt
            );

    const receipt =
        await transaction.wait();

    /*
     * Updated incident dobara blockchain se read karte hain
     * taa ke contract-calculated downtime mile.
     */
    const updatedIncident =
        await networkIncidentContract.getIncident(
            incidentId
        );

    return {
        success: true,
        alreadyLogged: false,
        incidentId,
        recoveryObservedAt:
            Number(updatedIncident[4]),
        downtime:
            Number(updatedIncident[5]),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
    };
};