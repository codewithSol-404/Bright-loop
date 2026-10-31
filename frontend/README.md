# OOdo Admin + Staff frontend

React + Vite + Tailwind CSS + Supabase Auth. One login page routes users to the Admin or Staff workspace using the role stored in Supabase.

## Run locally
```powershell
npm install
Copy-Item .env.example .env
# Edit .env with Supabase project URL and anon key
npm run dev
```
Open http://localhost:5173

## Supabase requirements
1. In Supabase Dashboard → Authentication → URL Configuration, set Site URL to your deployed frontend URL and add it to Redirect URLs.
2. Enable Email provider. Keep email confirmation enabled for verification.
3. Create/use a profile table. Default expected table is `profiles` with `id` (same UUID as `auth.users.id`) and `role` (`admin` or `staff`). Add optional `full_name`.
4. Set the environment variables if your table/column names differ:
   - `VITE_PROFILE_TABLE`
   - `VITE_PROFILE_ID_COLUMN`
   - `VITE_PROFILE_ROLE_COLUMN`
5. Create profile rows securely from a Supabase trigger or trusted backend. Never let users set their own role. Do not expose the service-role key in Vite.
6. Password reset sends a Supabase email link. Configure the redirect URL and add a password-update screen if your project uses a dedicated recovery route.

Example profile table (adapt to existing schema; do not create a duplicate if you already have one):
```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin','staff')),
  full_name text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "users can read own profile" on public.profiles
for select to authenticated using (auth.uid() = id);
```
Admin role assignment must be performed by a trusted admin/service backend, not by a client-side form.

## API connection
Set `VITE_API_URL` to your backend origin. The app sends the Supabase access token as `Authorization: Bearer <token>` and expects your Express API to verify it (or adapt auth middleware to your existing JWT strategy).

Routes currently configured in `src/App.jsx`:
- `GET /api/analytics/dashboard`
- `GET /api/customers`
- `GET /api/subscriptions`
- `GET /api/invoices`
- `GET /api/payments`
- `GET /api/refunds`
- `GET /api/developer/api-keys` and `POST /api/developer/api-keys`
- `GET /api/staff-requests` and `POST /api/staff-requests`

Adjust route paths to your actual Express routes if they differ. Dashboard includes demo chart values until the API returns `revenueTrend`. The chart label explicitly identifies sample values.

## Important authorization
- This UI hides Developer from staff and renders all record pages read-only.
- Hiding UI is not security. Enforce roles in Express middleware and Supabase RLS. Staff must not be able to create/edit/delete customer, subscription, invoice, payment, refund, API-key or configuration records.
- Staff requests must be created with the authenticated staff user and organization derived server-side. Staff must not be able to approve their own requests.
- Keep Supabase service-role keys and payment secrets on the server only.
- Before production, run `npm run build`, test every route against your backend, and verify admin/staff access with separate accounts.
