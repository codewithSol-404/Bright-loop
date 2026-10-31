import crypto from "crypto";
import { supabaseAdmin } from "../../config/supabase.js";

const DEFAULT_SCOPES = [
    "catalog:read",
    "checkout:write",
    "checkout:read"
];

const hashApiKey = (key) => {
    return crypto
        .createHash("sha256")
        .update(key)
        .digest("hex");
};

export const listApiKeys = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("api_keys")
        .select(
            "id, name, key_prefix, environment, scopes, status, last_used_at, expires_at, created_at"
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
};

export const createApiKey = async (organizationId, body) => {
    if (!body.name?.trim()) {
        throw new Error("API key name is required");
    }

    const environment = body.environment || "test";

    if (!["test", "live"].includes(environment)) {
        throw new Error("Environment must be test or live");
    }

    const allowedScopes = [
        "catalog:read",
        "checkout:write",
        "checkout:read"
    ];

    const scopes = body.scopes || DEFAULT_SCOPES;

    if (
        !Array.isArray(scopes) ||
        scopes.length === 0 ||
        scopes.some(scope => !allowedScopes.includes(scope))
    ) {
        throw new Error("Invalid API key scopes");
    }

    const prefix = crypto
        .randomBytes(4)
        .toString("hex");

    const secret = crypto
        .randomBytes(32)
        .toString("hex");

    const rawKey = `oodo_${environment}_${prefix}_${secret}`;

    const keyHash = hashApiKey(rawKey);

    const { data, error } = await supabaseAdmin
        .from("api_keys")
        .insert({
            organization_id: organizationId,
            name: body.name.trim(),
            key_prefix: `oodo_${environment}_${prefix}`,
            key_hash: keyHash,
            environment,
            scopes,
            status: "active",
            expires_at: body.expiresAt || null
        })
        .select(
            "id, name, key_prefix, environment, scopes, status, expires_at, created_at"
        )
        .single();

    if (error) throw error;

    return {
        ...data,
        apiKey: rawKey
    };
};

export const revokeApiKey = async (
    organizationId,
    keyId
) => {
    const { data, error } = await supabaseAdmin
        .from("api_keys")
        .update({
            status: "revoked",
            revoked_at: new Date().toISOString()
        })
        .eq("id", keyId)
        .eq("organization_id", organizationId)
        .select("id, name, status")
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error("API key not found");
    }

    return data;
};