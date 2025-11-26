import express from 'express';
import { verifyToken } from '../controllers/authController.js';
import { authenticateAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post("/verify", authenticateAdmin, verifyToken);

export default router;