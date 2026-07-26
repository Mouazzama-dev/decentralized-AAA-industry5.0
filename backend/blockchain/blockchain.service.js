import {
    contract
} from "./contract.config.js";

import {
    getNextNonce
} from "./nonce.service.js";



const sendMerkleRoot = async({

    currentRoot,

    previousRoot

})=>{


    const nonce =
        await getNextNonce();



    const tx =
    await contract.logRoot(

        currentRoot.startsWith("0x")
        ? currentRoot
        : "0x"+currentRoot,


        previousRoot.startsWith("0x")
        ? previousRoot
        : "0x"+previousRoot,


        {
            nonce
        }

    );



    console.log(
        "Pending TX:",
        tx.hash
    );


    const receipt =
        await tx.wait();



    return {

        txHash:
        tx.hash,

        blockNumber:
        receipt.blockNumber

    };


};



export {
    sendMerkleRoot
};