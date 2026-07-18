# Phase 2 Plan: VDP Engine Integration & Optimization

Following the successful migration of the database schema and database-level synchronization engine in Phase 1, Phase 2 focuses on upgrading the frontend Template Editor, implementing robust dynamic roster validation, optimizing print queues, and eventually deprecating the legacy JSON columns.

---

## 1. Upgrade the Canvas Template Editor
**Objective:** Transition the visual editor at `/dashboard/templates` to perform direct CRUD on `TemplateField` records rather than manipulating a serialized JSON string.

*   **Action Items:**
    *   [ ] Refactor the frontend state in the canvas template editor to use a normalized structure corresponding to the `TemplateField` model.
    *   [ ] Create endpoint wrappers/hooks to handle individual field coordinates updates on drag-end.
    *   [ ] Add batch-save transactions to update multiple coordinate rows on the database when the user clicks "Save Layout".
    *   [ ] Ensure backward-compatibility fallback handles local edits smoothly in offline/desktop mode.

---

## 2. Implement Dynamic Roster Validation Engine
**Objective:** Replace hardcoded CSV/Excel parsing and generic Zod schemas with a dynamic validation system matched directly against database constraints.

*   **Action Items:**
    *   [ ] Build a column-mapping UI helper that lets users select how imported Excel headers map to template field definitions (e.g., matching "Name" or "Student Name" to the core `name` field).
    *   [ ] Implement dynamic Zod validation generators that build validator schemas at runtime using database-defined `TemplateField` validations (e.g., checks for `isRequired`, maximum field length, and matching data types).
    *   [ ] Provide a clean user interface reporting validation errors per-row (e.g., "Row 15: Missing required field 'Blood Group'").

---

## 3. Print Processing Queue & Batch Optimization
**Objective:** Harden the rendering queue in the print engine for high-volume jobs to prevent server-side CPU spikes and query latency.

*   **Action Items:**
    *   [ ] Optimize the batch query layer using SQL joins in Prisma to fetch all `CardholderValue` and `TemplateField` records in a single round-trip before rendering.
    *   [ ] **Print/Approval Sheet Size Configuration & Dropdown:**
        *   When starting a print job (Production or Approval), add a **Sheet Size dropdown selector** with options:
            *   `A4` (210.0mm × 297.0mm)
            *   `A3` (297.0mm × 420.0mm)
            *   `SRA3` (320.0mm × 450.0mm)
            *   `13 × 19 inch` (330.2mm × 482.6mm)
            *   `Custom Sheet Size` (enables inputs for width and height in mm).
        *   **Default Sheet Size by Category:** Set the default sheet selection based on the template category:
            *   *ID Card, Badge, Label, Tag, Sticker, Visitor Pass:* Defaults to `SRA3` or `13 × 19 inch` (sheet printing).
            *   *Certificate, Letter:* Defaults to `A4` (usually printed 1-up on A4 sheets).
            *   *Ticket, Card:* Defaults to `A3` (for multiple-up card printing).
            *   *Other:* Defaults to `A4`.
        *   **Proportionate Grid Compilation:**
            *   Modify the PDF compile engine (e.g. PDFKit / Puppeteer PDF generator) to read the selected Sheet Size dimensions.
            *   Perform automatic grid calculations to fit cards/templates:
                *   `columns = Math.floor((sheetWidth - margins) / (cardWidth + horizontalGap))`
                *   `rows = Math.floor((sheetHeight - margins) / (cardHeight + verticalGap))`
            *   Tile cards proportionally onto the PDF page grid layout based on the calculated columns and rows, inserting page breaks automatically.
        *   **Pre-Print Validation Flow (runs in order before generation starts):**
            *   **Step 1 — Missing Field Check:**
                *   Before anything else, scan **every cardholder record** in the batch and cross-reference their filled values against all `TemplateField` records marked as required.
                *   Collect a list of all records with missing or empty required field values.
                *   If **any records have missing fields**, block print and show a validation report modal:
                    > ⚠️ **Missing Data Detected**
                    > **{n} record(s)** have incomplete required fields. Fix them before printing.

                    | # | Cardholder Name | Missing Fields |
                    |---|---|---|
                    | 3 | John Doe | Photo, ID Number |
                    | 7 | Jane Smith | Department |

                *   The modal provides two action options:
                    *   **"Fix Records"** — Closes modal and takes the user to the cardholder data list, highlighting the flagged records in red.
                    *   **"Skip & Print Anyway"** — Allows proceeding with missing fields left blank in the PDF (shows a warning label on those cards in the final PDF output).
            *   **Step 2 — Empty Slot Check:**
                *   After passing field validation (or the user has chosen to skip), pre-calculate `totalSlots` vs `totalCards`.
                *   If `totalSlots > totalCards`, show the empty slot strategy modal (see above options).
                *   If `totalSlots === totalCards`, skip the modal entirely.
            *   **Step 3 — Generation Proceeds** once both checks are resolved.





    *   [ ] Implement a lightweight job status queue (using database polling or Upstash Redis) that updates progress bar values in the UI (e.g., "Generating PDF: 45% complete").
    *   [ ] Integrate localized print queue scheduling for the Electron Desktop Client to stream buffers directly to local drives without memory leaks.


---

## 4. Database Cleanup & Column Deprecation
**Objective:** Safely decommission legacy JSON fields to ensure schema cleanliness.

*   **Action Items:**
    *   [ ] Add migration scripts to drop `frontFields`, `backFields` in the `CardTemplate` table, and `customFields` in the `Cardholder` table after verifying Phase 2 UI and validation runs correctly.
    *   [ ] Remove unused legacy JSON parsing helpers from utility functions.

---

## 5. Template Categories & Smart Fields
**Objective:** Introduce a `category` field for templates (defaulting to `OTHER` if omitted or unset) to classify templates by document type, and suggest smart/typical variable fields dynamically in the Template Editor.

*   **Action Items:**
    *   [ ] **Database Schema Update:** 
        *   Add `category` (string, default `"OTHER"`) to the `CardTemplate` model in `prisma/schema.prisma`.
        *   Add `sides` (Int, default 1) to the `CardTemplate` model to track single-sided (1) vs double-sided (2) templates.
        *   **Multi-Client Assignment Schema:** Create a join model `TemplateClientAssignment` to allow assigning a template to multiple clients:
            ```prisma
            model TemplateClientAssignment {
              id         Int          @id @default(autoincrement())
              templateId Int          @map("template_id")
              template   CardTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
              clientId   Int          @map("client_id")
              client     Client       @relation(fields: [clientId], references: [id], onDelete: Cascade)

              @@unique([templateId, clientId])
              @@map("template_client_assignments")
            }
            ```
    *   [ ] **Request Validation Update:** Update `templateSchema` in `src/lib/schemas.ts` to include:
        *   The `category` field with allowed enums: `ID_CARD`, `CERTIFICATE`, `BADGE`, `LABEL`, `TICKET`, `VISITOR_PASS`, `LETTER`, `CARD`, `TAG`, `STICKER`, `OTHER`.
        *   The `sides` field (integer, allowed values `1` or `2`, default `1`).
        *   The `clientIds` field (array of integers) to save assignments in bulk.
    *   [ ] **API Route Implementation:**
        *   Update POST and PUT handlers in `/api/templates` to process and synchronize client assignments in the `TemplateClientAssignment` table.
        *   Update GET handlers in `/api/templates` to return the assigned client IDs for each template.
    *   [ ] **Frontend Category Selector, Default Dimensions & Badges:**
        *   Add a category selection dropdown in the template creation modal/settings, defaulting to "Other".
        *   **Multi-Client Assignment UI:** Replace the single client dropdown with a multi-select client picker labeled **"Assign to Clients"** (listing all clients of the press, letting the user check/uncheck multiple clients).
        *   **Sides Selection Toggle:** Add a radio toggle in the template creation form asking: **"Sides: Single-Sided (1 Side)"** or **"Double-Sided (2 Sides)"**.
            *   If **Single-Sided (1 Side)** is selected: Hide the file upload input for the back background template.
            *   If **Double-Sided (2 Sides)** is selected: Require background template uploads for both Front and Back sides.
        *   **Default Dimensions mapping (at 300 DPI / mm equivalent):** When a user selects a category, automatically populate the default width and height inputs with both pixel and millimeter presets.
        *   **Millimeter (mm) Two-Way Input Binding:**
            *   Add dual input fields in the template creation form: Width (px/mm) and Height (px/mm).
            *   Implement live two-way synchronization:
                *   Changing pixels calculates mm: `mm = (px * 25.4) / 300` (rounded to 1 decimal place).
                *   Changing mm calculates pixels: `px = Math.round((mm * 300) / 25.4)`.
        *   Display color-coded badges on templates in the dashboard based on their category.
        *   Add tabs or filter dropdowns on `/dashboard/templates` to view templates by category and assigned client.
    *   [ ] **Client Portal Link Template Filter:**
        *   On the Client Page (`/dashboard/clients`), update the **"Create Portal Link"** (Client Portal Share) dialog.
        *   In the Template dropdown list, filter options dynamically to **only display templates assigned to that specific client** (via `TemplateClientAssignment`).


    *   [ ] **Smart Suggestion Helper:** In the Template Editor coordinate config side panel, show standard recommended fields based on the selected category:
        *   *ID Card:* Photo, Name, ID Number, Department, QR Code
        *   *Certificate:* Name, Course, Grade, Date, Signature
        *   *Badge:* Name, Role, Company, QR Code
        *   *Label:* Product Name, Barcode, Batch, Price
        *   *Ticket:* Name, Seat, Date, QR Code
        *   *Visitor Pass:* Name, Company, Validity, QR Code
        *   *Letter:* Name, Address, Account Number
        *   *Card:* Name, Membership ID, Expiry
        *   *Tag:* Serial Number, Barcode, QR Code
        *   *Sticker:* Product Code, Batch, QR Code
        *   *Other:* (No automatic suggests; custom fields only)
    *   [ ] **Migration Script:** Create a simple script to default any existing templates to `OTHER` or check their name keywords to guess their initial category (e.g., if name contains "certificate", set to `CERTIFICATE`; if name contains "badge", set to `BADGE`, else default to `ID_CARD`/`OTHER`).
        *   Set `sides: 2` if an existing template has a non-null `backImageUrl`, otherwise set `sides: 1`.


---

## 6. Template Marketplace & Starter Templates
**Objective:** Allow presses to publish their templates with mapped layouts to a public marketplace for others to purchase using credits, featuring social options like likes and content reports.

*   **Action Items:**
    *   [ ] **Database Schema Expansion:**
        *   Extend `Press` in `prisma/schema.prisma` with:
            *   `promoCredits` (Int, default 0) @map("promo_credits") - Track free promotional/trial credits.
        *   Extend `CardTemplate` in `prisma/schema.prisma` with:
            *   `isPublic` (Boolean, default false) - Whether listed on the marketplace.
            *   `price` (Int, default 0) - Credit price set by the seller.
            *   `likes` (Int, default 0) - Likes counter.
            *   `reports` (Int, default 0) - Reports counter.
            *   `cdrFileUrl` (String, optional) @map("cdr_file_url") - Link to attached CorelDRAW file.
            *   `aiFileUrl` (String, optional) @map("ai_file_url") - Link to attached Adobe Illustrator file.
            *   `psdFileUrl` (String, optional) @map("psd_file_url") - Link to attached Photoshop file.
            *   `pdfFileUrl` (String, optional) @map("pdf_file_url") - Link to attached print-ready PDF template source file.
    *   [ ] **Promo vs. Paid Credit Handling & Job Costs:**
        *   When a press signs up, set `promoCredits` to 1000 and `credits` (paid) to 0.
        *   **Print Generation Credit Costs:**
            *   *Production PDF Cost (Per Category):* Super Admin configures the credit cost for generating a production PDF **per category** (stored in `SystemSetting` keys, e.g., `cost_production_ID_CARD = 1`, `cost_production_CERTIFICATE = 5`, etc.).
            *   *Approval PDF Cost (Universal):* Super Admin configures **a single universal flat credit cost** for generating approval/draft PDFs across all categories (stored in `SystemSetting` under key `cost_approval_universal`, e.g., default `0` or `1` credit).
        *   For print processing PDF generation, consumption logic calculates total cost (cost per card * card count), checks, and deducts from `promoCredits` first, then remaining from `credits`.
        *   For template purchases in the marketplace, **only paid `credits` can be spent** (i.e. validation rejects purchase if `Press.credits < template.price`, ignoring `promoCredits`).

    *   [ ] **Seller Publish Action & Listing Fee:**
        *   Super Admin sets the public template listing fee (stored in `SystemSetting` table under key `marketplace_listing_fee`, e.g., default `50` credits).
        *   Add a "Sell Template" option on templates.
        *   Prompt user to configure a pricing model (credits required to duplicate) and attach raw design source files (`.cdr`, `.ai`, `.pdf`, `.psd`).
        *   Before publishing, verify user has enough total/available credits to pay the `marketplace_listing_fee`.
        *   Deduct the listing fee credits from the seller press, mark template as public, and save the source file URLs.
    *   [ ] **Marketplace/Starter Templates Library UI & Advanced Filters:**
        *   Build a "Starter Templates" view in the dashboard where presses can browse publicly shared templates.
        *   Display credit prices, name, background preview, category, total likes, and indicators showing which source files (`CDR`, `AI`, `PDF`, `PSD`) are included.
        *   Implement **Like** and **Report** buttons on each template card.
        *   **Advanced Filtering Controls:**
            *   *Category Filter:* Filter by template category/document type (e.g., ID Card, Certificate, Label).
            *   *File Format Filter:* Filter by available raw design source attachments (e.g., show only templates containing `CorelDRAW (.cdr)` or `Illustrator (.ai)` source files).
            *   *Fields Included Filter:* Filter templates by whether they map specific field types (e.g., show only templates with `Barcode`, `QR Code`, or `Photo` fields).
            *   *Cost Filter:* Toggle between "Free" (0 credits) and "Paid", or sort templates by price (Low to High / High to Low).

    *   [ ] **API Transaction for Purchases:**
        *   Implement a POST endpoint `/api/templates/purchase` that:
            1. Verifies the buyer press has enough paid credits (`Press.credits >= template.price`).
            2. Deducts the credits from the buyer press.
            3. Adds the credits to the seller press.
            4. Clones the template layout (background images, dimensions, source file URLs) and maps all associated `TemplateField` records to the new buyer press.
    *   [ ] **Purchased Template Downloads & Security Gateway:**
        *   **Raw Link Masking:** In the Template creation, editing, and listing UIs, never expose or display the direct cloud/S3/local storage links where files are saved. Show only friendly indicators (e.g. "CorelDRAW File Attached" status indicators or file-type icons) instead of the actual storage URLs.
        *   **Secure Download Gateway:** Implement a GET endpoint `/api/templates/download?templateId={id}&format={cdr|ai|pdf|psd}`.
            *   This gateway verifies the calling press actually owns or has purchased the template.
            *   It dynamically retrieves the file URL internally from the database and streams or redirects to the file with signed headers, ensuring the raw URL is never exposed to public view or browser inspect tools.
        *   Once purchased, enable download buttons pointing to this gateway for the attached raw design source files (`.cdr`, `.ai`, `.pdf`, `.psd`) inside the buyer's template view.
        *   **Automatic Purchase-triggered Downloads:** When the purchase API completes successfully, the client application will automatically trigger downloads from the secure gateway for all attached source files:
            *   *Web Portal:* Triggers native browser download prompts/links for each available file format using the secure gateway endpoint.
            *   *Electron Desktop Client:* Automatically downloads the files via the secure gateway in the background and saves them directly to the user's local `Downloads/IDexo` directory, showing a toast notification when finished.


    *   [ ] **Super Admin Moderation Control:**
        *   Add `isModerated` (Boolean, default false) to the `CardTemplate` model in `prisma/schema.prisma` to allow administrative hide/suspension.
        *   Build a **Template Moderation** tab inside the Super Admin panel (`/super-admin`).
        *   Display all template listings in a list, sorted by high report counts first.
        *   Implement **Hide/Unhide** toggles (setting `isModerated` to true/false) and **Delete** buttons on the admin dashboard.
        *   Filter out any templates where `isModerated: true` from the public "Starter Templates" marketplace feed for regular presses.





