import express from "express";

import {
    authenticateApiKey
} from "../../middlewares/api-key.middleware.js";

import {
    products,
    plans,
    createCheckout,
    checkoutDetails
} from "./public-api.controller.js";

const router = express.Router();

// Public product catalog
router.get(
    "/products",
    authenticateApiKey("catalog:read"),
    products
);

// Public subscription plans
router.get(
    "/plans",
    authenticateApiKey("catalog:read"),
    plans
);

// Create checkout session
router.post(
    "/checkout/sessions",
    authenticateApiKey("checkout:write"),
    createCheckout
);

// Retrieve checkout session
router.get(
    "/checkout/sessions/:id",
    authenticateApiKey("checkout:read"),
    checkoutDetails
);

export default router;