
import express from "express";

import {
    addStaff,
    listStaff,
    editStaff,
    changeStaffStatus
} from "./staff.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.use(authorizeRoles("admin"));

router.post("/", addStaff);
router.get("/", listStaff);
router.patch("/:id", editStaff);
router.patch("/:id/status", changeStaffStatus);

export default router;
