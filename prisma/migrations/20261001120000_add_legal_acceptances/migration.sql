-- Evidence of agreement to a specific version of a specific legal document.
CREATE TABLE "legal_acceptances" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "document_slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "guardian_name" TEXT,
    "guardian_relation" TEXT,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- A retried or double-submitted form must not create a second acceptance.
CREATE UNIQUE INDEX "legal_acceptances_subject_type_subject_id_document_slug_ver_key"
    ON "legal_acceptances"("subject_type", "subject_id", "document_slug", "version");

CREATE INDEX "legal_acceptances_press_id_subject_type_subject_id_idx"
    ON "legal_acceptances"("press_id", "subject_type", "subject_id");

CREATE INDEX "legal_acceptances_document_slug_version_idx"
    ON "legal_acceptances"("document_slug", "version");

ALTER TABLE "legal_acceptances"
    ADD CONSTRAINT "legal_acceptances_press_id_fkey"
    FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;
