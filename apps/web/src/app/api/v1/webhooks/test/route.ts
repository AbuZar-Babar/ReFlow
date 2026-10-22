import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { authenticateRunnerOrUser } from '@/lib/auth/runner-auth';

export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 3;

class BlockedDestinationError extends Error {}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 10) return true;                      // 10.0.0.0/8
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;        // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;          // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                      // multicast + reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === '::' || addr === '::1') return true;
  if (addr.startsWith('fe80')) return true;       // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // fc00::/7
  if (addr.startsWith('ff')) return true;         // multicast
  if (addr.startsWith('::ffff:')) return isBlockedIPv4(addr.slice(7));
  return false;
}

/**
 * Rejects destinations that resolve to private, loopback, link-local or
 * reserved addresses. Called again for every redirect hop.
 */
async function assertPublicDestination(target: URL): Promise<void> {
  const host = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (!host) throw new BlockedDestinationError('Destination has no hostname');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new BlockedDestinationError('Webhook destination cannot be a private hostname');
  }

  if (net.isIP(host)) {
    const blocked = net.isIPv4(host) ? isBlockedIPv4(host) : isBlockedIPv6(host);
    if (blocked) throw new BlockedDestinationError('Webhook destination cannot be a private or loopback IP address');
    return;
  }

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BlockedDestinationError('Webhook destination hostname could not be resolved');
  }

  if (!records.length) {
    throw new BlockedDestinationError('Webhook destination hostname could not be resolved');
  }

  for (const record of records) {
    const blocked = record.family === 4 ? isBlockedIPv4(record.address) : isBlockedIPv6(record.address);
    if (blocked) {
      throw new BlockedDestinationError('Webhook destination resolves to a private or loopback address');
    }
  }
}

interface WebhookTestRequestBody {
  url: string;
  secret?: string;
  payload?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. Authenticate runner or session user
    const auth = await authenticateRunnerOrUser(req);
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isTestCall = isDevelopment && req.headers.get('x-test-bypass') === 'true';

    if (!auth.success && !isDevelopment && !isTestCall) {
      return NextResponse.json(
        {
          success: false,
          status: 401,
          statusText: 'Unauthorized',
          latency_ms: 0,
          latencyMs: 0,
          reachable: false,
          error: 'Unauthorized',
          message: 'Authentication required to dispatch webhook test probes.',
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate JSON request body
    let body: WebhookTestRequestBody;
    try {
      body = (await req.json()) as WebhookTestRequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          statusText: 'Bad Request',
          latency_ms: 0,
          latencyMs: 0,
          reachable: false,
          error: 'Invalid JSON',
          message: 'Malformed request body. Expected JSON object with a url field.',
        },
        { status: 400 }
      );
    }

    const { url, secret, payload } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          statusText: 'Bad Request',
          latency_ms: 0,
          latencyMs: 0,
          reachable: false,
          error: 'Missing required field: url',
          message: 'Invalid webhook request. A destination URL is required.',
        },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          statusText: 'Bad Request',
          latency_ms: 0,
          latencyMs: 0,
          reachable: false,
          error: 'Malformed URL',
          message: 'Webhook URL must be a valid RFC 3986 URL beginning with http:// or https://.',
        },
        { status: 400 }
      );
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          statusText: 'Bad Request',
          latency_ms: 0,
          latencyMs: 0,
          reachable: false,
          error: 'Invalid protocol',
          message: 'Only HTTP and HTTPS webhook destinations are supported.',
        },
        { status: 400 }
      );
    }

    // Validate the destination in every environment. Development machines can
    // reach production networks too, so this is not gated on NODE_ENV.
    await assertPublicDestination(parsedUrl);

    // 3. Construct authentic test payload
    const testPayload = payload || {
      event: 'workflow.test_ping',
      timestamp: new Date().toISOString(),
      source: 'Workflow-Capture-SaaS Control Plane',
      organization_id: auth.success ? auth.context.orgId : 'test_organization',
      message: 'Authentic webhook ping verification from ReFlow Workspace',
      version: '1.0.0',
    };

    const payloadString = JSON.stringify(testPayload);

    // 4. Compute HMAC-SHA256 signature if secret is provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ReFlow-Webhook-Verifier/1.0 (ReFlow Cloud Control Plane)',
      'X-ReFlow-Delivery': 'test-ping',
      'X-ReFlow-Event': 'workflow.test_ping',
    };

    if (secret && typeof secret === 'string' && secret.trim().length > 0) {
      const hmac = crypto.createHmac('sha256', secret.trim());
      hmac.update(payloadString);
      const signature = hmac.digest('hex');
      headers['X-ReFlow-Signature'] = `sha256=${signature}`;
      headers['X-Hub-Signature-256'] = `sha256=${signature}`;
    }

    // 5. Perform authentic outbound fetch() with strict 5000ms timeout.
    // Redirects are followed manually so every hop is re-validated; a public
    // URL must not be able to bounce the request into the private network.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response | undefined;
    try {
      let currentUrl = parsedUrl;

      for (let hop = 0; ; hop += 1) {
        response = await fetch(currentUrl.toString(), {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal,
          redirect: 'manual',
        });

        const isRedirect = response.status >= 300 && response.status < 400;
        const location = response.headers.get('location');
        if (!isRedirect || !location) break;

        if (hop >= MAX_REDIRECTS) {
          throw new BlockedDestinationError('Webhook destination exceeded the redirect limit');
        }

        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
          throw new BlockedDestinationError('Webhook redirect used an unsupported protocol');
        }

        await assertPublicDestination(nextUrl);
        currentUrl = nextUrl;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response) {
      throw new Error('Webhook probe produced no response');
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok) {
      return NextResponse.json({
        success: true,
        status: response.status,
        statusText: response.statusText || 'OK',
        latency_ms: latencyMs,
        latencyMs,
        reachable: true,
        message: `HTTP ${response.status} ${response.statusText || 'OK'} — Destination server acknowledged webhook test payload (${latencyMs}ms).`,
      });
    } else {
      return NextResponse.json({
        success: false,
        status: response.status,
        statusText: response.statusText || 'Error',
        latency_ms: latencyMs,
        latencyMs,
        reachable: true,
        message: `HTTP ${response.status} ${response.statusText || 'Error'} — Destination server responded with status ${response.status} (${latencyMs}ms). Ensure your endpoint handles HTTP POST requests.`,
      });
    }
  } catch (err: unknown) {
    if (err instanceof BlockedDestinationError) {
      const latencyMs = Math.round(performance.now() - startTime);
      return NextResponse.json(
        {
          success: false,
          status: 400,
          statusText: 'Bad Request',
          latency_ms: latencyMs,
          latencyMs,
          reachable: false,
          error: 'Invalid Destination',
          message: err.message,
        },
        { status: 400 }
      );
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.message.toLowerCase().includes('aborted') ||
        err.message.toLowerCase().includes('timeout'));

    const errorMsg = isTimeout
      ? 'Connection timed out after 5,000ms'
      : err instanceof Error
      ? err.message
      : 'Network communication failure';

    return NextResponse.json({
      success: false,
      status: 0,
      statusText: 'Unreachable',
      latency_ms: latencyMs,
      latencyMs,
      reachable: false,
      error: errorMsg,
      message: isTimeout
        ? 'Destination unreachable: Connection timed out after 5,000ms. Verify host and port accessibility.'
        : `Destination unreachable: ${errorMsg} (${latencyMs}ms). Ensure your server permits incoming HTTP POST webhooks.`,
    });
  }
}
