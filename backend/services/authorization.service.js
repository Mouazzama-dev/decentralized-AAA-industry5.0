import { verifyCredential } from "./vc.service.js";
import { isIssuerTrusted } from "./trust.service.js";


const checkAuthorization = async ({
    credential,
    operatorDid,
    machineDid,
    action
}) => {


    // Check ③a: Verify VC signature
    const verification = await verifyCredential(credential);

    if (!verification.verified) {
        return { authorized: false, reason: "Invalid credential" };
    }

    // Check ③b (C2): Verify issuer is a trusted DID for this gateway.
    // Trusted issuers: local factory admin DID and/or Platform Root DID.
    // If no trusted issuers are configured, this check is skipped (backward-compat).
    const issuerDid = verification.verifiableCredential?.issuer?.id
        ?? verification.verifiableCredential?.issuer;

    const trusted = await isIssuerTrusted(issuerDid);
    if (!trusted) {
        return {
            authorized: false,
            reason: `VC issuer not trusted: ${issuerDid}`
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