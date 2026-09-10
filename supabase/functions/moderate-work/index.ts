import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = request.headers.get('Authorization') ?? ''
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return Response.json({ error: 'login required' }, { status: 401, headers: cors })
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!)
    const { data: manager } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!manager) return Response.json({ error: 'admin access required' }, { status: 403, headers: cors })
    const { workId, action, note } = await request.json() as { workId?: string; action?: 'approve' | 'reject' | 'remove'; note?: string }
    if (!workId || !action) return Response.json({ error: 'workId and action are required' }, { status: 400, headers: cors })
    const { data: work, error: workError } = await admin.from('works').select('*').eq('id', workId).single()
    if (workError || !work) throw workError ?? new Error('work not found')
    if (action === 'approve') {
      const html = await admin.storage.from('pending-html').download(work.html_path)
      if (html.error) throw html.error
      const publishedPath = `${work.id}/index.html`
      const upload = await admin.storage.from('published-html').upload(publishedPath, html.data, { contentType: 'text/html', upsert: true })
      if (upload.error) throw upload.error
      const update = await admin.from('works').update({ status: 'published', html_path: publishedPath, published_at: new Date().toISOString(), moderated_at: new Date().toISOString(), moderation_note: note ?? null }).eq('id', workId)
      if (update.error) throw update.error
    } else {
      const update = await admin.from('works').update({ status: action === 'remove' ? 'removed' : 'rejected', moderated_at: new Date().toISOString(), moderation_note: note ?? null }).eq('id', workId)
      if (update.error) throw update.error
    }
    return Response.json({ ok: true }, { headers: cors })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'moderation failed' }, { status: 500, headers: cors }) }
})
