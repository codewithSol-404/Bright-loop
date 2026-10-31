import { supabaseAdmin } from "../../config/supabase.js";

// ==========================================
// TAX CATEGORIES
// ==========================================

export const getTaxCategories = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("tax_categories")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};

export const createTaxCategory = async (organizationId, body) => {
    if (!body.name?.trim()) {
        throw new Error("Tax category name is required");
    }

    const { data, error } = await supabaseAdmin
        .from("tax_categories")
        .insert({
            organization_id: organizationId,
            name: body.name.trim(),
            description: body.description || null,
            tax_type: body.taxType || "standard",
            status: body.status || "active"
        })
        .select("*")
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// TAX RATES
// ==========================================

export const getTaxRates = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("tax_rates")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};

export const createTaxRate = async (organizationId, body) => {
    if (!body.name?.trim()) {
        throw new Error("Tax rate name is required");
    }

    const rate = Number(body.rate);

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        throw new Error("Tax rate must be between 0 and 100");
    }

    if (!body.taxCategoryId) {
        throw new Error("Tax category is required");
    }

    const { data: category, error: categoryError } =
        await supabaseAdmin
            .from("tax_categories")
            .select("id")
            .eq("id", body.taxCategoryId)
            .eq("organization_id", organizationId)
            .maybeSingle();

    if (categoryError) throw categoryError;
    if (!category) throw new Error("Tax category not found");

    const { data, error } = await supabaseAdmin
        .from("tax_rates")
        .insert({
            organization_id: organizationId,
            tax_category_id: body.taxCategoryId,
            name: body.name.trim(),
            rate,
            country_code: body.countryCode || null,
            state_code: body.stateCode || null,
            postal_code: body.postalCode || null,
            is_inclusive: body.isInclusive ?? false,
            status: body.status || "active"
        })
        .select("*")
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// TAX RULES
// ==========================================

export const getTaxRules = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("tax_rules")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};

export const createTaxRule = async (organizationId, body) => {
    if (!body.name?.trim()) {
        throw new Error("Tax rule name is required");
    }

    if (!body.taxCategoryId) {
        throw new Error("Tax category is required");
    }

    const { data: category, error: categoryError } =
        await supabaseAdmin
            .from("tax_categories")
            .select("id")
            .eq("id", body.taxCategoryId)
            .eq("organization_id", organizationId)
            .maybeSingle();

    if (categoryError) throw categoryError;
    if (!category) throw new Error("Tax category not found");

    const { data, error } = await supabaseAdmin
        .from("tax_rules")
        .insert({
            organization_id: organizationId,
            name: body.name.trim(),
            tax_category_id: body.taxCategoryId,
            country_code: body.countryCode || null,
            state_code: body.stateCode || null,
            priority: body.priority ?? 100,
            status: body.status || "active"
        })
        .select("*")
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// CHECKOUT TAX CALCULATION
// ==========================================

export const calculateCheckoutTax = async ({
    organizationId,
    plan,
    subtotalAfterDiscount,
    billingAddress = {},
    customerTaxExempt = false
}) => {
    const amount = Number(subtotalAfterDiscount);

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Invalid taxable amount");
    }

    if (customerTaxExempt) {
        return {
            taxAmount: 0,
            totalAmount: amount,
            taxLines: [],
            requiresBillingAddress: false
        };
    }

    const { data: product, error: productError } =
        await supabaseAdmin
            .from("products")
            .select("id,tax_category_id,tax_behavior")
            .eq("id", plan.product_id)
            .eq("organization_id", organizationId)
            .maybeSingle();

    if (productError) throw productError;

    if (!product || !product.tax_category_id) {
        return {
            taxAmount: 0,
            totalAmount: amount,
            taxLines: [],
            requiresBillingAddress: false
        };
    }

    const countryCode = billingAddress.countryCode;

    if (!countryCode) {
        return {
            taxAmount: 0,
            totalAmount: amount,
            taxLines: [],
            requiresBillingAddress: true
        };
    }

    const { data: rates, error: ratesError } =
        await supabaseAdmin
            .from("tax_rates")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("tax_category_id", product.tax_category_id)
            .eq("country_code", countryCode)
            .eq("status", "active");

    if (ratesError) throw ratesError;

    const matchingRates = (rates || []).filter(rate => {
        if (
            rate.state_code &&
            rate.state_code !== billingAddress.regionCode
        ) return false;

        if (
            rate.postal_code &&
            rate.postal_code !== billingAddress.postalCode
        ) return false;

        return true;
    });

    if (!matchingRates.length) {
        return {
            taxAmount: 0,
            totalAmount: amount,
            taxLines: [],
            requiresBillingAddress: false
        };
    }

    let taxAmount = 0;
    let totalAmount = amount;

    const taxLines = [];

    const inclusive = product.tax_behavior === "inclusive";

    for (const rate of matchingRates) {
        const percentage = Number(rate.rate);

        const calculatedTax = inclusive
            ? totalAmount - totalAmount / (1 + percentage / 100)
            : amount * percentage / 100;

        taxAmount += calculatedTax;

        if (!inclusive) {
            totalAmount += calculatedTax;
        }

        taxLines.push({
            taxRateId: rate.id,
            name: rate.name,
            rate: percentage,
            amount: Number(calculatedTax.toFixed(2)),
            inclusive
        });
    }

    taxAmount = Number(taxAmount.toFixed(2));
    totalAmount = Number(totalAmount.toFixed(2));

    return {
        taxAmount,
        totalAmount,
        taxLines,
        requiresBillingAddress: false
    };
};