import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3,
  ExternalLink, FileCode2, Filter, KeyRound, Link2, LockKeyhole, Menu, PanelTop,
  Search, Send, Settings2, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, TriangleAlert, UploadCloud, X,
} from 'lucide-react'
import './App.css'
import { castVote, checkAdmin, createTakedownRequest, ensureAnonymousSession, loadAdminWorks, loadPublishedWorks, loadSiteSettings, moderateWork, saveSiteSettings, signIn, signOut, submitWork as submitRemote } from './lib/pelicanApi'
import { isSupabaseConfigured } from './lib/supabase'
import { loadInitialWorks } from './lib/initialWorks'

type Rating = 1 | 2 | 3 | 4
type View = 'play' | 'explore' | 'submit' | 'admin'
type Mode = 'normal' | 'premium'
type Work = {
  id: string; title: string; author: string; source: string; description: string;
  tags: string[]; html: string; stats: [number, number, number, number];
  submittedAt: string; status: 'published' | 'pending'
}
type AuthState = 'offline' | 'loading' | 'anonymous' | 'member' | 'admin' | 'error'

const ratingLabels: Record<Rating, string> = { 1: '轻松绷住', 2: '差点绷不住', 3: '绷不住了', 4: '彻底破绷' }
const ratingShortLabels: Record<Rating, string> = { 1: '稳住', 2: '差点', 3: '不住', 4: '破绷' }

const demoWorks: Work[] = [
  {
    id: 'pelican-001', title: '当你试图给 AI 解释什么是“随便”', author: 'L站散步者',
    source: 'https://linux.do/t/topic/182001', description: '一句“随便”引发的界面理解危机。请在右侧的互动卡片里做出你的判断。',
    tags: ['AI', '日常', '交互实验'], submittedAt: '2026-09-08', status: 'published', stats: [14, 11, 31, 86],
    html: `<!doctype html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f1e9;color:#151a21;font-family:Arial,sans-serif;padding:28px}main{width:min(640px,100%);background:#fff;border:3px solid #151a21;border-radius:22px;padding:28px;box-shadow:8px 8px 0 #f5b544}h1{font-size:clamp(28px,5vw,54px);line-height:.94;margin:0 0 18px;letter-spacing:-2px}p{font-size:18px;line-height:1.5;color:#5f6874}button{border:2px solid #151a21;background:#e6eef1;border-radius:999px;padding:12px 18px;font-weight:700;cursor:pointer}button:hover{background:#b9e6dd}#answer{min-height:32px;margin-top:18px;font-weight:800;color:#d24a4a}</style></head><body><main><p style="font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d24a4d">一个非常严肃的测试</p><h1>“随便”到底是哪一种随便？</h1><p>请想象你问朋友晚饭吃什么，对方回复：随便。</p><button id="reveal">点击揭晓随便的真相</button><div id="answer"></div></main><script>document.querySelector('#reveal').onclick=()=>document.querySelector('#answer').textContent=['“都可以”但不能太贵。','你选什么我都说好。','其实已经想吃火锅了。'][Math.floor(Math.random()*3)]</script></body></html>`,
  },
  {
    id: 'pelican-002', title: '程序员的浪漫：把 TODO 写进 TODO', author: '一只会回滚的企鹅',
    source: 'https://linux.do/t/topic/178042', description: '递归式待办事项，越看越像一种稳定的生活方式。', tags: ['代码', '自嘲', '递归'], submittedAt: '2026-09-06', status: 'published', stats: [8, 18, 44, 51],
    html: `<!doctype html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#111827;color:#e5e7eb;font-family:ui-monospace,monospace;min-height:100vh;display:grid;place-items:center;padding:20px}section{width:min(680px,100%);border:1px solid #334155;background:#172033;padding:28px;border-radius:16px}h1{font:700 clamp(26px,5vw,48px)/1.05 system-ui;color:#facc15;margin:0 0 24px}li{padding:12px 0;border-bottom:1px dashed #475569;list-style:'▸  '}li:last-child{border:0}.blink{display:inline-block;width:10px;height:20px;background:#22c55e;vertical-align:-3px;animation:b 1s steps(2) infinite}@keyframes b{50%{opacity:0}}</style></head><body><section><div style="color:#60a5fa">~/life/projects</div><h1>TODO</h1><ul><li>写一个 TODO 列表</li><li>把“写一个 TODO 列表”加入 TODO</li><li>给 TODO 加一个截止日期</li><li>推迟截止日期 <span class="blink"></span></li></ul></section></body></html>`,
  },
  {
    id: 'pelican-003', title: '周一早上的浏览器标签页考古', author: '匿名观测员', source: 'https://linux.do/t/topic/176510', description: '你以为你在整理标签页，其实你在给过去的自己写讣告。', tags: ['浏览器', '周一', '考古'], submittedAt: '2026-09-04', status: 'published', stats: [4, 9, 24, 74],
    html: `<!doctype html><html><head><meta charset="UTF-8"><style>body{margin:0;min-height:100vh;background:linear-gradient(135deg,#ffe9c7,#ff9d8a);display:grid;place-items:center;font-family:system-ui;color:#2c1e1b;padding:24px}.card{background:#fffaf3;border:3px solid #2c1e1b;border-radius:28px;padding:30px;width:min(620px,100%);transform:rotate(-1deg);box-shadow:10px 10px 0 #2c1e1b}.eyebrow{font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#e0544d}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}.tab{padding:8px 12px;border:2px solid #2c1e1b;border-radius:8px;background:#ffd08a;font-weight:700}.tab:nth-child(2){background:#b7e3d2}.tab:nth-child(3){background:#bcd7ff}h1{font-size:clamp(30px,6vw,60px);line-height:.95;letter-spacing:-3px;margin:0}</style></head><body><article class="card"><div class="eyebrow">tab archaeology / 08:47</div><div class="tabs"><span class="tab">23 个未读</span><span class="tab">1 个重要</span><span class="tab">47 个以后再看</span></div><h1>“这个标签页<br>以后一定有用。”</h1></article></body></html>`,
  },
  {
    id: 'pelican-004', title: '当你决定只装一个生产力 App', author: '不想加班的猫', source: 'https://linux.do/t/topic/175103', description: '生产力工具的尽头，是另一个更好看的生产力工具。', tags: ['工具', '选择困难', '套娃'], submittedAt: '2026-09-02', status: 'published', stats: [12, 16, 29, 63],
    html: `<!doctype html><html><head><meta charset="UTF-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#e9f5ef;color:#13251d;font-family:system-ui;padding:20px}.box{max-width:580px;background:#fff;border-radius:18px;padding:32px;border:1px solid #b1d5c2;box-shadow:0 20px 60px #abd6bd80}h1{font-size:clamp(30px,6vw,58px);letter-spacing:-3px;line-height:.98;margin:10px 0 16px}.meter{height:18px;border-radius:20px;background:#d8e9df;overflow:hidden}.meter i{display:block;width:83%;height:100%;background:#1f9d67;border-radius:20px}.small{color:#557265;font-size:14px}</style></head><body><article class="box"><div class="small">APP SELECTION PROGRESS</div><h1>找到最适合你的<br>唯一工具</h1><div class="meter"><i></i></div><p class="small">正在比较 18 个“唯一工具”……</p></article></body></html>`,
  },
]

const demoPending: Work = {
  ...demoWorks[0],
  id: 'pending-001',
  title: '把“稍后处理”变成一种艺术',
  author: '等待审核的用户',
  status: 'pending',
  submittedAt: '刚刚',
}

function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5) }
function readSavedVotes(): Record<string, Rating> {
  if (typeof window === 'undefined') return {}
  const saved = window.localStorage.getItem('pelican-demo-votes')
  if (!saved) return {}
  try { return JSON.parse(saved) as Record<string, Rating> } catch { return {} }
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}
function withPreviewBridge(html: string, work?: Pick<Work, 'author' | 'source'>) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'">`
  const bridge = `<script>(function(){window.addEventListener('keydown',function(e){if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;var t=e.target;if(t&&(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable))return;parent.postMessage({type:'pelican-nav',direction:e.key==='ArrowLeft'?'previous':'next'},'*')})})()</script>`
  const author = work?.author?.trim()
  const source = work?.source?.trim()
  const attribution = author || source ? `<style id="pelican-source-style">#pelican-source{position:fixed!important;top:10px!important;left:10px!important;z-index:2147483647!important;display:inline-flex!important;align-items:center!important;gap:8px!important;padding:6px 10px!important;border:1px solid rgba(15,23,42,.14)!important;border-radius:999px!important;background:rgba(255,255,255,.92)!important;color:#334155!important;font:600 12px/1.2 system-ui,sans-serif!important;box-shadow:0 4px 14px rgba(15,23,42,.12)!important;pointer-events:none!important;backdrop-filter:blur(8px)!important}</style><div id="pelican-source" aria-label="作品来源">来源${author ? `：@${escapeHtml(author)}` : ''}${source ? ' · LINUX DO' : ''}</div>` : ''
  const injectedBody = `${attribution}${bridge}`
  if (html.includes('<head')) {
    const withCsp = html.replace(/<head[^>]*>/i, (match) => `${match}${csp}`)
    if (/<body[^>]*>/i.test(withCsp)) return withCsp.replace(/<body([^>]*)>/i, (match) => `${match}${injectedBody}`)
    return withCsp.replace(/<\/html>/i, `${injectedBody}</html>`)
  }
  return `<!doctype html><html><head>${csp}</head><body>${injectedBody}${html}</body></html>`
}

function BrandMark() { return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 46 38"><path d="M8 27c0-10 7-18 17-18 6 0 11 3 14 8-5-1-9 0-12 3-3 3-5 7-4 11H8v-4Z" fill="currentColor"/><path d="M23 20c7-2 15 0 21 4-7 5-14 6-22 2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><circle cx="27" cy="14" r="2.2" fill="var(--bg)"/></svg></span> }
function ModeSwitcher({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) { return <div className="mode-switcher" role="group" aria-label="作品模式"><button className={mode === 'normal' ? 'is-selected' : ''} onClick={() => onModeChange('normal')}><span>普通模式</span></button><button className={mode === 'premium' ? 'is-selected is-premium' : ''} onClick={() => onModeChange('premium')}><Sparkles size={14} /><span>仙品模式</span></button></div> }
function RatingButton({ rating, active, onClick }: { rating: Rating; active: boolean; onClick: () => void }) { const Icon = rating === 1 ? ThumbsUp : rating === 2 ? ThumbsDown : rating === 3 ? Sparkles : CircleHelp; return <button className={`rating-button rating-${rating} ${active ? 'is-active' : ''}`} onClick={onClick} aria-pressed={active}><Icon className="rating-icon" size={28} strokeWidth={2.8} aria-hidden="true" /><span className="rating-label"><span className="rating-long">{ratingLabels[rating]}</span><span className="rating-short">{ratingShortLabels[rating]}</span></span>{active && <Check className="rating-check" size={20} strokeWidth={3} aria-hidden="true" />}</button> }
function StatBars({ stats, compact = false }: { stats: [number, number, number, number]; compact?: boolean }) { const total = stats.reduce((sum, value) => sum + value, 0); return <div className={`stat-bars ${compact ? 'is-compact' : ''}`} aria-label={`共 ${total} 票`}>{stats.map((value, index) => { const rating = (index + 1) as Rating; const percentage = total ? Math.round((value / total) * 100) : 0; return <div className="stat-row" key={rating}><span className={`stat-dot dot-${rating}`} /><span className="stat-name">{compact ? ratingShortLabels[rating] : ratingLabels[rating]}</span><span className="stat-track"><span className={`stat-fill fill-${rating}`} style={{ width: `${percentage}%` }} /></span><span className="stat-percent">{percentage}%</span></div> })}</div> }

function App() {
  const [view, setView] = useState<View>('play'); const [mode, setMode] = useState<Mode>('normal'); const [threshold, setThreshold] = useState(.5); const [minVotes, setMinVotes] = useState(10)
  const [works, setWorks] = useState<Work[]>([...demoWorks, demoPending]); const [order, setOrder] = useState(() => shuffle(demoWorks.map((work) => work.id))); const [currentIndex, setCurrentIndex] = useState(0); const [selected, setSelected] = useState<Record<string, Rating>>(readSavedVotes); const [showResult, setShowResult] = useState(false); const [notice, setNotice] = useState(''); const [mobileNavOpen, setMobileNavOpen] = useState(false); const [initialReady, setInitialReady] = useState(isSupabaseConfigured); const [backendStatus, setBackendStatus] = useState<'demo' | 'loading' | 'live' | 'error'>(isSupabaseConfigured ? 'loading' : 'demo'); const [authState, setAuthState] = useState<AuthState>(isSupabaseConfigured ? 'loading' : 'offline'); const [authOpen, setAuthOpen] = useState(false); const [authNotice, setAuthNotice] = useState(''); const [takedownWork, setTakedownWork] = useState<Work>(); const [autoAdvanceMs, setAutoAdvanceMs] = useState(1000); const timerRef = useRef<number | undefined>(undefined)
  const publishedWorks = useMemo(() => works.filter((work) => work.status === 'published'), [works]); const premiumWorks = useMemo(() => publishedWorks.filter((work) => { const total = work.stats.reduce((sum, value) => sum + value, 0); return total >= minVotes && total > 0 && work.stats[3] / total >= threshold }), [publishedWorks, minVotes, threshold]); const activeWorks = mode === 'premium' ? premiumWorks : publishedWorks; const activeIds = useMemo(() => activeWorks.map((work) => work.id), [activeWorks]); const playableOrder = useMemo(() => { const kept = order.filter((id) => activeIds.includes(id)); return [...kept, ...activeIds.filter((id) => !kept.includes(id))] }, [activeIds, order]); const safeIndex = Math.min(currentIndex, Math.max(0, playableOrder.length - 1)); const currentId = playableOrder[safeIndex]; const currentWork = activeWorks.find((work) => work.id === currentId) ?? activeWorks[0]; const currentVote = currentWork ? selected[currentWork.id] : undefined
  useEffect(() => { const handleMessage = (event: MessageEvent) => { if (event.data?.type === 'pelican-nav') move(event.data.direction === 'previous' ? -1 : 1) }; const handleKey = (event: KeyboardEvent) => { if (view !== 'play' || (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return; if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) } if (event.key === 'ArrowRight') { event.preventDefault(); move(1) } }; window.addEventListener('message', handleMessage); window.addEventListener('keydown', handleKey); return () => { window.removeEventListener('message', handleMessage); window.removeEventListener('keydown', handleKey) } })
  useEffect(() => {
    if (isSupabaseConfigured) return
    let cancelled = false
    void loadInitialWorks().then((initialWorks) => {
      if (cancelled) return
      const loaded: Work[] = initialWorks.map((item) => ({
        id: item.id,
        title: item.title,
        author: '',
        source: '',
        description: '',
        tags: [],
        html: item.html,
        stats: [0, 0, 0, 0],
        submittedAt: new Date().toISOString().slice(0, 10),
        status: 'published',
      }))
      setWorks([...loaded, demoPending])
      setOrder(shuffle(loaded.map((work) => work.id)))
      setCurrentIndex(0)
      setBackendStatus('demo')
      setInitialReady(true)
    }).catch((error) => { console.warn('初始 HTML 加载失败，保留演示数据。', error); setInitialReady(true) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    void (async () => {
      try {
        await ensureAnonymousSession()
        const [remoteWorks, settings, admin] = await Promise.all([loadPublishedWorks(), loadSiteSettings(), checkAdmin()])
        if (cancelled) return
        setWorks(remoteWorks)
        setOrder(shuffle(remoteWorks.map((work) => work.id)))
        setCurrentIndex(0)
        setThreshold(settings.threshold)
        setMinVotes(settings.minVotes)
        setAutoAdvanceMs(settings.autoAdvanceMs)
        setAuthState(admin ? 'admin' : 'anonymous')
        setBackendStatus('live')
      } catch (error) {
        if (cancelled) return
        console.warn('Supabase unavailable, keeping demo data.', error)
        setAuthState('error')
        setBackendStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [])
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  function resetMode(nextMode: Mode) { window.clearTimeout(timerRef.current); setMode(nextMode); setShowResult(false); const source = nextMode === 'premium' ? premiumWorks : publishedWorks; setOrder(shuffle(source.map((work) => work.id))); setCurrentIndex(0); setNotice('') }
  function move(direction: -1 | 1) { if (!activeWorks.length) return; window.clearTimeout(timerRef.current); setShowResult(false); setCurrentIndex((index) => { const next = index + direction; if (next < 0) return 0; if (next >= playableOrder.length) { setOrder(shuffle(activeWorks.map((work) => work.id))); return 0 } return next }) }
  function handleVote(rating: Rating) { if (!currentWork) return; const previous = selected[currentWork.id]; setSelected((state) => { const next = { ...state, [currentWork.id]: rating }; window.localStorage.setItem('pelican-demo-votes', JSON.stringify(next)); return next }); setWorks((items) => items.map((work) => { if (work.id !== currentWork.id) return work; const nextStats = [...work.stats] as [number, number, number, number]; if (previous && previous !== rating) nextStats[previous - 1] = Math.max(0, nextStats[previous - 1] - 1); if (!previous || previous !== rating) nextStats[rating - 1] += 1; return { ...work, stats: nextStats } })); if (backendStatus === 'live') void castVote(currentWork.id, rating).then((stats) => setWorks((items) => items.map((work) => work.id === currentWork.id ? { ...work, stats } : work))).catch(() => setNotice('投票同步失败')); setShowResult(true); window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => move(1), autoAdvanceMs) }
  function navigate(nextView: View) { window.clearTimeout(timerRef.current); setView(nextView); setShowResult(false); setNotice(''); setMobileNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function submitMock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('html-file')
    const pastedHtml = String(data.get('html') ?? '').trim()
    const hasFile = file instanceof File && file.size > 0
    if (!hasFile && !pastedHtml) {
      setNotice('请上传 HTML 文件，或直接粘贴源码（二选一）。')
      return
    }
    const title = String(data.get('title') ?? '').trim()
    const author = String(data.get('author') ?? '').trim()
    const source = String(data.get('source') ?? '').trim()
    const description = String(data.get('description') ?? '').trim() || '来自社区的新投稿，等待管理员审核。'
    if (backendStatus === 'live') {
      void submitRemote(data).then(() => { setNotice('已收到，作品会先进入审核队列。通过后就会出现在广场和评分流里。'); form.reset() }).catch(() => setNotice('投稿暂未成功，请稍后重试。'))
      return
    }
    const pending: Work = {
      id: `pending-${Date.now()}`,
      title,
      author,
      source,
      description,
      tags: ['新投稿'],
      html: pastedHtml || '<!doctype html><html><body><main><h1>待审核 HTML</h1><p>演示模式下，上传文件将在后端保存后预览。</p></main></body></html>',
      stats: [0, 0, 0, 0],
      submittedAt: '刚刚',
      status: 'pending',
    }
    setWorks((items) => [pending, ...items])
    setNotice('已收到，作品会先进入审核队列。通过后就会出现在广场和评分流里。')
    form.reset()
  }
  async function refreshAdminWorks() { const adminWorks = await loadAdminWorks(); setWorks(adminWorks); setOrder(shuffle(adminWorks.filter((work) => work.status === 'published').map((work) => work.id))); setCurrentIndex(0) }
  function approveMock(id: string) { if (backendStatus === 'live' && authState === 'admin') { void moderateWork(id, 'approve').then(() => refreshAdminWorks()).then(() => setNotice('已发布')).catch(() => setNotice('审核失败')); return }; setWorks((items) => items.map((work) => work.id === id ? { ...work, status: 'published' } : work)); setNotice('已发布') }
  function rejectMock(id: string) { if (backendStatus === 'live' && authState === 'admin') { void moderateWork(id, 'reject').then(() => refreshAdminWorks()).then(() => setNotice('已退回')).catch(() => setNotice('审核失败')); return }; setWorks((items) => items.filter((work) => work.id !== id)); setNotice('已退回') }
  function changeThreshold(value: number) { setThreshold(value); if (backendStatus === 'live' && authState === 'admin') void saveSiteSettings({ threshold: value, minVotes, autoAdvanceMs }).catch(() => setNotice('规则保存失败')) }
  function changeMinVotes(value: number) { setMinVotes(value); if (backendStatus === 'live' && authState === 'admin') void saveSiteSettings({ threshold, minVotes: value, autoAdvanceMs }).catch(() => setNotice('规则保存失败')) }
  async function handleLogin(email: string, password: string) { setAuthNotice(''); try { const result = await signIn(email, password); setAuthState(result.admin ? 'admin' : 'member'); setAuthOpen(false); if (result.admin) await refreshAdminWorks(); setNotice('') } catch { setAuthNotice('邮箱或密码错误') } }
  async function handleLogout() { try { await signOut(); setAuthState('anonymous'); setAuthNotice('') } catch { setNotice('退出失败') } }
  async function handleTakedown(contact: string, reason: string) { if (!takedownWork) return; try { if (backendStatus === 'live') await createTakedownRequest(takedownWork.id, contact, reason); setNotice('已提交下架申请'); setTakedownWork(undefined) } catch { setNotice('提交失败') } }
  function openWork(id: string) {
    setMode('normal')
    setOrder([id, ...shuffle(publishedWorks.filter((work) => work.id !== id).map((work) => work.id))])
    setCurrentIndex(0)
    navigate('play')
  }
  function renderView() { if (view === 'play' && !initialReady) return <section className="empty-state"><FileCode2 size={28} /><h1>加载 HTML</h1><p>正在准备初始作品。</p></section>; if (view === 'explore') return <ExploreView works={publishedWorks} threshold={threshold} minVotes={minVotes} onSubmit={() => navigate('submit')} onPlay={openWork} />; if (view === 'submit') return <SubmitView notice={notice} onSubmit={submitMock} />; if (view === 'admin') { if (backendStatus === 'live' && authState !== 'admin') return <AdminGate onLogin={() => { setAuthNotice(''); setAuthOpen(true) }} />; return <AdminView works={works} threshold={threshold} minVotes={minVotes} onThresholdChange={changeThreshold} onMinVotesChange={changeMinVotes} onApprove={approveMock} onReject={rejectMock} onLogout={backendStatus === 'live' ? handleLogout : undefined} notice={notice} /> }; return <PlayView work={currentWork} currentIndex={safeIndex} totalWorks={playableOrder.length} selected={currentVote} showResult={showResult} onVote={handleVote} onMove={move} onTakedown={setTakedownWork} /> }
  return <div className="app-shell"><header className="site-header"><button className="brand-button" onClick={() => navigate('play')} aria-label="回到鹈鹕测试首页"><BrandMark /><span className="brand-copy"><strong>鹈鹕测试</strong><small>LINUX DO 趣味评分站</small></span></button><div className="header-center"><span className="eyebrow eyebrow-header">PELICAN TEST / 01</span><span className="header-status"><span className="status-dot" /> {backendStatus === 'live' ? '在线数据' : backendStatus === 'loading' ? '正在连接' : '演示模式'}</span></div><nav className={`main-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="主导航"><ModeSwitcher mode={mode} onModeChange={resetMode} /><span className="nav-divider" aria-hidden="true" /><button className={view === 'play' ? 'is-current' : ''} onClick={() => navigate('play')}><PanelTop size={16} /> 开始绷</button><button className={view === 'explore' ? 'is-current' : ''} onClick={() => navigate('explore')}><BarChart3 size={16} /> 榜单</button><button className={view === 'submit' ? 'is-current' : ''} onClick={() => navigate('submit')}><UploadCloud size={16} /> 投稿</button><button className={view === 'admin' ? 'is-current' : ''} onClick={() => navigate('admin')}><Settings2 size={16} /> 审核台</button></nav><button className="login-button" onClick={() => { if (!isSupabaseConfigured) { setNotice('配置 Supabase 后可登录'); return }; setAuthNotice(''); setAuthOpen(true) }}>{authState === 'admin' ? '管理员' : '登录'}</button><button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="打开导航菜单" aria-expanded={mobileNavOpen}>{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button></header><main className="main-content">{renderView()}</main><footer className="site-footer"><span>作品归原作者 · LINUX DO</span><a href="https://linux.do" target="_blank" rel="noreferrer">LINUX DO <ExternalLink size={13} /></a></footer>{authOpen && <AuthDialog notice={authNotice} onClose={() => setAuthOpen(false)} onSubmit={handleLogin} />}{takedownWork && <TakedownDialog work={takedownWork} onClose={() => setTakedownWork(undefined)} onSubmit={handleTakedown} />}</div>
}

function PlayView({ work, currentIndex, totalWorks, selected, showResult, onVote, onMove, onTakedown }: { work?: Work; currentIndex: number; totalWorks: number; selected?: Rating; showResult: boolean; onVote: (rating: Rating) => void; onMove: (direction: -1 | 1) => void; onTakedown: (work: Work) => void }) {
  if (!work) return <section className="empty-state"><Sparkles size={28} /><h1>这批仙品还没攒够</h1><p>把门槛调低一点，或者先去普通模式看看。</p></section>
  const total = work.stats.reduce((sum, value) => sum + value, 0)
  const breakRate = total ? Math.round(work.stats[3] / total * 100) : 0
  return <div className="play-page">
    <section className="work-stage" aria-live="polite"><div className="stage-meta"><span className="stage-count">{String(currentIndex + 1).padStart(2, '0')} / {String(totalWorks).padStart(2, '0')}</span></div><article className="work-card"><div className="work-card-top"><div className="work-links">{work.source && <a href={work.source} target="_blank" rel="noreferrer" className="source-link">原帖 <ExternalLink size={14} /></a>}<button className="takedown-link" onClick={() => onTakedown(work)}>下架</button></div></div><div className="preview-frame-wrap"><div className="preview-frame-label"><FileCode2 size={14} /> HTML PREVIEW <span>受限沙箱</span></div><iframe className="preview-frame" title={`${work.title} HTML 预览`} sandbox="allow-scripts" srcDoc={withPreviewBridge(work.html, work)} /></div><div className="work-info"><div><h2>{work.title}</h2></div>{(work.author || work.source) && <div className="author-chip"><span className="author-avatar">{work.author.slice(0, 1) || '·'}</span><span>{work.author && <strong>@{work.author}</strong>}</span>{work.source && <a href={work.source} target="_blank" rel="noreferrer" aria-label={`打开 ${work.author || '原帖'} 的原帖`}><Link2 size={16} /></a>}</div>}</div><div className="rating-area">{showResult && <div className="rating-heading"><span className="vote-confirm"><CheckCircle2 size={15} /> 已记录</span></div>}<div className="rating-grid">{([1, 2, 3, 4] as Rating[]).map((rating) => <RatingButton key={rating} rating={rating} active={selected === rating} onClick={() => onVote(rating)} />)}</div></div><div className="result-area"><div className="result-top"><span><BarChart3 size={15} /></span><strong><span className="break-rate">{breakRate}%</span> 破绷</strong></div><StatBars stats={work.stats} /><div className="result-foot"><span>{total} 票</span></div></div></article><div className="stage-navigation"><button className="round-button" onClick={() => onMove(-1)} disabled={currentIndex === 0} aria-label="上一条"><ArrowLeft size={20} /></button><span>{currentIndex + 1} / {totalWorks}</span><button className="round-button" onClick={() => onMove(1)} aria-label="下一条"><ArrowRight size={20} /></button></div></section>
  </div>
}

function ExploreView({ works, threshold, minVotes, onSubmit, onPlay }: { works: Work[]; threshold: number; minVotes: number; onSubmit: () => void; onPlay: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'premium' | 'latest'>('all'); const filtered = [...works].sort((a, b) => { if (filter === 'latest') return b.submittedAt.localeCompare(a.submittedAt); if (filter === 'premium') return b.stats[3] / Math.max(1, b.stats.reduce((s, v) => s + v, 0)) - a.stats[3] / Math.max(1, a.stats.reduce((s, v) => s + v, 0)); return b.stats.reduce((s, v) => s + v, 0) - a.stats.reduce((s, v) => s + v, 0) })
  return <div className="explore-page"><section className="page-heading"><h1>榜单</h1></section><div className="filter-row"><div className="filter-tabs"><button className={filter === 'all' ? 'is-selected' : ''} onClick={() => setFilter('all')}><BarChart3 size={15} /> 人气</button><button className={filter === 'premium' ? 'is-selected' : ''} onClick={() => setFilter('premium')}><Sparkles size={15} /> 仙品</button><button className={filter === 'latest' ? 'is-selected' : ''} onClick={() => setFilter('latest')}><Clock3 size={15} /> 最新</button></div><span className="filter-summary"><Filter size={14} /> {filtered.length} 个作品</span></div><div className="work-grid">{filtered.map((work, index) => { const total = work.stats.reduce((s, v) => s + v, 0); const rawRate = total ? work.stats[3] / total : 0; const rate = Math.round(rawRate * 100); const premium = total >= minVotes && rawRate >= threshold; return <button className="explore-card" key={work.id} onClick={() => onPlay(work.id)}><div className="explore-number">{String(index + 1).padStart(2, '0')}</div><div className="explore-card-body"><div className="explore-tags">{work.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h2>{work.title}</h2>{work.description && <p>{work.description}</p>}<div className="explore-card-foot">{work.author && <span className="mini-author"><span>{work.author.slice(0, 1)}</span>@{work.author}</span>}<span className={premium ? 'mini-rate is-hot' : 'mini-rate'}>{premium && <Sparkles size={13} />}{rate}% 破绷</span></div><StatBars stats={work.stats} compact /></div><ChevronRight className="explore-arrow" size={20} /></button> })}</div><div className="add-card"><h2>提交作品</h2><button className="button button-dark" onClick={onSubmit}>提交 <ArrowRight size={17} /></button></div></div>
}

function SubmitView({ notice, onSubmit }: { notice: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="submit-page"><section className="page-heading"><h1>投稿</h1></section><div className="submit-layout"><form className="submit-form" onSubmit={onSubmit}><div className="form-section"><div className="form-section-title"><span>01</span><div><h2>作品信息</h2><p>让大家知道这是谁做的、从哪里来。</p></div></div><label>作品标题<input name="title" required placeholder="例如：当你决定只装一个生产力 App" /></label><div className="form-two"><label>LINUX DO 用户名<input name="author" required placeholder="用户名" /></label><label>原帖链接<input type="url" name="source" required placeholder="https://linux.do/t/topic/..." /></label></div><label>作品说明<textarea name="description" rows={3} placeholder="一句话介绍这个测试的梗点（可选）" /></label></div><div className="form-section"><div className="form-section-title"><span>02</span><div><h2>HTML 源码</h2><p>仅支持自包含的单个 .html 文件，最大 5MB。</p></div></div><label className="upload-box"><input type="file" name="html-file" accept=".html,text/html" /><UploadCloud size={24} /><strong>选择 HTML 文件</strong><span>或将文件拖到这里</span></label><div className="or-divider"><span>或者直接粘贴源码</span></div><textarea name="html" rows={8} placeholder="<!doctype html>..." /><div className="sandbox-note"><ShieldCheck size={16} /><span>作品会在受限沙箱中运行，默认禁止外部网络请求、表单和弹窗。</span></div></div><label className="consent-check"><input type="checkbox" required /><span>我确认已注明原作者与来源，并接受公开收录及下架申请规则。</span></label><button className="button button-primary submit-button" type="submit"><Send size={17} /> 提交审核 <ArrowRight size={17} /></button>{notice && <div className="form-notice"><CheckCircle2 size={18} />{notice}</div>}</form><aside className="submit-aside"><div className="aside-card"><div className="aside-icon"><LockKeyhole size={21} /></div><h3>为什么要审核？</h3><p>HTML 可以运行脚本，所以我们会先检查源码，再把作品放进隔离预览。审核不改变你的内容，只是保护主站和下一位访客。</p><ul><li><Check size={15} /> 作者与原帖公开可见</li><li><Check size={15} /> 单文件、5MB 以内</li><li><Check size={15} /> 可随时申请下架</li></ul></div><div className="aside-card aside-yellow"><TriangleAlert size={20} /><p>投稿后不会立即公开。审核通过后，作品才会出现在榜单和评分流里。</p></div></aside></div></div> }

function AdminGate({ onLogin }: { onLogin: () => void }) { return <section className="auth-gate"><LockKeyhole size={28} /><h1>审核台</h1><button className="button button-primary" onClick={onLogin}>管理员登录</button></section> }

function AuthDialog({ notice, onClose, onSubmit }: { notice: string; onClose: () => void; onSubmit: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return <div className="dialog-backdrop" role="presentation"><form className="dialog-card" onSubmit={(event) => { event.preventDefault(); onSubmit(email, password) }}><button className="dialog-close" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button><p className="eyebrow">ADMIN</p><h2>登录</h2><label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>{notice && <div className="dialog-error">{notice}</div>}<button className="button button-dark dialog-submit" type="submit">登录</button></form></div>
}

function TakedownDialog({ work, onClose, onSubmit }: { work: Work; onClose: () => void; onSubmit: (contact: string, reason: string) => void }) {
  const [contact, setContact] = useState('')
  const [reason, setReason] = useState('')
  return <div className="dialog-backdrop" role="presentation"><form className="dialog-card" onSubmit={(event) => { event.preventDefault(); onSubmit(contact, reason) }}><button className="dialog-close" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button><p className="eyebrow">TAKEDOWN</p><h2>申请下架</h2><p className="dialog-work-title">{work.title}</p><label>联系方式<input value={contact} onChange={(event) => setContact(event.target.value)} required placeholder="邮箱或 LINUX DO 用户名" /></label><label>原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} rows={4} /></label><button className="button button-dark dialog-submit" type="submit">提交</button></form></div>
}

function AdminView({ works, threshold, minVotes, onThresholdChange, onMinVotesChange, onApprove, onReject, onLogout, notice }: { works: Work[]; threshold: number; minVotes: number; onThresholdChange: (value: number) => void; onMinVotesChange: (value: number) => void; onApprove: (id: string) => void; onReject: (id: string) => void; onLogout?: () => void; notice: string }) { const pending = works.filter((work) => work.status === 'pending'); return <div className="admin-page"><section className="admin-top"><div><h1>审核台</h1></div><div className="admin-account"><span className="admin-avatar">A</span><strong>管理员</strong><button aria-label="退出登录" onClick={onLogout}><KeyRound size={16} /></button></div></section><div className="admin-grid"><section className="admin-panel"><div className="panel-heading"><div><span className="panel-kicker">QUEUE / 01</span><h2>待审核投稿 <span>{pending.length}</span></h2></div><Search size={19} /></div>{pending.length ? pending.map((work) => <div className="review-row" key={work.id}><div className="review-file"><FileCode2 size={18} /><span><strong>{work.title}</strong><small>@{work.author} · {work.submittedAt}</small></span></div><div className="review-actions"><button className="button button-small button-primary" onClick={() => onApprove(work.id)}><Check size={15} /> 通过</button><button className="button button-small button-ghost" onClick={() => onReject(work.id)}><X size={15} /> 退回</button></div></div>) : <div className="empty-queue"><CheckCircle2 size={24} /><p>队列干净。<br />可以去看看榜单。</p></div>}{notice && <div className="admin-notice"><CheckCircle2 size={16} /> {notice}</div>}</section><section className="admin-panel settings-panel"><div className="panel-heading"><div><span className="panel-kicker">SETTINGS / 02</span><h2>仙品模式</h2></div><Settings2 size={19} /></div><p className="panel-description">只有同时达到破绷率和最低票数的作品，才会出现在仙品模式。</p><label className="range-setting"><span><strong>破绷率门槛</strong><output>{Math.round(threshold * 100)}%</output></span><input type="range" min="0.3" max="0.8" step="0.05" value={threshold} onChange={(event) => onThresholdChange(Number(event.target.value))} /><small>“彻底破绷”票数 ÷ 总有效票数</small></label><label className="range-setting"><span><strong>最低有效票数</strong><output>{minVotes} 票</output></span><input type="range" min="5" max="50" step="5" value={minVotes} onChange={(event) => onMinVotesChange(Number(event.target.value))} /><small>避免一票成仙</small></label><div className="setting-preview"><Sparkles size={17} /><span>当前预计有 <strong>{works.filter((work) => work.status === 'published' && work.stats[3] / work.stats.reduce((s, v) => s + v, 0) >= threshold && work.stats.reduce((s, v) => s + v, 0) >= minVotes).length}</strong> 个仙品候选</span></div></section></div><section className="admin-panel admin-list"><div className="panel-heading"><div><span className="panel-kicker">PUBLISHED / {works.filter((work) => work.status === 'published').length}</span><h2>已发布作品</h2></div><button className="button button-small button-ghost"><Search size={15} /> 搜索</button></div>{works.filter((work) => work.status === 'published').map((work) => <div className="published-row" key={work.id}><span className="published-index">{work.id.slice(-3)}</span><span className="published-title"><strong>{work.title}</strong><small>@{work.author}</small></span><span className="published-rate">{Math.round(work.stats[3] / work.stats.reduce((s, v) => s + v, 0) * 100)}% 破绷</span><button className="icon-button" aria-label={`编辑 ${work.title}`}><ChevronRight size={17} /></button></div>)}</section></div> }

export default App
