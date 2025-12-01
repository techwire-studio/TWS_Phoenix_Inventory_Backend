import express from "express";
import multer from "multer";
import {
    createProduct,
    uploadCSV,
    getAllProducts,
    searchProducts,
    getProductsByCategory,
    deleteProduct,
    getProductById,
    updateProduct
} from "../controllers/productController.js";
import { authenticateAdmin, authenticateSuperAdmin } from "../middleware/authMiddleware.js";

// Import the new middleware for handling image uploads
import uploadImages from "../middleware/multerConfigImages.js";

const router = express.Router();

// This multer instance is specifically for the CSV upload
const uploadCsv = multer({ dest: "uploads/" });

// --- Admin/Super Admin Routes ---

// Create a new product (manual entry with optional images)
// This route now uses the new middleware to accept up to 3 image files
router.post(
    "/add-product",
    authenticateAdmin,
    authenticateSuperAdmin,
    uploadImages.array("images", 3), // Expects a field named 'images', max 3 files
    createProduct
);

// Upload a CSV of products
router.post(
    "/upload",
    authenticateAdmin,
    authenticateSuperAdmin,
    uploadCsv.single("file"),
    uploadCSV
);

// Delete a product by its ID
router.delete("/:id", authenticateAdmin, authenticateSuperAdmin, deleteProduct);

// Update a product by its ID
// Note: We can add image handling to the update route later if needed.
// For now, it will only update text/JSON data.
router.put("/:id", authenticateAdmin, authenticateSuperAdmin, updateProduct);

// --- Public Routes ---

// Get all products with pagination
router.get("/all-products", getAllProducts);
router.get("/:id", getProductById);

// Search for products by title or ID
router.get("/search", searchProducts);

// Get products by a specific category name
// e.g., /api/products/by-category/Electronics
router.get("/by-category/:categoryName", getProductsByCategory);

export default router;
