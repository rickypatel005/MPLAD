/**
 * SIH26102 — JWT Authentication & Role-Based Access Control Middleware (Phase 9)
 * Upgraded with salted scrypt key-derivation password hashing & strict RBAC.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { UserRole } from '../types.ts';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DemoUser {
  user_id: string;
  username: string;
  password_hash: string; // formatted as "salt:hexHash"
  display_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface JwtPayload {
  user_id: string;
  username: string;
  role: UserRole;
  display_name: string;
  iat: number;
  exp: number;
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const configuredJwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !configuredJwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.');
}
// Local/test tokens deliberately use a process-ephemeral secret. It cannot be
// reused to sign production tokens and is never a shipped fallback credential.
const JWT_SECRET = configuredJwtSecret || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY_HOURS = 24;

// ─────────────────────────────────────────────
// Cryptographic Password Hashing (scrypt)
// ─────────────────────────────────────────────

/**
 * Hash a password using scrypt KDF with a cryptographically secure random salt.
 * Returns format: "salt:hash"
 */
export function hashPassword(password: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, expectedHash] = parts;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const actualHash = derivedKey.toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Demo User Store
// Salted scrypt password hashes
// ─────────────────────────────────────────────

const DEMO_USERS: DemoUser[] = [
  {
    user_id: 'USR-001',
    username: 'admin',
    password_hash: hashPassword('admin123', 'a1b2c3d4e5f60718'),
    display_name: 'System Administrator',
    role: 'ADMIN',
    is_active: true,
  },
  {
    user_id: 'USR-002',
    username: 'auditor',
    password_hash: hashPassword('audit123', 'b2c3d4e5f6071829'),
    display_name: 'Shri R. Sharma (CAG)',
    role: 'AUDITOR',
    is_active: true,
  },
  {
    user_id: 'USR-004',
    username: 'reviewer',
    password_hash: hashPassword('review123', 'd4e5f60718293a4b'),
    display_name: 'Audit Review Officer',
    role: 'REVIEWER',
    is_active: true,
  },
  {
    user_id: 'USR-005',
    username: 'viewer',
    password_hash: hashPassword('view123', 'e5f60718293a4b5c'),
    display_name: 'Public Transparency Viewer',
    role: 'VIEWER',
    is_active: true,
  },
];

// ─────────────────────────────────────────────
// JWT Implementation
// Uses HMAC-SHA256 with constant-time verification
// ─────────────────────────────────────────────

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

function createHmacSignature(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
}

export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_HOURS * 3600,
  };
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmacSignature(`${header}.${payloadEncoded}`);
  return `${header}.${payloadEncoded}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payloadEncoded, signature] = parts;
    const expectedSignature = createHmacSignature(`${header}.${payloadEncoded}`);

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadEncoded));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// User Authentication
// ─────────────────────────────────────────────

export function authenticateUser(
  username: string,
  password: string
): { token: string; user: Omit<DemoUser, 'password_hash'> } | null {
  const user = DEMO_USERS.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.is_active);
  if (!user) return null;

  if (!verifyPassword(password, user.password_hash)) return null;

  const token = generateToken({
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    display_name: user.display_name,
  });

  const { password_hash, ...safeUser } = user;
  return { token, user: safeUser };
}

// ─────────────────────────────────────────────
// Express Middleware: JWT & RBAC
// ─────────────────────────────────────────────

/**
 * Optional auth middleware — attaches user to request if valid Bearer token is provided.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

/**
 * Strict auth middleware — rejects requests without a valid JWT.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Provide a valid Bearer token in the Authorization header.',
      },
    });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token. Please log in again.',
      },
    });
  }

  req.user = payload;
  next();
}

/**
 * Role-based access control middleware.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before role verification.',
        },
      });
    }

    const userRole = req.user.role;
    
    const normalizedUserRoles = [userRole];
    if (userRole === 'ADMIN') normalizedUserRoles.push('AUDITOR', 'REVIEWER', 'VIEWER');

    const hasPermission = allowedRoles.some((role) => normalizedUserRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: [${allowedRoles.join(', ')}]. Your role: ${userRole}.`,
        },
      });
    }

    next();
  };
}
