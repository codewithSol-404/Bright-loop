import {
    getPublicProducts,
    getPublicPlans,
    createPublicCheckoutSession,
    getPublicCheckoutSession
} from "./public-api.service.js";

const handle = (res, error) => {
    console.error("OOdo REST API error:", error);

    const message = error.message || "Request failed";

    const clientError =
        /required|not found|invalid|expired|limit|minimum|currency|not valid|not active|does not/i
            .test(message);

    return res
        .status(clientError ? 400 : 500)
        .json({
            success: false,
            message
        });
};

// GET /v1/products
export const products = async (req, res) => {
    try {
        const data = await getPublicProducts(
            req.apiClient.organizationId
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return handle(res, error);
    }
};

// GET /v1/plans
export const plans = async (req, res) => {
    try {
        const data = await getPublicPlans(
            req.apiClient.organizationId
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return handle(res, error);
    }
};

// POST /v1/checkout/sessions
export const createCheckout = async (req, res) => {
    try {
        const data = await createPublicCheckoutSession(
            req.apiClient.organizationId,
            req.body || {}
        );

        return res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        return handle(res, error);
    }
};

// GET /v1/checkout/sessions/:id
export const checkoutDetails = async (req, res) => {
    try {
        const data = await getPublicCheckoutSession(
            req.apiClient.organizationId,
            req.params.id
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return handle(res, error);
    }
};