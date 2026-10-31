
import { supabaseAdmin } from "../../config/supabase.js";

const getDateRange = (period) => {
  const now = new Date();

  if (period === "all") {
    return { from: null, to: now.toISOString() };
  }

  const days = {
    "7d": 7,
    "30d": 30,
    "90d": 90
  }[period];

  if (!days) {
    throw new Error("Invalid period. Use 7d, 30d, 90d or all");
  }

  const from = new Date(now);
  from.setDate(from.getDate() - days);

  return {
    from: from.toISOString(),
    to: now.toISOString()
  };
};

const applyDateFilter = (query, column, range) => {
  if (range.from) query = query.gte(column, range.from);
  if (range.to) query = query.lte(column, range.to);
  return query;
};

const sumByCurrency = (rows, amountField = "amount") => {
  const totals = {};

  for (const row of rows || []) {
    const currency = row.currency || "INR";
    totals[currency] =
      (totals[currency] || 0) + Number(row[amountField] || 0);
  }

  return totals;
};

const normalizeToMonthly = (price, interval, count = 1) => {
  const amount = Number(price);
  const intervalCount = Math.max(1, Number(count) || 1);

  switch (interval) {
    case "day":
      return amount * 365 / (12 * intervalCount);
    case "week":
      return amount * 52 / (12 * intervalCount);
    case "month":
      return amount / intervalCount;
    case "year":
      return amount / (12 * intervalCount);
    default:
      return 0;
  }
};

export const getDashboardAnalytics = async (
  organizationId,
  period = "30d"
) => {
  const range = getDateRange(period);

  // Fetch dashboard data in parallel.
  const [
    paymentsResult,
    pendingPaymentsResult,
    refundsResult,
    subscriptionsResult,
    customersResult,
    plansResult
  ] = await Promise.all([
    applyDateFilter(
      supabaseAdmin
        .from("payments")
        .select("id, amount, currency, status, paid_at, created_at")
        .eq("organization_id", organizationId)
        .in("status", ["succeeded", "partially_refunded", "refunded"]),
      "paid_at",
      range
    ),

    supabaseAdmin
      .from("payments")
      .select("amount, currency")
      .eq("organization_id", organizationId)
      .eq("status", "pending"),

    applyDateFilter(
      supabaseAdmin
        .from("refund_requests")
        .select("amount, payment_id, processed_at")
        .eq("organization_id", organizationId)
        .eq("status", "completed"),
      "processed_at",
      range
    ),

    supabaseAdmin
      .from("subscriptions")
      .select("id, plan_id, status, created_at, canceled_at")
      .eq("organization_id", organizationId),

    applyDateFilter(
      supabaseAdmin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      "created_at",
      range
    ),

    supabaseAdmin
      .from("plans")
      .select("id, name, price, currency, billing_interval, interval_count")
      .eq("organization_id", organizationId)
  ]);

  const results = [
    paymentsResult,
    pendingPaymentsResult,
    refundsResult,
    subscriptionsResult,
    customersResult,
    plansResult
  ];

  const failedResult = results.find(result => result.error);

  if (failedResult) {
    throw failedResult.error;
  }

  const payments = paymentsResult.data || [];
  const pendingPayments = pendingPaymentsResult.data || [];
  const refunds = refundsResult.data || [];
  const subscriptions = subscriptionsResult.data || [];
  const plans = plansResult.data || [];

  // Revenue calculations
  const grossRevenue = sumByCurrency(payments);

  // Match refunds with their payment currency.
const refundPaymentIds = [
  ...new Set(refunds.map(refund => refund.payment_id).filter(Boolean))
];

const paymentCurrencyMap = new Map(
  payments.map(payment => [
    payment.id,
    payment.currency || "INR"
  ])
);

if (refundPaymentIds.length > 0) {
  const { data: refundPayments, error } = await supabaseAdmin
    .from("payments")
    .select("id, currency")
    .eq("organization_id", organizationId)
    .in("id", refundPaymentIds);

  if (error) throw error;

  for (const payment of refundPayments || []) {
    paymentCurrencyMap.set(payment.id, payment.currency || "INR");
  }
}

const refundsWithCurrency = refunds.map(refund => ({
  ...refund,
  currency: paymentCurrencyMap.get(refund.payment_id) || "INR"
}));

const refundedAmount = sumByCurrency(refundsWithCurrency);

  const netRevenue = {};

  for (const currency of new Set([
    ...Object.keys(grossRevenue),
    ...Object.keys(refundedAmount)
  ])) {
    netRevenue[currency] =
      (grossRevenue[currency] || 0) -
      (refundedAmount[currency] || 0);
  }

  const pendingAmount = sumByCurrency(pendingPayments);

  // Subscription status counts
  const subscriptionCounts = {
    active: 0,
    pending: 0,
    past_due: 0,
    canceled: 0,
    expired: 0
  };

  for (const subscription of subscriptions) {
    if (subscriptionCounts[subscription.status] !== undefined) {
      subscriptionCounts[subscription.status]++;
    }
  }

  // Calculate MRR from active subscriptions.
  const activeSubscriptions = subscriptions.filter(
    subscription => subscription.status === "active"
  );

  const planMap = new Map(plans.map(plan => [plan.id, plan]));
  const mrrByCurrency = {};

  for (const subscription of activeSubscriptions) {
    const plan = planMap.get(subscription.plan_id);
    if (!plan) continue;

    const currency = plan.currency || "INR";
    const monthlyAmount = normalizeToMonthly(
      plan.price,
      plan.billing_interval,
      plan.interval_count
    );

    mrrByCurrency[currency] =
      (mrrByCurrency[currency] || 0) + monthlyAmount;
  }

  // Group MRR by plan.
  const planAnalytics = {};

  for (const subscription of activeSubscriptions) {
    const plan = planMap.get(subscription.plan_id);
    if (!plan) continue;

    if (!planAnalytics[plan.id]) {
      planAnalytics[plan.id] = {
        planId: plan.id,
        planName: plan.name,
        currency: plan.currency || "INR",
        activeSubscriptions: 0,
        mrr: 0
      };
    }

    planAnalytics[plan.id].activeSubscriptions++;

    planAnalytics[plan.id].mrr += normalizeToMonthly(
      plan.price,
      plan.billing_interval,
      plan.interval_count
    );
  }

  // Revenue trend, grouped by date and currency.
  const trendMap = {};

  for (const payment of payments) {
    if (!payment.paid_at) continue;

    const date = payment.paid_at.slice(0, 10);
    const currency = payment.currency || "INR";
    const key = `${date}_${currency}`;

    if (!trendMap[key]) {
      trendMap[key] = {
        date,
        currency,
        revenue: 0
      };
    }

    trendMap[key].revenue += Number(payment.amount);
  }

  const revenueTrend = Object.values(trendMap).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  return {
    period,

    overview: {
      grossRevenue,
      refundedAmount,
      netRevenue,
      activeSubscriptions: activeSubscriptions.length,
      newCustomers: customersResult.count || 0,
      pendingPayments: {
        count: pendingPayments.length,
        amount: pendingAmount
      },
      mrr: mrrByCurrency
    },

    subscriptionBreakdown: subscriptionCounts,

    planAnalytics: Object.values(planAnalytics),

    revenueTrend
  };
};
