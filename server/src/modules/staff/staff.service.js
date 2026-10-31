
import { supabaseAdmin } from "../../config/supabase.js";

const staffFields =
    "id, full_name, email, phone_number, department_id, employment_type, status, created_at, department:departments(id,name)";

const employmentTypes = [
    "full_time",
    "part_time",
    "contract",
    "intern"
];

// Validate that the department belongs to this organization
const validateDepartment = async (organizationId, departmentId) => {
    if (!departmentId) return;

    const { data, error } = await supabaseAdmin
        .from("departments")
        .select("id")
        .eq("id", departmentId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Invalid department");
};

// Create staff using Supabase invitation
export const createStaff = async (organizationId, staff) => {
    await validateDepartment(organizationId, staff.departmentId);

    const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(
            staff.email,
            {
                data: {
                    full_name: staff.fullName
                },
                redirectTo: `${process.env.FRONTEND_URL}/staff/set-password`
            }
        );

    if (inviteError) throw inviteError;

    const authUser = inviteData.user;

    if (!authUser) {
        throw new Error("Could not create staff invitation");
    }

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .insert({
            id: authUser.id,
            organization_id: organizationId,
            full_name: staff.fullName,
            email: staff.email,
            phone_number: staff.phoneNumber,
            department_id: staff.departmentId || null,
            employment_type: staff.employmentType,
            role: "staff",
            status: "active",
            must_change_password: false
        })
        .select(staffFields)
        .single();

    if (error) {
        // Clean up the invited Auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        throw error;
    }

    return data;
};

// List staff
export const getStaff = async (organizationId, filters) => {
    let query = supabaseAdmin
        .from("profiles")
        .select(staffFields, { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("role", "staff");

    if (filters.departmentId) {
        query = query.eq("department_id", filters.departmentId);
    }

    if (filters.employmentType) {
        query = query.eq("employment_type", filters.employmentType);
    }

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    if (filters.search) {
        const search = filters.search.replace(/[,%()]/g, " ").trim();

        if (search) {
            query = query.or(
                `full_name.ilike.%${search}%,email.ilike.%${search}%`
            );
        }
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const from = (page - 1) * limit;

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

    if (error) throw error;

    return {
        staff: data,
        total: count,
        page,
        limit
    };
};

// Update staff details
export const updateStaff = async (organizationId, staffId, updates) => {
    if (updates.department_id !== undefined) {
        await validateDepartment(organizationId, updates.department_id);
    }

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", staffId)
        .eq("organization_id", organizationId)
        .eq("role", "staff")
        .select(staffFields)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Staff member not found");

    return data;
};

// Activate or deactivate staff
export const updateStaffStatus = async (
    organizationId,
    staffId,
    status
) => {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({ status })
        .eq("id", staffId)
        .eq("organization_id", organizationId)
        .eq("role", "staff")
        .select("id, full_name, email, status")
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Staff member not found");

    return data;
};

export { employmentTypes };
