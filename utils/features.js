import mongoose from "mongoose"
import jwt from 'jsonwebtoken';
import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { getBase64, getSockets } from "../lib/helper.js";

const connectDB = (uri) => {
    mongoose.connect(uri, { dbName: "ChatApp" }).then((data) => { console.log(`Connected to DB: ${data.connection.host}`) }).catch((err) => { throw (err) })
}

const cookieOptions = {
    maxAge: 15 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    secure: true,
    httpOnly: true
};

const sendToken = (user, statusCode, res, message) => {
    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    // Set cookie options


    // Send cookie with token
    res.cookie('jwt-token', token, cookieOptions);

    // Send response with token and user data
    res.status(statusCode).json({
        status: true,
        message,
        user
    });
};

const emitEvent = (req, event, users, data) => {
    const io = req.app.get("io");
    const usersSocket = getSockets(users);
    io.to(usersSocket).emit(event, data);
    console.log("Emitting event: ", event);
};


const deleteFilesFromCloudinary = (public_ids) => {

}

const uploadFilesToCloudinary = async (files = []) => {
    const uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(
                getBase64(file),
                {
                    resource_type: "auto",
                    public_id: uuid(),
                }, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                })
        })
    });

    try {
        const results = await Promise.all(uploadPromises);
        const formattedResults = results.map((result) => ({
            public_id: result.public_id,
            url: result.secure_url,
        }));
        return formattedResults;
    } catch (error) {
        throw new Error('Error uploading files to cloudinary', error);
    }
}

export { connectDB, sendToken, cookieOptions, emitEvent, deleteFilesFromCloudinary, uploadFilesToCloudinary };