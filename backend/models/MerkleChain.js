import mongoose from "mongoose";


const MerkleChainSchema = new mongoose.Schema({

    batchId:{
        type:String,
        unique:true
    },

    previousRoot:{
        type:String,
        default:null
    },

    currentRoot:{
        type:String,
        required:true
    },

    eventCount:{
        type:Number,
        default:0
    },

    status:{
    type:String,
    enum:[
        "PENDING",
        "PROCESSING",
        "CONFIRMED",
        "WAITING_RETRY",
        "FAILED"
    ],
    default:"PENDING"
},

retryCount:{
    type:Number,
    default:0
},

lockedAt:{
    type:Date
},

    txHash:{
        type:String,
        default:null
    },

    blockNumber:{
        type:Number,
        default:null
    }

},{
    timestamps:true
});


const MerkleChain =
mongoose.model(
    "MerkleChain",
    MerkleChainSchema
);


export default MerkleChain;