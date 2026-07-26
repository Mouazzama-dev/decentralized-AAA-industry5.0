import express from "express";

import {
    issue,
    verify
} from "../controllers/permit.controller.js";


const router = express.Router();


router.post(
    "/issue",
    issue
);


router.post(
    "/verify",
    verify
);



export default router;