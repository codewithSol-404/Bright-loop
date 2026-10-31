
import {
    listProducts,
    createProduct,
    listPlans,
    createPlan,
    updatePlanStatus
} from "./catalog.service.js";

const fail = (res, error) => {
    console.error("Catalog error:", error);

    return res.status(
        error.message === "Product not found" ||
        error.message === "Plan not found" ? 404 : 400
    ).json({
        success: false,
        message: error.message
    });
};

export const getProducts = async (req, res) => {
    try {
        const data = await listProducts(req.user.organizationId);
        res.json({ success: true, data });
    } catch (error) {
        fail(res, error);
    }
};

export const addProduct = async (req, res) => {
    try {
        const { name, description } = req.body || {};

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }

        const data = await createProduct(
            req.user.organizationId,
            { name: name.trim(), description }
        );

        res.status(201).json({
            success: true,
            message: "Product created",
            data
        });
    } catch (error) {
        fail(res, error);
    }
};

export const getPlans = async (req, res) => {
    try {
        const data = await listPlans(req.user.organizationId);
        res.json({ success: true, data });
    } catch (error) {
        fail(res, error);
    }
};

export const addPlan = async (req, res) => {
    try {
        const {
            productId,
            name,
            description,
            price,
            currency,
            billingInterval,
            intervalCount,
            trialDays
        } = req.body || {};

        if (
            !productId ||
            !name ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            !["day", "week", "month", "year"].includes(billingInterval)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid product, plan name, price and billing interval are required"
            });
        }

        const data = await createPlan(req.user.organizationId, {
            productId,
            name,
            description,
            price: Number(price),
            currency,
            billingInterval,
            intervalCount: Number(intervalCount) || 1,
            trialDays: Number(trialDays) || 0
        });

        res.status(201).json({
            success: true,
            message: "Plan created",
            data
        });
    } catch (error) {
        fail(res, error);
    }
};

export const changePlanStatus = async (req, res) => {
    try {
        const { status } = req.body || {};

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan status"
            });
        }

        const data = await updatePlanStatus(
            req.user.organizationId,
            req.params.id,
            status
        );

        res.json({ success: true, data });
    } catch (error) {
        fail(res, error);
    }
};
