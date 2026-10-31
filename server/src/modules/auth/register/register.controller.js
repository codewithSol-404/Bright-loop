import { registerAdminService } from "./register.service.js";

export const registerAdmin = async (req, res) => {
  try {
    const {
      fullName,
      email,
      companyName,
      password,
      confirmPassword
    } = req.body;

    if (!fullName || !email || !companyName || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters"
      });
    }

    const result = await registerAdminService({
      fullName,
      email,
      companyName,
      password
    });

    return res.status(201).json({
      success: true,
      message: result.emailVerificationRequired
        ? "Registration successful. Please verify your email."
        : "Registration successful.",
      data: result
    });

  } catch (error) {
    console.error("Registration error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Registration failed"
    });
  }
};