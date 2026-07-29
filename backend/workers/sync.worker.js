import MerkleChain from "../models/MerkleChain.js";

import {
    sendMerkleRoot
} from "../blockchain/blockchain.service.js";

import {
    createNetworkIncident,
    resolveNetworkIncident
} from "../services/networkIncident.service.js";


let workerRunning = false;


const startSyncWorker = () => {

    setInterval(async () => {

        /*
         * Prevent overlapping worker cycles.
         */
        if (workerRunning) {
            return;
        }

        workerRunning = true;

        let pending = null;

        try {

            /*
             * First anchor and resolve any existing
             * OPEN network incident.
             *
             * Transaction order:
             * 1. NETWORK_FAILURE
             * 2. NETWORK_RECOVERY
             */
            const resolvedIncident =
                await resolveNetworkIncident();

            if (resolvedIncident) {

                console.log(
                    "✅ Network incident anchored:",
                    resolvedIncident.incidentId
                );

                console.log(
                    "✅ Downtime:",
                    resolvedIncident.duration,
                    "seconds"
                );
            }


            /*
             * Only after the incident is resolved,
             * process the pending Merkle root.
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
                        status: "PROCESSING",
                        lockedAt: new Date()
                    },
                    {
                        new: true,
                        sort: {
                            createdAt: 1
                        }
                    }
                );


            if (!pending) {
                return;
            }


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
                error.shortMessage ||
                error.reason ||
                error.message ||
                "UNKNOWN_BLOCKCHAIN_ERROR";


            console.error(
                "❌ Blockchain sync failed:",
                errorMessage
            );


            /*
             * Create or reuse one active incident
             * while blockchain RPC is unavailable.
             */
            try {

                const incident =
                    await createNetworkIncident(
                        "RPC_CONNECTION_FAILED"
                    );

                if (incident) {

                    console.log(
                        "⚠️ Network incident active:",
                        incident.incidentId
                    );
                }

            } catch (incidentError) {

                console.error(
                    "❌ Incident creation failed:",
                    incidentError.message
                );
            }


            /*
             * Return the selected Merkle root
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