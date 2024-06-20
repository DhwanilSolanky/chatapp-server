import express from "express";
import { adminLogin, adminLogout, allChats, allMessages, allUsers, getAdminData, getDashboardStats } from "../controllers/admin.js";
import { adminLoginValidator, validateHandler } from "../lib/validators.js";
import { adminOnly } from "../middlewares/auth.js";

const router = express.Router();

router.get("/");
router.post("/verify",adminLoginValidator(), validateHandler, adminLogin);
router.get("/logout", adminLogout);

// After here user must be logged in to access the routes
router.use(adminOnly);
router.get("/", getAdminData);
router.get("/users", allUsers);
router.get("/chats", allChats);
router.get("/messages", allMessages);
router.get("/stats", getDashboardStats);
// Export the router
export default router;
