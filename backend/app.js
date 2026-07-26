import express from "express";
import cors from "cors";

import identityRoutes from "./routes/identity.routes.js";
import testRoutes from "./routes/test.routes.js";
import permitRoutes from "./routes/permit.routes.js";
import authorizationRoutes from "./routes/authorization.routes.js";


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

//Permit issuande and verification routes
app.use(
    "/api/permit",
    permitRoutes
);
//Authorization routes
app.use(
    "/api/authorization",
    authorizationRoutes
);
export default app;