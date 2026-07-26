import crypto from "crypto";
import MerkleChain from "../models/MerkleChain.js";


const createChainedRoot = async(
    merkleRoot,
    eventCount
)=>{


    const lastRoot =
        await MerkleChain
        .findOne()
        .sort({
            createdAt:-1
        });



    const previousRoot =
        lastRoot
        ?
        lastRoot.currentRoot
        :
        "GENESIS";



    const chainedRoot =
        crypto
        .createHash("sha256")
        .update(
            previousRoot +
            merkleRoot
        )
        .digest("hex");



    const batchId =
        "batch_" +
        Date.now();



    const record =
        await MerkleChain.create({

            batchId,

            previousRoot,

            currentRoot:
            chainedRoot,

            eventCount

        });



    return record;

};



export {
    createChainedRoot
};