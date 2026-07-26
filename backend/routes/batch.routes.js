import express from "express";

import {
    createBatch
} from "../services/batch.service.js";

import {
    generateMerkleRoot
} from "../services/merkle.service.js";

import {
    createChainedRoot   
} from "../services/merkleChain.service.js";


const router = express.Router();


router.get("/create", async(req,res)=>{


    const batch =
        await createBatch(10);



    if(!batch){

        return res.json({
            message:"No pending events"
        });

    }



    const root =
        generateMerkleRoot(batch);

    const chained =
await createChainedRoot(
    root,
    batch.length
);



res.json({

 batch,

 merkleRoot:root,

 chainedRoot:chained

});


});


export default router;