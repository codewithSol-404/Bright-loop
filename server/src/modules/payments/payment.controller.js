
import {
    createPayment,
    confirmManualPayment,
    simulateOnlineSuccess,
    getPayments,
    getPaymentSettings,
    updatePaymentSettings
} from "./payment.service.js";

const handleError = (res, error) => {
    console.error("Payment error:", error);

    const clientErrors = [
        "Invalid payment method",
        "Invalid payment provider",
        "Simulated online payments are disabled",
        "Manual payments are disabled",
        "Invoice not found",
        "Invoice is not payable",
        "Invoice amount must be greater than zero",
        "An active payment already exists for this invoice",
        "Invalid transaction reference",
        "Payment not found",
        "Payment is not pending",
        "Payment provider does not match",
        "Invoice cannot be settled",
        "Payment amount does not match invoice",
        "Payment was already processed",
        "Could not update invoice"
    ];

    return res.status(
        clientErrors.includes(error.message) ? 400 : 500
    ).json({
        success: false,
        message: error.message || "Payment operation failed"
    });
};

// POST /api/payments
export const addPayment = async (req, res) => {
    try {
        const { invoiceId, method } = req.body || {};

        if (!invoiceId || !method) {
            return res.status(400).json({
                success: false,
                message: "Invoice ID and payment method are required"
            });
        }

        const payment = await createPayment(
            req.user.organizationId,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Payment record created. Awaiting confirmation.",
            data: payment
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/payments
export const listPayments = async (req, res) => {
    try {
        const result = await getPayments(
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

// POST /api/payments/:id/confirm
export const confirmPayment = async (req, res) => {
    try {
        const result = await confirmManualPayment(
            req.user.organizationId,
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Manual payment confirmed. Invoice settled.",
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// POST /api/payments/:id/simulate-success
export const simulatePayment = async (req, res) => {
    try {
        const result = await simulateOnlineSuccess(
            req.user.organizationId,
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Demo payment successful. Invoice settled.",
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/payments/settings
export const getSettings = async (req, res) => {
    try {
        const settings = await getPaymentSettings(
            req.user.organizationId
        );

        return res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/payments/settings
export const updateSettings = async (req, res) => {
    try {
        const settings = await updatePaymentSettings(
            req.user.organizationId,
            req.body || {}
        );

        return res.status(200).json({
            success: true,
            message: "Payment settings updated",
            data: settings
        });
    } catch (error) {
        return handleError(res, error);
    }
};
