import crypto from "crypto";
import { supabaseAdmin } from "../config/supabase.js";

const hashApiKey = (key) => {
    return crypto
        .createHash("sha256")
        .update(key)
        .digest("hex");
};

export const authenticateApiKey = (requiredScope) => {
    return async (req, res, next) => {
        try {
            const authorization = req.headers.authorization;

            if (!authorization || !authorization.startsWith("Bearer ")) {
                return res.status(401).json({
                    success: false,
                    message: "API key is required"
                });
            }

            const apiKey = authorization.substring(7).trim();

            if (!apiKey.startsWith("oodo_test_") &&
                !apiKey.startsWith("oodo_live_")) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid API key format"
                });
            }

            const keyHash = hashApiKey(apiKey);

            const { data: keyRecord, error } = await supabaseAdmin
                .from("api_keys")
                .select("*")
                .eq("key_hash", keyHash)
                .eq("status", "active")
                .maybeSingle();

            if (error) throw error;

            if (!keyRecord) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or revoked API key"
                });
            }

            if (
                keyRecord.expires_at &&
                new Date(keyRecord.expires_at).getTime() <= Date.now()
            ) {
                return res.status(401).json({
                    success: false,
                    message: "API key has expired"
                });
            }

            const scopes = keyRecord.scopes || [];

            if (!scopes.includes(requiredScope)) {
                return res.status(403).json({
                    success: false,
                    message: "API key does not have the required permission"
                });
            }

            req.apiClient = {
                organizationId: keyRecord.organization_id,
                keyId: keyRecord.id,
                environment: keyRecord.environment,
                scopes
            };

            // Update last-used timestamp without blocking the request
            supabaseAdmin
                .from("api_keys")
                .update({
                    last_used_at: new Date().toISOString()
                })
                .eq("id", keyRecord.id)
                .then(({ error }) => {
                    if (error) {
                        console.error("API key usage update failed:", error);
                    }
                });

            next();

        } catch (error) {
            console.error("API key authentication error:", error);

            return res.status(500).json({
                success: false,
                message: "API authentication failed"
            });
        }
    };
};