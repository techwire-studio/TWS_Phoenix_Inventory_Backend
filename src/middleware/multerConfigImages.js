// File: src/middleware/multerConfigImages.js

import multer from "multer";

// Use memory storage to hold the file as a buffer before uploading to S3
const storage = multer.memoryStorage();

// Filter to allow only specific image file types
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "image/jpg"
    ) {
        cb(null, true); // Accept the file
    } else {
        cb(
            new multer.MulterError(
                "LIMIT_UNEXPECTED_FILE",
                "Invalid file type. Only JPG, JPEG, and PNG are allowed."
            ),
            false
        ); // Reject the file
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5 MB file size limit per image
    },
    fileFilter: fileFilter
});

export default upload;
