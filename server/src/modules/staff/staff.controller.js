
import {
    createStaff,
    getStaff,
    updateStaff,
    updateStaffStatus,
    employmentTypes
} from "./staff.service.js";

const handleError = (res, error) => {
    console.error("Staff API error:", error);

    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "A staff account with this email or information already exists"
        });
    }

    if (error.message === "Invalid department") {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    if (error.message === "Staff member not found") {
        return res.status(404).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
        success: false,
        message: error.message || "Something went wrong"
    });
};

// POST /api/staff
export const addStaff = async (req, res) => {
    try {
        const {
            fullName,
            email,
            phoneNumber,
            departmentId,
            employmentType
        } = req.body || {};

        if (
            typeof fullName !== "string" ||
            !fullName.trim() ||
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid full name and email are required"
            });
        }

        if (!employmentTypes.includes(employmentType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employment type"
            });
        }

        if (
            phoneNumber !== undefined &&
            phoneNumber !== null &&
            typeof phoneNumber !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be text"
            });
        }

        const staff = await createStaff(req.user.organizationId, {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phoneNumber: phoneNumber?.trim() || null,
            departmentId: departmentId || null,
            employmentType
        });

        return res.status(201).json({
            success: true,
            message: "Staff invitation sent successfully",
            data: staff
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/staff
export const listStaff = async (req, res) => {
    try {
        const result = await getStaff(
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

// PATCH /api/staff/:id
export const editStaff = async (req, res) => {
    try {
        const {
            fullName,
            phoneNumber,
            departmentId,
            employmentType
        } = req.body || {};

        const updates = {};

        if (fullName !== undefined) {
            if (
                typeof fullName !== "string" ||
                !fullName.trim() ||
                fullName.trim().length > 150
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid full name"
                });
            }

            updates.full_name = fullName.trim();
        }

        if (phoneNumber !== undefined) {
            if (
                phoneNumber !== null &&
                typeof phoneNumber !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number"
                });
            }

            updates.phone_number = phoneNumber?.trim() || null;
        }

        if (departmentId !== undefined) {
            updates.department_id = departmentId || null;
        }

        if (employmentType !== undefined) {
            if (!employmentTypes.includes(employmentType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid employment type"
                });
            }

            updates.employment_type = employmentType;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided to update"
            });
        }

        const staff = await updateStaff(
            req.user.organizationId,
            req.params.id,
            updates
        );

        return res.status(200).json({
            success: true,
            message: "Staff updated successfully",
            data: staff
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/staff/:id/status
export const changeStaffStatus = async (req, res) => {
    try {
        const { status } = req.body || {};

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or inactive"
            });
        }

        if (req.params.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot deactivate your own account"
            });
        }

        const staff = await updateStaffStatus(
            req.user.organizationId,
            req.params.id,
            status
        );

        return res.status(200).json({
            success: true,
            message: `Staff ${status === "active" ? "activated" : "deactivated"} successfully`,
            data: staff
        });
    } catch (error) {
        return handleError(res, error);
    }
};
