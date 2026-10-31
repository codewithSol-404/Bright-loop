import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";

import {
  createCustomGateway,
  listGateways,
  getGatewaySecrets,
  makeSignature
} from "./gateway.service.js";

import { processCustomWebhook } from "../webhooks/webhook.processor.js";

const org = (req) => req.user?.organizationId;

export const createGateway = async (req, res) => {
  try {
    const result = await createCustomGateway(org(req));

    return res.status(201).json({
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

export const getGateways = async (req, res) => {
  try {
    const data = await listGateways(org(req));

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

export const simulatePayment = async (req, res) => {
  try {
    const { data: attempt, error } = await supabaseAdmin
      .from("payment_attempts")
      .select("*,gateway_account:gateway_accounts(*)")
      .eq("organization_id", org(req))
      .eq("id", req.params.attemptId)
      .maybeSingle();

    if (error) throw error;

    if (!attempt || attempt.provider !== "custom") {
      throw new Error("Custom payment attempt not found");
    }

    if (
      !["created", "requires_action", "processing"].includes(
        attempt.status
      )
    ) {
      throw new Error("Payment attempt is not payable");
    }

    const secrets = getGatewaySecrets(attempt.gateway_account);

    const event = {
      id: `evt_${crypto.randomUUID()}`,
      type: "payment.succeeded",
      created_at: new Date().toISOString(),
      data: {
        order_id: attempt.provider_order_id,
        payment_id: `pay_${crypto.randomUUID()}`,
        amount: Math.round(Number(attempt.amount) * 100),
        currency: attempt.currency
      }
    };

    const rawBody = Buffer.from(JSON.stringify(event));

    const result = await processCustomWebhook({
      accountId: attempt.gateway_account_id,
      rawBody,
      signature: makeSignature(secrets.webhookSecret, rawBody),
      eventId: event.id
    });

    return res.json({
      success: true,
      data: result,
      testMode: true
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};