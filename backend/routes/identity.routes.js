import express from "express";

import {
    register,
    getAll,
    approve,
    addTrust,
    getTrust,
    cacheRootKey,
    getCachedKeys
} from "../controllers/identity.controller.js";


const router = express.Router();


router.post("/register", register);
router.get("/all", getAll);
router.post("/approve", approve);

// C2: trusted VC issuer management
router.post("/trust", addTrust);   // { did, role? }
router.get("/trust", getTrust);    // list current trusted issuers

// C4: offline resilience — cache/inspect DID documents for RPC-down fallback
router.post("/cache-root-key", cacheRootKey);  // { did } — (re-)cache a DID document
router.get("/cached-keys", getCachedKeys);     // list cached DID documents


export default router;