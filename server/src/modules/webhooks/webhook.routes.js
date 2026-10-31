import express from "express";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import {
  addEndpoint,
  getEndpoints,
  receiveCustomWebhook
} from "./webhook.controller.js";

const router = express.Router();

// Incoming gateway callback: preserve raw bytes for signature verification.
router.post(
  "/custom/:accountId",
  express.raw({
    type: "application/json",
    limit: "256kb"
  }),
  receiveCustomWebhook
);

router.use(authenticateUser);

router.get(
  "/endpoints",
  authorizeRoles("admin"),
  getEndpoints
);

router.post(
  "/endpoints",
  express.json(),
  authorizeRoles("admin"),
  addEndpoint
);

export default router;