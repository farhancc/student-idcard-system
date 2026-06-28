# ID Card PDF Generation Platform — Implementation Plan (v2)

## What This System Is

A SaaS platform sold to **printing presses** on a monthly subscription.
Presses use it to manage ID card orders for any type of client organisation.

---

## Entity Hierarchy

```
You (Platform Owner)
  └── Press A  ← pays monthly subscription        [Tenant]
  └── Press B  ← pays monthly subscription        [Tenant]
  └── Press C  ← pays monthly subscription        [Tenant]

Press A manages:
  ├── Client: Springfield School      → Cardholders: Students
  ├── Client: City Hospital           → Cardholders: Employees
  ├── Client: Red Cross NGO           → Cardholders: Volunteers
  └── Client: Municipal Corporation   → Cardholders: Government Staff
```

---

## Core Architecture

```
                    ┌──────────────────────────┐
                    │     Card Asset Engine     │
                    │  Background PNG           │
                    │  + Coordinate Map         │
                    │  + Cardholder Data        │
                    │  = Card PNG per person    │
                    └────────────┬─────────────┘
                                 │  Cached PNG assets (reused)
             ┌───────────────────┼───────────────────┐
             ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Production   │   │  Approval    │   │  Individual  │
    │ PDF Generator│   │ PDF Generator│   │ PDF Generator│
    └──────────────┘   └──────────────┘   └──────────────┘
```

**Key rule:** Card PNGs are generated once per cardholder and cached.
All PDF types pull from the same cached assets.

---

## Phase 1: Database Schema

```prisma
// ── TENANTS ──────────────────────────────────────────────

model Press {
  id          Int       @id @default(autoincrement())
  name        String                          // "Sri Lakshmi Printers"
  email       String    @unique
  phone       String?
  city        String?
  plan        String    @default("BASIC")     // BASIC | PRO | ENTERPRISE
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  users       PressUser[]
  clients     Client[]
  templates   CardTemplate[]
  orders      CardOrder[]

  @@map("press")
}

model PressUser {
  id           Int      @id @default(autoincrement())
  pressId      Int
  press        Press    @relation(fields: [pressId], references: [id])
  name         String
  email        String   @unique
  passwordHash String
  role         String   // OWNER | OPERATOR | DESIGNER
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@map("press_users")
}

// ── CLIENTS ───────────────────────────────────────────────

model Client {
  id           Int      @id @default(autoincrement())
  pressId      Int
  press        Press    @relation(fields: [pressId], references: [id])
  name         String                         // "Springfield School"
  type         String                         // SCHOOL | COMPANY | NGO | GOVERNMENT | OTHER
  contactName  String?
  contactPhone String?
  contactEmail String?
  address      String?
  createdAt    DateTime @default(now())

  cardholders  Cardholder[]
  orders       CardOrder[]

  @@map("clients")
}

// ── CARDHOLDERS ───────────────────────────────────────────

model Cardholder {
  id           Int      @id @default(autoincrement())
  pressId      Int
  clientId     Int
  client       Client   @relation(fields: [clientId], references: [id])
  name         String
  designation  String?                        // Student / Employee / Volunteer
  photoUrl     String?
  customFields String?                        // JSON: { grade, bloodGroup, empId, ... }
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  cardAsset    CardAsset?

  @@map("cardholders")
}

// ── CARD TEMPLATES (image + coordinate mapping) ───────────

model CardTemplate {
  id            Int      @id @default(autoincrement())
  pressId       Int
  press         Press    @relation(fields: [pressId], references: [id])
  clientId      Int?                          // null = reusable across clients
  name          String                        // "Classic Blue Student Card"
  cardWidth     Int      @default(1011)       // pixels at 300 DPI (85.6mm)
  cardHeight    Int      @default(638)        // pixels at 300 DPI (54mm)
  frontImageUrl String                        // S3 URL of front background PNG
  backImageUrl  String?                       // S3 URL of back background PNG
                                              // if null → back renders as blank white card
  frontFields   String                        // JSON: array of FieldCoordinate
  backFields    String   @default("[]")       // JSON: empty array = no fields on back
  createdAt     DateTime @default(now())

  orders        CardOrder[]

  @@map("card_templates")
}

// ── CARD ORDERS ───────────────────────────────────────────

model CardOrder {
  id          Int      @id @default(autoincrement())
  pressId     Int
  press       Press    @relation(fields: [pressId], references: [id])
  clientId    Int
  client      Client   @relation(fields: [clientId], references: [id])
  templateId  Int
  template    CardTemplate @relation(fields: [templateId], references: [id])
  status      String   @default("DRAFT")
  // DRAFT | APPROVAL_PDF_GENERATED | APPROVAL_PDF_SENT | APPROVED | PRINTING | DELIVERED
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  cardholderIds String                        // JSON: [1, 2, 3, ...] cardholder IDs
  pdfJobs      PdfJob[]

  @@map("card_orders")
}

// ── CARD ASSET CACHE ──────────────────────────────────────

model CardAsset {
  id           Int      @id @default(autoincrement())
  cardholderId Int      @unique
  pressId      Int
  templateId   Int
  frontUrl     String   @map("front_url")    // S3 URL of rendered front PNG (always present)
  backUrl      String   @map("back_url")      // S3 URL of rendered back PNG (always present — blank white if no back template)
  templateHash String                         // MD5 for cache invalidation
  generatedAt  DateTime @default(now())

  cardholder   Cardholder @relation(fields: [cardholderId], references: [id])

  @@map("card_assets")
}

// ── PDF JOBS (QUEUE) ──────────────────────────────────────

model PdfJob {
  id          Int      @id @default(autoincrement())
  pressId     Int
  orderId     Int
  order       CardOrder @relation(fields: [orderId], references: [id])
  pdfType     String                         // PRODUCTION | APPROVAL | INDIVIDUAL
  status      String   @default("PENDING")   // PENDING | PROCESSING | COMPLETED | FAILED
  fileName    String
  downloadUrl String?
  generatedBy Int                            // PressUser id
  progress    Int      @default(0)           // 0-100 percent
  errorMsg    String?
  generatedAt DateTime @default(now())
  completedAt DateTime?
  expiresAt   DateTime?                      // auto-delete after N days
  metadata    String?                        // JSON: { paperSize, bleed, ... }

  @@map("pdf_jobs")
}
```

---

## Phase 2: Template System — Image + Coordinate Mapping

### How Templates Work

```
Designer creates card in Photoshop/Figma
  → exports as plain PNG (just the visual design, no data)
  → uploads to platform

Press operator defines where each field goes on that image:
  → x, y, width, height for each data field
  → font, size, color for text fields

Saved as FieldCoordinate JSON in CardTemplate.frontFields
```

### FieldCoordinate Type

```typescript
type FieldType = 'text' | 'image' | 'qr' | 'barcode';

interface FieldCoordinate {
  field: string;           // "name" | "photo" | "designation" | "empId" | any customField key
  type: FieldType;
  x: number;              // pixels from left
  y: number;              // pixels from top
  width: number;
  height: number;
  // text-only options
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  // image-only options
  borderRadius?: number;
  objectFit?: 'cover' | 'contain';
}
```

### Example Template JSON

```json
{
  "frontFields": [
    { "field": "photo",       "type": "image",   "x": 45,  "y": 120, "width": 180, "height": 220, "borderRadius": 8 },
    { "field": "name",        "type": "text",    "x": 260, "y": 200, "width": 420, "height": 40,  "fontSize": 28, "fontWeight": "bold", "color": "#1a1a2e" },
    { "field": "designation", "type": "text",    "x": 260, "y": 250, "width": 300, "height": 28,  "fontSize": 18, "color": "#555" },
    { "field": "empId",       "type": "text",    "x": 260, "y": 290, "width": 300, "height": 24,  "fontSize": 16, "color": "#888" }
  ],
  "backFields": [
    { "field": "qrCode",      "type": "qr",      "x": 50,  "y": 80,  "width": 160, "height": 160 },
    { "field": "barcode",     "type": "barcode",  "x": 240, "y": 300, "width": 400, "height": 80 },
    { "field": "bloodGroup",  "type": "text",    "x": 250, "y": 150, "width": 120, "height": 30,  "fontSize": 20, "fontWeight": "bold", "color": "#cc0000" }
  ]
}
```

### Rendering Engine (`src/lib/pdf/card-engine.ts`)

Uses **`node-canvas`** for pixel-perfect compositing:

```typescript
import { createCanvas, loadImage, registerFont } from 'canvas';

// Always renders 2 images per card: front + back.
// If no back image uploaded, back is a blank white canvas with no fields.
async function renderCard(
  template: CardTemplate,
  cardholder: Cardholder,
  side: 'front' | 'back'
): Promise<Buffer> {
  const fields: FieldCoordinate[] = JSON.parse(
    side === 'front' ? template.frontFields : template.backFields
  );
  const bgUrl = side === 'front' ? template.frontImageUrl : template.backImageUrl;

  const canvas = createCanvas(template.cardWidth, template.cardHeight);
  const ctx = canvas.getContext('2d');

  // 1. Draw background image — or blank white if no back image provided
  if (bgUrl) {
    const bg = await loadImage(bgUrl);
    ctx.drawImage(bg, 0, 0, template.cardWidth, template.cardHeight);
  } else {
    // No back image uploaded → render blank white card
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, template.cardWidth, template.cardHeight);
  }

  // 2. Get cardholder data (merge fixed fields + customFields JSON)
  const data = { ...cardholder, ...JSON.parse(cardholder.customFields ?? '{}') };

  // 3. Render each field at its coordinates
  for (const f of fields) {
    const value = data[f.field];
    if (!value) continue;

    switch (f.type) {
      case 'text':
        ctx.font = `${f.fontWeight ?? 'normal'} ${f.fontSize ?? 16}px ${f.fontFamily ?? 'Inter'}`;
        ctx.fillStyle = f.color ?? '#000';
        ctx.textAlign = f.align ?? 'left';
        ctx.fillText(String(value), f.x, f.y + (f.fontSize ?? 16));
        break;

      case 'image':
        const img = await loadImage(value);
        ctx.save();
        if (f.borderRadius) {
          ctx.beginPath();
          ctx.roundRect(f.x, f.y, f.width, f.height, f.borderRadius);
          ctx.clip();
        }
        ctx.drawImage(img, f.x, f.y, f.width, f.height);
        ctx.restore();
        break;

      case 'qr':
        const qrBuf = await generateQR(value);
        const qrImg = await loadImage(qrBuf);
        ctx.drawImage(qrImg, f.x, f.y, f.width, f.height);
        break;

      case 'barcode':
        const bcBuf = await generateBarcode(value);
        const bcImg = await loadImage(bcBuf);
        ctx.drawImage(bcImg, f.x, f.y, f.width, f.height);
        break;
    }
  }

  return canvas.toBuffer('image/png');
}
```

### Cache Invalidation

```typescript
const hash = md5(JSON.stringify({ cardholder, templateId: template.id, template.frontFields }));
const cached = await prisma.cardAsset.findUnique({ where: { cardholderId } });
if (cached?.templateHash === hash) return cached; // reuse
// else re-render and upload
```

---

## Phase 3: Strategy Pattern — PDF Generators

### Interface (`src/lib/pdf/generators/IPdfGenerator.ts`)

```typescript
export interface PdfContext {
  order: CardOrder;
  client: Client;
  cardholders: Cardholder[];
  assets: Map<number, CardAsset>;  // cardholderId → CardAsset
  options?: PdfOptions;
}

export interface IPdfGenerator {
  type: string;
  generate(ctx: PdfContext): Promise<Buffer>;
}
```

### Registry (`src/lib/pdf/pdf-generator.factory.ts`)

```typescript
const registry = new Map<string, IPdfGenerator>();
registry.set('PRODUCTION',  new ProductionPdfGenerator());
registry.set('APPROVAL',    new ApprovalPdfGenerator());
registry.set('INDIVIDUAL',  new IndividualPdfGenerator());
// future:
// registry.set('CERTIFICATE', new CertificatePdfGenerator());
// registry.set('BUS_PASS',    new BusPassPdfGenerator());
```

Adding a new PDF type = one new class + one registry line. Zero changes elsewhere.

---

## Phase 4: PDF Type Implementations

### Type 1 — Production Print PDF

**Purpose:** Mass printing. Cards arranged in a grid for fold-and-cut.

**Paper Sizes:**
| Size | Cards Per Sheet |
|------|----------------|
| A3 Portrait (297×420mm) | 10 (2 rows × 5 cols) |
| A3 Landscape (420×297mm) | 10 (2 rows × 5 cols) |
| Custom (mm) | Calculated |

**Grid Layout (fold-line algorithm):**
```
FRONT SIDE:
Row 0:  F1   F2   F3   F4   F5
Row 1:  F6   F7   F8   F9   F10
─────────────── FOLD LINE ───────────────
Row 2:  B6   B7   B8   B9   B10   ← back of row 1
Row 3:  B1   B2   B3   B4   B5    ← back of row 0

After folding: F1↔B1, F2↔B2, ... F10↔B10

backRow = totalRows - 1 - frontRow
backCol = frontCol
```

**Print Marks:**
- Crop marks (5mm hairlines at card corners)
- Bleed (3mm outside trim)
- Safe area (3mm inside trim, guide only)
- Registration marks (cross-hair at sheet corners)
- Fold line (dashed centre line)
- CMYK color profile for print vendor compatibility

**Output:** `{clientName}-production-{date}.pdf`

---

### Type 2 — Approval PDF

**Purpose:** Download and hand to authority offline for review. Not submitted via app.

**Layout:**
```
Page N:
  Cardholder: John Smith — Employee — ID: EMP-042
  [ Front Card Image ]   [ Back Card Image ]
  ─────────────────────────────────────────
  Cardholder: Jane Doe — Employee — ID: EMP-043
  [ Front Card Image ]   [ Back Card Image ]

Last Page:
  Client: City Hospital
  Order Date: 2026-06-05
  Total Cards: 85
  Generated By: Press Operator Name

  Approved By: ______________________
  Signature:   ______________________
  Date:        ______________________
```

- 5 cardholders per A4 page
- "FOR APPROVAL ONLY — DO NOT PRINT" diagonal watermark
- Authority signs the physical printout → press marks approved in system

**Output:** `{clientName}-approval-{date}.pdf`

---

### Type 3 — Individual PDF

**Purpose:** Digital delivery of a single person's card.

```
Page:
  Name: John Smith | Designation: Employee | ID: EMP-042

  +─────────────────────────+
  |      Front Card         |
  +─────────────────────────+

  +─────────────────────────+
  |       Back Card         |
  +─────────────────────────+
```

**Export Modes:**
| Mode | Output |
|------|--------|
| Single cardholder | `john-smith-card.pdf` |
| Selected cardholders | `batch-selected.pdf` (multi-page) |
| All in order | `{clientName}-all-individual.pdf` |

**Output:** configurable filename

---

## Phase 5: Offline Approval Flow

No in-app portal. No token links. Fully offline.

```
Press generates Approval PDF
  → Press downloads PDF
  → Press hands to authority (WhatsApp / print / email — outside system)
  → Authority reviews and approves offline (signs paper, calls, etc.)
  → Press opens app → clicks "Mark as Approved"
  → System records approval timestamp + who marked it
  → Production PDF now unlocked
```

**Order Status Flow:**
```
DRAFT
  → APPROVAL_PDF_GENERATED
  → APPROVAL_PDF_SENT          (press marks after delivering PDF to authority)
  → APPROVED                   (press marks after getting offline sign-off)
  → PRINTING                   (production PDF generated and sent to printer)
  → DELIVERED                  (cards delivered to client)
```

---

## Phase 6: PDF Queue System

```
POST /api/pdf/generate
  → Create PdfJob { status: PENDING }
  → Return { jobId }  (non-blocking)
  → Background worker:
      1. status → PROCESSING, progress = 0
      2. For each cardholder: render card PNG (or use cache), progress++
      3. Assemble PDF via generator
      4. Upload to storage
      5. status → COMPLETED, downloadUrl set
      6. On error: status → FAILED, errorMsg set
```

**Progress Tracking:** `progress` field (0–100) polled by frontend every 2s.

**Job Completion:** In-app notification to the press user who triggered it.

---

## Phase 7: Object Storage Structure

```
{pressId}/
  cards/
    {cardholderId}/
      front.png
      back.png
  pdf/
    production/
      {clientName}-production-{timestamp}.pdf
    approval/
      {clientName}-approval-{timestamp}.pdf
    individual/
      {name}-card-{timestamp}.pdf
  templates/
    {templateId}/
      front-bg.png
      back-bg.png
```

**Providers:**
- Dev: local `/public/generated/`
- Prod: AWS S3 or Vercel Blob (PDFs) + Cloudinary (images)

Download URLs expire after 48h (signed URLs).

---

## Phase 8: API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/pdf/generate | Enqueue PDF job |
| GET | /api/pdf/jobs | List jobs for press |
| GET | /api/pdf/jobs/:id | Job status + progress + download URL |
| DELETE | /api/pdf/jobs/:id | Delete job |
| POST | /api/pdf/jobs/:id/regenerate | Re-trigger job |
| GET | /api/pdf/jobs/:id/download | Proxy download |
| POST | /api/pdf/process | Internal cron worker |
| GET | /api/cardholders/:id/preview | Preview card PNG |
| POST | /api/orders/:id/status | Update order status (e.g. mark approved) |
| POST | /api/cardholders/import | CSV bulk import |
| POST | /api/cardholders/photos | ZIP bulk photo import |
| POST | /api/templates | Create template |
| PUT | /api/templates/:id | Update field coordinates |

---

## Phase 9: Template Setup UI

No visual drag-and-drop builder. Template setup is two simple steps:

**Step 1 — Upload Background Images**

Press uploads the pre-designed card images (created externally in Photoshop/Canva/etc.):
```
Template Name: [________________]

Front Card Image:   [ Upload PNG / JPG ]
Back Card Image:    [ Upload PNG / JPG ]  (if not uploaded → back renders as blank white card)

Card Width (px):  [1011]   Card Height (px):  [638]
```

**Step 2 — Define Field Coordinates (Form)**

For each data field the press wants to place on the card, they fill a row in a table:

```
Front Card Fields:
────────────────────────────────────────────────────────────────────────────────
Field Name    Type    X      Y      Width  Height  Font Size  Color    Align
────────────────────────────────────────────────────────────────────────────────
photo         image   45     120    180    220     —          —        —
name          text    260    200    420    40      28         #1a1a2e  left
designation   text    260    250    300    28      18         #555555  left
cardSerial    text    260    290    300    24      16         #888888  left
validTill     text    260    330    250    22      14         #888888  left
────────────────────────────────────────────────────────────────────────────────
[+ Add Field]

Back Card Fields:
────────────────────────────────────────────────────────────────────────────────
Field Name    Type     X     Y     Width  Height
────────────────────────────────────────────────────────────────────────────────
qrCode        qr       50    80    160    160
barcode       barcode  240   300   400    80
bloodGroup    text     250   150   120    30      20  #cc0000  center
────────────────────────────────────────────────────────────────────────────────
[+ Add Field]
```

**Field types available:**
| Type | Renders |
|------|---------|
| `text` | Plain text value from cardholder data |
| `image` | Photo or any image URL field |
| `qr` | QR code generated from field value |
| `barcode` | Barcode (Code128) generated from field value |

**Preview:**
- After saving coordinates, press clicks [Preview with Sample Data]
- System renders a card PNG using the background image + first cardholder (or dummy data)
- Displayed in the browser — press eyeballs it and adjusts coordinates if needed
- No live updating — adjust numbers → save → re-preview

---

## Phase 10: Frontend UI — Press Dashboard

### Navigation
```
Dashboard | Clients | Orders | Templates | PDF Jobs | Settings
```

### Orders Page (main workspace)
```
Orders
──────────────────────────────────────────────────────────────
Client                  Type        Cards   Status              Actions
City Hospital           COMPANY     85      APPROVED            [Generate Production PDF]
Springfield School      SCHOOL      248     APPROVAL PDF SENT   [Mark Approved]
Red Cross NGO           NGO         40      DRAFT               [Generate Approval PDF]
Municipal Corp          GOVERNMENT  120     PRINTING            [Mark Delivered]
──────────────────────────────────────────────────────────────
```

### PDF Jobs Page
```
File Name                          Type        Status       Progress   Actions
cityhosp-production-0605.pdf       Production  Completed    100%       Download / Delete
school-approval-0604.pdf           Approval    Completed    100%       Download / Regen
ngo-individual-0603.pdf            Individual  Processing   67%        —
```

### Cardholder Management
- List with search/filter (by client, designation, status)
- Preview card button per cardholder
- Edit data inline
- Bulk import (CSV)
- Bulk photo import (ZIP)
- Completeness indicator (photo ✅ / missing ⚠️)

---

## Phase 11: Missing Data Validation

Before any PDF is generated, system checks:

```
Generating approval PDF for 85 cardholders...

✅ 78 cardholders ready
⚠️  5 missing photo
❌  2 missing name

[Generate anyway (78 cards)] [Cancel and fix]
```

Cards with missing critical fields are excluded or shown as placeholder.

---

## Phase 12: File Structure

```
src/
  lib/
    pdf/
      card-engine.ts              ← render PNG from template + cardholder
      pdf-queue.ts                ← job management
      pdf-generator.factory.ts   ← strategy registry
      generators/
        IPdfGenerator.ts
        production.generator.ts
        approval.generator.ts
        individual.generator.ts
      utils/
        print-marks.ts            ← crop marks, bleed, registration marks
        layout.ts                 ← grid layout, fold-line algorithm
        storage.ts                ← upload to S3/Cloudinary
        qr.ts                     ← QR code generation
        barcode.ts                ← barcode generation
  components/
    template-builder/
      TemplateUpload.tsx
      CoordinateMapper.tsx        ← visual field placement
      CardPreview.tsx             ← live preview with real data
    pdf/
      PdfJobsTable.tsx
      GeneratePdfForm.tsx
      OrderStatusBadge.tsx
    cardholders/
      CardholderTable.tsx
      CsvImportModal.tsx
      PhotoZipImport.tsx
      CardPreviewModal.tsx
  app/
    (press)/
      dashboard/page.tsx
      clients/page.tsx
      orders/
        page.tsx
        [id]/page.tsx
      templates/
        page.tsx
        [id]/page.tsx
      pdf-jobs/page.tsx
      settings/page.tsx
    api/
      pdf/
        generate/route.ts
        jobs/route.ts
        jobs/[id]/route.ts
        process/route.ts
      orders/[id]/status/route.ts
      cardholders/
        import/route.ts
        photos/route.ts
      templates/route.ts
```

---

## Phase 13: Dependencies

```bash
npm install pdf-lib              # PDF assembly with precise mm positioning
npm install @pdf-lib/fontkit     # Custom font embedding
npm install canvas               # node-canvas: image compositing engine
npm install qrcode               # QR code generation
npm install jsbarcode            # Barcode generation
npm install sharp                # Image resize / format conversion
npm install md5                  # Template hash for cache invalidation
npm install papaparse            # CSV parsing for bulk import
npm install archiver             # ZIP file handling for photo import
```

---

## Implementation Sequence

| # | Task | Effort |
|---|------|--------|
| 1 | DB schema (Press, PressUser, Client, Cardholder, CardTemplate, CardOrder, CardAsset, PdfJob) | 2h |
| 2 | Auth (press login, JWT, RBAC for OWNER/OPERATOR/DESIGNER) | 3h |
| 3 | Client + Cardholder CRUD | 2h |
| 4 | CSV import + ZIP photo import | 4h |
| 5 | Card rendering engine (node-canvas, coordinate mapper) | 5h |
| 6 | Template builder UI (upload PNG + manual coordinate entry) | 4h |
| 7 | Card preview (single cardholder, live render) | 2h |
| 8 | IPdfGenerator interface + factory | 1h |
| 9 | IndividualPdfGenerator | 3h |
| 10 | ApprovalPdfGenerator (watermark + signature section) | 3h |
| 11 | ProductionPdfGenerator (grid, fold-line, print marks, CMYK) | 6h |
| 12 | PDF Queue system (jobs table, background worker, progress) | 3h |
| 13 | API routes | 3h |
| 14 | Press dashboard UI (orders, jobs, clients) | 5h |
| 15 | Billing / subscription plans (Stripe or manual) | 3h |

**Total Estimated Effort: ~52 hours**

---

## Future PDF Types (no core changes needed)

```typescript
// Just add a new generator class and register it:
registry.set('CERTIFICATE',  new CertificatePdfGenerator());
registry.set('BUS_PASS',     new BusPassPdfGenerator());
registry.set('VISITOR_PASS', new VisitorPassPdfGenerator());
registry.set('STAFF_ID',     new StaffIdPdfGenerator());
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Tenant | Press (print shop) | They pay monthly; schools/companies are just their clients |
| Client/School role | None — record only | Presses manage everything; clients have no login |
| Approval | Offline only | Authority signs paper; press marks approved in app |
| Template system | Background PNG + coordinate JSON | Any design without code changes; press uploads their own artwork |
| Card rendering | node-canvas (pixel compositing) | Precise placement at exact pixel coordinates on background image |
| PDF assembly | pdf-lib | mm-accurate positioning for print marks |
| Color profile | CMYK for production PDF | Required by print vendors |
| Cache | MD5 hash (cardholder data + template) | Avoid re-rendering unchanged cards |
| Queue | DB-backed jobs + cron | Serverless compatible, no Redis needed |
| Storage | Pluggable (local dev / S3 prod) | Easy to swap environments |
| Extensibility | Strategy Pattern | New PDF type = one new class |

---

## Recommended Features (Added)

### R1 — Role-Based PDF Type Permissions (RBAC)

Not every press staff member should generate every PDF type.

| Role | Allowed PDF Types | Other Permissions |
|------|------------------|-------------------|
| OWNER | All types | Billing, user management, all settings |
| OPERATOR | Approval + Individual | Import data, manage cardholders, update order status |
| DESIGNER | None (preview only) | Create/edit templates, preview cards |

Enforced at API level — not just UI.

```typescript
// middleware/pdf-rbac.ts
const PDF_PERMISSIONS = {
  PRODUCTION:  ['OWNER'],
  APPROVAL:    ['OWNER', 'OPERATOR'],
  INDIVIDUAL:  ['OWNER', 'OPERATOR'],
};

export function requirePdfPermission(type: string) {
  return (req, res, next) => {
    if (!PDF_PERMISSIONS[type].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role for this PDF type' });
    }
    next();
  };
}
```

---

### R2 — Selective Regeneration (Dirty Cards Only)

If only 5 cardholders changed after an approval PDF was sent, do not re-render all 300 cards.

**How it works:**
- On any cardholder data edit, compute new templateHash
- Compare with stored CardAsset.templateHash
- If mismatch → mark card as STALE

```prisma
model CardAsset {
  // ...existing fields...
  isStale Boolean @default(false)  // set true when cardholder data changes
}
```

**UI warning before PDF generation:**
```
12 cards outdated since last render.
[Regenerate All (300)]   [Regenerate Only Changed (12)]
```

**Selective render:**
```typescript
const toRender = allCardholders.filter(ch =>
  !assets.get(ch.id) || assets.get(ch.id).isStale
);
```

---

### R3 — Card Print Status Tracking

Track the lifecycle of each printed card. Critical for lost card reprints and delivery tracking.

```prisma
model CardPrintRecord {
  id           Int      @id @default(autoincrement())
  cardholderId Int
  pressId      Int
  orderId      Int
  status       String   // NOT_PRINTED | PRINTED | DISPATCHED | DELIVERED | LOST | REPRINTED
  printedAt    DateTime?
  deliveredAt  DateTime?
  remarks      String?  // "Lost — reprinted on 2026-06-10, fee collected"
  createdAt    DateTime @default(now())

  @@map("card_print_records")
}
```

**Lost Card Reprint Flow:**
```
Press → Cardholder profile → "Report Lost"
  → Status: LOST, remarks logged
  → Generate Individual PDF for that cardholder
  → Mark new record: REPRINTED
```

**Dashboard view:**
```
Cardholder: John Smith
Card Status: DELIVERED ✅  (delivered 2026-06-03)
─────────────────────────
Cardholder: Jane Doe
Card Status: LOST ⚠️   [Generate Reprint PDF]
```

---

### R4 — PDF Download Audit Trail

Track every download of every PDF — especially important for production files containing hundreds of photos.

```prisma
model PdfDownloadLog {
  id          Int      @id @default(autoincrement())
  pdfJobId    Int
  pressId     Int
  downloadedBy Int     // PressUser id
  downloadedAt DateTime @default(now())
  ipAddress   String?

  @@map("pdf_download_logs")
}
```

Logged automatically whenever `/api/pdf/jobs/:id/download` is called.

Visible in Settings → Audit Trail.

---

### R5 — Expiring Signed Download URLs

PDF download URLs must expire. Never store permanent public URLs to files containing cardholder photos.

- **Expiry:** 48 hours after generation
- **Mechanism:** S3 presigned URL or custom signed token
- **On expiry:** UI shows "Link expired — regenerate download link"
- **Re-request:** `POST /api/pdf/jobs/:id/refresh-url` → generates new 48h link

```prisma
model PdfJob {
  // ...existing fields...
  urlExpiresAt DateTime?  // when the downloadUrl becomes invalid
}
```

---

### R6 — Multi-Language Font Support

Cardholder names may be in Hindi, Tamil, Arabic, Urdu, etc. Standard fonts don't cover these.

**Solution:**
- Maintain a font library per press
- Press uploads custom TTF/OTF fonts
- Template field config includes `fontFamily` key
- Card engine loads correct font via `canvas.registerFont()`

```typescript
// Register fonts before rendering
for (const font of press.fonts) {
  registerFont(font.filePath, { family: font.name });
}
```

```prisma
model PressFont {
  id       Int    @id @default(autoincrement())
  pressId  Int
  name     String  // "NotoSansDevanagari"
  fileUrl  String  // S3 path to TTF
  language String  // "hi" | "ta" | "ar" | "ur"
}
```

---

### R7 — PDF/X Compliance for Production PDF

Professional print vendors require **PDF/X-1a** or **PDF/X-4** format. Production PDFs should comply.

Requirements:
- All fonts embedded (fontkit handles this ✅)
- No live transparency (flatten before export)
- CMYK color space (not RGB)
- Embedded ICC color profile (ISOcoated_v2)
- PDF/X OutputIntent metadata

```typescript
// In ProductionPdfGenerator
pdfDoc.setTitle('Production Print File');
pdfDoc.setCreator('ID Card Press Platform');
// Set OutputIntent for PDF/X
pdfDoc.context.obj({
  Type: 'OutputIntent',
  S: 'GTS_PDFX',
  OutputConditionIdentifier: 'FOGRA39',
  RegistryName: 'http://www.color.org',
});
```

---

### R8 — Analytics Dashboard (Press-Level)

Give each press insight into their own usage.

**Metrics shown:**
```
This Month
──────────────────────────────────────
Cards Generated:     1,240
PDFs Generated:      18
Clients Served:      7
Storage Used:        2.3 GB / 5 GB

By PDF Type          By Status
Production:  6       Completed: 15
Approval:    8       Failed:     1
Individual:  4       Pending:    2

Top Clients (by card count)
1. Springfield School     420 cards
2. City Hospital          310 cards
3. Red Cross NGO          180 cards
```

Routes:
```
GET /api/analytics/summary        → monthly summary
GET /api/analytics/jobs           → breakdown by type/status
GET /api/analytics/clients        → top clients by volume
```

---

### R9 — Retention Policy & Auto-Cleanup

Avoid unlimited storage accumulation.

```prisma
model Press {
  // ...existing fields...
  pdfRetentionDays Int @default(90)  // configurable per press plan
}
```

**Cron job (daily):**
```typescript
// Delete expired PDF jobs + files from storage
const expired = await prisma.pdfJob.findMany({
  where: { expiresAt: { lt: new Date() } }
});
for (const job of expired) {
  await deleteFromStorage(job.downloadUrl);
  await prisma.pdfJob.delete({ where: { id: job.id } });
}
```

**UI notice:**
> "PDFs are automatically deleted after 90 days. Download and archive important files."

Card PNGs (CardAsset) are never auto-deleted — they are reused for future PDF generations.

---

### R10 — Subscription Tiers

| Feature | BASIC | PRO | ENTERPRISE |
|---------|-------|-----|------------|
| Cards / month | 500 | 5,000 | Unlimited |
| Clients | 5 | 50 | Unlimited |
| Templates | 3 | 20 | Unlimited |
| PDF retention | 30 days | 90 days | 1 year |
| Storage | 2 GB | 20 GB | 100 GB |
| Custom fonts | ❌ | ✅ | ✅ |
| PDF/X export | ❌ | ✅ | ✅ |
| Analytics | Basic | Full | Full + export |
| Priority support | ❌ | ❌ | ✅ |
| Users per press | 2 | 10 | Unlimited |

Usage tracked monthly. Warning at 80% of limit. Block generation at 100%.

---

### R11 — Pre-Generation Data Completeness Check

Already in Phase 11 — expanded here:

Before generating any PDF, system runs validation:

```typescript
interface ReadinessReport {
  total: number;
  ready: number;             // all required fields present
  missingPhoto: number;
  missingName: number;
  missingRequired: number;   // template-defined required fields
  staleCards: number;        // cached PNG is outdated
}
```

**Template defines which fields are required:**
```json
{ "field": "photo",      "required": true  }
{ "field": "bloodGroup", "required": false }
```

**UI before generation:**
```
Readiness Check: 78 ready / 85 total
  ⚠️  5 missing photo
  ❌  2 missing name (required by template)
  🔄  12 cards outdated (data changed since last render)

[Fix Issues]   [Generate for 78 ready cardholders]   [Cancel]
```

---

## Updated Implementation Sequence

| # | Task | Effort |
|---|------|--------|
| 1 | DB schema (all models incl. CardPrintRecord, PdfDownloadLog, PressFont) | 3h |
| 2 | Auth + RBAC (press login, JWT, role-based PDF permissions) | 3h |
| 3 | Client + Cardholder CRUD | 2h |
| 4 | CSV import + ZIP photo import + completeness report | 5h |
| 5 | Card rendering engine (node-canvas, coordinate mapper, multi-language fonts) | 6h |
| 6 | Template builder UI (upload PNG + coordinate entry + live preview) | 5h |
| 7 | Card preview (single cardholder) | 2h |
| 8 | IPdfGenerator interface + factory | 1h |
| 9 | IndividualPdfGenerator | 3h |
| 10 | ApprovalPdfGenerator (watermark, signature section) | 3h |
| 11 | ProductionPdfGenerator (grid, fold-line, print marks, CMYK, PDF/X) | 7h |
| 12 | PDF Queue (jobs, background worker, progress, completion notifications) | 4h |
| 13 | Selective regeneration (dirty card detection, partial re-render) | 2h |
| 14 | Signed URLs + expiry + download audit trail | 2h |
| 15 | Card print status tracking + lost card reprint flow | 2h |
| 16 | API routes (all endpoints) | 3h |
| 17 | Press dashboard UI (orders, jobs, clients, cardholders) | 6h |
| 18 | Analytics dashboard | 3h |
| 19 | Retention policy + auto-cleanup cron | 2h |
| 20 | Subscription tiers + usage metering + billing (Stripe) | 4h |

**Total Estimated Effort: ~68 hours (core + recommended)**

---

## Phase 14: Missing Features (v3 Addition)

---

### M1 — Order Pricing & Client Invoicing 🔴

The press charges clients per order. The system must track money.

```prisma
model OrderInvoice {
  id            Int      @id @default(autoincrement())
  orderId       Int      @unique
  pressId       Int
  pricePerCard  Decimal  @map("price_per_card")
  cardCount     Int      @map("card_count")
  subtotal      Decimal
  taxPercent    Decimal  @default(0)   @map("tax_percent")
  taxAmount     Decimal  @default(0)   @map("tax_amount")
  totalAmount   Decimal  @map("total_amount")
  paymentStatus String   @default("UNPAID")  // UNPAID | PARTIAL | PAID
  paymentMethod String?  @map("payment_method")  // CASH | UPI | BANK_TRANSFER | CHEQUE
  paidAmount    Decimal  @default(0)   @map("paid_amount")
  paidAt        DateTime? @map("paid_at")
  invoicePdfUrl String?  @map("invoice_pdf_url")
  notes         String?
  createdAt     DateTime @default(now())

  order         CardOrder @relation(fields: [orderId], references: [id])

  @@map("order_invoices")
}
```

**Invoice PDF** is a separate PDF type from card PDFs:
- Press name, address, GST number
- Client name, address
- Line item: "ID Cards × 85 @ ₹45 = ₹3,825"
- Tax, total, payment status
- Generated by `InvoicePdfGenerator` (registered in factory)

**UI:**
```
Order: City Hospital — 85 cards
Price per card:  ₹45
Subtotal:        ₹3,825
GST (18%):       ₹688.50
Total:           ₹4,513.50
Payment:         UPI — PAID ✅
[Download Invoice PDF]
```

---

### M2 — Card Serial Number Management 🔴

Every physical ID card needs a unique sequential number.

```prisma
model CardSerialCounter {
  id       Int    @id @default(autoincrement())
  pressId  Int
  clientId Int
  prefix   String   // "STU" | "EMP" | "VOL"
  lastSeq  Int      @default(0)
  padLen   Int      @default(4)  // STU-0001 vs STU-00001

  @@unique([pressId, clientId, prefix])
  @@map("card_serial_counters")
}
```

Serial auto-assigned at cardholder creation:
```typescript
async function assignSerial(pressId, clientId, prefix): Promise<string> {
  const counter = await prisma.cardSerialCounter.update({
    where: { pressId_clientId_prefix: { pressId, clientId, prefix } },
    data: { lastSeq: { increment: 1 } },
  });
  return `${prefix}-${String(counter.lastSeq).padStart(counter.padLen, '0')}`;
  // → "STU-0042"
}
```

`cardSerial` stored on `Cardholder` record and available as a template coordinate field: `{ "field": "cardSerial", "type": "text", ... }`.

---

### M3 — Card Expiry Date 🔴

Most ID cards show "Valid Till" printed on the card itself.

```prisma
model CardOrder {
  // ...existing fields...
  validTill DateTime? @map("valid_till")  // e.g. 2027-03-31
}
```

- Set at order level — applies to all cards in the order
- Available as reserved template field: `{ "field": "validTill", "type": "text" }`
- Formatted at render time: "Valid Till: March 2027"
- UI date picker on order creation form

---

### M4 — Photo Quality Validation 🔴

Reject substandard photos before they reach the card.

**Checks performed on upload:**
| Check | Requirement | Action on Fail |
|-------|------------|----------------|
| Minimum resolution | ≥ 300×400px | Reject + error |
| Aspect ratio | 3:4 (portrait) ± 20% | Warn operator |
| File size | ≤ 5MB | Reject + error |
| File type | JPG / PNG / WEBP | Reject + error |
| Brightness | Not too dark/bright | Warn operator |

```typescript
async function validatePhoto(buffer: Buffer): Promise<ValidationResult> {
  const meta = await sharp(buffer).metadata();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (meta.width < 300 || meta.height < 400)
    errors.push(`Too small: ${meta.width}×${meta.height}px. Minimum 300×400px.`);

  const ratio = meta.width / meta.height;
  if (ratio < 0.6 || ratio > 0.9)
    warnings.push(`Unusual aspect ratio. Expected portrait (3:4).`);

  return { valid: errors.length === 0, errors, warnings };
}
```

Also applied during ZIP bulk photo import — each photo validated, failures reported in import summary.

---

### M5 — Duplicate Cardholder Detection 🔴

Prevent re-importing the same cardholder twice.

**Detection logic:**
- Match on `name + designation` within same client
- Or match on a unique field if defined in template (e.g. `empId`, `rollNumber`)

**On CSV import:**
```
Import Summary — 85 rows processed:
✅ 78 new cardholders added
⚠️  5 possible duplicates detected:
     Row 12: "John Smith — Employee" already exists (added Jun 1)
     Row 34: "Jane Doe — Employee" already exists (added Jun 1)
     ...
[Skip duplicates]   [Update existing]   [Import as new anyway]
```

```prisma
model Cardholder {
  // ...existing fields...
  uniqueKey String?  // optional: empId, rollNumber, etc. for dedup
  @@unique([clientId, uniqueKey])  // enforced when uniqueKey is set
}
```

---

### M6 — Order Status Audit Log 🔴

Every status change on an order is recorded — who did it and when.

```prisma
model OrderActivityLog {
  id          Int      @id @default(autoincrement())
  orderId     Int
  pressId     Int
  actorId     Int      // PressUser id
  actorName   String
  action      String   // STATUS_CHANGED | NOTE_ADDED | PDF_GENERATED | CARDHOLDER_ADDED | ...
  fromStatus  String?
  toStatus    String?
  note        String?
  createdAt   DateTime @default(now())

  @@map("order_activity_logs")
}
```

**Displayed on order detail page:**
```
Activity
──────────────────────────────────────────────────────
Jun 3, 09:12 AM  Ravi      Created order
Jun 3, 02:45 PM  Ravi      Generated Approval PDF (85 cards)
Jun 3, 03:00 PM  Ravi      Status → APPROVAL_PDF_SENT
Jun 4, 11:00 AM  Ahmed     Status → APPROVED
Jun 5, 09:30 AM  Ravi      Generated Production PDF
Jun 5, 04:00 PM  Ravi      Status → DELIVERED
```

---

### M7 — Super Admin Panel (Platform Owner) 🔴

You (the SaaS owner) need a separate admin panel to manage all presses.

**Routes:** `/superadmin/...` — protected by separate super admin auth

**Features:**
```
All Presses
──────────────────────────────────────────────────
Sri Lakshmi Printers   PRO    Active    1,240 cards this month
City Press Centre      BASIC  Active      320 cards this month
Sharma Enterprises     PRO    Suspended   —
Quick Print Co.        TRIAL  Active       85 cards (trial)

[Suspend]  [Change Plan]  [Reset Password]  [View Usage]
```

**Super Admin capabilities:**
- View all presses, their plan, status, usage
- Suspend / reactivate a press
- Manually override plan limits
- Impersonate a press (view their dashboard as them)
- Platform-wide analytics: total cards/month, MRR, active presses
- Manage subscription pricing
- View all PdfDownloadLogs across platform

```prisma
model SuperAdmin {
  id           Int    @id @default(autoincrement())
  email        String @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())

  @@map("super_admins")
}
```

---

### M8 — Press Onboarding / Signup 🔴

How a new press gets access to the platform.

**Flow:**
```
1. Press visits landing page → clicks "Start Free Trial"
2. Fills signup form:
   - Press name, owner name
   - Email, phone
   - City / state
   - Plan selection (or start with 14-day trial)
3. Email verification sent
4. On verify → press account created, owner user created
5. Onboarding checklist shown:
   ✅ Account created
   ○ Add your first client
   ○ Upload a card template
   ○ Import cardholders
   ○ Generate your first PDF
6. Trial: 14 days, 100 cards, all features
7. After trial: prompt to enter payment (Stripe)
```

**Trial model:**
```prisma
model Press {
  // ...existing fields...
  trialEndsAt    DateTime? @map("trial_ends_at")
  stripeCustomerId String? @map("stripe_customer_id")
  stripeSubId     String? @map("stripe_sub_id")
}
```

---

### M9 — Order Notes & Internal Comments 🟡

Press staff need to leave internal notes on orders.

```prisma
model OrderNote {
  id        Int      @id @default(autoincrement())
  orderId   Int
  pressId   Int
  authorId  Int      // PressUser id
  authorName String
  content   String
  createdAt DateTime @default(now())

  @@map("order_notes")
}
```

**UI — shown on order detail page:**
```
Internal Notes
──────────────────────────────────────
Jun 3 — Ravi:  "Client wants glossy lamination on front side"
Jun 4 — Ahmed: "Principal called — wants 5 extra cards added"
Jun 4 — Ravi:  "5 new cardholders added. Regenerating approval PDF."

[Add note...]
```

Notes are internal only — never visible to clients.

---

### M10 — Order Clone / Duplicate 🟡

Repeat orders from the same client (e.g. every academic year) should be cloneable.

**Clone creates:**
- New `CardOrder` with same `clientId`, `templateId`, `pricePerCard`
- Status: DRAFT
- Cardholder data: NOT copied (fresh import required)
- Serial counter: continues from where last order left off

**UI:**
```
Order: Springfield School — Jun 2026
[Clone Order] → "Cloned as: Springfield School — New Order (DRAFT)"
```

---

### M11 — Template Versioning 🟡

Editing a template after PDFs have been generated creates inconsistency. Templates must be versioned.

```prisma
model CardTemplate {
  // ...existing fields...
  version   Int     @default(1)
  parentId  Int?    @map("parent_id")  // points to previous version
  isLatest  Boolean @default(true)     @map("is_latest")
}

model CardOrder {
  // ...existing fields...
  templateVersion Int @default(1) @map("template_version")  // locked at order creation
}
```

**Behaviour:**
- Editing a template creates a new version (old version preserved)
- Existing orders keep their locked version
- Press can choose to upgrade an order to latest template version
- Card cache hash includes `templateId + templateVersion`

---

### M12 — PDF Version History Per Order 🟡

Track every PDF generated for an order — multiple approval rounds, final production.

```prisma
model PdfJob {
  // ...existing fields...
  version    Int    @default(1)  // increments per pdfType per order
  label      String?             // "Approval v1" | "Approval v2" | "Production Final"
}
```

**Order detail page:**
```
PDF History
──────────────────────────────────────────────────────
v1  Approval PDF    Jun 3, 02:45 PM  85 cards  [Download]
v2  Approval PDF    Jun 4, 03:10 PM  87 cards  [Download]  ← 2 added
v1  Production PDF  Jun 5, 09:30 AM  87 cards  [Download]
```

Only the latest version of each type shown by default. Full history expandable.

---

### M13 — Delivery Notes & Recipient Tracking 🟡

Record who received the printed cards on delivery.

```prisma
model DeliveryRecord {
  id            Int      @id @default(autoincrement())
  orderId       Int      @unique
  pressId       Int
  deliveredTo   String   @map("delivered_to")    // "Mr. Sharma, Vice Principal"
  deliveredAt   DateTime @map("delivered_at")
  deliveredBy   String   @map("delivered_by")    // press staff name
  cardCount     Int      @map("card_count")
  remarks       String?                           // "2 cards damaged, reprint needed"
  signatureUrl  String?  @map("signature_url")   // optional photo of signed receipt

  @@map("delivery_records")
}
```

**UI trigger:** When order is marked DELIVERED, a modal collects delivery details before confirming.

---

### M14 — WhatsApp PDF Sharing 🟢

Press frequently shares the approval PDF via WhatsApp. One-click from the app saves manual download + share steps.

**Flow:**
- Job completed → "Share via WhatsApp" button appears
- Press enters client's WhatsApp number (or picks from client record)
- System sends file via WhatsApp Business API (Meta) or wa.me link fallback

```typescript
// wa.me fallback (no API key needed)
const waUrl = `https://wa.me/${phone}?text=Please find attached the approval PDF for review: ${signedDownloadUrl}`;
// Opens WhatsApp with pre-filled message
```

**Client record stores:**
```prisma
model Client {
  // ...existing fields...
  whatsappNumber String? @map("whatsapp_number")
}
```

---

### M15 — Data Privacy & Cardholder Deletion 🟢

Cardholder photos and personal data must be deletable on request.

**Hard delete cascade:**
```
Delete Cardholder
  → Delete CardAsset (S3 files: front.png, back.png)
  → Delete CardPrintRecord
  → Remove from any CardOrder.cardholderIds
  → Log deletion in OrderActivityLog
```

**Delete all data for a client:**
```
Delete Client
  → Cascade delete all cardholders
  → Cascade delete all card assets from S3
  → Cascade delete all PDF jobs (S3 files)
  → Delete client record
  → Log in SuperAdmin audit trail
```

**UI:** Settings → Data Management → "Delete all data for client" (requires owner role, confirmation prompt).

---

### M16 — Mobile Responsive UI 🟢

Press owner checks order status from phone. Core flows must work on mobile.

**Desktop-only (acceptable):**
- Template builder coordinate mapper
- CSV import with column mapping

**Must work on mobile:**
- Order list + status update
- Cardholder list + search
- PDF job status + download
- Notifications
- Analytics summary

---

### M17 — Client REST API 🟢

Large institutions push cardholder data programmatically instead of CSV upload.

```
POST   /api/v1/cardholders        ← create single cardholder
PUT    /api/v1/cardholders/:id    ← update cardholder data
DELETE /api/v1/cardholders/:id    ← remove cardholder
POST   /api/v1/cardholders/bulk   ← batch create
GET    /api/v1/orders/:id/status  ← check order status
```

Authenticated via **API key** per press (not user JWT):
```prisma
model PressApiKey {
  id        Int      @id @default(autoincrement())
  pressId   Int
  keyHash   String   @unique   // store hashed key only
  label     String             // "Hospital ERP Integration"
  lastUsed  DateTime?
  createdAt DateTime @default(now())

  @@map("press_api_keys")
}
```

---

### M18 — Print Vendor Directory 🟢

Record which vendor a production PDF was sent to.

```prisma
model PrintVendor {
  id      Int    @id @default(autoincrement())
  pressId Int
  name    String
  phone   String?
  email   String?
  city    String?
  notes   String?

  @@map("print_vendors")
}

model PdfJob {
  // ...existing fields...
  vendorId   Int?     @map("vendor_id")    // which vendor this was sent to
  sentToVendorAt DateTime? @map("sent_to_vendor_at")
}
```

---

### M19 — Google Sheets / Excel Online Import 🟢

Many clients maintain data in Google Sheets. Import directly without CSV download step.

**Google Sheets:** Paste spreadsheet URL → system reads via Google Sheets API (public sheets only)

**Excel online:** Upload `.xlsx` file → parsed server-side via `xlsx` npm package

```bash
npm install xlsx    # parse .xlsx files
```

Column mapping UI same as CSV import flow.

---

## Final Implementation Sequence

| # | Task | Effort |
|---|------|--------|
| 1 | DB schema (all models including new ones) | 4h |
| 2 | Auth + RBAC + Super Admin auth | 4h |
| 3 | Press onboarding / signup + trial logic | 4h |
| 4 | Super Admin panel | 5h |
| 5 | Client + Cardholder CRUD | 2h |
| 6 | CSV + XLSX + Google Sheets import + duplicate detection | 6h |
| 7 | ZIP photo import + photo quality validation | 4h |
| 8 | Card serial number management | 2h |
| 9 | Card rendering engine (node-canvas, coordinates, multi-lang fonts) | 6h |
| 10 | Template setup UI (image upload + coordinate form + preview) + template versioning | 4h |
| 11 | Card preview (single cardholder, live) | 2h |
| 12 | IPdfGenerator interface + factory | 1h |
| 13 | IndividualPdfGenerator | 3h |
| 14 | ApprovalPdfGenerator (watermark, signature section) | 3h |
| 15 | ProductionPdfGenerator (grid, fold-line, print marks, CMYK, PDF/X) | 7h |
| 16 | InvoicePdfGenerator | 3h |
| 17 | PDF Queue (jobs, worker, progress, notifications, version history) | 5h |
| 18 | Selective regeneration (dirty card detection) | 2h |
| 19 | Signed URLs + expiry + download audit trail | 2h |
| 20 | Card print status + lost card reprint + delivery records | 3h |
| 21 | Order notes + order activity log | 2h |
| 22 | Order clone / duplicate | 1h |
| 23 | Order invoicing + payment tracking | 4h |
| 24 | Card expiry date + valid-till on card | 1h |
| 25 | WhatsApp PDF sharing | 2h |
| 26 | Data privacy + cardholder deletion cascade | 2h |
| 27 | Client REST API + API key management | 4h |
| 28 | Print vendor directory | 1h |
| 29 | API routes (all endpoints) | 4h |
| 30 | Press dashboard UI (orders, jobs, clients, cardholders) | 7h |
| 31 | Analytics dashboard | 3h |
| 32 | Retention policy + auto-cleanup cron | 2h |
| 33 | Subscription tiers + usage metering + Stripe billing | 5h |
| 34 | Mobile responsive UI polish | 3h |

**Total Estimated Effort: ~115 hours**
