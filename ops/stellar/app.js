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
    metrics: [], updates: [], initiatives: [], deliverables: [], payments: [], funds: [], members: [], programs: [], contacts: [], participants: [], budgets: [], resources: [], evidence: [], audit: [], selectedProgram:"global", importRows:[],
    view: "dashboard", sidebarOpen: false, preview: PREVIEW,
    participantFilters: { search:"", rank:"all", city:"all", country:"all", from:"", to:"" },
  };
  let participantSearchTimer;

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
    $app.innerHTML = `<main aria-busy="true" aria-labelledby="loading-title" style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f4ed;color:#183034;font-family:Inter,system-ui,sans-serif"><section style="width:min(420px,100%);padding:28px;border:1px solid #d9d2c7;border-radius:18px;background:#fffdf8;box-shadow:0 12px 32px rgba(24,48,52,.08)"><span style="display:block;color:#c75a2a;font:600 12px/1.2 monospace;letter-spacing:.12em;text-transform:uppercase">Tellus Cooperative</span><h1 id="loading-title" style="margin:10px 0 8px;font:600 30px/1.1 Georgia,serif">Stellar Ops</h1><p style="margin:0 0 22px;color:#607276;line-height:1.5">Preparando tu espacio de gestión…</p><div style="display:flex;align-items:center;gap:10px;color:#607276;font-size:14px"><span aria-hidden="true" style="display:block;width:20px;height:20px;flex:0 0 20px;border:2px solid #d9d2c7;border-top-color:#2f7478;border-radius:50%;animation:spin .8s linear infinite"></span><span>Cargando datos</span></div></section></main>`;
  }

  function renderAuth() {
    $app.innerHTML = `
      <main class="auth-shell" id="main">
        <section class="auth-brand" aria-labelledby="auth-brand-title">
          <div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Tellus Cooperative</div>
          <div><span class="eyebrow" style="color:#f1a479">Operaciones</span><h1 id="auth-brand-title">Gestión Tellus Cooperative.</h1></div>
        </section>
        <section class="auth-panel">
          <form class="auth-card" id="login-form">
            <span class="eyebrow">Acceso seguro</span><h2>Entrar al dashboard</h2><p>Usa tu cuenta autorizada por Tellus.</p>
            <div class="field"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="email" required /></div>
            <div class="field"><label for="password">Contraseña</label><div class="password-input"><input id="password" name="password" type="password" autocomplete="current-password" minlength="8" /><button type="button" data-password-toggle="password" aria-label="Mostrar contraseña">${icon("eye")}</button></div></div>
            <div class="auth-actions">
              <button class="button button-primary button-block" type="submit">${icon("log-in")} Entrar</button>
              <button class="button button-secondary button-block" type="button" id="first-access" hidden>Crear contraseña por primera vez</button>
              <a class="button button-ghost" href="?preview=1">Ver vista previa del contrato</a>
            </div><div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    hydrateIcons();
    wirePasswordToggles();
    document.querySelector("#login-form").addEventListener("submit", signIn);
    document.querySelector("#first-access").addEventListener("click", renderFirstAccess);
    updateFirstAccessAvailability();
  }

  async function updateFirstAccessAvailability() {
    const button = document.querySelector("#first-access");
    if (!button) return;
    const { data, error } = await supabase.functions.invoke("first-access", { body: { action: "status" } });
    button.hidden = !error && data?.available === false;
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
            <div class="field"><label for="setup-password">Nueva contraseña</label><div class="password-input"><input id="setup-password" name="password" type="password" autocomplete="new-password" minlength="10" required /><button type="button" data-password-toggle="setup-password" aria-label="Mostrar contraseña">${icon("eye")}</button></div><small>Mínimo 10 caracteres.</small></div>
            <div class="field"><label for="setup-confirmation">Confirmar contraseña</label><div class="password-input"><input id="setup-confirmation" name="confirmation" type="password" autocomplete="new-password" minlength="10" required /><button type="button" data-password-toggle="setup-confirmation" aria-label="Mostrar contraseña">${icon("eye")}</button></div></div>
            <button class="button button-primary button-block" type="submit">Crear contraseña y entrar</button>
            <button class="button button-ghost button-block" type="button" id="back-to-login">Volver al acceso</button>
            <div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    hydrateIcons();
    wirePasswordToggles();
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
    setButtonLoading(button, "Configurando…");
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const { data, error } = await supabase.functions.invoke("first-access", {
      body: { email, code: form.code.value.trim(), password },
    });
    if (error || data?.error) {
      message.textContent = data?.error || "No pudimos configurar la cuenta.";
      resetButton(button, "Crear contraseña y entrar");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      message.textContent = "Contraseña creada. Vuelve al acceso e inicia sesión.";
      resetButton(button, "Crear contraseña y entrar");
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
            <div class="field"><label for="new-password">Nueva contraseña</label><div class="password-input"><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="10" required /><button type="button" data-password-toggle="new-password" aria-label="Mostrar contraseña">${icon("eye")}</button></div><small>Mínimo 10 caracteres.</small></div>
            <div class="field"><label for="confirm-password">Confirmar contraseña</label><div class="password-input"><input id="confirm-password" name="confirmation" type="password" autocomplete="new-password" minlength="10" required /><button type="button" data-password-toggle="confirm-password" aria-label="Mostrar contraseña">${icon("eye")}</button></div></div>
            <button class="button button-primary button-block" type="submit">Guardar contraseña y continuar</button>
            <div class="form-message" id="auth-message" role="alert"></div>
          </form>
        </section>
      </main>`;
    hydrateIcons();
    wirePasswordToggles();
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
    setButtonLoading(button, "Guardando…");
    const currentData = state.session.user.user_metadata || {};
    const { data, error } = await supabase.auth.updateUser({
      password: form.password.value,
      data: { ...currentData, password_configured: true },
    });
    if (error) {
      resetButton(button, "Guardar contraseña y continuar");
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
    setButtonLoading(button, "Entrando…");
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    if (error) { resetButton(button, "Entrar"); document.querySelector("#auth-message").textContent = "No pudimos iniciar sesión. Revisa tu correo y contraseña."; }
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
    const [periods, metrics, updates, initiatives, deliverables, payments, funds, members, programs, contacts, participants, budgets, resources, evidence, audit] = await Promise.all([
      supabase.from("reporting_periods").select("*").eq("organization_id", orgId).order("starts_on"),
      supabase.from("metric_definitions").select("*").eq("organization_id", orgId).order("sort_order"),
      supabase.from("metric_updates").select("*").eq("organization_id", orgId),
      supabase.from("initiatives").select("*").eq("organization_id", orgId).order("due_on"),
      supabase.from("deliverables").select("*").eq("organization_id", orgId).order("due_on"),
      supabase.from("payment_milestones").select("*").eq("organization_id", orgId).order("sort_order"),
      supabase.from("fund_transactions").select("*").eq("organization_id", orgId).order("occurred_on", { ascending:false }),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("programs").select("*").eq("organization_id", orgId).eq("active", true).order("name"),
      supabase.from("event_contacts").select("id,initiative_id,email,attendance_status,consent_recorded").eq("organization_id", orgId),
      supabase.from("program_participants").select("*").eq("organization_id", orgId).order("full_name"),
      supabase.from("program_budgets").select("*").eq("organization_id", orgId),
      supabase.from("program_resources").select("*").eq("organization_id", orgId).order("created_at", { ascending:false }),
      supabase.from("evidence").select("id,program_id,initiative_id,deliverable_id,title,kind,url,storage_path,created_at").eq("organization_id", orgId).order("created_at", { ascending:false }),
      supabase.from("audit_log").select("id,program_id,actor_user_id,action,entity_table,entity_id,entity_label,created_at").eq("organization_id", orgId).order("created_at", { ascending:false }).limit(200),
    ]);
    const failed = [periods, metrics, updates, initiatives, deliverables, payments, funds, members, programs, contacts, participants, budgets, resources, evidence, audit].find((r) => r.error);
    if (failed) throw failed.error;
    Object.assign(state, { periods:periods.data, metrics:metrics.data, updates:updates.data, initiatives:initiatives.data, deliverables:deliverables.data, payments:payments.data, funds:funds.data, members:members.data, programs:programs.data, contacts:contacts.data, participants:participants.data, budgets:budgets.data, resources:resources.data, evidence:evidence.data, audit:audit.data });
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
    state.members = [
      { id:"preview-1", full_name:"Responsable Tellus" },
      { id:"preview-2", full_name:"Equipo Comunidad" },
    ];
    state.programs = ["Stellar Chile","Stellar Barrio","Stellar Academy","Coffee Breaks"].map((name, index) => ({ id:`program-${index}`, name }));
    state.contacts = [];
    state.participants = []; state.budgets = []; state.resources = []; state.evidence = []; state.audit = [];
  }

  function currentPeriod() { return state.periods.find((p) => p.id === state.selectedPeriod) || state.periods[0]; }
  function periodUpdates() { return state.updates.filter((u) => u.period_id === state.selectedPeriod); }
  function metricWithUpdate(metric) { return { ...metric, update: periodUpdates().find((u) => u.metric_id === metric.id) || { actual:0, status:"not_started" } }; }
  function selectedProgram() { return state.programs.find((program) => program.id === state.selectedProgram); }
  function inProgram(row) { return state.selectedProgram === "global" || row.program_id === state.selectedProgram; }
  function periodInitiatives() { return state.initiatives.filter((i) => (!i.period_id || i.period_id === state.selectedPeriod) && inProgram(i)); }
  function programDeliverables() { return state.deliverables.filter(inProgram); }
  function programName(id) { return state.programs.find((program) => program.id === id)?.name || "Sin programa"; }
  function programOptions(selected) { return `<option value="">Sin programa</option>${state.programs.map((program) => `<option value="${esc(program.id)}" ${selected === program.id ? "selected" : ""}>${esc(program.name)}</option>`).join("")}`; }
  function contactEmails(itemId) { return state.contacts.filter((contact) => contact.initiative_id === itemId).map((contact) => contact.email).join("\n"); }
  function ownerName(id) { return state.members.find((member) => member.id === id)?.full_name || "Sin asignar"; }
  function leadName(program) { const names={"alexbnjmnch@gmail.com":"Alex Hernández","inboxblessedux@gmail.com":"Joaquín Farfán","bastian@telluscoop.org":"Bastian Koh","kohcuendedani@gmail.com":"Daniel","mishekoh@gmail.com":"Mishelle"}; const emails=Array.isArray(program?.lead_emails)&&program.lead_emails.length?program.lead_emails:[program?.lead_email].filter(Boolean); return emails.length?emails.map((email)=>names[email]||email).join(" y "):(program?.lead_user_id?ownerName(program.lead_user_id):"Sin responsable"); }
  function currentUserIdentity() { if(state.preview)return {name:"Vista previa",responsibility:"Administración"}; const email=state.session?.user?.email?.toLowerCase()||""; const fallback={"kohcuendepau@gmail.com":"Pau Koh","hola@telluscoop.org":"Tellus Cooperative Admin","bastian@telluscoop.org":"Bastian Koh","mishekoh@gmail.com":"Mishelle","kohcuendedani@gmail.com":"Daniel","alexbnjmnch@gmail.com":"Alex Hernández","inboxblessedux@gmail.com":"Joaquín Farfán"}; const name=state.members.find((member)=>member.id===state.session?.user?.id)?.full_name||fallback[email]||email; const programs=state.programs.filter((program)=>{const leads=Array.isArray(program.lead_emails)&&program.lead_emails.length?program.lead_emails:[program.lead_email].filter(Boolean);return leads.includes(email);}).map((program)=>program.name); return {name,responsibility:programs.length?programs.join(" · "):"Administración general"}; }
  function ownerOptions(selected) { return `<option value="">Sin asignar</option>${state.members.map((member) => `<option value="${esc(member.id)}" ${selected === member.id ? "selected" : ""}>${esc(member.full_name)}</option>`).join("")}`; }
  function linksFromText(value) { return String(value || "").split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url })); }
  function linksText(links) { return Array.isArray(links) ? links.map((link) => link.url || "").filter(Boolean).join("\n") : ""; }
  function resourceLinks(links) { return Array.isArray(links) ? links.slice(0,3).map((link) => `<a class="table-link" href="${esc(link.url)}" target="_blank" rel="noopener">${icon("link")} Recurso</a>`).join("") : ""; }

  function renderShell() {
    const viewLabels = { dashboard:state.selectedProgram === "global" ? "Resumen global" : "Resumen", program_metrics:"Métricas", initiatives:"Eventos", deliverables:"Entregables", finance:"Gastos", resources:"Planillas y recursos", participants:"Participantes", evidence:"Evidencias", activity:"Actividad" };
    const userIdentity=currentUserIdentity();
    $app.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar ${state.sidebarOpen ? "open" : ""}" id="sidebar">
          <div class="sidebar-head"><div class="brand-mark"><img src="/uploads/TellusCooperative ICON.png" alt="" /> Stellar Ops</div></div>
          <div class="program-switcher"><label for="program-scope">Espacio operativo</label><select id="program-scope"><option value="global" ${state.selectedProgram === "global" ? "selected" : ""}>Toda la operación</option>${state.programs.map((program) => `<option value="${esc(program.id)}" ${state.selectedProgram === program.id ? "selected" : ""}>${esc(program.name)}</option>`).join("")}</select></div>
          <nav class="nav" aria-label="Principal">
            ${navButton("dashboard","layout-dashboard",state.selectedProgram === "global" ? "Resumen global" : "Resumen")}${navButton("program_metrics","gauge","Métricas")}${navButton("initiatives","calendar-days","Eventos")}${navButton("finance","circle-dollar-sign","Gastos")}${navButton("resources","table-properties","Planillas")}${navButton("participants","users","Participantes")}${navButton("evidence","folder-check","Evidencias")}${navButton("deliverables","file-check-2","Entregables")}${navButton("activity","history","Actividad")}
          </nav>
          <div class="sidebar-footer"><div class="user-meta" title="${esc(state.preview?"Vista previa":state.session?.user?.email||"")}"><strong>${esc(userIdentity.name)}</strong><span>${esc(userIdentity.responsibility)}</span></div>${state.preview ? `<a class="button button-ghost" href="./">${icon("log-in")} Ir al acceso</a>` : `<button class="button button-ghost" id="signout">${icon("log-out")} Cerrar sesión</button>`}</div>
        </aside>
        <main class="main" id="main">
          <header class="topbar"><div class="topbar-title"><h1>${viewLabels[state.view]}</h1><p>${esc(state.organization?.name || "Tellus")}</p></div><div class="topbar-actions"><label class="sr-only" for="period">Período</label><select class="period-select" id="period">${state.periods.map((p) => `<option value="${esc(p.id)}" ${p.id === state.selectedPeriod ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select><button class="button button-primary" id="quick-add">${icon("plus")} Registrar</button></div></header>
          <div class="content">${state.preview ? `<div class="preview-banner"><strong>Vista previa.</strong> Metas contractuales reales con actividad ilustrativa. No corresponde a información productiva.</div>` : ""}<div id="view">${renderView()}</div></div>
        </main>
      </div>`;
    wireShell(); hydrateIcons();
  }

  function navButton(view, iconName, label) { return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${icon(iconName)} ${label}</button>`; }
  function renderView() { return state.view === "dashboard" ? dashboardView() : state.view === "program_metrics" ? metricsView() : state.view === "initiatives" ? initiativesView() : state.view === "deliverables" ? deliverablesView() : state.view === "finance" ? financeView() : state.view === "resources" ? resourcesView() : state.view === "participants" ? participantsView() : state.view === "activity" ? activityView() : evidenceView(); }

  function dashboardView() {
    if (state.selectedProgram === "global") return globalDashboardView();
    const metrics = state.metrics.filter(inProgram).map(metricWithUpdate);
    const completion = metrics.length ? Math.round(metrics.reduce((sum,m) => sum + Math.min(1, Number(m.update.actual)/Number(m.target || 1)), 0) / metrics.length * 100) : 0;
    const period = currentPeriod();
    const scopedDeliverables = state.deliverables.filter(inProgram);
    const next = scopedDeliverables.filter((d) => d.status !== "accepted").sort((a,b) => String(a.due_on).localeCompare(String(b.due_on)))[0];
    const metricCards = metrics.map((m) => {
      const pct = Math.min(100, Math.round(Number(m.update.actual) / Number(m.target || 1) * 100));
      return `<article class="card metric-card"><div class="metric-head"><h3>${esc(m.label)}</h3>${status(m.update.status)}</div><div class="metric-value">${esc(m.update.actual)} <small>/ ${esc(m.target)} ${esc(m.unit)}</small></div><div class="bar" aria-label="${pct}% cumplido"><span style="width:${pct}%"></span></div><div class="metric-foot"><span>${pct}%</span><button class="table-link" data-edit-metric="${esc(m.id)}">Actualizar</button></div></article>`;
    }).join("");
    return `<section class="hero"><article class="card hero-card"><div><span class="eyebrow">${esc(period?.label || "Período")}</span><h2>${completion >= 100 ? "Objetivos cubiertos" : completion >= 70 ? "Buen avance, quedan brechas" : "Necesitamos acelerar"}</h2><p>${metrics.filter((m) => ["at_risk","blocked"].includes(m.update.status)).length} métricas requieren atención. Cada valor debe quedar respaldado por evidencia verificable.</p></div><div class="progress-ring" style="--progress:${completion}" aria-label="Cumplimiento ${completion}%"><strong>${completion}%</strong></div></article><article class="card deadline-card"><div><span class="eyebrow">Próximo vencimiento</span><div class="date">${next ? fmtDate(next.due_on) : "Al día"}</div><p>${next ? esc(next.title) : "No hay entregables pendientes."}</p></div>${next ? status(next.status) : ""}</article></section><section class="metric-grid">${metricCards}</section><section class="section-grid"><article class="card section-card"><div class="section-head"><div><h2>Entregables próximos</h2><p>De ejecutar a aceptar, sin perder trazabilidad.</p></div><button class="table-link" data-view-link="deliverables">Ver todos</button></div>${deliverablesTable(scopedDeliverables.slice(0,5))}</article><article class="card section-card"><div class="section-head"><div><h2>Acciones prioritarias</h2><p>Lo que puede afectar cumplimiento o pago.</p></div></div><div class="mini-list">${priorityItems(metrics, next)}</div></article></section>`;
  }

  function globalDashboardView() {
    const cards = state.programs.map((program) => {
      const events = state.initiatives.filter((item) => item.program_id === program.id && item.type === "event").length;
      const initiativeIds = new Set(state.initiatives.filter((item) => item.program_id === program.id).map((item) => item.id));
      const contacts = state.contacts.filter((contact) => initiativeIds.has(contact.initiative_id)).length;
      const budget = state.budgets.filter((row) => row.program_id === program.id && row.period_id === state.selectedPeriod).reduce((sum,row) => sum + Number(row.allocated_usd), 0);
      const spent = state.funds.filter((row) => row.program_id === program.id && row.direction === "debit").reduce((sum,row) => sum + Number(row.amount_usd), 0);
      return `<button class="card program-card" data-open-program="${esc(program.id)}"><span class="eyebrow">Programa</span><h2>${esc(program.name)}</h2><p class="program-lead">${icon("user-round-check")} ${esc(leadName(program))}</p><div class="program-stats"><span><strong>${events}</strong> eventos</span><span><strong>${contacts}</strong> participantes</span><span><strong>${fmtMoney(spent)}</strong> gastado</span><span><strong>${fmtMoney(budget)}</strong> presupuesto del período</span></div></button>`;
    }).join("");
    const totalSpent = state.funds.filter((row) => row.direction === "debit").reduce((sum,row) => sum + Number(row.amount_usd), 0);
    const totalBudget = state.budgets.filter((row) => row.period_id === state.selectedPeriod).reduce((sum,row) => sum + Number(row.allocated_usd), 0);
    return `<section class="hero"><article class="card hero-card"><div><span class="eyebrow">Toda la operación</span><h2>Programas Tellus</h2><p>Visión consolidada sin mezclar la ejecución interna de cada programa.</p></div></article><article class="card deadline-card"><div><span class="eyebrow">Presupuesto consolidado</span><div class="date">${fmtMoney(totalSpent)} / ${fmtMoney(totalBudget)}</div><p>Gasto ejecutado frente al presupuesto del período.</p></div></article></section><section class="program-grid">${cards}</section>`;
  }

  function metricsView() {
    const metrics = state.metrics.filter(inProgram).map(metricWithUpdate);
    const addButton = state.selectedProgram !== "global" ? `<button class="button button-primary" id="add-metric">${icon("plus")} Nueva métrica</button>` : "";
    if (!metrics.length) return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Métricas</h2></div>${addButton}</div><div class="empty">Todavía no hay métricas configuradas para este espacio.</div>`;
    return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Métricas del período</h2></div>${addButton}</div><section class="metric-grid">${metrics.map((m) => { const pct=Math.min(100,Math.round(Number(m.update.actual)/Number(m.target||1)*100)); return `<article class="card metric-card"><div class="metric-head"><h3>${esc(m.label)}</h3>${status(m.update.status)}</div><div class="metric-value">${esc(m.update.actual)} <small>/ ${esc(m.target)} ${esc(m.unit)}</small></div><div class="bar"><span style="width:${pct}%"></span></div><div class="metric-foot"><span>${pct}%</span><button class="table-link" data-edit-metric="${esc(m.id)}">Actualizar</button></div></article>`; }).join("")}</section>`;
  }

  function priorityItems(metrics, next) {
    const items = metrics.filter((m) => ["at_risk","blocked"].includes(m.update.status)).slice(0,3).map((m) => ({ icon:"triangle-alert", title:m.label, detail:`${m.update.actual} de ${m.target} ${m.unit}` }));
    if (next) items.unshift({ icon:"calendar-clock", title:next.title, detail:`Vence ${fmtDate(next.due_on)}` });
    if (!items.length) return `<div class="empty">Sin alertas activas.</div>`;
    return items.slice(0,4).map((i) => `<div class="mini-item"><div class="mini-icon">${icon(i.icon)}</div><div><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></div></div>`).join("");
  }

  function deliverablesTable(rows) {
    if (!rows.length) return `<div class="empty">${icon("inbox")}<div>No hay entregables.</div></div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Entregable</th><th>Responsable</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map((d) => `<tr><td><button class="table-link" data-edit-deliverable="${esc(d.id)}">${esc(d.title)}</button>${resourceLinks(d.resource_links)}</td><td>${esc(ownerName(d.owner_id))}</td><td>${fmtDate(d.due_on)}</td><td>${status(d.status)}</td><td><button class="icon-button" data-edit-deliverable="${esc(d.id)}" aria-label="Editar ${esc(d.title)}">${icon("pencil")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function initiativesView() {
    const groups = ["not_started","in_progress","at_risk","submitted"];
    return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Eventos y actividades</h2></div><div class="topbar-actions"><button class="button button-secondary" id="sync-luma">${icon("calendar-sync")} Importar desde Luma</button><button class="button button-primary" id="add-initiative">${icon("plus")} Nueva actividad</button></div></div><div class="kanban">${groups.map((g) => `<section class="kanban-column"><div class="kanban-title">${statusLabels[g]} <span class="kanban-count">${periodInitiatives().filter((i) => i.status === g).length}</span></div>${periodInitiatives().filter((i) => i.status === g).map(workCard).join("") || `<div class="empty">Sin actividades</div>`}</section>`).join("")}</div>`;
  }
  function workCard(item) { return `<article class="work-card"><span class="type-chip">${esc(programName(item.program_id))}</span><span class="type-chip">${esc(typeLabels[item.type] || item.type)}</span><h3>${esc(item.title)}</h3><div class="work-meta"><span>${icon("user-round")} ${esc(ownerName(item.owner_id))}</span><span>${icon("mail")} ${state.contacts.filter((contact) => contact.initiative_id === item.id).length} contactos</span></div>${item.luma_event_id ? `<div class="work-meta"><span>${icon("users")} ${esc(item.luma_registered_count)} registrados · ${esc(item.luma_checked_in_count)} check-ins</span></div>` : ""}<div class="work-meta"><span>${icon("calendar")} ${fmtDate(item.due_on || item.occurred_on)}</span>${item.luma_url ? `<a class="table-link" href="${esc(item.luma_url)}" target="_blank" rel="noopener">Luma</a>` : ""}${resourceLinks(item.resource_links)}<button class="table-link" data-edit-initiative="${esc(item.id)}">Editar</button></div></article>`; }

  function deliverablesView() {
    return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Entregables</h2></div><button class="button button-primary" id="add-deliverable">${icon("plus")} Nuevo entregable</button></div><article class="card section-card">${deliverablesTable(programDeliverables())}</article>`;
  }

  function financeView() {
    const scopedFunds = state.funds.filter(inProgram);
    const credits = scopedFunds.filter((f) => f.direction === "credit").reduce((s,f) => s + Number(f.amount_usd), 0);
    const debits = scopedFunds.filter((f) => f.direction === "debit").reduce((s,f) => s + Number(f.amount_usd), 0);
    const budget = state.budgets.filter((row) => inProgram(row) && row.period_id === state.selectedPeriod).reduce((sum,row) => sum + Number(row.allocated_usd),0);
    const actions = `${state.selectedProgram !== "global" ? `<button class="button button-secondary" id="set-budget">${icon("wallet-cards")} Definir presupuesto</button>` : ""}<button class="button button-primary" id="add-transaction">${icon("plus")} Registrar movimiento</button>`;
    const movements = scopedFunds.slice(0,10).map((f) => `<div class="mini-item"><div class="mini-icon">${icon(f.direction === "credit" ? "arrow-down-left" : "arrow-up-right")}</div><div><strong>${esc(f.description)}</strong><span>${fmtMoney(f.amount_usd)} · ${fmtDate(f.occurred_on)}${f.approved ? "" : " · respaldo pendiente"}</span></div></div>`).join("") || `<div class="empty">Sin movimientos.</div>`;
    return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Gastos y presupuesto</h2></div><div class="topbar-actions">${actions}</div></div><section class="metric-grid"><article class="card metric-card"><h3>Presupuesto del período</h3><div class="metric-value">${fmtMoney(budget)}</div></article><article class="card metric-card"><h3>Fondo recibido</h3><div class="metric-value">${fmtMoney(credits)}</div></article><article class="card metric-card"><h3>Gasto ejecutado</h3><div class="metric-value">${fmtMoney(debits)}</div></article><article class="card metric-card"><h3>Disponible</h3><div class="metric-value">${fmtMoney(budget-debits)}</div></article></section><article class="card section-card"><div class="section-head"><h2>Últimos movimientos</h2></div><div class="mini-list">${movements}</div></article>`;
  }

  function resourcesView() { const rows=state.resources.filter(inProgram); return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Planillas y recursos</h2></div>${state.selectedProgram !== "global" ? `<button class="button button-primary" id="add-resource">${icon("plus")} Añadir enlace</button>` : ""}</div><section class="resource-grid">${rows.map((row)=>`<a class="card resource-card" href="${esc(row.url)}" target="_blank" rel="noopener"><span class="type-chip">${esc(row.resource_type.replaceAll("_"," "))}</span><h3>${esc(row.title)}</h3><p>${esc(row.description || "Abrir recurso")}</p></a>`).join("") || `<div class="empty">No hay planillas o recursos en este espacio.</div>`}</section>`; }
  function participantLink(iconName, label, href, external=false) { return label ? `<a class="contact-link" href="${esc(href)}" ${external ? `target="_blank" rel="noopener"` : ""}>${icon(iconName)}<span>${esc(label)}</span></a>` : ""; }
  function participantContact(iconName, label) { return label ? `<span class="contact-link contact-static">${icon(iconName)}<span>${esc(label)}</span></span>` : ""; }
  function participantDiscord(label) { return label ? `<span class="contact-link contact-static"><img class="brand-icon" src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/discord.svg" alt="" /><span>${esc(label)}</span></span>` : ""; }
  function rankBadge(row) { const rank=row.participant_rank || "Explorer"; const icons={Explorer:"compass",Builder:"hammer",Contributor:"git-branch",Leader:"crown"}; return `<span class="rank-badge rank-${esc(rank.toLowerCase())}">${icon(icons[rank]||"badge-check")} ${esc(rank)}</span>`; }
  function participantDetails(row) { const details=[["map-pin",[row.city,row.country].filter(Boolean).join(", ")],["briefcase-business",row.project_company],["badge-check",row.program_status],["users-round",row.program_role],["calendar-check",`${row.events_attended_count ?? 0} eventos asistidos`],["sparkles",row.experience],["notebook-text",row.classification_note]]; return `<details class="participant-details"><summary>Ver ficha completa</summary><div class="participant-detail-grid">${details.filter(([,value])=>value).map(([name,value])=>`<span>${icon(name)}<span>${esc(value)}</span></span>`).join("") || `<span>Sin información adicional.</span>`}</div></details>`; }
  function participantFilterRows(rows) {
    const f=state.participantFilters; const query=f.search.trim().toLowerCase();
    return rows.filter((row)=>{
      const joined=[row.full_name,row.email,row.github,row.discord,row.city,row.country,row.project_company].filter(Boolean).join(" ").toLowerCase();
      const date=String(row.imported_at||"").slice(0,10);
      return (!query||joined.includes(query))&&(f.rank==="all"||row.participant_rank===f.rank)&&(f.city==="all"||row.city===f.city)&&(f.country==="all"||row.country===f.country)&&(!f.from||date>=f.from)&&(!f.to||date<=f.to);
    });
  }
  function participantAnalytics(rows) { const ranks=["Explorer","Builder","Contributor","Leader"]; const counts=Object.fromEntries(ranks.map((rank)=>[rank,rows.filter((row)=>row.participant_rank===rank).length])); const max=Math.max(1,...Object.values(counts)); const events=rows.reduce((sum,row)=>sum+Number(row.events_attended_count||0),0); const advanced=rows.length-counts.Explorer; const github=rows.filter((row)=>row.github).length; return `<section class="roster-analytics"><div class="roster-stat-grid"><article class="card roster-stat">${icon("users")}<strong>${rows.length}</strong><span>participantes</span></article><article class="card roster-stat">${icon("calendar-check")}<strong>${events}</strong><span>asistencias</span></article><article class="card roster-stat">${icon("trending-up")}<strong>${advanced}</strong><span>Builder o superior</span></article><article class="card roster-stat">${icon("github")}<strong>${github}</strong><span>con GitHub</span></article></div><article class="card section-card compact-rank-chart"><div class="section-head"><div><h2>Distribución por rango</h2><p>Resumen de los resultados visibles.</p></div></div>${ranks.map((rank)=>`<div class="compact-rank-row">${rankBadge({participant_rank:rank})}<div><span class="compact-rank-bar rank-bar-${rank.toLowerCase()}" style="width:${Math.round(counts[rank]/max*100)}%"></span></div><strong>${counts[rank]}</strong></div>`).join("")}</article></section>`; }
  function participantsView() {
    const allRows=state.participants.filter(inProgram); const rows=participantFilterRows(allRows); const f=state.participantFilters;
    const cities=[...new Set(allRows.map((row)=>row.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")); const countries=[...new Set(allRows.map((row)=>row.country).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    const actions=`<button class="button button-secondary" id="export-participants">${icon("download")} Exportar CSV</button>${state.selectedProgram !== "global" ? `<button class="button button-primary" id="import-participants">${icon("file-up")} Importar planilla</button>` : ""}`;
    return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Participantes</h2></div><div class="topbar-actions">${actions}</div></div>
      <article class="card roster-filter-card"><form id="participant-filter-form" class="roster-filter-grid"><div class="field filter-search"><label for="participant-search">Buscar</label><div class="filter-input-icon">${icon("search")}<input id="participant-search" name="search" value="${esc(f.search)}" placeholder="Nombre, correo, GitHub, Discord…" /></div></div><div class="field"><label for="participant-rank">Rango</label><select id="participant-rank" name="rank"><option value="all">Todos</option>${["Explorer","Builder","Contributor","Leader"].map((rank)=>`<option value="${rank}" ${f.rank===rank?"selected":""}>${rank}</option>`).join("")}</select></div><div class="field"><label for="participant-city">Ciudad</label><select id="participant-city" name="city"><option value="all">Todas</option>${cities.map((city)=>`<option value="${esc(city)}" ${f.city===city?"selected":""}>${esc(city)}</option>`).join("")}</select></div><div class="field"><label for="participant-country">País</label><select id="participant-country" name="country"><option value="all">Todos</option>${countries.map((country)=>`<option value="${esc(country)}" ${f.country===country?"selected":""}>${esc(country)}</option>`).join("")}</select></div><div class="field"><label for="participant-from">Desde</label><input id="participant-from" name="from" type="date" value="${esc(f.from)}" /></div><div class="field"><label for="participant-to">Hasta</label><input id="participant-to" name="to" type="date" value="${esc(f.to)}" /></div><div class="filter-actions"><button class="button button-primary" type="submit">${icon("sliders-horizontal")} Filtrar</button><button class="button button-ghost" id="clear-participant-filters" type="button">Limpiar</button></div></form></article>
      <article class="card section-card roster-table-card"><div class="section-head"><div><h2>Roster</h2><p>Mostrando ${rows.length} de ${allRows.length} participantes · sin paginación.</p></div></div><div class="table-wrap"><table class="participant-table"><thead><tr><th>Persona</th><th>Contactos</th><th>Ciudad</th><th>Eventos</th><th>Rango</th><th>Incorporación</th><th></th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${esc(row.full_name||"Sin nombre")}</strong>${row.project_company?`<small>${esc(row.project_company)}</small>`:""}</td><td><div class="table-contacts">${participantLink("mail",row.email,`mailto:${row.email}`)}${participantLink("github",row.github,row.github?.startsWith("http")?row.github:`https://github.com/${String(row.github||"").replace(/^@/,"")}`,true)}${participantDiscord(row.discord)}${participantLink("message-circle-more",row.phone,`https://wa.me/${String(row.phone||"").replace(/\D/g,"")}`,true)}</div></td><td>${row.city?`${icon("map-pin")} ${esc(row.city)}`:"—"}</td><td><span class="event-count">${icon("calendar-check")} <strong>${esc(row.events_attended_count??0)}</strong></span></td><td>${rankBadge(row)}</td><td>${fmtDate(String(row.imported_at||"").slice(0,10))}</td><td>${state.preview?"":`<div class="row-actions"><button class="icon-button" data-edit-participant="${esc(row.id)}" aria-label="Editar ${esc(row.full_name||row.email)}">${icon("pencil")}</button><button class="icon-button" data-manage-rank="${esc(row.id)}" aria-label="Gestionar rango de ${esc(row.full_name||row.email)}">${icon("badge-check")}</button></div>`}</td></tr>`).join("")}</tbody></table></div>${rows.length?"":`<div class="empty">No encontramos participantes con estos filtros.</div>`}</article>${participantAnalytics(rows)}`;
  }
  function activityView() { const rows=state.audit.filter(inProgram); const actions={insert:"Creó",update:"Modificó",delete:"Eliminó"}; const entities={programs:"programa",program_budgets:"presupuesto",program_resources:"recurso",program_participants:"participante",initiatives:"evento",deliverables:"entregable",evidence:"evidencia",fund_transactions:"movimiento",metric_definitions:"métrica",metric_updates:"avance",event_contacts:"contacto"}; const actor=(id)=>id ? ownerName(id) : "Sistema"; const when=(value)=>new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); return `<div class="toolbar"><div><span class="eyebrow">Trazabilidad</span><h2>Actividad del equipo</h2></div></div><article class="card section-card"><div class="mini-list">${rows.map((row)=>`<div class="mini-item"><div class="mini-icon">${icon(row.action==="delete"?"trash-2":row.action==="insert"?"plus":"pencil")}</div><div><strong>${esc(actor(row.actor_user_id))} · ${esc(actions[row.action]||row.action)} ${esc(entities[row.entity_table]||row.entity_table)}</strong><span>${esc(row.entity_label||"Registro")} · ${esc(programName(row.program_id))} · ${esc(when(row.created_at))}</span></div></div>`).join("") || `<div class="empty">Todavía no hay actividad registrada.</div>`}</div></article>`; }
  function evidenceView() { const rows=state.evidence.filter(inProgram); return `<div class="toolbar"><div><span class="eyebrow">${esc(selectedProgram()?.name || "Toda la operación")}</span><h2>Evidencias</h2></div></div><section class="resource-grid">${rows.map((row)=>`<article class="card resource-card"><span class="type-chip">${esc(row.kind)}</span><h3>${esc(row.title)}</h3>${row.url ? `<a class="table-link" href="${esc(row.url)}" target="_blank" rel="noopener">Abrir evidencia</a>` : `<p>Archivo privado</p>`}</article>`).join("") || `<div class="empty">No hay evidencias cargadas.</div>`}</section>`; }

  function wireShell() {
    document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; state.sidebarOpen = false; renderShell(); }));
    document.querySelector("#period")?.addEventListener("change", (e) => { state.selectedPeriod = e.target.value; renderShell(); });
    document.querySelector("#program-scope")?.addEventListener("change", (e) => { state.selectedProgram = e.target.value; state.view = "dashboard"; renderShell(); });
    document.querySelectorAll("[data-open-program]").forEach((button) => button.addEventListener("click", () => { state.selectedProgram=button.dataset.openProgram; state.view="dashboard"; renderShell(); }));
    document.querySelector("#menu")?.addEventListener("click", () => { state.sidebarOpen = !state.sidebarOpen; document.querySelector("#sidebar").classList.toggle("open", state.sidebarOpen); document.querySelector("#sidebar-backdrop").classList.toggle("visible", state.sidebarOpen); document.querySelector("#menu").setAttribute("aria-expanded", String(state.sidebarOpen)); });
    document.querySelector("#sidebar-backdrop")?.addEventListener("click", () => { state.sidebarOpen = false; renderShell(); });
    document.querySelector("#signout")?.addEventListener("click", () => supabase.auth.signOut());
    document.querySelector("#quick-add")?.addEventListener("click", () => openInitiativeModal());
    document.querySelector("#add-initiative")?.addEventListener("click", () => openInitiativeModal());
    document.querySelector("#sync-luma")?.addEventListener("click", openLumaModal);
    document.querySelector("#add-deliverable")?.addEventListener("click", () => openDeliverableModal());
    document.querySelector("#add-transaction")?.addEventListener("click", () => openTransactionModal());
    document.querySelector("#set-budget")?.addEventListener("click", openBudgetModal);
    document.querySelector("#add-resource")?.addEventListener("click", openResourceModal);
    document.querySelector("#import-participants")?.addEventListener("click", openParticipantImportModal);
    document.querySelector("#export-participants")?.addEventListener("click", exportParticipantsCsv);
    document.querySelector("#participant-filter-form")?.addEventListener("submit", (event) => { event.preventDefault(); state.participantFilters={...state.participantFilters,...Object.fromEntries(new FormData(event.currentTarget))}; renderShell(); });
    document.querySelector("#participant-search")?.addEventListener("input", (event) => { const value=event.target.value; state.participantFilters.search=value; clearTimeout(participantSearchTimer); participantSearchTimer=setTimeout(()=>{renderShell();const input=document.querySelector("#participant-search");if(input){input.focus();input.setSelectionRange(value.length,value.length);}},180); });
    document.querySelectorAll("#participant-filter-form select, #participant-filter-form input[type=date]").forEach((control)=>control.addEventListener("change",()=>{state.participantFilters={...state.participantFilters,...Object.fromEntries(new FormData(document.querySelector("#participant-filter-form")))};renderShell();}));
    document.querySelector("#clear-participant-filters")?.addEventListener("click", () => { state.participantFilters={search:"",rank:"all",city:"all",country:"all",from:"",to:""}; renderShell(); });
    document.querySelectorAll("[data-edit-participant]").forEach((button) => button.addEventListener("click", () => openParticipantEditModal(button.dataset.editParticipant)));
    document.querySelectorAll("[data-manage-rank]").forEach((button) => button.addEventListener("click", () => openRankModal(button.dataset.manageRank)));
    document.querySelectorAll("[data-view-link]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.viewLink; renderShell(); }));
    document.querySelectorAll("[data-edit-metric]").forEach((b) => b.addEventListener("click", () => openMetricModal(b.dataset.editMetric)));
    document.querySelector("#add-metric")?.addEventListener("click", openNewMetricModal);
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

  function openNewMetricModal() {
    modal("Nueva métrica", `<form id="new-metric-form"><div class="field"><label for="label">Nombre de la métrica</label><input id="label" name="label" required /></div><div class="field"><label for="category">Categoría</label><input id="category" name="category" value="Operación" required /></div><div class="field"><label for="target">Meta del período</label><input id="target" name="target" type="number" min="0" step="1" required /></div><div class="field"><label for="unit">Unidad</label><input id="unit" name="unit" placeholder="eventos, personas, piezas…" required /></div><div class="field"><label for="validation_method">Cómo se valida</label><textarea id="validation_method" name="validation_method"></textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Crear métrica</button></div></form>`);
    document.querySelector("#cancel").onclick=closeModal;
    document.querySelector("#new-metric-form").onsubmit=async(event)=>{ event.preventDefault(); if(lockedPreview()) return; const button=event.currentTarget.querySelector("button[type=submit]"); setButtonLoading(button,"Creando…"); const values=Object.fromEntries(new FormData(event.currentTarget)); const code=`${selectedProgram()?.code || "metric"}_${Date.now()}`; const {data:metric,error}=await supabase.from("metric_definitions").insert({organization_id:state.organization.id,program_id:state.selectedProgram,label:values.label,category:values.category,target:Number(values.target),unit:values.unit,validation_method:values.validation_method,code,sort_order:state.metrics.filter(inProgram).length}).select("id").single(); if(error) return afterMutation(error,"Métrica creada"); const {error:updateError}=await supabase.from("metric_updates").insert({organization_id:state.organization.id,period_id:state.selectedPeriod,metric_id:metric.id,actual:0,status:"not_started",owner_id:state.session.user.id,updated_by:state.session.user.id}); await afterMutation(updateError,"Métrica creada"); };
  }

  function openMetricModal(metricId) {
    const m = metricWithUpdate(state.metrics.find((x) => x.id === metricId));
    modal(`Actualizar ${m.label}`, `<form id="metric-form"><div class="field"><label for="actual">Avance actual (${esc(m.unit)})</label><input id="actual" name="actual" type="number" min="0" step="1" value="${esc(m.update.actual)}" required /></div><div class="field"><label for="status">Estado</label><select id="status" name="status">${statusOptions(m.update.status)}</select></div><div class="field"><label for="notes">Notas y evidencia pendiente</label><textarea id="notes" name="notes">${esc(m.update.notes || "")}</textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar actualización</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#metric-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const values = Object.fromEntries(new FormData(e.currentTarget)); const { error } = await supabase.from("metric_updates").update({ actual:Number(values.actual), status:values.status, notes:values.notes, updated_by:state.session.user.id }).eq("id", m.update.id); await afterMutation(error, "Métrica actualizada"); };
  }

  function openInitiativeModal(item = {}) {
    modal(item.id ? "Editar actividad" : "Nueva actividad", `<form id="initiative-form"><div class="field"><label for="program_id">Programa</label><select id="program_id" name="program_id">${programOptions(item.program_id)}</select></div><div class="field"><label for="type">Tipo</label><select id="type" name="type">${Object.entries(typeLabels).map(([v,l]) => `<option value="${v}" ${item.type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label for="title">Nombre</label><input id="title" name="title" value="${esc(item.title || "")}" required /></div><div class="field"><label for="owner_id">Responsable principal</label><select id="owner_id" name="owner_id">${ownerOptions(item.owner_id)}</select></div><div class="field"><label for="due_on">Fecha objetivo</label><input id="due_on" name="due_on" type="date" value="${esc(item.due_on || "")}" /></div><div class="field"><label for="luma_url">Enlace del evento en Luma</label><input id="luma_url" name="luma_url" type="url" value="${esc(item.luma_url || "")}" placeholder="https://lu.ma/..." /></div><div class="field"><label for="resource_links">Enlaces de trabajo</label><textarea id="resource_links" name="resource_links" placeholder="Un enlace por línea: Google Sheets, Drive, Notion…">${esc(linksText(item.resource_links))}</textarea><small>Un enlace por línea.</small></div><div class="field"><label for="contact_emails">Lista de correos</label><textarea id="contact_emails" name="contact_emails" placeholder="Un correo por línea">${esc(contactEmails(item.id))}</textarea><small>Datos privados del evento. Registra sólo contactos con base legal o consentimiento.</small></div><div class="field"><label for="status">Estado</label><select id="status" name="status">${statusOptions(item.status || "not_started")}</select></div><div class="field"><label for="notes">Notas</label><textarea id="notes" name="notes">${esc(item.notes || "")}</textarea></div><div class="modal-actions">${item.id ? `<button type="button" class="button button-danger" id="delete-initiative">${icon("trash-2")} Eliminar</button>` : ""}<span class="modal-actions-spacer"></span><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar actividad</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#delete-initiative")?.addEventListener("click", async (event) => { if (lockedPreview()) return; if (!window.confirm(`¿Eliminar “${item.title}”? Esta acción no se puede deshacer.`)) return; const button = event.currentTarget; setButtonLoading(button, "Eliminando…"); const { error } = await supabase.from("initiatives").delete().eq("id", item.id); await afterMutation(error, "Actividad eliminada"); });
    document.querySelector("#initiative-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const button=e.currentTarget.querySelector("button[type=submit]"); setButtonLoading(button, "Guardando…"); const v = Object.fromEntries(new FormData(e.currentTarget)); const payload = { organization_id:state.organization.id, period_id:state.selectedPeriod, program_id:v.program_id || null, type:v.type, title:v.title, owner_id:v.owner_id || null, due_on:v.due_on || null, luma_url:v.luma_url || null, resource_links:linksFromText(v.resource_links), status:v.status, notes:v.notes, created_by:state.session.user.id }; const query = item.id ? supabase.from("initiatives").update(payload).eq("id", item.id) : supabase.from("initiatives").insert(payload); const { data:saved, error } = await query.select("id").single(); if (error) return afterMutation(error, "Actividad guardada"); const initiativeId=saved.id; const emails=[...new Set(String(v.contact_emails || "").split(/\r?\n|,/).map((email)=>email.trim().toLowerCase()).filter(Boolean))]; const { error:deleteContactsError }=await supabase.from("event_contacts").delete().eq("initiative_id", initiativeId); if (deleteContactsError) return afterMutation(deleteContactsError, "Actividad guardada"); const contactsError=emails.length ? (await supabase.from("event_contacts").insert(emails.map((email)=>({organization_id:state.organization.id,initiative_id:initiativeId,email})))).error : null; await afterMutation(contactsError, "Actividad guardada"); };
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
    setButtonLoading(button, "Importando…");
    const { data, error } = await supabase.functions.invoke("luma-events", { body: { action:"details", event_id:form.event_id.value } });
    if (error || data?.error) { resetButton(button, "Vincular evento"); return notify(data?.error || error?.message || "No pudimos importar el evento.", true); }
    const lumaEvent = data.event;
    const occurredOn = String(lumaEvent.start_at || "").slice(0,10) || null;
    const period = state.periods.find((p) => occurredOn && occurredOn >= p.starts_on && occurredOn <= p.ends_on);
    const payload = {
      organization_id:state.organization.id, period_id:period?.id || state.selectedPeriod, type:"event",
      program_id:state.selectedProgram === "global" ? state.programs.find((program)=>program.code === "stellar_chile")?.id || null : state.selectedProgram,
      title:lumaEvent.name, occurred_on:occurredOn, due_on:occurredOn, status:"in_progress",
      luma_event_id:lumaEvent.id, luma_url:lumaEvent.url,
      luma_registered_count:data.registered_count, luma_checked_in_count:data.checked_in_count,
      luma_synced_at:new Date().toISOString(), created_by:state.session.user.id,
    };
    const { error:saveError } = await supabase.from("initiatives").upsert(payload, { onConflict:"organization_id,luma_event_id" });
    await afterMutation(saveError, "Evento de Luma vinculado");
  }

  function openDeliverableModal(item = {}) {
    modal(item.id ? "Editar entregable" : "Nuevo entregable", `<form id="deliverable-form"><div class="field"><label for="title">Entregable</label><input id="title" name="title" value="${esc(item.title || "")}" required /></div><div class="field"><label for="owner_id">Responsable principal</label><select id="owner_id" name="owner_id">${ownerOptions(item.owner_id)}</select></div><div class="field"><label for="due_on">Fecha límite</label><input id="due_on" name="due_on" type="date" value="${esc(item.due_on || "")}" required /></div><div class="field"><label for="resource_links">Enlaces de trabajo</label><textarea id="resource_links" name="resource_links" placeholder="Un enlace por línea: Google Sheets, Drive, Notion…">${esc(linksText(item.resource_links))}</textarea><small>Un enlace por línea.</small></div><div class="field"><label for="status">Estado</label><select id="status" name="status">${statusOptions(item.status || "not_started")}</select></div><div class="field"><label for="acceptance_notes">Notas de aceptación o corrección</label><textarea id="acceptance_notes" name="acceptance_notes">${esc(item.acceptance_notes || "")}</textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar entregable</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#deliverable-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const button=e.currentTarget.querySelector("button[type=submit]");setButtonLoading(button,"Guardando…"); const v = Object.fromEntries(new FormData(e.currentTarget)); const payload = { organization_id:state.organization.id, program_id:item.program_id || (state.selectedProgram === "global" ? null : state.selectedProgram), period_id:state.selectedPeriod, title:v.title, owner_id:v.owner_id || null, due_on:v.due_on, resource_links:linksFromText(v.resource_links), status:v.status, acceptance_notes:v.acceptance_notes, submitted_at:v.status === "submitted" ? new Date().toISOString() : item.submitted_at || null, accepted_at:v.status === "accepted" ? new Date().toISOString() : item.accepted_at || null }; const query = item.id ? supabase.from("deliverables").update(payload).eq("id", item.id) : supabase.from("deliverables").insert(payload); const { error } = await query; await afterMutation(error, "Entregable guardado"); };
  }

  function openTransactionModal() {
    modal("Registrar movimiento", `<form id="transaction-form"><div class="field"><label for="occurred_on">Fecha</label><input id="occurred_on" name="occurred_on" type="date" value="${new Date().toISOString().slice(0,10)}" required /></div><div class="field"><label for="direction">Movimiento</label><select id="direction" name="direction"><option value="debit">Gasto</option><option value="credit">Ingreso de fondo</option></select></div><div class="field"><label for="category">Categoría</label><input id="category" name="category" required /></div><div class="field"><label for="description">Descripción</label><input id="description" name="description" required /></div><div class="field"><label for="amount_usd">Monto USD</label><input id="amount_usd" name="amount_usd" type="number" min="0" step="0.01" required /></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Registrar</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#transaction-form").onsubmit = async (e) => { e.preventDefault(); if (lockedPreview()) return; const v = Object.fromEntries(new FormData(e.currentTarget)); const { error } = await supabase.from("fund_transactions").insert({ organization_id:state.organization.id, program_id:state.selectedProgram === "global" ? null : state.selectedProgram, occurred_on:v.occurred_on, direction:v.direction, category:v.category, description:v.description, amount_usd:Number(v.amount_usd), created_by:state.session.user.id }); await afterMutation(error, "Movimiento registrado"); };
  }

  function openResourceModal() {
    if (state.selectedProgram === "global") return;
    modal("Añadir planilla o recurso", `<form id="resource-form"><div class="field"><label for="resource_type">Tipo</label><select id="resource_type" name="resource_type"><option value="google_sheets">Google Sheets</option><option value="google_drive">Google Drive</option><option value="notion">Notion</option><option value="form">Formulario</option><option value="presentation">Presentación</option><option value="github">GitHub</option><option value="other">Otro</option></select></div><div class="field"><label for="title">Nombre</label><input id="title" name="title" required /></div><div class="field"><label for="url">Enlace</label><input id="url" name="url" type="url" placeholder="https://" required /></div><div class="field"><label for="description">Descripción</label><textarea id="description" name="description"></textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar recurso</button></div></form>`);
    document.querySelector("#cancel").onclick = closeModal;
    document.querySelector("#resource-form").onsubmit = async (event) => { event.preventDefault(); if (lockedPreview()) return; const button=event.currentTarget.querySelector("button[type=submit]"); setButtonLoading(button,"Guardando…"); const values=Object.fromEntries(new FormData(event.currentTarget)); const { error }=await supabase.from("program_resources").insert({ organization_id:state.organization.id, program_id:state.selectedProgram, resource_type:values.resource_type, title:values.title, url:values.url, description:values.description, created_by:state.session.user.id }); await afterMutation(error,"Recurso guardado"); };
  }

  function openParticipantEditModal(id) {
    const participant=state.participants.find((row)=>row.id===id); if(!participant)return;
    modal("Editar participante", `<form id="participant-edit-form"><div class="participant-edit-grid"><div class="field"><label for="edit_full_name">Nombre</label><input id="edit_full_name" name="full_name" value="${esc(participant.full_name||"")}" /></div><div class="field"><label for="edit_email">Correo</label><input id="edit_email" name="email" type="email" value="${esc(participant.email||"")}" required /></div><div class="field"><label for="edit_github">GitHub</label><input id="edit_github" name="github" value="${esc(participant.github||"")}" placeholder="usuario o https://github.com/…" /></div><div class="field"><label for="edit_discord">Discord</label><input id="edit_discord" name="discord" value="${esc(participant.discord||"")}" /></div><div class="field"><label for="edit_phone">Teléfono / WhatsApp</label><input id="edit_phone" name="phone" value="${esc(participant.phone||"")}" /></div><div class="field"><label for="edit_city">Ciudad</label><input id="edit_city" name="city" value="${esc(participant.city||"")}" /></div><div class="field"><label for="edit_country">País</label><input id="edit_country" name="country" value="${esc(participant.country||"")}" /></div><div class="field"><label for="edit_events">Eventos asistidos</label><input id="edit_events" name="events_attended_count" type="number" min="0" step="1" value="${esc(participant.events_attended_count??0)}" required /><small>Al guardar se recalculará Explorer o Builder, salvo que el rango sea manual.</small></div><div class="field"><label for="edit_company">Proyecto / Empresa</label><input id="edit_company" name="project_company" value="${esc(participant.project_company||"")}" /></div><div class="field"><label for="edit_url">URL personal</label><input id="edit_url" name="personal_url" value="${esc(participant.personal_url||"")}" /></div><div class="field field-wide"><label for="edit_experience">Experiencia</label><textarea id="edit_experience" name="experience">${esc(participant.experience||"")}</textarea></div><div class="field field-wide"><label for="edit_note">Nota de clasificación</label><textarea id="edit_note" name="classification_note">${esc(participant.classification_note||"")}</textarea></div></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar cambios</button></div></form>`);
    document.querySelector("#cancel").onclick=closeModal;
    document.querySelector("#participant-edit-form").onsubmit=async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector("button[type=submit]");setButtonLoading(button,"Guardando…");const raw=Object.fromEntries(new FormData(event.currentTarget));const nullable=(value)=>String(value||"").trim()||null;const payload={full_name:nullable(raw.full_name),email:String(raw.email).trim().toLowerCase(),github:nullable(raw.github),discord:nullable(raw.discord),phone:nullable(raw.phone),city:nullable(raw.city),country:nullable(raw.country),events_attended_count:Number(raw.events_attended_count||0),project_company:nullable(raw.project_company),personal_url:nullable(raw.personal_url),experience:nullable(raw.experience),classification_note:nullable(raw.classification_note),updated_at:new Date().toISOString()};const {error}=await supabase.from("program_participants").update(payload).eq("id",participant.id);await afterMutation(error,"Participante actualizado");};
  }

  function openRankModal(id) {
    const participant=state.participants.find((row)=>row.id===id); if(!participant)return;
    modal("Gestionar rango", `<form id="rank-form"><p><strong>${esc(participant.full_name || participant.email)}</strong><br><span class="muted-copy">${esc(participant.events_attended_count ?? 0)} eventos asistidos${participant.github ? " · GitHub registrado" : " · Sin GitHub"}</span></p><div class="field"><label for="rank_choice">Asignación</label><select id="rank_choice" name="rank_choice"><option value="automatic" ${participant.rank_mode!=="manual"?"selected":""}>Automático — Explorer / Builder</option><option value="Contributor" ${participant.rank_mode==="manual"&&participant.participant_rank==="Contributor"?"selected":""}>Contributor — manual</option><option value="Leader" ${participant.rank_mode==="manual"&&participant.participant_rank==="Leader"?"selected":""}>Leader — manual</option></select><small>Automático: Builder con 3 eventos, o con 2 eventos y GitHub. Contributor y Leader nunca se asignan automáticamente.</small></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar rango</button></div></form>`);
    document.querySelector("#cancel").onclick=closeModal;
    document.querySelector("#rank-form").onsubmit=async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector("button[type=submit]");setButtonLoading(button,"Guardando…");const choice=event.currentTarget.rank_choice.value;const values=choice==="automatic"?{rank_mode:"automatic",rank_updated_by:state.session.user.id}:{rank_mode:"manual",participant_rank:choice,rank_updated_by:state.session.user.id,rank_updated_at:new Date().toISOString()};const {error}=await supabase.from("program_participants").update(values).eq("id",participant.id);await afterMutation(error,"Rango actualizado");};
  }

  function normalizeColumn(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
  function participantRowsFromSheet(rawRows, sourceName) {
    const aliases={full_name:["nombre","name","full_name","nombre_completo","participant_name"],email:["correo","email","e_mail","mail","correo_electronico"],github:["github","github_user","github_username","usuario_github","perfil_github"],participant_rank:["rango","range","rank","tier","nivel","level","ambassador_tier"],events_attended:["events_attended","eventos_asistidos"],discord:["discord","usuario_discord"],roster_source:["source","fuente"],program_status:["program_status","estado_programa"],program_role:["program_role","rol_programa"],discord_roles:["discord_roles","roles_discord"],participant_type:["type","tipo"],city:["city","ciudad"],country:["country","pais"],personal_url:["personal_url","url_personal","sitio_web"],project_company:["project_company","project_company_","proyecto_empresa","empresa"],experience:["experience","experiencia"],classification_note:["classification_note","nota_clasificacion"],phone:["phone","telefono","telefono_whatsapp","whatsapp","wsp"]};
    const normalized=rawRows.map((source_data)=>({source_data,row:Object.fromEntries(Object.entries(source_data).map(([key,value])=>[normalizeColumn(key),String(value ?? "").trim()]))}));
    const valueFor=(row,keys)=>keys.map((key)=>row[key]).find(Boolean) || "";
    const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const deduped=new Map();
    for(const item of normalized){const email=valueFor(item.row,aliases.email).toLowerCase();if(!emailPattern.test(email))continue;const mapped=Object.fromEntries(Object.entries(aliases).map(([field,keys])=>[field,valueFor(item.row,keys)||null]));const manual=["Contributor","Leader"].includes(mapped.participant_rank);deduped.set(email,{...mapped,email,events_attended_count:Number.parseInt(mapped.events_attended,10)||0,rank_mode:manual?"manual":"automatic",source_name:sourceName,source_data:item.source_data});}
    return [...deduped.values()];
  }

  function workbookRows(buffer) { const workbook=XLSX.read(buffer,{type:"array",cellDates:false}); const sheet=workbook.Sheets[workbook.SheetNames[0]]; return XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false}); }

  function openParticipantImportModal() {
    state.importRows=[];
    modal("Importar participantes", `<form id="participant-import-form"><div class="field"><label for="participant-file">Excel o CSV</label><input id="participant-file" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /><small>Se conserva la fila original completa y se estructuran nombre, correo, GitHub, rango, Discord, ubicación, roles, experiencia y demás campos reconocidos.</small></div><div class="field"><label for="google-sheet-url">Google Sheets público</label><input id="google-sheet-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/..." /><button class="button button-secondary" type="button" id="load-google-sheet">${icon("sheet")} Cargar enlace</button><small>La hoja debe permitir acceso mediante enlace.</small></div><div id="import-preview"><div class="empty">Selecciona una planilla para revisar los datos antes de guardarlos.</div></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" id="save-import" type="submit" disabled>Importar participantes</button></div></form>`);
    document.querySelector("#cancel").onclick=closeModal;
    document.querySelector("#participant-file").addEventListener("change",readParticipantFile);
    document.querySelector("#load-google-sheet").addEventListener("click",readGoogleSheet);
    document.querySelector("#participant-import-form").onsubmit=saveParticipantImport;
    hydrateIcons();
  }

  async function readParticipantFile(event) { const file=event.target.files?.[0]; if(!file)return; const button=document.querySelector("#save-import"); button.disabled=true; try{const rows=workbookRows(await file.arrayBuffer()); state.importRows=participantRowsFromSheet(rows,file.name);renderParticipantPreview();}catch(error){console.error(error);document.querySelector("#import-preview").innerHTML=`<div class="form-message">No pudimos leer el archivo. Revisa su formato.</div>`;} }

  function googleSheetCsvUrl(value) { const match=String(value).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); if(!match)return value; const gid=String(value).match(/[?&#]gid=(\d+)/)?.[1] || "0"; return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`; }
  async function readGoogleSheet() { const url=document.querySelector("#google-sheet-url").value.trim(); if(!url)return notify("Pega un enlace de Google Sheets.",true); const button=document.querySelector("#load-google-sheet");setButtonLoading(button,"Cargando…");try{const response=await fetch(googleSheetCsvUrl(url));if(!response.ok)throw new Error(String(response.status));state.importRows=participantRowsFromSheet(workbookRows(await response.arrayBuffer()),"Google Sheets");renderParticipantPreview();resetButton(button,"Cargar enlace");}catch(error){console.error(error);resetButton(button,"Cargar enlace");document.querySelector("#import-preview").innerHTML=`<div class="form-message">No pudimos leer la hoja. Confirma que sea pública o descarga el archivo como Excel/CSV.</div>`;} }

  function renderParticipantPreview() { const preview=document.querySelector("#import-preview"); const rows=state.importRows; document.querySelector("#save-import").disabled=!rows.length; preview.innerHTML=rows.length ? `<div class="import-summary"><strong>${rows.length} participantes válidos</strong><span>Se actualizarán los correos que ya existan.</span></div><div class="table-wrap import-table"><table><thead><tr><th>Nombre</th><th>Correo</th><th>GitHub</th><th>Rango</th></tr></thead><tbody>${rows.slice(0,8).map((row)=>`<tr><td>${esc(row.full_name||"—")}</td><td>${esc(row.email)}</td><td>${esc(row.github||"—")}</td><td>${esc(row.participant_rank||"—")}</td></tr>`).join("")}</tbody></table></div>${rows.length>8?`<small>Vista previa de 8 filas.</small>`:""}` : `<div class="form-message">No encontramos correos válidos. Revisa los encabezados de la planilla.</div>`; }

  async function saveParticipantImport(event) { event.preventDefault(); if(lockedPreview())return; const button=document.querySelector("#save-import");setButtonLoading(button,"Importando…");const payload=state.importRows.map((row)=>({...row,organization_id:state.organization.id,program_id:state.selectedProgram,imported_by:state.session.user.id,imported_at:new Date().toISOString(),updated_at:new Date().toISOString()}));let error=null;for(let index=0;index<payload.length;index+=200){const result=await supabase.from("program_participants").upsert(payload.slice(index,index+200),{onConflict:"program_id,email"});if(result.error){error=result.error;break;}}await afterMutation(error,`${payload.length} participantes importados`); }

  function exportParticipantsCsv() { const rows=participantFilterRows(state.participants.filter(inProgram)); if(!rows.length)return notify("No hay participantes para exportar.",true); const fields=[["Nombre","full_name"],["Correo","email"],["Rango/Tier","participant_rank"],["Eventos asistidos","events_attended_count"],["GitHub","github"],["Discord","discord"],["Teléfono/WhatsApp","phone"],["Fuente roster","roster_source"],["Estado programa","program_status"],["Rol programa","program_role"],["Roles Discord","discord_roles"],["Tipo","participant_type"],["Ciudad","city"],["País","country"],["URL personal","personal_url"],["Proyecto/Empresa","project_company"],["Experiencia","experience"],["Nota clasificación","classification_note"],["Archivo fuente","source_name"]]; const csvValue=(value)=>{let safe=String(value??"");if(/^[=+\-@]/.test(safe))safe=`'${safe}`;return `"${safe.replaceAll('"','""')}"`;}; const csv=[fields.map(([label])=>csvValue(label)).join(","),...rows.map((row)=>fields.map(([,key])=>csvValue(row[key])).join(","))].join("\r\n"); const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const link=document.createElement("a");link.href=url;link.download=`participantes-${selectedProgram()?.code||"tellus"}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }

  function openBudgetModal() {
    const current=state.budgets.find((row)=>row.program_id===state.selectedProgram && row.period_id===state.selectedPeriod);
    modal("Presupuesto del período", `<form id="budget-form"><div class="field"><label for="allocated_usd">Presupuesto USD</label><input id="allocated_usd" name="allocated_usd" type="number" min="0" step="0.01" value="${esc(current?.allocated_usd || 0)}" required /></div><div class="field"><label for="notes">Notas</label><textarea id="notes" name="notes">${esc(current?.notes || "")}</textarea></div><div class="modal-actions"><button type="button" class="button button-secondary" id="cancel">Cancelar</button><button class="button button-primary" type="submit">Guardar presupuesto</button></div></form>`);
    document.querySelector("#cancel").onclick=closeModal;
    document.querySelector("#budget-form").onsubmit=async(event)=>{event.preventDefault();if(lockedPreview())return;const button=event.currentTarget.querySelector("button[type=submit]");setButtonLoading(button,"Guardando…");const values=Object.fromEntries(new FormData(event.currentTarget));const {error}=await supabase.from("program_budgets").upsert({organization_id:state.organization.id,program_id:state.selectedProgram,period_id:state.selectedPeriod,allocated_usd:Number(values.allocated_usd),notes:values.notes,updated_at:new Date().toISOString()},{onConflict:"program_id,period_id"});await afterMutation(error,"Presupuesto guardado");};
  }

  function statusOptions(selected) { return Object.entries(statusLabels).map(([v,l]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${l}</option>`).join(""); }
  function setButtonLoading(button, label) { button.disabled = true; button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>${esc(label)}`; }
  function resetButton(button, label) { button.disabled = false; button.textContent = label; }
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
