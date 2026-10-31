import { supabase } from "./supabase";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/$/, "");

export async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message || body.error || `Request failed (${res.status})`);
  }

  return body;
}

export const unwrap = x => x?.data ?? x?.results ?? x?.items ?? x;