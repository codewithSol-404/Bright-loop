import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";
import {
  encryptJson,
  decryptJson
} from "../../utils/encryption.js";

const allowedEvents = [
  "payment.succeeded",
  "invoice.paid",
  "subscription.activated"
];

export const createWebhookEndpoint = async (
  organizationId,
  body
) => {
  let url;

  try {
    url = new URL(body.url);
  } catch {
    throw new Error("A valid webhook URL is required");
  }

  if (
    url.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new Error("Webhook URL must use HTTPS");
  }

  const events = Array.isArray(body.events) ? body.events : [];

  if (
    !events.length ||
    events.some((event) => !allowedEvents.includes(event))
  ) {
    throw new Error("Choose supported webhook events");
  }

  const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

  const { data, error } = await supabaseAdmin
    .from("webhook_endpoints")
    .insert({
      organization_id: organizationId,
      url: url.toString(),
      description: body.description || null,
      signing_secret_ciphertext: encryptJson({ secret }),
      enabled: true,
      subscribed_events: events
    })
    .select(
      "id,url,description,enabled,subscribed_events,created_at"
    )
    .single();

  if (error) throw error;

  return {
    ...data,
    secret
  };
};

export const listWebhookEndpoints = async (organizationId) => {
  const { data, error } = await supabaseAdmin
    .from("webhook_endpoints")
    .select(
      "id,url,description,enabled,subscribed_events,created_at"
    )
    .eq("organization_id", organizationId);

  if (error) throw error;

  return data;
};

const deliver = async (delivery) => {
  const { data: endpoint, error: endpointError } =
    await supabaseAdmin
      .from("webhook_endpoints")
      .select("*")
      .eq("id", delivery.webhook_endpoint_id)
      .eq("organization_id", delivery.organization_id)
      .maybeSingle();

  if (endpointError) throw endpointError;

  const { data: event, error: eventError } = await supabaseAdmin
    .from("webhook_events")
    .select("*")
    .eq("id", delivery.webhook_event_id)
    .eq("organization_id", delivery.organization_id)
    .maybeSingle();

  if (eventError) throw eventError;

  if (!endpoint?.enabled || !event) return;

  const { secret } = decryptJson(
    endpoint.signing_secret_ciphertext
  );

  const payload = JSON.stringify({
    id: event.event_id,
    type: event.event_type,
    created_at: event.created_at,
    data: event.payload
  });

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const attemptCount = Number(delivery.attempt_count || 0) + 1;

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-oodo-signature": signature,
        "x-oodo-event-id": event.event_id
      },
      body: payload,
      signal: AbortSignal.timeout(10000)
    });

    const responseBody = (await response.text()).slice(0, 2000);

    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        status: response.ok ? "succeeded" : "failed",
        attempt_count: attemptCount,
        last_attempt_at: new Date().toISOString(),
        response_status: response.status,
        response_body: responseBody,
        delivered_at: response.ok
          ? new Date().toISOString()
          : null,
        last_error: response.ok
          ? null
          : `HTTP ${response.status}`,
        next_attempt_at:
          response.ok || attemptCount >= 8
            ? null
            : new Date(
                Date.now() +
                Math.min(60, 2 ** attemptCount) * 60000
              ).toISOString()
      })
      .eq("id", delivery.id);
  } catch (error) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        status: "failed",
        attempt_count: attemptCount,
        last_attempt_at: new Date().toISOString(),
        last_error: error.message,
        next_attempt_at:
          attemptCount >= 8
            ? null
            : new Date(
                Date.now() +
                Math.min(60, 2 ** attemptCount) * 60000
              ).toISOString()
      })
      .eq("id", delivery.id);
  }
};

export const deliverPendingWebhooks = async () => {
  const { data, error } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .limit(20);

  if (error) throw error;

  for (const item of data || []) {
    await deliver(item);
  }
};

let running = false;

export const startWebhookWorker = () => {
  if (running) return;

  running = true;

  const tick = async () => {
    try {
      await deliverPendingWebhooks();
    } catch (error) {
      console.error("Webhook worker:", error.message);
    }
  };

  void tick();

  const timer = setInterval(tick, 30000);
  timer.unref?.();
};