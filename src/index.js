//Entry point of our application




//dotenv setup
import dotenv from "dotenv"
import app from "./app.js"
import connectDB from "./db/index.js"

dotenv.config({
    path: "./.env",
    override: true
});

const port = process.env.PORT || 3000;


//connect database first and start the server
connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`);
        });
    })
    .catch(err => {
        console.error("MongoDB connection error", err);
        process.exit(1);
    })