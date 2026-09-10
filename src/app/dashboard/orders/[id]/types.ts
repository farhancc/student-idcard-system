export interface OrderClient {
  id: number;
  name: string;
}

export interface OrderInvoice {
  id: number;
  pricePerCard: number;
  taxPercent: number;
  cardCount: number;
  paymentStatus: string;
  paymentMethod?: string;
  notes?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export interface PrintJobDetail {
  id: number;
  pdfType: string;
  status: string;
  progress: number;
  label?: string;
  version: number;
  expiresAt?: string;
  isLocalJob?: boolean;
  downloadUrl?: string;
  errorMsg?: string;
  fileName?: string;
  orderId?: number;
}

export interface OrderTemplate {
  id: number;
  name: string;
  cardWidth?: number;
  cardHeight?: number;
  backImageUrl?: string | null;
  backFields?: string | null;
}

export interface OrderDetail {
  id: number;
  clientId: number;
  templateId: number;
  status: string;
  client?: OrderClient;
  template?: OrderTemplate;
  invoice?: OrderInvoice;
  pdfJobs?: PrintJobDetail[];
  _count?: {
    cardholders: number;
  };
  cardholders?: any[];
}

export interface OrderLog {
  id: number;
  timestamp: string;
  actorName: string;
  action: string;
  note?: string;
}

export interface OrderNote {
  id: number;
  createdAt: string;
  authorName: string;
  note: string;
}

export interface OrderCardholder {
  id: number;
  name?: string;
  designation?: string;
  photoUrl?: string;
  customFields?: string | Record<string, any>;
}

export interface SerialAssignmentConfig {
  prefix?: string;
  startNumber?: number;
  padding?: number;
}
