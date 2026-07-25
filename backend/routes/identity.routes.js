import express from "express";

import {
    register,
    getAll,
    approve
} from "../controllers/identity.controller.js";


const router = express.Router();


router.post(
    "/register",
    register
);


router.get(
    "/all",
    getAll
);

router.post(
    "/approve",
    approve
);


export default router;