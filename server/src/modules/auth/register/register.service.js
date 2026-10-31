import {
  createAuthClient,
  supabaseAdmin
} from "../../../config/supabase.js";

export const registerAdminService = async ({
  fullName,
  email,
  companyName,
  password
}) => {
  const authClient = createAuthClient();

  const { data: authData, error: authError } =
    await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        },
        emailRedirectTo: `${process.env.FRONTEND_URL}/verify-email`
      }
    });

  if (authError) {
    const error = new Error(authError.message);
    error.status = 400;
    throw error;
  }

  const authUser = authData.user;

  if (!authUser) {
    throw new Error("Unable to create authentication user");
  }

  // Prevent creating another organization for an existing account.
  if (authUser.identities?.length === 0) {
    const error = new Error("An account with this email already exists");
    error.status = 409;
    throw error;
  }

  let organizationId;

  try {
    // Create organization
    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .insert({
          name: companyName
        })
        .select("id")
        .single();

    if (organizationError) {
      throw organizationError;
    }

    organizationId = organization.id;

    // Create admin profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.id,
        organization_id: organizationId,
        full_name: fullName,
        role: "admin"
      });

    if (profileError) {
      throw profileError;
    }

    return {
      userId: authUser.id,
      organizationId,
      fullName,
      email,
      role: "admin",
      emailVerificationRequired: !authData.session
    };

  } catch (error) {
    // Best-effort cleanup if database creation fails.
    if (organizationId) {
      await supabaseAdmin
        .from("organizations")
        .delete()
        .eq("id", organizationId);
    }

    await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    throw error;
  }
};