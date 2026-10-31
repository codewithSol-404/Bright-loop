import express from "express";

import registerRoutes from "./register/register.routes.js";
import loginRoutes from "./login/login.routes.js";

import { authenticateUser } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use("/register", registerRoutes);
router.use("/login", loginRoutes);

// Get currently logged-in user
router.get("/me", authenticateUser, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated successfully",
    user: req.user
  });
});

export default router;