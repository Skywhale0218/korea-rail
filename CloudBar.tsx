import { useState } from 'react'
import { Cloud, CloudOff, Link2, LogOut, Users, X } from 'lucide-react'
import { closeProject, createProject, deleteProject, openProject, signOut, supabase, updateProject, useCloud } from './cloud'

const inp = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-black'
const btn = 'rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-[#0052a4] hover:text-[#0052a4]'
const primary = 'rounded-lg border border-[#0052a4] bg-[#0052a4] px-3 py-1.5 text-sm text-white hover:bg-[#003f80] disabled:opacity-40'
const LABEL = { local: '내 기기에만 저장', synced: '저장됨', saving: '저장 중…', offline: '오프라인 — 연결되면 자동 저장', error: '저장 실패' } as const

const redirect = () => `${location.origin}${location.pathname}`

async function oauth(provider: 'google' | 'apple', setMsg: (m: string) => void) {
  setMsg('')
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirect() } })
  if (error) {
    const name = provider === 'google' ? 'Google' : 'Apple'
    setMsg(/not enabled|Unsupported provider/i.test(error.message) ? `${name} 로그인이 아직 켜져 있지 않아요. (관리자 설정이 필요해요)` : error.message)
  }
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
)
const AppleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 384 512" aria-hidden fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
)

function AuthBox({ initial }: { initial: 'in' | 'up' }) {
  const [mode, setMode] = useState<'in' | 'up'>(initial)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setMsg('')
    const r = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect() } })
    setBusy(false)
    if (r.error) {
      const m = r.error.message
      setMsg(m.includes('Invalid login') ? '이메일 또는 비밀번호가 맞지 않아요.' : m.includes('already') ? '이미 가입된 이메일이에요.' : m.includes('at least') ? '비밀번호는 6자 이상이어야 해요.' : m.includes('not confirmed') ? '메일 승인이 아직 안 됐어요. 받은 편지함의 링크를 눌러 주세요.' : m)
    } else if (mode === 'up' && !r.data.session) setMsg('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
  }
  return (
    <div className="grid gap-2">
      <div className="text-base font-bold">{mode === 'in' ? '로그인' : '회원가입'}</div>
      <button onClick={() => oauth('google', setMsg)} className={`${btn} flex items-center justify-center gap-2 py-2`}><GoogleIcon />Google로 계속하기</button>
      <button onClick={() => oauth('apple', setMsg)} className="flex items-center justify-center gap-2 rounded-lg border border-black bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"><AppleIcon />Apple로 계속하기</button>
      <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="h-px flex-1 bg-neutral-300" />또는 이메일<span className="h-px flex-1 bg-neutral-300" /></div>
      <input className={inp} type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={inp} type="password" placeholder="비밀번호 (6자 이상)" value={pw} onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button disabled={busy || !email || !pw} onClick={go} className={`${primary} py-2`}>{mode === 'in' ? '로그인' : '회원가입'}</button>
      <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }} className="text-xs text-[#0052a4] underline">
        {mode === 'in' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
      </button>
      {msg && <p className="text-xs text-[#0052a4]">{msg}</p>}
    </div>
  )
}

function Projects() {
  const { user, projects, project, canEdit, status, online, msg } = useCloud()
  const [name, setName] = useState('')
  const mine = projects.filter((p) => p.owner_id === user?.id)
  const others = projects.filter((p) => p.owner_id !== user?.id)
  const StatusIcon = status === 'offline' || status === 'error' ? CloudOff : Cloud
  const link = project ? `${location.origin}${location.pathname}?p=${project.id}` : ''
  return (
    <div className="grid gap-2">
      <div className="text-base font-bold">노선도</div>
      <select className={inp} value={project?.id ?? ''} onChange={(e) => (e.target.value ? openProject(e.target.value) : closeProject())}>
        <option value="">내 기기 작업 (저장 안 함)</option>
        {mine.length > 0 && <optgroup label="내 노선도">{mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
        {others.length > 0 && <optgroup label="공개·공유된 노선도">{others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
      </select>

      {project && (
        <div className="grid gap-1.5 text-xs text-neutral-700">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><StatusIcon size={14} />{LABEL[status]}</span>
            <span className="flex items-center gap-1"><Users size={14} />{online}명 접속 중</span>
          </div>
          {!canEdit && <p className="rounded border border-[#0052a4] p-1.5 text-[#0052a4]">{user ? '읽기 전용이에요. 수정은 저장되지 않아요.' : '로그인하면 편집할 수 있는지 확인돼요. 지금은 읽기 전용이에요.'}</p>}
          <button onClick={() => { navigator.clipboard?.writeText(link); alert('링크를 복사했어요.') }} className={`${btn} flex items-center justify-center gap-1`}>
            <Link2 size={14} />공유 링크 복사
          </button>
          {user && project.owner_id === user.id && (
            <div className="grid gap-1 rounded-lg border border-neutral-200 p-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={project.is_public} onChange={(e) => updateProject({ is_public: e.target.checked })} />누구나 볼 수 있게 공개</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!project.open_edit} onChange={(e) => updateProject({ open_edit: e.target.checked })} />로그인한 사람 누구나 함께 편집</label>
              <div className="flex gap-1">
                <button className={btn} onClick={() => { const n = prompt('새 이름', project.name); if (n) updateProject({ name: n }) }}>이름 바꾸기</button>
                <button className={`${btn} text-[#0052a4]`} onClick={() => { if (confirm('이 노선도를 삭제할까요? 되돌릴 수 없어요.')) deleteProject() }}>삭제</button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <p className="text-xs text-[#0052a4]">{msg}</p>}

      {user && (
        <div className="grid gap-1">
          <div className="flex gap-1.5">
            <input className={inp} placeholder="새 노선도 이름" value={name} onChange={(e) => setName(e.target.value)} />
            <button disabled={!name.trim()} className={`${primary} shrink-0`} onClick={() => { createProject(name.trim(), !project); setName('') }}>만들기</button>
          </div>
          {!project && <p className="text-xs text-neutral-500">만들기를 누르면 지금 그린 노선이 새 노선도에 담겨요.</p>}
        </div>
      )}
    </div>
  )
}

/** 화면 맨 위 오른쪽: 로그인 · 회원가입 / 내 노선도 */
export default function HeaderBar() {
  const { user, ready, project, status, online, projects } = useCloud()
  const [view, setView] = useState<null | 'in' | 'up' | 'projects'>(null)
  if (!ready) return null
  const StatusIcon = status === 'offline' || status === 'error' ? CloudOff : Cloud
  const label = (user?.user_metadata?.name as string | undefined) || user?.email || ''

  return (
    <div className="flex shrink-0 items-center gap-2">
      {(project || user || projects.length > 0) && (
        <button onClick={() => setView(view === 'projects' ? null : 'projects')} className={`${btn} flex items-center gap-1.5`}>
          <StatusIcon size={15} />
          <span className="hidden max-w-[10rem] truncate sm:inline">{project ? project.name : '노선도'}</span>
          {project && <span className="flex items-center gap-0.5 text-xs text-neutral-600"><Users size={12} />{online}</span>}
        </button>
      )}
      {user ? (
        <>
          <span className="hidden max-w-[11rem] truncate text-sm text-neutral-700 md:inline">{label}</span>
          <button onClick={signOut} className={`${btn} flex items-center gap-1`}><LogOut size={14} />로그아웃</button>
        </>
      ) : (
        <>
          <button onClick={() => setView('in')} className={btn}>로그인</button>
          <button onClick={() => setView('up')} className={primary}>회원가입</button>
        </>
      )}

      {view && (
        <>
          <div className="fixed inset-0 z-[1100]" onClick={() => setView(null)} />
          <div className="absolute right-3 top-[calc(100%+6px)] z-[1200] max-h-[80vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-neutral-300 bg-white p-4 shadow-xl">
            <button onClick={() => setView(null)} className="absolute right-2 top-2 rounded p-1 text-neutral-500 hover:text-black" aria-label="닫기"><X size={16} /></button>
            {view === 'projects' ? (
              <Projects />
            ) : user ? (
              <Projects />
            ) : (
              <div className="grid gap-4">
                <AuthBox key={view} initial={view} />
                {projects.length > 0 && <div className="border-t border-neutral-200 pt-3"><Projects /></div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
