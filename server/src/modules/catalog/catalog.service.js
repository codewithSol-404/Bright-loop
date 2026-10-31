
import { supabaseAdmin } from "../../config/supabase.js";

export const listProducts = async (orgId) => {
    const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};

export const createProduct = async (orgId, body) => {
    const { data, error } = await supabaseAdmin
        .from("products")
        .insert({
            organization_id: orgId,
            name: body.name,
            description: body.description || null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const listPlans = async (orgId) => {
    const { data, error } = await supabaseAdmin
        .from("plans")
        .select("*, product:products(id,name)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};

export const createPlan = async (orgId, body) => {
    // Verify product belongs to this organization
    const { data: product, error: productError } =
        await supabaseAdmin
            .from("products")
            .select("id")
            .eq("id", body.productId)
            .eq("organization_id", orgId)
            .maybeSingle();

    if (productError) throw productError;
    if (!product) throw new Error("Product not found");

    const { data, error } = await supabaseAdmin
        .from("plans")
        .insert({
            organization_id: orgId,
            product_id: body.productId,
            name: body.name,
            description: body.description || null,
            price: body.price,
            currency: body.currency || "INR",
            billing_interval: body.billingInterval,
            interval_count: body.intervalCount || 1,
            trial_days: body.trialDays || 0
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updatePlanStatus = async (orgId, planId, status) => {
    const { data, error } = await supabaseAdmin
        .from("plans")
        .update({ status })
        .eq("id", planId)
        .eq("organization_id", orgId)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Plan not found");

    return data;
};
