import { agent } from "../../agent.js";
import { verifyJWT, decodeJWT } from "did-jwt";


const issuePermit = async ({
    issuerDid,
    holderDid,
    machineDid,
    actions
}) => {


    const credential = await agent.createVerifiableCredential({

        credential: {

            issuer: {
                id: issuerDid
            },

            credentialSubject: {

                id: holderDid,

                machine: machineDid,

                allowedActions: actions

            }

        },

        proofFormat: "jwt"

    });


    return credential;

};



const verifyCredential = async (credential)=>{


    const result =
        await agent.verifyCredential({
            credential
        });


    return result;

};



// C4: Verify a JWT VC using a cached DID document — no RPC call needed.
// getCachedDocFn: async (did) => didDocument | null
const verifyCredentialOffline = async (credential, getCachedDocFn) => {
    // Extract raw JWT string
    let jwt;
    if (typeof credential === "string") {
        jwt = credential;
    } else if (credential?.proof?.jwt) {
        jwt = credential.proof.jwt;
    } else {
        throw new Error("Cannot extract JWT from credential for offline verification");
    }

    // Decode without verification to get the issuer DID
    const decoded = decodeJWT(jwt);
    const issuerDid = decoded.payload?.iss;
    if (!issuerDid) throw new Error("No issuer DID (iss) in JWT payload");

    // Retrieve cached DID document
    const cachedDocument = await getCachedDocFn(issuerDid);
    if (!cachedDocument) {
        throw new Error(
            `No cached DID document for ${issuerDid}. ` +
            `Add as a platformRoot trusted issuer while RPC is reachable to cache it.`
        );
    }

    // Fake resolver that serves the cached document — zero RPC calls
    const offlineResolver = {
        resolve: async (resolvedDid) => {
            const baseDid = resolvedDid.split("#")[0];
            if (baseDid === issuerDid) {
                return {
                    didResolutionMetadata: { contentType: "application/did+ld+json" },
                    didDocument: cachedDocument,
                    didDocumentMetadata: {}
                };
            }
            throw new Error(`DID ${baseDid} not in offline cache`);
        }
    };

    // Verify JWT signature using cached key — throws if signature invalid
    const jwtResult = await verifyJWT(jwt, { resolver: offlineResolver });

    // Reconstruct credentialSubject from JWT payload
    const vcPayload = decoded.payload?.vc || {};
    const credentialSubject = { ...(vcPayload.credentialSubject || {}) };
    // JWT encoding puts credentialSubject.id in the top-level 'sub' claim
    if (!credentialSubject.id && decoded.payload?.sub) {
        credentialSubject.id = decoded.payload.sub;
    }

    return {
        verified: true,
        offlineMode: true,
        verifiableCredential: {
            issuer: { id: jwtResult.issuer },
            credentialSubject
        }
    };
};


export {
    issuePermit,
    verifyCredential,
    verifyCredentialOffline
};