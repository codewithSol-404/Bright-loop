import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";
import {
      encryptJson as encryptJson,
  decryptJson as decryptJson
} from "../../utils/encryption.js";

export const createCustomGateway = async (organizationId) => {
  const { error: resetError } = await supabaseAdmin
    .from("gateway_accounts")
    .update({ is_default: false })
    .eq("organization_id", organizationId)
    .eq("provider", "custom")
    .eq("environment", "test");

  if (resetError) throw resetError;

  const apiKey = `oodo_test_${crypto.randomBytes(24).toString("hex")}`;
  const webhookSecret = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabaseAdmin
    .from("gateway_accounts")
    .insert({
      organization_id: organizationId,
      provider: "custom",
      display_name: "OOdo Test Gateway",
      environment: "test",
      credentials_ciphertext: encryptJson({
        apiKey,
        webhookSecret
      }),
      credential_key_version: "1",
      is_default: true,
      status: "active",
      capabilities: {
        testMode: true,
        currencies: ["INR"],
        methods: ["simulated_online"]
      }
    })
    .select(
      "id,provider,display_name,environment,is_default,status,created_at"
    )
    .single();

  if (error) throw error;

  return {
    gateway: data,
    apiKey,
    webhookSecret
  };
};

export const listGateways = async (organizationId) => {
  const { data, error } = await supabaseAdmin
    .from("gateway_accounts")
    .select(
      "id,provider,display_name,environment,is_default,status,capabilities,created_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
};

export const getGateway = async (organizationId, accountId) => {
  const { data, error } = await supabaseAdmin
    .from("gateway_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", accountId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Active gateway account not found");
  }

  return data;
};

export const getDefaultGateway = async (organizationId) => {
  const { data, error } = await supabaseAdmin
    .from("gateway_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "custom")
    .eq("environment", "test")
    .eq("status", "active")
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "Create an OOdo custom test gateway before accepting checkout"
    );
  }

  return data;
};

export const getGatewaySecrets = (account) => {
  return decryptJson(account.credentials_ciphertext);
};

export const makeSignature = (secret, rawBody) => {
  return crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
};

export const verifySignature = (
  secret,
  rawBody,
  signature
) => {
  if (!signature || typeof signature !== "string") {
    return false;
  }

  const expected = Buffer.from(
    makeSignature(secret, rawBody),
    "hex"
  );

  let received;

  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
};