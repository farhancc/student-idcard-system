import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

export interface UserSessionPayload {
  userId: number;
  pressId: number;
  email: string;
  role: 'OWNER' | 'OPERATOR' | 'DESIGNER';
  name: string;
  isSuperAdmin?: boolean;
}

export async function verifyToken(token: string): Promise<UserSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSessionPayload;
  } catch (error) {
    return null;
  }
}
