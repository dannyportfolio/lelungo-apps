import { createServer, type Server, type ServerResponse } from 'node:http';

const host = '127.0.0.1';
const port = 54_329;
const authenticatedUser = {
  id: '7d6126df-5cbc-4cf8-8c2e-d0ba0cb95715',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'no-membership@example.test',
  email_confirmed_at: '2026-08-10T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-08-10T00:00:00.000Z',
  last_sign_in_at: '2026-08-10T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-08-10T00:00:00.000Z',
  updated_at: '2026-08-10T00:00:00.000Z',
  is_anonymous: false,
};

export interface FakeSupabaseAuthServer {
  close(): Promise<void>;
}

export async function startFakeSupabaseAuthServer(): Promise<FakeSupabaseAuthServer> {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/auth/v1/user') {
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith('Bearer ') || authorization === 'Bearer e2e-public-key') {
        writeJson(response, 401, {
          code: 'bad_jwt',
          message: 'Invalid authentication token.',
        });
        return;
      }

      writeJson(response, 200, authenticatedUser);
      return;
    }

    writeJson(response, 404, { message: 'Not found.' });
  });

  await listen(server);

  return {
    close: () => close(server),
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}
