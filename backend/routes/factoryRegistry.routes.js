import express from "express";
import { register, lookup, listAll } from "../controllers/factoryRegistry.controller.js";

const router = express.Router();

// C3: FactoryRegistry — on-chain factory directory
router.post("/",              register);   // { factoryName, accessLogAddress }
router.get("/",               listAll);    // list all registered factories
router.get("/:factoryName",   lookup);     // get AccessLog address for one factory

export default router;
