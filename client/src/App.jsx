import { useEffect, useRef, useState } from "react";

const NAMES_KEY = "sorteio.participantes.v1";
const THEME_KEY = "sorteio.tema.v1";

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function randomInt(maxExclusive) {
  const range = 0x100000000;
  const limit = range - range % maxExclusive;
  const buffer = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value, includeDate = false) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", includeDate
    ? { dateStyle: "full", timeStyle: "short" }
    : { hour: "2-digit", minute: "2-digit" });
}

function Icon({ name, size = 18 }) {
  const paths = {
    home: <path d="m4 10.5 8-6.5 8 6.5V20h-6v-6h-4v6H4z" />,
    history: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    draw: <><path d="M4 7h3.4a4 4 0 0 1 3.2 1.6l2.8 3.8a4 4 0 0 0 3.2 1.6H20" /><path d="m17 11 3 3-3 3M4 17h3.4a4 4 0 0 0 2.6-1m4-8.6A4 4 0 0 1 17.4 6H20m-3-3 3 3-3 3" /></>,
    moon: <path d="M20.4 15.1A8.6 8.6 0 0 1 8.9 3.6 8.8 8.8 0 1 0 20.4 15.1Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function groupEntries(participants = []) {
  const groups = new Map();
  [...participants].sort((left, right) => left.order - right.order).forEach(person => {
    const group = person.group || "Pessoa sorteada";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(person);
  });
  return [...groups.entries()];
}

function ResultView({ draw, onMove, onCopy }) {
  if (!draw) {
    return <div className="empty-state"><div className="empty-art" aria-hidden="true"><span>✳</span></div><h3>Pronto para embaralhar?</h3><p>Adicione os participantes e escolha como quer fazer o sorteio.</p></div>;
  }
  if (draw.type === "individual") {
    return <>
      <div className="winner"><p className="winner-label">Pessoa sorteada</p><div className="winner-name">{draw.participants[0]?.name}</div></div>
      <div className="result-actions"><span className="result-note">Sorteio de {formatDate(draw.date, true)}.</span><button className="copy-button" type="button" onClick={onCopy}>Copiar resultado</button></div>
    </>;
  }

  const groups = groupEntries(draw.participants);
  return <>
    <div className="group-list">
      {groups.map(([group, members]) => <section
        className="group-card"
        key={group}
        data-group={group}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          const participantId = event.dataTransfer.getData("text/plain");
          if (participantId) onMove(participantId, group);
        }}
      >
        <div className="group-title"><span>{group}</span><span className="group-size">{members.length} {members.length === 1 ? "pessoa" : "pessoas"}</span></div>
        <ul className="group-members">{members.map(person => <li
          className="draggable-person"
          draggable
          key={person.id}
          onDragStart={event => event.dataTransfer.setData("text/plain", String(person.id))}
          title="Arraste para outro grupo"
        >{person.name}</li>)}</ul>
      </section>)}
    </div>
    <div className="result-actions">
      <span className="result-note">Sorteio de {formatDate(draw.date, true)}. Arraste um nome para outro grupo para alterar o resultado.</span>
      <button className="copy-button" type="button" onClick={onCopy}>Copiar resultado</button>
    </div>
  </>;
}

function HistoryView({ draws, summary, onRefresh, onShowCurrent, onMove }) {
  const days = new Map();
  for (const draw of draws) {
    const day = new Date(draw.date).toLocaleDateString("pt-BR", { dateStyle: "full" });
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(draw);
  }

  return <section aria-labelledby="history-title">
    <section className="intro">
      <div><p className="eyebrow">Resultados registrados</p><h1 id="history-title">Histórico de sorteios</h1></div>
      <p className="subtitle">Consulte os sorteios por dia e acompanhe as mudanças feitas nos grupos.</p>
    </section>
    <div className="history-toolbar">
      <p>{summary}</p>
      <div className="toolbar-actions">
        <button className="copy-button" type="button" onClick={onShowCurrent}>Demonstrar último sorteio</button>
        <button className="icon-button" type="button" title="Atualizar histórico" aria-label="Atualizar histórico" onClick={onRefresh}><Icon name="refresh" /></button>
      </div>
    </div>
    <h2 className="panel-title history-title" id="history-changes">Sorteios registrados</h2>
    {!draws.length ? <p className="history-empty">Nenhum sorteio foi registrado ainda.</p> : [...days.entries()].map(([day, dayDraws]) => <section key={day}>
      <h3 className="history-day">{day}</h3>
      {dayDraws.map(draw => <article className="history-entry" key={draw.id}>
        <header className="history-entry-head">
          <strong>{draw.type === "individual" ? "Sorteio individual" : draw.type === "pairs" ? "Sorteio de duplas" : "Sorteio em grupos"} · {draw.total} participantes</strong>
          <time dateTime={draw.date}>{formatDate(draw.date, true)}</time>
        </header>
        <div className="history-entry-content">
          {groupEntries(draw.participants).map(([group, members]) => <div
            className="history-group"
            key={group}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              const participantId = event.dataTransfer.getData("text/plain");
              if (participantId) onMove(participantId, group);
            }}
          >
            <strong>{group}</strong>
            {members.map(person => <span
              key={person.id}
              className="draggable-person"
              draggable={draw.type !== "individual"}
              onDragStart={event => event.dataTransfer.setData("text/plain", String(person.id))}
            >{person.name}</span>)}
          </div>)}
        </div>
        {draw.changes?.length > 0 && <ul className="history-changes">{draw.changes.map(change => <li key={change.id}>{change.name}: {change.from || "sem grupo"} → {change.to} · {formatDate(change.date, true)}</li>)}</ul>}
      </article>)}
    </section>)}
  </section>;
}

export default function App() {
  const [names, setNames] = useState(() => readLocal(NAMES_KEY, ""));
  const [theme, setTheme] = useState(() => readLocal(THEME_KEY, "light"));
  const [mode, setMode] = useState("groups");
  const [groupCount, setGroupCount] = useState(2);
  const [draw, setDraw] = useState(null);
  const [draws, setDraws] = useState([]);
  const [view, setView] = useState("draw");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Verificando banco...");
  const noticeRef = useRef(null);
  const toastTimer = useRef(null);
  const people = names.split(/\r?\n/).map(name => name.trim()).filter(Boolean);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#151d19" : "#f4f7f5";
    try { localStorage.setItem(THEME_KEY, theme); } catch { }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem(NAMES_KEY, names); } catch { }
  }, [names]);

  useEffect(() => {
    const dialog = noticeRef.current;
    if (notice && !dialog.open) dialog.showModal();
    if (!notice && dialog.open) dialog.close();
  }, [notice]);

  useEffect(() => {
    api("/api/health").then(async () => {
      setConnectionStatus("SQL Server WK-245");
      setDraw(await api("/api/current"));
    }).catch(error => {
      setConnectionStatus("Banco indisponível");
      showToast(error.message);
    });
  }, []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  async function loadCurrent() {
    setDraw(await api("/api/current"));
  }

  async function loadHistory() {
    const result = await api("/api/history");
    setDraws(result);
    return result;
  }

  async function createDraw() {
    setError("");
    if (!people.length) {
      setError("Adicione pelo menos um nome para continuar.");
      return;
    }

    let participants = [];
    if (mode === "individual") {
      participants = [{ name: people[randomInt(people.length)], group: "Pessoa sorteada", order: 0 }];
    } else if (mode === "groups") {
      const count = Number(groupCount);
      if (!Number.isInteger(count) || count < 2) {
        setError("Informe pelo menos 2 grupos.");
        return;
      }
      if (count > people.length) {
        setError(`A quantidade de grupos não pode superar os ${people.length} participantes.`);
        return;
      }
      const groups = Array.from({ length: count }, () => []);
      shuffled(people).forEach((person, index) => groups[index % count].push(person));
      groups.forEach((members, groupIndex) => members.forEach(name => {
        participants.push({ name, group: `Grupo ${groupIndex + 1}`, order: participants.length });
      }));
    } else {
      if (people.length < 2) {
        setError("Adicione pelo menos 2 participantes para sortear duplas.");
        return;
      }
      const randomized = shuffled(people);
      for (let index = 0; index < randomized.length; index += 2) {
        const group = randomized.length - index === 1 ? "Sem dupla" : `Dupla ${Math.floor(index / 2) + 1}`;
        randomized.slice(index, index + 2).forEach(name => participants.push({ name, group, order: participants.length }));
      }
    }

    setSaving(true);
    try {
      await api("/api/draw", { method: "POST", body: JSON.stringify({ type: mode, total: people.length, participants }) });
      await loadCurrent();
      showToast("Sorteio salvo no banco de dados.");
      if (mode === "pairs" && people.length % 2) {
        setNotice({ title: "Alguém ficou sem dupla", message: `${participants.find(person => person.group === "Sem dupla").name} ficou sem dupla porque há uma quantidade ímpar de participantes.` });
      }
      if (mode === "groups") {
        const sizes = Array.from({ length: Number(groupCount) }, (_, index) => participants.filter(person => person.group === `Grupo ${index + 1}`).length);
        if (new Set(sizes).size > 1) setNotice({ title: "Grupos equilibrados", message: "Os grupos foram distribuídos da forma mais equilibrada possível." });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function moveParticipant(participantId, group) {
    try {
      const result = await api(`/api/participants/${participantId}/move`, { method: "PUT", body: JSON.stringify({ group }) });
      await loadCurrent();
      if (view === "history") await loadHistory();
      if (result.moved) showToast("Participante movido e alteração registrada.");
    } catch (requestError) {
      showToast(requestError.message);
    }
  }

  async function copyResult() {
    if (!draw) return;
    const text = draw.type === "individual"
      ? `Pessoa sorteada: ${draw.participants[0]?.name || ""}`
      : groupEntries(draw.participants).map(([group, members]) => `${group}\n${members.map(person => `• ${person.name}`).join("\n")}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Resultado copiado.");
    } catch {
      showToast("Não foi possível copiar o resultado neste navegador.");
    }
  }

  async function openHistory() {
    setView("history");
    try { await loadHistory(); } catch (requestError) { showToast(requestError.message); }
  }

  async function showCurrent() {
    try {
      await loadCurrent();
      setView("draw");
      document.getElementById("results-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (requestError) {
      showToast(requestError.message);
    }
  }

  const resultText = draw
    ? `${draw.total} participantes`
    : "";

  return <div className="shell">
    <header className="topbar">
      <a className="brand" href="#inicio" aria-label="Sorteio, início"><span className="brand-mark">S</span><span>Sorteio</span></a>
      <div className="topbar-tools"><span className="top-note">{connectionStatus}</span><button className="theme-button" type="button" aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} title="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} /></button></div>
    </header>
    <main>
      <div className="app-layout">
        <nav className="sidebar" aria-label="Menu principal">
          <p className="nav-caption">MENU</p>
          <div className="nav-section">
            <button className={`nav-item ${view === "draw" ? "active" : ""}`} type="button" aria-expanded={view === "draw"} onClick={() => setView("draw")}><Icon name="home" /><span>Sortear</span><Icon name="chevron" /></button>
            {view === "draw" && <div className="nav-children"><button className="nav-child" type="button" onClick={() => document.getElementById("setup-title")?.scrollIntoView({ behavior: "smooth" })}>Novo sorteio</button><button className="nav-child" type="button" onClick={() => document.getElementById("results-title")?.scrollIntoView({ behavior: "smooth" })}>Resultado atual</button></div>}
          </div>
          <div className="nav-section">
            <button className={`nav-item ${view === "history" ? "active" : ""}`} type="button" aria-expanded={view === "history"} onClick={openHistory}><Icon name="history" /><span>Histórico de sorteios</span><Icon name="chevron" /></button>
            {view === "history" && <div className="nav-children"><button className="nav-child" type="button" onClick={() => document.getElementById("history-title")?.scrollIntoView({ behavior: "smooth" })}>Todos os sorteios</button><button className="nav-child" type="button" onClick={() => document.getElementById("history-changes")?.scrollIntoView({ behavior: "smooth" })}>Alterações de grupos</button></div>}
          </div>
        </nav>
        <div className="app-content">
          {view === "draw" ? <>
            <section className="intro"><div><p className="eyebrow">A decisão fica por conta da sorte</p><h1>Sorte Lançada!</h1></div><p className="subtitle">Prepare os nomes, escolha o formato e deixe o sorteio embaralhar as possibilidades.</p></section>
            <div className="workspace">
              <section className="panel" aria-labelledby="setup-title">
                <div className="panel-head"><h2 className="panel-title" id="setup-title">Monte seu sorteio</h2><p className="panel-description">A lista fica neste dispositivo; os resultados são salvos no banco de dados.</p></div>
                <div className="panel-body">
                  <label className="field-label" htmlFor="names"><span>Participantes</span><span className="count">{people.length} {people.length === 1 ? "nome" : "nomes"}</span></label>
                  <textarea id="names" value={names} onChange={event => setNames(event.target.value)} placeholder="Digite ou cole os nomes, um por linha..." spellCheck="false" aria-describedby="names-hint" />
                  <div className="field-hint" id="names-hint"><span>Um nome por linha. Acentos e caracteres especiais são aceitos.</span><button className="text-button" type="button" onClick={() => setNames("")}>Limpar lista</button></div>
                  <fieldset className="mode-field"><legend className="mode-label">Como quer sortear?</legend><div className="mode-options">
                    {[{ value: "groups", title: "Em grupos", detail: "Dividir participantes" }, { value: "individual", title: "Individual", detail: "Sortear um nome" }, { value: "pairs", title: "Duplas", detail: "Formar pares" }].map(option => <label className="mode-option" key={option.value}><input type="radio" name="mode" value={option.value} checked={mode === option.value} onChange={() => { setMode(option.value); setError(""); }} /><span className="mode-card"><span className="radio-dot" aria-hidden="true" /><span className="mode-copy"><strong>{option.title}</strong><small>{option.detail}</small></span></span></label>)}
                  </div></fieldset>
                  {mode === "groups" ? <div className="group-field"><div className="group-copy"><label htmlFor="group-count">Quantidade de grupos</label><small>Os grupos ficam equilibrados, com diferença máxima de uma pessoa.</small></div><div className="number-wrap"><input id="group-count" type="number" min="2" max={Math.max(2, people.length)} value={groupCount} onChange={event => setGroupCount(event.target.value)} inputMode="numeric" /></div></div> : mode === "pairs" ? <div className="group-field pair-note"><div className="group-copy"><strong>Participante sem dupla</strong><small>Com uma quantidade ímpar, uma pessoa ficará sem dupla.</small></div></div> : null}
                  <p className="form-error" role="alert" aria-live="polite">{error}</p>
                  <button className="draw-button" type="button" disabled={!people.length || saving} onClick={createDraw}><Icon name="draw" />{saving ? "Salvando..." : "Sortear"}</button>
                </div>
              </section>
              <section className="panel results-panel" aria-labelledby="results-title">
                <div className="panel-head results-heading"><div><h2 className="panel-title" id="results-title">Resultado</h2><p className="panel-description">{draw ? `Sorteio de ${formatDate(draw.date, true)}.` : "Seu próximo resultado aparece aqui."}</p></div>{draw && <span className="result-count">{resultText}</span>}</div>
                <div className="result-content" aria-live="polite" aria-atomic="true"><ResultView draw={draw} onMove={moveParticipant} onCopy={copyResult} /></div>
              </section>
            </div>
            <p className="footnote">Sorteios e alterações ficam gravados no SQL Server WK-245.</p>
          </> : <HistoryView draws={draws} summary={`${draws.length} ${draws.length === 1 ? "sorteio registrado" : "sorteios registrados"}`} onRefresh={() => loadHistory().catch(requestError => showToast(requestError.message))} onShowCurrent={showCurrent} onMove={moveParticipant} />}
        </div>
      </div>
    </main>
    <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    <dialog className="notice-dialog" ref={noticeRef} aria-labelledby="notice-title" onClose={() => setNotice(null)}>
      {notice && <><h2 id="notice-title">{notice.title}</h2><p>{notice.message}</p><button className="notice-button" type="button" onClick={() => setNotice(null)}>Entendi</button></>}
    </dialog>
  </div>;
}