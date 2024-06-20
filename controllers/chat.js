import { ErrorHandler } from "../utils/utility.js";
import Chat from "../models/chat.js";
import { deleteFilesFromCloudinary, emitEvent, uploadFilesToCloudinary } from "../utils/features.js";
import { ALERT, NEW_ATTACHMENT, NEW_MESSAGE, NEW_MESSAGE_ALERT, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import User from "../models/user.js";
import Message from "../models/message.js";

const newGroupChat = async (req, res, next) => {
    try {
        const { name, members } = req.body;
        const allMembers = [...members, req.user];
        // if (allMembers.length < 3) {
        //     return next(new ErrorHandler("Group chat must have atleast 3 members", 400));
        // }
        await Chat.create(
            {
                name,
                groupChat: true,
                creator: req.user,
                members: allMembers
            }
        )
        emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
        emitEvent(req, REFETCH_CHATS, members);
        return res.status(201).json({
            sucess: true,
            message: "Group Created",
        });
    } catch (error) {
        next(error);
    }

};


const getMyChats = async (req, res, next) => {
    try {
        const chats = await Chat.find({ members: req.user }).populate(
            "members",
            "name avatar"
        );
        const transformChats = chats.map(({ _id, name, members, groupChat }) => {
            const otherMember = getOtherMember(members, req.user);
            return {
                _id,
                groupChat,
                avatar: groupChat ? members.slice(0, 3).map(({ avatar }) => avatar.url) : [otherMember.avatar.url],
                name: groupChat ? name : otherMember.name,
                members: members.filter(member => member._id.toString() !== req.user.toString()).map(member => member._id),
            }
        })
        return res.status(200).json({
            sucess: true,
            chats: transformChats,
        });
    } catch (error) {
        next(error);
    }
};

const getMyGroups = async (req, res, next) => {
    try {
        const chats = await Chat.find({ members: req.user, groupChat: true, creator: req.user }).populate(
            "members",
            "name avatar"
        );
        const groups = chats.map(({ _id, name, members, groupChat }) => {
            //const otherMember = getOtherMember(members, req.user);
            return {
                _id,
                groupChat,
                avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
                name
                //members: members.filter(member => member._id.toString() !== req.user.toString()).map(member => member._id),
            }
        })
        return res.status(200).json({
            sucess: true,
            groups: groups,
        });
    } catch (error) {
        next(error);
    }
};


const addMembers = async (req, res, next) => {
    try {
        const { chatId, members } = req.body;
        //if (!members || members.length < 1) return next(new ErrorHandler("Please provide the members", 400));
        const chat = await Chat.findById(chatId);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));
        if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));
        if (chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("You are not allowed to add members", 403));
        const allMembersPromise = members.map((i) => User.findById(i, "name"));
        const allNewMembers = await Promise.all(allMembersPromise);
        const uniqueMembers = allNewMembers.filter((i) => !chat.members.includes(i._id.toString())).map((i) => i._id);
        chat.members.push(...uniqueMembers);
        if (chat.members.length > 100) return next(new ErrorHandler("Group members limit reached", 400));
        await chat.save();
        const allUsersName = allNewMembers.map((i) => i.name).join(",");
        emitEvent(req, ALERT, chat.members, {chatId, message: `${allUsersName} has been added in the group`});
        emitEvent(req, REFETCH_CHATS, chat.members);
        return res.status(200).json({
            sucess: true,
            message: "Members added succesfully",
        });
    } catch (error) {
        next(error);
    }
};

const removeMember = async (req, res, next) => {
    try {
        const { userId, chatId } = req.body;
        const [chat, userThatWillBeRemoved] = await Promise.all([
            Chat.findById(chatId),
            User.findById(userId, "name")
        ]);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));
        if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));
        if (chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("You are not allowed to delete members", 403));
        if (chat.members.length <= 3) return next(new ErrorHandler("Group must have atleast 3 members", 400));
        const allMembers = chat.members.map((i) => i.toString());
        chat.members = chat.members.filter((member) => member._id.toString() !== userId.toString());
        emitEvent(req, ALERT, chat.members, `${userThatWillBeRemoved.name} has been removed from the group`);
        emitEvent(req, REFETCH_CHATS, allMembers);
        await chat.save();
        return res.status(200).json({
            sucess: true,
            message: "Member removed succesfully",
        });
    } catch (error) {
        next(error);
    }
};

const leaveGroup = async (req, res, next) => {
    try {
        const chatId = req.params.id;
        const chat = await Chat.findById(chatId);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));
        if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));

        const remainingMembers = chat.members.filter((member) => member.toString() !== req.user.toString());

        if (remainingMembers.length < 3) return next(new ErrorHandler("Group must have atleast 3 members", 400));

        if (chat.creator.toString() === req.user.toString()) {
            const randomElement = Math.floor(Math.random() * remainingMembers.length);
            const newCreator = remainingMembers[randomElement];
            chat.creator = newCreator;
        }
        chat.members = remainingMembers;

        const [user] = await Promise.all([
            User.findById(req.user, "name"),
            chat.save()
        ]);
        emitEvent(req, ALERT, chat.members, {chatId, message: `User ${user.name} has left the group`});
        emitEvent(req, REFETCH_CHATS, chat.members);
        return res.status(200).json({
            sucess: true,
            message: "Leave Group succesfully",
        });
    } catch (error) {
        next(error);
    }
};


const sendAttachments = async (req, res, next) => {
    try {
        const { chatId } = req.body;
        const files = req.files || [];
        if (files.length < 1) return next(new ErrorHandler("Please provide attachments", 400));
        if (files.length > 5) return next(new ErrorHandler("Attachments must be between 1-5", 400));
        const [chat, me] = await Promise.all([
            Chat.findById(chatId),
            User.findById(req.user, "name")
        ]);

        if (!chat) return next(new ErrorHandler("Chat not found", 404));




        //Upload Files Here
        const attachments = await uploadFilesToCloudinary(files);
        const messageForRealTime = {
            content: "",
            attachments,
            sender: {
                _id: me._id,
                name: me.name,
            },
            chat: chatId
        };
        const messageForDB = { content: "", attachments, sender: me._id, chat: chatId };
        const message = await Message.create(messageForDB);
        emitEvent(req, NEW_MESSAGE, chat.members, {
            message: messageForRealTime,
            chatId
        });
        emitEvent(req, NEW_MESSAGE_ALERT, chat.members, {
            chatId
        });
        return res.status(200).json({
            sucess: true,
            message,
        });
    } catch (error) {
        next(error);
    }
};

const getChatDetails = async (req, res, next) => {
    try {
        if (req.query.populate === "true") {
            const chat = await Chat.findById(req.params.id).populate("members", "name avatar").lean();
            if (!chat) return next(new ErrorHandler("Chat not found", 404));

            chat.members = chat.members.map(({ _id, name, avatar }) => ({ _id, name, avatar: avatar.url }));
            return res.status(200).json({
                sucess: true,
                chat,
            });
        }
        else {
            const chat = await Chat.findById(req.params.id);
            if (!chat) return next(new ErrorHandler("Chat not found", 404));
            return res.status(200).json({
                sucess: true,
                chat,
            });
        }

    } catch (error) {
        next(error);
    }
};

const renameGroup = async (req, res, next) => {
    try {
        const chatId = req.params.id;
        const { name } = req.body;
        const chat = await Chat.findById(chatId);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));
        if (!chat.groupChat) return next(new ErrorHandler("Not a group chat", 400));
        if (chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("You are not allowed to change the Group name", 403));
        chat.name = name;
        emitEvent(req, REFETCH_CHATS, chat.members);
        await chat.save();
        return res.status(200).json({
            sucess: true,
            message: "Group name changed sucessfully",
        });
    } catch (error) {
        next(error);
    }
};


const deleteChat = async (req, res, next) => {
    try {
        const chatId = req.params.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));
        const members = chat.members;
        if (chat.groupChat && chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("ou are not allowed to delete the Chat.", 403));
        if (!chat.groupChat && !chat.members.includes(req.user.toString())) return next(new ErrorHandler("ou are not allowed to delete the Chat.", 403));

        //Here we have to delete all messages as well as all attachments or file from cloudinary

        const messagesWithAttachments = await Message.find({
            chat: chatId,
            attachments: { $exists: true, $ne: [] }
        });

        const public_ids = [];

        messagesWithAttachments.forEach(({ attachments }) =>
            attachments.forEach(({ public_id }) => public_ids.push(public_id))
        );

        await Promise.all([
            //Delete files from cloudinary
            deleteFilesFromCloudinary(public_ids),
            chat.deleteOne(),
            Message.deleteMany({ chat: chatId })
        ]);
        emitEvent(req, REFETCH_CHATS, members);
        return res.status(200).json({
            sucess: true,
            message: "Chat deleted sucessfully",
        });
    } catch (error) {
        next(error);
    }
};

const getMessages = async (req, res, next) => {
    try {
        const chatId = req.params.id;
        const { page = 1 } = req.query;
        const limit = 20;
        const chat = Chat.findById(chatId);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));
        if (chat && chat.members && chat.members.length > 0 && !chat?.members.includes(req.user.toString())) return next(new ErrorHandler("You are not allowed to access this Chat.", 403));
        const [messages, totalMessagesCount] = await Promise.all([
            Message.find({ chat: chatId }).
                sort({ createdAt: -1 }).
                skip((page - 1) * limit).
                limit(limit).
                populate("sender", "name").
                lean(),
            Message.countDocuments({ chat: chatId })
        ]);
        const totalPages = Math.ceil(totalMessagesCount / limit) || 0;
        return res.status(200).json({
            sucess: true,
            message: messages.reverse(),
            totalPages
        });
    } catch (error) {
        next(error);
    }
};

export { newGroupChat, getMyChats, getMyGroups, addMembers, removeMember, leaveGroup, sendAttachments, getChatDetails, renameGroup, deleteChat, getMessages };