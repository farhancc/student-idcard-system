import { jwtVerify } from 'jose';

const jwtSecretRaw = process.env.JWT_SECRET;
if (!jwtSecretRaw) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'The application cannot verify authentication tokens without it.'
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

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
