import crypto from "crypto";

import MerkleChain from "../models/MerkleChain.js";

import {
    signMessage,
    verifySignature,
    getPublicKeyPem
} from "./signingKey.service.js";


// Genesis previousRoot for the very first block in the chain.
const GENESIS_ROOT =
    "0x0000000000000000000000000000000000000000000000000000000000000000";



/*
 * The part of the block that gets signed.
 * If any of these fields is changed, the signature breaks.
 *
 * NOTE: the field order is fixed on purpose — the verify step must
 * rebuild the payload in exactly the same order to check it.
 */
const buildSignablePayload = ({
    batchId,
    previousRoot,
    currentRoot,
    eventCount
}) => {

    return [
        batchId,
        previousRoot,
        currentRoot,
        eventCount
    ].join("|");

};



const createChainedRoot = async(

    merkleRoot,

    eventCount,

    batchId

)=>{


    const lastRoot =
        await MerkleChain
        .findOne()
        .sort({
            createdAt:-1
        });



    const previousRoot =

        lastRoot

        ?

        lastRoot.currentRoot

        :

        GENESIS_ROOT;




    const chainedRoot =

        crypto
        .createHash("sha256")
        .update(

            previousRoot +
            merkleRoot

        )
        .digest("hex");




    /*
     * ---- Sign the block ----
     * The chained root is ready. Now sign the block's key fields
     * with the gateway's private key.
     */
    const signablePayload =
        buildSignablePayload({
            batchId,
            previousRoot,
            currentRoot: chainedRoot,
            eventCount
        });

    const signature =
        signMessage(signablePayload);

    const publicKey =
        getPublicKeyPem();




    const record =

        await MerkleChain.create({

            batchId,


            previousRoot,


            currentRoot:
            chainedRoot,


            eventCount,


            // signing fields
            signature,

            publicKey

        });



    return record;


};



/*
 * ---------------------------------------------------------------
 * verifyChain()
 * ---------------------------------------------------------------
 * Walks the whole local chain in creation order and checks two
 * things for every block:
 *
 *   1. Signature validity  -> catches any tampered field
 *                             (batchId / previousRoot / currentRoot
 *                              / eventCount).
 *   2. Chain continuity    -> each block's previousRoot must equal
 *                             the previous block's currentRoot.
 *                             Catches deleted / inserted / reordered
 *                             blocks.
 *
 * Returns:
 *   {
 *     valid: boolean,
 *     totalBlocks: number,
 *     checked: number,
 *     errors: [ { batchId, blockId, type, detail } ]
 *   }
 *
 * `type` is either "SIGNATURE_INVALID" or "CHAIN_BREAK".
 * ---------------------------------------------------------------
 */
const verifyChain = async () => {

    // Load the whole chain oldest -> newest
    const blocks =
        await MerkleChain
        .find()
        .sort({ createdAt: 1 });


    const errors = [];

    let expectedPreviousRoot = GENESIS_ROOT;


    for (const block of blocks) {

        /*
         * Check 1 — signature.
         * Rebuild the exact payload that was signed and verify it
         * against the public key stored in the block.
         */
        if (!block.signature || !block.publicKey) {

            errors.push({
                batchId: block.batchId,
                blockId: block._id,
                type: "SIGNATURE_INVALID",
                detail: "Missing signature or public key"
            });

        } else {

            const payload =
                buildSignablePayload({
                    batchId: block.batchId,
                    previousRoot: block.previousRoot,
                    currentRoot: block.currentRoot,
                    eventCount: block.eventCount
                });

            const signatureOk =
                verifySignature(
                    payload,
                    block.signature,
                    block.publicKey
                );

            if (!signatureOk) {

                errors.push({
                    batchId: block.batchId,
                    blockId: block._id,
                    type: "SIGNATURE_INVALID",
                    detail: "Signature does not match block contents"
                });

            }

        }


        /*
         * Check 2 — chain continuity.
         * This block's previousRoot must equal the currentRoot of
         * the block before it (or GENESIS for the first block).
         */
        if (block.previousRoot !== expectedPreviousRoot) {

            errors.push({
                batchId: block.batchId,
                blockId: block._id,
                type: "CHAIN_BREAK",
                detail:
                    `Expected previousRoot ${expectedPreviousRoot}, ` +
                    `found ${block.previousRoot}`
            });

        }

        // Next block should chain onto this block's currentRoot
        expectedPreviousRoot = block.currentRoot;

    }


    return {
        valid: errors.length === 0,
        totalBlocks: blocks.length,
        checked: blocks.length,
        errors
    };

};



/*
 * Returns the current tail (last currentRoot) of the main chain,
 * or GENESIS if the main chain is empty. Used by the merge step to
 * re-chain local blocks onto the main chain.
 */
const getLastMainRoot = async () => {

    const lastRoot =
        await MerkleChain
        .findOne()
        .sort({ createdAt: -1 });

    return lastRoot
        ? lastRoot.currentRoot
        : GENESIS_ROOT;

};



export {

    createChainedRoot,

    // used by the verify step
    buildSignablePayload,

    verifyChain,

    getLastMainRoot,

    GENESIS_ROOT

};