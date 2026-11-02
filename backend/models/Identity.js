import mongoose from "mongoose";


const IdentitySchema = new mongoose.Schema({

    key: {
        type: String,
        default: "main_store",
        unique: true
    },

    operators: {
        type: Array,
        default: []
    },

    machines: {
        type: Array,
        default: []
    },

    pending: {
        type: Array,
        default: []
    },

    // C2: trusted VC issuers for this gateway
    // Each entry: { did, role, addedAt }
    // Roles: "localAdmin" | "platformRoot" | "factoryDid"
    trustedIssuers: {
        type: Array,
        default: []
    },

    // C4: cached DID documents for offline VC verification when RPC is unreachable
    // Each entry: { did, document (Mixed), cachedAt }
    cachedDIDDocuments: {
        type: Array,
        default: []
    }

}, {
    timestamps: true
});


const IdentityModel = mongoose.model(
    "IdentityStore",
    IdentitySchema
);


export default IdentityModel;