/**
 * Centralized Application Configuration
 *
 * Controls API mode, base URLs, ports, and feature defaults.
 */

export type ApiMode = 'mock' | 'real';

export interface AppConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
  isMock: boolean;
  defaultAnonymize: boolean;
  frontendPort: number;
  backendPort: number;
}

function resolveApiMode(): ApiMode {
  const envMode = process.env.NEXT_PUBLIC_API_MODE?.toLowerCase();
  if (envMode === 'real') return 'real';
  if (envMode === 'mock') return 'mock';
  
  // If explicitly configured to a non-/api URL, treat as real backend
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
  if (baseUrl !== '/api' && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
    return 'real';
  }
  
  return 'mock';
}

const mode = resolveApiMode();
const isMock = mode === 'mock';

export const APP_CONFIG: AppConfig = {
  apiMode: mode,
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? (isMock ? '/api' : 'http://localhost:3000')).replace(/\/+$/, ''),
  isMock,
  defaultAnonymize: process.env.NEXT_PUBLIC_DEFAULT_ANONYMIZE !== 'false',
  frontendPort: 3001,
  backendPort: 3000,
};

export const API_BASE_URL = APP_CONFIG.apiBaseUrl;
export const IS_MOCK_MODE = APP_CONFIG.isMock;
