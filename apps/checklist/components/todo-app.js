"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dateFromKey, dateKey, friendlyError, GUEST_STORAGE_KEY, PRIORITIES, readGuestTodos, sortTodos, TABLE_NAME } from "@/lib/todos";

function Icon({ name, size = 20, ...props }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    list: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 8 1 1 2-2m2 1h3M8 13h8m-8 4h5" /></>,
    flag: <><path d="M5 21V4m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6" /></>,
    edit: <><path d="m16 3 5 5L9 20l-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></>,
    cloud: <><path d="M7 18a5 5 0 0 1-1-10 6 6 0 0 1 11-1 5.5 5.5 0 0 1 0 11" /><path d="m9 15 3-3 3 3m-3-3v9" /></>,
    refresh: <><path d="M20 10a8 8 0 0 0-14-4L3 9m0-6v6h6M4 14a8 8 0 0 0 14 4l3-3m0 6v-6h-6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    logout: <><path d="M9 4H4v16h5m5-12 4 4-4 4m-7-4h11" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.list}</svg>;
}

export default function TodoApp() {
  const [client] = useState(() => process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? createClient() : null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [guestReadable, setGuestReadable] = useState(true);
  const [guestTodos, setGuestTodos] = useState([]);
  const [remoteTodos, setRemoteTodos] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [today, setToday] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(2);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const requestVersion = useRef(0);
  const mutationPending = useRef(false);
  const todayRef = useRef("");
  const dialog = useRef(null);
  const titleInput = useRef(null);

  useEffect(() => {
    const initialDay = dateKey();
    todayRef.current = initialDay;
    setSelectedDate(initialDay);
    setToday(initialDay);
    try { setGuestTodos(readGuestTodos(localStorage.getItem(GUEST_STORAGE_KEY))); }
    catch { setGuestReadable(false); setError("이 기기에 저장된 목록을 읽지 못했어요. 기존 목록을 보호하기 위해 저장을 멈췄어요."); }
    setGuestReady(true);
    if (new URLSearchParams(window.location.search).has("auth_error")) setError("가입 확인 링크가 만료되었거나 다른 브라우저에서 열렸어요. 가입했던 브라우저에서 링크를 다시 열어주세요.");
    function onStorage(event) {
      if (event.key !== GUEST_STORAGE_KEY) return;
      try { setGuestTodos(readGuestTodos(event.newValue)); }
      catch { setError("다른 창의 변경 내용을 읽지 못했어요. 새로고침해주세요."); }
    }
    window.addEventListener("storage", onStorage);
    const timer = setInterval(() => {
      const next = dateKey();
      if (next !== todayRef.current) {
        const previous = todayRef.current;
        todayRef.current = next;
        setToday(next);
        setSelectedDate((current) => current === previous ? next : current);
      }
    }, 60000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!client) { setAuthReady(true); return; }
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user || null); setAuthReady(true); }
    });
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setUser(data?.session?.user || null);
      setAuthReady(true);
      if (sessionError) setError("로그인 정보를 확인하지 못했어요. 다시 로그인해주세요.");
    }).catch(() => { if (active) { setAuthReady(true); setError("로그인 정보를 불러오지 못했어요. 다시 시도해주세요."); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  const fetchTodos = useCallback(async (showLoading = false) => {
    if (!client || !user?.id || !selectedDate || mutationPending.current) return;
    const version = ++requestVersion.current;
    if (showLoading) setLoading(true);
    try {
      const { data, error: queryError } = await client.from(TABLE_NAME).select("id,user_id,title,completed,priority,task_date,created_at").eq("user_id", user.id).eq("task_date", selectedDate);
      if (version !== requestVersion.current) return;
      if (queryError) throw queryError;
      setRemoteTodos(data || []);
      setLastSync(new Date());
      setError("");
    } catch (queryError) { if (version === requestVersion.current) setError(friendlyError(queryError)); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [client, user?.id, selectedDate]);

  useEffect(() => {
    requestVersion.current += 1;
    setRemoteTodos([]);
    setLastSync(null);
    setEditingId(null);
    if (!user?.id) { setLoading(false); return; }
    fetchTodos(true);
    const timer = setInterval(() => { if (document.visibilityState === "visible") fetchTodos(); }, 10000);
    const refresh = () => fetchTodos();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { requestVersion.current += 1; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [user?.id, selectedDate, fetchTodos]);

  useEffect(() => {
    if (authOpen && !dialog.current.open) dialog.current.showModal();
    if (!authOpen && dialog.current.open) dialog.current.close();
  }, [authOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const tasks = useMemo(() => sortTodos(user ? remoteTodos : guestTodos.filter((task) => task.task_date === selectedDate)), [user, remoteTodos, guestTodos, selectedDate]);
  const completedCount = tasks.filter((task) => task.completed).length;
  const importantCount = tasks.filter((task) => task.priority === 1 && !task.completed).length;
  const remainingCount = tasks.length - completedCount;
  const progress = tasks.length ? Math.round(completedCount / tasks.length * 100) : 0;
  const visibleTasks = tasks.filter((task) => filter === "pending" ? !task.completed : filter === "completed" ? task.completed : filter === "important" ? task.priority === 1 && !task.completed : true);
  const ready = authReady && guestReady && !!selectedDate;
  const disabled = !ready || loading || busy || (!user && !guestReadable);

  function saveGuest(next) {
    if (!guestReadable) throw new Error("Guest storage unavailable");
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
    setGuestTodos(next);
  }

  async function mutate(operation) {
    if (mutationPending.current || disabled) return false;
    mutationPending.current = true;
    requestVersion.current += 1;
    setBusy(true);
    setError("");
    try { await operation(); if (user) setLastSync(new Date()); return true; }
    catch (mutationError) { setError(user ? friendlyError(mutationError) : "저장하지 못했어요. 브라우저의 저장 공간 설정을 확인해주세요. 입력 내용은 그대로 남겨뒀어요."); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  }

  async function addTask(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 200) return;
    const item = { id: crypto.randomUUID(), title: trimmed, priority: Number(priority), completed: false, task_date: selectedDate, created_at: new Date().toISOString() };
    const saved = await mutate(async () => {
      if (user) {
        const { data, error: insertError } = await client.from(TABLE_NAME).insert({ ...item, user_id: user.id }).select().single();
        if (insertError) throw insertError;
        setRemoteTodos((previous) => [...previous, data]);
      } else saveGuest([...guestTodos, item]);
    });
    if (saved) { setTitle(""); setFilter("all"); titleInput.current?.focus(); }
  }

  async function updateTask(task, changes) {
    const saved = await mutate(async () => {
      if (user) {
        setRemoteTodos((previous) => previous.map((item) => item.id === task.id ? { ...item, ...changes } : item));
        const { data, error: updateError } = await client.from(TABLE_NAME).update(changes).eq("id", task.id).eq("user_id", user.id).select().single();
        if (updateError) {
          setRemoteTodos((previous) => previous.map((item) => item.id === task.id ? task : item));
          throw updateError;
        }
        setRemoteTodos((previous) => previous.map((item) => item.id === task.id ? data : item));
      } else saveGuest(guestTodos.map((item) => item.id === task.id ? { ...item, ...changes } : item));
    });
    if (saved) setEditingId(null);
  }

  async function removeTask(task) {
    const saved = await mutate(async () => {
      if (user) {
        const { error: deleteError } = await client.from(TABLE_NAME).delete().eq("id", task.id).eq("user_id", user.id);
        if (deleteError) throw deleteError;
        setRemoteTodos((previous) => previous.filter((item) => item.id !== task.id));
      } else saveGuest(guestTodos.filter((item) => item.id !== task.id));
    });
    if (saved) setNotice("할 일을 삭제했어요.");
  }

  async function importGuest() {
    const saved = await mutate(async () => {
      const { error: importError } = await client.from(TABLE_NAME).upsert(guestTodos.map((item) => ({ ...item, user_id: user.id })), { onConflict: "id" });
      if (importError) throw importError;
      try { saveGuest([]); } catch { setGuestTodos([]); }
    });
    if (saved) { setNotice("이 기기의 목록을 계정으로 옮겼어요."); fetchTodos(true); }
  }

  function changeDay(offset) {
    const next = dateFromKey(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(dateKey(next));
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!client || authBusy) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const result = authMode === "login"
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (result.error) throw result.error;
      if (result.data.session) { setAuthOpen(false); setPassword(""); setNotice("로그인했어요. 같은 계정으로 다른 기기에서도 이어서 쓰세요."); }
      else { setAuthMessage("가입 확인 메일을 보냈어요. 이 브라우저에서 메일의 확인 링크를 연 뒤 로그인해주세요."); setPassword(""); }
    } catch (authError) { setAuthMessage(friendlyError(authError)); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (!client || busy) return;
    setBusy(true);
    try {
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      setUser(null);
      setRemoteTodos([]);
      setNotice("이 기기에서 로그아웃했어요.");
    } catch { setError("로그아웃하지 못했어요. 다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  const dateLabel = selectedDate ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(dateFromKey(selectedDate)) : "오늘을 준비하고 있어요";
  const dayTitle = selectedDate === today ? "오늘의 할 일" : "하루의 할 일";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="하루한칸 홈"><span className="brand-mark"><Icon name="check" size={23} /></span><span>하루한칸<span className="brand-caption">나의 작은 할 일 메모장</span></span></a>
        <div className="nav-caption">MY NOTE</div>
        <nav aria-label="할 일 메뉴">
          <button className={`nav-item ${["all", "pending"].includes(filter) ? "selected" : ""}`} onClick={() => setFilter("all")}><Icon name="list" />모든 할 일<span>{tasks.length}</span></button>
          <button className={`nav-item ${filter === "important" ? "selected" : ""}`} onClick={() => setFilter("important")}><Icon name="flag" />중요한 일<span>{importantCount}</span></button>
          <button className={`nav-item ${filter === "completed" ? "selected" : ""}`} onClick={() => setFilter("completed")}><Icon name="check" />완료한 일<span>{completedCount}</span></button>
        </nav>
        <div className="sidebar-note"><span className="tiny-sun"><Icon name="sun" size={28} /></span><p>많이 해내는 하루보다,<br /><strong>하나씩 해내는 하루.</strong></p><span>오늘도 나만의 속도로 걸어가요.</span></div>
        <div className="account-card">
          {user ? <><div className="account-label"><span className="avatar">{(user.email || "나")[0].toUpperCase()}</span><span>나의 메모장<small>{user.email}</small></span></div><button className="text-button logout-button" onClick={signOut} disabled={busy}><Icon name="logout" size={16} />로그아웃</button></> : <><Icon name="cloud" size={23} /><h3>어디서든, 이어서</h3><p>같은 계정으로 로그인하면<br />휴대폰과 컴퓨터에서 함께 써요.</p><button className="secondary-button full-width" onClick={() => { setAuthMessage(""); setAuthOpen(true); }}>로그인 / 회원가입</button></>}
        </div>
        <div className="sidebar-footer">작은 완료가 모여, 좋은 하루.</div>
      </aside>

      <main className="main-content">
        <div className="mobile-brand"><span className="brand-mark"><Icon name="check" /></span><strong>하루한칸</strong><button className="text-button" onClick={() => user ? signOut() : setAuthOpen(true)} disabled={busy}>{user ? "로그아웃" : "로그인"}</button></div>
        <header className="page-header"><div><div className="eyebrow"><span /> A LITTLE NOTE FOR YOUR DAY</div><h1>{dayTitle}<span className="heading-dot">.</span></h1><p>머릿속의 할 일을 꺼내 놓고, 중요한 일부터 하나씩.</p></div><span className={`storage-pill ${user ? "online" : ""}`}><span />{busy ? "저장 중…" : user ? "계정에 온라인 저장" : "이 기기에 저장"}</span></header>

        <div className="day-toolbar"><div className="date-label"><Icon name="sun" size={21} /><span>{dateLabel}</span>{selectedDate === today && <span className="today-badge">오늘</span>}</div><div className="day-controls"><button className="icon-button previous-day" aria-label="이전 날" onClick={() => changeDay(-1)} disabled={disabled}><Icon name="arrow" size={17} /></button><label className="date-picker-label"><span className="sr-only">날짜 선택</span><input type="date" aria-label="날짜 선택" value={selectedDate} onChange={(event) => { if (event.target.value) setSelectedDate(event.target.value); }} disabled={disabled} /></label><button className="icon-button" aria-label="다음 날" onClick={() => changeDay(1)} disabled={disabled}><Icon name="arrow" size={17} /></button>{selectedDate !== today && <button className="text-button" onClick={() => setSelectedDate(today)} disabled={disabled}>오늘로</button>}</div></div>

        <section className="progress-card" aria-label="하루 진행률"><div className="progress-copy"><span className="progress-icon"><Icon name="check" size={22} /></span><div><h2>{tasks.length && progress === 100 ? "오늘의 할 일, 모두 해냈어요!" : "작은 완료가 쌓이고 있어요"}</h2><p>{tasks.length ? `전체 ${tasks.length}개 중 ${completedCount}개 완료 · ${remainingCount}개 남았어요` : "첫 번째 할 일을 적으며 가볍게 시작해요."}</p></div></div><div className="progress-meter"><div className="progress-value"><span>오늘의 달성률</span><strong>{progress}<small>%</small></strong></div><div className="progress-track" role="progressbar" aria-label="완료한 할 일 비율" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div></div></section>

        <section className="notepad" aria-label="할 일 메모장">
          <form className="add-form" onSubmit={addTask}><div className="new-task-label"><Icon name="plus" size={15} /><label htmlFor="new-task">새로운 할 일</label></div><div className="add-form-fields"><input id="new-task" ref={titleInput} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="오늘 어떤 일을 해야 하나요?" autoComplete="off" disabled={disabled} /><div className="priority-control"><Icon name="flag" size={15} /><select aria-label="새 할 일 중요도" value={priority} onChange={(event) => setPriority(Number(event.target.value))} disabled={disabled}>{Object.entries(PRIORITIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></div><button className="primary-button add-button" type="submit" disabled={disabled || !title.trim()}><Icon name="plus" size={18} />추가</button></div><div className="input-hint"><span>Enter를 눌러 빠르게 추가하세요.</span><span>중요도 높은 순으로 자동 정렬</span></div></form>

          {error && <div className="error-banner" role="alert"><p>{error}</p><div>{user && <button className="text-button" onClick={() => fetchTodos(true)} disabled={busy}>다시 시도</button>}{error.includes("저장 공간") && <a href="/setup" className="text-button">설정 안내</a>}<button className="icon-button" aria-label="오류 안내 닫기" onClick={() => setError("")}><Icon name="close" size={16} /></button></div></div>}
          {user && guestTodos.length > 0 && <div className="import-banner"><p>이 기기에 적어둔 할 일 <strong>{guestTodos.length}개</strong>가 있어요.</p><button className="text-button" onClick={importGuest} disabled={disabled}>내 계정으로 옮기기 <span aria-hidden="true">→</span></button></div>}

          <div className="list-toolbar"><div className="filter-tabs" aria-label="할 일 보기">{[["all", "전체", tasks.length], ["pending", "남은 일", remainingCount], ["completed", "완료", completedCount]].map(([value, label, count]) => <button key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{count}</span></button>)}</div><span className="sort-label"><Icon name="flag" size={14} />{filter === "important" ? "중요한 일만" : "중요도순"}</span></div>
          <div className="mobile-important"><button className="text-button" aria-pressed={filter === "important"} onClick={() => setFilter(filter === "important" ? "all" : "important")}><Icon name="flag" size={14} />{filter === "important" ? "모든 일 보기" : `중요한 일 ${importantCount}개`}</button></div>

          {!ready || loading ? <div className="empty-state" role="status"><span className="loading-spinner" /><p>메모장을 펼치고 있어요…</p></div> : visibleTasks.length === 0 ? <div className="empty-state"><div className="empty-art"><div className="paper-lines"><span /><span /><span /></div><span className="empty-check"><Icon name="check" size={25} /></span><span className="art-spark">✦</span></div><h3>{filter === "completed" ? "완료한 일이 여기에 모여요" : filter === "important" ? "지금은 급한 일이 없어요" : filter === "pending" && tasks.length ? "할 일을 모두 끝냈어요!" : "오늘의 첫 번째 할 일을 적어볼까요?"}</h3><p>{filter === "completed" ? "일을 마치면 왼쪽 네모를 눌러 체크해주세요." : filter === "important" ? "중요도를 ‘높음’으로 정한 일을 모아 보여드려요." : filter === "pending" && tasks.length ? "차근차근 해낸 나에게 잠깐의 쉼을 선물해요." : "작은 일도 좋아요. 하나씩 적고, 하나씩 끝내보세요."}</p>{filter === "all" && <button className="text-button" onClick={() => titleInput.current?.focus()}>첫 할 일 적기 <span aria-hidden="true">↗</span></button>}</div> : <ul className="task-list" aria-label="할 일 목록">{visibleTasks.map((task) => <li key={task.id} className={`task-row ${task.completed ? "is-complete" : ""}`}><label className="task-checkbox"><input type="checkbox" checked={task.completed} onChange={() => updateTask(task, { completed: !task.completed })} disabled={disabled} aria-label={`${task.title} 완료`} /><span><Icon name="check" size={15} /></span></label><div className="task-content">{editingId === task.id ? <form className="edit-form" onSubmit={(event) => { event.preventDefault(); if (editedTitle.trim()) updateTask(task, { title: editedTitle.trim() }); }}><input autoFocus aria-label="할 일 내용 수정" value={editedTitle} maxLength={200} onChange={(event) => setEditedTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditingId(null); }} disabled={disabled} /><button className="text-button" type="submit" disabled={disabled || !editedTitle.trim()}>저장</button><button className="text-button muted" type="button" onClick={() => setEditingId(null)} disabled={busy}>취소</button></form> : <span className="task-title">{task.title}</span>}</div><select className={`task-priority priority-${task.priority}`} aria-label={`${task.title} 중요도`} value={task.priority} onChange={(event) => updateTask(task, { priority: Number(event.target.value) })} disabled={disabled}>{Object.entries(PRIORITIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><div className="task-actions"><button className="icon-button" aria-label={`${task.title} 수정`} onClick={() => { setEditingId(task.id); setEditedTitle(task.title); }} disabled={disabled}><Icon name="edit" size={17} /></button><button className="icon-button delete-button" aria-label={`${task.title} 삭제`} onClick={() => removeTask(task)} disabled={disabled}><Icon name="trash" size={17} /></button></div></li>)}</ul>}
          <footer className="notepad-footer"><span><Icon name="check" size={14} />끝낸 일은 네모를 눌러 체크해요.</span><span>{user ? lastSync ? "온라인 목록 동기화됨" : "온라인 목록" : "이 브라우저에 자동 저장"}{user && <button className="icon-button" aria-label="목록 새로고침" onClick={() => fetchTodos(true)} disabled={busy || loading}><Icon name="refresh" size={14} /></button>}</span></footer>
        </section>
        <p className="page-footer">다 하지 않아도 괜찮아요. 오늘 끝낸 하나면 충분해요.<span>하루한칸</span></p>
      </main>

      {notice && <div className="toast" role="status"><Icon name="check" size={18} />{notice}</div>}
      <dialog ref={dialog} className="auth-dialog" onCancel={() => { if (!authBusy) setAuthOpen(false); }} onClose={() => setAuthOpen(false)}><button className="icon-button dialog-close" aria-label="로그인 창 닫기" onClick={() => setAuthOpen(false)} disabled={authBusy}><Icon name="close" /></button><span className="dialog-icon"><Icon name="cloud" size={28} /></span><h2>{authMode === "login" ? "어디서든, 나의 메모장" : "나의 메모장 시작하기"}</h2><p>같은 계정으로 로그인하면<br />휴대폰과 컴퓨터에서 같은 목록을 볼 수 있어요.</p>{!client ? <p role="alert" className="auth-message">온라인 연결 설정이 필요해요. 지금은 이 기기에 목록을 저장할 수 있어요.</p> : <><div className="auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthMessage(""); }} disabled={authBusy}>로그인</button><button className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthMessage(""); }} disabled={authBusy}>회원가입</button></div><form className="auth-form" onSubmit={submitAuth}><label>이메일<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={authBusy} /></label><label>비밀번호<input type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} required minLength={authMode === "signup" ? 8 : 1} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={authMode === "signup" ? "8자 이상 입력해주세요" : "비밀번호를 입력해주세요"} disabled={authBusy} /></label>{authMessage && <p className="auth-message" role="status">{authMessage}</p>}<button className="primary-button full-width" type="submit" disabled={authBusy}>{authBusy ? "잠시만 기다려주세요…" : authMode === "login" ? "로그인" : "계정 만들기"}</button></form></>}<p className="dialog-footnote">로그인하지 않아도 이 기기에서 먼저 써볼 수 있어요.</p></dialog>
    </div>
  );
}
