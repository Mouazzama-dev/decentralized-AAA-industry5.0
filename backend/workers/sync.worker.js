import MerkleChain from "../models/MerkleChain.js";

import {
    sendMerkleRoot
} from "../blockchain/blockchain.service.js";



const startSyncWorker = ()=>{


setInterval(async()=>{


    try {


        const pending =
await MerkleChain.findOneAndUpdate(

    {
        status:"PENDING"
    },

    {
        status:"PROCESSING",
        lockedAt:new Date()
    },

    {
        new:true
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



        console.log(
          "✅ Root synced"
        );


    }
    catch(error){

    console.error(
        "Sync failed:",
        error.message
    );


    if(pending){

        pending.status="FAILED";

        pending.retryCount += 1;

        await pending.save();

    }

}


},10000);


};



export {
    startSyncWorker
};