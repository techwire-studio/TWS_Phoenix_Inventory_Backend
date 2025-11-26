// File: src/services/s3Service.js

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Checks if an object with the given key already exists in the S3 bucket.
 * @param {string} key - The key (filename) of the object in S3.
 * @returns {Promise<boolean>} - True if the object exists, false otherwise.
 */
async function objectExists(key) {
    try {
        await s3Client.send(new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        }));
        return true;
    } catch (error) {
        if (error.name === 'NotFound') {
            return false;
        }
        // Re-throw other errors
        throw error;
    }
}

/**
 * Generates a unique key for an object in S3, adding a suffix if the original key exists.
 * @param {string} originalKey - The desired original key (filename).
 * @returns {Promise<string>} - A unique key for S3.
 */
async function generateUniqueKey(originalKey) {
    let key = originalKey;
    let counter = 1;
    const { name, ext } = path.parse(key);

    while (await objectExists(key)) {
        key = `${name}(${counter})${ext}`;
        counter++;
    }
    return key;
}

/**
 * Uploads a file buffer to S3.
 * @param {Buffer} fileBuffer - The buffer of the file to upload.
 *
 * @param {string} originalFilename - The original name of the file.
 * @param {string} mimetype - The MIME type of the file (e.g., 'image/jpeg').
 * @returns {Promise<{url: string, key: string}>} - The public URL and the key of the uploaded file.
 */
export const uploadBufferToS3 = async (fileBuffer, originalFilename, mimetype) => {
    const uniqueKey = await generateUniqueKey(originalFilename);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: uniqueKey,
        Body: fileBuffer,
        ContentType: mimetype,
    });

    try {
        await s3Client.send(command);
        const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueKey}`;
        console.log(`Successfully uploaded ${originalFilename} to S3 as ${uniqueKey}`);
        return { url, key: uniqueKey };
    } catch (error) {
        console.error(`Error uploading ${originalFilename} to S3:`, error);
        throw error;
    }
};

/**
 * Uploads a file from the local filesystem to S3.
 * @param {string} localFilePath - The local path of the file to upload.
 * @param {string} uploadFilename - The desired filename in S3.
 * @param {string} mimetype - The MIME type of the file.
 * @returns {Promise<{url: string, key: string}>} - The public URL and key of the uploaded file.
 */
export const uploadFileToS3 = async (localFilePath, uploadFilename, mimetype) => {
    const fileStream = fs.createReadStream(localFilePath);
    return uploadBufferToS3(fileStream, uploadFilename, mimetype);
};