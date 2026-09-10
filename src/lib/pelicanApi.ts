import { supabase } from './supabase'

export type RemoteWork = {
  id: string
  title: string
  author: string
  source: string
  description: string
  tags: string[]
  html: string
  stats: [number, number, number, number]
  submittedAt: string
  status: 'published' | 'pending'
}

export type SiteSettings = {
  threshold: number
  minVotes: number
  autoAdvanceMs: number
}

type VoteStats = {
  total_votes: number
  rating_1: number
  rating_2: number
  rating_3: number
  rating_4: number
  break_rate: number
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function ensureAnonymousSession() {
  const client = requireClient()
  const current = await client.auth.getSession()
  if (current.data.session) return current.data.session
  const result = await client.auth.signInAnonymously()
  if (result.error || !result.data.session) throw result.error ?? new Error('anonymous sign-in failed')
  return result.data.session
}

export async function checkAdmin() {
  const client = requireClient()
  const result = await client.rpc('is_admin')
  if (result.error) throw result.error
  return result.data === true
}

export async function signIn(email: string, password: string) {
  const client = requireClient()
  const result = await client.auth.signInWithPassword({ email, password })
  if (result.error || !result.data.session) throw result.error ?? new Error('登录失败')
  return { session: result.data.session, admin: await checkAdmin() }
}

export async function signOut() {
  const client = requireClient()
  const result = await client.auth.signOut()
  if (result.error) throw result.error
}

export async function loadPublishedWorks(): Promise<RemoteWork[]> {
  const client = requireClient()
  const result = await client
    .from('works')
    .select('id,title,author_username,source_url,description,tags,html_path,submitted_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (result.error) throw result.error
  if (!result.data?.length) return []

  const statsResult = await client.from('work_vote_stats').select('work_id,total_votes,rating_1,rating_2,rating_3,rating_4,break_rate').in('work_id', result.data.map((row) => row.id))
  if (statsResult.error) throw statsResult.error
  const statsById = new Map((statsResult.data ?? []).map((row) => [row.work_id as string, row as VoteStats]))

  return Promise.all(result.data.map(async (row) => {
    const fileResult = await client.storage.from('published-html').download(row.html_path)
    if (fileResult.error) throw fileResult.error
    const stats = statsById.get(row.id) ?? { total_votes: 0, rating_1: 0, rating_2: 0, rating_3: 0, rating_4: 0, break_rate: 0 }
    return {
      id: row.id,
      title: row.title,
      author: row.author_username,
      source: row.source_url,
      description: row.description ?? '',
      tags: row.tags?.length ? row.tags : ['社区投稿'],
      html: await fileResult.data.text(),
      stats: [stats.rating_1, stats.rating_2, stats.rating_3, stats.rating_4],
      submittedAt: row.submitted_at,
      status: 'published',
    }
  }))
}

export async function loadAdminWorks(): Promise<RemoteWork[]> {
  const client = requireClient()
  if (!(await checkAdmin())) throw new Error('admin access required')
  const result = await client
    .from('works')
    .select('id,title,author_username,source_url,description,tags,html_path,submitted_at,status')
    .in('status', ['pending', 'published'])
    .order('submitted_at', { ascending: false })
  if (result.error) throw result.error
  if (!result.data?.length) return []
  const statsResult = await client.from('work_vote_stats').select('work_id,rating_1,rating_2,rating_3,rating_4').in('work_id', result.data.map((row) => row.id))
  if (statsResult.error) throw statsResult.error
  const statsById = new Map((statsResult.data ?? []).map((row) => [row.work_id as string, row as Partial<VoteStats>]))
  return Promise.all(result.data.map(async (row) => {
    const bucket = row.status === 'published' ? 'published-html' : 'pending-html'
    const fileResult = await client.storage.from(bucket).download(row.html_path)
    if (fileResult.error) throw fileResult.error
    const stats = statsById.get(row.id) ?? {}
    return {
      id: row.id,
      title: row.title,
      author: row.author_username,
      source: row.source_url,
      description: row.description ?? '',
      tags: row.tags?.length ? row.tags : ['社区投稿'],
      html: await fileResult.data.text(),
      stats: [stats.rating_1 ?? 0, stats.rating_2 ?? 0, stats.rating_3 ?? 0, stats.rating_4 ?? 0] as [number, number, number, number],
      submittedAt: row.submitted_at,
      status: row.status === 'pending' ? 'pending' : 'published',
    }
  }))
}

export async function castVote(workId: string, rating: 1 | 2 | 3 | 4) {
  const client = requireClient()
  await ensureAnonymousSession()
  const result = await client.rpc('cast_vote', { p_work_id: workId, p_rating: rating })
  if (result.error) throw result.error
  const stats = (Array.isArray(result.data) ? result.data[0] : result.data) as VoteStats | undefined
  if (!stats) throw new Error('vote stats are unavailable')
  return [stats.rating_1, stats.rating_2, stats.rating_3, stats.rating_4] as [number, number, number, number]
}

export async function submitWork(form: FormData) {
  const client = requireClient()
  await ensureAnonymousSession()
  const payload = new FormData()
  payload.set('title', String(form.get('title') ?? ''))
  payload.set('author_username', String(form.get('author') ?? ''))
  payload.set('source_url', String(form.get('source') ?? ''))
  payload.set('description', String(form.get('description') ?? ''))
  const file = form.get('html-file')
  if (file instanceof File && file.size > 0) payload.set('file', file)
  const html = String(form.get('html') ?? '').trim()
  if (html) payload.set('html', html)
  const result = await client.functions.invoke('submit-work', { body: payload })
  if (result.error) throw result.error
  return result.data
}

export async function moderateWork(workId: string, action: 'approve' | 'reject' | 'remove', note?: string) {
  const client = requireClient()
  const result = await client.functions.invoke('moderate-work', { body: { workId, action, note } })
  if (result.error) throw result.error
  return result.data
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  const client = requireClient()
  const result = await client.from('site_settings').select('key,value')
  if (result.error) throw result.error
  const values = new Map((result.data ?? []).map((row) => [row.key as string, row.value as number]))
  return {
    threshold: Number(values.get('premium_break_rate_threshold') ?? 0.5),
    minVotes: Number(values.get('premium_min_votes') ?? 10),
    autoAdvanceMs: Number(values.get('auto_advance_ms') ?? 1000),
  }
}

export async function saveSiteSettings(settings: SiteSettings) {
  const client = requireClient()
  const rows = [
    { key: 'premium_break_rate_threshold', value: settings.threshold },
    { key: 'premium_min_votes', value: settings.minVotes },
    { key: 'auto_advance_ms', value: settings.autoAdvanceMs },
  ]
  const result = await client.from('site_settings').upsert(rows, { onConflict: 'key' })
  if (result.error) throw result.error
}

export async function createTakedownRequest(workId: string, requesterContact: string, reason: string) {
  const client = requireClient()
  const result = await client.from('takedown_requests').insert({ work_id: workId, requester_contact: requesterContact, reason })
  if (result.error) throw result.error
}
