import { verifyCredential } from "./vc.service.js";


const checkAuthorization = async ({
    credential,
    operatorDid,
    machineDid,
    action
}) => {


    // Step 1: Verify VC signature

    const verification =
        await verifyCredential(credential);


    if(!verification.verified){

        return {
            authorized:false,
            reason:"Invalid credential"
        };

    }



    // Step 2: Check credential data (use decoded output — works for both JWT string and object input)

    const subject =
        verification.verifiableCredential?.credentialSubject;



    if(subject.id !== operatorDid){

        return {
            authorized:false,
            reason:"Operator mismatch"
        };

    }



    if(subject.machine !== machineDid){

        return {
            authorized:false,
            reason:"Machine mismatch"
        };

    }



    if(
        !subject.allowedActions.includes(action)
    ){

        return {
            authorized:false,
            reason:"Action not permitted"
        };

    }



    return {

        authorized:true,

        reason:"Access granted"

    };

};


export {
    checkAuthorization
};