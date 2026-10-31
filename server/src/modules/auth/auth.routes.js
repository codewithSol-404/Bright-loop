import express from "express";

import registerRoutes from "./register/register.routes.js";
import loginRoutes from "./login/login.routes.js";

const router = express.Router();

router.use("/register", registerRoutes);
router.use("/login", loginRoutes);

export default router;