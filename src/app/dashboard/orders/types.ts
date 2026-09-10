export interface Cardholder {
  id: number;
  name: string;
  designation: string | null;
  uniqueKey: string | null;
  photoUrl: string | null;
  customFields: Record<string, any>;
  hasPhoto: boolean;
  sanitizedKey: string;
  imageId: string | null;
  cardSerial?: string | null;
  originalIndex?: number;
}

export interface Order {
  id: number;
  client?: { name: string };
  status: string;
  template?: { name: string };
  templateVersion?: number;
  cardholders?: any[];
  _count?: { cardholders: number };
  invoice?: {
    totalAmount: string | number;
    paymentStatus: string;
  };
}

export interface Client {
  id: number;
  name: string;
}

export interface Template {
  id: number;
  name: string;
  version: number;
  frontFields?: string;
  backFields?: string;
  cardWidth?: number;
  cardHeight?: number;
  backImageUrl?: string | null;
}
