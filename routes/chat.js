import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { addMembers, deleteChat, getChatDetails, getMessages, getMyChats, getMyGroups, leaveGroup, newGroupChat, removeMember, renameGroup, sendAttachments } from "../controllers/chat.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import { addMemberValidator, chatIdValidator, newGroupChatValidator, removeMemberValidator, renameGroupValidator, sendAttachmentsValidator, validateHandler } from "../lib/validators.js";
const router = express.Router();

// After here user must be logged in to access the routes
router.use(isAuthenticated);
router.post("/new", newGroupChatValidator(), validateHandler, newGroupChat);
router.get("/my", getMyChats);
router.get("/my/groups", getMyGroups);
router.put("/addmembers", addMemberValidator(), validateHandler, addMembers);
router.put("/removemember", removeMemberValidator(), validateHandler, removeMember);
router.delete("/leave/:id", chatIdValidator(), validateHandler, leaveGroup);
router.post("/message", attachmentsMulter, sendAttachmentsValidator(), validateHandler, sendAttachments);

//Get Chat Details, rename, delete
router.route("/:id").get(chatIdValidator(), validateHandler, getChatDetails).put(renameGroupValidator(), validateHandler, renameGroup).delete(chatIdValidator(), validateHandler, deleteChat);

//Get Messages
router.get("/message/:id", chatIdValidator(), validateHandler, getMessages);

// Export the router
export default router;
