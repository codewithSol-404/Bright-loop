
import express from "express";

import {
    listDepartments,
    addDepartment,
    editDepartment,
    removeDepartment
} from "./department.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.use(authorizeRoles("admin"));

router.get("/", listDepartments);
router.post("/", addDepartment);
router.patch("/:id", editDepartment);
router.delete("/:id", removeDepartment);

export default router;
