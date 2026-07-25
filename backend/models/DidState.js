import mongoose from "mongoose";


const DidStateSchema = new mongoose.Schema({

    key: {
        type: String,
        default: "main_state",
        unique: true
    },

    activeDids: {
        type: Array,
        default: []
    },

    inactiveDids: {
        type: Array,
        default: []
    }

}, {
    timestamps: true
});


const DidStateModel = mongoose.model(
    "DidState",
    DidStateSchema
);


export default DidStateModel;