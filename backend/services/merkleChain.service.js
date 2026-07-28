import crypto from "crypto";

import MerkleChain from "../models/MerkleChain.js";



const createChainedRoot = async(

    merkleRoot,

    eventCount,

    batchId

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

        "0x0000000000000000000000000000000000000000000000000000000000000000";




    const chainedRoot =

        crypto
        .createHash("sha256")
        .update(

            previousRoot +
            merkleRoot

        )
        .digest("hex");




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