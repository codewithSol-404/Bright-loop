
import {
    createCustomer,
    getCustomers,
    updateCustomer,
    updateCustomerStatus
} from "./customer.service.js";

const handleError = (res, error) => {
    console.error("Customer API error:", error);

    if (error.message === "Customer not found") {
        return res.status(404).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
        success: false,
        message: error.message || "Customer operation failed"
    });
};

export const addCustomer = async (req, res) => {
    try {
        const { name, email, phoneNumber, companyName } = req.body || {};

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid customer name and email are required"
            });
        }

        const customer = await createCustomer(
            req.user.organizationId,
            {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phoneNumber,
                companyName
            }
        );

        return res.status(201).json({
            success: true,
            message: "Customer created successfully",
            data: customer
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listCustomers = async (req, res) => {
    try {
        const result = await getCustomers(
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

export const editCustomer = async (req, res) => {
    try {
        const { name, email, phoneNumber, companyName } = req.body || {};
        const updates = {};

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid customer name"
                });
            }
            updates.name = name.trim();
        }

        if (email !== undefined) {
            if (
                typeof email !== "string" ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email address"
                });
            }
            updates.email = email.trim().toLowerCase();
        }

        if (phoneNumber !== undefined) {
            updates.phone_number = phoneNumber || null;
        }

        if (companyName !== undefined) {
            updates.company_name = companyName || null;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No fields provided to update"
            });
        }

        const customer = await updateCustomer(
            req.user.organizationId,
            req.params.id,
            updates
        );

        return res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            data: customer
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const changeCustomerStatus = async (req, res) => {
    try {
        const { status } = req.body || {};

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or inactive"
            });
        }

        const customer = await updateCustomerStatus(
            req.user.organizationId,
            req.params.id,
            status
        );

        return res.status(200).json({
            success: true,
            message: "Customer status updated",
            data: customer
        });
    } catch (error) {
        return handleError(res, error);
    }
};
