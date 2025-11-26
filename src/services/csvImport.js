// File: src/services/csvImport.js

import fs from "fs";
import csv from "csv-parser";
import prisma from "../config/db.js";
import { Prisma } from "@prisma/client";

/**
 * Parses a string value and returns null if it's empty, otherwise returns the trimmed string.
 * @param {string} value - The string to parse.
 * @returns {string|null}
 */
const parseStringOrNull = (value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed !== "" ? trimmed : null;
};

/**
 * Parses a string value and returns null if it's empty or invalid, otherwise returns the number.
 * @param {string} value - The string to parse.
 * @returns {number|null}
 */
const parseNumberOrNull = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
};

/**
 * Imports products and their variants from a CSV file.
 * Assumes one row per product variant.
 * @param {string} filePath - The path to the CSV file.
 * @param {string} importMode - 'overwrite' or 'skip'.
 */
async function importCSV(filePath, importMode = "skip") {
    console.time("Total CSV Import Time");
    const productsMap = new Map();

    // 1. Parse the CSV and group rows by product ID
    console.time("CSV Parsing and Grouping");
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on("data", (row) => {
                const productId = parseStringOrNull(row.id);
                if (!productId) {
                    // Skip rows without a product ID
                    return;
                }

                // If we haven't seen this product ID yet, create its main entry
                if (!productsMap.has(productId)) {
                    productsMap.set(productId, {
                        id: productId,
                        title: parseStringOrNull(row.title),
                        description: parseStringOrNull(row.description),
                        // Split by comma and trim whitespace from each URL
                        imageUrls:
                            parseStringOrNull(row.imageUrls)
                                ?.split(",")
                                .map((url) => url.trim()) || [],
                        category: parseStringOrNull(row.category),
                        subCategory: parseStringOrNull(row.subCategory),
                        price: parseNumberOrNull(row.price),
                        taxRate: parseNumberOrNull(row.taxRate),
                        chargeTax: parseStringOrNull(row.chargeTax)?.toLowerCase() === "true",
                        dimensions: parseStringOrNull(row.dimensions)
                            ? JSON.parse(row.dimensions)
                            : null,
                        weight: parseStringOrNull(row.weight) ? JSON.parse(row.weight) : null,
                        otherDetails: parseStringOrNull(row.otherDetails)
                            ? JSON.parse(row.otherDetails)
                            : null,
                        variants: []
                    });
                }

                // Add the variant from this row to the corresponding product
                const variant = {
                    size: parseStringOrNull(row.size),
                    quantity: parseInt(row.quantity, 10)
                };

                // Only add variant if it's valid
                if (variant.size && !isNaN(variant.quantity)) {
                    productsMap.get(productId).variants.push(variant);
                }
            })
            .on("end", resolve)
            .on("error", reject);
    });
    console.timeEnd("CSV Parsing and Grouping");
    console.log(`Parsed and grouped ${productsMap.size} unique products from CSV.`);

    // 2. Prepare data for database insertion
    const productsToCreate = [];
    const productsToUpdate = [];
    const productIdsFromCsv = Array.from(productsMap.keys());

    // Find which products from the CSV already exist in the database
    const existingDbProducts = await prisma.product.findMany({
        where: { id: { in: productIdsFromCsv } },
        select: { id: true }
    });
    const existingDbProductIds = new Set(existingDbProducts.map((p) => p.id));

    // Segregate products into create/update lists
    for (const [productId, productData] of productsMap.entries()) {
        if (existingDbProductIds.has(productId)) {
            // This product exists, add to update list
            productsToUpdate.push(productData);
        } else {
            // This is a new product, add to create list
            productsToCreate.push(productData);
        }
    }

    // 3. Perform database operations
    console.time("Database Write Time");

    // --- CREATE new products ---
    if (productsToCreate.length > 0) {
        console.log(`Creating ${productsToCreate.length} new products...`);
        for (const product of productsToCreate) {
            await prisma.product.create({
                data: {
                    id: product.id,
                    title: product.title,
                    description: product.description,
                    imageUrls: product.imageUrls,
                    category: product.category,
                    subCategory: product.subCategory,
                    price: new Prisma.Decimal(product.price),
                    taxRate: product.taxRate ? new Prisma.Decimal(product.taxRate) : null,
                    chargeTax: product.chargeTax,
                    dimensions: product.dimensions || Prisma.JsonNull,
                    weight: product.weight || Prisma.JsonNull,
                    otherDetails: product.otherDetails || Prisma.JsonNull,
                    variants: {
                        create: product.variants // Create variants simultaneously
                    }
                }
            });
        }
    }

    // --- UPDATE existing products ---
    if (productsToUpdate.length > 0) {
        if (importMode === "skip") {
            console.log(
                `Skipping ${productsToUpdate.length} existing products as per 'skip' mode.`
            );
        } else if (importMode === "overwrite") {
            console.log(`Overwriting ${productsToUpdate.length} existing products...`);
            for (const product of productsToUpdate) {
                await prisma.$transaction(async (tx) => {
                    // First, delete old variants to ensure a clean slate
                    await tx.productVariant.deleteMany({
                        where: { productId: product.id }
                    });
                    // Then, update the product and create the new variants
                    await tx.product.update({
                        where: { id: product.id },
                        data: {
                            title: product.title,
                            description: product.description,
                            imageUrls: product.imageUrls,
                            category: product.category,
                            subCategory: product.subCategory,
                            price: new Prisma.Decimal(product.price),
                            taxRate: product.taxRate ? new Prisma.Decimal(product.taxRate) : null,
                            chargeTax: product.chargeTax,
                            dimensions: product.dimensions || Prisma.JsonNull,
                            weight: product.weight || Prisma.JsonNull,
                            otherDetails: product.otherDetails || Prisma.JsonNull,
                            variants: {
                                create: product.variants
                            }
                        }
                    });
                });
            }
        }
    }

    console.timeEnd("Database Write Time");
    console.timeEnd("Total CSV Import Time");
    return true;
}

export default importCSV;
