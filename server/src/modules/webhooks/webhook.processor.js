import { supabaseAdmin } from "../../config/supabase.js";

import {
  getGatewaySecrets,
  verifySignature
} from "../gateway/gateway.service.js";

export const processCustomWebhook = async ({
  accountId,
  rawBody,
  signature,
  eventId
}) => {
  if (!Buffer.isBuffer(rawBody)) {
    throw new Error("Webhook raw body is required");
  }

  if (!eventId) {
    throw new Error("x-oodo-event-id header is required");
  }

  const { data: account, error: accountError } =
    await supabaseAdmin
      .from("gateway_accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle();

  if (accountError) throw accountError;

  if (
    !account ||
    account.provider !== "custom" ||
    account.status !== "active"
  ) {
    throw new Error("Gateway account not found");
  }

  const secrets = getGatewaySecrets(account);

  if (
    !verifySignature(
      secrets.webhookSecret,
      rawBody,
      signature
    )
  ) {
    throw new Error("Invalid webhook signature");
  }

  const event = JSON.parse(rawBody.toString("utf8"));

  if (event.id !== eventId) {
    throw new Error("Webhook event ID mismatch");
  }

  if (
    !["payment.succeeded", "payment.failed"].includes(event.type)
  ) {
    return {
      received: true,
      ignored: true
    };
  }

  const orderId = event.data?.order_id;
  const providerPaymentId = event.data?.payment_id;

  if (!orderId || !providerPaymentId) {
    throw new Error("Webhook payment identifiers are missing");
  }

  const { data: attempt, error: attemptError } =
    await supabaseAdmin
      .from("payment_attempts")
      .select("*")
      .eq("organization_id", account.organization_id)
      .eq("gateway_account_id", account.id)
      .eq("provider", "custom")
      .eq("provider_order_id", orderId)
      .maybeSingle();

  if (attemptError) throw attemptError;

  if (!attempt) {
    throw new Error("Payment attempt not found");
  }

  if (
    Number(event.data.amount) !==
      Math.round(Number(attempt.amount) * 100) ||
    event.data.currency !== attempt.currency
  ) {
    throw new Error(
      "Webhook amount or currency does not match payment attempt"
    );
  }

  const { error: eventError } = await supabaseAdmin
    .from("gateway_webhook_events")
    .insert({
      organization_id: account.organization_id,
      gateway_account_id: account.id,
      provider: "custom",
      provider_event_id: event.id,
      event_type: event.type,
      payload: event,
      signature_verified: true,
      processing_status: "received"
    });

  if (eventError && eventError.code !== "23505") {
    throw eventError;
  }

  if (eventError?.code === "23505") {
    return {
      received: true,
      duplicate: true
    };
  }

  if (event.type === "payment.failed") {
    const { error } = await supabaseAdmin
      .from("payment_attempts")
      .update({
        status: "failed",
        failure_message: event.data.message || "Payment failed"
      })
      .eq("id", attempt.id)
      .eq("organization_id", account.organization_id);

    if (error) throw error;

    if (attempt.payment_id) {
      const { error: paymentError } = await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", attempt.payment_id)
        .eq("organization_id", account.organization_id);

      if (paymentError) throw paymentError;
    }
  } else {
    const { error } = await supabaseAdmin.rpc(
      "settle_custom_gateway_payment",
      {
        p_organization_id: account.organization_id,
        p_attempt_id: attempt.id,
        p_provider_payment_id: providerPaymentId,
        p_provider_order_id: orderId,
        p_amount_paise: Number(event.data.amount),
        p_currency: event.data.currency
      }
    );

    if (error) throw error;
  }

  await supabaseAdmin
    .from("gateway_webhook_events")
    .update({
      processing_status: "processed",
      processed_at: new Date().toISOString()
    })
    .eq("organization_id", account.organization_id)
    .eq("provider", "custom")
    .eq("provider_event_id", event.id);

  return {
    received: true,
    processed: true,
    attemptId: attempt.id
  };
};