// File: src/controllers/uploadController.js

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/db.js';

/**
 * Processes a ZIP file asynchronously.
 * Logs the job to the database, uploads images and the report to S3.
 * @param {string} zipFilePath - Path to the uploaded ZIP file.
 * @param {object} admin - The full admin object from the request.
 * @param {string} originalZipName - The original name of the uploaded zip.
 */
const processZipFile = async (zipFilePath, admin, originalZipName) => {
    const tempDir = path.join('uploads', `unzipped-${Date.now()}`);
    const results = [];
    let job;

    try {
        // 1. Create a record for this job in the database
        job = await prisma.uploadJob.create({
            data: {
                originalZipName: originalZipName,
                status: 'processing',
                uploadedByAdminId: admin.id,
            },
        });

        // 2. Create a temporary directory and unzip the file
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const zip = new AdmZip(zipFilePath);
        zip.extractAllTo(tempDir, true);
        console.log(`Job ${job.id}: Unzipped files to ${tempDir}`);

        const zipEntries = fs.readdirSync(tempDir);
        const imageFiles = zipEntries.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
        console.log(`Job ${job.id}: Found ${imageFiles.length} images to process.`);

        // 3. Process each image file and upload to S3
        for (const filename of imageFiles) {
            const localFilePath = path.join(tempDir, filename);
            let status = 'failed';
            let url = '';
            let errorMessage = '';

            try {
                const mimetype = `image/${path.extname(filename).substring(1)}`;
                const result = await uploadFileToS3(localFilePath, filename, mimetype);
                url = result.url;
                status = 'success';
            } catch (uploadError) {
                errorMessage = uploadError.message;
                console.error(`Job ${job.id}: Failed to upload ${filename}:`, errorMessage);
            }
            results.push({ filename, url, status, error_message: errorMessage });
        }

        // 4. Create the CSV report locally first
        const csvFilename = `report-${job.id}-${Date.now()}.csv`;
        const csvPath = path.join('uploads', csvFilename);
        const csvWriter = createObjectCsvWriter({
            path: csvPath,
            header: [
                { id: 'filename', title: 'FILENAME' },
                { id: 'url', title: 'URL' },
                { id: 'status', title: 'STATUS' },
                { id: 'error_message', title: 'ERROR' },
            ],
        });
        await csvWriter.writeRecords(results);
        console.log(`Job ${job.id}: CSV report created at ${csvPath}`);

        // 5. Upload the CSV report to a 'reports' folder in S3
        const reportUploadResult = await uploadFileToS3(
            csvPath,
            `reports/${csvFilename}`, // The key in S3 includes the folder
            'text/csv'
        );
        console.log(`Job ${job.id}: CSV report uploaded to S3 at ${reportUploadResult.url}`);

        // 6. Update the job record in the database with the final status and report URL
        await prisma.uploadJob.update({
            where: { id: job.id },
            data: {
                status: 'completed',
                reportCsvUrl: reportUploadResult.url,
            },
        });

        // 7. Email a notification with the S3 link to the report
        await sendZipReportEmail({
            recipientEmail: admin.email,
            reportUrl: reportUploadResult.url,
            originalZipName: originalZipName,
        });

    } catch (error) {
        console.error(`Job ${job?.id || 'N/A'}: An error occurred during ZIP processing:`, error);
        // If the job was created, update its status to 'failed'
        if (job) {
            await prisma.uploadJob.update({
                where: { id: job.id },
                data: { status: 'failed' },
            });
        }
    } finally {
        // 8. Clean up all temporary local files
        fs.unlink(zipFilePath, (err) => {
            if (err) console.error(`Failed to delete zip file: ${zipFilePath}`, err);
        });
        fs.rm(tempDir, { recursive: true, force: true }, (err) => {
            if (err) console.error(`Failed to delete temp directory: ${tempDir}`, err);
        });
        // The local CSV report is now deleted by the mailer function, so we don't need to do it here.
    }
};

/**
 * Controller to handle the initial ZIP file upload request.
 */
export const handleZipUpload = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No ZIP file uploaded.' });
    }

    // Pass the full admin object and original filename to the background process
    const admin = req.admin;
    const originalZipName = req.file.originalname;

    if (!admin || !admin.id) {
        return res.status(500).json({ error: 'Could not identify admin user.' });
    }

    res.status(202).json({
        message: 'File received. The ZIP file is being processed. You will receive an email notification with a link to the report once completed.',
        filename: originalZipName,
    });

    processZipFile(req.file.path, admin, originalZipName);
};

/**
 * Fetches a list of all upload jobs for the admin dashboard.
 */
export const getAllUploadJobs = async (req, res) => {
    try {
        const jobs = await prisma.uploadJob.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            // Include the name and email of the admin who uploaded it
            include: {
                uploadedByAdmin: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });
        res.status(200).json(jobs);
    } catch (error) {
        console.error('Failed to fetch upload jobs:', error);
        res.status(500).json({ error: 'Could not fetch upload jobs.' });
    }
};

const uploadController = async (req, res) => {
    console.log("CSV upload request received");
    console.log("Request file:", req.file ? req.file.originalname : "No file uploaded");
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded.' });
  }

  const filePath = req.file.path;
  const products = [];

  try {
    // 1. Read and parse the CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Parse and push into array
          products.push({
            id: row.id,
            title: row.title,
            description: row.description || null,
            imageUrls: row.imageUrls ? row.imageUrls.split(';').map(url => url.trim()) : [],
            category: row.category,
            subCategory: row.subCategory || null,
            price: new Decimal(row.price),
            taxRate: row.taxRate ? new Decimal(row.taxRate) : null,
            chargeTax: row.chargeTax === 'true',
            dimensions: row.dimensions ? JSON.parse(row.dimensions) : null,
            weight: row.weight ? JSON.parse(row.weight) : null,
            otherDetails: row.otherDetails ? JSON.parse(row.otherDetails) : null,
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 2. Bulk insert using Prisma
    const createdProducts = await prisma.product.createMany({
      data: products,
      skipDuplicates: true,
    });

    res.status(200).json({
      message: `${createdProducts.count} products inserted successfully.`,
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: 'Failed to process the CSV file.' });
  } finally {
    // Clean up
    fs.unlink(filePath, () => {});
  }
};

export default uploadController;
