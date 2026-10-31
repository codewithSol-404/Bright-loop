
import { supabaseAdmin } from "../../config/supabase.js";

// Create a refund request
export const createRefund = async (organizationId, body) => {
  const { paymentId, amount, reason } = body;

  if (!paymentId) {
    throw new Error("Payment ID is required");
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  if (!reason?.trim()) {
    throw new Error("Reason is required");
  }

  // Find payment belonging to this organization
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("organization_id", organizationId)
    .single();

  if (paymentError || !payment) {
    throw new Error("Payment not found");
  }

  if (!["succeeded", "partially_refunded"].includes(payment.status)) {
    throw new Error("Payment is not refundable");
  }

  // Find the invoice
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", payment.invoice_id)
    .eq("organization_id", organizationId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error("Invoice not found");
  }

  // Calculate already reserved/completed refund amounts
  const { data: existingRefunds, error: refundError } = await supabaseAdmin
    .from("refund_requests")
    .select("amount")
    .eq("payment_id", paymentId)
    .eq("organization_id", organizationId)
    .in("status", ["pending", "approved", "processing", "completed"]);

  if (refundError) throw refundError;

  const alreadyRefunded = (existingRefunds || []).reduce(
    (total, refund) => total + Number(refund.amount),
    0
  );

  const refundableBalance = Number(payment.amount) - alreadyRefunded;
  const requestedAmount = Number(amount);

  if (requestedAmount > refundableBalance) {
    throw new Error("Refund amount exceeds the refundable balance");
  }

  // Create request. Customer and invoice IDs are derived from the payment.
  const { data, error } = await supabaseAdmin
    .from("refund_requests")
    .insert({
      organization_id: organizationId,
      payment_id: payment.id,
      invoice_id: invoice.id,
      customer_id: payment.customer_id,
      amount: requestedAmount,
      reason: reason.trim(),
      status: "pending"
    })
    .select()
    .single();

  if (error) throw error;

  return data;
};


// Get all refund requests
export const getRefunds = async (organizationId, query = {}) => {
  let request = supabaseAdmin
    .from("refund_requests")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (query.status) {
    request = request.eq("status", query.status);
  }

  if (query.paymentId) {
    request = request.eq("payment_id", query.paymentId);
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await request.range(from, to);

  if (error) throw error;

  return {
    refunds: data,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }
  };
};


// Get one refund request
export const getRefundById = async (organizationId, refundId) => {
  const { data, error } = await supabaseAdmin
    .from("refund_requests")
    .select("*")
    .eq("id", refundId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Refund request not found");
  }

  return data;
};


// Approve refund and immediately cancel subscription
// Requires the approve_refund_request SQL function.
export const approveRefund = async (
  organizationId,
  refundId,
  reviewedBy,
  reviewNote
) => {
  const { data, error } = await supabaseAdmin.rpc(
    "approve_refund_request",
    {
      p_organization_id: organizationId,
      p_refund_request_id: refundId,
      p_reviewed_by: reviewedBy,
      p_review_note: reviewNote || null
    }
  );

  if (error) throw error;

  return data;
};


// Reject refund request
export const rejectRefund = async (
  organizationId,
  refundId,
  reviewedBy,
  reviewNote
) => {
  const { data, error } = await supabaseAdmin
    .from("refund_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null
    })
    .eq("id", refundId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Refund request is not pending");
  }

  return data;
};


// Record a refund that has actually been sent
export const processRefund = async (organizationId, refundId, body) => {
  const { refundMethod, refundReference } = body;

  if (!["manual", "simulated"].includes(refundMethod)) {
    throw new Error("Invalid refund method");
  }

  // Only approved requests can be processed
  const { data: refund, error: refundError } = await supabaseAdmin
    .from("refund_requests")
    .select("*")
    .eq("id", refundId)
    .eq("organization_id", organizationId)
    .single();

  if (refundError || !refund) {
    throw new Error("Refund request not found");
  }

  if (refund.status !== "approved") {
    throw new Error("Refund request is not approved");
  }

  // Find the payment
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("id", refund.payment_id)
    .eq("organization_id", organizationId)
    .single();

  if (paymentError || !payment) {
    throw new Error("Payment not found");
  }

  // Calculate total completed refunds including this one
  const { data: completedRefunds, error: completedError } =
    await supabaseAdmin
      .from("refund_requests")
      .select("amount")
      .eq("payment_id", payment.id)
      .eq("organization_id", organizationId)
      .eq("status", "completed");

  if (completedError) throw completedError;

  const totalRefunded = (completedRefunds || []).reduce(
    (total, item) => total + Number(item.amount),
    0
  ) + Number(refund.amount);

  const paymentStatus =
    totalRefunded >= Number(payment.amount)
      ? "refunded"
      : "partially_refunded";

  // Update refund request
  const { data: updatedRefund, error: updateRefundError } =
    await supabaseAdmin
      .from("refund_requests")
      .update({
        status: "completed",
        refund_method: refundMethod,
        refund_reference: refundReference || null,
        processed_at: new Date().toISOString()
      })
      .eq("id", refundId)
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .select()
      .maybeSingle();

  if (updateRefundError) throw updateRefundError;

  if (!updatedRefund) {
    throw new Error("Refund request is not approved");
  }

  // Update payment status
  const { error: paymentUpdateError } = await supabaseAdmin
    .from("payments")
    .update({ status: paymentStatus })
    .eq("id", payment.id)
    .eq("organization_id", organizationId);

  if (paymentUpdateError) throw paymentUpdateError;

  return {
    refund: updatedRefund,
    paymentStatus
  };
};
