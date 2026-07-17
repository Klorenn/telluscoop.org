(() => {
  "use strict";

  const cfg = window.SOCIAL_OPS_CONFIG;
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const $app = document.querySelector("#app");
  const PREVIEW = new URLSearchParams(location.search).get("preview") === "1";

  const platformLabels = { x: "X", linkedin: "LinkedIn", instagram: "Instagram" };
  const repoStatusLabels = { inbox: "Bandeja", reviewed: "Revisado", shared: "Compartido", discarded: "Descartado" };
  const articleStatusLabels = { draft: "Borrador", approved: "Aprobado", published: "Publicado", discarded: "Descartado" };
  const categoryLabels = {
    "ai-dev-news": "IA / Dev news", memes: "Memes", saas: "SaaS", "micro-apps": "Micro apps",
    "mobile-apps": "Mobile apps", distribution: "Distribución", "internet-business": "Internet business",
    shipping: "Rapid shipping", "ai-coding": "AI coding", seo: "SEO", launch: "Lanzamientos",
    "startup-ideas": "Ideas de startups", audience: "Audiencia", "indie-legend": "Indie legend",
    repos: "Repositorios", "tellus-own": "Tellus (propia)", general: "General",
  };

  const state = {
    session: null, preview: PREVIEW, view: "feed",
    org: null, accounts: [], posts: [], repos: [],
    filters: { platform: "", category: "", search: "" },
    repoResults: [], repoQuery: "", repoBusy: false,
    repoPostDraft: null, repoPostBusy: false,
    prompts: [], articles: [], drafts: [], articleBusy: false,
    articleForm: { prompt_key: "crypto", count: 1, prompt_md: "" },
    topics: [], topicBusy: false,
    memes: { query: "", busy: false, info: null, gifs: [] },
  };

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const fmtDate = (value) => value ? new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "Sin fecha";
  const fmtNum = (value) => new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const hydrateIcons = () => window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
  const categoryLabel = (value) => categoryLabels[value] || value || "General";

  const notify = (message, isError = false) => {
    document.querySelector(".notice")?.remove();
    const el = document.createElement("div");
    el.className = `notice${isError ? " error" : ""}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  };

  function accountById(id) { return state.accounts.find((a) => a.id === id); }
  function accountByHandle(handle, platform) {
    const clean = String(handle || "").replace(/^@/, "").toLowerCase();
    return state.accounts.find((a) => a.platform === platform && a.handle.toLowerCase() === clean);
  }

  function filteredPosts() {
    const { platform, category, search } = state.filters;
    const term = search.trim().toLowerCase();
    return state.posts.filter((post) => {
      if (platform && post.platform !== platform) return false;
      if (category) {
        const account = accountById(post.account_id);
        if ((account?.category || "general") !== category) return false;
      }
      if (term && !`${post.author_handle} ${post.content}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }

  // ---------- auth ----------

  function wirePasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
      const input = document.querySelector(`#${button.dataset.passwordToggle}`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.innerHTML = icon(show ? "eye-off" : "eye");
      button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
      hydrateIcons();
      input.focus();
    }));
  }

  function renderLoading() {
    $app.innerHTML = `<main aria-busy="true" aria-labelledby="loading-title" style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f4ed;color:#183034;font-family:Inter,system-ui,sans-serif"><section style="width:min(420px,100%);padding:28px;border:1px solid #d9d2c7;border-radius:18px;background:#fffdf8;box-shadow:0 12px 32px rgba(24,48,52,.08)"><span style="display:block;color:#c75a2a;font:600 12px/1.2 monospace;letter-spacing:.12em;text-transform:uppercase">Tellus Cooperative</span><h1 id="loading-title" style="margin:10px 0 8px;font:600 30px/1.1 Georgia,serif">Social Ops</h1><p style="margin:0 0 22px;color:#607276;line-height:1.5">Preparando tu radar de contenido…</p><div style="display:flex;align-items:center;gap:10px;color:#607276;font-size:14px"><span aria-hidden="true" style="display:block;width:20px;height:20px;flex:0 0 20px;border:2px solid #d9d2c7;border-top-color:#2f7478;border-radius:50%;animation:spin .8s linear infinite"></span><span>Cargando datos</span></div></section></main>`;
  }

  function renderAuth() {
    $app.innerHTML = `
      <main class="auth-shell" id="main">
        <section class="auth-brand" aria-labelledby="auth-brand-title">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Tellus Cooperative</div>
          <div><span class="eyebrow" style="color:#f1a479">Operaciones</span><h1 id="auth-brand-title">Radar de contenido Tellus.</h1></div>
        </section>
        <section class="auth-panel">
          <form class="auth-card" id="login-form">
            <span class="eyebrow">Acceso seguro</span><h2>Entrar al panel</h2><p>Usa tu cuenta autorizada por Tellus. Es la misma credencial que en Stellar Ops.</p>
            <div class="field"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="email" required /></div>
            <div class="field"><label for="password">Contraseña</label><div class="password-input"><input id="password" name="password" type="password" autocomplete="current-password" required /><button type="button" data-password-toggle="password" aria-label="Mostrar contraseña">${icon("eye")}</button></div></div>
            <div class="auth-actions">
              <button class="button button-primary button-block" type="submit">${icon("log-in")} Entrar</button>
              <a class="button button-ghost" href="?preview=1">Ver vista previa</a>
            </div><div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    hydrateIcons();
    wirePasswordToggles();
    document.querySelector("#login-form").addEventListener("submit", signIn);
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#auth-message");
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.email.value).trim().toLowerCase(),
      password: String(form.password.value),
    });
    if (error) {
      if (message) message.textContent = "No pudimos iniciar sesión. Revisá tus credenciales.";
      return;
    }
    await boot();
  }

  // ---------- data ----------

  async function loadLiveData() {
    const safe = async (query) => { try { return await query; } catch { return { data: [], error: null }; } };
    const [orgs, accounts, posts, repos, prompts, articles, topics] = await Promise.all([
      safe(supabase.from("organizations").select("id, name, slug").limit(1)),
      safe(supabase.from("social_accounts").select("*").order("category").order("handle")),
      safe(supabase.from("social_posts").select("*").order("posted_at", { ascending: false, nullsFirst: false }).limit(300)),
      safe(supabase.from("repo_picks").select("*").order("created_at", { ascending: false })),
      safe(supabase.from("article_prompts").select("*").eq("active", true).order("key")),
      safe(supabase.from("articles").select("*").order("created_at", { ascending: false }).limit(100)),
      safe(supabase.from("social_topics").select("*").order("label")),
    ]);
    const critical = [orgs, accounts, posts].find((r) => r.error);
    if (critical) throw critical.error;
    state.org = orgs.data[0] || null;
    state.accounts = accounts.data;
    state.posts = posts.data;
    state.repos = repos.data || [];
    state.prompts = prompts.data || [];
    state.articles = articles.data || [];
    state.topics = topics.data || [];
    if (state.prompts[0]) state.articleForm.prompt_key = state.prompts[0].key;
  }

  async function invokeEdge(name, body) {
    const invoke = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return supabase.functions.invoke(name, {
        body,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
    };
    let result = await invoke();
    if (result.error?.context?.status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) result = await invoke();
    }
    // On non-2xx, supabase-js leaves data null; recover the function's JSON body
    // so callers can show the real error instead of a generic message.
    if (result.error && !result.data && result.error.context?.clone) {
      try { result = { ...result, data: await result.error.context.clone().json() }; } catch { /* body not JSON */ }
    }
    return result;
  }

  function loadPreviewData() {
    state.org = { id: "preview-org", name: "Vista previa", slug: "tellus" };
    state.accounts = [
      { id: "a1", platform: "x", handle: "midudev", display_name: "Miguel Ángel Durán", category: "ai-dev-news", active: true },
      { id: "a2", platform: "x", handle: "levelsio", display_name: "Pieter Levels", category: "internet-business", active: true },
      { id: "a3", platform: "x", handle: "dev_gen88926", display_name: "Dev Gen", category: "memes", active: true },
    ];
    state.posts = [
      { id: "p1", account_id: "a1", platform: "x", author_handle: "midudev", content: "Ha salido Kimi K3. Se siente como un nuevo momento DeepSeek para el mundo de la IA.", url: "https://x.com/midudev/status/1", posted_at: new Date().toISOString(), likes: 4200, reposts: 610, replies: 180, views: 520000, source: "manual", tags: [] },
      { id: "p2", account_id: "a2", platform: "x", author_handle: "levelsio", content: "Ship fast. Charge money. Talk to users.", url: "https://x.com/levelsio/status/2", posted_at: new Date(Date.now() - 864e5).toISOString(), likes: 9800, reposts: 1200, replies: 340, views: 1200000, source: "manual", tags: [] },
    ];
    state.repos = [
      { id: "r1", repo_full_name: "D4Vinci/Scrapling", url: "https://github.com/D4Vinci/Scrapling", description: "Undetectable, powerful, flexible web scraping for Python", stars: 12400, language: "Python", status: "inbox", topics: ["scraping"] },
    ];
    state.prompts = [
      { id: "pr1", key: "crypto", name: "Cripto diario (Beehiiv)", prompt_md: "Escribe una nota diaria de noticias cripto en español LATAM, con la voz editorial de Tellus…", active: true },
      { id: "pr2", key: "ai", name: "IA diario (Beehiiv)", prompt_md: "Escribe una nota diaria de noticias de IA en español LATAM, con la voz editorial de Tellus…", active: true },
    ];
    state.topics = [
      { id: "pt-1", label: "Stellar", query: "Stellar OR Soroban lang:es", active: true, last_run_at: new Date().toISOString() },
      { id: "pt-2", label: "Agentes IA", query: '"AI agents" OR "agentes de IA"', active: true, last_run_at: null },
    ];
    state.articles = [
      { id: "ar1", prompt_key: "crypto", title: "Bitcoin sube tras dato de inflación", subtitle: "El mercado reacciona al IPC de EE.UU., un exchange anuncia licencia en Brasil y la minería marca récord.", summary: ["El IPC bajó y el mercado cripto respiró: por qué importa para LATAM.", "Un exchange sumó licencia regional: más acceso, más competencia."], body_md: "## Qué pasó\n\nEl dato de inflación…\n\n## Por qué importa\n\nPara la región…\n\n## Cierre Tellus\n\nQuién controla la infraestructura…", sources: [{ url: "https://example.com/ipc", title: "Comunicado oficial" }], model: "gemini-3.5-flash", status: "draft", created_at: new Date().toISOString() },
    ];
    state.articleForm.prompt_key = "crypto";
  }

  // ---------- shell ----------

  function navButton(view, iconName, label) {
    return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${icon(iconName)} ${label}</button>`;
  }

  function renderShell() {
    $app.innerHTML = `
      ${state.preview ? `<div class="preview-banner">Vista previa con datos de ejemplo — sin conexión a datos reales</div>` : ""}
      <div class="shell">
        <aside class="sidebar">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Social Ops</div>
          <nav aria-label="Secciones">
            ${navButton("feed", "rss", "Feed")}
            ${navButton("accounts", "users", "Cuentas")}
            ${navButton("repos", "github", "Repos")}
            ${navButton("articles", "newspaper", "Artículos")}
            ${navButton("memes", "image", "Memes")}
          </nav>
          <div class="sidebar-foot">
            <span>${esc(state.preview ? "Vista previa" : state.session?.user?.email || "")}</span>
            ${state.preview ? "" : `<button class="button button-ghost button-block" id="signout">${icon("log-out")} Salir</button>`}
          </div>
        </aside>
        <main class="main" id="main">${renderView()}</main>
      </div>`;
    hydrateIcons();
    wireShell();
  }

  function renderView() {
    return state.view === "accounts" ? accountsView()
      : state.view === "repos" ? reposView()
      : state.view === "articles" ? articlesView()
      : state.view === "memes" ? memesView()
      : feedView();
  }

  function wireShell() {
    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderShell();
    }));
    document.querySelector("#signout")?.addEventListener("click", async () => { await supabase.auth.signOut(); location.reload(); });
    if (state.view === "feed") wireFeed();
    if (state.view === "accounts") wireAccounts();
    if (state.view === "repos") wireRepos();
    if (state.view === "articles") wireArticles();
    if (state.view === "memes") wireMemes();
  }

  // ---------- feed ----------

  function feedView() {
    const posts = filteredPosts();
    const categories = [...new Set(state.accounts.map((a) => a.category || "general"))].sort();
    return `
      <div class="toolbar"><div><span class="eyebrow">${esc(state.org?.name || "")}</span><h2>Feed por temas</h2></div></div>

      <section class="card" style="margin-bottom:1.2rem">
        <h3>Buscar un tema en X</h3>
        <p style="color:var(--muted);margin:.2rem 0 .8rem;line-height:1.5">Escribí un tema y traé los posts al instante. Se guardan en el feed para que los revises.</p>
        <form id="topic-search-form" class="form-grid">
          <div class="field span-all"><label for="topic-query">Tema</label>
            <input id="topic-query" name="query" placeholder='ej: Kimi K3   ·   Stellar lang:es   ·   "AI agents"' required /></div>
          <details class="span-all" style="margin-bottom:.6rem"><summary style="cursor:pointer;color:var(--muted);font-size:.78rem">Query ID de X (si cambió, actualizalo acá)</summary><div class="field" style="margin-top:.5rem"><label for="topic-qid">X_QID_SEARCH</label><input id="topic-qid" name="qid" placeholder="AQK...abc123" value="${esc(localStorage.getItem("x_qid_search") || "")}" /><small>Capturalo de la Network tab de x.com → SearchTimeline → el hash de la URL.</small></div></details>
          <div class="form-foot span-all">
            <label style="display:flex;align-items:center;gap:.4rem;color:var(--muted);font-size:.85rem">
              <input type="checkbox" id="topic-save" style="min-height:auto;width:auto" /> Guardar como tema fijo (cron cada 6h)</label>
            <button class="button button-primary" type="submit" ${state.topicBusy || state.preview ? "disabled" : ""}>${icon("search")} ${state.topicBusy ? "Buscando…" : "Buscar ahora"}</button>
          </div>
        </form>
      </section>

      ${(state.topics || []).length ? `<section class="card" style="margin-bottom:1.2rem">
        <h3>Temas fijos</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Tema</th><th>Query</th><th>Última búsqueda</th><th></th></tr></thead>
          <tbody>${state.topics.map((topic) => `<tr>
            <td><strong>${esc(topic.label)}</strong>${topic.active ? "" : ` <span class="chip">pausado</span>`}</td>
            <td style="color:var(--muted)">${esc(topic.query)}</td>
            <td>${topic.last_run_at ? fmtDate(topic.last_run_at) : "Nunca"}</td>
            <td>${state.preview ? "" : `<button class="table-link" data-run-topic="${esc(topic.id)}" ${state.topicBusy ? "disabled" : ""}>${icon("search")} Buscar ahora</button>
              <button class="table-link" data-toggle-topic="${esc(topic.id)}" style="margin-top:.3rem">${topic.active ? "Pausar" : "Activar"}</button>
              <button class="table-link" data-delete-topic="${esc(topic.id)}" style="margin-top:.3rem;color:var(--red)">Borrar</button>`}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>` : ""}

      <div class="filters">
        <select id="filter-platform" aria-label="Plataforma">
          <option value="">Todas las plataformas</option>
          ${Object.entries(platformLabels).map(([value, label]) => `<option value="${value}" ${state.filters.platform === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <select id="filter-category" aria-label="Categoría">
          <option value="">Todas las categorías</option>
          ${categories.map((c) => `<option value="${esc(c)}" ${state.filters.category === c ? "selected" : ""}>${esc(categoryLabel(c))}</option>`).join("")}
        </select>
        <input id="filter-search" type="search" placeholder="Filtrar texto o autor…" value="${esc(state.filters.search)}" aria-label="Filtrar" />
      </div>
      ${posts.length ? `<div class="grid grid-2">${posts.map(postCard).join("")}</div>`
        : `<div class="empty">Sin publicaciones todavía. Buscá un tema arriba para llenar el feed.</div>`}

      <details style="margin-top:1.4rem">
        <summary style="cursor:pointer;color:var(--muted);font-weight:600">Captura manual (opcional)</summary>
        <section class="card" style="margin-top:.8rem">
          <form id="post-form" class="form-grid">
            <div class="field"><label for="post-platform">Plataforma</label>
              <select id="post-platform" name="platform" required>${Object.entries(platformLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
            <div class="field"><label for="post-author">Autor (@handle)</label><input id="post-author" name="author" required placeholder="midudev" /></div>
            <div class="field"><label for="post-url">URL</label><input id="post-url" name="url" type="url" placeholder="https://x.com/…" /></div>
            <div class="field"><label for="post-date">Fecha</label><input id="post-date" name="posted_at" type="datetime-local" /></div>
            <div class="field span-all"><label for="post-content">Contenido</label><textarea id="post-content" name="content" required placeholder="Texto del post…"></textarea></div>
            <div class="field"><label for="post-likes">Likes</label><input id="post-likes" name="likes" type="number" min="0" value="0" /></div>
            <div class="field"><label for="post-reposts">Reposts</label><input id="post-reposts" name="reposts" type="number" min="0" value="0" /></div>
            <div class="field"><label for="post-replies">Respuestas</label><input id="post-replies" name="replies" type="number" min="0" value="0" /></div>
            <div class="field"><label for="post-views">Vistas</label><input id="post-views" name="views" type="number" min="0" value="0" /></div>
            <div class="form-foot span-all"><button class="button button-secondary" type="submit">Guardar manual</button></div>
          </form>
        </section>
      </details>`;
  }

  function postCard(post) {
    const account = accountById(post.account_id);
    return `<article class="card post-card">
      <div class="post-head">
        <div><span class="post-author">@${esc(post.author_handle)}</span>
          ${account ? ` <span class="chip">${esc(categoryLabel(account.category))}</span>` : ""}</div>
        <span class="chip chip-platform-${esc(post.platform)}">${esc(platformLabels[post.platform] || post.platform)}</span>
      </div>
      <p class="post-content">${esc(post.content)}</p>
      <div class="post-stats">
        <span title="Likes">♥ ${fmtNum(post.likes)}</span><span title="Reposts">⇄ ${fmtNum(post.reposts)}</span>
        <span title="Respuestas">💬 ${fmtNum(post.replies)}</span><span title="Vistas">👁 ${fmtNum(post.views)}</span>
      </div>
      <div class="post-meta"><span>${fmtDate(post.posted_at)}</span><span>${post.source === "scraper" ? "Capturado automático" : "Captura manual"}</span></div>
      <div class="post-actions">
        ${post.url ? `<a class="table-link" href="${esc(post.url)}" target="_blank" rel="noopener">${icon("external-link")} Ver original</a>` : ""}
        ${state.preview ? "" : `<button class="table-link" data-delete-post="${esc(post.id)}" style="color:var(--red)">${icon("trash-2")} Borrar</button>`}
      </div>
    </article>`;
  }

  function wireFeed() {
    const rerender = () => renderShell();
    document.querySelector("#filter-platform")?.addEventListener("change", (e) => { state.filters.platform = e.target.value; rerender(); });
    document.querySelector("#filter-category")?.addEventListener("change", (e) => { state.filters.category = e.target.value; rerender(); });
    document.querySelector("#filter-search")?.addEventListener("input", (e) => {
      state.filters.search = e.target.value;
      clearTimeout(wireFeed._t); wireFeed._t = setTimeout(rerender, 350);
    });
    document.querySelector("#post-form")?.addEventListener("submit", savePost);
    document.querySelectorAll("[data-delete-post]").forEach((button) => button.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta publicación?")) return;
      const { error } = await supabase.from("social_posts").delete().eq("id", button.dataset.deletePost);
      if (error) return notify("No se pudo borrar.", true);
      state.posts = state.posts.filter((p) => p.id !== button.dataset.deletePost);
      renderShell();
    }));
    document.querySelector("#topic-search-form")?.addEventListener("submit", runTopicSearch);
    document.querySelectorAll("[data-run-topic]").forEach((b) => b.addEventListener("click", () => runTopicSearchById(b.dataset.runTopic)));
    document.querySelectorAll("[data-toggle-topic]").forEach((b) => b.addEventListener("click", () => toggleTopic(b.dataset.toggleTopic)));
    document.querySelectorAll("[data-delete-topic]").forEach((b) => b.addEventListener("click", () => deleteTopic(b.dataset.deleteTopic)));
  }

  async function runTopicSearch(event) {
    event.preventDefault();
    if (state.preview || state.topicBusy) return;
    const form = new FormData(event.target);
    const query = String(form.get("query")).trim();
    const saveAsTopic = document.querySelector("#topic-save")?.checked;
    const qid = String(form.get("qid") || "").trim();
    if (qid) localStorage.setItem("x_qid_search", qid);
    if (!query) return;
    state.topicBusy = true;
    renderShell();
    const { data, error } = await invokeEdge("x-search", { query, count: 20, qid });
    state.topicBusy = false;
    if (error || data?.error) { notify(data?.error || error?.message || "No se pudo buscar.", true); renderShell(); return; }
    if (saveAsTopic) {
      const label = query.length > 40 ? query.slice(0, 40) + "…" : query;
      const { error: topicError } = await supabase.from("social_topics").insert({ organization_id: state.org.id, label, query, active: true });
      if (topicError) notify("Post guardados, pero no se pudo crear el tema: " + topicError.message, true);
    }
    notify(`${data.saved || 0} posts capturados de "${query}"`);
    await loadLiveData();
    renderShell();
  }

  async function runTopicSearchById(topicId) {
    if (state.topicBusy) return;
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) return;
    state.topicBusy = true;
    renderShell();
    const qid = localStorage.getItem("x_qid_search") || "";
    const { data, error } = await invokeEdge("x-search", { query: topic.query, count: 20, qid });
    state.topicBusy = false;
    if (error || data?.error) { notify(data?.error || error?.message || "No se pudo buscar.", true); renderShell(); return; }
    await supabase.from("social_topics").update({ last_run_at: new Date().toISOString() }).eq("id", topicId);
    notify(`${data.saved || 0} posts capturados de "${topic.label}"`);
    await loadLiveData();
    renderShell();
  }

  async function toggleTopic(topicId) {
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) return;
    const { error } = await supabase.from("social_topics").update({ active: !topic.active }).eq("id", topicId);
    if (error) return notify("No se pudo actualizar.", true);
    topic.active = !topic.active;
    renderShell();
  }

  async function deleteTopic(topicId) {
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic || !confirm(`¿Borrar el tema "${topic.label}"?`)) return;
    const { error } = await supabase.from("social_topics").delete().eq("id", topicId);
    if (error) return notify("No se pudo borrar.", true);
    state.topics = state.topics.filter((t) => t.id !== topicId);
    renderShell();
  }

  async function savePost(event) {
    event.preventDefault();
    if (state.preview) return notify("La vista previa es de solo lectura.", true);
    const form = new FormData(event.target);
    const platform = String(form.get("platform"));
    const author = String(form.get("author")).replace(/^@/, "").trim();
    const account = accountByHandle(author, platform);
    const row = {
      organization_id: state.org.id,
      account_id: account?.id || null,
      platform,
      author_handle: author,
      url: String(form.get("url")).trim() || null,
      content: String(form.get("content")).trim(),
      posted_at: form.get("posted_at") ? new Date(String(form.get("posted_at"))).toISOString() : null,
      likes: Number(form.get("likes")) || 0,
      reposts: Number(form.get("reposts")) || 0,
      replies: Number(form.get("replies")) || 0,
      views: Number(form.get("views")) || 0,
      source: "manual",
      created_by: state.session?.user?.id || null,
    };
    const { data, error } = await supabase.from("social_posts").insert(row).select().single();
    if (error) return notify(error.code === "23505" ? "Esa URL ya está capturada." : "No se pudo guardar la publicación.", true);
    state.posts.unshift(data);
    notify("Publicación capturada.");
    renderShell();
  }

  // ---------- accounts ----------

  function accountsView() {
    return `
      <div class="toolbar"><div><span class="eyebrow">Cuentas observadas</span><h2>Cuentas</h2></div></div>
      <section class="card" style="margin-bottom:1.2rem">
        <h3>Agregar cuenta</h3>
        <form id="account-form" class="form-grid">
          <div class="field"><label for="acc-platform">Plataforma</label>
            <select id="acc-platform" name="platform" required>${Object.entries(platformLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
          <div class="field"><label for="acc-handle">Handle</label><input id="acc-handle" name="handle" required placeholder="sin @" /></div>
          <div class="field"><label for="acc-name">Nombre</label><input id="acc-name" name="display_name" /></div>
          <div class="field"><label for="acc-category">Categoría</label>
            <select id="acc-category" name="category">${Object.entries(categoryLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
          <div class="form-foot span-all"><button class="button button-primary" type="submit">Agregar</button></div>
        </form>
      </section>
      <div class="card table-wrap"><table>
        <thead><tr><th>Cuenta</th><th>Plataforma</th><th>Categoría</th><th>Estado</th><th></th></tr></thead>
        <tbody>${state.accounts.map((account) => `<tr>
          <td><strong>@${esc(account.handle)}</strong><br /><span style="color:var(--muted)">${esc(account.display_name || "")}</span></td>
          <td><span class="chip chip-platform-${esc(account.platform)}">${esc(platformLabels[account.platform] || account.platform)}</span></td>
          <td>${esc(categoryLabel(account.category))}</td>
          <td>${account.active ? "Activa" : "Pausada"}</td>
          <td>${state.preview ? "" : `<button class="table-link" data-toggle-account="${esc(account.id)}">${account.active ? "Pausar" : "Activar"}</button>`}</td>
        </tr>`).join("")}</tbody>
      </table></div>`;
  }

  function wireAccounts() {
    document.querySelector("#account-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.preview) return notify("La vista previa es de solo lectura.", true);
      const form = new FormData(event.target);
      const row = {
        organization_id: state.org.id,
        platform: String(form.get("platform")),
        handle: String(form.get("handle")).replace(/^@/, "").trim(),
        display_name: String(form.get("display_name")).trim() || null,
        category: String(form.get("category")) || "general",
      };
      row.url = row.platform === "x" ? `https://x.com/${row.handle}` : null;
      const { data, error } = await supabase.from("social_accounts").insert(row).select().single();
      if (error) return notify(error.code === "23505" ? "Esa cuenta ya existe." : "No se pudo agregar la cuenta.", true);
      state.accounts.push(data);
      notify("Cuenta agregada.");
      renderShell();
    });
    document.querySelectorAll("[data-toggle-account]").forEach((button) => button.addEventListener("click", async () => {
      const account = accountById(button.dataset.toggleAccount);
      const { error } = await supabase.from("social_accounts").update({ active: !account.active }).eq("id", account.id);
      if (error) return notify("No se pudo actualizar.", true);
      account.active = !account.active;
      renderShell();
    }));
  }

  // ---------- repos ----------

  function reposView() {
    return `
      <div class="toolbar"><div><span class="eyebrow">GitHub</span><h2>Buscador de repositorios</h2></div></div>
      <section class="card" style="margin-bottom:1.2rem">
        <form id="repo-form" class="form-grid">
          <div class="field span-all"><label for="repo-q">Búsqueda</label>
            <input id="repo-q" name="q" value="${esc(state.repoQuery)}" placeholder="ej: scraping language:python stars:>500" /></div>
          <div class="form-foot span-all">
            <button class="button button-secondary" type="button" id="repo-trending">Trending del mes</button>
            <button class="button button-primary" type="submit" ${state.repoBusy ? "disabled" : ""}>Buscar</button>
          </div>
        </form>
      </section>
      ${state.repoPostDraft ? repoPostPanel(state.repoPostDraft) : ""}
      ${state.repoResults.length ? `<div class="grid grid-2" style="margin-bottom:1.4rem">${state.repoResults.map(repoResultCard).join("")}</div>` : ""}
      <div class="toolbar"><div><span class="eyebrow">Guardados</span><h2>Repos elegidos</h2></div></div>
      ${state.repos.length ? `<div class="card table-wrap"><table>
        <thead><tr><th>Repo</th><th>Stars</th><th>Lenguaje</th><th>Estado</th><th></th></tr></thead>
        <tbody>${state.repos.map((repo) => `<tr>
          <td><a class="table-link" href="${esc(repo.url)}" target="_blank" rel="noopener"><strong>${esc(repo.repo_full_name)}</strong></a><br />
            <span style="color:var(--muted)">${esc(repo.description || "")}</span></td>
          <td>★ ${fmtNum(repo.stars)}</td>
          <td>${esc(repo.language || "—")}</td>
          <td><span class="status status-${esc(repo.status)}">${esc(repoStatusLabels[repo.status] || repo.status)}</span></td>
          <td>${state.preview ? "" : `<button class="table-link" data-post-repo-saved="${esc(repo.id)}" ${state.repoPostBusy ? "disabled" : ""}>${icon("sparkles")} Post X</button>
          <select data-repo-status="${esc(repo.id)}" aria-label="Cambiar estado" style="margin-top:.4rem">
            ${Object.entries(repoStatusLabels).map(([value, label]) => `<option value="${value}" ${repo.status === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>`}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty">Todavía no guardaste repos. Buscá arriba y presioná “Guardar”.</div>`}`;
  }

  function repoResultCard(repo) {
    const saved = state.repos.some((r) => r.repo_full_name === repo.full_name);
    return `<article class="card">
      <h3><a class="table-link" href="${esc(repo.html_url)}" target="_blank" rel="noopener">${esc(repo.full_name)}</a></h3>
      <p style="color:var(--muted);margin:.2rem 0 .7rem;line-height:1.5">${esc(repo.description || "Sin descripción")}</p>
      <div class="post-stats"><span>★ ${fmtNum(repo.stargazers_count)}</span><span>${esc(repo.language || "—")}</span><span>${fmtDate(repo.pushed_at)}</span></div>
      <div class="form-foot" style="justify-content:start">
        ${saved ? `<span class="chip">Ya guardado</span>` : state.preview ? "" : `<button class="button button-secondary" data-save-repo="${esc(repo.full_name)}" style="min-height:38px">Guardar</button>`}
        ${state.preview ? "" : `<button class="button button-primary" data-post-repo-result="${esc(repo.full_name)}" style="min-height:38px" ${state.repoPostBusy ? "disabled" : ""}>${icon("sparkles")} ${state.repoPostBusy ? "Generando…" : "Crear post X"}</button>`}
      </div>
    </article>`;
  }

  function repoPostPanel(draft) {
    const hashtags = (draft.summary || []).join(" ");
    const text = [draft.body_md, hashtags].filter(Boolean).join("\n\n");
    return `<section class="card" style="margin-bottom:1.4rem;border-color:var(--teal)">
      <div class="post-head"><h3 style="margin:0">Post para X — ${esc(draft.title)}</h3>
        <button class="table-link" data-close-post aria-label="Cerrar">${icon("x")} Cerrar</button></div>
      <textarea id="repo-post-text" style="width:100%;min-height:150px;margin:.6rem 0;border:1px solid var(--line);border-radius:11px;padding:.72rem .85rem">${esc(text)}</textarea>
      ${draft.sources?.length ? `<div class="post-meta"><span>${draft.sources.length} fuente(s):</span> ${draft.sources.slice(0, 4).map((s) => `<a class="table-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" · ")}</div>`
        : `<div class="post-meta"><span style="color:var(--red)">Sin fuentes verificadas — revisá antes de publicar.</span></div>`}
      <div class="form-foot" style="justify-content:start;margin-top:.7rem">
        <button class="button button-secondary" id="repo-post-copy" type="button" style="min-height:38px">${icon("copy")} Copiar</button>
        <button class="button button-primary" id="repo-post-save" type="button" style="min-height:38px">Guardar como borrador</button>
      </div>
    </section>`;
  }

  async function searchRepos(query) {
    state.repoBusy = true;
    state.repoQuery = query;
    try {
      const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=12`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) throw new Error(`GitHub ${response.status}`);
      const payload = await response.json();
      state.repoResults = payload.items || [];
      if (!state.repoResults.length) notify("Sin resultados para esa búsqueda.");
    } catch (error) {
      notify("GitHub no respondió (límite de 60 búsquedas/hora sin token).", true);
    } finally {
      state.repoBusy = false;
      renderShell();
    }
  }

  function wireRepos() {
    document.querySelector("#repo-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = String(new FormData(event.target).get("q")).trim();
      if (query) searchRepos(query);
    });
    document.querySelector("#repo-trending")?.addEventListener("click", () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      searchRepos(`created:>${since} stars:>300`);
    });
    document.querySelectorAll("[data-save-repo]").forEach((button) => button.addEventListener("click", async () => {
      const repo = state.repoResults.find((r) => r.full_name === button.dataset.saveRepo);
      if (!repo) return;
      const row = {
        organization_id: state.org.id,
        repo_full_name: repo.full_name,
        url: repo.html_url,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        topics: repo.topics || [],
        added_by: state.session?.user?.id || null,
      };
      const { data, error } = await supabase.from("repo_picks").insert(row).select().single();
      if (error) return notify(error.code === "23505" ? "Ese repo ya está guardado." : "No se pudo guardar el repo.", true);
      state.repos.unshift(data);
      notify("Repo guardado.");
      renderShell();
    }));
    document.querySelectorAll("[data-repo-status]").forEach((select) => select.addEventListener("change", async () => {
      const { error } = await supabase.from("repo_picks").update({ status: select.value }).eq("id", select.dataset.repoStatus);
      if (error) return notify("No se pudo actualizar el estado.", true);
      const repo = state.repos.find((r) => r.id === select.dataset.repoStatus);
      if (repo) repo.status = select.value;
      renderShell();
    }));

    document.querySelectorAll("[data-post-repo-result]").forEach((button) => button.addEventListener("click", () => {
      const repo = state.repoResults.find((r) => r.full_name === button.dataset.postRepoResult);
      if (repo) generatePostForRepo({ full_name: repo.full_name, description: repo.description, url: repo.html_url, language: repo.language, stars: repo.stargazers_count });
    }));
    document.querySelectorAll("[data-post-repo-saved]").forEach((button) => button.addEventListener("click", () => {
      const repo = state.repos.find((r) => r.id === button.dataset.postRepoSaved);
      if (repo) generatePostForRepo({ full_name: repo.repo_full_name, description: repo.description, url: repo.url, language: repo.language, stars: repo.stars });
    }));
    document.querySelector("#repo-post-copy")?.addEventListener("click", () => copyText(document.querySelector("#repo-post-text")?.value || ""));
    document.querySelector("#repo-post-save")?.addEventListener("click", saveRepoPost);
    document.querySelector("[data-close-post]")?.addEventListener("click", () => { state.repoPostDraft = null; renderShell(); });
  }

  async function generatePostForRepo(repo) {
    if (state.preview) return notify("La vista previa es de solo lectura.", true);
    state.repoPostBusy = true;
    renderShell();
    const { data, error } = await invokeEdge("generate-article", { format: "x_post", repo });
    state.repoPostBusy = false;
    if (error || data?.error) {
      notify(data?.error || "No se pudo generar el post. Revisá que Gemini esté configurado.", true);
      return renderShell();
    }
    state.repoPostDraft = data.drafts?.[0] || null;
    notify("Post generado. Revisalo y ajustá antes de publicar.");
    renderShell();
  }

  async function saveRepoPost() {
    const draft = state.repoPostDraft;
    if (!draft) return;
    const edited = document.querySelector("#repo-post-text")?.value || draft.body_md;
    const row = {
      organization_id: state.org.id,
      prompt_key: "x_post",
      title: draft.title,
      subtitle: draft.subtitle,
      summary: draft.summary || [],
      body_md: edited,
      sources: draft.sources || [],
      model: draft.model,
      status: "draft",
      created_by: state.session?.user?.id || null,
    };
    const { data, error } = await supabase.from("articles").insert(row).select().single();
    if (error) return notify("No se pudo guardar el post.", true);
    state.articles.unshift(data);
    state.repoPostDraft = null;
    notify("Post guardado como borrador en Artículos.");
    renderShell();
  }

  // ---------- articles ----------

  function currentPrompt() { return state.prompts.find((p) => p.key === state.articleForm.prompt_key) || state.prompts[0]; }

  function articlesView() {
    const prompt = currentPrompt();
    const draftText = state.articleForm.prompt_md || prompt?.prompt_md || "";
    return `
      <div class="toolbar"><div><span class="eyebrow">Boletín Beehiiv</span><h2>Generador de artículos</h2></div></div>
      <section class="card" style="margin-bottom:1.2rem">
        <div class="form-grid">
          <div class="field"><label for="art-prompt">Plantilla</label>
            <select id="art-prompt">${state.prompts.map((p) => `<option value="${esc(p.key)}" ${state.articleForm.prompt_key === p.key ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="art-count">¿Cuántos generar?</label>
            <select id="art-count">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${state.articleForm.count === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
          <div class="field span-all"><label for="art-promptmd">Prompt (editable para esta corrida)</label>
            <textarea id="art-promptmd" style="min-height:150px">${esc(draftText)}</textarea></div>
          <div class="form-foot span-all">
            <button class="button button-secondary" id="art-save-prompt" type="button">Guardar plantilla</button>
            <button class="button button-primary" id="art-generate" type="button" ${state.articleBusy || state.preview ? "disabled" : ""}>
              ${state.articleBusy ? "Generando…" : "Generar"}
            </button>
          </div>
        </div>
        ${state.preview ? `<p style="color:var(--muted);margin:.6rem 0 0">La generación real usa Gemini vía Edge Function; en vista previa está deshabilitada.</p>` : ""}
      </section>

      ${state.drafts.length ? `<div class="toolbar"><div><span class="eyebrow">Recién generados</span><h2>Elegí cuáles guardar</h2></div></div>
        <div class="grid grid-2" style="margin-bottom:1.4rem">${state.drafts.map(draftCard).join("")}</div>` : ""}

      <div class="toolbar"><div><span class="eyebrow">Guardados</span><h2>Artículos</h2></div></div>
      ${state.articles.length ? `<div class="card table-wrap"><table>
        <thead><tr><th>Título</th><th>Plantilla</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
        <tbody>${state.articles.map((article) => `<tr>
          <td><strong>${esc(article.title)}</strong><br /><span style="color:var(--muted)">${esc(article.subtitle || "")}</span></td>
          <td>${esc(article.prompt_key)}</td>
          <td><span class="status status-${article.status === "draft" ? "inbox" : article.status === "discarded" ? "discarded" : "reviewed"}">${esc(articleStatusLabels[article.status] || article.status)}</span></td>
          <td>${fmtDate(article.created_at)}</td>
          <td>${state.preview ? "" : `<button class="table-link" data-copy-article="${esc(article.id)}">Copiar</button>
            <button class="table-link" data-social-posts="${esc(article.id)}" ${state.socialPosts?.busy ? "disabled" : ""}>Posts</button>
            <select data-article-status="${esc(article.id)}" aria-label="Estado" style="margin-top:.4rem">
              ${Object.entries(articleStatusLabels).map(([value, label]) => `<option value="${value}" ${article.status === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>`}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty">Todavía no hay artículos. Elegí una plantilla, cuántos querés y presioná Generar.</div>`}
      ${socialPostsSection()}`;
  }

  function socialPostsSection() {
    const sp = state.socialPosts;
    if (!sp) return "";
    if (sp.busy) return `<div class="card" style="margin-top:1.4rem"><p style="color:var(--muted)">Generando posts para «${esc(sp.title)}»…</p></div>`;
    if (!sp.posts) return "";
    const block = (label, key) => sp.posts[key] ? `<article class="card">
      <h3>${label}</h3>
      <p class="post-content" style="margin:.5rem 0 .7rem;white-space:pre-wrap">${esc(sp.posts[key])}</p>
      <button class="table-link" data-copy-social="${key}">Copiar</button>
    </article>` : "";
    return `<div class="toolbar" style="margin-top:1.6rem"><div><span class="eyebrow">Difusión</span><h2>Posts para «${esc(sp.title)}»</h2></div></div>
      <p style="color:var(--muted);margin:0 0 .8rem">Link: <a href="${esc(sp.link)}" target="_blank" rel="noopener">${esc(sp.link)}</a></p>
      <div class="grid grid-3">${block("X", "x")}${block("WhatsApp", "whatsapp")}${block("LinkedIn", "linkedin")}</div>`;
  }

  function draftCard(draft, index) {
    return `<article class="card">
      <h3>${esc(draft.title || "(sin título)")}</h3>
      <p style="color:var(--muted);margin:.2rem 0 .7rem;line-height:1.5">${esc(draft.subtitle || "")}</p>
      ${draft.summary?.length ? `<ul style="margin:0 0 .7rem;padding-left:1.1rem;line-height:1.5">${draft.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      <details style="margin-bottom:.6rem"><summary style="cursor:pointer;color:var(--teal);font-weight:600">Ver cuerpo</summary>
        <p class="post-content" style="margin-top:.5rem">${esc(draft.body_md || "")}</p></details>
      ${draft.sources?.length ? `<div class="post-meta"><span>${draft.sources.length} fuente(s)</span></div>` : `<div class="post-meta"><span style="color:var(--red)">Sin fuentes — revisá antes de publicar</span></div>`}
      <div class="form-foot" style="justify-content:start">
        <button class="button button-secondary" data-save-draft="${index}" style="min-height:38px">Guardar</button>
        <button class="table-link" data-copy-draft="${index}">Copiar</button>
        <button class="table-link" data-discard-draft="${index}" style="color:var(--red)">Descartar</button>
      </div>
    </article>`;
  }

  // ---------- memes & reddit ----------

  function memesView() {
    const m = state.memes;
    return `
      <div class="toolbar"><div><span class="eyebrow">${esc(state.org?.name || "")}</span><h2>Memes y Reddit</h2></div></div>
      <section class="card" style="margin-bottom:1.2rem">
        <h3>Buscar un tema</h3>
        <p style="color:var(--muted);margin:.2rem 0 .8rem">Trae contexto de Reddit y memes/GIFs de subs de humor para acompañar un post.</p>
        <form id="meme-form" class="form-grid">
          <div class="field span-all"><label for="meme-query">Tema</label><input id="meme-query" name="query" placeholder="ej: bitcoin etf, google gemini, stellar" value="${esc(m.query)}" required /></div>
          <div class="form-foot span-all">
            <button class="button button-primary" type="submit" ${m.busy || state.preview ? "disabled" : ""}>${icon("search")} ${m.busy ? "Buscando…" : "Buscar info + memes"}</button>
          </div>
        </form>
      </section>
      ${m.info?.posts?.length ? `<div class="toolbar"><div><span class="eyebrow">Listos para publicar</span><h2>Post + meme</h2></div></div>
        <div class="grid grid-3" style="margin-bottom:1.4rem">${m.info.posts.map((p, i) => {
          const gif = m.gifs[i];
          return `<article class="card">
            ${gif ? `<a href="${esc(gif.page || gif.url)}" target="_blank" rel="noopener"><img src="${esc(gif.thumbnail || gif.url)}" alt="" style="width:100%;border-radius:8px;max-height:170px;object-fit:cover" loading="lazy" /></a>` : ""}
            <p class="post-content" style="margin:.6rem 0;white-space:pre-wrap">${esc(p)}</p>
            <div class="form-foot" style="justify-content:start">
              <button class="table-link" data-copy-meme="${esc(p)}">Copiar post</button>
              ${gif ? `<button class="table-link" data-copy-meme="${esc(gif.url)}">Copiar GIF</button>` : ""}
            </div>
          </article>`;
        }).join("")}</div>` : ""}
      ${m.gifs.length ? `<div class="toolbar"><div><span class="eyebrow">Más opciones</span><h2>GIFs</h2></div></div>
        <div class="grid grid-3" style="margin-bottom:1.4rem">${m.gifs.map((g) => `<article class="card">
          <a href="${esc(g.page || g.url)}" target="_blank" rel="noopener"><img src="${esc(g.thumbnail || g.url)}" alt="" style="width:100%;border-radius:8px;max-height:180px;object-fit:cover" loading="lazy" /></a>
          <p style="margin:.5rem 0 .4rem;line-height:1.4">${esc(g.title || "GIF")}</p>
          <div class="form-foot" style="justify-content:start;margin-top:.4rem">
            <button class="table-link" data-copy-meme="${esc(g.url)}">Copiar link del GIF</button>
          </div>
        </article>`).join("")}</div>` : ""}
      ${m.info ? `<div class="toolbar"><div><span class="eyebrow">Contexto</span><h2>Qué se está diciendo</h2></div></div>
        <article class="card" style="margin-bottom:1.4rem">
          <p style="line-height:1.6;margin:0 0 .7rem">${esc(m.info.summary || "")}</p>
          ${m.info.points?.length ? `<ul style="margin:0 0 .7rem;padding-left:1.1rem;line-height:1.6">${m.info.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
          ${m.info.sources?.length ? `<div class="post-meta" style="flex-wrap:wrap;gap:.5rem">${m.info.sources.slice(0, 8).map((s) => `<a class="table-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title.slice(0, 40))}</a>`).join("")}</div>` : ""}
        </article>` : ""}
      ${!m.busy && !m.info && !m.gifs.length ? `<div class="empty">Buscá un tema: te traigo el pulso de la conversación (Reddit y foros) y GIFs listos para usar.</div>` : ""}`;
  }

  function wireMemes() {
    document.querySelector("#meme-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.preview) return notify("La vista previa es de solo lectura.", true);
      const query = String(new FormData(event.target).get("query") || "").trim();
      if (!query) return;
      state.memes = { ...state.memes, query, busy: true };
      renderShell();
      const info = await invokeEdge("reddit-search", { query, mode: "info" });
      // The model suggests the best English search phrase for a matching GIF.
      const gifQuery = info.data?.gifQuery || query;
      const gifs = await invokeEdge("reddit-search", { query: gifQuery, mode: "memes", count: 9 });
      state.memes.busy = false;
      state.memes.info = info.data?.summary ? { summary: info.data.summary, points: info.data.points || [], posts: info.data.posts || [], sources: info.data.sources || [] } : null;
      state.memes.gifs = gifs.data?.items || [];
      const problems = [info.data?.error, gifs.data?.error].filter(Boolean);
      if (problems.length) notify(problems.join(" · "), true);
      else notify(`${state.memes.info?.posts?.length || 0} posts listos y ${state.memes.gifs.length} GIFs.`);
      renderShell();
    });
    document.querySelectorAll("[data-copy-meme]").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.copyMeme)));
  }

  function draftToMarkdown(draft) {
    const lines = [`# ${draft.title}`, "", `_${draft.subtitle}_`, ""];
    if (draft.summary?.length) { lines.push("## Resumen", ...draft.summary.map((s) => `- ${s}`), ""); }
    lines.push(draft.body_md || "", "");
    if (draft.sources?.length) { lines.push("## Sources", ...draft.sources.map((s) => `- [${s.title}](${s.url})`)); }
    return lines.join("\n").trim();
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); notify("Copiado al portapapeles."); }
    catch { notify("No se pudo copiar.", true); }
  }

  function wireArticles() {
    document.querySelector("#art-prompt")?.addEventListener("change", (e) => {
      state.articleForm.prompt_key = e.target.value;
      state.articleForm.prompt_md = "";
      renderShell();
    });
    document.querySelector("#art-count")?.addEventListener("change", (e) => { state.articleForm.count = Number(e.target.value); });
    document.querySelector("#art-promptmd")?.addEventListener("input", (e) => { state.articleForm.prompt_md = e.target.value; });

    document.querySelector("#art-save-prompt")?.addEventListener("click", async () => {
      if (state.preview) return notify("La vista previa es de solo lectura.", true);
      const prompt = currentPrompt();
      if (!prompt) return;
      const text = state.articleForm.prompt_md || prompt.prompt_md;
      const { error } = await supabase.from("article_prompts").update({ prompt_md: text }).eq("id", prompt.id);
      if (error) return notify("No se pudo guardar la plantilla.", true);
      prompt.prompt_md = text;
      state.articleForm.prompt_md = "";
      notify("Plantilla guardada.");
      renderShell();
    });

    document.querySelector("#art-generate")?.addEventListener("click", generateArticles);

    document.querySelectorAll("[data-save-draft]").forEach((button) => button.addEventListener("click", () => saveDraft(Number(button.dataset.saveDraft))));
    document.querySelectorAll("[data-copy-draft]").forEach((button) => button.addEventListener("click", () => copyText(draftToMarkdown(state.drafts[Number(button.dataset.copyDraft)]))));
    document.querySelectorAll("[data-discard-draft]").forEach((button) => button.addEventListener("click", () => {
      state.drafts.splice(Number(button.dataset.discardDraft), 1);
      renderShell();
    }));

    document.querySelectorAll("[data-copy-article]").forEach((button) => button.addEventListener("click", () => {
      const article = state.articles.find((a) => a.id === button.dataset.copyArticle);
      if (article) copyText(draftToMarkdown(article));
    }));
    document.querySelectorAll("[data-social-posts]").forEach((button) => button.addEventListener("click", () => generateSocialPosts(button.dataset.socialPosts)));
    document.querySelectorAll("[data-copy-social]").forEach((button) => button.addEventListener("click", () => {
      const post = state.socialPosts?.posts?.[button.dataset.copySocial];
      if (post) copyText(post);
    }));
    document.querySelectorAll("[data-article-status]").forEach((select) => select.addEventListener("change", async () => {
      const { error } = await supabase.from("articles").update({ status: select.value }).eq("id", select.dataset.articleStatus);
      if (error) return notify("No se pudo actualizar el estado.", true);
      const article = state.articles.find((a) => a.id === select.dataset.articleStatus);
      if (article) article.status = select.value;
      renderShell();
    }));
  }

  async function generateArticles() {
    if (state.preview) return notify("La vista previa es de solo lectura.", true);
    state.articleBusy = true;
    renderShell();
    const { data, error } = await invokeEdge("generate-article", {
      prompt_key: state.articleForm.prompt_key,
      prompt_md: state.articleForm.prompt_md || undefined,
      count: state.articleForm.count,
    });
    state.articleBusy = false;
    if (error || data?.error) {
      notify(data?.error || "No se pudo generar. Revisá que Gemini esté configurado.", true);
      return renderShell();
    }
    state.drafts = data.drafts || [];
    const failed = (data.errors || []).length;
    notify(`Generados ${data.generated} de ${data.requested}${failed ? ` (${failed} fallaron)` : ""}.`);
    renderShell();
  }

  async function generateSocialPosts(articleId) {
    if (state.preview) return notify("La vista previa es de solo lectura.", true);
    const article = state.articles.find((a) => a.id === articleId);
    if (!article) return;
    const link = window.prompt("Pegá el link del artículo en Beehiiv (va incluido en cada post):", state.socialPosts?.link || "");
    if (!link || !link.trim()) return notify("Necesitás el link de Beehiiv para armar los posts.", true);
    state.socialPosts = { articleId, title: article.title, link: link.trim(), posts: null, busy: true };
    renderShell();
    const { data, error } = await invokeEdge("generate-article", {
      format: "social_posts",
      link: link.trim(),
      article: { title: article.title, subtitle: article.subtitle, summary: article.summary || [] },
    });
    if (error || data?.error) {
      state.socialPosts = null;
      notify(data?.error || "No se pudieron generar los posts.", true);
      return renderShell();
    }
    state.socialPosts = { articleId, title: article.title, link: link.trim(), posts: data.posts, busy: false };
    notify("Posts generados para X, WhatsApp y LinkedIn.");
    renderShell();
  }

  async function saveDraft(index) {
    const draft = state.drafts[index];
    if (!draft) return;
    const row = {
      organization_id: state.org.id,
      prompt_key: state.articleForm.prompt_key,
      title: draft.title,
      subtitle: draft.subtitle,
      summary: draft.summary || [],
      body_md: draft.body_md,
      sources: draft.sources || [],
      model: draft.model,
      status: "draft",
      created_by: state.session?.user?.id || null,
    };
    const { data, error } = await supabase.from("articles").insert(row).select().single();
    if (error) return notify("No se pudo guardar el artículo.", true);
    state.articles.unshift(data);
    state.drafts.splice(index, 1);
    notify("Artículo guardado como borrador.");
    renderShell();
  }

  // ---------- boot ----------

  async function boot() {
    renderLoading();
    if (state.preview) {
      loadPreviewData();
      renderShell();
      return;
    }
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    if (!state.session) return renderAuth();
    try {
      await loadLiveData();
      renderShell();
    } catch (error) {
      console.error(error);
      notify("No pudimos cargar los datos. Verificá tu acceso.", true);
      renderAuth();
    }
  }

  supabase.auth.onAuthStateChange((_event, session) => { state.session = session; });
  boot();
})();
