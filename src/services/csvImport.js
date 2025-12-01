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
 * Base fields belonging to products (not otherDetails)
 */
const PRODUCT_BASE_COLUMNS = new Set([
    "id",
    "title",
    "description",
    "imageUrls",
    "category",
    "subCategory",
    "price",
    "taxRate",
    "chargeTax",

    // Dimensions standard columns
    "dimension_height",
    "dimension_width",
    "dimension_depth",

    // Weight standard columns
    "weight_value",
    "weight_unit",

    // Variant fields
    "size",
    "quantity"
]);

/**
 * Imports products and variants from CSV.
 */
async function importCSV(filePath, importMode = "skip") {
    console.time("Total CSV Import Time");
    const productsMap = new Map();

    // 1. Parse CSV
    console.time("CSV Parsing and Grouping");
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on("data", (row) => {
                const productId = parseStringOrNull(row.id);
                if (!productId) return;

                // Initialize product if first time seen
                if (!productsMap.has(productId)) {
                    const productEntry = {
                        id: productId,
                        title: parseStringOrNull(row.title),
                        description: parseStringOrNull(row.description),
                        imageUrls:
                            parseStringOrNull(row.imageUrls)
                                ?.split(",")
                                .map((u) => u.trim()) || [],
                        category: parseStringOrNull(row.category),
                        subCategory: parseStringOrNull(row.subCategory),
                        price: parseNumberOrNull(row.price),
                        taxRate: parseNumberOrNull(row.taxRate),
                        chargeTax: parseStringOrNull(row.chargeTax)?.toLowerCase() === "true",

                        // Build JSON objects from flattened columns
                        dimensions: {
                            height: parseNumberOrNull(row.dimension_height),
                            width: parseNumberOrNull(row.dimension_width),
                            depth: parseNumberOrNull(row.dimension_depth)
                        },

                        weight: {
                            value: parseNumberOrNull(row.weight_value),
                            unit: parseStringOrNull(row.weight_unit)
                        },

                        // Any unknown columns go here
                        otherDetails: {},

                        variants: []
                    };

                    // Detect all "otherDetails" fields automatically
                    for (const col of Object.keys(row)) {
                        if (!PRODUCT_BASE_COLUMNS.has(col)) {
                            const cleanedValue = parseStringOrNull(row[col]);
                            if (cleanedValue !== null) {
                                productEntry.otherDetails[col] = cleanedValue;
                            }
                        }
                    }

                    productsMap.set(productId, productEntry);
                }

                // Handle variants
                const variant = {
                    size: parseStringOrNull(row.size),
                    quantity: parseInt(row.quantity, 10)
                };

                if (variant.size && !isNaN(variant.quantity)) {
                    productsMap.get(productId).variants.push(variant);
                }
            })
            .on("end", resolve)
            .on("error", reject);
    });
    console.timeEnd("CSV Parsing and Grouping");

    console.log(`Parsed ${productsMap.size} products from CSV.`);

    // 2. Check existing products
    const productsToCreate = [];
    const productsToUpdate = [];

    const csvIds = [...productsMap.keys()];
    const existingProducts = await prisma.product.findMany({
        where: { id: { in: csvIds } },
        select: { id: true }
    });
    const existingIds = new Set(existingProducts.map((p) => p.id));

    for (const [id, data] of productsMap.entries()) {
        if (existingIds.has(id)) productsToUpdate.push(data);
        else productsToCreate.push(data);
    }

    // 3. DB write operations
    console.time("Database Write Time");

    // CREATE
    for (const product of productsToCreate) {
        await prisma.product.create({
            data: {
                id: product.id,
                title: product.title,
                description: product.description,
                imageUrls: product.imageUrls,
                category: product.category,
                subCategory: product.subCategory,
                price: product.price ? new Prisma.Decimal(product.price) : null,
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
    }

    // UPDATE
    if (importMode === "overwrite") {
        for (const product of productsToUpdate) {
            await prisma.$transaction(async (tx) => {
                await tx.productVariant.deleteMany({
                    where: { productId: product.id }
                });

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
    } else {
        console.log(`Skipped updating ${productsToUpdate.length} products (mode=skip).`);
    }

    console.timeEnd("Database Write Time");
    console.timeEnd("Total CSV Import Time");

    return true;
}

export default importCSV;
