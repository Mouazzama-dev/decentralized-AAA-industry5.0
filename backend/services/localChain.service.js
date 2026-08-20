import crypto from "crypto";

import LocalChain from "../models/LocalChain.js";

import MerkleChain from "../models/MerkleChain.js";

import NetworkIncident from "../models/NetworkIncident.js";

import {
    signMessage,
    verifySignature,
    getPublicKeyPem
} from "./signingKey.service.js";

import {
    buildSignablePayload,
    getLastMainRoot
} from "./merkleChain.service.js";


// Local genesis root — each incident's local chain starts fresh
// from this value (epoch model: one independent chain per epoch).
const LOCAL_GENESIS =
    "0x0000000000000000000000000000000000000000000000000000000000000000";



/*
 * Creates a signed block on the LOCAL chain of a SPECIFIC incident.
 *
 * The block is chained onto the previous block OF THE SAME INCIDENT
 * only. Each incident therefore forms its own independent local
 * chain (an epoch), isolated from other incidents.
 */
const createLocalChainedRoot = async ({
    merkleRoot,
    eventCount,
    batchId,
    incidentId
}) => {

    // Only look at blocks belonging to THIS incident.
    const lastLocal =
        await LocalChain
        .findOne({ incidentId })
        .sort({ createdAt: -1 });


    const previousRoot =
        lastLocal
        ? lastLocal.currentRoot
        : LOCAL_GENESIS;


    const chainedRoot =
        crypto
        .createHash("sha256")
        .update(previousRoot + merkleRoot)
        .digest("hex");


    const signablePayload =
        buildSignablePayload({
            batchId,
            previousRoot,
            currentRoot: chainedRoot,
            eventCount
        });

    const signature =
        signMessage(signablePayload);

    const publicKey =
        getPublicKeyPem();


    const record =
        await LocalChain.create({
            batchId,
            incidentId,
            previousRoot,
            currentRoot: chainedRoot,
            eventCount,
            merkleRoot,
            signature,
            publicKey,
            status: "PENDING_VERIFICATION"
        });


    return record;
};



/*
 * Verifies the local chain of a SINGLE incident.
 *
 * Two checks per block:
 *   1. Signature validity  -> tampered fields
 *   2. Chain continuity    -> deleted / inserted / reordered blocks
 *
 * The chain is scoped to one incident, so continuity is checked
 * from LOCAL_GENESIS through that incident's blocks only.
 */
const verifyLocalChain = async (incidentId) => {

    const blocks =
        await LocalChain
        .find({ incidentId })
        .sort({ createdAt: 1 });


    const errors = [];

    let expectedPreviousRoot = LOCAL_GENESIS;


    for (const block of blocks) {

        // Check 1 — signature
        if (!block.signature || !block.publicKey) {

            errors.push({
                batchId: block.batchId,
                blockId: block._id,
                type: "SIGNATURE_INVALID",
                detail: "Missing signature or public key"
            });

        } else {

            const payload =
                buildSignablePayload({
                    batchId: block.batchId,
                    previousRoot: block.previousRoot,
                    currentRoot: block.currentRoot,
                    eventCount: block.eventCount
                });

            const signatureOk =
                verifySignature(
                    payload,
                    block.signature,
                    block.publicKey
                );

            if (!signatureOk) {

                errors.push({
                    batchId: block.batchId,
                    blockId: block._id,
                    type: "SIGNATURE_INVALID",
                    detail: "Signature does not match block contents"
                });

            }

        }


        // Check 2 — chain continuity
        if (block.previousRoot !== expectedPreviousRoot) {

            errors.push({
                batchId: block.batchId,
                blockId: block._id,
                type: "CHAIN_BREAK",
                detail:
                    `Expected previousRoot ${expectedPreviousRoot}, ` +
                    `found ${block.previousRoot}`
            });

        }

        expectedPreviousRoot = block.currentRoot;

    }


    return {
        valid: errors.length === 0,
        incidentId,
        totalBlocks: blocks.length,
        checked: blocks.length,
        // The last block's currentRoot is this epoch's final root.
        finalRoot:
            blocks.length > 0
            ? blocks[blocks.length - 1].currentRoot
            : null,
        errors
    };

};



/*
 * Returns the distinct incidentIds that still have local blocks
 * waiting to be verified/merged.
 */
const getIncidentsWithPendingLocalBlocks = async () => {

    return LocalChain.distinct(
        "incidentId",
        {
            status: {
                $in: ["PENDING_VERIFICATION", "VERIFIED"]
            }
        }
    );

};



/*
 * Merges ONE incident's local chain into the main chain.
 *
 *   - Verify the incident's local chain.
 *   - If INVALID -> refuse, flag offending blocks TAMPERED, record
 *     TAMPERED status on the incident, report the offending batch.
 *   - If VALID -> re-chain + re-sign each block onto the main chain
 *     tail, insert as PENDING (so the worker anchors it), save the
 *     epoch's final root on the incident, then DROP the incident's
 *     local blocks (keep the root, discard the tree).
 */
const mergeIncidentLocalChain = async (incidentId) => {

    // Step 1 — verify this incident's local chain
    const verification =
        await verifyLocalChain(incidentId);

    // Step 2 — refuse on tampering
    if (!verification.valid) {

        for (const err of verification.errors) {

            if (err.blockId) {

                await LocalChain.findByIdAndUpdate(
                    err.blockId,
                    { status: "TAMPERED" }
                );

            }

        }

        await NetworkIncident.findOneAndUpdate(
            { incidentId },
            { localChainStatus: "TAMPERED" }
        );

        return {
            incidentId,
            merged: false,
            mergedCount: 0,
            errors: verification.errors
        };

    }


    // Step 3 — merge the (clean) local chain onto the main chain
    const pendingBlocks =
        await LocalChain
        .find({
            incidentId,
            status: {
                $in: ["PENDING_VERIFICATION", "VERIFIED"]
            }
        })
        .sort({ createdAt: 1 });


    if (pendingBlocks.length === 0) {

        return {
            incidentId,
            merged: true,
            mergedCount: 0,
            errors: []
        };

    }


    let mainTail =
        await getLastMainRoot();

    const mergedBatchIds = [];


    for (const localBlock of pendingBlocks) {

        // Re-chain onto the main tail using the ORIGINAL merkle root
        const newCurrentRoot =
            crypto
            .createHash("sha256")
            .update(mainTail + localBlock.merkleRoot)
            .digest("hex");

        // Re-sign (previousRoot / currentRoot changed)
        const signablePayload =
            buildSignablePayload({
                batchId: localBlock.batchId,
                previousRoot: mainTail,
                currentRoot: newCurrentRoot,
                eventCount: localBlock.eventCount
            });

        const signature =
            signMessage(signablePayload);

        const publicKey =
            getPublicKeyPem();

        await MerkleChain.create({
            batchId: localBlock.batchId,
            previousRoot: mainTail,
            currentRoot: newCurrentRoot,
            eventCount: localBlock.eventCount,
            signature,
            publicKey,
            status: "PENDING"
        });

        mergedBatchIds.push(localBlock.batchId);
        mainTail = newCurrentRoot;

    }


    /*
     * Save the epoch root on the incident BEFORE dropping the local
     * blocks. Order matters: persist the root first, then discard.
     */
    await NetworkIncident.findOneAndUpdate(
        { incidentId },
        {
            localChainFinalRoot: verification.finalRoot,
            mergedBatchIds,
            localChainStatus: "MERGED"
        }
    );

    // Drop this incident's local blocks (keep root, discard tree).
    await LocalChain.deleteMany({ incidentId });


    return {
        incidentId,
        merged: true,
        mergedCount: mergedBatchIds.length,
        errors: []
    };

};



/*
 * Processes ALL incidents that have pending local chains on
 * recovery. Each incident is verified and merged independently.
 *
 * Returns a per-incident summary. If ANY incident is tampered, the
 * caller should halt anchoring this cycle.
 */
const mergeAllPendingLocalChains = async () => {

    const incidentIds =
        await getIncidentsWithPendingLocalBlocks();

    const results = [];

    let anyTampered = false;


    for (const incidentId of incidentIds) {

        const result =
            await mergeIncidentLocalChain(incidentId);

        if (!result.merged) {
            anyTampered = true;
        }

        results.push(result);

    }


    return {
        anyTampered,
        results
    };

};



export {
    createLocalChainedRoot,
    verifyLocalChain,
    mergeIncidentLocalChain,
    mergeAllPendingLocalChains,
    getIncidentsWithPendingLocalBlocks,
    LOCAL_GENESIS
};