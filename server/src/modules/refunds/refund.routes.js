
import express from "express";
import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import {
  createRefund,
  getRefunds,
  getRefundById,
  approveRefund,
  rejectRefund,
  processRefund
} from "./refund.controller.js";

const router = express.Router();

router.use(authenticateUser);

// Admin and staff
router.post("/", authorizeRoles("admin", "staff"), createRefund);
router.get("/", authorizeRoles("admin", "staff"), getRefunds);
router.get("/:id", authorizeRoles("admin", "staff"), getRefundById);

// Admin only
router.patch("/:id/approve", authorizeRoles("admin"), approveRefund);
router.patch("/:id/reject", authorizeRoles("admin"), rejectRefund);
router.patch("/:id/process", authorizeRoles("admin"), processRefund);

export default router;
