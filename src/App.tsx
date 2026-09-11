import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileCode2,
  Filter,
  Menu,
  PanelTop,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import './App.css'
import { loadInitialWorks } from './lib/initialWorks'

type Rating = 1 | 2 | 3 | 4
type View = 'play' | 'explore'

type Work = {
  id: string
  title: string
  html: string
  stats: [number, number, number, number]
}

const ratingLabels: Record<Rating, string> = {
  1: '不太行',
  2: '有点意思',
  3: '还不错',
  4: '太有趣了',
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function withPreviewBridge(html: string) {
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data:; script-src \'unsafe-inline\';">'
  const bridge = `<script>
    (() => {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          window.parent.postMessage({ type: 'pelican-preview-key', key: event.key }, '*')
        }
      })
    })()
  </script>`

  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${csp}${bridge}`)
  }

  return `<!doctype html><html><head>${csp}</head><body>${html}${bridge}</body></html>`
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-label="鹈鹕测试">
      <div className="brand-icon">
        <span className="brand-beak" />
        <span className="brand-eye" />
      </div>
      <div>
        <div className="brand-title">鹈鹕测试</div>
        <div className="brand-subtitle">LINUX DO 趣味评分站</div>
      </div>
    </div>
  )
}

function RatingButton({ rating, selected, onClick }: { rating: Rating; selected: boolean; onClick: () => void }) {
  const Icon = rating === 1 ? ThumbsDown : rating === 4 ? ThumbsUp : rating === 3 ? Sparkles : CircleHelp

  return (
    <button className={`rating-button rating-${rating} ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="rating-icon"><Icon size={18} /></span>
      <span className="rating-copy">
        <strong>{rating}</strong>
        <small>{ratingLabels[rating]}</small>
      </span>
      {selected && <Check size={16} className="rating-check" />}
    </button>
  )
}

function StatBars({ stats }: { stats: [number, number, number, number] }) {
  const total = stats.reduce((sum, value) => sum + value, 0)

  return (
    <div className="stat-bars">
      {stats.map((value, index) => (
        <div className="stat-row" key={index}>
          <span>{index + 1}</span>
          <div className="stat-track"><i style={{ width: total ? `${(value / total) * 100}%` : '0%' }} /></div>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('play')
  const [works, setWorks] = useState<Work[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, Rating>>({})
  const [showResult, setShowResult] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false

    void loadInitialWorks()
      .then((items) => {
        if (cancelled) return

        const loadedWorks = items.map((item) => ({
          id: item.id,
          title: item.title,
          html: item.html,
          stats: [0, 0, 0, 0] as [number, number, number, number],
        }))

        setWorks(loadedWorks)
        setOrder(shuffle(loadedWorks.map((item) => item.id)))
        setLoading(false)
      })
      .catch((error) => {
        console.warn('加载预设 HTML 失败', error)
        if (cancelled) return
        setLoadError('预设 HTML 加载失败，请检查部署目录。')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const activeIds = useMemo(() => works.map((work) => work.id), [works])
  const playableOrder = useMemo(() => {
    const existing = order.filter((id) => activeIds.includes(id))
    const missing = activeIds.filter((id) => !existing.includes(id))
    return [...existing, ...missing]
  }, [activeIds, order])
  const safeIndex = playableOrder.length ? Math.min(currentIndex, playableOrder.length - 1) : 0
  const currentWork = works.find((work) => work.id === playableOrder[safeIndex])

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string; key?: string }>) => {
      if (event.data?.type !== 'pelican-preview-key') return
      if (event.data.key === 'ArrowLeft') move(-1)
      if (event.data.key === 'ArrowRight') move(1)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') move(-1)
      if (event.key === 'ArrowRight') move(1)
    }

    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function move(direction: -1 | 1) {
    if (playableOrder.length < 2) return
    setCurrentIndex((index) => (index + direction + playableOrder.length) % playableOrder.length)
    setShowResult(false)
    setNotice('')
  }

  function handleVote(rating: Rating) {
    if (!currentWork) return
    setSelected((previous) => ({ ...previous, [currentWork.id]: rating }))
    setWorks((previous) => previous.map((work) => {
      if (work.id !== currentWork.id) return work
      const stats = [...work.stats] as [number, number, number, number]
      stats[rating - 1] += 1
      return { ...work, stats }
    }))
    setShowResult(true)
    setNotice('当前为静态预览，评分不会保存或提交到服务器。')
  }

  function navigate(nextView: View) {
    setView(nextView)
    setMobileNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openWork(index: number) {
    setCurrentIndex(index)
    navigate('play')
  }

  const content = loading ? (
    <section className="empty-state">
      <PanelTop size={28} />
      <h2>正在载入预设作品</h2>
      <p>首页只读取仓库内的静态 HTML 文件。</p>
    </section>
  ) : loadError ? (
    <section className="empty-state error-state">
      <CircleHelp size={28} />
      <h2>无法载入展示内容</h2>
      <p>{loadError}</p>
    </section>
  ) : view === 'explore' ? (
    <ExploreView works={works} onPlay={openWork} />
  ) : (
    <PlayView
      work={currentWork}
      currentIndex={safeIndex}
      total={playableOrder.length}
      selected={currentWork ? selected[currentWork.id] : undefined}
      showResult={showResult}
      notice={notice}
      onVote={handleVote}
      onMove={move}
    />
  )

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand-button" onClick={() => navigate('play')}>
            <BrandMark />
          </button>

          <div className="header-status"><span className="status-dot" /> 静态预览</div>

          <button className="mobile-menu-button" onClick={() => setMobileNavOpen((open) => !open)} aria-label="打开菜单">
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav className={`main-nav ${mobileNavOpen ? 'open' : ''}`}>
            <button className={view === 'play' ? 'active' : ''} onClick={() => navigate('play')}>开始体验</button>
            <button className={view === 'explore' ? 'active' : ''} onClick={() => navigate('explore')}>作品榜单</button>
          </nav>
        </div>
      </header>

      <main className="main-content">{content}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>六个预设 HTML · 纯静态展示</span>
          <span className="footer-divider" />
          <span>后续更新通过 Pull Request 提交</span>
          <a href="https://github.com/JeanHome123/L-pelican-test" target="_blank" rel="noreferrer">
            查看仓库 <ExternalLink size={13} />
          </a>
        </div>
      </footer>
    </div>
  )
}

function PlayView({
  work,
  currentIndex,
  total,
  selected,
  showResult,
  notice,
  onVote,
  onMove,
}: {
  work?: Work
  currentIndex: number
  total: number
  selected?: Rating
  showResult: boolean
  notice: string
  onVote: (rating: Rating) => void
  onMove: (direction: -1 | 1) => void
}) {
  if (!work) {
    return (
      <section className="empty-state">
        <PanelTop size={28} />
        <h2>暂时没有可展示的作品</h2>
      </section>
    )
  }

  return (
    <section className="play-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STATIC SHOWCASE</p>
          <h1>给这个 HTML<br /><em>一个直觉评分</em></h1>
          <p className="heading-copy">浏览仓库内预设的单文件网页，看看它们在真实浏览器里的表现。</p>
        </div>
        <div className="heading-count"><strong>{String(currentIndex + 1).padStart(2, '0')}</strong><span>/ {String(total).padStart(2, '0')}</span></div>
      </div>

      <div className="work-stage">
        <div className="stage-meta">
          <span className="stage-label"><FileCode2 size={15} /> PRESET HTML · {work.id}</span>
          <span className="stage-hint"><ArrowLeft size={14} /> 左右键切换 <ArrowRight size={14} /></span>
        </div>

        <div className="work-card">
          <div className="work-card-top">
            <span className="source-link"><CheckCircle2 size={14} /> 仓库内置作品</span>
            <span className="work-card-index">{String(currentIndex + 1).padStart(2, '0')}</span>
          </div>

          <div className="preview-frame-wrap">
            <div className="preview-frame-label"><span /> LIVE PREVIEW</div>
            <iframe className="preview-frame" title={work.title} srcDoc={withPreviewBridge(work.html)} sandbox="allow-scripts" />
          </div>

          <div className="work-info">
            <div>
              <h2>{work.title}</h2>
              <p>来自 public/works/initial 的静态预设页面</p>
            </div>
            <div className="work-info-mark"><PanelTop size={22} /><span>HTML</span></div>
          </div>

          <div className="rating-area">
            <div className="rating-heading">
              <span>{showResult ? '本地预览评分' : '你的第一感觉是？'}</span>
              <small><BarChart3 size={13} /> 仅当前页面有效</small>
            </div>
            <div className="rating-grid">
              {([1, 2, 3, 4] as Rating[]).map((rating) => (
                <RatingButton key={rating} rating={rating} selected={selected === rating} onClick={() => onVote(rating)} />
              ))}
            </div>
            {showResult && (
              <div className="result-area">
                <div className="result-title"><CheckCircle2 size={16} /> 已记录到本地预览状态</div>
                <StatBars stats={work.stats} />
                <p>{notice}</p>
              </div>
            )}
          </div>
        </div>

        <div className="stage-controls">
          <button onClick={() => onMove(-1)}><ArrowLeft size={17} /> 上一个</button>
          <span>{currentIndex + 1} / {total}</span>
          <button onClick={() => onMove(1)}>下一个 <ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  )
}

function ExploreView({ works, onPlay }: { works: Work[]; onPlay: (index: number) => void }) {
  const [filter, setFilter] = useState<'all' | 'latest'>('all')
  const displayedWorks = filter === 'latest' ? [...works].reverse() : works

  return (
    <section className="explore-page">
      <div className="page-heading explore-heading">
        <div>
          <p className="eyebrow">THE SHOWCASE</p>
          <h1>六个预设作品，<br /><em>一次看个够</em></h1>
          <p className="heading-copy">所有内容都来自仓库里的静态 HTML，适合先快速预览整体效果。</p>
        </div>
        <div className="explore-summary"><strong>{works.length}</strong><span>个预设作品</span></div>
      </div>

      <div className="explore-toolbar">
        <div className="filter-label"><Filter size={15} /> 筛选</div>
        <div className="filter-buttons">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部作品</button>
          <button className={filter === 'latest' ? 'active' : ''} onClick={() => setFilter('latest')}><Clock3 size={14} /> 文件顺序</button>
        </div>
      </div>

      <div className="works-grid">
        {displayedWorks.map((work) => {
          const index = works.findIndex((item) => item.id === work.id)
          return (
            <article className="explore-card" key={work.id} onClick={() => onPlay(index)}>
              <div className="explore-card-preview"><iframe title={work.title} srcDoc={withPreviewBridge(work.html)} sandbox="allow-scripts" /></div>
              <div className="explore-card-body">
                <div><span className="card-kicker">PRESET · {work.id}</span><h2>{work.title}</h2></div>
                <ChevronRight size={18} />
              </div>
            </article>
          )
        })}
        <article className="add-card">
          <div className="add-card-icon"><FileCode2 size={22} /></div>
          <h2>后续更新</h2>
          <p>新的单文件 HTML 通过 Pull Request 提交，审核合并后自动发布。</p>
        </article>
      </div>
    </section>
  )
}

export default App
