import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";
import { createSubscription } from "../subscriptions/subscriptions.service.js";
import { getDefaultGateway } from "./gateway.service.js";

export const createCustomCheckout = async (
  organizationId,
  checkoutPublicId
) => {
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("checkout_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("public_id", checkoutPublicId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("Checkout session not found");

  if (session.status !== "open") {
    throw new Error("Checkout session is not open");
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error("Checkout session expired");
  }

  if (session.currency !== "INR") {
    throw new Error("OOdo custom test gateway currently supports INR only");
  }

  const gateway = await getDefaultGateway(organizationId);

  let subscriptionId = session.subscription_id;
  let invoice;

  if (subscriptionId) {
    const { data: existingInvoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("subscription_id", subscriptionId)
      .maybeSingle();

    if (error) throw error;

    invoice = existingInvoice;
  } else {
    const {
      subscription,
      invoice: createdInvoice
    } = await createSubscription(organizationId, {
      customerId: session.customer_id,
      planId: session.plan_id
    });

    subscriptionId = subscription.id;

    const { error: sessionUpdateError } = await supabaseAdmin
      .from("checkout_sessions")
      .update({ subscription_id: subscriptionId })
      .eq("id", session.id)
      .eq("organization_id", organizationId);

    if (sessionUpdateError) throw sessionUpdateError;

    const { data: updatedInvoice, error: invoiceUpdateError } =
      await supabaseAdmin
        .from("invoices")
        .update({
          subtotal: session.subtotal,
          discount_amount: session.discount_amount,
          tax_amount: session.tax_amount,
          total_amount: session.total_amount,
          currency: session.currency
        })
        .eq("id", createdInvoice.id)
        .eq("organization_id", organizationId)
        .select("*")
        .single();

    if (invoiceUpdateError) throw invoiceUpdateError;

    invoice = updatedInvoice;
  }

  if (!invoice) {
    throw new Error("Invoice could not be prepared for checkout");
  }

  const { data: previous, error: previousError } = await supabaseAdmin
    .from("payment_attempts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoice.id)
    .eq("gateway_account_id", gateway.id)
    .eq("provider", "custom")
    .in("status", ["created", "requires_action", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) throw previousError;

  if (previous) {
    return {
      gateway: "custom",
      environment: "test",
      orderId: previous.provider_order_id,
      paymentAttemptId: previous.id,
      amount: Math.round(Number(previous.amount) * 100),
      currency: previous.currency
    };
  }

  const { data: existingPayment, error: existingPaymentError } =
    await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("invoice_id", invoice.id)
      .eq("provider", "custom")
      .eq("status", "pending")
      .maybeSingle();

  if (existingPaymentError) throw existingPaymentError;

  let payment = existingPayment;

  if (!payment) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        organization_id: organizationId,
        invoice_id: invoice.id,
        customer_id: session.customer_id,
        amount: session.total_amount,
        currency: session.currency,
        payment_method: "simulated_online",
        provider: "custom",
        status: "pending"
      })
      .select("*")
      .single();

    if (error) throw error;

    payment = data;
  }

  const orderId = `ord_${crypto.randomUUID()}`;

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("payment_attempts")
    .insert({
      organization_id: organizationId,
      payment_id: payment.id,
      invoice_id: invoice.id,
      customer_id: session.customer_id,
      gateway_account_id: gateway.id,
      provider: "custom",
      provider_order_id: orderId,
      amount: session.total_amount,
      currency: session.currency,
      status: "requires_action",
      idempotency_key: `checkout_${session.id}_${crypto.randomUUID()}`,
      request_snapshot: {
        checkout_session_id: session.id
      },
      response_snapshot: {
        test_mode: true
      }
    })
    .select("*")
    .single();

  if (attemptError) throw attemptError;

  return {
    gateway: "custom",
    environment: "test",
    orderId,
    paymentAttemptId: attempt.id,
    amount: Math.round(Number(session.total_amount) * 100),
    currency: session.currency
  };
};