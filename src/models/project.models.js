import mongoose, {mongo, Schema} from "mongoose";

const projectSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {timestamps: true})


//this will be converted into lowercase and plural form
export const Project = mongoose.model("Project", projectSchema)