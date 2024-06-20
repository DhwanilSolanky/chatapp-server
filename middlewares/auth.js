import jwt from 'jsonwebtoken';
import { ErrorHandler } from "../utils/utility.js";
import User from '../models/user.js';

const isAuthenticated = (req, res, next) => {
    try {
        debugger;
        const token = req.cookies["jwt-token"];
        
        if(!token){
            return next(new ErrorHandler("Please login to access this route", 401));
        }
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decodedData.id;
        next();
    } catch (error) {
        next(error); 
    }
}

const adminOnly = (req, res, next) => {
    try {
        const token = req.cookies["jwt-admin-token"];
        if(!token){
            return next(new ErrorHandler("Only Admin can access this route", 401));
        }
        const secretKey = jwt.verify(token, process.env.JWT_SECRET);
        const adminSecretKey = process.env.ADMIN_SECRET_KEY || "svevdwerg";
        const isMatched = secretKey === adminSecretKey;
        if (!isMatched) return next(new ErrorHandler("Only Admin can access this route", 401));
        next();
    } catch (error) {
        next(error); 
    }
}


const socketAuthenticator = async (err, socket, next) => {
    try {
        if (err) return next(err);
        const authToken = socket.request.cookies["jwt-token"];
        if (!authToken) return next(new ErrorHandler("Please login to access this route", 401));
        
        const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
        const user = await User.findById(decodedData.id);
        if (!user) return next(new ErrorHandler("Please login to access this route", 401));

        socket.user = user;
        return next();
    } catch (error) {
        console.error("Authentication error:", error);
        return next(new ErrorHandler("Please login to access this route", 401));
    }
};

export {isAuthenticated, adminOnly, socketAuthenticator};