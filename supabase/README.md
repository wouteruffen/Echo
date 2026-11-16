# ECHO data setup

1. Create a Supabase project on the Free plan.
2. In **SQL Editor**, run `migrations/20261116_create_echo_kanban.sql`.
3. In **Authentication**, enable an email sign-in method before using the board with real data.
4. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
5. Run `npm run dev`.

## Security rules

- Keep `.env.local` on your own computer. It is ignored by Git.
- Never use a Supabase `secret` or `service_role` key in this React app.
- The migration enables Row Level Security: an authenticated user can only access their own cards, proposals and activity.
- Future AI calls must run in a Supabase Edge Function or separate backend. That function may create **proposals**, but must not execute external actions without a separate explicit confirmation flow.
