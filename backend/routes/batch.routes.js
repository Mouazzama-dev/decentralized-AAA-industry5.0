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

    try{


        const batch =
            await createBatch(10);



        if(!batch){

            return res.json({

                message:
                "No pending events"

            });

        }



        const root =
            generateMerkleRoot(
                batch.events
            );



        const chained =
            await createChainedRoot(

                root,

                batch.events.length,

                batch.batchId

            );



        res.json({

            batchId:
            batch.batchId,


            batch:
            batch.events,


            merkleRoot:
            root,


            chainedRoot:
            chained

        });



    }catch(error){

        console.error(error);


        res.status(500).json({

            error:
            error.message

        });

    }


});


export default router;