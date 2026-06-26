import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { config } from './config';

const JWT_SECRET = new TextEncoder().encode(config.jwtSecret);

export interface UserSessionPayload {
  userId: number;
  pressId: number;
  email: string;
  role: 'OWNER' | 'OPERATOR' | 'DESIGNER';
  name: string;
  isSuperAdmin?: boolean;
}

export interface SuperAdminSessionPayload {
  adminId: number;
  email: string;
  name: string;
  isSuperAdmin: true;
}

// Password operations
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT signing for Press Users
export async function signUserToken(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

// JWT signing for Super Admins
export async function signSuperAdminToken(payload: SuperAdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(JWT_SECRET);
}

// JWT verification
export async function verifyToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSessionPayload;
  } catch (error) {
    return null;
  }
}

// Get session from cookies in Next.js Server Actions/Route Handlers
export async function getSession(): Promise<UserSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('press_auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Get super admin session from cookies
export async function getSuperAdminSession(): Promise<SuperAdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('super_auth_token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (payload && payload.isSuperAdmin) {
    return payload as unknown as SuperAdminSessionPayload;
  }
  return null;
}

// Session parser for middleware/Edge compatible requests
export async function getSessionFromRequest(req: NextRequest): Promise<UserSessionPayload | null> {
  const token = req.cookies.get('press_auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}
