
import express from "express";

import {
    getProducts,
    addProduct,
    getPlans,
    addPlan,
    changePlanStatus
} from "./catalog.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.use(authorizeRoles("admin"));

router.get("/products", getProducts);
router.post("/products", addProduct);

router.get("/plans", getPlans);
router.post("/plans", addPlan);
router.patch("/plans/:id/status", changePlanStatus);

export default router;
