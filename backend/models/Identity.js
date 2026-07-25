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
    }

}, {
    timestamps: true
});


const IdentityModel = mongoose.model(
    "IdentityStore",
    IdentitySchema
);


export default IdentityModel;