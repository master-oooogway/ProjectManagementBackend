/**
 * This file has exactly one responsibility
 * Establish connection between Node.js application and mongoDB database
 * Single responsibility principle applied
 * which makes project scalable
 */

/**
 * Mongoose is an ODM - object document mapper
 * mongoose acts as a translator btw mongodb and js
 * without it: we have to directly communicate with mongodb driver
 * with : User.find(), .create(), .findById() works
 * here we import it for mongoose.connect() only
 */
import mongoose from "mongoose";

/**
 * we use functions to make wrapper
 * because we want control
 * and now connectDB() can be called whenever we want
 */
const connectDB = async() => {
    try{
        //wait some time
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");
    }catch(err){
        console.error("MongoDB connection error: ", err);

        //since the db is not connected so we dump the whole process
        process.exit(1);
    }
}
export default connectDB;