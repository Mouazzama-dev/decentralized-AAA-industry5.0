import MerkleChain from "../models/MerkleChain.js";

import {
    sendMerkleRoot
} from "../blockchain/blockchain.service.js";

import {
    createNetworkIncident,
    resolveNetworkIncident
} from "../services/networkIncident.service.js";


const startSyncWorker = ()=>{


setInterval(async()=>{

    let pending = null;


    try {


        pending =
        await MerkleChain.findOneAndUpdate(

            {
                status:{
                    $in:[
                        "PENDING",
                        "WAITING_RETRY"
                    ]
                }
            },

            {
                status:"PROCESSING",
                lockedAt:new Date()
            },

            {
                new:true,
                sort:{
                    createdAt:1
                }
            }

        );



        if(!pending){

            return;

        }



        const result =
        await sendMerkleRoot({

            currentRoot:
            pending.currentRoot,

            previousRoot:
            pending.previousRoot

        });



        pending.status =
        "CONFIRMED";


        pending.lockedAt=null;


        pending.txHash =
        result.txHash;


        pending.blockNumber =
        result.blockNumber;


        await pending.save();



        // close network incident after recovery
        await resolveNetworkIncident();



        console.log(
            "Root logged successfully:",
            result.txHash
        );



    }
    catch(error){


        console.error(
            "Sync failed:",
            error.message
        );



        await createNetworkIncident(
            "RPC_CONNECTION_FAILED"
        );



        if(pending){


            pending.status =
            "WAITING_RETRY";


            pending.retryCount += 1;


            pending.lockedAt=null;


            await pending.save();


        }


    }


},10000);


};



export {
    startSyncWorker
};