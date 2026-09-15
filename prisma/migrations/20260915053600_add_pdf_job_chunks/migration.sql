-- PdfJobChunk was added to schema.prisma without a migration, so this table was
-- missing from every database. Its absence made GET /api/jobs/[id] return 500
-- (the route includes `chunks`), which silently froze the compile status bar.
--
-- Purely additive: one new empty table, its unique index and its foreign key.

-- CreateTable
CREATE TABLE "pdf_job_chunks" (
    "id" SERIAL NOT NULL,
    "pdf_job_id" INTEGER NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "download_url" TEXT,
    "local_path" TEXT,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_job_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pdf_job_chunks_pdf_job_id_chunk_index_key" ON "pdf_job_chunks"("pdf_job_id", "chunk_index");

-- AddForeignKey
ALTER TABLE "pdf_job_chunks" ADD CONSTRAINT "pdf_job_chunks_pdf_job_id_fkey" FOREIGN KEY ("pdf_job_id") REFERENCES "pdf_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
