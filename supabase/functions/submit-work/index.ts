import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = request.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'anonymous session required' }, { status: 401, headers: cors })
    const form = await request.formData()
    const htmlFile = form.get('file')
    const pasted = String(form.get('html') ?? '').trim()
    const html = htmlFile instanceof File ? await htmlFile.text() : pasted
    if (!html || new TextEncoder().encode(html).byteLength > 5 * 1024 * 1024) return Response.json({ error: 'HTML is required and must be <= 5MB' }, { status: 400, headers: cors })
    const title = String(form.get('title') ?? '').trim()
    const author = String(form.get('author_username') ?? '').trim()
    const source = String(form.get('source_url') ?? '').trim()
    try { new URL(source) } catch { return Response.json({ error: 'source_url must be a valid URL' }, { status: 400, headers: cors }) }
    if (!title || !author) return Response.json({ error: 'title and author_username are required' }, { status: 400, headers: cors })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!)
    const path = `${user.id}/${crypto.randomUUID()}.html`
    const upload = await admin.storage.from('pending-html').upload(path, new Blob([html], { type: 'text/html' }), { contentType: 'text/html', upsert: false })
    if (upload.error) throw upload.error
    const insert = await admin.from('works').insert({ slug: crypto.randomUUID(), title, author_username: author, source_url: source, description: String(form.get('description') ?? '').trim(), html_path: path, submitted_by: user.id }).select('id').single()
    if (insert.error) { await admin.storage.from('pending-html').remove([path]); throw insert.error }
    return Response.json({ id: insert.data.id, status: 'pending' }, { headers: cors })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'submission failed' }, { status: 500, headers: cors }) }
})
