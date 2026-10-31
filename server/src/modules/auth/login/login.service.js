import {
  createAuthClient,
  supabaseAdmin
} from "../../../config/supabase.js";

export const loginUserService = async ({ email, password }) => {
  const authClient = createAuthClient();

  const { data: authData, error: authError } =
    await authClient.auth.signInWithPassword({
      email,
      password
    });

  if (authError || !authData.user) {
    const error = new Error("Invalid email or password");
    error.status = 401;
    throw error;
  }

  const user = authData.user;

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
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    const error = new Error("User profile not found");
    error.status = 403;
    throw error;
  }

  if (profile.status !== "active") {
    const error = new Error("Your account is inactive. Contact the administrator.");
    error.status = 403;
    throw error;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: profile.full_name,
      role: profile.role,
      organizationId: profile.organization_id,
      mustChangePassword: profile.password
    },
    session: {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresAt: authData.session.expires_at
    }
  };
};