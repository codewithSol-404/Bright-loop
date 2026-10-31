
import express from "express";

import {
    addPayment,
    listPayments,
    confirmPayment,
    simulatePayment,
    getSettings,
    updateSettings
} from "./payment.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);

// Admin and staff
router.get("/", authorizeRoles("admin", "staff"), listPayments);
router.post("/", authorizeRoles("admin", "staff"), addPayment);

// Admin only
router.get("/settings", authorizeRoles("admin"), getSettings);
router.patch("/settings", authorizeRoles("admin"), updateSettings);

router.post("/:id/confirm", authorizeRoles("admin"), confirmPayment);
router.post("/:id/simulate-success", authorizeRoles("admin"), simulatePayment);

export default router;
