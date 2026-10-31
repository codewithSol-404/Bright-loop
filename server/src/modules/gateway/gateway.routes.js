import express from "express";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import {
  createGateway,
  getGateways,
  simulatePayment
} from "./gateway.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.get(
  "/",
  authorizeRoles("admin"),
  getGateways
);

router.post(
  "/custom",
  authorizeRoles("admin"),
  createGateway
);

router.post(
  "/simulate/:attemptId",
  authorizeRoles("admin"),
  simulatePayment
);

export default router;