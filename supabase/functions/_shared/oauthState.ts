type OAuthStatePayload = {
  userId: string;
  redirectUrl: string;
  exp: number;
  nonce: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function sign(value: string, secret: string): Promise<Uint8Array> {
  if (secret.length < 32) throw new Error('OAUTH_STATE_SECRET must contain at least 32 characters');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function createSignedOAuthState(
  input: Pick<OAuthStatePayload, 'userId' | 'redirectUrl'>,
  secret: string,
): Promise<string> {
  const payload: OAuthStatePayload = {
    ...input,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

export async function verifySignedOAuthState(
  value: string,
  secret: string,
): Promise<OAuthStatePayload | null> {
  try {
    const [encodedPayload, encodedSignature, extra] = value.split('.');
    if (!encodedPayload || !encodedSignature || extra) return null;
    const expected = await sign(encodedPayload, secret);
    const actual = fromBase64Url(encodedSignature);
    if (!constantTimeEqual(expected, actual)) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload))) as Partial<OAuthStatePayload>;
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.redirectUrl !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.nonce !== 'string' ||
      payload.exp < Date.now() ||
      payload.exp > Date.now() + 11 * 60 * 1000
    ) {
      return null;
    }
    return payload as OAuthStatePayload;
  } catch {
    return null;
  }
}
