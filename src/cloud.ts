/* Supabase 연결: 로그인, 프로젝트(노선도) 목록, 실시간 공동편집, 오프라인 임시저장 */
import { create } from 'zustand'
import { createClient, type RealtimeChannel, type User } from '@supabase/supabase-js'
import { useRailStore } from './useRailStore'
import type { Line } from './rail'

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://dngjvjptvklkqywqzayw.supabase.co'
// 공개용(publishable) 키입니다. 데이터는 DB의 접근 규칙(RLS)이 보호해요.
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_G6tt1jdvaYIixeHcrSiC6g_T3kAVEAY'
export const supabase = createClient(URL, KEY)

export interface Project { id: string; owner_id: string; name: string; is_public: boolean; open_edit?: boolean }
export type Status = 'local' | 'synced' | 'saving' | 'offline' | 'error'
interface C {
  user: User | null; ready: boolean
  projects: Project[]; project: Project | null; canEdit: boolean
  status: Status; online: number; msg: string
}
export const useCloud = create<C>(() => ({
  user: null, ready: false, projects: [], project: null, canEdit: false, status: 'local', online: 0, msg: '',
}))
const set = useCloud.setState
const get = useCloud.getState

/** 키 순서와 상관없이 같은 문자열이 되도록 (DB가 키 순서를 바꿔 저장해요) */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

let pid: string | null = null
let sent = new Map<string, string>() // 서버에 반영된 노선 id → 내용
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined
let channel: RealtimeChannel | null = null
let unsubStore: (() => void) | null = null
const cacheKey = (p: string) => `kr-cache-${p}`
const LOCAL_BACKUP = 'kr-local-backup'
const LAST = 'kr-last-project'

function applyLines(lines: Line[]) {
  applying = true
  const st = useRailStore.getState()
  useRailStore.setState({ lines, activeId: lines.some((l) => l.id === st.activeId) ? st.activeId : (lines[0]?.id ?? null) })
  applying = false
}

function saveCache() {
  if (!pid) return
  try {
    localStorage.setItem(cacheKey(pid), JSON.stringify({ lines: useRailStore.getState().lines, sent: [...sent] }))
  } catch { /* 저장 공간 부족은 무시 */ }
}

function pending(): { upserts: Line[]; deletes: string[] } {
  const lines = useRailStore.getState().lines
  const upserts = lines.filter((l) => sent.get(l.id) !== stable(l))
  const ids = new Set(lines.map((l) => l.id))
  const deletes = [...sent.keys()].filter((id) => !ids.has(id))
  return { upserts, deletes }
}

async function push() {
  if (!pid || !get().canEdit) return
  const { upserts, deletes } = pending()
  if (!upserts.length && !deletes.length) { set({ status: 'synced' }); return }
  if (!navigator.onLine) { set({ status: 'offline' }); return }
  set({ status: 'saving' })
  const project_id = pid
  const now = new Date().toISOString()
  const rows = [
    ...upserts.map((l) => ({ project_id, id: l.id, kind: 'line', data: l, deleted: false, updated_at: now })),
    ...deletes.map((id) => ({ project_id, id, kind: 'line', data: {}, deleted: true, updated_at: now })),
  ]
  const { error } = await supabase.from('items').upsert(rows, { onConflict: 'project_id,id' })
  if (pid !== project_id) return
  if (error) { set({ status: navigator.onLine ? 'error' : 'offline', msg: error.message }); return }
  upserts.forEach((l) => sent.set(l.id, stable(l)))
  deletes.forEach((id) => sent.delete(id))
  saveCache()
  const rest = pending()
  if (rest.upserts.length || rest.deletes.length) schedule()
  else set({ status: 'synced', msg: '' })
}
function schedule() {
  clearTimeout(timer)
  timer = setTimeout(push, 700)
}

function onRemote(row: { id: string; kind: string; data: Line; deleted: boolean }) {
  if (row.kind !== 'line') return
  const lines = useRailStore.getState().lines
  const local = lines.find((l) => l.id === row.id)
  if (local && sent.get(row.id) !== stable(local)) return // 내가 고치는 중이면 내 것을 우선
  if (row.deleted) {
    sent.delete(row.id)
    if (local) applyLines(lines.filter((l) => l.id !== row.id))
  } else {
    sent.set(row.id, stable(row.data))
    applyLines(local ? lines.map((l) => (l.id === row.id ? row.data : l)) : [...lines, row.data])
  }
  saveCache()
}

export async function refreshProjects() {
  const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (data) set({ projects: data as Project[] })
}

export async function openProject(id: string) {
  closeProject(false)
  const user = get().user
  const { data: proj, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  let p = proj as Project | null
  const cached = (() => { try { return JSON.parse(localStorage.getItem(cacheKey(id)) || 'null') as { lines: Line[]; sent: [string, string][] } | null } catch { return null } })()
  if (!p) {
    if (!cached) { set({ msg: error ? '프로젝트를 열지 못했어요. 인터넷 연결을 확인해 주세요.' : '볼 수 없는 노선도예요. 로그인이 필요하거나 비공개일 수 있어요.' }); return }
    p = get().projects.find((x) => x.id === id) ?? { id, owner_id: '', name: '오프라인 노선도', is_public: false }
  }
  // 현재 로컬 작업을 보관 (프로젝트를 닫으면 되돌려요)
  if (!localStorage.getItem(LOCAL_BACKUP)) localStorage.setItem(LOCAL_BACKUP, JSON.stringify(useRailStore.getState().lines))
  let canEdit = false
  if (user && p) {
    canEdit = p.owner_id === user.id || !!p.open_edit
    if (!canEdit) {
      const { data: m } = await supabase.from('project_members').select('user_id').eq('project_id', id).eq('user_id', user.id).maybeSingle()
      canEdit = !!m
    }
  }
  if (!user && !navigator.onLine && cached) canEdit = true // 오프라인 임시 편집
  pid = id; sent = new Map()
  let lines: Line[]
  const { data: rows, error: e2 } = await supabase.from('items').select('id,data,deleted').eq('project_id', id).eq('kind', 'line')
  if (e2 || !rows) {
    if (!cached) { set({ msg: '노선을 불러오지 못했어요.' }); pid = null; return }
    lines = cached.lines; sent = new Map(cached.sent)
    set({ status: 'offline' })
  } else {
    const server = rows.filter((r) => !r.deleted)
    lines = server.map((r) => r.data as Line)
    rows.forEach((r) => { if (!r.deleted) sent.set(r.id, stable(r.data)) })
    // 오프라인 중 고친 내용이 남아 있으면 그쪽을 우선해요
    if (cached) {
      const cs = new Map(cached.sent)
      for (const l of cached.lines) {
        if (cs.get(l.id) !== stable(l)) lines = lines.some((x) => x.id === l.id) ? lines.map((x) => (x.id === l.id ? l : x)) : [...lines, l]
      }
    }
    set({ status: 'synced' })
  }
  applyLines(lines)
  set({ project: p, canEdit, msg: '' })
  localStorage.setItem(LAST, id)
  saveCache()

  unsubStore = useRailStore.subscribe((s, prev) => {
    if (applying || s.lines === prev.lines || !pid) return
    saveCache()
    if (get().canEdit) { set({ status: navigator.onLine ? 'saving' : 'offline' }); schedule() }
  })
  channel = supabase.channel(`project-${id}`, { config: { presence: { key: user?.id ?? `guest-${Math.random().toString(36).slice(2, 8)}` } } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `project_id=eq.${id}` },
      (pl) => { const r = pl.new as { id: string; kind: string; data: Line; deleted: boolean }; if (r?.id) onRemote(r) })
    .on('presence', { event: 'sync' }, () => set({ online: Object.keys(channel?.presenceState() ?? {}).length }))
    .subscribe(async (st) => { if (st === 'SUBSCRIBED') await channel?.track({ t: Date.now() }) })
  if (get().canEdit) schedule()
}

export function closeProject(restore = true) {
  clearTimeout(timer)
  unsubStore?.(); unsubStore = null
  if (channel) { supabase.removeChannel(channel); channel = null }
  const had = pid
  pid = null; sent = new Map()
  set({ project: null, canEdit: false, status: 'local', online: 0 })
  if (restore && had) {
    localStorage.removeItem(LAST)
    const b = localStorage.getItem(LOCAL_BACKUP)
    localStorage.removeItem(LOCAL_BACKUP)
    if (b) { try { applyLines(JSON.parse(b) as Line[]) } catch { applyLines([]) } }
  }
}

export async function createProject(name: string, withCurrent: boolean) {
  const user = get().user
  if (!user) return
  const lines = withCurrent ? useRailStore.getState().lines : []
  const { data, error } = await supabase.from('projects').insert({ owner_id: user.id, name }).select().single()
  if (error || !data) { set({ msg: `만들지 못했어요. ${error?.message ?? ''}` }); return }
  if (lines.length) {
    const rows = lines.map((l) => ({ project_id: data.id, id: l.id, kind: 'line', data: l, deleted: false }))
    await supabase.from('items').insert(rows)
  }
  await refreshProjects()
  // 새 프로젝트를 열 때는 현재 작업을 그대로 가져가므로 백업을 비워요
  localStorage.removeItem(LOCAL_BACKUP)
  await openProject(data.id)
}

export async function updateProject(patch: Partial<Pick<Project, 'name' | 'is_public' | 'open_edit'>>) {
  const p = get().project
  if (!p) return
  const { error } = await supabase.from('projects').update(patch).eq('id', p.id)
  if (error) { set({ msg: error.message.includes('open_edit') ? '데이터베이스에 open_edit 설정(SQL)을 먼저 추가해 주세요.' : error.message }); return }
  set({ project: { ...p, ...patch } })
  refreshProjects()
}

export async function deleteProject() {
  const p = get().project
  if (!p) return
  await supabase.from('projects').delete().eq('id', p.id)
  localStorage.removeItem(cacheKey(p.id))
  closeProject()
  refreshProjects()
}

export async function signOut() {
  closeProject()
  await supabase.auth.signOut()
}

export async function initCloud() {
  const { data } = await supabase.auth.getSession()
  set({ user: data.session?.user ?? null, ready: true })
  supabase.auth.onAuthStateChange((_e, session) => {
    const prev = get().user?.id
    set({ user: session?.user ?? null })
    if (prev !== session?.user?.id) refreshProjects()
  })
  await refreshProjects()
  window.addEventListener('online', () => { if (pid) { set({ status: 'saving' }); push() } })
  window.addEventListener('offline', () => { if (pid) set({ status: 'offline' }) })
  const q = new URLSearchParams(location.search).get('p') || localStorage.getItem(LAST)
  if (q) await openProject(q)
}
