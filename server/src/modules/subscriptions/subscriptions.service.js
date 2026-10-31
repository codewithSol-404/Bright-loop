
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";

// Calculate the next billing date
const calculatePeriodEnd = (start, interval, count) => {
    const end = new Date(start);

    switch (interval) {
        case "day":
            end.setUTCDate(end.getUTCDate() + count);
            break;

        case "week":
            end.setUTCDate(end.getUTCDate() + (7 * count));
            break;

        case "month": {
            const originalDay = end.getUTCDate();
            end.setUTCDate(1);
            end.setUTCMonth(end.getUTCMonth() + count);
            const lastDay = new Date(
                Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)
            ).getUTCDate();
            end.setUTCDate(Math.min(originalDay, lastDay));
            break;
        }

        case "year": {
            const originalMonth = end.getUTCMonth();
            const originalDay = end.getUTCDate();
            end.setUTCDate(1);
            end.setUTCFullYear(end.getUTCFullYear() + count);
            end.setUTCMonth(originalMonth);
            const lastDay = new Date(
                Date.UTC(end.getUTCFullYear(), originalMonth + 1, 0)
            ).getUTCDate();
            end.setUTCDate(Math.min(originalDay, lastDay));
            break;
        }

        default:
            throw new Error("Invalid billing interval");
    }

    return end;
};

// Create subscription and its first invoice
export const createSubscription = async (organizationId, body) => {
    // Verify customer belongs to this organization
    const { data: customer, error: customerError } =
        await supabaseAdmin
            .from("customers")
            .select("id, status")
            .eq("id", body.customerId)
            .eq("organization_id", organizationId)
            .maybeSingle();

    if (customerError) throw customerError;
    if (!customer || customer.status !== "active") {
        throw new Error("Active customer not found");
    }

    // Verify plan belongs to this organization
    const { data: plan, error: planError } =
        await supabaseAdmin
            .from("plans")
            .select("*")
            .eq("id", body.planId)
            .eq("organization_id", organizationId)
            .maybeSingle();

    if (planError) throw planError;
    if (!plan || plan.status !== "active") {
        throw new Error("Active plan not found");
    }

    const start = new Date();
    const periodEnd = calculatePeriodEnd(
        start,
        plan.billing_interval,
        plan.interval_count
    );

    // Create subscription as pending until payment is confirmed
    const { data: subscription, error: subscriptionError } =
        await supabaseAdmin
            .from("subscriptions")
            .insert({
                organization_id: organizationId,
                customer_id: body.customerId,
                plan_id: body.planId,
                status: "pending",
                start_date: start.toISOString(),
                current_period_start: start.toISOString(),
                current_period_end: periodEnd.toISOString()
            })
            .select()
            .single();

    if (subscriptionError) throw subscriptionError;

    // Generate invoice
    const invoiceNumber =
        `INV-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);

    const { data: invoice, error: invoiceError } =
        await supabaseAdmin
            .from("invoices")
            .insert({
                organization_id: organizationId,
                subscription_id: subscription.id,
                customer_id: body.customerId,
                invoice_number: invoiceNumber,
                subtotal: plan.price,
                tax_amount: 0,
                discount_amount: 0,
                total_amount: plan.price,
                currency: plan.currency,
                status: "open",
                issue_date: issueDate.toISOString().slice(0, 10),
                due_date: dueDate.toISOString().slice(0, 10)
            })
            .select()
            .single();

    if (invoiceError) {
        // Avoid leaving a subscription without its first invoice
        await supabaseAdmin
            .from("subscriptions")
            .delete()
            .eq("id", subscription.id)
            .eq("organization_id", organizationId);

        throw invoiceError;
    }

    return { subscription, invoice };
};

// List subscriptions
export const getSubscriptions = async (organizationId, filters) => {
    let query = supabaseAdmin
        .from("subscriptions")
        .select(`
            *,
            customer:customers(id,name,email),
            plan:plans(id,name,price,currency,billing_interval)
        `, { count: "exact" })
        .eq("organization_id", organizationId);

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    if (filters.customerId) {
        query = query.eq("customer_id", filters.customerId);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const from = (page - 1) * limit;

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

    if (error) throw error;

    return { subscriptions: data, total: count, page, limit };
};

// Cancel subscription
export const cancelSubscription = async (
    organizationId,
    subscriptionId,
    cancelAtPeriodEnd
) => {
    const update = cancelAtPeriodEnd
        ? { cancel_at_period_end: true }
        : {
            status: "canceled",
            cancel_at_period_end: false,
            canceled_at: new Date().toISOString()
        };

    const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .update(update)
        .eq("id", subscriptionId)
        .eq("organization_id", organizationId)
        .in("status", ["pending", "active", "past_due"])
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Subscription not found or already ended");

    return data;
};
