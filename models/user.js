import mongoose, { Schema, model } from "mongoose";
import bcrypt from "bcrypt";

// Define the user schema
const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    avatar: {
        public_id: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        }
    }
},
    {
        timestamps: true
    });

userSchema.pre("save", async function (next) {
    // Check if the password is modified or this is a new user
    if (!this.isModified("password")) {
        return next();
    }

    try {
        // Generate a salt
        const salt = await bcrypt.genSalt(10);
        // Hash the password
        const hashedPassword = await bcrypt.hash(this.password, salt);
        // Replace the plain password with the hashed password
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

const User = mongoose.models.User || model("User", userSchema);
export default User;