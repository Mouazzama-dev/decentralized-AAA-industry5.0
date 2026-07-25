const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());


const testRoutes = require("./routes/test.routes");

app.use("/api/test", testRoutes);


module.exports = app;