import { useState } from 'react'
import { Cloud, CloudOff, Link2, LogOut, Users } from 'lucide-react'
import { closeProject, createProject, deleteProject, openProject, signOut, supabase, updateProject, useCloud } from './cloud'

const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
const btn = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm'
const LABEL = { local: '내 기기에만 저장', synced: '저장됨', saving: '저장 중…', offline: '오프라인 — 연결되면 자동 저장', error: '저장 실패' } as const

function AuthBox() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setMsg('')
    const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password: pw }) : await supabase.auth.signUp({ email, password: pw })
    setBusy(false)
    if (r.error) {
      const m = r.error.message
      setMsg(m.includes('Invalid login') ? '이메일 또는 비밀번호가 맞지 않아요.' : m.includes('already') ? '이미 가입된 이메일이에요.' : m.includes('at least') ? '비밀번호는 6자 이상이어야 해요.' : m)
    } else if (mode === 'up' && !r.data.session) setMsg('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
  }
  return (
    <div className="grid gap-2">
      <input className={inp} type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={inp} type="password" placeholder="비밀번호 (6자 이상)" value={pw} onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button disabled={busy || !email || !pw} onClick={go} className="rounded-lg bg-[#0052a4] px-3 py-2 text-sm text-white disabled:opacity-40">
        {mode === 'in' ? '로그인' : '회원가입'}
      </button>
      <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="text-xs text-slate-500 underline">
        {mode === 'in' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
      </button>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  )
}

export default function CloudBar() {
  const { user, ready, projects, project, canEdit, status, online, msg } = useCloud()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const mine = projects.filter((p) => p.owner_id === user?.id)
  const others = projects.filter((p) => p.owner_id !== user?.id)

  if (!ready) return null
  const StatusIcon = status === 'offline' || status === 'error' ? CloudOff : Cloud
  const link = project ? `${location.origin}${location.pathname}?p=${project.id}` : ''

  return (
    <section className="mt-2 rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          {user ? <span className="block truncate text-slate-600">{user.email}</span> : <span className="text-slate-500">로그인하면 어디서나 편집해요</span>}
        </div>
        {user
          ? <button onClick={signOut} className={`${btn} flex items-center gap-1`}><LogOut size={14} />로그아웃</button>
          : <button onClick={() => setOpen(!open)} className={btn}>로그인 / 가입</button>}
      </div>
      {!user && open && <div className="mt-2"><AuthBox /></div>}

      <div className="mt-2 flex items-center gap-2">
        <select className={inp} value={project?.id ?? ''}
          onChange={(e) => (e.target.value ? openProject(e.target.value) : closeProject())}>
          <option value="">내 기기 작업 (저장 안 함)</option>
          {mine.length > 0 && <optgroup label="내 노선도">{mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
          {others.length > 0 && <optgroup label="공개·공유된 노선도">{others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
        </select>
      </div>

      {project && (
        <div className="mt-2 grid gap-1.5 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><StatusIcon size={14} />{LABEL[status]}</span>
            <span className="flex items-center gap-1"><Users size={14} />{online}명 접속 중</span>
          </div>
          {!canEdit && <p className="rounded bg-amber-50 p-1.5 text-amber-700">{user ? '읽기 전용이에요. 수정은 저장되지 않아요.' : '로그인하면 편집할 수 있는지 확인돼요. 지금은 읽기 전용이에요.'}</p>}
          {status === 'error' && msg && <p className="text-red-600">{msg}</p>}
          <button onClick={() => { navigator.clipboard?.writeText(link); alert('링크를 복사했어요.') }} className={`${btn} flex items-center justify-center gap-1`}>
            <Link2 size={14} />공유 링크 복사
          </button>
          {user && project.owner_id === user.id && (
            <div className="grid gap-1 rounded-lg bg-slate-50 p-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={project.is_public} onChange={(e) => updateProject({ is_public: e.target.checked })} />누구나 볼 수 있게 공개</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!project.open_edit} onChange={(e) => updateProject({ open_edit: e.target.checked })} />로그인한 사람 누구나 함께 편집</label>
              <div className="flex gap-1">
                <button className={btn} onClick={() => { const n = prompt('새 이름', project.name); if (n) updateProject({ name: n }) }}>이름 바꾸기</button>
                <button className={`${btn} text-red-600`} onClick={() => { if (confirm('이 노선도를 삭제할까요? 되돌릴 수 없어요.')) deleteProject() }}>삭제</button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && status !== 'error' && <p className="mt-1 text-xs text-red-600">{msg}</p>}

      {user && (
        <div className="mt-2 flex gap-1.5">
          <input className={inp} placeholder="새 노선도 이름" value={name} onChange={(e) => setName(e.target.value)} />
          <button disabled={!name.trim()} className={`${btn} shrink-0 disabled:opacity-40`}
            onClick={() => { createProject(name.trim(), !project); setName('') }}>
            만들기
          </button>
        </div>
      )}
      {user && !project && <p className="mt-1 text-xs text-slate-400">만들기를 누르면 지금 그린 노선이 새 노선도에 담겨요.</p>}
    </section>
  )
}
