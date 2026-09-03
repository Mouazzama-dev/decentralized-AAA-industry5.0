import mongoose from "mongoose";


/*
 * LocalChain
 * ----------
 * Staging / quarantine chain used ONLY during a network incident.
 *
 * While the RPC is down, new blocks are chained here instead of the
 * main MerkleChain. This isolates the main chain from any data that
 * has not yet been verified.
 *
 * On network recovery this chain is verified. If valid, its blocks
 * are re-chained + re-signed onto the main chain and anchored. If a
 * block is tampered, nothing is merged and the offending batchId is
 * reported.
 */
const LocalChainSchema = new mongoose.Schema({

    batchId:{
        type:String,
        unique:true
    },

    // The network incident this block belongs to (traceability).
    incidentId:{
        type:String,
        default:null
    },

    previousRoot:{
        type:String,
        default:null
    },

    currentRoot:{
        type:String,
        required:true
    },

    // Gateway signature — guarantees authenticity of the block.
    signature:{
        type:String,
        default:null
    },

    // Gateway public key (PEM) — used to verify the signature.
    publicKey:{
        type:String,
        default:null
    },

    eventCount:{
        type:Number,
        default:0
    },

    // The original Merkle root of the batch. Kept because the merge
    // step needs it to re-chain the block onto the main chain.
    merkleRoot:{
        type:String,
        default:null
    },

    status:{
        type:String,
        enum:[
            "PENDING_VERIFICATION",
            "VERIFIED",
            "TAMPERED",
            "MERGED",
            // Admin reviewed, chose not to recover — kept as forensic record.
            "DISCARDED",
            // Admin explicitly acknowledged the tampering and accepted it.
            "ACKNOWLEDGED"
        ],
        default:"PENDING_VERIFICATION"
    }

},{
    timestamps:true
});


const LocalChain =
mongoose.model(
    "LocalChain",
    LocalChainSchema
);


export default LocalChain;