// ECHO "analyze-card" Edge Function.
// Analyses ONE card of the signed-in user with Gemini and stores the result as a pending proposal.
// It never changes the card itself: applying a suggestion is always a separate, user-initiated action.
//
// Security:
// - The caller only sends { cardId }. Card data is read server-side with the caller's own JWT,
//   so Row Level Security guarantees the card belongs to that user. No service-role key is used.
// - GEMINI_API_KEY is read from the function environment and never returned or logged.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

/** Gemini model used for card analysis (available on the Gemini API free tier). */
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_SUBTASKS = 5
/** Simple abuse guard: maximum analyses per user per minute. */
const MAX_ANALYSES_PER_MINUTE = 5

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Priority = 'low' | 'medium' | 'high'

interface Proposal {
  summary: string
  suggestedPriority: Priority | null
  suggestedDeadline: string | null
  suggestedSubtasks: { title: string }[]
  reasoning: string
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } })

const SYSTEM_PROMPT = `Je bent de ECHO planningsassistent voor een persoonlijk kanbanbord.
Je analyseert precies één taakkaart en doet uitsluitend VOORSTELLEN. Je voert nooit iets uit.

Regels:
- Antwoord altijd in het Nederlands, kort en concreet.
- Verzin geen feiten. Gebruik alleen de informatie uit de kaart.
- Stel alleen een deadline voor als die redelijkerwijs uit de kaart volgt; anders null. Een deadline ligt nooit in het verleden.
- Stel een prioriteit voor ("low", "medium" of "high") of null als er geen reden is om die te wijzigen.
- Maximaal ${MAX_SUBTASKS} subtaken, elk een korte, uitvoerbare actie (begin met een werkwoord).
- Beweer nooit dat iets al is gedaan, verstuurd of ingepland.
- Geef alleen geldige JSON terug, zonder Markdown en zonder extra tekst, exact in dit formaat:
{"summary": string, "suggestedPriority": "low"|"medium"|"high"|null, "suggestedDeadline": "YYYY-MM-DD"|null, "suggestedSubtasks": [{"title": string}], "reasoning": string}`

const responseSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    suggestedPriority: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
    suggestedDeadline: { type: 'STRING', nullable: true },
    suggestedSubtasks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' } }, required: ['title'] } },
    reasoning: { type: 'STRING' },
  },
  required: ['summary', 'suggestedPriority', 'suggestedDeadline', 'suggestedSubtasks', 'reasoning'],
}

const clean = (value: unknown, max: number): string => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Validates and normalises Gemini output. Returns null when it is unusable. */
function validateProposal(raw: unknown, today: string): Proposal | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const summary = clean(data.summary, 400)
  const reasoning = clean(data.reasoning, 600)
  if (!summary || !reasoning) return null

  const priority = data.suggestedPriority
  const suggestedPriority: Priority | null = priority === 'low' || priority === 'medium' || priority === 'high' ? priority : null

  let suggestedDeadline: string | null = null
  if (typeof data.suggestedDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.suggestedDeadline)) {
    const date = new Date(`${data.suggestedDeadline}T12:00:00Z`)
    // Reject impossible dates (e.g. 2026-02-31) and dates in the past.
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === data.suggestedDeadline && data.suggestedDeadline >= today) {
      suggestedDeadline = data.suggestedDeadline
    }
  }

  const seen = new Set<string>()
  const suggestedSubtasks = (Array.isArray(data.suggestedSubtasks) ? data.suggestedSubtasks : [])
    .map((item) => clean(item && typeof item === 'object' ? (item as Record<string, unknown>).title : null, 200))
    .filter((title) => { const key = title.toLowerCase(); if (!title || seen.has(key)) return false; seen.add(key); return true })
    .slice(0, MAX_SUBTASKS)
    .map((title) => ({ title }))

  return { summary, suggestedPriority, suggestedDeadline, suggestedSubtasks, reasoning }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Alleen POST is toegestaan.')

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'unauthenticated', 'Je bent niet ingelogd.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!supabaseUrl || !anonKey) return fail(500, 'server_config', 'De server is niet goed geconfigureerd.')
  if (!geminiKey) return fail(500, 'missing_api_key', 'De AI-sleutel ontbreekt op de server. Neem contact op met de beheerder.')

  // Client that acts as the caller: every query below is subject to RLS.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return fail(401, 'unauthenticated', 'Je sessie is verlopen. Log opnieuw in.')
  const userId = userData.user.id

  let cardId = ''
  try {
    const body: unknown = await request.json()
    if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).cardId === 'string') cardId = (body as Record<string, string>).cardId
  } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) return fail(400, 'invalid_request', 'Ongeldige kaart.')

  // Abuse guard based on the user's own recent proposals.
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await supabase.from('agent_proposals').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('kind', 'card_analysis').gte('created_at', since)
  if ((count ?? 0) >= MAX_ANALYSES_PER_MINUTE) return fail(429, 'rate_limited', 'Je hebt te veel analyses kort na elkaar gestart. Wacht een minuut en probeer het opnieuw.')

  // RLS + explicit user filter: the card must belong to the caller.
  const { data: card, error: cardError } = await supabase.from('kanban_cards')
    .select('id, title, description, priority, due_at, status, list_id')
    .eq('id', cardId).eq('user_id', userId).maybeSingle()
  if (cardError) return fail(500, 'card_lookup_failed', 'De kaart kon niet worden geladen.')
  if (!card) return fail(404, 'card_not_found', 'Deze kaart bestaat niet of is niet van jou.')

  let listTitle: string | null = null
  if (card.list_id) {
    const { data: list } = await supabase.from('kanban_lists').select('title').eq('id', card.list_id).eq('user_id', userId).maybeSingle()
    listTitle = list?.title ?? null
  }

  const today = new Date().toISOString().slice(0, 10)
  // Only task data goes to Gemini: no email, user id, tokens or other cards.
  const cardForModel = {
    titel: card.title,
    omschrijving: card.description ?? '',
    prioriteit: card.priority,
    deadline: card.due_at ? String(card.due_at).slice(0, 10) : null,
    lijst: listTitle,
    status: card.status,
    vandaag: today,
  }

  let geminiResponse: Response
  try {
    geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Analyseer deze kaart:\n${JSON.stringify(cardForModel)}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json', responseSchema },
      }),
    })
  } catch {
    return fail(502, 'ai_unreachable', 'ECHO kon de AI-dienst niet bereiken. Probeer het later opnieuw.')
  }

  if (geminiResponse.status === 429) return fail(429, 'ai_rate_limited', 'De AI-dienst is even overbelast (limiet bereikt). Probeer het over een minuut opnieuw.')
  if (!geminiResponse.ok) {
    console.error('analyze-card: Gemini request failed with status', geminiResponse.status)
    return fail(502, 'ai_error', 'De AI-dienst gaf een fout. Probeer het later opnieuw.')
  }

  let proposal: Proposal | null = null
  try {
    const result = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
    proposal = validateProposal(JSON.parse(stripped), today)
  } catch { proposal = null }
  if (!proposal) return fail(502, 'invalid_ai_response', 'ECHO kreeg een onbruikbaar antwoord. Probeer het opnieuw.')

  // Store as a pending proposal (RLS: insert only for the caller).
  const { data: saved, error: saveError } = await supabase.from('agent_proposals')
    .insert({ user_id: userId, card_id: card.id, kind: 'card_analysis', summary: proposal.summary, payload: proposal, status: 'pending' })
    .select('id').single()
  if (saveError || !saved) return fail(500, 'save_failed', 'Het voorstel kon niet worden opgeslagen.')

  return json(200, { proposalId: saved.id, proposal })
})
