# IDexo ID Card Production Platform — System Data Flow & End-to-End Workflow

This document provides a comprehensive overview of the **IDexo Hybrid ID Card Generation Platform**. It illustrates how data flows between the cloud server, client portal, database, and the native desktop client, as well as the print-production and data archiving workflows. 

Press owners can share this documentation with their technical teams, operations managers, and customers (e.g., schools, universities, and corporate clients) to explain the platform's security, efficiency, speed, and overall data integrity.

---

## 1. High-Level Architecture Overview

IDexo is built on a **hybrid cloud-local architecture**:
*   **Cloud Platform (SaaS Console):** Handles client onboarding, template design mapping, database records, order statuses, billing, and the collaborative data intake portal.
*   **Client Intake Portal:** A secure, tokenized web interface for client organizations to upload rosters (Excel/CSV) and student/employee photos (ZIP folder or individual cameras).
*   **Electron Desktop Client:** A native application running on the printing press's local workstation. To offload heavy server-side CPU utilization, high-resolution PDF rendering, grid generation, and print-mark layout are compiled locally, saving file buffers directly to the OS filesystem.

---

## 2. End-to-End System Workflow

The following flowchart illustrates the entire business lifecycle, from press owner registration to card printing, delivery, and eventual data archiving:

```mermaid
graph TD
    %% Define Styles
    classDef cloud fill:#f0f3ff,stroke:#4f46e5,stroke-width:2px;
    classDef client fill:#ecfdf5,stroke:#059669,stroke-width:2px;
    classDef desktop fill:#fff7ed,stroke:#ea580c,stroke-width:2px;
    classDef physical fill:#fef2f2,stroke:#dc2626,stroke-width:2px;

    subgraph SAAS ["Cloud Platform (SaaS Web Console)"]
        A["Superadmin Allocates Credits"] --> B["Press Owner Registers & Subscribes"]
        B --> C["Press Creates Client & Configures Card Template"]
        C --> D["Generate Secure Tokenized Share Link"]
        D -. Secure Token Link .-> E
        E["Client Representatives Onboard Data (Excel + Photos ZIP)"] --> F["Press Operator Reviews & Validates Records"]
        F --> G["Generate Watermarked Approval Proof PDF (Cost: 20 Credits)"]
        G --> H{"Client Approves Proof?"}
        H -- "Rejections / Corrections" --> E
        H -- "Signs off Layout & Spelling" --> I["Operator Marks Order as APPROVED"]
        I --> J["Operator Enqueues Production Print PDF Job"]
        J --> K{"Atomic Credit Check"}
        K -- "Insufficient Balance" --> L["Prompt Press to Purchase Credits"]
        K -- "Sufficient Balance" --> M["Deduct & Lock Credits / Queue PENDING Job"]
    end

    subgraph CLIENT ["Client Environment"]
        E
    end

    subgraph ELECTRON ["IDexo Desktop Client (Electron)"]
        N["Desktop Client Polls API for PENDING Jobs"] <== API ==> M
        N --> O["Fetch Template Coordinates & Cardholder Assets"]
        O --> P["Render Card PNGs Locally via Node-Canvas"]
        P --> Q["Assemble Sheet PDF with Fold-Line Alignments & Crop Marks"]
        Q --> R["Save High-Res PDF to Local Documents Directory"]
        R --> S{"Compilation Successful?"}
        S -- "Yes" --> T["API: Report Complete (Capture Credits permanently)"]
        S -- "No" --> U["API: Report Failed (Refund Credits to Press)"]
    end

    subgraph PRESS ["Physical Production & Archive"]
        T --> V["Print Production PDF on Sheet/A3 Media"]
        V --> W["Fold Sheet along Fold-Lines & Cut along Crop Marks"]
        W --> X["Package, Deliver, and Sign off Delivery in System"]
        X --> Y["90-Day Retention Limit Reached"]
        Y --> Z["Local Backup (Excel + Photos ZIP) & Automatic Cloud Purge"]
    end

    class A,B,C,D,F,G,H,I,J,K,L,M cloud;
    class E client;
    class N,O,P,Q,R,S,T,U desktop;
    class V,W,X,Y,Z physical;
```

---

## 3. Detailed Data Flow Architecture

The mapping below outlines how data moves between database entities, file storage systems, API routes, and local machines during operations:

```mermaid
graph LR
    %% Style Definitions
    classDef db fill:#f5f3ff,stroke:#7c3aed,stroke-width:2px;
    classDef api fill:#f0fdf4,stroke:#16a34a,stroke-width:2px;
    classDef storage fill:#fff1f2,stroke:#e11d48,stroke-width:2px;
    classDef local fill:#fffbeb,stroke:#d97706,stroke-width:2px;

    %% Database Entities
    subgraph DB ["PostgreSQL Cloud Database (Prisma)"]
        T1[("Press & Credits Balance")]
        T2[("Cardholders & CustomFields JSON")]
        T3[("CardTemplates & Coordinates")]
        T4[("PdfJobs Queue")]
        T5[("CardAssets Cache (Front/Back PNG URLs)")]
    end

    %% Cloud Storage
    subgraph CLOUD_STORAGE ["Cloud Media Storage"]
        S1["Cloudinary / S3 (Backgrounds, Photos, Rendered Cards)"]
    end

    %% API Endpoints
    subgraph API ["API Server (Next.js Routes)"]
        A1["/api/portal/shares/[token]"]
        A2["/api/jobs/production-request"]
        A3["/api/jobs/production-poll"]
        A4["/api/jobs/production-complete"]
    end

    %% Desktop Environment
    subgraph LOCAL_DESKTOP ["Local Client Machine (Electron)"]
        D1["Local Canvas Engine"]
        D2["PDF Compiler (pdf-lib)"]
        D3["Documents Directory (Student_ID_Prints)"]
        D4["Storage Backup Directory (IDexo_Backups)"]
    end

    %% Data Mapping Connections
    A1 -- "Uploads Data & Photo ZIP" --> T2
    A1 -- "Stores Profile Photos" --> S1
    
    A2 -- "Deducts & Locks Credits" --> T1
    A2 -- "Registers Queue Entry" --> T4
    
    A3 -- "Fetches PENDING Job Details" --> T4
    A3 -- "Extracts Template Coordinates" --> T3
    A3 -- "Retrieves Roster Records" --> T2
    
    A4 -- "Finalizes Status & Captures / Refunds" --> T1
    A4 -- "Marks Job Completed/Failed" --> T4

    %% Electron interactions
    T4 -. "Poll Request" .-> A3
    A3 -- "Job JSON Data" --> LOCAL_DESKTOP
    S1 -- "Downloads Profile Images" --> D1
    T3 -. "Coordinates Map" .-> D1
    
    D1 -- "Generates Cards" --> T5
    D1 -- "Passes Card Buffers" --> D2
    D2 -- "Writes Print Files" --> D3
    D2 -- "Triggers Status Report" --> A4
    
    D4 -- "Retrieves records for cleanup" --> T2
    D4 -- "Triggers Cloud Purge" --> S1

    class T1,T2,T3,T4,T5 db;
    class A1,A2,A3,A4 api;
    class S1 storage;
    class D1,D2,D3,D4 local;
```

---

## 4. Phase-by-Phase Process Breakdown

### Phase 1: Roster & Photo Intake (Client Portal)
*   **Security:** Access is fully tokenized (`ClientPortalShare` table). The client doesn't need platform account credentials; instead, they access via an encrypted URL token.
*   **Roster Upload:** Clients upload an Excel/CSV spreadsheet. The system dynamically maps column headers to the template's required variables (e.g., student name, grade, date of birth, blood group).
*   **Photos Intake:** Photos can be uploaded in bulk via a structured ZIP archive (matching filenames to student roll numbers/IDs) or captured/cropped individually using webcam integration.
*   **Data Integrity Check:** Before an order can move forward, the system runs strict validation checks to flag missing photos, missing critical text fields, or duplicate identifiers.

### Phase 2: Design Mapping & Asset Caching (Press Designer)
*   **Template Coordinates:** In the designer panel, the Press defines exactly where text fields, photos, barcode formats, and QR codes go relative to the card's background image. This layout is stored in `CardTemplate.frontFields` and `backFields` as a JSON coordinate mapping.
*   **Caching (`CardAsset`):** To avoid redundant image generation, cards are compiled once per cardholder and cached. If cardholder details or coordinates change, the cache invalidation algorithm calculates a new MD5 template hash and marks `CardAsset.isStale = true`, forcing a re-render during the next preview or export.

### Phase 3: Approval Cycle & Client Sign-off
*   **Watermarked Proof Sheets:** The press generates an **Approval PDF**. The cloud system compiles the cardholders' cached assets side-by-side (4 or 8 cards per page) with a prominent diagonal watermark (`PROOF SHEET — FOR CLIENT APPROVAL ONLY`).
*   **Cost Structure:** Generation of an approval PDF costs a flat fee of **20 credits** per export.
*   **Client Sign-off:** The PDF contains a signature sheet on the last page. The client representative signs this sheet physically or approves the digital layout. The Press Operator then clicks **Mark as Approved** in the system, transitioning the order status from `APPROVAL_PDF_SENT` to `APPROVED`. This status transition unlocks final production PDF generation.

### Phase 4: Atomic Credit Lock & Job Queue
*   **Deduction Scheme:** Generation of the print-ready file requires credits per cardholder:
    *   **Single-Sided Cards:** 10 credits per cardholder.
    *   **Double-Sided Cards:** 15 credits per cardholder.
*   **Pessimistic Locking:** To prevent double-spending or race conditions over network delays, queuing a production job triggers an atomic transaction:
    1.  The database locks the Press's balance row using `SELECT ... FOR UPDATE`.
    2.  If the balance is sufficient, the system deducts the required credits.
    3.  A `PdfJob` is logged with status `PENDING` and `isLocalJob: true`.
    4.  If the compilation subsequently fails on the client, the transaction automatically refunds the locked credits back to the Press's balance.

### Phase 5: Local Desktop Compilation (Electron)
*   **Polling:** The Electron desktop client polls `/api/jobs/production-poll` once per minute.
*   **Local Rendering:** When a job is fetched, the local Node-Canvas engine downloads the card background templates and cardholder photos, rendering them on a raw canvas at 300 DPI.
*   **Fold-Line Grid Layout:** The compiler groups front and back designs onto A3/sheet grids according to a row-mirroring fold algorithm:
    *   *Front side:* Rendered normal (e.g., Column 1, 2, 3, 4, 5).
    *   *Back side:* Mirrored horizontally (Column 5, 4, 3, 2, 1) and placed below the fold line.
    *   This ensures that when the physical sheet is printed and folded back-to-back, the front and back of each student's card align perfectly before trimming.
*   **Print Marks:** The layout compiler injects:
    *   *Crop marks:* Outer trim lines (5mm hairpins) defining where the cutter cuts the plastic.
    *   *Bleed margins:* Extra background design (3mm) extending past crop marks to prevent white borders due to paper shifting.
    *   *Safe zones:* Margin guidelines inside the card boundary.
    *   *Registration marks:* Targets for high-precision printer calibration.
*   **OS Level Save:** The compiled binary buffer is saved directly to the local PC's documents folder under `/Documents/Student_ID_Prints/Production/`.
*   **Status Update:** The desktop app reports back to `/api/jobs/production-complete`. The server updates the database status to `PRINTING` and records individual `CardPrintRecord` logs.

### Phase 6: Delivery & 90-Day Retention Purge
*   **Delivery Sign-off:** After physical printing, laminating, and cutting, cards are dispatched. The Press Operator inputs the carrier details, count, and scans or uploads a client signature to mark the order as `DELIVERED`.
*   **Automated Archiving Daemon:** In compliance with strict student data privacy regulations (e.g., GDPR/COPPA), cardholder records cannot sit indefinitely on cloud databases. Every week, the Desktop Client runs a retention script:
    1.  Queries the server for records older than 90 days.
    2.  Extracts the metadata into a local backup Excel sheet (`backup_data.xlsx`).
    3.  Downloads profile pictures, saving them locally in `/IDexo_Backups/{clientName}/{templateName}/{date}/photos.zip`.
    4.  Calls the cloud deletion API to permanently purge the student records, custom fields, and profile photos from PostgreSQL and Cloudinary, leaving the press with a secure local archive.

---

## 5. System Limits & Plan Boundaries

For planning resource allocations, the platform enforces the following system boundaries:

| Plan Level | Max Card Count (Per Order) | Monthly Volume Limits | Production Grids (A3, Bleeds, Marks) | Pricing |
| :--- | :--- | :--- | :--- | :--- |
| **Free Trial** | Up to 100 total cards | N/A | Available (Subject to 100 total limit) | 14 Days Free |
| **BASIC Plan** | 500 cards | 10,000 cards / month | **Not Available** (Individual PDFs only) | Monthly Sub. |
| **PRO Plan** | 2,500 cards | 50,000 cards / month | **Available** | Monthly Sub. + Credits |
| **ENTERPRISE** | Custom | Custom | **Available** (Custom paper grids supported) | Custom Quote |
