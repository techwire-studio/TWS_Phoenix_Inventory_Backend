// File: src/routes/uploadRoutes.js
import express from "express";
import { authenticateAdmin, authenticateSuperAdmin } from "../middleware/authMiddleware.js";
import uploadZip from "../middleware/multerConfigZip.js";
import uploadController, {
    handleZipUpload,
    getAllUploadJobs
} from "../controllers/uploadController.js";
import { upload } from "../config/multer.js";

const router = express.Router();

router.post(
    "/zip",
    authenticateAdmin,
    authenticateSuperAdmin,
    uploadZip.single("zipfile"),
    handleZipUpload
);

router.get("/jobs", authenticateAdmin, getAllUploadJobs);

// Add Multer middleware for CSV upload
router.post(
    "/csv",
    authenticateAdmin,
    upload.single("csvfile"), // Specify the form field name
    uploadController
);

export default router;
