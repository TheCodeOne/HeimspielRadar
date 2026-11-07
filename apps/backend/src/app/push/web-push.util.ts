import * as crypto from 'node:crypto';
import type { PushLeadTime } from '../database/schema';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  matchId?: number;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export interface SendWebPushOptions {
  subscription: WebPushSubscription;
  payload: PushNotificationPayload;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject?: string;
  ttl?: number;
  fetchFn?: typeof fetch;
}

export interface SendWebPushResult {
  success: boolean;
  statusCode: number;
  expired: boolean;
  error?: string;
}

/**
 * Generates an uncompressed P-256 EC key pair encoded in URL-safe base64.
 */
export function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const publicKey = ecdh.getPublicKey('base64url');
  const privateKey = ecdh.getPrivateKey('base64url');

  return { publicKey, privateKey };
}

/**
 * Creates RFC 8292 VAPID Authorization header (ES256 JWT).
 */
export function createVapidAuthHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  expSeconds = 12 * 3600,
): string {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    aud: audience,
    exp: now + expSeconds,
    sub: subject,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pubKeyBytes = Buffer.from(publicKey, 'base64url');
  const x = pubKeyBytes.subarray(1, 33).toString('base64url');
  const y = pubKeyBytes.subarray(33, 65).toString('base64url');

  const privKeyJwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKey,
    x,
    y,
  };

  const keyObj = crypto.createPrivateKey({ key: privKeyJwk, format: 'jwk' });

  const signature = crypto.sign('SHA256', Buffer.from(unsignedToken, 'utf8'), {
    key: keyObj,
    dsaEncoding: 'ieee-p1363',
  });

  const sigB64 = signature.toString('base64url');
  const jwt = `${unsignedToken}.${sigB64}`;

  return `vapid t=${jwt}, k=${publicKey}`;
}

/**
 * Encrypts payload following RFC 8291 (aes128gcm with HKDF & ECDH).
 */
export function encryptWebPushPayload(
  clientPublicKeyBase64url: string,
  clientAuthSecretBase64url: string,
  payloadText: string,
): Buffer {
  const clientPubKey = Buffer.from(clientPublicKeyBase64url, 'base64url');
  const clientAuth = Buffer.from(clientAuthSecretBase64url, 'base64url');

  const localEcdh = crypto.createECDH('prime256v1');
  localEcdh.generateKeys();
  const localPublicKey = localEcdh.getPublicKey();

  const sharedSecret = localEcdh.computeSecret(clientPubKey);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPubKey,
    localPublicKey,
  ]);

  const ikm = Buffer.from(
    crypto.hkdfSync('sha256', sharedSecret, clientAuth, keyInfo, 32),
  );

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, cekInfo, 16));

  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, nonceInfo, 12));

  const record = Buffer.concat([Buffer.from(payloadText, 'utf8'), Buffer.from([2])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);

  const ciphertext = Buffer.concat([
    cipher.update(record),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const idlen = Buffer.from([localPublicKey.length]);

  return Buffer.concat([salt, rs, idlen, localPublicKey, ciphertext]);
}

/**
 * Dispatches an encrypted Web-Push notification to the push service endpoint.
 */
export async function sendWebPushNotification(
  options: SendWebPushOptions,
): Promise<SendWebPushResult> {
  const {
    subscription,
    payload,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject = 'mailto:info@heimspielradar.de',
    ttl = 86400,
    fetchFn = fetch,
  } = options;

  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const authHeader = createVapidAuthHeader(
    audience,
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey,
  );

  const payloadString = JSON.stringify(payload);

  const encryptedBody = encryptWebPushPayload(
    subscription.keys.p256dh,
    subscription.keys.auth,
    payloadString,
  );

  const response = await fetchFn(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(ttl),
      Authorization: authHeader,
    },
    body: new Uint8Array(encryptedBody),
  });

  const statusCode = response.status;
  const expired = statusCode === 404 || statusCode === 410;
  const success = statusCode >= 200 && statusCode < 300;

  let error: string | undefined;

  if (!success) {
    const errorText = await response.text().catch(() => '');
    error = `Push service returned ${statusCode}: ${errorText}`;
  }

  return {
    success,
    statusCode,
    expired,
    error,
  };
}

/**
 * Converts a kickoff date (YYYY-MM-DD) and time (HH:mm) in Europe/Berlin to a UTC Date.
 */
export function getKickoffDateTimeInBerlin(
  kickoffDate: string,
  kickoffTime?: string | null,
): Date {
  const [year, month, day] = kickoffDate.split('-').map(Number);
  const [hour, minute] = (kickoffTime || '00:00').split(':').map(Number);

  const tentativeUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(tentativeUtc);

  const getPart = (type: string) => {
    const found = parts.find((p) => p.type === type);

    return found ? parseInt(found.value, 10) : 0;
  };

  const bYear = getPart('year');
  const bMonth = getPart('month');
  const bDay = getPart('day');
  const bHour = getPart('hour') % 24;
  const bMinute = getPart('minute');

  const berlinMs = Date.UTC(bYear, bMonth - 1, bDay, bHour, bMinute);
  const diffMs = tentativeUtc.getTime() - berlinMs;

  return new Date(tentativeUtc.getTime() + diffMs);
}

/**
 * Checks if a reminder with the given lead time is due at `now`.
 */
export function isReminderDue(
  leadTime: PushLeadTime,
  kickoffDate: string | null | undefined,
  kickoffTime: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!kickoffDate) {
    return false;
  }

  const kickoff = getKickoffDateTimeInBerlin(kickoffDate, kickoffTime || '15:00');
  const nowMs = now.getTime();
  const kickoffMs = kickoff.getTime();

  // If match was already completed more than 3 hours ago, skip
  if (nowMs > kickoffMs + 3 * 60 * 60 * 1000) {
    return false;
  }

  if (leadTime === '1h') {
    const triggerMs = kickoffMs - 60 * 60 * 1000;

    return nowMs >= triggerMs;
  }

  if (leadTime === '2h') {
    const triggerMs = kickoffMs - 2 * 60 * 60 * 1000;

    return nowMs >= triggerMs;
  }

  if (leadTime === '1d') {
    const [year, month, day] = kickoffDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    const prevYear = dateObj.getUTCFullYear();
    const prevMonth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const prevDay = String(dateObj.getUTCDate()).padStart(2, '0');
    const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;

    const triggerDate = getKickoffDateTimeInBerlin(prevDateStr, '18:00');

    return nowMs >= triggerDate.getTime();
  }

  return false;
}
