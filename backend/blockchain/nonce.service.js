import {
    provider,
    wallet
} from "./contract.config.js";

let currentNonce = null;


const getNextNonce = async()=>{


    if(currentNonce === null){

        currentNonce =
        await provider.getTransactionCount(
            wallet.address,
            "pending"
        );

    }


    return currentNonce++;

};



const resetNonce = ()=>{

    currentNonce = null;

};


export {
    getNextNonce,
    resetNonce
};