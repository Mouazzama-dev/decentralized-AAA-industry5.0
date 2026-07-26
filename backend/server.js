import app from "./app.js";
import { PORT } from "./config/env.js";
import connectMongoDB from "./config/mongodb.js";
import {
    connectSQLite
} from "./database/sqlite.js";


await connectMongoDB();
await connectSQLite();


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});