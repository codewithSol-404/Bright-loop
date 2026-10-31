import { supabaseAdmin } from "../../config/supabase.js";

const DISCOUNT_TYPES = ["percentage", "fixed"];

export const listDiscounts = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("discounts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};

export const createDiscount = async (organizationId, body) => {
    if (!body.name?.trim()) {
        throw new Error("Discount name is required");
    }

    if (!DISCOUNT_TYPES.includes(body.discountType)) {
        throw new Error("Discount type must be percentage or fixed");
    }

    const value = Number(body.discountValue);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Discount value must be greater than zero");
    }

    if (body.discountType === "percentage" && value > 100) {
        throw new Error("Percentage discount cannot exceed 100");
    }

    const insert = {
        organization_id: organizationId,
        name: body.name.trim(),
        code: body.code?.trim().toUpperCase() || null,
        description: body.description || null,
        discount_type: body.discountType,
        discount_value: value,
        currency: body.currency || null,
        max_discount_amount: body.maxDiscountAmount ?? null,
        minimum_amount: body.minimumAmount ?? 0,
        first_purchase_only: body.firstPurchaseOnly ?? false,
        is_automatic: body.isAutomatic ?? false,
        is_stackable: body.isStackable ?? false,
        priority: body.priority ?? 100,
        starts_at: body.startsAt || null,
        ends_at: body.endsAt || null,
        max_redemptions: body.maxRedemptions ?? null,
        max_redemptions_per_customer:
            body.maxRedemptionsPerCustomer ?? null,
        status: body.status || "active"
    };

    const { data, error } = await supabaseAdmin
        .from("discounts")
        .insert(insert)
        .select("*")
        .single();

    if (error) throw error;

    const planIds = Array.isArray(body.planIds)
        ? [...new Set(body.planIds)]
        : [];

    const productIds = Array.isArray(body.productIds)
        ? [...new Set(body.productIds)]
        : [];

    if (planIds.length) {
        const { error: linksError } = await supabaseAdmin
            .from("discount_plans")
            .insert(
                planIds.map(planId => ({
                    organization_id: organizationId,
                    discount_id: data.id,
                    plan_id: planId
                }))
            );

        if (linksError) {
            await supabaseAdmin
                .from("discounts")
                .delete()
                .eq("id", data.id)
                .eq("organization_id", organizationId);

            throw linksError;
        }
    }

    if (productIds.length) {
        const { error: linksError } = await supabaseAdmin
            .from("discount_products")
            .insert(
                productIds.map(productId => ({
                    organization_id: organizationId,
                    discount_id: data.id,
                    product_id: productId
                }))
            );

        if (linksError) {
            await supabaseAdmin
                .from("discounts")
                .delete()
                .eq("id", data.id)
                .eq("organization_id", organizationId);

            throw linksError;
        }
    }

    return data;
};

export const updateDiscount = async (
    organizationId,
    discountId,
    body
) => {
    const updates = {};

    const map = {
        name: "name",
        description: "description",
        discountType: "discount_type",
        discountValue: "discount_value",
        currency: "currency",
        maxDiscountAmount: "max_discount_amount",
        minimumAmount: "minimum_amount",
        firstPurchaseOnly: "first_purchase_only",
        isAutomatic: "is_automatic",
        isStackable: "is_stackable",
        priority: "priority",
        startsAt: "starts_at",
        endsAt: "ends_at",
        maxRedemptions: "max_redemptions",
        maxRedemptionsPerCustomer:
            "max_redemptions_per_customer",
        status: "status"
    };

    for (const [key, column] of Object.entries(map)) {
        if (body[key] !== undefined) {
            updates[column] = body[key];
        }
    }

    if (body.code !== undefined) {
        updates.code = body.code?.trim().toUpperCase() || null;
    }

    if (
        updates.discount_type &&
        !DISCOUNT_TYPES.includes(updates.discount_type)
    ) {
        throw new Error("Invalid discount type");
    }

    if (
        updates.discount_type === "percentage" &&
        Number(updates.discount_value) > 100
    ) {
        throw new Error("Percentage discount cannot exceed 100");
    }

    if (!Object.keys(updates).length) {
        throw new Error("No fields provided to update");
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from("discounts")
        .update(updates)
        .eq("id", discountId)
        .eq("organization_id", organizationId)
        .select("*")
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Discount not found");

    return data;
};

export const validateAndCalculateDiscount = async ({
    organizationId,
    code,
    planId,
    productId,
    customerId,
    subtotal,
    currency
}) => {
    if (!code) {
        return {
            discount: null,
            discountAmount: 0
        };
    }

    const { data: discount, error } = await supabaseAdmin
        .from("discounts")
        .select("*")
        .eq("organization_id", organizationId)
        .ilike("code", code.trim())
        .eq("status", "active")
        .maybeSingle();

    if (error) throw error;

    if (!discount) {
        throw new Error("Invalid or inactive discount code");
    }

    const now = Date.now();

    if (
        discount.starts_at &&
        new Date(discount.starts_at).getTime() > now
    ) {
        throw new Error("Discount is not active yet");
    }

    if (
        discount.ends_at &&
        new Date(discount.ends_at).getTime() <= now
    ) {
        throw new Error("Discount has expired");
    }

    if (Number(subtotal) < Number(discount.minimum_amount)) {
        throw new Error(
            "Order does not meet the minimum amount for this discount"
        );
    }

    if (discount.currency && discount.currency !== currency) {
        throw new Error(
            "Discount currency does not match checkout currency"
        );
    }

    if (
        discount.max_redemptions !== null &&
        Number(discount.redemption_count) >=
            Number(discount.max_redemptions)
    ) {
        throw new Error("Discount redemption limit reached");
    }

    if (discount.max_redemptions_per_customer !== null) {
        const { count, error: countError } = await supabaseAdmin
            .from("discount_redemptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("discount_id", discount.id)
            .eq("customer_id", customerId)
            .eq("status", "redeemed");

        if (countError) throw countError;

        if (
            (count || 0) >=
            Number(discount.max_redemptions_per_customer)
        ) {
            throw new Error("Customer redemption limit reached");
        }
    }

    if (discount.first_purchase_only) {
        const { count, error: purchaseError } = await supabaseAdmin
            .from("subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("customer_id", customerId);

        if (purchaseError) throw purchaseError;

        if ((count || 0) > 0) {
            throw new Error(
                "Discount is only valid for a first purchase"
            );
        }
    }

    const { data: planLinks, error: planLinkError } =
        await supabaseAdmin
            .from("discount_plans")
            .select("plan_id")
            .eq("organization_id", organizationId)
            .eq("discount_id", discount.id);

    if (planLinkError) throw planLinkError;

    const { data: productLinks, error: productLinkError } =
        await supabaseAdmin
            .from("discount_products")
            .select("product_id")
            .eq("organization_id", organizationId)
            .eq("discount_id", discount.id);

    if (productLinkError) throw productLinkError;

    // If eligibility lists are configured,
    // checkout must match at least one.
    if (planLinks?.length || productLinks?.length) {
        const planEligible = (planLinks || []).some(
            link => link.plan_id === planId
        );

        const productEligible = (productLinks || []).some(
            link => link.product_id === productId
        );

        if (!planEligible && !productEligible) {
            throw new Error(
                "Discount is not valid for this plan or product"
            );
        }
    }

    let amount =
        discount.discount_type === "percentage"
            ? Number(subtotal) *
              Number(discount.discount_value) / 100
            : Number(discount.discount_value);

    if (discount.max_discount_amount !== null) {
        amount = Math.min(
            amount,
            Number(discount.max_discount_amount)
        );
    }

    amount = Math.min(
        Number(subtotal),
        Math.max(0, amount)
    );

    amount = Math.round(
        (amount + Number.EPSILON) * 100
    ) / 100;

    return {
        discount,
        discountAmount: amount
    };
};