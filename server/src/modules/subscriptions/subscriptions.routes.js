
import express from "express";

import {
    addSubscription,
    listSubscriptions,
    cancelSubscriptionById
} from "./subscriptions.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.use(authorizeRoles("admin", "staff"));

router.post("/", addSubscription);
router.get("/", listSubscriptions);
router.patch("/:id/cancel", cancelSubscriptionById);


export default router;
