export type InitialWorkFile = {
  id: string
  file: string
}

export type LoadedInitialWork = InitialWorkFile & {
  title: string
  html: string
}

export const initialWorkFiles: InitialWorkFile[] = [
  { id: 'initial-001', file: '001.html' },
  { id: 'initial-002', file: '002.html' },
  { id: 'initial-003', file: '003.html' },
  { id: 'initial-004', file: '004.html' },
  { id: 'initial-005', file: '005.html' },
  { id: 'initial-006', file: '006.html' },
]

function readTitle(html: string, fallback: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return document.title.replace(/\s+/g, ' ').trim() || fallback
}

export async function loadInitialWorks(): Promise<LoadedInitialWork[]> {
  return Promise.all(initialWorkFiles.map(async (item) => {
    const response = await fetch(`${import.meta.env.BASE_URL}works/initial/${item.file}`)
    if (!response.ok) throw new Error(`无法读取 ${item.file}（${response.status}）`)
    const html = await response.text()
    return { ...item, title: readTitle(html, `鹈鹕测试 ${item.id.slice(-3)}`), html }
  }))
}
