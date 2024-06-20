import express from "express";

import { connectDB } from "./utils/features.js";
import dotenv from "dotenv";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { createServer } from "http"
import { v4 as uuid } from "uuid"
import cors from "cors";
import { v2 as cloudinary } from "cloudinary"

import usersRoute from "./routes/users.js";
import chatRoute from "./routes/chat.js"
import adminRoute from "./routes/admin.js"
import { createGroupChats, createMessagesInAChat, createSingleChats } from "./seeders/user.js";
import { CHAT_JOINED, CHAT_LEAVED, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USERS, START_TYPING, STOP_TYPING } from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import Message from "./models/message.js";
import { corsOptions } from "./constants/config.js";

import { socketAuthenticator } from "./middlewares/auth.js";
//import { createUser } from "./seeders/user.js";

// Create an Express application
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

app.set("io", io);

const userSocketIDs = new Map();
const onlineUsers = new Set();

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions))

// dotenv.config({
//     path: "./env",
// })
dotenv.config();
//connectDB("mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.4");
connectDB(process.env.MONGO_URI);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

//createMessagesInAChat("664f285cd4f0da90432be122", 10);

app.use('/api/v1/user', usersRoute);
app.use('/api/v1/chat', chatRoute);
app.use('/api/v1/admin', adminRoute);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

io.use((socket, next) => {
    cookieParser()(socket.request, socket.request.res, async (err) => {
        if (err) {
            console.error("Cookie parsing error:", err);
            return next(err);
        }
        await socketAuthenticator(err, socket, next);
    });
});

io.on("connection", (socket) => {
    const user = socket.user;
    userSocketIDs.set(user._id.toString(), socket.id);
    // console.log("user connected", socket.id);
    socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
        const messageForRealTime = {
            content: message,
            _id: uuid(),
            sender: {
                _id: user._id,
                name: user.name
            },
            chat: chatId,
            createdAt: new Date().toISOString()
        }

        const messageForDB = {
            content: message,
            sender: user._id,
            chat: chatId,
        }
        const membersSocket = getSockets(members);
        io.to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message: messageForRealTime
        });
        io.to(membersSocket).emit(NEW_MESSAGE_ALERT, {
            chatId,
        })
        try {
            await Message.create(messageForDB);
        } catch (error) {
            console.log(error);
        }

    });

    socket.on(START_TYPING, ({ members, chatId }) => {
        const membersSockets = getSockets(members);
        io.to(membersSockets).emit(START_TYPING, {
            chatId
        });
    });

    socket.on(STOP_TYPING, ({ members, chatId }) => {
        const membersSockets = getSockets(members);
        io.to(membersSockets).emit(STOP_TYPING, {
            chatId
        });
    });

    socket.on(CHAT_JOINED, ({ userId, members }) => {
        onlineUsers.add(userId.toString());
        const membersSockets = getSockets(members);
        io.to(membersSockets).emit(ONLINE_USERS, Array.from(onlineUsers));
    });

    socket.on(CHAT_LEAVED, ({ userId, members }) => {
        onlineUsers.delete(userId.toString());
        const membersSockets = getSockets(members);
        io.to(membersSockets).emit(ONLINE_USERS, Array.from(onlineUsers));
    });

    socket.on("disconnect", () => {
        console.log("user dc");
        userSocketIDs.delete(user._id.toString());
        onlineUsers.delete(user._id.toString());
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
    })
})

app.use(errorMiddleware);

// Start the server and listen on port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running and listening on port ${PORT}`);
});

export { userSocketIDs };