// File: src/services/productService.js

import prisma from "../config/db.js";
import { Prisma } from "@prisma/client";

/**
 * Creates a new product and its variants in a single database transaction.
 * @param {object} productData - The data for the product and its variants.
 * @returns {Promise<object>} The newly created product with its variants.
 */
export const addProduct = async (productData) => {
    const {
        id,
        title,
        description,
        imageUrls = [], // Default to empty array if not provided
        category,
        subCategory,
        price,
        taxRate,
        chargeTax = false,
        dimensions,
        weight,
        otherDetails,
        variants = [] // Variants (sizes and quantities)
    } = productData;

    // --- Basic Validation ---
    if (!id || !title || !category || !price || variants.length === 0) {
        throw new Error(
            "Missing required fields: id, title, category, price, and at least one variant are required."
        );
    }
    for (const variant of variants) {
        if (!variant.size || variant.quantity === undefined) {
            throw new Error("Each variant must have a 'size' and 'quantity'.");
        }
    }

    try {
        const newProduct = await prisma.$transaction(async (tx) => {
            // Step 1: Create the main Product
            const createdProduct = await tx.product.create({
                data: {
                    id: id,
                    title: title,
                    description: description,
                    imageUrls: imageUrls,
                    category: category,
                    subCategory: subCategory,
                    price: new Prisma.Decimal(price), // Convert string/number to Prisma.Decimal
                    taxRate: taxRate ? new Prisma.Decimal(taxRate) : null,
                    chargeTax: chargeTax,
                    dimensions: dimensions || Prisma.JsonNull,
                    weight: weight || Prisma.JsonNull,
                    otherDetails: otherDetails || Prisma.JsonNull
                }
            });

            // Step 2: Prepare and create the associated ProductVariants
            const variantsData = variants.map((variant) => ({
                size: variant.size,
                quantity: Number(variant.quantity),
                productId: createdProduct.id // Link to the product we just created
            }));

            await tx.productVariant.createMany({
                data: variantsData
            });

            // Step 3: Return the product with its variants included
            // We need to query again to get the full object with relations.
            const productWithVariants = await tx.product.findUnique({
                where: { id: createdProduct.id },
                include: {
                    variants: true
                }
            });

            if (!productWithVariants) {
                // This should theoretically never happen in a successful transaction
                throw new Error("Failed to retrieve the newly created product.");
            }

            return productWithVariants;
        });

        return newProduct;
    } catch (error) {
        // Handle potential unique constraint errors (e.g., duplicate product ID)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error(`A product with ID '${id}' already exists.`);
        }
        // Re-throw other errors to be handled by the controller
        throw error;
    }
};
