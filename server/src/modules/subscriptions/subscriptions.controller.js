
import {
    createSubscription,
    getSubscriptions,
    cancelSubscription
} from "./subscriptions.service.js";

const handleError = (res, error) => {
    console.error("Subscription error:", error);

    const clientErrors = [
        "Active customer not found",
        "Active plan not found",
        "Invalid billing interval",
        "Subscription not found or already ended"
    ];

    return res.status(
        clientErrors.includes(error.message) ? 400 : 500
    ).json({
        success: false,
        message: error.message || "Subscription operation failed"
    });
};

// POST /api/subscriptions
export const addSubscription = async (req, res) => {
    try {
        const { customerId, planId } = req.body || {};

        if (!customerId || !planId) {
            return res.status(400).json({
                success: false,
                message: "Customer ID and plan ID are required"
            });
        }

        const result = await createSubscription(
            req.user.organizationId,
            { customerId, planId }
        );

        return res.status(201).json({
            success: true,
            message: "Subscription created and invoice generated. Awaiting payment.",
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/subscriptions
export const listSubscriptions = async (req, res) => {
    try {
        const result = await getSubscriptions(
            req.user.organizationId,
            req.query
        );

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/subscriptions/:id/cancel
export const cancelSubscriptionById = async (req, res) => {
    try {
        const cancelAtPeriodEnd =
            req.body?.cancelAtPeriodEnd === true;

        const data = await cancelSubscription(
            req.user.organizationId,
            req.params.id,
            cancelAtPeriodEnd
        );

        return res.status(200).json({
            success: true,
            message: cancelAtPeriodEnd
                ? "Cancellation scheduled for the end of the billing period"
                : "Subscription canceled",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};
