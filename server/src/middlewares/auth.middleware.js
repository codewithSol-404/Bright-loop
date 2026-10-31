import {
    createAuthClient,
    supabaseAdmin
} from "../config/supabase.js";

export const authenticateUser = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access token required"
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify token with Supabase
        const authClient = createAuthClient();

        const { data: authData, error: authError } =
            await authClient.auth.getUser(token);

        if (authError || !authData.user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired access token"
            });
        }

        const authUser = authData.user;

        // Retrieve user profile
        const { data: profile, error: profileError } =
            await supabaseAdmin
                .from("profiles")
                .select(`
          id,
          full_name,
          role,
          organization_id,
          status,
          password
        `)
                .eq("id", authUser.id)
                .single();

        if (profileError || !profile) {
            console.log("Authenticated user ID:", authUser.id);
            console.log("Profile lookup error:", profileError);

            return res.status(403).json({
                success: false,
                message: "User profile not found",
                userId: authUser.id,
                databaseError: profileError?.message
            });
        }

        if (profile.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive"
            });
        }

        // Attach authenticated user to request
        req.user = {
            id: authUser.id,
            email: authUser.email,
            fullName: profile.full_name,
            role: profile.role,
            organizationId: profile.organization_id,
            mustChangePassword: profile.password
        };

        next();

    } catch (error) {
        console.error("Authentication middleware error:", error);

        return res.status(500).json({
            success: false,
            message: "Authentication failed"
        });
    }
};