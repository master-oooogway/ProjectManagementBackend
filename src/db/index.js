import mongoose from "mongoose";

//this might get so many error
// mongoose.connect(process.env.MONGO_URI);

//so we do following things
const connectDB = async() => {
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");
    }catch(err){
        console.error("MongoDB connection error: ", err);

        //since the db is not connected so we dump the whole process
        process.exit(1);
    }
}
export default connectDB;