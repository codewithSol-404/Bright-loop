
import {
    getInvoices,
    getInvoiceById
} from "./invoice.service.js";

export const listInvoices = async (req, res) => {
    try {
        const result = await getInvoices(
            req.user.organizationId,
            req.query
        );

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Invoice list error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getInvoice = async (req, res) => {
    try {
        const invoice = await getInvoiceById(
            req.user.organizationId,
            req.params.id
        );

        return res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        console.error("Invoice detail error:", error);

        return res.status(
            error.message === "Invoice not found" ? 404 : 500
        ).json({
            success: false,
            message: error.message
        });
    }
};
