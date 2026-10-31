
import * as refundService from "./refund.service.js";

const handleError = (res, error) => {
  console.error("Refund error:", error.message);

  const knownErrors = [
    "Payment not found",
    "Invoice not found",
    "Refund request not found",
    "Payment is not refundable",
    "Refund amount exceeds the refundable balance",
    "Refund request is not pending",
    "Refund request is not approved",
    "Refund amount must be greater than zero",
    "Reason is required",
    "Invalid refund method"
  ];

  const status = knownErrors.some(message =>
    error.message?.includes(message)
  ) ? 400 : 500;

  return res.status(status).json({
    success: false,
    message: error.message || "Something went wrong"
  });
};

export const createRefund = async (req, res) => {
  try {
    const data = await refundService.createRefund(
      req.user.organizationId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Refund request created successfully",
      data
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getRefunds = async (req, res) => {
  try {
    const data = await refundService.getRefunds(
      req.user.organizationId,
      req.query
    );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getRefundById = async (req, res) => {
  try {
    const data = await refundService.getRefundById(
      req.user.organizationId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const approveRefund = async (req, res) => {
  try {
    const data = await refundService.approveRefund(
      req.user.organizationId,
      req.params.id,
      req.user.id,
      req.body?.reviewNote
    );

    return res.status(200).json({
      success: true,
      message: "Refund approved. Subscription cancelled.",
      data
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const rejectRefund = async (req, res) => {
  try {
    const data = await refundService.rejectRefund(
      req.user.organizationId,
      req.params.id,
      req.user.id,
      req.body?.reviewNote
    );

    return res.status(200).json({
      success: true,
      message: "Refund request rejected",
      data
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const processRefund = async (req, res) => {
  try {
    const data = await refundService.processRefund(
      req.user.organizationId,
      req.params.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Refund marked as completed",
      data
    });
  } catch (error) {
    return handleError(res, error);
  }
};
