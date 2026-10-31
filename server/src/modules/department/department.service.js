
import { supabaseAdmin } from "../../config/supabase.js";

// Get all departments belonging to the admin's organization
export const getDepartments = async (organizationId) => {
    const { data, error } = await supabaseAdmin
        .from("departments")
        .select("id, name, created_at")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });

    if (error) throw error;

    return data;
};

// Create department
export const createDepartment = async (organizationId, name) => {
    const { data, error } = await supabaseAdmin
        .from("departments")
        .insert({
            organization_id: organizationId,
            name: name
        })
        .select()
        .single();

    if (error) throw error;

    return data;
};

// Rename department
export const updateDepartment = async (organizationId, departmentId, name) => {
    const { data, error } = await supabaseAdmin
        .from("departments")
        .update({ name })
        .eq("id", departmentId)
        .eq("organization_id", organizationId)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Department not found");

    return data;
};

// Delete department
export const deleteDepartment = async (organizationId, departmentId) => {
    const { data, error } = await supabaseAdmin
        .from("departments")
        .delete()
        .eq("id", departmentId)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Department not found");

    return data;
};
