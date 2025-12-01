import razorpay from "razorpay";
import prisma from "../config/db.js";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();
const { RAZ_KEY_ID, RAZ_KEY_SECRET } = process.env;

const rzp = new razorpay({
    key_id: RAZ_KEY_ID,
    key_secret: RAZ_KEY_SECRET
});

export const createOrder = async (req, res) => {
    const clientId = req.client.id;

    if (!clientId) {
        return res.status(401).json({ error: "Client authentication failed." });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });

    const { amount, cart_items, shippingAddress } = req.body;

    try {
        // 1. Create internal order
        const newOrder = await prisma.order.create({
            data: {
                orderId: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Use provided cart id
                name: client.name,
                email: client.email,
                shippingAddress,
                phoneNumber: client.phoneNumber,
                clientId: client.id,
                products: cart_items, // Store cart items JSON
                totalAmount: parseFloat(amount),
                status: "Pending",
                paymentStatus: "PENDING"
            }
        });

        // 2. Convert to paise
        const amountInPaise = Math.round(Number(amount) * 100);

        // 3. Create Razorpay order
        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: newOrder.orderId,
            notes: {
                internalOrderId: newOrder.id
            }
        };

        const razorpayOrder = await rzp.orders.create(options);

        if (!razorpayOrder) {
            await prisma.order.delete({ where: { id: newOrder.id } });
            return res.status(500).json({
                success: false,
                message: "Razorpay order creation failed"
            });
        }

        // 4. Update internal order with Razorpay orderId
        const updatedOrder = await prisma.order.update({
            where: { id: newOrder.id },
            data: {
                razorpayOrderId: razorpayOrder.id
            }
        });

        res.status(200).json({
            success: true,
            razorpayOrder,
            internalOrder: updatedOrder
        });
    } catch (err) {
        console.error("Error creating order:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while creating order"
        });
    }
};

export const verifyPayment = async (req, res) => {
    const { payment_id, order_id, signature } = req.body;

    try {
        // Generate signature
        const hmac = crypto.createHmac("sha256", RAZ_KEY_SECRET);
        hmac.update(order_id + "|" + payment_id);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== signature) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed: Signature mismatch."
            });
        }

        // Find and update order
        const updatedOrder = await prisma.order.update({
            where: { razorpayOrderId: order_id },
            data: {
                paymentStatus: "PAID",
                razorpayPaymentId: payment_id,
                razorpaySignature: signature,
                status: "Confirmed"
            }
        });

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // ============================
        // 🔥 VARIANT-AWARE STOCK UPDATE
        // ============================
        const cartItems = updatedOrder.products; // array from JSON

        for (const item of cartItems) {
            const productId = item.id;
            const qty = Number(item.quantity);

            // Check if a variant size is present
            if (item.variantSize) {
                // ==========================
                // ➤ UPDATE VARIANT STOCK
                // ==========================
                const variant = await prisma.productVariant.findUnique({
                    where: {
                        productId_size: {
                            productId,
                            size: item.variantSize
                        }
                    }
                });

                if (variant) {
                    await prisma.productVariant.update({
                        where: {
                            productId_size: {
                                productId,
                                size: item.variantSize
                            }
                        },
                        data: {
                            quantity: {
                                decrement: qty
                            }
                        }
                    });
                }
            } else {
                // ==================================
                // ➤ UPDATE PRODUCT-LEVEL STOCK (fallback)
                // ==================================

                const product = await prisma.product.findUnique({
                    where: { id: productId }
                });

                if (!product) continue;

                // Determine where base stock is stored (choose your field)
                const details = product.otherDetails || {};
                const currentStock = Number(details.stock ?? 0);
                const newStock = Math.max(currentStock - qty, 0);

                await prisma.product.update({
                    where: { id: productId },
                    data: {
                        otherDetails: {
                            ...details,
                            stock: newStock
                        }
                    }
                });
            }
        }

        // Success response
        res.status(200).json({
            success: true,
            message: "Payment verified & stock updated",
            order: updatedOrder
        });
    } catch (err) {
        console.error("Payment verification error:", err);
        res.status(500).json({
            success: false,
            message: "Server error during payment verification"
        });
    }
};
