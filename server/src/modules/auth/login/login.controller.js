import { loginUserService } from "./login.service.js";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const result = await loginUserService({ email, password });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Login failed"
    });
  }
};