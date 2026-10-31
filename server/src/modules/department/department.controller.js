
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment
} from "./department.service.js";

export const listDepartments = async (req, res) => {
    try {
        const departments = await getDepartments(
            req.user.organizationId
        );

        return res.status(200).json({
            success: true,
            data: departments
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const addDepartment = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Department name is required"
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Department name cannot exceed 100 characters"
            });
        }

        const department = await createDepartment(
            req.user.organizationId,
            name.trim()
        );

        return res.status(201).json({
            success: true,
            message: "Department created successfully",
            data: department
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This department already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const editDepartment = async (req, res) => {
    try {
        const { name } = req.body;
        const { id } = req.params;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Department name is required"
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Department name cannot exceed 100 characters"
            });
        }

        const department = await updateDepartment(
            req.user.organizationId,
            id,
            name.trim()
        );

        return res.status(200).json({
            success: true,
            message: "Department updated successfully",
            data: department
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This department already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const removeDepartment = async (req, res) => {
    try {
        await deleteDepartment(
            req.user.organizationId,
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Department deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
