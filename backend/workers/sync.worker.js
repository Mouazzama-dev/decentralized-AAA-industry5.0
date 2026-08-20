import MerkleChain from "../models/MerkleChain.js";
import NetworkIncident from "../models/NetworkIncident.js";

import {
    sendMerkleRoot
} from "../blockchain/blockchain.service.js";

import {
    provider
} from "../blockchain/contract.config.js";

import {
    createNetworkIncident,
    resolveNetworkIncident
} from "../services/networkIncident.service.js";

import {
    mergeAllPendingLocalChains
} from "../services/localChain.service.js";


let workerRunning = false;


const getErrorMessage = (error) => {

    return (
        error?.shortMessage ||
        error?.reason ||
        error?.cause?.message ||
        error?.message ||
        "UNKNOWN_BLOCKCHAIN_ERROR"
    );

};


const markBatchForRetry = async (errorMessage) => {

    const batch =
        await MerkleChain.findOneAndUpdate(
            {
                status: {
                    $in: [
                        "PENDING",
                        "WAITING_RETRY"
                    ]
                }
            },
            {
                $set: {
                    status: "WAITING_RETRY",
                    lockedAt: null,
                    lastError: errorMessage
                },

                $inc: {
                    retryCount: 1
                }
            },
            {
                returnDocument: "after",

                sort: {
                    createdAt: 1
                }
            }
        );


    if (batch) {

        console.log(
            "🔄 Root waiting for retry:",
            batch._id
        );

        console.log(
            "🔢 Retry count:",
            batch.retryCount
        );

        console.log(
            "⏳ Next retry in 10 seconds"
        );

    }

};


const startSyncWorker = () => {

    setInterval(async () => {

        if (workerRunning) {
            return;
        }

        workerRunning = true;

        let pending = null;

        try {

            /*
             * Step 1:
             * Check RPC availability before attempting
             * incident recovery or Merkle synchronization.
             */
            try {

                const blockNumber =
                    await provider.getBlockNumber();

                // console.log(
                //     "🌐 RPC available at block:",
                //     blockNumber
                // );

            } catch (rpcError) {

                const rpcErrorMessage =
                    getErrorMessage(rpcError);


                console.error(
                    "❌ RPC unavailable:",
                    rpcErrorMessage
                );


                /*
                 * Reuse the existing OPEN incident.
                 * Create a new one only when none exists.
                 */
                let incident =
                    await NetworkIncident.findOne({
                        status: "OPEN"
                    });


                if (!incident) {

                    incident =
                        await createNetworkIncident(
                            "RPC_CONNECTION_FAILED"
                        );

                    if (incident) {

                        console.log(
                            "⚠️ Network incident created:",
                            incident.incidentId
                        );

                    }

                } else {

                    console.log(
                        "⚠️ Existing incident remains OPEN:",
                        incident.incidentId
                    );

                }


                /*
                 * Keep the oldest root in the retry queue.
                 */
                await markBatchForRetry(
                    rpcErrorMessage
                );

                return;
            }


            /*
             * Step 2:
             * RPC is available again.
             * Anchor failure and recovery before syncing roots.
             */
            const openIncident =
                await NetworkIncident.findOne({
                    status: "OPEN"
                });


            if (openIncident) {

                console.log(
                    "🌐 Network restored. Anchoring incident:",
                    openIncident.incidentId
                );


                const resolvedIncident =
                    await resolveNetworkIncident();


                if (!resolvedIncident) {

                    throw new Error(
                        "NETWORK_INCIDENT_NOT_RESOLVED"
                    );

                }


                console.log(
                    "✅ Network incident anchored:",
                    resolvedIncident.incidentId
                );

                console.log(
                    "✅ Downtime:",
                    resolvedIncident.duration,
                    "seconds"
                );


                /*
                 * After the incident is anchored, merge every
                 * pending local (quarantine) chain into the main
                 * chain — one independent chain per incident.
                 *
                 * - Clean incident chains -> re-chained, re-signed,
                 *   inserted into the main chain as PENDING, their
                 *   epoch root saved on the incident, and their
                 *   local blocks dropped.
                 * - Any tampered incident chain -> merge refused for
                 *   that incident, offending batch reported, and
                 *   anchoring halted this cycle. Retries next cycle.
                 */
                const mergeSummary =
                    await mergeAllPendingLocalChains();

                for (const r of mergeSummary.results) {

                    if (r.merged && r.mergedCount > 0) {

                        console.log(
                            "✅ Local chain merged for incident",
                            r.incidentId,
                            "— blocks merged:",
                            r.mergedCount
                        );

                    }

                    if (!r.merged) {

                        console.error(
                            "🚨 LOCAL CHAIN TAMPERING DETECTED — merge refused for incident",
                            r.incidentId
                        );

                        console.error(
                            "🚨 Offending batches:",
                            r.errors
                                .map(e => `${e.batchId} (${e.type})`)
                                .join(", ")
                        );

                    }

                }

                if (mergeSummary.anyTampered) {

                    console.error(
                        "⛔ Anchoring halted this cycle until tampered local chain(s) are resolved."
                    );

                    // Do not anchor anything this cycle.
                    return;

                }

            }


            /*
             * Step 3:
             * Process the oldest Merkle root only after
             * the network incident has been resolved.
             */
            pending =
                await MerkleChain.findOneAndUpdate(
                    {
                        status: {
                            $in: [
                                "PENDING",
                                "WAITING_RETRY"
                            ]
                        }
                    },
                    {
                        $set: {
                            status: "PROCESSING",
                            lockedAt: new Date()
                        }
                    },
                    {
                        returnDocument: "after",

                        sort: {
                            createdAt: 1
                        }
                    }
                );


            if (!pending) {
                return;
            }


            console.log(
                "📤 Syncing Merkle root:",
                pending._id
            );


            const result =
                await sendMerkleRoot({
                    currentRoot:
                        pending.currentRoot,

                    previousRoot:
                        pending.previousRoot
                });


            pending.status =
                "CONFIRMED";

            pending.lockedAt =
                null;

            pending.txHash =
                result.txHash;

            pending.blockNumber =
                result.blockNumber;

            pending.lastError =
                null;

            await pending.save();


            console.log(
                "✅ Root logged successfully:",
                result.txHash
            );

        } catch (error) {

            const errorMessage =
                getErrorMessage(error);


            console.error(
                "❌ Blockchain operation failed:",
                errorMessage
            );


            /*
             * Return only the selected Merkle batch
             * to the retry queue.
             */
            if (pending) {

                pending.status =
                    "WAITING_RETRY";

                pending.lockedAt =
                    null;

                pending.retryCount =
                    (pending.retryCount || 0) + 1;

                pending.lastError =
                    errorMessage;

                try {

                    await pending.save();

                    console.log(
                        "🔄 Root waiting for retry:",
                        pending._id
                    );

                    console.log(
                        "🔢 Retry count:",
                        pending.retryCount
                    );

                } catch (saveError) {

                    console.error(
                        "❌ Retry status save failed:",
                        saveError.message
                    );

                }

            }

        } finally {

            workerRunning = false;
        }

    }, 10000);

};


export {
    startSyncWorker
};