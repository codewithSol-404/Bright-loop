import express from "express";
import { registerAdmin } from "./register.controller.js";

const router = express.Router();

router.post("/", registerAdmin);

export default router;