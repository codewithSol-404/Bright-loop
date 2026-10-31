
import { supabaseAdmin } from "../../config/supabase.js";

export const createCustomer = async (organizationId, customer) => {
    const { data, error } = await supabaseAdmin
        .from("customers")
        .insert({
            organization_id: organizationId,
            name: customer.name,
            email: customer.email,
            phone_number: customer.phoneNumber || null,
            company_name: customer.companyName || null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getCustomers = async (organizationId, filters) => {
    let query = supabaseAdmin
        .from("customers")
        .select("*", { count: "exact" })
        .eq("organization_id", organizationId);

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    if (filters.search) {
        const search = filters.search.replace(/[,%()]/g, " ").trim();

        if (search) {
            query = query.or(
                `name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
            );
        }
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

    const from = (page - 1) * limit;

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

    if (error) throw error;

    return { customers: data, total: count, page, limit };
};

export const updateCustomer = async (
    organizationId,
    customerId,
    updates
) => {
    const { data, error } = await supabaseAdmin
        .from("customers")
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Customer not found");

    return data;
};

export const updateCustomerStatus = async (
    organizationId,
    customerId,
    status
) => {
    return updateCustomer(organizationId, customerId, { status });
};
