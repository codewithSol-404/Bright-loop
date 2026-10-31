
import express from "express";
import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import { getDashboard } from "./analytics.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.get(
  "/dashboard",
  authorizeRoles("admin", "staff"),
  getDashboard
);

export default router;
