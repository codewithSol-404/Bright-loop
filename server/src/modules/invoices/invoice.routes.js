
import express from "express";

import {
    listInvoices,
    getInvoice
} from "./invoice.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.use(authorizeRoles("admin", "staff"));

router.get("/", listInvoices);
router.get("/:id", getInvoice);

export default router;
