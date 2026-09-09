(() => {
  "use strict";
  const cfg = window.STELLAR_OPS_CONFIG;
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const app = document.querySelector("#app");
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const hydrateIcons = () => window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });

  function renderAuth(messageText = "") {
    app.innerHTML = `<main class="auth-shell" id="main"><section class="auth-brand" aria-labelledby="auth-brand-title"><div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Tellus Cooperative</div><div><span class="eyebrow" style="color:#f1a479">Operaciones</span><h1 id="auth-brand-title">Radar de contenido<br>Tellus.</h1></div></section><section class="auth-panel"><form class="auth-card" id="login-form"><span class="eyebrow">Acceso seguro</span><h2>Entrar al panel</h2><p>Usa tu cuenta autorizada por Tellus. Es la misma credencial que en Stellar Ops.</p><div class="field"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="email" required /></div><div class="field"><label for="password">Contraseña</label><div class="password-input"><input id="password" name="password" type="password" autocomplete="current-password" minlength="8" required /><button type="button" data-password-toggle="password" aria-label="Mostrar contraseña">${icon("eye")}</button></div></div><div class="auth-actions"><button class="button button-primary button-block" type="submit">${icon("log-in")} Entrar</button><a class="button button-ghost" href="?preview=1">Ver vista previa</a></div><div class="form-message" id="auth-message" role="alert">${messageText}</div></form></section></main>`;
    hydrateIcons();
    document.querySelector("[data-password-toggle]").addEventListener("click", () => { const input = document.querySelector("#password"); const button = document.querySelector("[data-password-toggle]"); const show = input.type === "password"; input.type = show ? "text" : "password"; button.innerHTML = icon(show ? "eye-off" : "eye"); button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña"); hydrateIcons(); input.focus(); });
    document.querySelector("#login-form").addEventListener("submit", signIn);
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#auth-message");
    message.textContent = "Verificando acceso…";
    const { error } = await client.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    if (error) message.textContent = "No pudimos iniciar sesión. Revisa tu correo y contraseña.";
  }

  async function openCatalog(session) {
    if (!session?.user) return;
    const response = await fetch("/merch/index.html", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("catalog_unavailable");
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    app.innerHTML = parsed.body.innerHTML;
    document.title = "Tellus Cooperative Merch";
  }

  async function checkSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await openCatalog(data.session);
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) openCatalog(session).catch(() => renderAuth("No pudimos cargar el archivo."));
    if (event === "SIGNED_OUT") renderAuth();
  });
  renderAuth();
  checkSession().catch(() => renderAuth("No pudimos verificar tu sesión."));
})();
