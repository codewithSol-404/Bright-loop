import express from "express";
import { loginUser } from "./login.controller.js";

const router = express.Router();

router.post("/", loginUser);

export default router;