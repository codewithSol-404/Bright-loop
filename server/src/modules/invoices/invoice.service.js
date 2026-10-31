
import { supabaseAdmin } from "../../config/supabase.js";

// List invoices and automatically mark overdue invoices
export const getInvoices = async (organizationId, filters) => {
    const today = new Date().toISOString().slice(0, 10);

    const { error: overdueError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "overdue" })
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .lt("due_date", today);

    if (overdueError) throw overdueError;

    let query = supabaseAdmin
        .from("invoices")
        .select(`
            *,
            customer:customers(id,name,email),
            subscription:subscriptions(id,status)
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

    return { invoices: data, total: count, page, limit };
};

// Get one invoice
export const getInvoiceById = async (organizationId, invoiceId) => {
    const { data, error } = await supabaseAdmin
        .from("invoices")
        .select(`
            *,
            customer:customers(id,name,email,phone_number),
            subscription:subscriptions(id,status,plan_id)
        `)
        .eq("id", invoiceId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Invoice not found");

    return data;
};
