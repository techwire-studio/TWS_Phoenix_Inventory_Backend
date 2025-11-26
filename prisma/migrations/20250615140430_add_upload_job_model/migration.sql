-- CreateTable
CREATE TABLE "UploadJob" (
    "id" SERIAL NOT NULL,
    "originalZipName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reportCsvUrl" TEXT,
    "uploadedByAdminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UploadJob" ADD CONSTRAINT "UploadJob_uploadedByAdminId_fkey" FOREIGN KEY ("uploadedByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
