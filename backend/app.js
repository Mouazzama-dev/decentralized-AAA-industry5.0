import express from "express";
import cors from "cors";

import identityRoutes from "./routes/identity.routes.js";
import testRoutes from "./routes/test.routes.js";


const app = express();


app.use(cors());

app.use(express.json());


// Test route
app.use(
    "/api/test",
    testRoutes
);


// Identity routes
app.use(
    "/api/identity",
    identityRoutes
);


export default app;