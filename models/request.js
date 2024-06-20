import mongoose, { Schema, model, Types } from "mongoose";

// Define the user schema
const requestSchema = new Schema({
    staus: {
        type: String,
        default: "pending",
        enum: ["pending", "accepted", "rejected"]
    },
    sender: {
        type: Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: Types.ObjectId,
        ref: "User",
        required: true
    },
},
{
    timestamps: true
});

const Request = mongoose.models.Request || model("Request", requestSchema);
export default Request;