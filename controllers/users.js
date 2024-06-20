import { compare } from "bcrypt";
import User from "../models/user.js"
import { cookieOptions, emitEvent, sendToken, uploadFilesToCloudinary } from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import Chat from "../models/chat.js";
import Request from "../models/request.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
const newUser = async (req, res, next) => {

    try {
        const { name, username, password, } = req.body;
        const file = req.file;
        if (!file) return next(new ErrorHandler("Please upload avatar", 400));

        const result = await uploadFilesToCloudinary([file]);

        const avatar = {
            public_id: result[0].public_id,
            url: result[0].url,
        }
        const user = await User.create({ name, username, password, avatar })

        sendToken(user, 201, res, "User created successfully")
        //res.status(201).json({message: "User created successfully"});
    } catch (error) {
        next(error);
    }


};


const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username }).select("+password");
        if (!user) {
            return next(new ErrorHandler("Invalid Username", 404));
        }
        const isMatch = await compare(password, user.password);
        if (!isMatch) {
            return next(new ErrorHandler("Invalid Password", 404));
        }
        sendToken(user, 200, res, `Welcome back ${user.name}`);
    } catch (error) {
        next(error);
    }

};

const getMyProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user);
        res.json({ message: "sdvsdvsdv", user: user });
    } catch (error) {
        next(error);
    }
}

const logout = async (req, res, next) => {
    try {
        return res.status(200).cookie("jwt-token", "", { ...cookieOptions, maxAge: 0 }).json({ message: "Logout successfully", success: true });
    } catch (error) {
        next(error);
    }

}

const searchUser = async (req, res, next) => {
    try {
        const { name = "" } = req.query;

        // Finding all my chats
        const myChats = await Chat.find({ groupChat: false, members: req.user });

        //All users from my chats means friends or people i have chatted with
        const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

        // Finding all users except me and my friends
        const allUsersExceptMeAndFriends = await User.find({
            _id: { $nin: allUsersFromMyChats },
            name: { $regex: name, $options: "i" }
        })
        const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
            _id, name,
            avatar: avatar.url,
        }))
        return res.status(200).json({ users, success: true });
    } catch (error) {
        next(error);
    }
}

const sendFriendRequest = async (req, res, next) => {
    try {
        const { userId } = req.body;
        const request = await Request.findOne({
            $or: [
                { sender: req.user, receiver: userId },
                { sender: userId, receiver: req.user }
            ]
        });
        if (request) return next(new ErrorHandler("Request already sent", 400));
        await Request.create({
            sender: req.user,
            receiver: userId,
        });
        emitEvent(req, NEW_REQUEST, [userId]);
        return res.status(200).json({ message: "Friend Request Sent", success: true });
    } catch (error) {
        next(error);
    }
}

const acceptFriendRequest = async (req, res, next) => {
    try {
        const { requestId, accept } = req.body;
        const request = await Request.findById(requestId).populate("sender", "name").populate("receiver", "name");
        if (!request) return next(new ErrorHandler("Request not found", 404));

        if (request.receiver._id.toString() !== req.user.toString()) {
            return next(new ErrorHandler("You are not authorized to accept this request", 401));
        }

        if (!accept) {
            await request.deleteOne();
            return res.status(200).json({ message: "Friend Request Rejected", success: true });
        }
        const members = [request.sender._id, request.receiver._id];

        await Promise.all([
            Chat.create({
                members,
                name: `${request.sender.name}-${request.receiver.name}`
            }),
            request.deleteOne(),
        ])

        emitEvent(req, REFETCH_CHATS, members);

        return res.status(200).json({ message: "Friend Request Accepted", success: true, senderId: request.sender._id });

    } catch (error) {
        next(error);
    }

}

const getAllNotifications = async (req, res, next) => {
    try {

        const request = await Request.find({ receiver: req.user }).populate("sender", "name avatar");

        const allRequests = request.map(({ _id, sender }) => ({
            _id,
            sender: {
                _id: sender._id,
                name: sender.name,
                avatar: sender.avatar.url
            }
        }))

        return res.status(200).json({ allRequests, success: true });

    } catch (error) {
        next(error);
    }
}

const getMyFriends = async (req, res, next) => {
    try {

        const chatId = req.query.chatId;
       
        const chats = await Chat.find({ members: req.user, groupChat: false }).populate("members", "name avatar");
        
        const friends = chats.map(({ members }) => {
            const otherUser = getOtherMember(members, req.user);
            return {
                _id: otherUser._id,
                name: otherUser.name,
                avatar: otherUser.avatar.url,
            }
        })
        
        if (chatId) {
            const chat = await Chat.findById(chatId);
            const availableFriends = friends.filter((friend) => !chat.members.includes(friend._id));
            return res.status(200).json({ friends: availableFriends, success: true });
        }
        else {
            return res.status(200).json({ friends, success: true });
        }

    } catch (error) {
        next(error);
    }
}

export { login, newUser, getMyProfile, logout, searchUser, sendFriendRequest, acceptFriendRequest, getAllNotifications, getMyFriends };