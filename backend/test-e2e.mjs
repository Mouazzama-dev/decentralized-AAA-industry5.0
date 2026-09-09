/*
 * ---------------------------------------------------------------
 * End-to-end DEMO test for the signed local-chain / incident flow.
 * ---------------------------------------------------------------
 *
 * Scenarios:
 *   1. NORMAL                  - network up, block -> main chain, anchored.
 *   2. INCIDENT + CLEAN        - network down, block -> local chain,
 *                                merged + anchored on recovery.
 *   3. INCIDENT + TAMPERED     - network down, local block tampered,
 *                                merge refused on recovery.
 *   4. ADMIN RECOVER           - tampered block inspected + recovered
 *                                from SQLite; cascade re-chains subsequent
 *                                blocks; worker auto-merges + anchors.
 *   5. ADMIN ACKNOWLEDGE       - tampered block acknowledged by admin;
 *                                stays as forensic record, never anchored.
 *   6. FULL AAA FLOW           - register operator + machine DIDs, approve
 *                                both, issue VC permit, perform an authorized
 *                                action (creates audit event -> batch ->
 *                                anchored), then test denied access (wrong
 *                                action, unknown machine) and verify denied
 *                                events are logged in SQLite.
 *
 * This script:
 *   - generates its own audit events,
 *   - DETECTS the real network state via /network-status (it does
 *     NOT assume the network is up/down just because you pressed
 *     ENTER),
 *   - waits for the worker to actually anchor/merge (polling),
 *   - prints a Sepolia Etherscan link for every anchored batch.
 *
 * You only toggle the RPC (break/fix .env + restart) when asked.
 *
 * Run from the backend folder (server must be running):
 *   node test-e2e.mjs
 * ---------------------------------------------------------------
 */

import "dotenv/config";
import mongoose from "mongoose";
import readline from "readline";

import MerkleChain from "./models/MerkleChain.js";
import LocalChain from "./models/LocalChain.js";
import NetworkIncident from "./models/NetworkIncident.js";


const BASE_URL =
    process.env.TEST_BASE_URL || "http://localhost:5000";

const API        = `${BASE_URL}/api/batch`;
const AUDIT_API  = `${BASE_URL}/api/audit`;
const IDENTITY_API = `${BASE_URL}/api/identity`;
const PERMIT_API   = `${BASE_URL}/api/permit`;
const ACTION_API   = `${BASE_URL}/api/action`;

// Sepolia block explorer
const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";

const STEP_DELAY =
    Number(process.env.TEST_STEP_DELAY || 1200);

const EVENTS_PER_BATCH = 3;

// How long to wait for the worker to do its thing (ms)
const WORKER_TIMEOUT = 40000;
const POLL_INTERVAL = 3000;


// ---- helpers -------------------------------------------------------

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (q) =>
    new Promise((res) => rl.question(`\n${q} `, res));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const step = async (msg) => {
    console.log("\n" + msg);
    await sleep(STEP_DELAY);
};

const ok = (m) => console.log("   [PASS]", m);
const fail = (m) => console.log("   [FAIL]", m);
const info = (m) => console.log("   -", m);
const link = (m) => console.log("   >>", m);

let passed = 0;
let failedCount = 0;

const assert = (cond, message) => {
    if (cond) { passed += 1; ok(message); }
    else { failedCount += 1; fail(message); }
};


// ---- API -----------------------------------------------------------

const getNetworkStatus = async () => {
    try {
        const res = await fetch(`${API}/network-status`);
        const body = await res.json();
        return body.networkUp;
    } catch {
        return null; // server not reachable
    }
};

const createEvent = async () => {
    const res = await fetch(`${AUDIT_API}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            operatorDid: "did:ethr:sepolia:operator1",
            deviceDid: "did:ethr:sepolia:robot1",
            action: "WELD"
        })
    });
    return res.json();
};

const generateEvents = async (n) => {
    for (let i = 0; i < n; i++) {
        await createEvent();
        await sleep(200);
    }
    info(`Generated ${n} PENDING events`);
};

const createBatch = async () => {
    const res = await fetch(`${API}/create`);
    return { status: res.status, body: await res.json() };
};

const verifyMain = async () => {
    const res = await fetch(`${API}/verify`);
    return { status: res.status, body: await res.json() };
};

const verifyLocal = async (incidentId) => {
    const res = await fetch(
        `${API}/verify-local?incidentId=${encodeURIComponent(incidentId)}`
    );
    return { status: res.status, body: await res.json() };
};

const getTampered = async () => {
    const res = await fetch(`${API}/tampered`);
    return { status: res.status, body: await res.json() };
};

const inspectBlock = async (batchId) => {
    const res = await fetch(
        `${API}/local/${encodeURIComponent(batchId)}/inspect`
    );
    return { status: res.status, body: await res.json() };
};

const recoverBlock = async (batchId) => {
    const res = await fetch(
        `${API}/local/${encodeURIComponent(batchId)}/recover`,
        { method: "POST" }
    );
    return { status: res.status, body: await res.json() };
};

const acknowledgeBlock = async (batchId) => {
    const res = await fetch(
        `${API}/local/${encodeURIComponent(batchId)}/acknowledge`,
        { method: "POST" }
    );
    return { status: res.status, body: await res.json() };
};

const discardBlock = async (batchId) => {
    const res = await fetch(
        `${API}/local/${encodeURIComponent(batchId)}/discard`,
        { method: "POST" }
    );
    return { status: res.status, body: await res.json() };
};


/*
 * Ensures the real network state matches what the scenario needs.
 * Loops until the user actually toggles the RPC correctly — so we
 * never run a scenario against the wrong network state.
 */
const ensureNetwork = async (wantUp) => {

    const wanted = wantUp ? "UP" : "DOWN";

    while (true) {

        const up = await getNetworkStatus();

        if (up === null) {
            await ask(
                `Cannot reach the server at ${BASE_URL}. ` +
                `Start it, then press ENTER...`
            );
            continue;
        }

        if (up === wantUp) {
            info(`Confirmed: network is ${wanted}.`);
            return;
        }

        const is = up ? "UP" : "DOWN";
        await ask(
            `Network is currently ${is}, but this step needs it ${wanted}.\n` +
            `   ${wantUp
                ? "Fix the RPC in .env and restart the server"
                : "Break the RPC in .env and restart the server"}, ` +
            `then press ENTER...`
        );
    }
};


/*
 * Polls until predicate() returns truthy, or times out.
 * Used to wait for the worker to anchor / merge.
 */
const waitFor = async (label, predicate) => {

    const start = Date.now();
    process.stdout.write(`   waiting for ${label}`);

    while (Date.now() - start < WORKER_TIMEOUT) {
        const result = await predicate();
        if (result) {
            process.stdout.write(" ... done\n");
            return result;
        }
        process.stdout.write(".");
        await sleep(POLL_INTERVAL);
    }

    process.stdout.write(" ... timeout\n");
    return null;
};

const showTxLink = (label, txHash) => {
    if (txHash) {
        link(`${label} TX: ${EXPLORER_TX}${txHash}`);
    }
};


// ---- AAA API helpers -----------------------------------------------

const registerIdentity = async ({ alias, type, allowedActions = [] }) => {
    const res = await fetch(`${IDENTITY_API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, type, allowedActions })
    });
    return res.json();
};

const approveIdentity = async (did) => {
    const res = await fetch(`${IDENTITY_API}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did })
    });
    return res.json();
};

const issuePerm = async ({ issuerDid, holderDid, machineDid, actions }) => {
    const res = await fetch(`${PERMIT_API}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerDid, holderDid, machineDid, actions })
    });
    return res.json();
};

const performAction = async ({ credential, operatorDid, machineDid, action }) => {
    const res = await fetch(`${ACTION_API}/perform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, operatorDid, machineDid, action })
    });
    return { status: res.status, body: await res.json() };
};

const getDenied = async () => {
    const res = await fetch(`${ACTION_API}/denied`);
    return res.json();
};


// ---- scenarios -----------------------------------------------------

const scenarioNormal = async () => {

    console.log("\n\n=====================================================");
    console.log(" SCENARIO 1 - NORMAL (network up)");
    console.log("=====================================================");
    console.log(" Expectation: block -> MAIN chain -> anchored on Sepolia.");

    await ensureNetwork(true);

    await step("(1) Generating audit events...");
    await generateEvents(EVENTS_PER_BATCH);

    await step("(2) Creating a batch (network up -> should go to MAIN)...");
    const { body } = await createBatch();

    if (body.message === "No pending events") {
        fail("No pending events were picked up.");
        return;
    }

    const batchId = body.batchId;
    info(`batchId = ${batchId}`);
    info(`Response chain = ${body.chain}`);
    assert(body.chain === "MAIN", "Block routed to MAIN chain");
    assert(
        body.chainedRoot && !!body.chainedRoot.signature,
        "Main-chain block is signed"
    );

    await step("(3) Confirming the block is stored in MerkleChain...");
    const inDb = await MerkleChain.findOne({ batchId });
    assert(!!inDb, "Block persisted in MerkleChain collection");
    info(`   Show MongoDB: MerkleChain -> batchId ${batchId}`);

    await step("(4) Waiting for the worker to anchor it on-chain...");
    const anchored = await waitFor(
        "on-chain anchoring",
        async () => {
            const b = await MerkleChain.findOne({ batchId });
            return (b && b.txHash) ? b : null;
        }
    );
    assert(!!anchored, "Batch anchored on-chain (txHash present)");
    if (anchored) {
        info(`status = ${anchored.status}`);
        showTxLink(`Batch ${batchId}`, anchored.txHash);
        info("   Open this link to show the transaction on Sepolia Etherscan.");
    }

    await step("(5) Verifying the whole main chain...");
    const v = await verifyMain();
    info(`Main chain: valid=${v.body.valid}, blocks=${v.body.totalBlocks}`);
    assert(v.body.valid === true, "Main chain verifies as intact");

    await ask("Scenario 1 done. Press ENTER to continue...");
};


const scenarioIncidentClean = async () => {

    console.log("\n\n=====================================================");
    console.log(" SCENARIO 2 - INCIDENT + CLEAN DATA");
    console.log("=====================================================");
    console.log(" Expectation: block -> LOCAL chain, merged + anchored on recovery.");

    await ensureNetwork(false);

    await step("(1) Generating audit events (network down)...");
    await generateEvents(EVENTS_PER_BATCH);

    await step("(2) Creating a batch (should be staged LOCALLY)...");
    const { body } = await createBatch();

    if (body.message === "No pending events") {
        fail("No pending events were picked up.");
        return;
    }

    const batchId = body.batchId;
    const incidentId = body.incidentId;
    info(`batchId = ${batchId}`);
    info(`Response chain = ${body.chain}`);
    info(`incidentId = ${incidentId}`);
    assert(body.chain === "LOCAL", "Block routed to LOCAL chain");
    assert(!!incidentId, "Response carries an incidentId");

    await step("(3) Confirming the block is on the LOCAL chain...");
    const localBlock = await LocalChain.findOne({ batchId });
    assert(!!localBlock, "Block persisted in LocalChain collection");
    assert(
        localBlock && localBlock.incidentId === incidentId,
        "Local block scoped to this incident (epoch)"
    );
    info(`   Show MongoDB: LocalChain -> incidentId ${incidentId}`);

    await step("(4) Verifying the incident's local chain (clean)...");
    const v = await verifyLocal(incidentId);
    info(`Local chain: valid=${v.body.valid}`);
    assert(v.body.valid === true, "Clean local chain verifies as valid");

    await ensureNetwork(true);
    info("Worker will now anchor the incident and merge the local chain.");

    await step("(5) Waiting for the local chain to be merged + dropped...");
    const merged = await waitFor(
        "merge + drop",
        async () => {
            const count = await LocalChain.countDocuments({ incidentId });
            const inc = await NetworkIncident.findOne({ incidentId });
            return (count === 0 && inc && inc.localChainStatus === "MERGED")
                ? inc : null;
        }
    );
    assert(!!merged, "Local blocks dropped and incident marked MERGED");

    if (merged) {
        assert(!!merged.localChainFinalRoot, "Epoch root preserved on incident");
        info(`epoch root = ${merged.localChainFinalRoot}`);
        info(`mergedBatchIds = ${JSON.stringify(merged.mergedBatchIds)}`);
        showTxLink(`Incident recovery`, merged.recoveryTxHash);
        info(`   Show MongoDB: NetworkIncident ${incidentId} (root + mergedBatchIds)`);
    }

    await step("(6) Waiting for the merged batch to be anchored on-chain...");
    const anchored = await waitFor(
        "on-chain anchoring",
        async () => {
            const b = await MerkleChain.findOne({ batchId });
            return (b && b.txHash) ? b : null;
        }
    );
    assert(!!anchored, "Merged batch anchored on-chain (txHash present)");
    if (anchored) {
        showTxLink(`Batch ${batchId}`, anchored.txHash);
        info("   Open this link to show the anchored (formerly local) batch.");
    }

    const vm = await verifyMain();
    assert(vm.body.valid === true, "Main chain still intact after merge");

    await ask("Scenario 2 done. Press ENTER to continue...");
};


const scenarioIncidentTampered = async () => {

    console.log("\n\n=====================================================");
    console.log(" SCENARIO 3 - INCIDENT + TAMPERED DATA");
    console.log("=====================================================");
    console.log(" Expectation: tampering detected, merge refused,");
    console.log(" nothing tampered reaches the blockchain.");

    await ensureNetwork(false);

    await step("(1) Generating audit events (network down)...");
    await generateEvents(EVENTS_PER_BATCH);

    await step("(2) Creating a batch (staged LOCALLY)...");
    const { body } = await createBatch();

    if (body.message === "No pending events") {
        fail("No pending events were picked up.");
        return;
    }

    const batchId = body.batchId;
    const incidentId = body.incidentId;
    info(`batchId = ${batchId}`);
    info(`incidentId = ${incidentId}`);
    assert(body.chain === "LOCAL", "Block routed to LOCAL chain");

    await step("(3) Simulating an ATTACKER tampering with the DB...");
    const before = await LocalChain.findOne({ batchId });
    if (!before) {
        fail("Could not find local block to tamper.");
        return;
    }
    const orig = before.eventCount;
    await LocalChain.updateOne(
        { batchId },
        { $set: { eventCount: orig + 7 } }
    );
    info(`Tampered eventCount ${orig} -> ${orig + 7} on ${batchId}`);
    info(`   Show MongoDB: LocalChain -> batchId ${batchId} (eventCount changed)`);

    await step("(4) Verifying the local chain (should now FAIL)...");
    const v = await verifyLocal(incidentId);
    info(`Local chain after tamper: valid=${v.body.valid}`);
    assert(v.body.valid === false, "Tampering detected (valid=false)");
    assert(
        v.body.errors && v.body.errors.some(e => e.batchId === batchId),
        "Verify reports the offending batchId"
    );

    await ensureNetwork(true);
    info("Worker will now refuse the merge for the tampered incident.");

    await step("(5) Waiting for the incident to be flagged TAMPERED...");
    const flagged = await waitFor(
        "tamper flag",
        async () => {
            const inc = await NetworkIncident.findOne({ incidentId });
            return (inc && inc.localChainStatus === "TAMPERED") ? inc : null;
        }
    );
    assert(!!flagged, "Incident marked localChainStatus=TAMPERED");

    const after = await LocalChain.findOne({ batchId });
    assert(!!after, "Tampered local block still present (quarantined)");
    assert(
        after && after.status === "TAMPERED",
        "Tampered block flagged status=TAMPERED"
    );

    await step("(6) Confirming the tampered batch never reached the main chain...");
    const inMain = await MerkleChain.findOne({ batchId });
    assert(!inMain, "Tampered batch was NOT merged into main chain");
    info("   KEY RESULT: bad data never gets anchored on-chain.");
    info(`   Show MongoDB: LocalChain block ${batchId} = TAMPERED, absent from MerkleChain`);

    await ask("Scenario 3 done. Press ENTER to continue...");
};


const scenarioAdminRecover = async () => {

    console.log("\n\n=====================================================");
    console.log(" SCENARIO 4 - INCIDENT + TAMPERED + ADMIN RECOVER");
    console.log("=====================================================");
    console.log(" Expectation: admin inspects the tampered block, recovers");
    console.log(" it from SQLite. Subsequent blocks are auto-cascade re-chained.");
    console.log(" Worker auto-merges the recovered blocks into the main chain.");

    await ensureNetwork(false);

    // ---- (1) Create TWO batches during outage so we can see cascade ----
    await step("(1) Generating events for BATCH A (network down)...");
    await generateEvents(EVENTS_PER_BATCH);

    await step("(2) Creating BATCH A (goes to LOCAL chain)...");
    const resA = await createBatch();
    if (resA.body.message === "No pending events") {
        fail("No pending events for batch A.");
        return;
    }
    const batchIdA  = resA.body.batchId;
    const incidentId = resA.body.incidentId;
    info(`batchIdA   = ${batchIdA}`);
    info(`incidentId = ${incidentId}`);
    assert(resA.body.chain === "LOCAL", "Batch A routed to LOCAL chain");

    await step("(3) Generating events for BATCH B (still network down)...");
    await generateEvents(EVENTS_PER_BATCH);

    await step("(4) Creating BATCH B (chained after A on LOCAL chain)...");
    const resB = await createBatch();
    if (resB.body.message === "No pending events") {
        fail("No pending events for batch B.");
        return;
    }
    const batchIdB = resB.body.batchId;
    info(`batchIdB   = ${batchIdB}`);
    assert(resB.body.chain === "LOCAL", "Batch B routed to LOCAL chain");
    assert(resB.body.incidentId === incidentId, "Batch B scoped to same incident");


    // ---- (2) Tamper BATCH A only ----
    await step("(5) Simulating ATTACKER tampering BATCH A...");
    const blockA = await LocalChain.findOne({ batchId: batchIdA });
    if (!blockA) { fail("Could not find local block A."); return; }

    const origCount = blockA.eventCount;
    await LocalChain.updateOne(
        { batchId: batchIdA },
        { $set: { eventCount: origCount + 99 } }
    );
    info(`Tampered eventCount ${origCount} -> ${origCount + 99} on ${batchIdA}`);
    info("NOTE: Batch B is untouched — its chain root will break after A is tampered.");
    info("      The cascade in recoverBlock will fix B automatically.");


    // ---- (3) Confirm tamper detection ----
    await step("(6) Verifying local chain (should FAIL for batch A)...");
    const vLocal = await verifyLocal(incidentId);
    info(`Local chain valid = ${vLocal.body.valid}`);
    assert(vLocal.body.valid === false, "Tampering detected by verifyLocalChain");

    await ensureNetwork(true);
    info("Worker will close the incident and flag batch A as TAMPERED.");

    await step("(7) Waiting for batch A to be flagged TAMPERED by the worker...");
    const flagged = await waitFor(
        "TAMPERED flag on batch A",
        async () => {
            const b = await LocalChain.findOne({ batchId: batchIdA });
            return (b && b.status === "TAMPERED") ? b : null;
        }
    );
    assert(!!flagged, "Batch A flagged status=TAMPERED");


    // ---- (4) Admin lists tampered blocks ----
    await step("(8) Admin: GET /tampered — listing all TAMPERED blocks...");
    const { body: tamperedList } = await getTampered();
    info(`TAMPERED blocks found = ${tamperedList.count}`);
    assert(
        tamperedList.blocks.some(b => b.batchId === batchIdA),
        "Batch A appears in /tampered list"
    );


    // ---- (5) Admin inspects the block (dry run compare) ----
    await step("(9) Admin: GET /local/:batchId/inspect — dry run comparison...");
    const { body: inspection } = await inspectBlock(batchIdA);
    info(`stored.eventCount    = ${inspection.stored?.eventCount}`);
    info(`recomputed.eventCount = ${inspection.recomputed?.eventCount}`);
    info(`merkleRootMatch       = ${inspection.tamperAnalysis?.merkleRootMatch}`);
    info(`canRecover            = ${inspection.tamperAnalysis?.canRecover}`);
    assert(
        inspection.status === "TAMPERED",
        "Inspect confirms block status is TAMPERED"
    );
    assert(
        inspection.tamperAnalysis?.canRecover === true,
        "SQLite events are intact — recovery is possible"
    );
    assert(
        inspection.stored?.eventCount !== inspection.recomputed?.eventCount,
        "Inspect shows stored eventCount differs from SQLite recomputed"
    );
    info("   KEY: merkleRootMatch tells admin if raw events were changed.");
    info("   KEY: canRecover=true means SQLite has the original events.");


    // ---- (6) Admin recovers batch A ----
    await step("(10) Admin: POST /local/:batchId/recover — rebuilding from SQLite...");
    const { status: recoverStatus, body: recoverBody } = await recoverBlock(batchIdA);
    info(`HTTP status        = ${recoverStatus}`);
    info(`recovered          = ${recoverBody.recovered}`);
    info(`newCurrentRoot     = ${recoverBody.newCurrentRoot}`);
    info(`cascadeRechained   = ${JSON.stringify(recoverBody.cascadeRechained)}`);
    assert(recoverStatus === 200, "Recover endpoint returns 200");
    assert(recoverBody.recovered === true, "Batch A recovered successfully");
    assert(
        Array.isArray(recoverBody.cascadeRechained) &&
        recoverBody.cascadeRechained.includes(batchIdB),
        "Cascade automatically re-chained batch B after A's root changed"
    );


    // ---- (7) Confirm DB state after recovery ----
    await step("(11) Confirming DB state after recovery...");
    const recoveredA = await LocalChain.findOne({ batchId: batchIdA });
    const reChainedB = await LocalChain.findOne({ batchId: batchIdB });
    assert(
        recoveredA && recoveredA.status === "PENDING_VERIFICATION",
        "Batch A reset to PENDING_VERIFICATION"
    );
    assert(
        reChainedB && reChainedB.previousRoot === recoveredA.currentRoot,
        "Batch B previousRoot now matches recovered A's currentRoot (cascade worked)"
    );
    info(`   A.currentRoot = ${recoveredA?.currentRoot}`);
    info(`   B.previousRoot = ${reChainedB?.previousRoot}`);


    // ---- (8) Worker auto-merges ----
    await step("(12) Waiting for worker to auto-merge recovered blocks...");
    info("Worker runs every 10s and picks up PENDING_VERIFICATION blocks from CLOSED incidents.");
    const mergedA = await waitFor(
        "batch A in main chain",
        async () => {
            const b = await MerkleChain.findOne({ batchId: batchIdA });
            return (b && b.txHash) ? b : null;
        }
    );
    assert(!!mergedA, "Recovered batch A merged + anchored on-chain");
    if (mergedA) showTxLink(`Recovered batch A`, mergedA.txHash);

    const mergedB = await waitFor(
        "batch B in main chain",
        async () => {
            const b = await MerkleChain.findOne({ batchId: batchIdB });
            return (b && b.txHash) ? b : null;
        }
    );
    assert(!!mergedB, "Cascade-rechained batch B also merged + anchored on-chain");
    if (mergedB) showTxLink(`Cascade batch B`, mergedB.txHash);


    // ---- (9) Final chain integrity check ----
    await step("(13) Final main chain verification...");
    const vmFinal = await verifyMain();
    info(`Main chain: valid=${vmFinal.body.valid}, blocks=${vmFinal.body.totalBlocks}`);
    assert(vmFinal.body.valid === true, "Main chain still intact after admin recovery");

    await ask("Scenario 4 done. Press ENTER to continue...");

};



const scenarioAdminAcknowledge = async () => {

    console.log("\n\n=====================================================");
    console.log(" SCENARIO 5 - INCIDENT + TAMPERED + ADMIN ACKNOWLEDGE");
    console.log("=====================================================");
    console.log(" Expectation: admin acknowledges the tampered block.");
    console.log(" Block stays as ACKNOWLEDGED forensic record — never anchored.");
    console.log(" Main chain remains valid.");

    await ensureNetwork(false);

    await step("(1) Generating audit events (network down)...");
    await generateEvents(EVENTS_PER_BATCH);

    await step("(2) Creating a batch (LOCAL chain)...");
    const { body } = await createBatch();
    if (body.message === "No pending events") {
        fail("No pending events.");
        return;
    }
    const batchId   = body.batchId;
    const incidentId = body.incidentId;
    info(`batchId    = ${batchId}`);
    info(`incidentId = ${incidentId}`);
    assert(body.chain === "LOCAL", "Block routed to LOCAL chain");


    await step("(3) Simulating ATTACKER tampering the block...");
    const block = await LocalChain.findOne({ batchId });
    if (!block) { fail("Could not find local block."); return; }
    const orig = block.eventCount;
    await LocalChain.updateOne(
        { batchId },
        { $set: { eventCount: orig + 99 } }
    );
    info(`Tampered eventCount ${orig} -> ${orig + 99}`);

    await ensureNetwork(true);
    info("Worker will close the incident and flag the block TAMPERED.");

    await step("(4) Waiting for block to be flagged TAMPERED...");
    const flagged = await waitFor(
        "TAMPERED flag",
        async () => {
            const b = await LocalChain.findOne({ batchId });
            return (b && b.status === "TAMPERED") ? b : null;
        }
    );
    assert(!!flagged, "Block flagged status=TAMPERED by worker");


    await step("(5) Admin: GET /tampered — confirms block is listed...");
    const { body: tamperedList } = await getTampered();
    assert(
        tamperedList.blocks.some(b => b.batchId === batchId),
        "Block appears in /tampered list"
    );


    await step("(6) Admin: POST /local/:batchId/acknowledge — accepting tampered state...");
    const { status: ackStatus, body: ackBody } = await acknowledgeBlock(batchId);
    info(`HTTP status  = ${ackStatus}`);
    info(`acknowledged = ${ackBody.acknowledged}`);
    info(`status       = ${ackBody.status}`);
    assert(ackStatus === 200, "Acknowledge endpoint returns 200");
    assert(ackBody.acknowledged === true, "Block acknowledged successfully");
    assert(ackBody.status === "ACKNOWLEDGED", "Block status set to ACKNOWLEDGED");


    await step("(7) Confirming ACKNOWLEDGED block is never merged...");
    // Wait 2 full worker cycles and confirm block did NOT reach MerkleChain
    await sleep(25000);
    const inMain = await MerkleChain.findOne({ batchId });
    assert(!inMain, "ACKNOWLEDGED block NOT present in main chain");

    const ackBlock = await LocalChain.findOne({ batchId });
    assert(
        ackBlock && ackBlock.status === "ACKNOWLEDGED",
        "Block retained as ACKNOWLEDGED forensic record in LocalChain"
    );
    info("   KEY: Block is preserved in LocalChain as a forensic record.");
    info("   KEY: It will never be anchored on-chain.");


    await step("(8) Final main chain verification...");
    const vmFinal = await verifyMain();
    info(`Main chain: valid=${vmFinal.body.valid}, blocks=${vmFinal.body.totalBlocks}`);
    assert(vmFinal.body.valid === true, "Main chain intact — acknowledged block had no effect");

    await ask("Scenario 5 done. Press ENTER to continue...");

};


const scenarioFullAAA = async () => {

    console.log("\n\n=====================================================");
    console.log(" SCENARIO 6 - FULL AAA FLOW");
    console.log("=====================================================");
    console.log(" Register DIDs → approve → issue VC permit →");
    console.log(" authorized action (audit event → batch → anchored) →");
    console.log(" denied actions (wrong action, unknown machine) →");
    console.log(" verify denied log in SQLite.");

    await ensureNetwork(true);

    // ---- (1) Register identities ----
    await step("(1) Registering admin, operator, and machine DIDs...");

    const ts = Date.now();
    const adminAlias    = `e2e-admin-${ts}`;
    const operatorAlias = `e2e-operator-${ts}`;
    const machineAlias  = `e2e-machine-${ts}`;

    const adminReg = await registerIdentity({ alias: adminAlias, type: "operator" });
    info(`admin DID    = ${adminReg.did}`);
    assert(!!adminReg.did, "Admin DID created");

    const opReg = await registerIdentity({ alias: operatorAlias, type: "operator" });
    info(`operator DID = ${opReg.did}`);
    assert(!!opReg.did, "Operator DID created");

    const machReg = await registerIdentity({
        alias: machineAlias,
        type: "machine",
        allowedActions: ["WELD", "CUT"]
    });
    info(`machine DID  = ${machReg.did}`);
    assert(!!machReg.did, "Machine DID created");

    const adminDid    = adminReg.did;
    const operatorDid = opReg.did;
    const machineDid  = machReg.did;


    // ---- (2) Approve operator and machine ----
    await step("(2) Admin approves operator and machine identities...");

    const approveOp   = await approveIdentity(operatorDid);
    const approveMach = await approveIdentity(machineDid);
    assert(approveOp.success === true, "Operator identity approved (ACTIVE)");
    assert(approveMach.success === true, "Machine identity approved (ACTIVE)");
    info("   Show MongoDB: IdentityStore -> operators + machines arrays");


    // ---- (3) Issue VC permit ----
    await step("(3) Admin issues VC permit: operator can WELD on this machine...");

    const permitRes = await issuePerm({
        issuerDid:  adminDid,
        holderDid:  operatorDid,
        machineDid: machineDid,
        actions:    ["WELD", "CUT"]
    });
    assert(permitRes.success === true, "Permit issued successfully");
    assert(!!permitRes.credential, "Permit response contains a credential");
    const credential = permitRes.credential;
    info(`VC proof format: ${credential?.proof?.type || "jwt"}`);
    info("   This JWT credential is what the operator carries to every action.");


    // ---- (4) Authorized action ----
    await step("(4) Operator performs an authorized action: WELD...");

    const authRes = await performAction({
        credential,
        operatorDid,
        machineDid,
        action: "WELD"
    });
    info(`HTTP status  = ${authRes.status}`);
    info(`authorized   = ${authRes.body.authorized}`);
    info(`auditEventId = ${authRes.body.auditEventId}`);
    info(`timestamp    = ${authRes.body.timestamp}`);
    assert(authRes.status === 200, "Perform action returns 200");
    assert(authRes.body.authorized === true, "Action authorized");
    assert(
        typeof authRes.body.auditEventId === "number",
        "Audit event ID returned (event written to SQLite)"
    );
    info("   KEY: authorized action creates an audit event in SQLite,");
    info("   which the batch worker will include in the next Merkle block.");


    // ---- (5) Batch the event then wait for worker to anchor ----
    await step("(5) Batching the audit event, then waiting for worker to anchor...");
    info("createBatch groups PENDING SQLite events into a signed Merkle block.");
    info("Worker then picks up the block and sends it to Sepolia.");

    const batchRes = await createBatch();
    info(`Batch chain  = ${batchRes.body.chain}`);
    info(`Batch id     = ${batchRes.body.batchId}`);
    assert(batchRes.body.chain === "MAIN", "Batch routed to MAIN chain");
    assert(!!batchRes.body.batchId, "Batch created with an ID");

    const aaBatchId = batchRes.body.batchId;
    const anchored = await waitFor(
        "on-chain anchoring",
        async () => {
            const b = await MerkleChain.findOne({ batchId: aaBatchId });
            return (b && b.txHash) ? b : null;
        }
    );
    if (anchored) {
        assert(true, "Audit event batched and anchored on Sepolia");
        showTxLink("AAA audit batch", anchored.txHash);
    } else {
        assert(false, "Audit event batched and anchored on Sepolia (timed out)");
    }


    // ---- (6) Denied: wrong action (not in VC) ----
    await step("(6) Operator tries a DENIED action: MOVE_UP (not in their permit)...");

    const deniedBefore = await getDenied();
    const deniedCountBefore = deniedBefore.count;

    const denyAction = await performAction({
        credential,
        operatorDid,
        machineDid,
        action: "MOVE_UP"
    });
    info(`authorized = ${denyAction.body.authorized}`);
    info(`reason     = ${denyAction.body.reason}`);
    assert(denyAction.body.authorized === false, "MOVE_UP correctly denied");
    assert(
        denyAction.body.reason === "Action not permitted",
        "Deny reason: Action not permitted"
    );
    assert(denyAction.body.auditEventId === null, "No audit event created for denied action");


    // ---- (7) Denied: unregistered machine ----
    await step("(7) Operator tries action on an UNREGISTERED machine...");

    const fakeMachine = "did:ethr:sepolia:0x0000000000000000000000000000000000000000";
    const denyMachine = await performAction({
        credential,
        operatorDid,
        machineDid: fakeMachine,
        action: "WELD"
    });
    info(`authorized = ${denyMachine.body.authorized}`);
    info(`reason     = ${denyMachine.body.reason}`);
    assert(denyMachine.body.authorized === false, "Unregistered machine correctly denied");
    assert(
        denyMachine.body.reason.includes("Machine DID"),
        "Deny reason mentions machine DID"
    );


    // ---- (8) Check denied log ----
    await step("(8) Verifying both denials are logged in SQLite denied_events...");

    const deniedAfter = await getDenied();
    info(`Total denied events in log = ${deniedAfter.count}`);
    assert(
        deniedAfter.count >= deniedCountBefore + 2,
        "Both denied attempts recorded in denied_events table"
    );
    const last2 = deniedAfter.denied.slice(0, 2);
    info(`Latest denied: action=${last2[0]?.action}, reason=${last2[0]?.reason}`);
    info(`               action=${last2[1]?.action}, reason=${last2[1]?.reason}`);
    info("   KEY: failed access attempts are in SQLite, not the blockchain.");
    info("   KEY: successful actions are the only ones anchored on-chain.");

    await ask("Scenario 6 done. Press ENTER to continue...");
};


// ---- runner --------------------------------------------------------

const main = async () => {

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.\n");

    console.log("DEMO test - generates events, detects real network state,");
    console.log("waits for the worker, and prints Sepolia Etherscan links.");
    console.log(`Target server: ${BASE_URL}`);

    console.log("  [1] normal            — network up, main chain");
    console.log("  [2] incident-clean    — outage, clean merge");
    console.log("  [3] incident-tampered — outage, tamper detected, merge refused");
    console.log("  [4] admin-recover     — tamper + admin recovers from SQLite + cascade");
    console.log("  [5] admin-acknowledge — tamper + admin acknowledges (forensic only)");
    console.log("  [6] full-aaa          — DID register + approve + VC permit + action + denied log");
    console.log("  [a] all               — run all scenarios in order");

    const which = await ask("Run which? [a/1/2/3/4/5/6]:");

    try {
        if (which === "1") await scenarioNormal();
        else if (which === "2") await scenarioIncidentClean();
        else if (which === "3") await scenarioIncidentTampered();
        else if (which === "4") await scenarioAdminRecover();
        else if (which === "5") await scenarioAdminAcknowledge();
        else if (which === "6") await scenarioFullAAA();
        else {
            await scenarioNormal();
            await scenarioIncidentClean();
            await scenarioIncidentTampered();
            await scenarioAdminRecover();
            await scenarioAdminAcknowledge();
            await scenarioFullAAA();
        }
    } catch (err) {
        console.error("\nTest run error:", err.message);
    }

    console.log("\n=====================================================");
    console.log(` RESULTS: ${passed} passed, ${failedCount} failed`);
    console.log("=====================================================\n");

    await mongoose.disconnect();
    rl.close();
    process.exit(failedCount === 0 ? 0 : 1);
};

main();
