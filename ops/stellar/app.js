(() => {
  "use strict";

  const cfg = window.STELLAR_OPS_CONFIG;
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const $app = document.querySelector("#app");
  const PREVIEW = new URLSearchParams(location.search).get("preview") === "1";
  const statusLabels = {
    not_started: "Sin iniciar", in_progress: "En curso", at_risk: "En riesgo",
    submitted: "Enviado", accepted: "Aceptado", blocked: "Bloqueado",
  };
  const typeLabels = {
    event: "Evento", content: "Contenido", scf: "SCF", instaward: "Instaward",
    ambassador: "Embajador", developer: "Developer", partnership: "Alianza",
  };
  const state = {
    session: null, membership: null, organization: null, periods: [], selectedPeriod: null,
    metrics: [], updates: [], initiatives: [], deliverables: [], payments: [], funds: [],
    view: "dashboard", sidebarOpen: false, preview: PREVIEW,
  };

  const previewData = {
    organization: { id: "preview-org", name: "Tellus Cooperative Foundation", slug: "tellus" },
    periods: [
      { id: "jul", label: "Julio 2026", starts_on: "2026-07-01", ends_on: "2026-07-31", report_due_on: "2026-08-07" },
      { id: "aug", label: "Agosto 2026", starts_on: "2026-08-01", ends_on: "2026-08-31", report_due_on: "2026-09-07" },
      { id: "sep", label: "Septiembre 2026", starts_on: "2026-09-01", ends_on: "2026-09-30", report_due_on: "2026-10-07" },
      { id: "oct", label: "Octubre 2026", starts_on: "2026-10-01", ends_on: "2026-10-31", report_due_on: "2026-11-06" },
      { id: "nov", label: "Noviembre 2026", starts_on: "2026-11-01", ends_on: "2026-11-30", report_due_on: "2026-12-07" },
      { id: "dec", label: "Diciembre 2026", starts_on: "2026-12-01", ends_on: "2026-12-31", report_due_on: "2027-01-08" },
    ],
    metrics: [
      ["events","Eventos calificables","Operación",3,"eventos",2,"at_risk"],
      ["content","Contenido educativo","Operación",2,"piezas",2,"accepted"],
      ["scf_referrals","Referidos SCF","Ecosistema",2,"referidos",1,"at_risk"],
      ["instaward_submissions","Candidatos Instaward","Ecosistema",3,"candidatos",3,"accepted"],
      ["ambassadors","Nuevos embajadores Tier 2+","Comunidad",20,"personas",14,"in_progress"],
      ["developers","Desarrolladores activos","Builders",100,"personas",63,"at_risk"],
      ["scf_awards","Proyectos SCF adjudicados","Resultado externo",1,"proyectos",0,"not_started"],
      ["instaward_awards","Instawards adjudicados","Resultado externo",3,"premios",1,"in_progress"],
    ],
    initiatives: [
      { id:"i1", type:"event", title:"Workshop Soroban para builders", status:"accepted", due_on:"2026-07-12", occurred_on:"2026-07-11", count_value:1 },
      { id:"i2", type:"event", title:"Meetup Stellar Santiago", status:"submitted", due_on:"2026-07-19", occurred_on:"2026-07-18", count_value:1 },
      { id:"i3", type:"event", title:"Taller universitario", status:"at_risk", due_on:"2026-07-27", count_value:1 },
      { id:"i4", type:"content", title:"Guía: primeros pasos con Soroban", status:"accepted", due_on:"2026-07-10", count_value:1 },
      { id:"i5", type:"scf", title:"Proyecto remesas comunitarias", status:"in_progress", due_on:"2026-07-29", count_value:1 },
      { id:"i6", type:"instaward", title:"Wallet para cooperativas", status:"submitted", due_on:"2026-07-24", count_value:1 },
      { id:"i7", type:"partnership", title:"Universidad regional", status:"in_progress", due_on:"2026-08-14", count_value:1 },
    ],
    deliverables: [
      { id:"d1", title:"Plan de lanzamiento", due_on:"2026-07-16", status:"submitted" },
      { id:"d2", title:"Referidos SCF e Instaward — julio", due_on:"2026-07-31", status:"in_progress" },
      { id:"d3", title:"Reporte mensual — julio", due_on:"2026-08-07", status:"not_started" },
      { id:"d4", title:"Paquete de eventos — julio", due_on:"2026-08-07", status:"in_progress" },
    ],
    payments: [
      ["Programa y plan de lanzamiento",2500,"triggered"], ["Desempeño mes 1",2500,"not_triggered"],
      ["Desempeño mes 2",2500,"not_triggered"], ["Revisión intermedia mes 3",2500,"not_triggered"],
      ["Desempeño meses 4–5",2500,"not_triggered"], ["Cierre final mes 6",2500,"not_triggered"],
    ],
    funds: [
      { id:"f1", occurred_on:"2026-07-01", direction:"credit", category:"Asignación", description:"Fondo operativo Q3", amount_usd:30000, approved:true },
      { id:"f2", occurred_on:"2026-07-10", direction:"debit", category:"Eventos", description:"Venue workshop Soroban", amount_usd:850, approved:true },
      { id:"f3", occurred_on:"2026-07-13", direction:"debit", category:"Producción", description:"Materiales y registro", amount_usd:310, approved:false },
    ],
  };

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const fmtDate = (value) => value ? new Intl.DateTimeFormat("es-CL", { day:"2-digit", month:"short", year:"numeric", timeZone:"UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Sin fecha";
  const fmtMoney = (value) => new Intl.NumberFormat("es-CL", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(value || 0);
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const status = (value) => `<span class="status status-${esc(value)}">${esc(statusLabels[value] || value)}</span>`;
  const notify = (message, isError = false) => {
    document.querySelector(".toast")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="toast ${isError ? "error" : ""}" role="status">${esc(message)}</div>`);
    setTimeout(() => document.querySelector(".toast")?.remove(), 4200);
  };
  const hydrateIcons = () => window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });

  function renderLoading() {
    $app.innerHTML = `<div class="loading"><div><div class="spinner" aria-hidden="true"></div><p>Cargando Stellar Ops…</p></div></div>`;
  }

  function renderAuth() {
    $app.innerHTML = `
      <main class="auth-shell" id="main">
        <section class="auth-brand" aria-labelledby="auth-brand-title">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Tellus Cooperative</div>
          <div><span class="eyebrow" style="color:#f1a479">Stellar Chile · Operaciones</span><h1 id="auth-brand-title">Cumplir, demostrar y cobrar.</h1><p>Un solo lugar para metas, responsables, evidencia, reportes, aceptación y pagos del capítulo chileno.</p></div>
          <p>Acceso privado para el equipo Tellus.</p>
        </section>
        <section class="auth-panel">
          <form class="auth-card" id="login-form">
            <span class="eyebrow">Acceso seguro</span><h2>Entrar al dashboard</h2><p>Usa tu cuenta autorizada por Tellus.</p>
            <div class="field"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="email" required /></div>
            <div class="field"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="8" /></div>
            <div class="auth-actions">
              <button class="button button-primary button-block" type="submit">${icon("log-in")} Entrar</button>
              <button class="button button-secondary button-block" type="button" id="first-access">Crear contraseña por primera vez</button>
              <a class="button button-ghost" href="?preview=1">Ver vista previa del contrato</a>
            </div><div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    hydrateIcons();
    document.querySelector("#login-form").addEventListener("submit", signIn);
    document.querySelector("#first-access").addEventListener("click", renderFirstAccess);
  }

  function renderFirstAccess() {
    $app.innerHTML = `
      <main class="auth-shell" id="main">
        <section class="auth-brand" aria-labelledby="first-access-title">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Tellus Cooperative</div>
          <div><span class="eyebrow" style="color:#f1a479">Primer acceso</span><h1 id="first-access-title">Crea tu contraseña sin correo.</h1><p>Usa el código temporal entregado por Tellus. Solo funciona una vez.</p></div>
          <p>Tu contraseña se almacena cifrada por Supabase Auth.</p>
        </section>
        <section class="auth-panel">
          <form class="auth-card" id="first-access-form">
            <span class="eyebrow">Cuenta autorizada</span><h2>Configurar acceso</h2><p>No enviaremos ningún email.</p>
            <div class="field"><label for="setup-email">Correo</label><input id="setup-email" name="email" type="email" autocomplete="email" required /></div>
            <div class="field"><label for="access-code">Código temporal</label><input id="access-code" name="code" type="text" autocomplete="one-time-code" required /></div>
            <div class="field"><label for="setup-password">Nueva contraseña</label><input id="setup-password" name="password" type="password" autocomplete="new-password" minlength="10" required /><small>Mínimo 10 caracteres.</small></div>
            <div class="field"><label for="setup-confirmation">Confirmar contraseña</label><input id="setup-confirmation" name="confirmation" type="password" autocomplete="new-password" minlength="10" required /></div>
            <button class="button button-primary button-block" type="submit">Crear contraseña y entrar</button>
            <button class="button button-ghost button-block" type="button" id="back-to-login">Volver al acceso</button>
            <div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    document.querySelector("#first-access-form").addEventListener("submit", createFirstPassword);
    document.querySelector("#back-to-login").addEventListener("click", renderAuth);
  }

  async function createFirstPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#auth-message");
    if (form.password.value !== form.confirmation.value) {
      message.textContent = "Las contraseñas no coinciden.";
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Configurando…";
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const { data, error } = await supabase.functions.invoke("first-access", {
      body: { email, code: form.code.value.trim(), password },
    });
    if (error || data?.error) {
      message.textContent = data?.error || "No pudimos configurar la cuenta.";
      button.disabled = false;
      button.textContent = "Crear contraseña y entrar";
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      message.textContent = "Contraseña creada. Vuelve al acceso e inicia sesión.";
      button.disabled = false;
      button.textContent = "Crear contraseña y entrar";
    }
  }

  function renderPasswordSetup() {
    $app.innerHTML = `
      <main class="auth-shell" id="main">
        <section class="auth-brand" aria-labelledby="setup-brand-title">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Tellus Cooperative</div>
          <div><span class="eyebrow" style="color:#f1a479">Primer acceso</span><h1 id="setup-brand-title">Protege tu cuenta maestra.</h1><p>Crea una contraseña personal para tus próximos ingresos al dashboard.</p></div>
          <p>La contraseña se almacena cifrada por Supabase Auth.</p>
        </section>
        <section class="auth-panel">
          <form class="auth-card" id="password-setup-form">
            <span class="eyebrow">Configuración obligatoria</span><h2>Crear contraseña</h2><p>Usarás el correo <strong>${esc(state.session.user.email)}</strong> y esta contraseña para entrar.</p>
            <div class="field"><label for="new-password">Nueva contraseña</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="10" required /><small>Mínimo 10 caracteres.</small></div>
            <div class="field"><label for="confirm-password">Confirmar contraseña</label><input id="confirm-password" name="confirmation" type="password" autocomplete="new-password" minlength="10" required /></div>
            <button class="button button-primary button-block" type="submit">Guardar contraseña y continuar</button>
            <div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    hydrateIcons();
    document.querySelector("#password-setup-form").addEventListener("submit", saveInitialPassword);
  }

  async function saveInitialPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#auth-message");
    if (form.password.value !== form.confirmation.value) {
      message.textContent = "Las contraseñas no coinciden.";
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    const currentData = state.session.user.user_metadata || {};
    const { data, error } = await supabase.auth.updateUser({
      password: form.password.value,
      data: { ...currentData, password_configured: true },
    });
    button.disabled = false;
    if (error) {
      message.textContent = error.message || "No pudimos guardar la contraseña.";
      return;
    }
    state.session.user = data.user;
    await boot();
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    button.disabled = false;
    if (error) document.querySelector("#auth-message").textContent = "No pudimos iniciar sesión. Revisa tu correo y contraseña.";
  }

  async function loadLiveData() {
    const userId = state.session.user.id;
    const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id, role, organizations(id,name,slug)").eq("user_id", userId).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) {
      $app.innerHTML = `<main class="auth-panel" id="main"><section class="auth-card card" style="padding:2rem"><span class="eyebrow">Acceso pendiente</span><h2>Tu cuenta aún no está asignada</h2><p>Un administrador debe agregarte a Tellus en <code>organization_members</code>.</p><button class="button button-secondary" id="pending-signout">Cerrar sesión</button></section></main>`;
      document.querySelector("#pending-signout").addEventListener("click", () => supabase.auth.signOut());
      return false;
    }
    state.membership = membership;
    state.organization = membership.organizations;
    const orgId = membership.organization_id;
    const [periods, metrics, updates, initiatives, deliverables, payments, funds] = await Promise.all([
      supabase.from("reporting_periods").select("*").eq("organization_id", orgId).order("starts_on"),
      supabase.from("metric_definitions").select("*").eq("organization_id", orgId).order("sort_order"),
      supabase.from("metric_updates").select("*").eq("organization_id", orgId),
      supabase.from("initiatives").select("*").eq("organization_id", orgId).order("due_on"),
      supabase.from("deliverables").select("*").eq("organization_id", orgId).order("due_on"),
      supabase.from("payment_milestones").select("*").eq("organization_id", orgId).order("sort_order"),
      supabase.from("fund_transactions").select("*").eq("organization_id", orgId).order("occurred_on", { ascending:false }),
    ]);
    const failed = [periods, metrics, updates, initiatives, deliverables, payments, funds].find((r) => r.error);
    if (failed) throw failed.error;
    Object.assign(state, { periods:periods.data, metrics:metrics.data, updates:updates.data, initiatives:initiatives.data, deliverables:deliverables.data, payments:payments.data, funds:funds.data });
    state.selectedPeriod ||= state.periods.find((p) => new Date(p.starts_on) <= new Date() && new Date(p.ends_on) >= new Date())?.id || state.periods[0]?.id;
    return true;
  }

  function loadPreviewData() {
    state.organization = previewData.organization;
    state.membership = { role:"admin" };
    state.periods = previewData.periods;
    state.selectedPeriod ||= previewData.periods[0].id;
    state.metrics = previewData.metrics.map((m, i) => ({ id:m[0], code:m[0], label:m[1], category:m[2], target:m[3], unit:m[4], sort_order:i }));
    state.updates = previewData.metrics.map((m) => ({ id:`u-${m[0]}`, period_id:"jul", metric_id:m[0], actual:m[5], status:m[6] }));
    state.initiatives = previewData.initiatives;
    state.deliverables = previewData.deliverables;
    state.payments = previewData.payments.map((p, i) => ({ id:`p${i}`, label:p[0], amount_usd:p[1], status:p[2] }));
    state.funds = previewData.funds;
  }

  function currentPeriod() { return state.periods.find((p) => p.id === state.selectedPeriod) || state.periods[0]; }
  function periodUpdates() { return state.updates.filter((u) => u.period_id === state.selectedPeriod); }
  function metricWithUpdate(metric) { return { ...metric, update: periodUpdates().find((u) => u.metric_id === metric.id) || { actual:0, status:"not_started" } }; }
  function periodInitiatives() { return state.initiatives.filter((i) => !i.period_id || i.period_id === state.selectedPeriod); }

  function renderShell() {
    const viewLabels = { dashboard:"Resumen", initiatives:"Operación", deliverables:"Entregables", finance:"Finanzas" };
    $app.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar ${state.sidebarOpen ? "open" : ""}" id="sidebar">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Stellar Ops</div>
          <nav class="nav" aria-label="Principal">
            ${navButton("dashboard","layout-dashboard","Resumen")}${navButton("initiatives","kanban","Operación")}${navButton("deliverables","file-check-2","Entregables")}${navButton("finance","circle-dollar-sign","Finanzas")}
          </nav>
          <div class="sidebar-footer"><div class="user-meta"><strong>${esc(state.preview ? "Vista previa" : state.session?.user?.email)}</strong><span>${esc(state.membership?.role || "")}</span></div>${state.preview ? `<a class="button button-ghost" href="./">${icon("log-in")} Ir al acceso</a>` : `<button class="button button-ghost" id="signout">${icon("log-out")} Cerrar sesión</button>`}</div>
        </aside>
        <main class="main" id="main">
          <header class="topbar"><button class="icon-button menu-button" id="menu" aria-label="Abrir menú" aria-expanded="${state.sidebarOpen}">${icon("menu")}</button><div class="topbar-title"><h1>${viewLabels[state.view]}</h1><p>${esc(state.organization?.name || "Tellus")}</p></div><div class="topbar-actions"><label class="sr-only" for="period">Período</label><select class="period-select" id="period">${state.periods.map((p) => `<option value="${esc(p.id)}" ${p.id === state.selectedPeriod ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select><button class="button button-primary" id="quick-add">${icon("plus")} Registrar</button></div></header>
          <div class="content">${state.preview ? `<div class="preview-banner"><strong>Vista previa.</strong> Metas contractuales reales con actividad ilustrativa. No corresponde a información productiva.</div>` : ""}<div id="view">${renderView()}</div></div>
        </main>
      </div>`;
    wireShell(); hydrateIcons();
  }

  function navButton(view, iconName, label) { return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${icon(iconName)} ${label}</button>`; }
  function renderView() { return state.view === "dashboard" ? dashboardView() : state.view === "initiatives" ? initiativesView() : state.view === "deliverables" ? deliverablesView() : financeView(); }

  function dashboardView() {
    const metrics = state.metrics.map(metricWithUpdate);
    const completion = metrics.length ? Math.round(metrics.reduce((sum,m) => sum + Math.min(1, Number(m.update.actual)/Number(m.target || 1)), 0) / metrics.length * 100) : 0;
    const period = currentPeriod();
    const next = state.deliverables.filter((d) => d.status !== "accepted").sort((a,b) => String(a.due_on).localeCompare(String(b.due_on)))[0];
    const metricCards = metrics.map((m) => {
      const pct = Math.min(100, Math.round(Number(m.update.actual) / Number(m.target || 1) * 100));
      return `<article class="card metric-card"><div class="metric-head"><h3>${esc(m.label)}</h3>${status(m.update.status)}</div><div class="metric-value">${esc(m.update.actual)} <small>/ ${esc(m.target)} ${esc(m.unit)}</small></div><div class="bar" aria-label="${pct}% cumplido"><span style="width:${pct}%"></span></div><div class="metric-foot"><span>${pct}%</span><button class="table-link" data-edit-metric="${esc(m.id)}">Actualizar</button></div></article>`;
    }).join("");
    return `<section class="hero"><article class="card hero-card"><div><span class="eyebrow">${esc(period?.label || "Período")}</span><h2>${completion >= 100 ? "Objetivos cubiertos" : completion >= 70 ? "Buen avance, quedan brechas" : "Necesitamos acelerar"}</h2><p>${metrics.filter((m) => ["at_risk","blocked"].includes(m.update.status)).length} métricas requieren atención. Cada valor debe quedar respaldado por evidencia verificable.</p></div><div class="progress-ring" style="--progress:${completion}" aria-label="Cumplimiento ${completion}%"><strong>${completion}%</strong></div></article><article class="card deadline-card"><div><span class="eyebrow">Próximo vencimiento</span><div class="date">${next ? fmtDate(next.due_on) : "Al día"}</div><p>${next ? esc(next.title) : "No hay entregables pendientes."}</p></div>${next ? status(next.status) : ""}</article></section><section class="metric-grid">${metricCards}</section><section class="section-grid"><article class="card section-card"><div class="section-head"><div><h2>Entregables próximos</h2><p>De ejecutar a aceptar, sin perder trazabilidad.</p></div><button class="table-link" data-view-link="deliverables">Ver todos</button></div>${deliverablesTable(state.deliverables.slice(0,5))}</article><article class="card section-card"><div class="section-head"><div><h2>Acciones prioritarias</h2><p>Lo que puede afectar cumplimiento o pago.</p></div></div><div class="mini-list">${priorityItems(metrics, next)}</div></article></section>`;
  }

  function priorityItems(metrics, next) {
    const items = metrics.filter((m) => ["at_risk","blocked"].includes(m.update.status)).slice(0,3).map((m) => ({ icon:"triangle-alert", title:m.label, detail:`${m.update.actual} de ${m.target} ${m.unit}` }));
    if (next) items.unshift({ icon:"calendar-clock", title:next.title, detail:`Vence ${fmtDate(next.due_on)}` });
    if (!items.length) return `<div class="empty">Sin alertas activas.</div>`;
    return items.slice(0,4).map((i) => `<div class="mini-item"><div class="mini-icon">${icon(i.icon)}</div><div><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></div></div>`).join("");
  }

  function deliverablesTable(rows) {
    if (!rows.length) return `<div class="empty">${icon("inbox")}<div>No hay entregables.</div></div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Entregable</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map((d) => `<tr><td><button class="table-link" data-edit-deliverable="${esc(d.id)}">${esc(d.title)}</button></td><td>${fmtDate(d.due_on)}</td><td>${status(d.status)}</td><td><button class="icon-button" data-edit-deliverable="${esc(d.id)}" aria-label="Editar ${esc(d.title)}">${icon("pencil")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function initiativesView() {
    const groups = ["not_started","in_progress","at_risk","submitted"];
    return `<div class="toolbar"><div><span class="eyebrow">Ejecución mensual</span><h2>Pipeline operativo</h2></div><div class="topbar-actions"><button class="button button-secondary" id="sync-luma">${icon("calendar-sync")} Importar desde Luma</button><button class="button button-primary" id="add-initiative">${icon("plus")} Nueva actividad</button></div></div><div class="kanban">${groups.map((g) => `<section class="kanban-column"><div class="kanban-title">${statusLabels[g]} <span class="kanban-count">${periodInitiatives().filter((i) => i.status === g).length}</span></div>${periodInitiatives().filter((i) => i.status === g).map(workCard).join("") || `<div class="empty">Sin actividades</div>`}</section>`).join("")}</div>`;
  }
  function workCard(item) { return `<article class="work-card"><span class="type-chip">${esc(typeLabels[item.type] || item.type)}</span><h3>${esc(item.title)}</h3>${item.luma_event_id ? `<div class="work-meta"><span>${icon("users")} ${esc(item.luma_registered_count)} registrados · ${esc(item.luma_checked_in_count)} check-ins</span></div>` : ""}<div class="work-meta"><span>${icon("calendar")} ${fmtDate(item.due_on || item.occurred_on)}</span>${item.luma_url ? `<a class="table-link" href="${esc(item.luma_url)}" target="_blank" rel="noopener">Luma</a>` : ""}<button class="table-link" data-edit-initiative="${esc(item.id)}">Editar</button></div></article>`; }

  function deliverablesView() {
    return `<div class="toolbar"><div><span class="eyebrow">Contrato y aceptación</span><h2>Entregables</h2></div><button class="button button-primary" id="add-deliverable">${icon("plus")} Nuevo entregable</button></div><article class="card section-card">${deliverablesTable(state.deliverables)}</article>`;
  }

  function financeView() {
    const paid = state.payments.filter((p) => p.status === "paid").reduce((s,p) => s + Number(p.amount_usd), 0);
    const credits = state.funds.filter((f) => f.direction === "credit").reduce((s,f) => s + Number(f.amount_usd), 0);
    const debits = state.funds.filter((f) => f.direction === "debit").reduce((s,f) => s + Number(f.amount_usd), 0);
    return `<div class="toolbar"><div><span class="eyebrow">Compensación y operación</span><h2>Finanzas</h2></div><button class="button button-primary" id="add-transaction">${icon("plus")} Registrar movimiento</button></div><section class="metric-grid"><article class="card metric-card"><h3>Compensación pagada</h3><div class="metric-value">${fmtMoney(paid)}</div><div class="metric-foot"><span>Máximo ${fmtMoney(15000)}</span></div></article><article class="card metric-card"><h3>Fondo recibido</h3><div class="metric-value">${fmtMoney(credits)}</div></article><article class="card metric-card"><h3>Gasto ejecutado</h3><div class="metric-value">${fmtMoney(debits)}</div></article><article class="card metric-card"><h3>Saldo operativo</h3><div class="metric-value">${fmtMoney(credits-debits)}</div></article></section><section class="section-grid"><article class="card section-card"><div class="section-head"><h2>Hitos de pago</h2></div><div class="table-wrap"><table><thead><tr><th>Hito</th><th>Monto</th><th>Estado</th></tr></thead><tbody>${state.payments.map((p) => `<tr><td>${esc(p.label)}</td><td>${fmtMoney(p.amount_usd)}</td><td><span class="status status-${p.status === "paid" ? "accepted" : p.status === "triggered" ? "submitted" : "not_started"}">${esc(p.status)}</span></td></tr>`).join("")}</tbody></table></div></article><article class="card section-card"><div class="section-head"><h2>Últimos movimientos</h2></div><div class="mini-list">${state.funds.slice(0,5).map((f) => `<div class="mini-item"><div class="mini-icon">${icon(f.direction === "credit" ? "arrow-down-left" : "arrow-up-right")}</div><div><strong>${esc(f.description)}</strong><span>${fmtMoney(f.amount_usd)} · ${fmtDate(f.occurred_on)}${f.approved ? "" : " · respaldo pendiente"}</span></div></div>`).join("") || `<div class="empty">Sin movimientos.</div>`}</div></article></section>`;
  }

  function wireShell() {
    document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; state.sidebarOpen = false; renderShell(); }));
    document.querySelector("#period")?.addEventListener("change", (e) => { state.selectedPeriod = e.target.value; renderShell(); });
    document.querySelector("#menu")?.addEventListener("click", () => { state.sidebarOpen = !state.sidebarOpen; document.querySelector("#sidebar").classList.toggle("open", state.sidebarOpen); });
    document.querySelector("#signout")?.addEventListener("click", () => supabase.auth.signOut());
    document.querySelector("#quick-add")?.addEventListener("click", () => openInitiativeModal());
    document.querySelector("#add-initiative")?.addEventListener("click", () => openInitiativeModal());
    document.querySelector("#sync-luma")?.addEventListener("click", openLumaModal);
    document.querySelector("#add-deliverable")?.addEventListener("click", () => openDeliverableModal());
    document.querySelector("#add-transaction")?.addEventListener("click", () => openTransactionModal());
    document.querySelectorAll("[data-view-link]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.viewLink; renderShell(); }));
    document.querySelectorAll("[data-edit-metric]").forEach((b) => b.addEventListener("click", () => openMetricModal(b.dataset.editMetric)));
    document.querySelectorAll("[data-edit-initiative]").forEach((b) => b.addEventListener("click", () => openInitiativeModal(state.initiatives.find((i) => i.id === b.dataset.editInitiative))));
    document.querySelectorAll("[data-edit-deliverable]").forEach((b) => b.addEventListener("click", () => openDeliverableModal(state.deliverables.find((d) => d.id === b.dataset.editDeliverable))));
  }

  function modal(title, body) {
    document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" id="close-modal" aria-label="Cerrar">${icon("x")}</button></header><div class="modal-body">${body}</div></section></div>`);
    document.querySelector("#close-modal").addEventListener("click", closeModal);
    document.querySelector("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
    hydrateIcons(); document.querySelector("#modal input, #modal select")?.focus();
  }
  function closeModal() { document.querySelector("#modal")?.remove(); }
  const lockedPreview = () => { if (!state.preview) return false; notify("La vista previa no escribe en Supabase."); closeModal(); return true; };

  function openMetricModal(metricId) {
    const m = metricWithUpdate(state.metrics.find((x) => x.id === metricId));
    modal(`Actualizar ${m.label}`, `<form id="metric-form"><div class="field"><label for="actual">Avance actual (${esc(m.unit)})</label><input id="actual" name="actual" type="number" min="0" step="1" value="${esc(m.update.actual)}" required /></div><div class="field"><label for="status">Estado</label><select id="status" name="status">${statusOptions(m.update.status)}</select></div><div class="field"><label for="notes">Notas y evidencia pendiente</label><textarea id="notes" name="notes">${esc(m.update.notes || "")}</textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar actualización</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#metric-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const values = Object.fromEntries(new FormData(e.currentTarget)); const { error } = await supabase.from("metric_updates").update({ actual:Number(values.actual), status:values.status, notes:values.notes, updated_by:state.session.user.id }).eq("id", m.update.id); await afterMutation(error, "Métrica actualizada"); };
  }

  function openInitiativeModal(item = {}) {
    modal(item.id ? "Editar actividad" : "Nueva actividad", `<form id="initiative-form"><div class="field"><label for="type">Tipo</label><select id="type" name="type">${Object.entries(typeLabels).map(([v,l]) => `<option value="${v}" ${item.type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label for="title">Nombre</label><input id="title" name="title" value="${esc(item.title || "")}" required /></div><div class="field"><label for="due_on">Fecha objetivo</label><input id="due_on" name="due_on" type="date" value="${esc(item.due_on || "")}" /></div><div class="field"><label for="status">Estado</label><select id="status" name="status">${statusOptions(item.status || "not_started")}</select></div><div class="field"><label for="notes">Notas</label><textarea id="notes" name="notes">${esc(item.notes || "")}</textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar actividad</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#initiative-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const v = Object.fromEntries(new FormData(e.currentTarget)); const payload = { organization_id:state.organization.id, period_id:state.selectedPeriod, type:v.type, title:v.title, due_on:v.due_on || null, status:v.status, notes:v.notes, created_by:state.session.user.id }; const query = item.id ? supabase.from("initiatives").update(payload).eq("id", item.id) : supabase.from("initiatives").insert(payload); const { error } = await query; await afterMutation(error, "Actividad guardada"); };
  }

  async function openLumaModal() {
    if (state.preview) return notify("La vista previa no se conecta con Luma.");
    modal("Importar evento desde Luma", `<div id="luma-content"><div class="loading" style="min-height:12rem"><div><div class="spinner"></div><p>Cargando calendario…</p></div></div></div>`);
    const { data, error } = await supabase.functions.invoke("luma-events", { body: { action:"list" } });
    const content = document.querySelector("#luma-content");
    if (!content) return;
    if (error || data?.error) {
      content.innerHTML = `<div class="form-message">${esc(data?.error || error?.message || "No pudimos conectar con Luma.")}</div>`;
      return;
    }
    const events = data.events || [];
    content.innerHTML = events.length ? `<form id="luma-form"><div class="field"><label for="luma-event">Evento administrado en Luma</label><select id="luma-event" name="event_id" required>${events.map((event) => `<option value="${esc(event.id)}">${esc(event.name)} · ${fmtDate(String(event.start_at || "").slice(0,10))}</option>`).join("")}</select></div><p>Se importarán el enlace, la fecha y los totales de registro y asistencia. No se copiarán datos personales.</p><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Vincular evento</button></div></form>` : `<div class="empty">No hay eventos administrados en este calendario.</div>`;
    document.querySelector("#cancel")?.addEventListener("click", closeModal);
    document.querySelector("#luma-form")?.addEventListener("submit", importLumaEvent);
  }

  async function importLumaEvent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    const { data, error } = await supabase.functions.invoke("luma-events", { body: { action:"details", event_id:form.event_id.value } });
    if (error || data?.error) { button.disabled = false; return notify(data?.error || error?.message || "No pudimos importar el evento.", true); }
    const lumaEvent = data.event;
    const occurredOn = String(lumaEvent.start_at || "").slice(0,10) || null;
    const period = state.periods.find((p) => occurredOn && occurredOn >= p.starts_on && occurredOn <= p.ends_on);
    const payload = {
      organization_id:state.organization.id, period_id:period?.id || state.selectedPeriod, type:"event",
      title:lumaEvent.name, occurred_on:occurredOn, due_on:occurredOn, status:"in_progress",
      luma_event_id:lumaEvent.id, luma_url:lumaEvent.url,
      luma_registered_count:data.registered_count, luma_checked_in_count:data.checked_in_count,
      luma_synced_at:new Date().toISOString(), created_by:state.session.user.id,
    };
    const { error:saveError } = await supabase.from("initiatives").upsert(payload, { onConflict:"organization_id,luma_event_id" });
    await afterMutation(saveError, "Evento de Luma vinculado");
  }

  function openDeliverableModal(item = {}) {
    modal(item.id ? "Editar entregable" : "Nuevo entregable", `<form id="deliverable-form"><div class="field"><label for="title">Entregable</label><input id="title" name="title" value="${esc(item.title || "")}" required /></div><div class="field"><label for="due_on">Fecha límite</label><input id="due_on" name="due_on" type="date" value="${esc(item.due_on || "")}" required /></div><div class="field"><label for="status">Estado</label><select id="status" name="status">${statusOptions(item.status || "not_started")}</select></div><div class="field"><label for="acceptance_notes">Notas de aceptación o corrección</label><textarea id="acceptance_notes" name="acceptance_notes">${esc(item.acceptance_notes || "")}</textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar entregable</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#deliverable-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const v = Object.fromEntries(new FormData(e.currentTarget)); const payload = { organization_id:state.organization.id, period_id:state.selectedPeriod, title:v.title, due_on:v.due_on, status:v.status, acceptance_notes:v.acceptance_notes, submitted_at:v.status === "submitted" ? new Date().toISOString() : item.submitted_at || null, accepted_at:v.status === "accepted" ? new Date().toISOString() : item.accepted_at || null }; const query = item.id ? supabase.from("deliverables").update(payload).eq("id", item.id) : supabase.from("deliverables").insert(payload); const { error } = await query; await afterMutation(error, "Entregable guardado"); };
  }

  function openTransactionModal() {
    modal("Registrar movimiento", `<form id="transaction-form"><div class="field"><label for="occurred_on">Fecha</label><input id="occurred_on" name="occurred_on" type="date" value="${new Date().toISOString().slice(0,10)}" required /></div><div class="field"><label for="direction">Movimiento</label><select id="direction" name="direction"><option value="debit">Gasto</option><option value="credit">Ingreso de fondo</option></select></div><div class="field"><label for="category">Categoría</label><input id="category" name="category" required /></div><div class="field"><label for="description">Descripción</label><input id="description" name="description" required /></div><div class="field"><label for="amount_usd">Monto USD</label><input id="amount_usd" name="amount_usd" type="number" min="0" step="0.01" required /></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Registrar</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#transaction-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const v = Object.fromEntries(new FormData(e.currentTarget)); const { error } = await supabase.from("fund_transactions").insert({ organization_id:state.organization.id, occurred_on:v.occurred_on, direction:v.direction, category:v.category, description:v.description, amount_usd:Number(v.amount_usd), created_by:state.session.user.id }); await afterMutation(error, "Movimiento registrado"); };
  }

  function statusOptions(selected) { return Object.entries(statusLabels).map(([v,l]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${l}</option>`).join(""); }
  async function afterMutation(error, message) { if (error) return notify(error.message, true); closeModal(); notify(message); await loadLiveData(); renderShell(); }

  async function boot() {
    renderLoading();
    if (state.preview) { loadPreviewData(); renderShell(); return; }
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    if (!state.session) { renderAuth(); return; }
    if (!state.session.user.user_metadata?.password_configured) { renderPasswordSetup(); return; }
    try { if (await loadLiveData()) renderShell(); }
    catch (error) { console.error(error); $app.innerHTML = `<main class="auth-panel" id="main"><section class="auth-card card" style="padding:2rem"><span class="eyebrow">Configuración pendiente</span><h2>No pudimos cargar el dashboard</h2><p>El esquema de Stellar Ops aún no está disponible en este proyecto o tu usuario no tiene acceso.</p><code>${esc(error.message)}</code><div style="margin-top:1.2rem"><button class="button button-secondary" id="retry">Reintentar</button></div></section></main>`; document.querySelector("#retry").onclick = boot; }
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    const changed = state.session?.access_token !== session?.access_token;
    state.session = session;
    if (changed) setTimeout(boot, 0);
  });
  boot();
})();
