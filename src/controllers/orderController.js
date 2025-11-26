// File: src/controllers/orderController.js

import prisma from "../config/db.js";
import { db as firestore } from "../config/firebase.js";
import { sendOrderNotificationToAdmins } from '../utils/mailer.js';
import { Prisma } from '@prisma/client';

// Helper function to back up order data to Firebase (unchanged)
const backupOrderToFirebase = async (order) => {
    try {
        await firestore.collection("orders").doc(order.orderId).set(order);
        console.log(`Order ${order.orderId} backed up to Firebase.`);
    } catch (error) {
        console.error(`Firebase backup failed for order ${order.orderId}:`, error);
    }
};

/**
 * Creates a new order.
 * Validates that the requested product variants exist and have enough quantity.
 * Decrements the quantity of the ordered variants in a transaction.
 */
// In src/controllers/orderController.js

export const createOrder = async (req, res) => {
    const { uid: clientId } = req.client;
    const { products } = req.body;

    if (!clientId) {
        return res.status(401).json({ error: 'Client authentication failed.' });
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'A non-empty products array is required.' });
    }

    // --- MODIFICATION: Validate the new input structure ---
    for (const item of products) {
        if (!item.productId || !item.size || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({ error: 'Each item in products must have a valid productId, size, and a quantity greater than 0.' });
        }
    }

    try {
        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
            return res.status(404).json({ error: 'Client profile not found.' });
        }

        const orderResult = await prisma.$transaction(async (tx) => {
            // --- MODIFICATION: Find variants by productId and size, not by variantId ---
            const variantsToFind = products.map(p => ({
                productId: p.productId,
                size: p.size,
            }));

            const dbVariants = await tx.productVariant.findMany({
                where: {
                    OR: variantsToFind,
                },
                include: { product: true }
            });

            // Create a map using a composite key for easy lookup
            const dbVariantsMap = new Map(dbVariants.map(v => [`${v.productId}|${v.size}`, v]));
            let totalAmount = new Prisma.Decimal(0);
            const productsForOrderJson = [];

            for (const item of products) {
                // Find the corresponding variant from the database
                const variant = dbVariantsMap.get(`${item.productId}|${item.size}`);

                if (!variant) {
                    throw new Error(`Product with ID ${item.productId} and size "${item.size}" not found.`);
                }

                if (variant.quantity < item.quantity) {
                    throw new Error(`Not enough stock for ${variant.product.title} (Size: ${variant.size}). Requested: ${item.quantity}, Available: ${variant.quantity}.`);
                }

                await tx.productVariant.update({
                    where: { id: variant.id }, // Use the internal variant.id for the update
                    data: { quantity: { decrement: item.quantity } }
                });

                const itemPrice = variant.product.price;
                totalAmount = totalAmount.add(itemPrice.mul(item.quantity));

                productsForOrderJson.push({
                    productId: variant.productId,
                    variantId: variant.id, // We still store the variantId for our own records
                    title: variant.product.title,
                    size: variant.size,
                    quantity: item.quantity,
                    price: itemPrice,
                });
            }

            const newOrder = await tx.order.create({
                data: {
                    orderId: `${Math.floor(1000 + Math.random() * 9000)}`,
                    firstName: client.name || 'N/A',
                    lastName: '',
                    phoneNumber: client.phoneNumber || 'N/A',
                    email: client.email,
                    products: productsForOrderJson,
                    totalAmount: totalAmount.toNumber(),
                    status: 'Pending',
                    clientId: client.id,
                }
            });

            return newOrder;
        }, {
            maxWait: 5000,
            timeout: 10000,
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        // backupOrderToFirebase(orderResult);

        try {
            const adminsToNotify = await prisma.admin.findMany({ select: { email: true } });
            const adminEmails = adminsToNotify.map(admin => admin.email);
            if (adminEmails.length > 0) {
                const customerName = `${client.name || client.email}`.trim();
                sendOrderNotificationToAdmins({
                    recipients: adminEmails,
                    orderId: orderResult.orderId,
                    customerName: customerName
                });
            }
        } catch (emailError) {
            console.error("Failed to send order notification email to admins:", emailError);
        }

        res.status(201).json(orderResult);

    } catch (error) {
        console.error("Order creation failed:", error.message);
        res.status(400).json({ error: error.message || 'Server error while placing the order.' });
    }
};

// The following functions (getOrders, updateOrderStatus, etc.) do not need
// major changes as they operate on the Order model itself, which has not
// fundamentally changed. We just need to ensure they are still present.

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!["Pending", "Ready to dispatch", "Completed", "Cancelled"].includes(status)) {
            return res.status(400).json({ error: "Invalid status update." });
        }

        const updatedOrder = await prisma.order.update({
            where: { orderId: orderId },
            data: { status },
        });

        // backupOrderToFirebase(updatedOrder);
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: "Failed to update order status." });
    }
};

export const updateOrderDetails = async (req, res) => {
    const { orderId } = req.params;
    const updateData = req.body;

    try {
        const updatedOrder = await prisma.order.update({
            where: { orderId: orderId },
            data: updateData,
        });

        // backupOrderToFirebase(updatedOrder);
        res.status(200).json({ message: "Order updated successfully", order: updatedOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update order", details: error.message });
    }
};

export const getOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders." });
    }
};

export const getCompletedOrders = async (req, res) => {
    try {
        const completedOrders = await prisma.order.findMany({
            where: { status: "Completed" },
            orderBy: { createdAt: "desc" }
        });
        res.json(completedOrders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch completed orders." });
    }
};