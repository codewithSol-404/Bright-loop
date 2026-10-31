import express from "express";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

import {
    getDiscounts,
    addDiscount,
    editDiscount
} from "./discount.controller.js";

const router = express.Router();

// Only authenticated admins can manage discounts.
router.use(
    authenticateUser,
    authorizeRoles("admin")
);

// GET all discounts
router.get("/", getDiscounts);

// CREATE a discount
router.post("/", addDiscount);

// UPDATE a discount
router.patch("/:id", editDiscount);

export default router;