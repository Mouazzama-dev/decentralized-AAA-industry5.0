import express from "express";

import {
    register,
    getAll,
    approve,
    addTrust,
    getTrust
} from "../controllers/identity.controller.js";


const router = express.Router();


router.post("/register", register);
router.get("/all", getAll);
router.post("/approve", approve);

// C2: trusted VC issuer management
router.post("/trust", addTrust);   // { did, role? }
router.get("/trust", getTrust);    // list current trusted issuers


export default router;