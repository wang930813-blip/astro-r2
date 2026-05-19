import { createCookieSessionStorage, redirect } from 'react-router';

import { getLoginPath, sanitizeNextPath } from './auth';

export const SESSION_COOKIE_NAME = 'auth-token';
export const SESSION_DURATION_SECONDS = 24 * 60 * 60;

type AuthSessionData = {
  authenticated?: boolean;
};

const CORS_METHODS = 'GET, POST, DELETE, OPTIONS';
const CORS_HEADERS = 'Authorization, Content-Type';

function getAdminPassword(): string {
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is not configured');
  }

  return process.env.ADMIN_PASSWORD;
}

function getExternalApiToken(): string | null {
  const token = process.env.EXTERNAL_API_TOKEN?.trim();
  return token || null;
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function hasValidBearerToken(request: Request): boolean {
  const expectedToken = getExternalApiToken();
  const receivedToken = getBearerToken(request);

  return Boolean(expectedToken && receivedToken && receivedToken === expectedToken);
}

function getAllowedApiOrigins(): string[] {
  return (process.env.API_CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createSessionStorage() {
  return createCookieSessionStorage<AuthSessionData>({
    cookie: {
      name: SESSION_COOKIE_NAME,
      httpOnly: true,
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
      sameSite: 'strict',
      secrets: [`admin-password:${getAdminPassword()}`],
      secure: !import.meta.env.DEV,
    },
  });
}

export async function getSession(request: Request) {
  const storage = createSessionStorage();
  return storage.getSession(request.headers.get('Cookie'));
}

export async function commitAuthenticatedSession() {
  const storage = createSessionStorage();
  const session = await storage.getSession();
  session.set('authenticated', true);
  return storage.commitSession(session);
}

export async function destroyAuthenticatedSession(request: Request) {
  const storage = createSessionStorage();
  const session = await storage.getSession(request.headers.get('Cookie'));
  return storage.destroySession(session);
}

export async function isAuthenticated(request: Request) {
  const session = await getSession(request);
  return session.get('authenticated') === true;
}

export async function requireAuthenticatedRequest(request: Request) {
  const authenticated = await isAuthenticated(request);

  if (!authenticated) {
    throw redirect(getLoginPath(new URL(request.url)));
  }
}

export async function ensureAuthenticatedApiRequest(request: Request) {
  if (hasValidBearerToken(request)) {
    return null;
  }

  const authorization = request.headers.get('Authorization');
  if (authorization) {
    return jsonWithApiCors(request, { error: 'Authentication required' }, {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const authenticated = await isAuthenticated(request);

  if (authenticated) {
    return null;
  }

  return jsonWithApiCors(request, { error: 'Authentication required' }, {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export function verifyPassword(password: string) {
  return password === getAdminPassword();
}

export function getSafeNextPath(value: string | null | undefined) {
  return sanitizeNextPath(value);
}

export function getApiCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedApiOrigins();

  if (!origin || allowedOrigins.length === 0) {
    return headers;
  }

  if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  } else {
    return headers;
  }

  headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}

export function withApiCorsHeaders(request: Request, headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  const corsHeaders = getApiCorsHeaders(request);

  corsHeaders.forEach((value, key) => {
    nextHeaders.set(key, value);
  });

  return nextHeaders;
}

export function jsonWithApiCors(
  request: Request,
  data: unknown,
  init: ResponseInit = {}
): Response {
  return Response.json(data, {
    ...init,
    headers: withApiCorsHeaders(request, init.headers),
  });
}

export function handleApiOptionsRequest(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: withApiCorsHeaders(request, {
      'Cache-Control': 'no-store',
    }),
  });
}
