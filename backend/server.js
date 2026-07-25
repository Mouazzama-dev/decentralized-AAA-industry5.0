import app from "./app.js";
import { PORT } from "./config/env.js";
import connectMongoDB from "./config/mongodb.js";


await connectMongoDB();


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});