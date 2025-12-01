import express from "express";
import rateLimit from "express-rate-limit";
import {
    createOrder,
    getOrders,
    updateOrderStatus,
    updateOrderDetails,
    getCompletedOrders
} from "../controllers/orderController.js";
import { authenticateClient } from "../middleware/authClientMiddleware.js";

const orderLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 order creation requests per windowMs
    message: { error: "Too many order requests. Please try again later." },
    headers: false
});

const router = express.Router();

router.post("/", orderLimiter, authenticateClient, createOrder);
router.get("/", authenticateClient, getOrders);
router.patch("/:orderId/status", authenticateClient, updateOrderStatus);
router.patch("/:orderId/details", authenticateClient, orderLimiter, updateOrderDetails);
router.get("/completed", authenticateClient, getCompletedOrders);

export default router;
