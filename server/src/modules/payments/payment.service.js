
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";

// Get or create organization payment settings
export const getPaymentSettings = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("payment_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: created, error: createError } = await supabaseAdmin
        .from("payment_settings")
        .insert({ organization_id: organizationId })
        .select()
        .single();

    if (createError) throw createError;

    return created;
};

// Update organization payment settings
export const updatePaymentSettings = async (organizationId, body) => {
    const current = await getPaymentSettings(organizationId);

    const updates = {};

    if (typeof body.manualPaymentsEnabled === "boolean") {
        updates.manual_payments_enabled = body.manualPaymentsEnabled;
    }

    if (typeof body.simulatedOnlineEnabled === "boolean") {
        updates.simulated_online_enabled = body.simulatedOnlineEnabled;
    }

    if (body.preferredProvider !== undefined) {
        if (!["manual", "simulated"].includes(body.preferredProvider)) {
            throw new Error("Invalid payment provider");
        }

        updates.preferred_provider = body.preferredProvider;
    }

    if (Object.keys(updates).length === 0) {
        return current;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from("payment_settings")
        .update(updates)
        .eq("organization_id", organizationId)
        .select()
        .single();

    if (error) throw error;

    return data;
};

// Create a payment against an invoice
export const createPayment = async (organizationId, body) => {
    const { invoiceId, method, transactionReference } = body;

    const allowedMethods = [
        "cash",
        "upi",
        "bank_transfer",
        "simulated_online"
    ];

    if (!allowedMethods.includes(method)) {
        throw new Error("Invalid payment method");
    }

    const settings = await getPaymentSettings(organizationId);

    const isSimulated = method === "simulated_online";

    if (isSimulated && !settings.simulated_online_enabled) {
        throw new Error("Simulated online payments are disabled");
    }

    if (!isSimulated && !settings.manual_payments_enabled) {
        throw new Error("Manual payments are disabled");
    }

    // Find invoice within this organization
    const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error("Invoice not found");

    if (!["open", "overdue"].includes(invoice.status)) {
        throw new Error("Invoice is not payable");
    }

    if (Number(invoice.total_amount) <= 0) {
        throw new Error("Invoice amount must be greater than zero");
    }

    // Prevent another pending or successful payment for this invoice
    const { data: existingPayments, error: existingError } =
        await supabaseAdmin
            .from("payments")
            .select("id,status")
            .eq("invoice_id", invoiceId)
            .eq("organization_id", organizationId)
            .in("status", ["pending", "succeeded"]);

    if (existingError) throw existingError;

    if (existingPayments?.length) {
        throw new Error("An active payment already exists for this invoice");
    }

    if (!isSimulated && transactionReference &&
        typeof transactionReference !== "string") {
        throw new Error("Invalid transaction reference");
    }

    const paymentId = randomUUID();

    const { data: payment, error } = await supabaseAdmin
        .from("payments")
        .insert({
            id: paymentId,
            organization_id: organizationId,
            invoice_id: invoice.id,
            customer_id: invoice.customer_id,
            amount: invoice.total_amount,
            currency: invoice.currency,
            payment_method: method,
            provider: isSimulated ? "simulated" : "manual",
            provider_payment_id: isSimulated
                ? `DEMO-${paymentId}`
                : null,
            transaction_reference: isSimulated
                ? null
                : transactionReference || null,
            status: "pending"
        })
        .select()
        .single();

    if (error) throw error;

    return payment;
};

// Confirm a pending payment and settle its invoice
const settlePayment = async (organizationId, paymentId, expectedProvider) => {
    const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) throw new Error("Payment not found");

    if (payment.status !== "pending") {
        throw new Error("Payment is not pending");
    }

    if (payment.provider !== expectedProvider) {
        throw new Error("Payment provider does not match");
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", payment.invoice_id)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice || !["open", "overdue"].includes(invoice.status)) {
        throw new Error("Invoice cannot be settled");
    }

    if (Number(payment.amount) !== Number(invoice.total_amount)) {
        throw new Error("Payment amount does not match invoice");
    }

    const paidAt = new Date().toISOString();

    // Mark payment successful
    const { data: updatedPayment, error: updatePaymentError } =
        await supabaseAdmin
            .from("payments")
            .update({
                status: "succeeded",
                paid_at: paidAt
            })
            .eq("id", paymentId)
            .eq("organization_id", organizationId)
            .eq("status", "pending")
            .select()
            .maybeSingle();

    if (updatePaymentError) throw updatePaymentError;
    if (!updatedPayment) throw new Error("Payment was already processed");

    // Mark invoice paid
    const { data: updatedInvoice, error: updateInvoiceError } =
        await supabaseAdmin
            .from("invoices")
            .update({
                status: "paid",
                paid_at: paidAt
            })
            .eq("id", invoice.id)
            .eq("organization_id", organizationId)
            .in("status", ["open", "overdue"])
            .select()
            .maybeSingle();

    if (updateInvoiceError || !updatedInvoice) {
        throw updateInvoiceError || new Error("Could not update invoice");
    }

    // Activate subscription
    const { data: subscription, error: subscriptionError } =
        await supabaseAdmin
            .from("subscriptions")
            .update({ status: "active" })
            .eq("id", invoice.subscription_id)
            .eq("organization_id", organizationId)
            .eq("status", "pending")
            .select()
            .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    return {
        payment: updatedPayment,
        invoice: updatedInvoice,
        subscription
    };
};

// Admin confirms a manual payment
export const confirmManualPayment = async (organizationId, paymentId) => {
    return settlePayment(organizationId, paymentId, "manual");
};

// Demo-only simulated online confirmation
export const simulateOnlineSuccess = async (organizationId, paymentId) => {
    return settlePayment(organizationId, paymentId, "simulated");
};

// List payment history
export const getPayments = async (organizationId, filters) => {
    let query = supabaseAdmin
        .from("payments")
        .select(`
            *,
            invoice:invoices(id,invoice_number,status,total_amount),
            customer:customers(id,name,email)
        `, { count: "exact" })
        .eq("organization_id", organizationId);

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    if (filters.customerId) {
        query = query.eq("customer_id", filters.customerId);
    }

    if (filters.invoiceId) {
        query = query.eq("invoice_id", filters.invoiceId);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const from = (page - 1) * limit;

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

    if (error) throw error;

    return { payments: data, total: count, page, limit };
};
