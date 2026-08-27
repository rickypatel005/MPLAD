/**
 * SIH26102 — Ambient TypeScript Type Declarations for Node.js and Vitest
 * Resolves IDE type checking for Node.js built-ins and test suites.
 */

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function readFileSync(path: string): Buffer;
  export function writeFileSync(path: string, data: string | Buffer, encoding?: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module 'node:fs' {
  export * from 'fs';
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
}

declare module 'node:path' {
  export * from 'path';
}

declare module 'crypto' {
  export function randomBytes(size: number): Buffer;
  export function scryptSync(password: string | Buffer, salt: string | Buffer, keylen: number): Buffer;
  export function timingSafeEqual(a: Buffer, b: Buffer): boolean;
  export function createHash(algorithm: string): {
    update(data: string | Buffer): {
      digest(encoding: 'hex' | 'base64' | 'base64url'): string;
    };
  };
  export function createHmac(algorithm: string, secret: string | Buffer): {
    update(data: string | Buffer): {
      digest(encoding: 'hex' | 'base64' | 'base64url'): string;
    };
  };
}

declare module 'node:crypto' {
  export * from 'crypto';
}

declare module 'dotenv' {
  export function config(options?: any): { parsed?: Record<string, string>; error?: Error };
}

declare module 'vitest' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: any): {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: any): void;
    toHaveLength(expected: number): void;
    toHaveProperty(property: string, value?: any): void;
    toMatch(expected: RegExp | string): void;
    toMatchObject(expected: any): void;
    toThrow(expected?: any): void;
    not: {
      toBe(expected: any): void;
      toEqual(expected: any): void;
      toBeNull(): void;
      toBeUndefined(): void;
      toContain(expected: any): void;
      toMatch(expected: RegExp | string): void;
    };
  };
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare namespace NodeJS {
  interface Process {
    cwd(): string;
    exit(code?: number): never;
    env: Record<string, string | undefined>;
  }
}

declare const process: NodeJS.Process;

interface Buffer {
  toString(encoding?: string): string;
  length: number;
}

declare const Buffer: {
  from(str: string, encoding?: string): Buffer;
  byteLength(string: string, encoding?: string): number;
};
