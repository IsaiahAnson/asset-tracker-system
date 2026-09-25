import crypto from "node:crypto";

export const runtime = "nodejs";

// HR webhook inbound receiver.
//
// Contract: the HRIS integration POSTs a JSON payload carrying personnel
// events. We must dedupe on idempotency_key, validate the
// X-Webhook-Signature header, and return 2xx once the event is accepted (before
// any downstream parsing). Live subscription is a later Phase; this stub
// locks the receiver contract so enabling it later is a config change.
//
// OPEN ITEMS to settle with the HRIS integration owner before production:
//   - exact signature algorithm + secret provisioning/rotation
//   - idempotency_key location (header vs body) and stability across retries
//   - canonical payload schema
//   - retry cadence / max attempts / dead-letter behavior

// Placeholder dedupe store. Intentionally in-memory until the idempotency_key
// semantics are confirmed and a backing table is added (see OPEN ITEMS).
const seenIdempotencyKeys = new Set<string>();

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.HR_WEBHOOK_SECRET;

  // No secret configured: receiver is not yet provisioned. Reject rather than
  // silently accept unverified payloads.
  if (!secret) {
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  // Assumed scheme: hex-encoded HMAC-SHA256 over the raw request body.
  // Adjust if the sender uses a different construction.
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-webhook-signature"))) {
    return Response.json(
      { status: "rejected", reason: "invalid_signature" },
      { status: 401 }
    );
  }

  let payload: { idempotency_key?: unknown };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { status: "rejected", reason: "invalid_json" },
      { status: 400 }
    );
  }

  const idempotencyKey =
    typeof payload.idempotency_key === "string" ? payload.idempotency_key : null;

  if (!idempotencyKey) {
    return Response.json(
      { status: "rejected", reason: "missing_idempotency_key" },
      { status: 400 }
    );
  }

  // Duplicate redelivery: idempotent accept (2xx so the HR webhook stops retrying).
  if (seenIdempotencyKeys.has(idempotencyKey)) {
    return Response.json(
      { status: "accepted", duplicate: true, idempotencyKey },
      { status: 200 }
    );
  }

  seenIdempotencyKeys.add(idempotencyKey);

  // Accepted. Downstream HRIS parsing is intentionally deferred to the
  // later integration Phase; this endpoint only owns the receive contract.
  return Response.json(
    { status: "accepted", duplicate: false, idempotencyKey },
    { status: 202 }
  );
}
