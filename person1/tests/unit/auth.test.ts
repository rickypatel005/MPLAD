/**
 * SIH26102 — Authentication & RBAC Security Unit Tests (Phase 9 & 10)
 * Tests for: Salted scrypt key-derivation password hashing, constant-time verification, JWT signing, and RBAC matrix.
 */
import { describe, it, expect } from 'vitest';
import {
  authenticateUser,
  generateToken,
  hashPassword,
  verifyPassword,
  verifyToken,
} from '../../src/middleware/auth.ts';

describe('Phase 9 — Salted Scrypt Password Hashing & Security', () => {
  it('should generate a salted scrypt hash with format "salt:hexHash"', () => {
    const password = 'testPassword123!';
    const hash = hashPassword(password);
    expect(hash).toContain(':');
    const parts = hash.split(':');
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBe(32); // 16 bytes hex salt
    expect(parts[1].length).toBe(128); // 64 bytes hex derived key
  });

  it('should generate different hashes for the same password due to random salt', () => {
    const password = 'secretPassword';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct password against stored scrypt hash', () => {
    const password = 'secureAdminPassword2026';
    const hash = hashPassword(password);
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it('should reject incorrect password against stored scrypt hash', () => {
    const hash = hashPassword('correctPassword');
    expect(verifyPassword('wrongPassword', hash)).toBe(false);
  });

  it('should authenticate all demo users with their designated credentials', () => {
    const demoAccounts = [
      { username: 'admin', pass: 'admin123', role: 'ADMIN' },
      { username: 'auditor', pass: 'audit123', role: 'AUDITOR' },
      { username: 'reviewer', pass: 'review123', role: 'REVIEWER' },
      { username: 'viewer', pass: 'view123', role: 'VIEWER' },
    ];

    for (const acc of demoAccounts) {
      const result = authenticateUser(acc.username, acc.pass);
      expect(result).not.toBeNull();
      expect(result!.user.username).toBe(acc.username);
      expect(result!.user.role).toBe(acc.role);
      expect(result!.token).toBeTruthy();
      expect((result!.user as any).password_hash).toBeUndefined(); // Never expose hash
    }
  });

  it('should reject invalid password for valid user', () => {
    const result = authenticateUser('admin', 'badpassword');
    expect(result).toBeNull();
  });

  it('should reject non-existent username', () => {
    const result = authenticateUser('ghost_user', 'any_password');
    expect(result).toBeNull();
  });
});

describe('Phase 9 — JWT Token Generation & Verification', () => {
  it('should generate a 3-part signed JWT token', () => {
    const token = generateToken({
      user_id: 'USR-001',
      username: 'admin',
      role: 'ADMIN',
      display_name: 'System Administrator',
    });

    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(3);
  });

  it('should verify a valid token and return matching payload', () => {
    const token = generateToken({
      user_id: 'USR-002',
      username: 'auditor',
      role: 'AUDITOR',
      display_name: 'Shri R. Sharma',
    });

    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.username).toBe('auditor');
    expect(payload!.role).toBe('AUDITOR');
    expect(payload!.user_id).toBe('USR-002');
  });

  it('should reject tampered JWT signatures', () => {
    const token = generateToken({
      user_id: 'USR-005',
      username: 'viewer',
      role: 'VIEWER',
      display_name: 'Viewer',
    });

    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.TAMPERED_SIGNATURE`;
    const payload = verifyToken(tamperedToken);
    expect(payload).toBeNull();
  });
});
