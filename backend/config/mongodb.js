import mongoose from "mongoose";
import { MONGO_URI } from "./env.js";


const connectMongoDB = async () => {
    try {

        await mongoose.connect(MONGO_URI);

        console.log("🍃 MongoDB Connected Successfully");

    } catch (error) {

        console.error(
            "❌ MongoDB Connection Error:",
            error.message
        );

        process.exit(1);
    }
};


export default connectMongoDB;