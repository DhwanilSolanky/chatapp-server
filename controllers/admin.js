import jwt from "jsonwebtoken";
import Chat from "../models/chat.js";
import Message from "../models/message.js";
import User from "../models/user.js";
import { cookieOptions } from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";

const allUsers = async (req, res, next) => {
    try {
        const users = await User.find({});
        const transformedUsers = await Promise.all(users.map(async ({ name, username, avatar, _id }) => {
            const [groups, friends] = await Promise.all([
                Chat.countDocuments({ groupChat: true, members: _id }),
                Chat.countDocuments({ groupChat: false, members: _id })
            ]);
            return {
                name,
                username,
                _id,
                avatar: avatar.url,
                groups,
                friends
            };
        }));
        return res.status(200).json({
            success: true,
            users: transformedUsers
        });
    } catch (error) {
        next(error);
    }
}

const allChats = async (req, res, next) => {
    try {
        const chats = await Chat.find({}).populate("members", "name avatar").populate("creator", "name avatar");
        const transformedChats = await Promise.all(chats.map(async ({ members, _id, groupChat, name, creator }) => {
            const totalMessages = await Message.countDocuments({ chat: _id })
            return {
                _id,
                groupChat,
                name,
                avatar: members.slice(0, 3).map((member) => member.avatar.url),
                members: members.map(({ _id, name, avatar }) => {
                    return {
                        _id,
                        name,
                        avatar: avatar.url
                    }
                }),
                creator: {
                    name: creator?.name || "None",
                    avatar: creator?.avatar.url || ""
                },
                totalMembers: members.length,
                totalMessages
            };
        }));
        return res.status(200).json({
            success: true,
            chats: transformedChats
        });
    } catch (error) {
        next(error);
    }
}

const allMessages = async (req, res, next) => {
    try {
        const messages = await Message.find({}).populate("sender", "name avatar").populate("chat", "groupChat");
        const transformedMessages = messages.map(({ content, attachments, sender, chat, _id, createdAt }) => {

            return {
                _id,
                attachments,
                content,
                createdAt,
                chat: chat._id,
                groupChat: chat.groupChat,
                sender: {
                    _id: sender._id,
                    name: sender.name,
                    avatar: sender.avatar.url,
                }
            };
        });
        return res.status(200).json({
            sucess: true,
            messages: transformedMessages,
        });
    } catch (error) {
        next(error);
    }
}

const getDashboardStats = async (req, res, next) => {
    try {
        const [groupsCount, usersCount, messagesCount, totalChatsCount] = await Promise.all([
            Chat.countDocuments({ groupChat: true }),
            User.countDocuments({}),
            Message.countDocuments({}),
            Chat.countDocuments({}),
        ])
        const today = new Date();
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);
        const last7DaysMessages = await Message.find({
            createdAt: {
                $gte: last7Days,
                $lte: today
            }
        }).select("createdAt");

        const messages = new Array(7).fill(0);
        const daysInMilliseconds = 1000 * 60 * 60 * 24;
        last7DaysMessages.forEach((message) => {
            const indexApprox = (today.getTime() - message.createdAt.getTime()) / daysInMilliseconds;
            const index = Math.floor(indexApprox);
            messages[6 - index]++;
        })
        const stats = {
            groupsCount,
            usersCount,
            messagesCount,
            totalChatsCount,
            messagesChart: messages,
        }
        return res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        next(error);
    }
}


const adminLogin = async (req, res, next) => {
    try {
        const { secretKey } = req.body;
        const adminSecretKey = process.env.ADMIN_SECRET_KEY || "svevdwerg";
        const isMatched = secretKey === adminSecretKey;
        if (!isMatched) return next(new ErrorHandler("Invalid Admin Key", 401));
        const token = jwt.sign(secretKey, process.env.JWT_SECRET);
        return res.status(200).cookie("jwt-admin-token", token, { ...cookieOptions, maxAge: 1000 * 60 * 15 }).json({
            success: true,
            message: "Authenticated Successfully, Welcome back"
        });
    } catch (error) {
        next(error);
    }
}

const adminLogout = async (req, res, next) => {
    try {
        return res.status(200).cookie("jwt-admin-token", "", { ...cookieOptions, maxAge: 0 }).json({
            success: true,
            message: "Logout Successfully"
        });
    } catch (error) {
        next(error);
    }
}

const getAdminData = async (req, res, next) => {
    try {
        return res.status(200).json({
            admin: true
        });
    } catch (error) {
        next(error);
    }
}

export { allUsers, allChats, allMessages, getDashboardStats, adminLogin, adminLogout, getAdminData };