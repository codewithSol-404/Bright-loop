import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes.js";
import { authenticateUser } from "./middlewares/auth.middleware.js";
import { authorizeRoles } from "./middlewares/role.middleware.js";

import departmentRoutes from "./modules/department/department.routes.js";
import staffRoutes from "./modules/staff/staff.routes.js";
import customerRoutes from "./modules/customers/customer.routes.js";
import catalogRoutes from "./modules/catalog/catalog.routes.js";
import subscriptionRoutes from "./modules/subscriptions/subscriptions.routes.js";
import invoiceRoutes from "./modules/invoices/invoice.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import refundRoutes from "./modules/refunds/refund.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import discountRoutes from "./modules/discounts/discount.routes.js";
import taxRoutes from "./modules/taxes/tax.routes.js";
import developerRoutes from "./modules/developer/developer.routes.js";
import publicApiRoutes from "./modules/public-api/publlic-api.routes.js";
import gatewayRoutes from "./modules/gateway/gateway.routes.js";
import webhookRoutes from "./modules/webhooks/webhook.routes.js";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

// Mount before express.json() so the gateway callback receives raw bytes.
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server running"
  });
});

app.get(
  "/api/test/admin",
  authenticateUser,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Admin!",
      user: req.user
    });
  }
);

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/refunds", refundRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/taxes", taxRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/gateways", gatewayRoutes);

// Public API authenticated with OOdo API keys.
app.use("/v1", publicApiRoutes);

export default app;