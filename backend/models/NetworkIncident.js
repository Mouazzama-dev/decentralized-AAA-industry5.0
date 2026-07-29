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