import mongoose from "mongoose";


const networkIncidentSchema = new mongoose.Schema(
    {
        incidentId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        type: {
            type: String,
            default: "NETWORK_FAILURE"
        },

        component: {
            type: String,
            default: "BLOCKCHAIN_SYNC_WORKER"
        },

        reason: {
            type: String,
            required: true
        },

        startedAt: {
            type: Date,
            default: Date.now
        },

        resolvedAt: {
            type: Date,
            default: null
        },

        duration: {
            type: Number,
            default: null
        },

        status: {
            type: String,
            enum: [
                "OPEN",
                "CLOSED"
            ],
            default: "OPEN"
        },

        /*
         * Blockchain synchronization status
         */
        blockchainStatus: {
            type: String,
            enum: [
                "WAITING",
                "WAITING_RETRY",
                "CONFIRMED"
            ],
            default: "WAITING"
        },

        /*
         * NETWORK_FAILURE blockchain transaction
         */
        failureTxHash: {
            type: String,
            default: null
        },

        failureBlockNumber: {
            type: Number,
            default: null
        },

        /*
         * NETWORK_RECOVERY blockchain transaction
         */
        recoveryTxHash: {
            type: String,
            default: null
        },

        recoveryBlockNumber: {
            type: Number,
            default: null
        },

        /*
         * Last blockchain/RPC error for retry debugging
         */
        lastBlockchainError: {
            type: String,
            default: null
        },

        /*
         * Epoch root of this incident's local chain.
         *
         * When the network recovers, the local chain for this
         * incident is verified and merged into the main chain, then
         * its blocks are dropped. This field preserves the final
         * root of that local chain as a permanent cryptographic
         * marker of the epoch (see epoch-based secure logging: keep
         * the root, discard the tree).
         */
        localChainFinalRoot: {
            type: String,
            default: null
        },

        /*
         * The batch IDs that were merged from this incident's local
         * chain into the main chain (traceability).
         */
        mergedBatchIds: {
            type: [String],
            default: []
        },

        /*
         * Local-chain merge outcome for this incident.
         *   NONE      - no local blocks were created
         *   MERGED    - local chain verified and merged
         *   TAMPERED  - tampering detected, merge refused
         */
        localChainStatus: {
            type: String,
            enum: [
                "NONE",
                "MERGED",
                "TAMPERED"
            ],
            default: "NONE"
        }
    },
    {
        timestamps: true
    }
);


export default mongoose.model(
    "NetworkIncident",
    networkIncidentSchema
);