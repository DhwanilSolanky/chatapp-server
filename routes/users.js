import express from "express";
import { acceptFriendRequest, getAllNotifications, getMyFriends, getMyProfile, login, logout, newUser, searchUser, sendFriendRequest } from "../controllers/users.js";
import { singleAvatar } from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { acceptRequestValidator, loginValidator, registerValidator, sendAttachmentsValidator, sendRequestValidator, validateHandler } from "../lib/validators.js";
const router = express.Router();

// Define the route handler function
router.post('/new', singleAvatar, registerValidator(), validateHandler, newUser);
router.post('/login', loginValidator(), validateHandler, login);

// After here user must be logged in to access the routes
router.use(isAuthenticated);
router.get('/myProfile', getMyProfile);
router.get('/logout', logout);
router.get('/search', searchUser);
router.put('/sendrequest',sendRequestValidator(), validateHandler, sendFriendRequest);
router.put('/acceptrequest',acceptRequestValidator(), validateHandler, acceptFriendRequest);
router.get('/notifications', getAllNotifications);
router.get('/friends', getMyFriends);

// Export the router
export default router;
