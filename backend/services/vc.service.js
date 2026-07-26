import { agent } from "../../agent.js";


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



export {
    issuePermit,
    verifyCredential
};