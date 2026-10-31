import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";

import {
    validateAndCalculateDiscount
} from "../discounts/discount.service.js";

import {
    calculateCheckoutTax
} from "../taxes/tax.service.js";
import { createCustomCheckout } from "../gateway/checkout.service.js";


// Get active products belonging to the API key's organization
export const getPublicProducts = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("products")
        .select("public_id,name,description,status")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("name");

    if (error) throw error;

    return data;
};

// Get active plans
export const getPublicPlans = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("plans")
        .select(`
            public_id,
            name,
            description,
            price,
            currency,
            billing_interval,
            interval_count,
            trial_days,
            product:products(public_id,name)
        `)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
};

// Find an existing customer or create a new one
const getOrCreateCustomer = async (organizationId, customerInput) => {
    if (
        !customerInput?.name?.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInput.email || "")
    ) {
        throw new Error("Customer name and valid email are required");
    }

    const email = customerInput.email.trim().toLowerCase();

    const { data: existing, error: lookupError } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("organization_id", organizationId)
        .ilike("email", email)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing) return existing;

    const { data, error } = await supabaseAdmin
        .from("customers")
        .insert({
            organization_id: organizationId,
            name: customerInput.name.trim(),
            email,
            phone_number: customerInput.phoneNumber || null,
            company_name: customerInput.companyName || null,
            billing_address: customerInput.billingAddress || {}
        })
        .select("*")
        .single();

    if (error) throw error;

    return data;
};

// Create checkout session
export const createPublicCheckoutSession = async (
    organizationId,
    body
) => {
    if (!body.planId) {
        throw new Error("Plan ID is required");
    }

    const { data: plan, error: planError } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("public_id", body.planId)
        .eq("status", "active")
        .maybeSingle();

    if (planError) throw planError;

    if (!plan) {
        throw new Error("Active plan not found");
    }

    const customer = await getOrCreateCustomer(
        organizationId,
        body.customer
    );

    const subtotal = Number(plan.price);
    const currency = plan.currency || "INR";

    // Calculate discount
    const discountResult = await validateAndCalculateDiscount({
        organizationId,
        code: body.discountCode,
        planId: plan.id,
        productId: plan.product_id,
        customerId: customer.id,
        subtotal,
        currency
    });

    const afterDiscount = Math.max(
        0,
        subtotal - discountResult.discountAmount
    );

    // Calculate tax
    const taxResult = await calculateCheckoutTax({
        organizationId,
        plan,
        subtotalAfterDiscount: afterDiscount,
        billingAddress:
            body.customer.billingAddress ||
            customer.billing_address ||
            {},
        customerTaxExempt: customer.tax_exempt === true
    });

    if (taxResult.requiresBillingAddress) {
        throw new Error(
            "Customer billing countryCode is required to calculate tax"
        );
    }

    const sessionId = randomUUID();

    const expiresAt = new Date(
        Date.now() + 30 * 60 * 1000
    ).toISOString();

    // Save a snapshot of the checkout pricing
    const pricingSnapshot = {
        plan: {
            id: plan.id,
            publicId: plan.public_id,
            name: plan.name,
            billingInterval: plan.billing_interval,
            intervalCount: plan.interval_count
        },
        subtotal,
        discount: discountResult.discount
            ? {
                id: discountResult.discount.id,
                code: discountResult.discount.code,
                type: discountResult.discount.discount_type,
                value: discountResult.discount.discount_value,
                amount: discountResult.discountAmount
            }
            : null,
        taxLines: taxResult.taxLines,
        currency
    };

    const { data: session, error: sessionError } =
        await supabaseAdmin
            .from("checkout_sessions")
            .insert({
                id: sessionId,
                organization_id: organizationId,
                customer_id: customer.id,
                plan_id: plan.id,
                status: "open",
                success_url: body.successUrl || null,
                cancel_url: body.cancelUrl || null,
                currency,
                subtotal,
                discount_amount: discountResult.discountAmount,
                tax_amount: taxResult.taxAmount,
                total_amount: taxResult.totalAmount,
                discount_code: discountResult.discount?.code || null,
                pricing_snapshot: pricingSnapshot,
                customer_snapshot: {
                    name: customer.name,
                    email: customer.email,
                    billingAddress:
                        body.customer.billingAddress ||
                        customer.billing_address ||
                        {}
                },
                metadata: body.metadata || {},
                expires_at: expiresAt
            })
            .select("*")
            .single();

    if (sessionError) throw sessionError;

    // Reserve the discount for this checkout
    if (discountResult.discount) {
        const { error: redemptionError } = await supabaseAdmin
            .from("discount_redemptions")
            .insert({
                organization_id: organizationId,
                discount_id: discountResult.discount.id,
                customer_id: customer.id,
                checkout_session_id: session.id,
                amount_discounted: discountResult.discountAmount,
                currency,
                status: "reserved",
                reserved_until: expiresAt
            });

        if (redemptionError) {
            await supabaseAdmin
                .from("checkout_sessions")
                .delete()
                .eq("id", session.id)
                .eq("organization_id", organizationId);

            throw redemptionError;
        }
    }

    const gatewayCheckout = await createCustomCheckout(
    organizationId,
    session.public_id
);

    return {
  id: session.public_id,
  status: session.status,
  expiresAt: session.expires_at,

  customer: {
    id: customer.public_id,
    name: customer.name,
    email: customer.email
  },

  amount: {
    subtotal: Number(session.subtotal),
    discount: Number(session.discount_amount),
    tax: Number(session.tax_amount),
    total: Number(session.total_amount),
    currency: session.currency
  },

  pricing: pricingSnapshot,

  payment: gatewayCheckout,

  checkoutUrl: null
};
};

// Retrieve checkout session details
export const getPublicCheckoutSession = async (
    organizationId,
    publicId
) => {
    const { data, error } = await supabaseAdmin
        .from("checkout_sessions")
        .select(`
            public_id,
            status,
            expires_at,
            completed_at,
            currency,
            subtotal,
            discount_amount,
            tax_amount,
            total_amount,
            pricing_snapshot
        `)
        .eq("organization_id", organizationId)
        .eq("public_id", publicId)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error("Checkout session not found");
    }

    return data;
};