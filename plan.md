# Phase 2 Plan: VDP Engine Integration & Optimization

Following the successful migration of the database schema and database-level synchronization engine in Phase 1, Phase 2 focuses on upgrading the frontend Template Editor, implementing robust dynamic roster validation, optimizing print queues, and eventually deprecating the legacy JSON columns.

---

## 1. Upgrade the Canvas Template Editor
**Objective:** Transition the visual editor at `/dashboard/templates` to perform direct CRUD on `TemplateField` records rather than manipulating a serialized JSON string.

> **⚠️ Prerequisite — Schema Gap:** `TemplateField` and `CardholderValue` models do **not yet exist** in `prisma/schema.prisma`. Both must be created before any frontend refactor begins.

### 1a. Database Schema — Add `TemplateField` & `CardholderValue` ✅ COMPLETE

```prisma
model TemplateField {
  id          Int          @id @default(autoincrement())
  templateId  Int          @map("template_id")
  template    CardTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  field       String       // "name" | "roll_number" | "photo" | "qr" | etc.
  type        String       // "text" | "image" | "qr" | "barcode" | "id"
  side        String       @default("front") // "front" | "back"
  x           Float
  y           Float
  width       Float
  height      Float
  fontSize    Int?         @map("font_size")
  fontWeight  String?      @default("normal") @map("font_weight")
  fontFamily  String?      @map("font_family")
  color       String?      @default("#000000")
  align       String?      @default("left")   // "left" | "center" | "right"
  verticalAlign String?    @default("top") @map("vertical_align") // "top" | "middle" | "bottom"
  isRequired  Boolean      @default(false) @map("is_required")
  prefix      String?      // label prefix shown on approval PDF
  lineHeight  Float?       @default(1.2) @map("line_height")
  createdAt   DateTime     @default(now()) @map("created_at")

  @@unique([templateId, field, side])
  @@index([templateId])
  @@map("template_fields")
}

model CardholderValue {
  id           Int        @id @default(autoincrement())
  cardholderId Int        @map("cardholder_id")
  cardholder   Cardholder @relation(fields: [cardholderId], references: [id], onDelete: Cascade)
  field        String     // maps to TemplateField.field
  value        String     // holds text, photo URLs, barcode values, etc.
  createdAt    DateTime   @default(now()) @map("created_at")

  @@unique([cardholderId, field])
  @@index([cardholderId])
  @@map("cardholder_values")
}
```

### 1b. Data Migration Script (Back-populate from JSON) ✅ COMPLETE
- Parse each template's `frontFields` / `backFields` JSON strings → insert `TemplateField` rows.
- Parse each cardholder's `customFields` JSON → insert `CardholderValue` rows.
- Set `sides: 2` for any template with a non-null `backImageUrl`; otherwise `sides: 1`.
- Auto-assign `category` based on template name keywords (e.g. name contains "certificate" → `CERTIFICATE`; "badge" → `BADGE`; else → `ID_CARD`).

### 1c. API & Frontend Refactor (Action Items)
- [x] Implement robust client-side validation UX that highlights and auto-scrolls to missing/empty template fields (Name, Dimensions, Background images, Coordinate columns) upon clicking Save/Update.
- [x] Conditionally hide raw background URL input text fields in the Electron desktop environment to keep the UI clean and clutter-free.
- [x] Add a delete button for each field directly on the canvas layout next to the edit and copy buttons for easier field management.
- [x] Enforce template name uniqueness validation during save, update, cloning, and marketplace purchases.
- [x] Relocate suggested fields panel directly above the front side layout design canvas for enhanced accessibility.
- [x] Clean up 'Select Template' dropdown in the Client Portal generator to hide '[Image Format]' suffixes.
- [x] Strictly enforce template assignments to client organizations (removed the backward-compatible fallback showing all templates in the portal generator when no templates were assigned).
- [ ] Refactor the visual canvas drag-and-drop state to direct CRUD (Postponed/skipped per user request).

---

## 2. Implement Dynamic Roster Validation Engine ✅ COMPLETE
**Objective:** Replace hardcoded CSV/Excel parsing and generic Zod schemas with a dynamic validation system matched directly against database constraints.

*   **Action Items:**
    *   [x] Build a column-mapping UI helper that lets users select how imported Excel headers map to template field definitions (e.g., matching "Name" or "Student Name" to the core `name` field).
    *   [x] Implement dynamic Zod validation generators that build validator schemas at runtime using `TemplateField` records (e.g., checks for `isRequired`, maximum field length, and matching data types).
    *   [x] Provide a clean user interface reporting validation errors per-row (e.g., "Row 15: Missing required field 'Blood Group'").
    *   [x] Support optional regex/pattern validation per-field (e.g., mobile number must be 10 digits, roll number must start with a letter).

---

## 3. Print Processing Queue & Batch Optimization
**Objective:** Harden the rendering queue in the print engine for high-volume jobs to prevent server-side CPU spikes and query latency.

### 3a. Serverless Execution Timeout — Critical Constraint ✅ COMPLETE
> **⚠️ Serverless Timeout Issue:** Next.js API routes on Vercel have strict execution limits (10–60s depending on plan). Rendering 100+ cards easily exceeds this.
- **Web Portal Strategy:** PDF generation must be async — API enqueues the job (`PdfJob.status = "PENDING"`), returns job ID immediately, then a background worker processes it. Client polls `/api/jobs/[id]` for status and download URL.
- **Electron Desktop App Strategy:** Provide a "Run Locally" option that bypasses server entirely — Electron generates PDFs directly from its own `card-renderer-client.ts` and saves to local disk. No timeout, no credit server roundtrip during rendering. Credits are still deducted via a server call before generation starts.

### 3b. Sheet Size Selector ✅ COMPLETE
*   When starting a print job (Production or Approval), add a **Sheet Size dropdown** with:
    *   `A4` (595.27 pt × 841.89 pt)
    *   `A3` (841.89 pt × 1190.55 pt) ← current default
    *   `SRA3` (907.09 pt × 1275.59 pt)
    *   `13 × 19 inch` (936 pt × 1368 pt)
    *   `Custom Sheet Size` (enables width + height inputs in mm, auto-converted to pt: `pt = mm * 2.8346`)
*   **Default Sheet by Category:**
    *   ID Card, Badge, Label, Tag, Sticker, Visitor Pass → `SRA3`
    *   Certificate, Letter → `A4`
    *   Ticket, Card → `A3`
    *   Other → `A4`
*   **Layout Spacing Defaults (standardize):**
    *   Margins: `10mm` (28.35 pt) on all sides
    *   Gap between cards: `2mm` (5.67 pt) horizontal and vertical
    *   Bleed (optional): `0mm` default, configurable up to `3mm` (8.5 pt)

### 3c. Proportionate Grid Compilation ✅ COMPLETE
*   Modify `ProductionPdfGenerator` to read the selected Sheet Size dimensions.
*   Auto-calculate grid from:
    ```
    columns = Math.floor((sheetWidth - marginLeft - marginRight + colGap) / (cardWidth + colGap))
    rows    = Math.floor((sheetHeight - marginTop - marginBottom + rowGap) / (cardHeight + rowGap))
    cardsPerPage = columns * rows
    ```
*   For duplex (2-sided) templates: split the page into two halves (fronts top, backs bottom), add fold line, adjust row calculation per half.
*   Tile cards proportionally; auto-insert page breaks.

### 3d. Pre-Print Validation Flow (runs before PDF generation) ✅ COMPLETE

**Step 1 — Missing Field Check:**
- Scan every cardholder in the batch; cross-reference their `CardholderValue` rows (or `customFields` JSON) against all `TemplateField` records marked `isRequired: true`.
- Collect all records with missing/empty required fields.
- If any records have missing fields, **block print** and show a validation report modal:

  > ⚠️ **Missing Data Detected**
  > **{n} record(s)** have incomplete required fields. Fix them before printing.

  | # | Cardholder Name | Missing Fields |
  |---|---|---|
  | 3 | John Doe | Photo, ID Number |
  | 7 | Jane Smith | Department |

- Modal options:
    - **"Fix Records"** — Closes modal, takes user to cardholder list with flagged records highlighted in red.
    - **"Skip & Print Anyway"** — Proceeds with missing fields left blank; shows a warning label on those cards in the final PDF output.

**Step 2 — Empty Slot Check:**
- Pre-calculate `totalSlots = cols × rows × totalPages` vs `totalCards`.
- If `totalSlots > totalCards`, show empty slot strategy modal:
    - **"Leave Blank"** — Empty slots print as white space (safe for cut-and-stack printing).
    - **"Repeat Last Card"** — Fill remaining slots by repeating the last cardholder record.
    - **"Repeat First Card"** — Fill remaining slots with first cardholder (useful for calibration cards).
- If `totalSlots === totalCards`, skip modal entirely.

**Step 3 — Generation Proceeds** once both checks are resolved.

### 3e. Job Queue & Progress Tracking ✅ COMPLETE
- [x] Implement lightweight job status polling (Upstash Redis or database polling every 2s) that updates progress bar in UI (e.g., "Generating PDF: 45% complete").
- [x] Integrate localized print queue scheduling for Electron Desktop Client to stream PDF buffers directly to local drives without memory leaks.
- [x] Add `PdfJob.metadata` fields: `{ sheetSize, bleed, cropMarks, foldLine, colGap, rowGap, emptySlotStrategy }` so jobs are reproducible.

---

## 4. Database Cleanup & Column Deprecation
**Objective:** Safely decommission legacy JSON fields to ensure schema cleanliness.

> ⚠️ **Do NOT do this until Sections 1 & 2 are verified stable in production.**

### Migration Strategy (3 Phases):
1. **Back-Populate (Section 1b):** Run the migration script to hydrate `TemplateField` and `CardholderValue` from existing JSON.
2. **Double-Write Phase:** All API endpoints write to BOTH the JSON strings (legacy fallback) and the new relational rows simultaneously. Read from new rows. Verify for 2–4 weeks.
3. **Deprecation Phase:** Once confirmed stable, run migration to drop `frontFields`, `backFields` from `CardTemplate` and `customFields` from `Cardholder`. Remove JSON parsing helpers from utility functions.

---

## 5. Template Categories & Smart Fields ✅ COMPLETE
**Objective:** Introduce a `category` field for templates and suggest smart/typical variable fields dynamically in the Template Editor.

**Status: Fully implemented and pushed.**
- ✅ DB migration: `category`, `sides`, marketplace fields, `TemplateClientAssignment` join table, `promoCredits` on `Press`
- ✅ `templateSchema` updated with `category`, `sides`, `clientIds` validation
- ✅ `/api/templates` GET/POST/PUT handles client assignment sync and version inheritance
- ✅ Frontend: Category dropdown (auto-fills preset dimensions), Sides toggle (hides back-image upload for 1-sided), Smart Suggestions panel, Multi-client pill picker, Category filter chips, Color-coded category + sides badges on template cards

### 5a. Remaining Items ✅ COMPLETE
- [x] **Client Portal Link Template Filter:** On the Client Page (`/dashboard/clients`), update the "Create Portal Link" dialog so the Template dropdown **only shows templates assigned to that specific client** (via `TemplateClientAssignment`). Currently shows all press templates.
- [x] **Migration Script:** Script to back-populate `category` and `sides` for all existing templates from name keywords and `backImageUrl` presence.

---

## 6. Template Marketplace & Starter Templates ✅ COMPLETE
**Objective:** Allow presses to publish their templates to a public marketplace for others to purchase using credits.

> **Schema Status:** `isPublic`, `price`, `likes`, `reports`, `isModerated`, `cdrFileUrl`, `aiFileUrl`, `psdFileUrl`, `pdfFileUrl` fields are already added to `CardTemplate`. `promoCredits` is on `Press`. Migration is applied. UI and API logic are fully implemented.

### 6a. Credit System
*   On press signup → `promoCredits = 1000`, `credits = 0`.
*   **Print Generation Credit Costs:**
    *   *Production PDF:* Cost per card per category, configured by Super Admin in `SystemSetting` (e.g. key `cost_production_ID_CARD = 1`).
    *   *Approval PDF:* Universal flat cost in `SystemSetting` key `cost_approval_universal` (default `0`).
*   Credit deduction order: consume `promoCredits` first, then `credits`.
*   **Template marketplace purchases:** Only paid `credits` accepted (not `promoCredits`).

### 6b. Seller Publish Action & Listing Fee
- [x] Super Admin sets listing fee in `SystemSetting` key `marketplace_listing_fee` (default `50` credits).
- [x] Add "Sell Template" button on template cards.
- [x] Flow: Set price → attach source files (`.cdr`, `.ai`, `.pdf`, `.psd`) → verify press has enough credits → deduct listing fee → mark `isPublic: true`.

### 6c. Marketplace UI & Filters
- [x] "Starter Templates" tab in dashboard (currently shows global `pressId: null` templates).
- [x] Display: credit price, background preview, category, total likes, file format indicators (`CDR`, `AI`, `PDF`, `PSD`).
- [x] Like and Report buttons on each template card.
- [x] **Filters:** Category, File Format, Fields Included (QR, barcode, photo), Cost (Free / Paid, Low→High).

### 6d. Purchase API `/api/templates/purchase`
- [x] POST endpoint that:
    1. Verifies buyer press has enough paid `credits >= template.price`.
    2. Deducts credits from buyer, credits seller.
    3. Clones template layout (background images, dimensions, source file URLs).
    4. Copies all `TemplateField` rows to the new buyer-press template.

### 6e. Secure Download Gateway `/api/templates/download`
- [x] Never expose raw cloud storage URLs in UI (show only format indicators e.g. "CorelDRAW Attached").
- [x] GET `/api/templates/download?templateId={id}&format={cdr|ai|pdf|psd}`:
    *   Verify calling press owns or has purchased the template.
    *   Retrieve file URL from DB internally and stream/redirect with signed headers.
- [x] On purchase completion:
    *   Web: trigger browser download prompts for all available source files.
    *   Electron: auto-download files to `~/Downloads/IDexo/` and show toast notification.

### 6f. Super Admin Moderation
- [x] Template Moderation tab in `/superadmin` — list all public templates sorted by high report count first.
- [x] Hide/Unhide toggle (sets `isModerated`) and Delete button.
- [x] Filter out `isModerated: true` templates from public marketplace feed.

---

## 7. Client Portal — Template Filter by Assignment (NEW) ✅ COMPLETE
**Objective:** When creating a portal link for a client, only show that client's assigned templates.

*   **Action Items:**
    *   [x] On the Create Portal Link dialog at `/dashboard/clients/[id]`, query `TemplateClientAssignment` to filter the template dropdown to only templates assigned to that client.
    *   [x] If no templates are assigned to the client, show a prompt: "No templates assigned to this client. Assign templates first in Template Manager."
    *   [x] On the portal share detail view, display which template is linked and allow re-assignment to any template assigned to that client.

---

## 8. Analytics & Reporting Dashboard (NEW) ✅ COMPLETE
**Objective:** Give press operators clear visibility into print volumes, credit usage, and client activity.

*   **Action Items:**
    *   [x] **Press Dashboard Widgets:**
        *   Cards printed this month (from `CardPrintRecord`)
        *   Credits remaining (paid + promo, with split)
        *   Orders by status breakdown (DRAFT / APPROVAL / PRINTING / DELIVERED pie chart)
        *   Top clients by card volume
    *   [x] **Per-Order Analytics:**
        *   Cardholder completion rate (how many have all required fields filled)
        *   Cards printed vs. not printed within an order
    *   [x] **Credit Usage Log:** Timeline of credit deductions with job references (`PdfJob.id`) and amounts.
    *   [x] **Super Admin Analytics:**
        *   Revenue generated across all presses
        *   Marketplace transaction volume
        *   Most active presses and most downloaded templates

---

## 9. Cardholder Bulk Operations (NEW) ✅ COMPLETE
**Objective:** Improve data management efficiency for large client rosters.

*   **Action Items:**
    *   [x] **Bulk Delete:** Select multiple cardholders and delete them in a single confirmed action.
    *   [x] **Bulk Template Reassignment:** Select multiple cardholders and change their assigned template (e.g., when a department switches from one card design to another).
    *   [x] **Bulk Status Toggle:** Activate / Deactivate multiple cardholders at once (e.g., graduated students, resigned employees).
    *   [x] **Export to Excel:** Export all cardholders in a client (including all `customFields` values) to a structured `.xlsx` file. Columns should map to template field names.
    *   [x] **Duplicate Detection on Import:** Before committing CSV/Excel imports, compare `uniqueKey` against existing records and display a merge/skip/overwrite prompt for duplicates.

---

## 10. Enrollment Portal Improvements (NEW) ✅ COMPLETE
**Objective:** Harden the cardholder self-enrollment portal for production use.

*   **Action Items:**
    *   [x] **Photo Capture via Webcam:** Add a live camera capture option inside the enrollment form so cardholders can take a photo directly in the browser (using `MediaDevices.getUserMedia`), without needing to upload a file.
    *   [x] **Form Validation UX:** Show inline real-time validation on required fields (not just on submit). Highlight empty required fields in red before submission.
    *   [x] **Enrollment Confirmation Email:** After successful submission, send the cardholder a confirmation email with their submitted details.
    *   [x] **Multi-Language Support:** Allow portal links to display in a configurable language (English, Hindi, Arabic, Tamil, etc.), with labels and prompts translating accordingly.
    *   [x] **Enrollment Rate Limiting:** Rate-limit enrollment submissions per IP to prevent spam submissions.

---

## Implementation Priority Order

| Priority | Section | Estimated Effort | Status |
|---|---|---|---|
| 🔴 Critical | **1a+1b** — TemplateField/CardholderValue schema + migration | High | ✅ Complete |
| 🔴 Critical | **3a** — Fix serverless timeout via async job pattern | Medium | ✅ Complete |
| 🟠 High | **3b+3c** — Sheet Size selector & Grid compilation | High | ✅ Complete |
| 🟠 High | **3d** — Pre-print validation flow (Missing fields/slots) | Medium | ✅ Complete |
| 🟠 High | **2** — Dynamic Roster Validation Engine | High | ✅ Complete |
| 🟡 Medium | **5a** — Client portal template filter by assignment | Low | ✅ Complete |
| 🟡 Medium | **7** — Client Portal template filter in portal link dialog | Low | ✅ Complete |
| 🟡 Medium | **6a–6f** — Marketplace full implementation | Very High | ✅ Complete |
| 🟢 Low | **8** — Analytics Dashboard | Medium | ✅ Complete |
| 🟢 Low | **9** — Bulk Cardholder Operations | Medium | ✅ Complete |
| 🟢 Low | **10** — Enrollment Portal improvements | Medium | ✅ Complete |
| ⚪ Last | **4** — JSON Column Deprecation | Low (after 1+2 stable) | ❌ Incomplete |
