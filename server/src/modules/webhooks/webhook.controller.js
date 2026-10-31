import {
  createWebhookEndpoint,
  listWebhookEndpoints
} from "./webhook.service.js";

import { processCustomWebhook } from "./webhook.processor.js";

const org = (req) => req.user?.organizationId;

export const addEndpoint = async (req, res) => {
  try {
    const data = await createWebhookEndpoint(
      org(req),
      req.body || {}
    );

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getEndpoints = async (req, res) => {
  try {
    const data = await listWebhookEndpoints(org(req));

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const receiveCustomWebhook = async (req, res) => {
  try {
    const result = await processCustomWebhook({
      accountId: req.params.accountId,
      rawBody: req.body,
      signature: req.get("x-oodo-signature"),
      eventId: req.get("x-oodo-event-id")
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};