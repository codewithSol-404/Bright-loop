import {
    listDiscounts,
    createDiscount,
    updateDiscount
} from "./discount.service.js";

const handleError = (res, error) => {
    const message = error.message || "Discount operation failed";

    const status =
        message.includes("not found") ? 404 :
        message.includes("required") ||
        message.includes("must") ||
        message.includes("Invalid") ||
        message.includes("limit") ||
        message.includes("expired") ||
        message.includes("active") ||
        message.includes("minimum") ||
        message.includes("currency") ||
        message.includes("valid for") ? 400 : 500;

    console.error("Discount API error:", error);

    return res.status(status).json({
        success: false,
        message
    });
};

export const getDiscounts = async (req, res) => {
    try {
        const data = await listDiscounts(
            req.user.organizationId
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const addDiscount = async (req, res) => {
    try {
        const data = await createDiscount(
            req.user.organizationId,
            req.body || {}
        );

        return res.status(201).json({
            success: true,
            message: "Discount created",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const editDiscount = async (req, res) => {
    try {
        const data = await updateDiscount(
            req.user.organizationId,
            req.params.id,
            req.body || {}
        );

        return res.json({
            success: true,
            message: "Discount updated",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};