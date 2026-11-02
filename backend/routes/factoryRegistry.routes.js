import express from "express";
import { register, lookup, listAll, deploy } from "../controllers/factoryRegistry.controller.js";

const router = express.Router();

// C3: FactoryRegistry — on-chain factory directory
router.post("/deploy",        deploy);     // deploy a fresh AccessLog.sol, returns { address, txHash }
router.post("/",              register);   // { factoryName, accessLogAddress }
router.get("/",               listAll);    // list all registered factories
router.get("/:factoryName",   lookup);     // get AccessLog address for one factory

export default router;
