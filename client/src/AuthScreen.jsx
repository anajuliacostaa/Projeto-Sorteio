import { useRef, useState } from "react";

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function Field({ id, label, message, valid, checking, ...inputProps }) {
  return <div className="auth-field">
    <label className="field-label" htmlFor={id}>{label}</label>
    <input id={id} {...inputProps} />
    <p className={`auth-feedback ${valid ? "valid" : ""} ${checking ? "checking" : ""}`} aria-live="polite">{message || ""}</p>
  </div>;
}

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [messages, setMessages] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const usernameCheckId = useRef(0);

  function chooseMode(nextMode) {
    usernameCheckId.current += 1;
    setMode(nextMode);
    setMessages({});
    setUsernameStatus(null);
    setPassword("");
    setConfirmPassword("");
    setKeyword("");
  }

  async function checkUsername(event) {
    const candidate = event.currentTarget.value.trim();
    const checkId = ++usernameCheckId.current;
    setMessages(current => ({ ...current, username: "" }));
    if (!candidate) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus({ state: "checking", text: "Verificando usuário..." });
    try {
      const result = await api(`/api/auth/username?username=${encodeURIComponent(candidate)}`);
      if (checkId === usernameCheckId.current) {
        setUsernameStatus(result.exists
          ? { state: "invalid", text: "usuário já cadastrado" }
          : { state: "valid", text: "usuário válido" });
      }
    } catch (error) {
      if (checkId === usernameCheckId.current) setUsernameStatus({ state: "invalid", text: error.message });
    }
  }

  async function submit(event) {
    event.preventDefault();
    usernameCheckId.current += 1;
    setMessages({});
    if ((mode === "register" || mode === "forgot") && password !== confirmPassword) {
      setMessages({ confirmPassword: "as senhas não coincidem" });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const result = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });
        onAuthenticated(result.user);
      } else if (mode === "register") {
        const result = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ username, password, confirmPassword, keyword })
        });
        onAuthenticated(result.user);
      } else {
        await api("/api/auth/forgot", {
          method: "POST",
          body: JSON.stringify({ username, keyword, password, confirmPassword })
        });
        chooseMode("login");
        setMessages({ success: "Senha alterada. Entre com a nova senha." });
      }
    } catch (error) {
      const message = error.message;
      if (message === "Usuário não cadastrado.") setMessages({ username: "usuário não cadastrado" });
      else if (message === "Senha incorreta.") setMessages({ password: "senha incorreta" });
      else if (message === "Palavra-chave incorreta.") setMessages({ keyword: "palavra-chave incorreta" });
      else if (message === "Usuário já cadastrado.") {
        setUsernameStatus({ state: "invalid", text: "usuário já cadastrado" });
        setMessages({ username: "usuário já cadastrado" });
      } else setMessages({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  const isRegistration = mode === "register";
  const isForgot = mode === "forgot";
  const title = mode === "login" ? "A sorte começa aqui" : isRegistration ? "Criar uma conta" : "Recuperar senha";

  return <section className="auth-layout" aria-labelledby="auth-title">
    <div className="auth-copy">
      <p className="eyebrow">Sorte Lançada!</p>
      <h1 id="auth-title">{title}</h1>
      <p className="subtitle">{mode === "login" ? "Entre para preparar seus sorteios e consultar os resultados." : isRegistration ? "Seus dados ficam protegidos no banco de dados." : "Confirme seus dados para cadastrar uma nova senha."}</p>
    </div>
    <form className="panel auth-panel" onSubmit={submit}>
      <div className="panel-head">
        <h2 className="panel-title">{mode === "login" ? "Entrar" : isRegistration ? "Cadastro inicial" : "Redefinir senha"}</h2>
        <p className="panel-description">{mode === "login" ? "Informe seu usuário e senha." : isRegistration ? "Preencha os dados para acessar o sorteador." : "A palavra-chave valida sua identidade."}</p>
      </div>
      <div className="panel-body auth-fields">
        <Field id="auth-username" label="Nome de usuário" value={username} autoComplete="username" maxLength={100} disabled={submitting} onChange={event => { usernameCheckId.current += 1; setUsername(event.target.value); setUsernameStatus(null); setMessages({}); }} onBlur={isRegistration ? checkUsername : undefined} message={isRegistration && usernameStatus?.state === "checking" ? usernameStatus.text : messages.username || (isRegistration ? usernameStatus?.text : "")} valid={isRegistration && usernameStatus?.state === "valid"} checking={isRegistration && usernameStatus?.state === "checking"} required />
        {isForgot && <Field id="auth-keyword" label="Palavra-chave" type="text" value={keyword} autoComplete="off" maxLength={256} disabled={submitting} onChange={event => { setKeyword(event.target.value); setMessages({}); }} message={messages.keyword} required />}
        <Field id="auth-password" label={isForgot ? "Nova senha" : "Senha"} type="password" value={password} autoComplete={isRegistration ? "new-password" : "current-password"} maxLength={256} disabled={submitting} onChange={event => { setPassword(event.target.value); setMessages({}); }} message={messages.password} required />
        {(isRegistration || isForgot) && <Field id="auth-confirm-password" label="Confirmação de senha" type="password" value={confirmPassword} autoComplete="new-password" maxLength={256} disabled={submitting} onChange={event => { setConfirmPassword(event.target.value); setMessages({}); }} message={messages.confirmPassword} required />}
        {isRegistration && <Field id="auth-register-keyword" label="Palavra-chave para recuperação" type="text" value={keyword} autoComplete="off" maxLength={256} disabled={submitting} onChange={event => setKeyword(event.target.value)} message={messages.keyword} required />}
        {messages.form && <p className="form-error" role="alert">{messages.form}</p>}
        {messages.success && <p className="auth-feedback valid" role="status">{messages.success}</p>}
        <button className="draw-button" type="submit" disabled={submitting}>{submitting ? "Aguarde..." : mode === "login" ? "Entrar" : isRegistration ? "Cadastrar" : "Alterar senha"}</button>
        <div className="auth-links">
          {mode === "login" && <><button className="text-button" type="button" disabled={submitting} onClick={() => chooseMode("register")}>Criar conta</button><button className="text-button" type="button" disabled={submitting} onClick={() => chooseMode("forgot")}>Esqueci a senha</button></>}
          {(isRegistration || isForgot) && <button className="text-button" type="button" disabled={submitting} onClick={() => chooseMode("login")}>Voltar para entrar</button>}
        </div>
      </div>
    </form>
  </section>;
}

export function ProfileView({ user, onUpdated, showToast }) {
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      const result = await api("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ username, currentPassword, password })
      });
      onUpdated(result.user);
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      showToast("Perfil atualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby="profile-title">
    <section className="intro">
      <div><p className="eyebrow">Sua conta</p><h1 id="profile-title">Meu perfil</h1></div>
      <p className="subtitle">Atualize seu nome de usuário ou altere sua senha.</p>
    </section>
    <form className="panel profile-panel" onSubmit={submit}>
      <div className="panel-head"><h2 className="panel-title">Dados da conta</h2><p className="panel-description">As alterações são salvas no banco de dados.</p></div>
      <div className="panel-body auth-fields">
        <Field id="profile-username" label="Nome de usuário" value={username} autoComplete="username" maxLength={100} onChange={event => setUsername(event.target.value)} required />
        <Field id="profile-current-password" label="Senha atual (necessária para alterar a senha)" type="password" value={currentPassword} autoComplete="current-password" maxLength={256} onChange={event => setCurrentPassword(event.target.value)} />
        <Field id="profile-password" label="Nova senha" type="password" value={password} autoComplete="new-password" maxLength={256} onChange={event => setPassword(event.target.value)} />
        <Field id="profile-confirm-password" label="Confirmação da nova senha" type="password" value={confirmPassword} autoComplete="new-password" maxLength={256} onChange={event => setConfirmPassword(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="draw-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
      </div>
    </form>
  </section>;
}