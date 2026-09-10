export interface PressClient {
    id: number;
    name: string;
    type: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    createdAt: string;
    totalOrders: number;
    totalCards: number;
    totalRevenue: number;
}

export interface PressUserItem {
    id: number;
    name: string;
    email: string;
    role: string;
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}

export interface Press {
    id: number;
    name: string;
    email: string;
    phone: string;
    city: string;
    plan: string;
    isActive: boolean;
    credits: number;
    trialEndsAt: string | null;
    createdAt: string;
    totalCardsPrinted: number;
    totalRevenue: number;
    users?: PressUserItem[];
    clients: PressClient[];
    _count: {
        users: number;
        clients: number;
        orders: number;
        jobs: number;
        };
}

export const categoryColor: Record<string, string> = {
      TEMPLATE: '#818cf8',
      SECURITY: '#f87171',
      BILLING:  '#34d399',
      USER:     '#60a5fa',
      PORTAL:   '#a78bfa',
      ORDER:    '#fbbf24',
      SYSTEM:   '#94a3b8',
    };
