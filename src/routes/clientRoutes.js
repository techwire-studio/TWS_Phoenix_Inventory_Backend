import express from "express";
import { authenticateClient } from "../middleware/authClientMiddleware.js";
import { authenticateAdmin, authenticateSuperAdmin } from "../middleware/authMiddleware.js";
import { registerClient, getAllClients } from "../controllers/clientController.js";

const router = express.Router();

// @route   POST api/clients/register
// @desc    Register a new client in our database after they've signed up with Firebase
// @access  Private (Client only)
router.post("/register", authenticateClient, registerClient);

// @route   GET api/clients/list
// @desc    Get a list of all registered clients
// @access  Private (Admin only)
router.get("/list", authenticateAdmin, authenticateSuperAdmin, getAllClients);

export default router;
