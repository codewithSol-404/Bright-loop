
import { getDashboardAnalytics } from "./analytics.service.js";

export const getDashboard = async (req, res) => {
  try {
    const period = req.query.period || "30d";

    const data = await getDashboardAnalytics(
      req.user.organizationId,
      period
    );

    return res.status(200).json({
      success: true,
      message: "Dashboard analytics retrieved successfully",
      data
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);

    const invalidPeriod = error.message?.includes("Invalid period");

    return res.status(invalidPeriod ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to retrieve dashboard analytics"
    });
  }
};
