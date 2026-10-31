import express from "express";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import {
    listTaxCategories,
    addTaxCategory,
    listTaxRates,
    addTaxRate,
    listTaxRules,
    addTaxRule
} from "./tax.controller.js";

const router = express.Router();

router.use(
    authenticateUser,
    authorizeRoles("admin")
);

// Tax categories
router.get("/categories", listTaxCategories);
router.post("/categories", addTaxCategory);

// Tax rates
router.get("/rates", listTaxRates);
router.post("/rates", addTaxRate);

// Tax rules
router.get("/rules", listTaxRules);
router.post("/rules", addTaxRule);

export default router;