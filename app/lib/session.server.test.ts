import { describe, it, mock } from 'bun:test';
import assert from 'node:assert/strict';

import {
  ensureAuthenticatedApiRequest,
  getApiCorsHeaders,
  handleApiOptionsRequest,
} from './session.server';

function withEnv(values: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

describe('ensureAuthenticatedApiRequest', () => {
  it('allows requests with the configured bearer token', async () => {
    await withEnv(
      {
        ADMIN_PASSWORD: undefined,
        EXTERNAL_API_TOKEN: 'secret-token',
      },
      async () => {
        const request = new Request('https://example.com/api/images', {
          headers: { Authorization: 'Bearer secret-token' },
        });

        assert.equal(await ensureAuthenticatedApiRequest(request), null);
      }
    );
  });

  it('rejects invalid bearer tokens', async () => {
    await withEnv(
      {
        ADMIN_PASSWORD: 'admin-password',
        EXTERNAL_API_TOKEN: 'secret-token',
      },
      async () => {
        const request = new Request('https://example.com/api/images', {
          headers: { Authorization: 'Bearer wrong-token' },
        });

        const response = await ensureAuthenticatedApiRequest(request);

        assert.equal(response?.status, 401);
        assert.deepEqual(await response?.json(), { error: 'Authentication required' });
      }
    );
  });
});

describe('getApiCorsHeaders', () => {
  it('does not emit CORS headers until origins are configured', async () => {
    await withEnv({ API_CORS_ORIGINS: undefined }, () => {
      const headers = getApiCorsHeaders(
        new Request('https://example.com/api/images', {
          headers: { Origin: 'https://client.example.com' },
        })
      );

      assert.equal(headers.get('Access-Control-Allow-Origin'), null);
    });
  });

  it('allows wildcard origins', async () => {
    await withEnv({ API_CORS_ORIGINS: '*' }, () => {
      const headers = getApiCorsHeaders(
        new Request('https://example.com/api/images', {
          headers: { Origin: 'https://client.example.com' },
        })
      );

      assert.equal(headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type');
    });
  });

  it('allows only listed origins when a whitelist is configured', async () => {
    await withEnv({ API_CORS_ORIGINS: 'https://client.example.com, https://admin.example.com' }, () => {
      const allowedHeaders = getApiCorsHeaders(
        new Request('https://example.com/api/images', {
          headers: { Origin: 'https://client.example.com' },
        })
      );
      const blockedHeaders = getApiCorsHeaders(
        new Request('https://example.com/api/images', {
          headers: { Origin: 'https://other.example.com' },
        })
      );

      assert.equal(allowedHeaders.get('Access-Control-Allow-Origin'), 'https://client.example.com');
      assert.equal(blockedHeaders.get('Access-Control-Allow-Origin'), null);
    });
  });
});

describe('handleApiOptionsRequest', () => {
  it('returns a no-content CORS preflight response', async () => {
    await withEnv({ API_CORS_ORIGINS: '*' }, () => {
      const response = handleApiOptionsRequest(
        new Request('https://example.com/api/images', {
          method: 'OPTIONS',
          headers: { Origin: 'https://client.example.com' },
        })
      );

      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, DELETE, OPTIONS');
    });
  });
});
