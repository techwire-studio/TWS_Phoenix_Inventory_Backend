// File: src/middleware/multerConfigZip.js

import multer from 'multer';
import path from 'path';

// Use disk storage to temporarily save the zip file before processing
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Save to the 'uploads/' directory. Ensure this directory exists.
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Use a unique filename to avoid conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter to allow only zip files
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        cb(null, true); // Accept the file
    } else {
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type. Only ZIP files are allowed.'), false); // Reject the file
    }
};

const uploadZip = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 50 // 50 MB file size limit for the zip file
    },
    fileFilter: fileFilter
});

export default uploadZip;