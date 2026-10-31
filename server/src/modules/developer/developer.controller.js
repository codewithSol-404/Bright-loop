import {
    listApiKeys,
    createApiKey,
    revokeApiKey
} from "./developer.service.js";

const handleError = (res, error) => {
    console.error("Developer API error:", error);

    const message = error.message || "Developer operation failed";

    const status =
        message.includes("not found") ? 404 :
        message.includes("required") ||
        message.includes("Invalid") ||
        message.includes("must") ? 400 : 500;

    return res.status(status).json({
        success: false,
        message
    });
};

export const getApiKeys = async (req, res) => {
    try {
        const data = await listApiKeys(
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

export const addApiKey = async (req, res) => {
    try {
        const data = await createApiKey(
            req.user.organizationId,
            req.body || {}
        );

        return res.status(201).json({
            success: true,
            message: "API key created. Copy and save it now.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteApiKey = async (req, res) => {
    try {
        const data = await revokeApiKey(
            req.user.organizationId,
            req.params.id
        );

        return res.json({
            success: true,
            message: "API key revoked successfully",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};