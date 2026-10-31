import express from "express";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import {
    getApiKeys,
    addApiKey,
    deleteApiKey
} from "./developer.controller.js";

const router = express.Router();

router.use(
    authenticateUser,
    authorizeRoles("admin")
);

// List API keys
router.get("/keys", getApiKeys);

// Generate API key
router.post("/keys", addApiKey);

// Revoke API key
router.delete("/keys/:id", deleteApiKey);

export default router;