import * as crypto from 'crypto';

export type AccessTokenPayload = {
  sub: string;
  tid: string;
  exp: number;
  iat: number;
};

export function signAccessToken(
  payload: { sub: string; tid: string },
  secret: string,
  ttlSec: number,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, exp: now + ttlSec, iat: now };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('INVALID_TOKEN');
  }
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  if (expected !== s) {
    throw new Error('INVALID_SIGNATURE');
  }
  const body = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as AccessTokenPayload;
  if (typeof body.exp !== 'number' || body.exp * 1000 < Date.now()) {
    throw new Error('TOKEN_EXPIRED');
  }
  return body;
}
