const crypto = require('crypto');
const { spawn } = require('child_process');

const DEFAULT_ALLOWED_TARGETS = '+5511941618090';
const DEFAULT_SENDER = '+5511978869828';
const DEFAULT_GATEWAY_URL = 'ws://openclaw:50448';
const DEFAULT_WRAPPER_PATH = '/data/repos/openclaw/scripts/whatsapp-send.sh';
const MAX_MESSAGE_LENGTH = 2000;

function jsonError(res, status, error, requestId) {
  return res.status(status).json({
    ok: false,
    error,
    ...(requestId ? { request_id: requestId } : {}),
  });
}

function readAllowedTargets() {
  const raw = process.env.SENSEVIT_WHATSAPP_ALLOWED_TARGETS || DEFAULT_ALLOWED_TARGETS;
  return raw
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean);
}

function isGroupTarget(target) {
  const value = String(target || '').trim().toLowerCase();
  return value.includes('@g.us') || value.startsWith('group:') || value.startsWith('whatsapp_group:');
}

function sanitizeMessage(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n\t]+/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  return cleaned.slice(0, MAX_MESSAGE_LENGTH);
}

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function validateAuth(req) {
  const expected = process.env.SENSEVIT_STORE_INSTALLED_WEBHOOK_SECRET || '';
  if (!expected) return { ok: false, status: 500, error: 'webhook_secret_not_configured' };
  const received = bearerToken(req);
  if (!received || !timingSafeEqualText(received, expected)) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true };
}

function sendWhatsApp({ target, message }) {
  const sender = process.env.SENSEVIT_WHATSAPP_FROM || process.env.ZETHERA_WHATSAPP_FROM || DEFAULT_SENDER;
  const wrapperPath = process.env.OPENCLAW_WHATSAPP_SEND_SCRIPT || DEFAULT_WRAPPER_PATH;
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL;
  const timeoutMs = Number(process.env.SENSEVIT_WEBHOOK_SEND_TIMEOUT_MS || 45000);

  return new Promise((resolve, reject) => {
    const child = spawn(wrapperPath, [sender, target, message], {
      cwd: '/data/repos/openclaw',
      env: {
        ...process.env,
        WHATSAPP_SEND_ENABLED: 'true',
        ALLOW_NON_OWNER_WHATSAPP: 'true',
        OPENCLAW_GATEWAY_URL: gatewayUrl,
        OPENCLAW_WHATSAPP_SEND_TIMEOUT_SECONDS: String(Math.max(5, Math.floor(timeoutMs / 1000) - 5)),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('openclaw_send_timeout'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const message = stderr.trim() || stdout.trim() || `wrapper_exit_${code}`;
        reject(new Error(message.slice(0, 500)));
        return;
      }
      resolve({ stdout: stdout.trim().slice(0, 2000), stderr: stderr.trim().slice(0, 2000) });
    });
  });
}

function setupSenseVitWebhookRoutes(app) {
  app.post('/webhooks/sensevit/store-installed', async (req, res) => {
    const requestId = req.get('x-request-id') || crypto.randomUUID();
    const payload = req.body || {};
    const store = payload.store || {};
    const target = String(payload.target || '').trim();
    const platform = String(store.platform || '').trim();
    const storeId = String(store.store_id || '').trim();
    const dryRun = req.query.dry_run === 'true' || payload.dry_run === true;

    const logBase = { request_id: requestId, store_id: storeId, platform, target };

    try {
      const auth = validateAuth(req);
      if (!auth.ok) {
        console.warn('sensevit_store_installed_rejected', { ...logBase, status: auth.error });
        return jsonError(res, auth.status, auth.error, requestId);
      }

      if (payload.event_type !== 'sensevit_store_installed') {
        console.warn('sensevit_store_installed_rejected', { ...logBase, status: 'invalid_event_type' });
        return jsonError(res, 400, 'invalid_event_type', requestId);
      }
      if (payload.channel !== 'whatsapp') {
        console.warn('sensevit_store_installed_rejected', { ...logBase, status: 'invalid_channel' });
        return jsonError(res, 400, 'invalid_channel', requestId);
      }
      if (isGroupTarget(target)) {
        console.warn('sensevit_store_installed_rejected', { ...logBase, status: 'group_not_supported' });
        return jsonError(res, 403, 'group_not_supported', requestId);
      }
      if (!readAllowedTargets().includes(target)) {
        console.warn('sensevit_store_installed_rejected', { ...logBase, status: 'target_not_allowlisted' });
        return jsonError(res, 403, 'target_not_allowlisted', requestId);
      }

      const message = sanitizeMessage(payload.message);
      if (!message) {
        console.warn('sensevit_store_installed_rejected', { ...logBase, status: 'invalid_message' });
        return jsonError(res, 400, 'invalid_message', requestId);
      }

      if (dryRun) {
        console.log('sensevit_store_installed_dry_run', { ...logBase, status: 'dry_run' });
        return res.json({ ok: true, sent: false, dry_run: true, target, request_id: requestId });
      }

      await sendWhatsApp({ target, message });
      console.log('sensevit_store_installed_sent', { ...logBase, status: 'sent' });
      return res.json({ ok: true, sent: true, target, request_id: requestId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('sensevit_store_installed_send_failed', {
        ...logBase,
        status: 'send_failed',
        error: error.slice(0, 500),
      });
      return jsonError(res, 502, 'openclaw_send_failed', requestId);
    }
  });

  console.log('Webhook SenseVit registrado em POST /webhooks/sensevit/store-installed');
}

module.exports = { setupSenseVitWebhookRoutes };
