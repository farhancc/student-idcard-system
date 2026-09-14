export interface Client {
  id: number;
  name: string;
}

export interface Cardholder {
  id: number;
  name: string;
  designation?: string;
  photoUrl?: string;
  uniqueKey?: string;
  cardSerial?: string;
  createdAt: string;
  resolvedTemplateId?: number;
  templateName?: string;
  customFields?: string; // JSON string
}

export interface CSVImportResult {
  mode: string;
  totalRows: number;
  newAdded: number;
  updated: number;
  skipped: number;
  duplicateCount: number;
  success?: boolean;
  error?: string;
}

export interface ZipDetail {
  fileName: string;
  status: string;
  cardholderName?: string;
  message?: string;
  errors?: string[];
  warnings?: string[];
}

export interface ZIPImportResult {
  summary?: {
    totalFiles: number;
    matchedCount: number;
    failedValidationCount: number;
    unmatchedCount: number;
  };
  details?: ZipDetail[];
}

export interface SerialResult {
  assignedCount: number;
  lastAllocated: number;
}

export interface QuickTemplate {
  id: number | string;
  name: string;
}

export interface QuickJobResult {
  id: string | number;
  pdfType: string;
  status: string;
  progress: number;
  isLocalJob?: boolean;
  downloadUrl?: string;
  errorMsg?: string;
  orderId?: number;
  autoDownloaded?: boolean;
  chunkCount?: number;
  chunks?: Array<{ chunkIndex: number; fileName: string; downloadUrl: string }>;
}


