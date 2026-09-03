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

import {
    generateMerkleRoot
} from "./merkle.service.js";

import {
    getDB
} from "../database/sqlite.js";


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

    // Only active blocks participate in continuity checking.
    // TAMPERED / DISCARDED / ACKNOWLEDGED blocks are quarantined and
    // must be resolved by an admin before the chain can be verified.
    const blocks =
        await LocalChain
        .find({
            incidentId,
            status: { $in: ["PENDING_VERIFICATION", "VERIFIED"] }
        })
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
 *
 * Only CLOSED incidents are returned. An OPEN incident is still
 * accumulating blocks during an outage and must not be merged
 * prematurely. This also ensures that admin-recovered blocks (from
 * a previously closed incident) are picked up on the next worker
 * cycle without needing a new incident to be open.
 */
const getIncidentsWithPendingLocalBlocks = async () => {

    // Collect incidentIds of already-closed incidents only.
    const closedIncidentIds =
        await NetworkIncident.distinct(
            "incidentId",
            { status: "CLOSED" }
        );

    if (closedIncidentIds.length === 0) {
        return [];
    }

    return LocalChain.distinct(
        "incidentId",
        {
            incidentId: { $in: closedIncidentIds },
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

    // Guard — if there are unresolved TAMPERED blocks, skip this
    // incident entirely. verifyLocalChain skips TAMPERED blocks, so
    // running it now would cause innocent subsequent blocks (whose
    // previousRoot references the tampered block) to be flagged as
    // broken. Wait for the admin to recover or acknowledge/discard
    // all tampered blocks first.
    const unresolvedTampered =
        await LocalChain.countDocuments({
            incidentId,
            status: "TAMPERED"
        });

    if (unresolvedTampered > 0) {

        return {
            incidentId,
            merged: false,
            skipped: true,
            pendingAdminResolution: unresolvedTampered,
            mergedCount: 0,
            errors: []
        };

    }


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



/*
 * Returns all local blocks whose tampering has been detected but not
 * yet resolved by an admin.
 *
 * Sorted oldest-first so the admin resolves them in chain order —
 * recovering block N before N+1 ensures the re-chaining is correct.
 */
const getTamperedLocalBlocks = async () => {

    return LocalChain
        .find({ status: "TAMPERED" })
        .sort({ createdAt: 1 });

};



/*
 * Compares the tampered local block with its original events from
 * SQLite and shows what the recovered block WOULD look like (dry run).
 *
 * Useful for the admin to understand exactly what was changed before
 * deciding whether to recover or acknowledge/discard.
 */
const inspectLocalBlock = async (batchId) => {

    // Load the tampered block from MongoDB
    const block =
        await LocalChain.findOne({ batchId });

    if (!block) {
        throw new Error(
            `No local block found for batchId: ${batchId}`
        );
    }

    if (block.status !== "TAMPERED") {
        throw new Error(
            `Block ${batchId} is not TAMPERED ` +
            `(current status: ${block.status})`
        );
    }


    // Fetch original events from SQLite (trusted source)
    const db = getDB();

    const events = await db.all(
        `SELECT * FROM events WHERE batchId = ? ORDER BY id ASC`,
        [batchId]
    );


    // Recompute what the merkle root should be
    const recomputedMerkleRoot =
        events.length > 0
        ? generateMerkleRoot(events)
        : null;


    // Find what previousRoot the recovered block would chain from —
    // the most recent ACTIVE block in this incident before this one.
    const previousActiveBlock =
        await LocalChain.findOne({
            incidentId: block.incidentId,
            status: { $in: ["PENDING_VERIFICATION", "VERIFIED"] },
            createdAt: { $lt: block.createdAt }
        })
        .sort({ createdAt: -1 });

    const expectedPreviousRoot =
        previousActiveBlock
        ? previousActiveBlock.currentRoot
        : LOCAL_GENESIS;


    // Compute what the recovered chainedRoot would be
    const expectedCurrentRoot =
        recomputedMerkleRoot
        ? crypto
            .createHash("sha256")
            .update(expectedPreviousRoot + recomputedMerkleRoot)
            .digest("hex")
        : null;


    return {

        batchId,

        incidentId: block.incidentId,

        status: block.status,

        // What is stored in the (potentially tampered) DB right now
        stored: {
            previousRoot:    block.previousRoot,
            currentRoot:     block.currentRoot,
            merkleRoot:      block.merkleRoot,
            eventCount:      block.eventCount,
            signature:       block.signature
        },

        // What it should look like, rebuilt from SQLite
        recomputed: {
            previousRoot:    expectedPreviousRoot,
            currentRoot:     expectedCurrentRoot,
            merkleRoot:      recomputedMerkleRoot,
            eventCount:      events.length,
            sqliteEvents:    events
        },

        // Summary of what was tampered
        tamperAnalysis: {
            merkleRootMatch:
                block.merkleRoot === recomputedMerkleRoot,

            previousRootMatch:
                block.previousRoot === expectedPreviousRoot,

            eventsMissingInSQLite:
                events.length === 0,

            canRecover:
                events.length > 0
        }

    };

};



/*
 * Recovers a TAMPERED local block by rebuilding it from the trusted
 * SQLite event store and re-chaining it onto the previous active
 * block in the same incident.
 *
 * TRUST BOUNDARY NOTE: in this dev setup, SQLite and MongoDB are on
 * the same machine. An attacker with MongoDB write access may also
 * have SQLite write access, limiting the trust separation. In
 * production, SQLite should be on a write-protected, isolated store
 * (e.g. append-only audit log on separate hardware) so this recovery
 * path is meaningful.
 *
 * Resolve blocks in chronological order. Recovering block N changes
 * its currentRoot, which shifts the expected previousRoot of block
 * N+1 — so N+1 must be recovered after N.
 */
const recoverLocalBlock = async (batchId) => {

    // Step 1 — locate the tampered block
    const block =
        await LocalChain.findOne({ batchId });

    if (!block) {
        throw new Error(
            `No local block found for batchId: ${batchId}`
        );
    }

    if (block.status !== "TAMPERED") {
        throw new Error(
            `Block ${batchId} is not TAMPERED ` +
            `(current status: ${block.status})`
        );
    }


    // Step 2 — re-fetch original events from SQLite (trusted source)
    const db = getDB();

    const events = await db.all(
        `SELECT * FROM events WHERE batchId = ? ORDER BY id ASC`,
        [batchId]
    );

    if (events.length === 0) {
        throw new Error(
            `No events found in SQLite for batchId ${batchId}. ` +
            `SQLite may also be compromised — use discardLocalBlock instead.`
        );
    }


    // Step 3 — recompute Merkle root from the trusted events
    const merkleRoot =
        generateMerkleRoot(events);


    // Step 4 — find the previous ACTIVE block in this incident
    // (PENDING_VERIFICATION or VERIFIED, before this block's timestamp).
    // TAMPERED / DISCARDED / ACKNOWLEDGED blocks are not part of the
    // active chain and are excluded from the previousRoot lookup.
    const previousActiveBlock =
        await LocalChain.findOne({
            incidentId: block.incidentId,
            status: { $in: ["PENDING_VERIFICATION", "VERIFIED"] },
            createdAt: { $lt: block.createdAt }
        })
        .sort({ createdAt: -1 });

    const previousRoot =
        previousActiveBlock
        ? previousActiveBlock.currentRoot
        : LOCAL_GENESIS;


    // Step 5 — re-chain onto the previous active block
    const chainedRoot =
        crypto
        .createHash("sha256")
        .update(previousRoot + merkleRoot)
        .digest("hex");


    // Step 6 — re-sign with correct values
    const signablePayload =
        buildSignablePayload({
            batchId,
            previousRoot,
            currentRoot: chainedRoot,
            eventCount:  events.length
        });

    const signature  = signMessage(signablePayload);
    const publicKey  = getPublicKeyPem();


    // Step 7 — persist the rebuilt block
    await LocalChain.findByIdAndUpdate(
        block._id,
        {
            previousRoot,
            currentRoot: chainedRoot,
            merkleRoot,
            eventCount:  events.length,
            signature,
            publicKey,
            status: "PENDING_VERIFICATION"
        }
    );


    // Step 8 — cascade re-chain to subsequent PENDING_VERIFICATION blocks.
    //
    // Recovering block B gives it a new currentRoot. Every PENDING block
    // after B in the same incident has a stale previousRoot that now
    // points to B's OLD root. We fix them automatically here so the admin
    // doesn't have to touch each one.
    //
    // Rules:
    //   PENDING_VERIFICATION → re-chain from the running tail, continue
    //   DISCARDED / ACKNOWLEDGED → skip (jump over, tail unchanged)
    //   TAMPERED → STOP — that block needs its own admin decision first
    //
    // We trust the existing merkleRoot of PENDING blocks (their signatures
    // were valid when they were created; only the chain roots need fixing).
    const subsequentBlocks =
        await LocalChain
        .find({
            incidentId: block.incidentId,
            createdAt:  { $gt: block.createdAt }
        })
        .sort({ createdAt: 1 });

    let runningRoot = chainedRoot;

    const cascaded = [];

    for (const sub of subsequentBlocks) {

        // Stop cascade — this block needs admin resolution first.
        if (sub.status === "TAMPERED") {
            break;
        }

        // Skip non-active forensic blocks — they don't participate
        // in the active chain, so the running root doesn't change.
        if (
            sub.status === "DISCARDED" ||
            sub.status === "ACKNOWLEDGED"
        ) {
            continue;
        }

        // Re-chain this PENDING_VERIFICATION block from the running tail.
        const newSubRoot =
            crypto
            .createHash("sha256")
            .update(runningRoot + sub.merkleRoot)
            .digest("hex");

        const subPayload =
            buildSignablePayload({
                batchId:       sub.batchId,
                previousRoot:  runningRoot,
                currentRoot:   newSubRoot,
                eventCount:    sub.eventCount
            });

        const subSignature = signMessage(subPayload);
        const subPublicKey = getPublicKeyPem();

        await LocalChain.findByIdAndUpdate(
            sub._id,
            {
                previousRoot: runningRoot,
                currentRoot:  newSubRoot,
                signature:    subSignature,
                publicKey:    subPublicKey
            }
        );

        cascaded.push(sub.batchId);
        runningRoot = newSubRoot;

    }


    return {
        batchId,
        recovered:      true,
        incidentId:     block.incidentId,
        previousRoot,
        newCurrentRoot: chainedRoot,
        eventCount:     events.length,
        cascadeRechained: cascaded
    };

};



/*
 * Admin acknowledges the tampering and accepts the block as-is.
 *
 * The block stays flagged ACKNOWLEDGED — it is never anchored.
 * Use this when the tampered data has been noted for audit purposes
 * and the admin consciously chooses not to recover it.
 */
const acknowledgeLocalBlock = async (batchId) => {

    const block =
        await LocalChain.findOne({ batchId });

    if (!block) {
        throw new Error(
            `No local block found for batchId: ${batchId}`
        );
    }

    if (block.status !== "TAMPERED") {
        throw new Error(
            `Block ${batchId} is not TAMPERED ` +
            `(current status: ${block.status}). ` +
            `Only TAMPERED blocks can be acknowledged.`
        );
    }

    await LocalChain.findByIdAndUpdate(
        block._id,
        { status: "ACKNOWLEDGED" }
    );

    return {
        batchId,
        acknowledged: true,
        incidentId:   block.incidentId,
        status:       "ACKNOWLEDGED"
    };

};



/*
 * Admin permanently discards a TAMPERED block.
 *
 * Use this when recovery is impossible (e.g. SQLite events also
 * missing) or the admin decides the block should never be anchored.
 * The block is kept as a forensic record but will never be merged
 * into the main chain.
 */
const discardLocalBlock = async (batchId) => {

    const block =
        await LocalChain.findOne({ batchId });

    if (!block) {
        throw new Error(
            `No local block found for batchId: ${batchId}`
        );
    }

    if (block.status !== "TAMPERED") {
        throw new Error(
            `Block ${batchId} is not TAMPERED ` +
            `(current status: ${block.status}). ` +
            `Only TAMPERED blocks can be discarded.`
        );
    }

    await LocalChain.findByIdAndUpdate(
        block._id,
        { status: "DISCARDED" }
    );

    return {
        batchId,
        discarded:  true,
        incidentId: block.incidentId,
        status:     "DISCARDED"
    };

};



export {
    createLocalChainedRoot,
    verifyLocalChain,
    mergeIncidentLocalChain,
    mergeAllPendingLocalChains,
    getIncidentsWithPendingLocalBlocks,
    LOCAL_GENESIS,
    getTamperedLocalBlocks,
    inspectLocalBlock,
    recoverLocalBlock,
    acknowledgeLocalBlock,
    discardLocalBlock
};