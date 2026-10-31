
import express from "express";

import {
    addCustomer,
    listCustomers,
    editCustomer,
    changeCustomerStatus
} from "./customer.controller.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.use(authorizeRoles("admin", "staff"));

router.post("/", addCustomer);
router.get("/", listCustomers);
router.patch("/:id", editCustomer);
router.patch("/:id/status", changeCustomerStatus);

export default router;
