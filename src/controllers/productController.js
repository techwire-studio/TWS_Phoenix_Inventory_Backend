// File: src/controllers/productController.js

import { addProduct } from '../services/productService.js';
import importCSV from '../services/csvImport.js';
import prisma from '../config/db.js';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { uploadBufferToS3 } from '../services/s3Service.js'; // Import the S3 service

/**
 * Controller to create a new product, now with image upload handling.
 * Handles request validation, uploads images to S3, and calls the addProduct service.
 */
export const createProduct = async (req, res) => {
    try {
        // req.files will contain the image files from multer
        const files = req.files;
        const productData = req.body;

        // Since the request is multipart/form-data, JSON fields will be sent as strings.
        // We need to parse them back into objects.
        if (productData.variants) {
            productData.variants = JSON.parse(productData.variants);
        }
        if (productData.dimensions) {
            productData.dimensions = JSON.parse(productData.dimensions);
        }
        if (productData.weight) {
            productData.weight = JSON.parse(productData.weight);
        }
        if (productData.otherDetails) {
            productData.otherDetails = JSON.parse(productData.otherDetails);
        }
        if (productData.chargeTax) {
            // Convert 'true'/'false' string to boolean
            productData.chargeTax = productData.chargeTax === 'true';
        }

        const imageUrls = [];

        if (files && files.length > 0) {
            console.log(`Received ${files.length} files to upload.`);

            // Use Promise.all to upload all files in parallel
            const uploadPromises = files.map(file => {
                const { buffer, originalname, mimetype } = file;
                // We'll use the product ID as part of the filename for better organization
                const uploadFilename = `${productData.id}_${originalname}`;
                return uploadBufferToS3(buffer, uploadFilename, mimetype);
            });

            const uploadResults = await Promise.all(uploadPromises);

            // Collect the URLs from the successful uploads
            uploadResults.forEach(result => {
                imageUrls.push(result.url);
            });
        }

        // Add the S3 URLs to the product data
        productData.imageUrls = imageUrls;

        // Call the service with the complete product data, including image URLs
        const product = await addProduct(productData);

        console.log("Product and its variants with image URLs added successfully");
        res.status(201).json({ message: 'Product added successfully', product });

    } catch (error) {
        console.error("Error creating product:", error.message);
        if (error.message.includes("Missing required fields") || error.message.includes("already exists")) {
            return res.status(400).json({ error: error.message });
        }
        if (error instanceof SyntaxError) { // Catches JSON.parse errors
            return res.status(400).json({ error: 'Invalid JSON format for variants or other details.' });
        }
        res.status(500).json({ error: 'Failed to add product', details: error.message });
    }
};


/**
 * Controller to upload a CSV file.
 */
export const uploadCSV = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const importMode = req.body.importMode || 'skip';
        await importCSV(req.file.path, importMode);

        // Clean up the uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting temp CSV file:", err);
            else console.log(`Successfully deleted temp file: ${req.file.path}`);
        });

        res.json({ message: `CSV processed successfully. Check logs for details.` });
    } catch (error) {
        res.status(500).json({ error: "CSV import failed", details: error.message });
    }
};

/**
 * Fetches all products with pagination, including their variants.
 */
export const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [products, totalProducts] = await prisma.$transaction([
            prisma.product.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    variants: true // Include the variants for each product
                }
            }),
            prisma.product.count()
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch products", details: error.message });
    }
};

/**
 * Searches for products by title or ID, with pagination.
 */
export const searchProducts = async (req, res) => {
    try {
        const { query } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        if (!query) {
            return res.status(400).json({ error: "Query parameter is required" });
        }

        const where = {
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { id: { contains: query, mode: 'insensitive' } } // Search by Product ID
            ]
        };

        const [products, totalProducts] = await prisma.$transaction([
            prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    variants: true // Include variants in search results
                }
            }),
            prisma.product.count({ where })
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to search products", details: error.message });
    }
};

/**
 * Fetches products by category string, with pagination.
 */
export const getProductsByCategory = async (req, res) => {
    try {
        // Category is now a string from the URL path, e.g., /api/products/by-category/Electronics
        const { categoryName } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        if (!categoryName) {
            return res.status(400).json({ error: "Category name is required in the URL." });
        }

        const where = {
            category: {
                equals: categoryName,
                mode: 'insensitive'
            }
        };

        const [products, totalProducts] = await prisma.$transaction([
            prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    variants: true // Include variants
                }
            }),
            prisma.product.count({ where })
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch products by category",
            details: error.message,
        });
    }
};


/**
 * Deletes a product and its associated variants.
 */
export const deleteProduct = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: "Product ID is required." });
    }

    try {
        // Thanks to `onDelete: Cascade` in the schema,
        // deleting the product will automatically delete its variants.
        await prisma.product.delete({
            where: { id: id },
        });

        res.status(200).json({ message: `Product with ID ${id} deleted successfully.` });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ error: `Product with ID ${id} not found.` });
        }
        console.error("Error deleting product:", error);
        res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
};


/**
 * Updates a product and its variants.
 * This is a complex operation and has been simplified here.
 * A robust implementation would handle adding, updating, and deleting variants.
 */
export const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { variants, ...productData } = req.body;

    try {
        const updatedProduct = await prisma.$transaction(async (tx) => {
            // Step 1: Update the main product data
            const product = await tx.product.update({
                where: { id: id },
                data: {
                    ...productData,
                    // Ensure Decimal fields are handled correctly if they are updatable
                    ...(productData.price && { price: new Prisma.Decimal(productData.price) }),
                    ...(productData.taxRate && { taxRate: new Prisma.Decimal(productData.taxRate) }),
                },
            });

            // Step 2: Handle variant updates (simplified approach)
            if (variants && Array.isArray(variants)) {
                // Delete existing variants for this product
                await tx.productVariant.deleteMany({
                    where: { productId: id },
                });

                // Create the new set of variants from the request
                const variantsData = variants.map(v => ({
                    size: v.size,
                    quantity: Number(v.quantity),
                    productId: id,
                }));

                await tx.productVariant.createMany({
                    data: variantsData,
                });
            }

            // Step 3: Fetch the final updated product with its new variants
            return tx.product.findUnique({
                where: { id: id },
                include: { variants: true },
            });
        });

        res.status(200).json({ message: `Product with ID ${id} updated successfully.`, product: updatedProduct });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ error: `Product with ID ${id} not found.` });
        }
        console.error("Error updating product:", error);
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
};