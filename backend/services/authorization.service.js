import { verifyCredential, verifyCredentialOffline } from "./vc.service.js";
import { isIssuerTrusted, getCachedDIDDocument } from "./trust.service.js";


const checkAuthorization = async ({
    credential,
    operatorDid,
    machineDid,
    action
}) => {
    let verification;

    // Check ③a: Verify VC signature.
    // Veramo's verifyCredential never throws — it catches RPC failures internally
    // and returns { verified: false }. So: if live verification fails for any reason,
    // attempt offline verification using the MongoDB-cached DID document (C4).
    // If the credential signature is genuinely invalid, verifyCredentialOffline also
    // throws (did-jwt's verifyJWT fails cryptographically), and we deny normally.
    verification = await verifyCredential(credential);

    if (!verification.verified) {
        try {
            verification = await verifyCredentialOffline(credential, getCachedDIDDocument);
            console.log("[C4] Offline VC verification succeeded (live path returned verified:false)");
        } catch (offlineErr) {
            // Credential is actually invalid, or issuer not cached — deny.
            return { authorized: false, reason: "Invalid credential" };
        }
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
        authorized: true,
        reason: "Access granted",
        ...(verification.offlineMode ? { offlineMode: true } : {})
    };

};


export {
    checkAuthorization
};