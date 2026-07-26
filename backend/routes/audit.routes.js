import express from "express";

import {

    createEvent,

    pendingEvents

} from "../controllers/audit.controller.js";



const router = express.Router();



router.post(
    "/event",
    createEvent
);



router.get(
    "/pending",
    pendingEvents
);



export default router;