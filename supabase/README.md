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

## Database migrations (run in order in the SQL Editor)

Paste the **contents** of each file into the SQL Editor and click Run:

1. `migrations/20261116_create_echo_kanban.sql`
2. `migrations/20261118_add_kanban_lists.sql`
3. `migrations/20261118_repair_duplicate_default_lists.sql`
4. `migrations/20261118_add_kanban_list_color.sql`
5. `migrations/20261118_create_profiles.sql`
6. `migrations/20261118_add_kanban_subtasks.sql`

## ECHO card analysis (Edge Function `analyze-card`)

"Analyseer met ECHO" in the card modal calls the Edge Function `supabase/functions/analyze-card`.

- The browser only sends `{ cardId }`. The function verifies the user's JWT, reads that card with the
  user's own token (RLS applies, no service-role key) and sends only the card's task data to Gemini.
- The result is stored as a `pending` row in `agent_proposals`. Nothing on the card changes until the
  user clicks an apply button in the modal.
- The Gemini model is set in `GEMINI_MODEL` at the top of `functions/analyze-card/index.ts`.

Setup:

1. Make sure the secret exists (Dashboard → Edge Functions → Secrets): `GEMINI_API_KEY`.
   Never put this key in `.env.local` or any `VITE_` variable.
2. Run migration 6 (`20261118_add_kanban_subtasks.sql`).
3. Deploy from the project root:

```bash
npx supabase login
npx supabase functions deploy analyze-card --project-ref fnkhqshclojwimelogyq
```

JWT verification stays enabled (the default), so only signed-in users can call the function.
Logs: Dashboard → Edge Functions → analyze-card → Logs. The function never logs the API key or card content.
