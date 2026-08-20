import express from "express";

import {
    createBatch
} from "../services/batch.service.js";


import {
    generateMerkleRoot
} from "../services/merkle.service.js";


import {
    createChainedRoot,
    verifyChain
} from "../services/merkleChain.service.js";


import {
    createLocalChainedRoot,
    verifyLocalChain
} from "../services/localChain.service.js";


import {
    createNetworkIncident
} from "../services/networkIncident.service.js";


import {
    provider
} from "../blockchain/contract.config.js";


import NetworkIncident from "../models/NetworkIncident.js";


const router = express.Router();



/*
 * Live network check.
 *
 * We do NOT rely only on an existing OPEN incident in the DB,
 * because the worker detects outages on a 10s cycle and a batch
 * can be created in the gap before the incident is registered.
 * Instead we ping the RPC directly at block-creation time.
 *
 * Returns true if the RPC is reachable, false otherwise.
 */
const isNetworkUp = async () => {

    try {

        await provider.getBlockNumber();

        return true;

    } catch (error) {

        return false;

    }

};



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



        /*
         * Decide where the block goes based on the LIVE network
         * state, not just the DB incident flag.
         */
        const networkUp =
            await isNetworkUp();


        if(!networkUp){

            /*
             * Network is down. Make sure an incident exists so the
             * local block can reference it, then stage the block on
             * the LOCAL chain.
             */
            let openIncident =
                await NetworkIncident.findOne({
                    status: "OPEN"
                });

            if(!openIncident){

                openIncident =
                    await createNetworkIncident(
                        "RPC_CONNECTION_FAILED"
                    );

            }


            const incidentId =
                openIncident
                ? openIncident.incidentId
                : null;


            const localBlock =
                await createLocalChainedRoot({
                    merkleRoot: root,
                    eventCount: batch.events.length,
                    batchId: batch.batchId,
                    incidentId
                });

            return res.json({

                chain: "LOCAL",

                note:
                "Network down — block staged on local chain, " +
                "will be verified and merged on recovery.",

                incidentId,

                batchId:
                batch.batchId,

                merkleRoot:
                root,

                localBlock

            });

        }



        /*
         * Network is up — normal path, block goes to the main chain.
         */
        const chained =
            await createChainedRoot(

                root,

                batch.events.length,

                batch.batchId

            );



        res.json({

            chain: "MAIN",

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



/*
 * Verifies the integrity of the main chain.
 */
router.get("/verify", async(req,res)=>{

    try{

        const result =
            await verifyChain();

        res
            .status(result.valid ? 200 : 409)
            .json(result);

    }catch(error){

        console.error(error);

        res.status(500).json({

            error:
            error.message

        });

    }

});



/*
 * Verifies the integrity of a single incident's local chain.
 * Pass ?incidentId=INC_xxx to choose which incident to verify.
 */
router.get("/verify-local", async(req,res)=>{

    try{

        const { incidentId } = req.query;

        if(!incidentId){

            return res.status(400).json({

                error:
                "incidentId query parameter is required, " +
                "e.g. /verify-local?incidentId=INC_123"

            });

        }

        const result =
            await verifyLocalChain(incidentId);

        res
            .status(result.valid ? 200 : 409)
            .json(result);

    }catch(error){

        console.error(error);

        res.status(500).json({

            error:
            error.message

        });

    }

});



/*
 * Reports the live network (RPC) state and current chain counts.
 * Used by tests/demos to detect the real network state instead of
 * assuming it.
 */
router.get("/network-status", async(req,res)=>{

    let networkUp = false;

    try{

        await provider.getBlockNumber();
        networkUp = true;

    }catch(error){

        networkUp = false;

    }

    res.json({

        networkUp,

        rpcState:
        networkUp ? "UP" : "DOWN"

    });

});



export default router;