import express from "express";
import { authenticateAdmin, authenticateSuperAdmin } from "../middleware/authMiddleware.js";
import {
    getAllClients,
    logoutClient,
    verifyClientToken,
    signupClient,
    loginClient
} from "../controllers/clientController.js";

const router = express.Router();

// @route   POST api/clients/register
// @desc    Register a new client in our database after they've signed up with Firebase
// @access  Private (Client only)

router.post("/signup", signupClient);
router.post("/login", loginClient);
router.post("/logout", logoutClient);
router.get("/verify-token", verifyClientToken);

// @route   GET api/clients/list
// @desc    Get a list of all registered clients
// @access  Private (Admin only)
router.get("/list", authenticateAdmin, authenticateSuperAdmin, getAllClients);

export default router;
