import express from "express";
import { createOrder, verifyPayment } from "../controllers/paymentController.js";
import { authenticateClient } from "../middleware/authClientMiddleware.js";

const router = express.Router();

// @desc Create a new order
// @route POST /api/payment/create-order
// @access Public
router.post("/create-order", authenticateClient, createOrder);

// @desc Verify payment
// @route POST /api/payment/verify-payment
// @access Public
router.post("/verify-payment", verifyPayment);

export default router;
