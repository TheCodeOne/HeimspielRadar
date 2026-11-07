import * as crypto from 'node:crypto';
import {
  createVapidAuthHeader,
  encryptWebPushPayload,
  generateVapidKeys,
  getKickoffDateTimeInBerlin,
  isReminderDue,
  sendWebPushNotification,
} from './web-push.util';

describe('web-push.util', () => {
  describe('generateVapidKeys', () => {
    it('generates valid base64url encoded P-256 EC keys', () => {
      const keys = generateVapidKeys();

      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();

      const pubBuf = Buffer.from(keys.publicKey, 'base64url');
      const privBuf = Buffer.from(keys.privateKey, 'base64url');

      // Uncompressed P-256 point is 65 bytes starting with 0x04
      expect(pubBuf.length).toBe(65);
      expect(pubBuf[0]).toBe(4);

      // Private key scalar is 32 bytes
      expect(privBuf.length).toBe(32);
    });
  });

  describe('createVapidAuthHeader', () => {
    it('creates a verifiable ES256 JWT header for the push audience', () => {
      const keys = generateVapidKeys();
      const audience = 'https://fcm.googleapis.com';
      const subject = 'mailto:info@heimspielradar.de';

      const authHeader = createVapidAuthHeader(
        audience,
        subject,
        keys.publicKey,
        keys.privateKey,
      );

      expect(authHeader).toMatch(/^vapid t=[\w.-]+, k=[\w-]+$/);

      const token = authHeader.replace(/^vapid t=/, '').split(', k=')[0];
      const [headerB64, payloadB64, sigB64] = token.split('.');

      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

      expect(header).toEqual({ typ: 'JWT', alg: 'ES256' });
      expect(payload.aud).toBe(audience);
      expect(payload.sub).toBe(subject);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Verify cryptographic signature with the public key JWK
      const pubKeyBytes = Buffer.from(keys.publicKey, 'base64url');

      const pubKeyJwk = {
        kty: 'EC',
        crv: 'P-256',
        x: pubKeyBytes.subarray(1, 33).toString('base64url'),
        y: pubKeyBytes.subarray(33, 65).toString('base64url'),
      };

      const pubKeyObj = crypto.createPublicKey({ key: pubKeyJwk, format: 'jwk' });
      const unsigned = `${headerB64}.${payloadB64}`;
      const sigBuf = Buffer.from(sigB64, 'base64url');

      const isValid = crypto.verify(
        'SHA256',
        Buffer.from(unsigned, 'utf8'),
        { key: pubKeyObj, dsaEncoding: 'ieee-p1363' },
        sigBuf,
      );

      expect(isValid).toBe(true);
    });
  });

  describe('encryptWebPushPayload', () => {
    it('encrypts payload in RFC 8291 aes128gcm so the browser client can decrypt it', () => {
      // Mock browser client keypair (like PushManager)
      const clientEcdh = crypto.createECDH('prime256v1');
      clientEcdh.generateKeys();
      const clientPublicKey = clientEcdh.getPublicKey('base64url');
      const clientAuthSecret = crypto.randomBytes(16).toString('base64url');

      const message = JSON.stringify({
        title: 'Anwurf 15:00 Uhr',
        body: 'Köpenicker BC vs. TuS Neukölln',
      });

      const encrypted = encryptWebPushPayload(
        clientPublicKey,
        clientAuthSecret,
        message,
      );

      expect(encrypted.length).toBeGreaterThan(message.length + 86);

      // Decrypt using client keys following RFC 8291
      const salt = encrypted.subarray(0, 16);
      const idlen = encrypted[20];
      const serverPubKey = encrypted.subarray(21, 21 + idlen);
      const ciphertextWithTag = encrypted.subarray(21 + idlen);

      const sharedSecret = clientEcdh.computeSecret(serverPubKey);

      const keyInfo = Buffer.concat([
        Buffer.from('WebPush: info\0', 'utf8'),
        clientEcdh.getPublicKey(),
        serverPubKey,
      ]);

      const clientAuthBuf = Buffer.from(clientAuthSecret, 'base64url');

      const ikm = Buffer.from(
        crypto.hkdfSync('sha256', sharedSecret, clientAuthBuf, keyInfo, 32),
      );

      const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
      const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, cekInfo, 16));

      const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');
      const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, nonceInfo, 12));

      const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
      const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

      const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      // Strip delimiter \x02
      const decryptedText = decrypted.subarray(0, decrypted.length - 1).toString('utf8');

      expect(decryptedText).toBe(message);
    });
  });

  describe('sendWebPushNotification', () => {
    it('dispatches encrypted payload with proper headers to subscription endpoint', async () => {
      const keys = generateVapidKeys();
      const clientEcdh = crypto.createECDH('prime256v1');
      clientEcdh.generateKeys();

      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: Uint8Array | null = null;

      const mockFetch: typeof fetch = async (input, init) => {
        capturedUrl = String(input);
        // SAFETY: init.headers is a key-value record in our tests
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        // SAFETY: init.body is Uint8Array in our implementation
        capturedBody = (init?.body ?? null) as Uint8Array | null;

        const mockRes: Partial<Response> = {
          status: 201,
          ok: true,
          text: async () => 'Created',
        };

        // SAFETY: Minimal Response shape for unit test
        return mockRes as Response;
      };

      const result = await sendWebPushNotification({
        subscription: {
          endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/mock-endpoint',
          keys: {
            p256dh: clientEcdh.getPublicKey('base64url'),
            auth: crypto.randomBytes(16).toString('base64url'),
          },
        },
        payload: {
          title: 'Test Title',
          body: 'Test Body',
        },
        vapidPublicKey: keys.publicKey,
        vapidPrivateKey: keys.privateKey,
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
      expect(result.expired).toBe(false);

      expect(capturedUrl).toBe(
        'https://updates.push.services.mozilla.com/wpush/v2/mock-endpoint',
      );
      expect(capturedHeaders['Content-Type']).toBe('application/octet-stream');
      expect(capturedHeaders['Content-Encoding']).toBe('aes128gcm');
      expect(capturedHeaders['TTL']).toBe('86400');
      expect(capturedHeaders['Authorization']).toMatch(/^vapid t=/);
      expect(capturedBody).not.toBeNull();
    });

    it('identifies expired 404 or 410 subscriptions', async () => {
      const keys = generateVapidKeys();
      const clientEcdh = crypto.createECDH('prime256v1');
      clientEcdh.generateKeys();

      const mockFetch: typeof fetch = async () => {
        const mockRes: Partial<Response> = {
          status: 410,
          ok: false,
          text: async () => 'Subscription Gone',
        };

        // SAFETY: Minimal Response shape for unit test
        return mockRes as Response;
      };

      const result = await sendWebPushNotification({
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/expired',
          keys: {
            p256dh: clientEcdh.getPublicKey('base64url'),
            auth: crypto.randomBytes(16).toString('base64url'),
          },
        },
        payload: {
          title: 'Test',
          body: 'Test',
        },
        vapidPublicKey: keys.publicKey,
        vapidPrivateKey: keys.privateKey,
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(410);
      expect(result.expired).toBe(true);
    });
  });

  describe('getKickoffDateTimeInBerlin', () => {
    it('correctly maps kickoff date and time in Berlin timezone (CET in winter)', () => {
      // 2026-11-08 15:00 in Berlin (UTC+1) -> 14:00 UTC
      const date = getKickoffDateTimeInBerlin('2026-11-08', '15:00');

      expect(date.toISOString()).toBe('2026-11-08T14:00:00.000Z');
    });

    it('correctly maps kickoff date and time in Berlin timezone (CEST in summer)', () => {
      // 2026-06-15 15:00 in Berlin (UTC+2) -> 13:00 UTC
      const date = getKickoffDateTimeInBerlin('2026-06-15', '15:00');

      expect(date.toISOString()).toBe('2026-06-15T13:00:00.000Z');
    });
  });

  describe('isReminderDue', () => {
    it('returns false if kickoffDate is missing or empty', () => {
      expect(isReminderDue('1h', null, '15:00')).toBe(false);
      expect(isReminderDue('1h', '', '15:00')).toBe(false);
    });

    it('triggers 1h reminder within 60 minutes before kickoff', () => {
      // Kickoff: 2026-11-08 15:00 Berlin (14:00 UTC)
      // 1h trigger is 13:00 UTC
      const kickoffDate = '2026-11-08';
      const kickoffTime = '15:00';

      const beforeTrigger = new Date('2026-11-08T12:59:00.000Z');
      const atTrigger = new Date('2026-11-08T13:00:00.000Z');
      const duringGame = new Date('2026-11-08T14:30:00.000Z');
      const wayPastGame = new Date('2026-11-08T18:00:00.000Z');

      expect(isReminderDue('1h', kickoffDate, kickoffTime, beforeTrigger)).toBe(false);
      expect(isReminderDue('1h', kickoffDate, kickoffTime, atTrigger)).toBe(true);
      expect(isReminderDue('1h', kickoffDate, kickoffTime, duringGame)).toBe(true);
      expect(isReminderDue('1h', kickoffDate, kickoffTime, wayPastGame)).toBe(false);
    });

    it('triggers 2h reminder within 120 minutes before kickoff', () => {
      // Kickoff: 2026-11-08 15:00 Berlin (14:00 UTC)
      // 2h trigger is 12:00 UTC
      const kickoffDate = '2026-11-08';
      const kickoffTime = '15:00';

      const beforeTrigger = new Date('2026-11-08T11:59:00.000Z');
      const atTrigger = new Date('2026-11-08T12:00:00.000Z');

      expect(isReminderDue('2h', kickoffDate, kickoffTime, beforeTrigger)).toBe(false);
      expect(isReminderDue('2h', kickoffDate, kickoffTime, atTrigger)).toBe(true);
    });

    it('triggers 1d reminder on the previous day starting at 18:00 Berlin time', () => {
      // Kickoff: 2026-11-08 15:00 Berlin
      // Previous day: 2026-11-07 18:00 Berlin (17:00 UTC)
      const kickoffDate = '2026-11-08';
      const kickoffTime = '15:00';

      const beforeTrigger = new Date('2026-11-07T16:59:00.000Z');
      const atTrigger = new Date('2026-11-07T17:00:00.000Z');
      const morningOfGame = new Date('2026-11-08T08:00:00.000Z');

      expect(isReminderDue('1d', kickoffDate, kickoffTime, beforeTrigger)).toBe(false);
      expect(isReminderDue('1d', kickoffDate, kickoffTime, atTrigger)).toBe(true);
      expect(isReminderDue('1d', kickoffDate, kickoffTime, morningOfGame)).toBe(true);
    });
  });
});
