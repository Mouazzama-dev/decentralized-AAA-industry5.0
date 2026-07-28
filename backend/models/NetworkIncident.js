import mongoose from "mongoose";


const networkIncidentSchema = new mongoose.Schema({

    incidentId:{
        type:String,
        required:true,
        unique:true
    },


    type:{
        type:String,
        default:"NETWORK_FAILURE"
    },


    component:{
        type:String,
        default:"BLOCKCHAIN_SYNC_WORKER"
    },


    reason:String,


    startedAt:{
        type:Date,
        default:Date.now
    },


    resolvedAt:{
        type:Date,
        default:null
    },


    duration:{
        type:Number,
        default:null
    },


    status:{
        type:String,
        default:"OPEN"
    }


});


export default mongoose.model(
    "NetworkIncident",
    networkIncidentSchema
);