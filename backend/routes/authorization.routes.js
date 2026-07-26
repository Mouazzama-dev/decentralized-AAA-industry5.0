import express from "express";

import {
    authorize
} from "../controllers/authorization.controller.js";


const router = express.Router();


router.post(
    "/check",
    authorize
);


export default router;