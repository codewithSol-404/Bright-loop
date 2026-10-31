import {
    getTaxCategories,
    createTaxCategory,
    getTaxRates,
    createTaxRate,
    getTaxRules,
    createTaxRule
} from "./tax.service.js";

const handleError = (res, error) => {
    console.error("Tax API error:", error);

    const message = error.message || "Tax operation failed";

    const status =
        message.includes("not found") ? 404 :
        message.includes("required") ||
        message.includes("must") ||
        message.includes("between") ? 400 : 500;

    return res.status(status).json({
        success: false,
        message
    });
};

export const listTaxCategories = async (req, res) => {
    try {
        const data = await getTaxCategories(
            req.user.organizationId
        );

        return res.json({ success: true, data });
    } catch (error) {
        return handleError(res, error);
    }
};

export const addTaxCategory = async (req, res) => {
    try {
        const data = await createTaxCategory(
            req.user.organizationId,
            req.body || {}
        );

        return res.status(201).json({
            success: true,
            message: "Tax category created",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listTaxRates = async (req, res) => {
    try {
        const data = await getTaxRates(
            req.user.organizationId
        );

        return res.json({ success: true, data });
    } catch (error) {
        return handleError(res, error);
    }
};

export const addTaxRate = async (req, res) => {
    try {
        const data = await createTaxRate(
            req.user.organizationId,
            req.body || {}
        );

        return res.status(201).json({
            success: true,
            message: "Tax rate created",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listTaxRules = async (req, res) => {
    try {
        const data = await getTaxRules(
            req.user.organizationId
        );

        return res.json({ success: true, data });
    } catch (error) {
        return handleError(res, error);
    }
};

export const addTaxRule = async (req, res) => {
    try {
        const data = await createTaxRule(
            req.user.organizationId,
            req.body || {}
        );

        return res.status(201).json({
            success: true,
            message: "Tax rule created",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};