// leaderboard/app.js
(() => {
  "use strict";
  const SUPABASE_URL = "https://rhzanxzoqmbxptvxgnfj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_oiVUNWzo3p3SXLdr8in3XQ_zbZJiNd7";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const STRINGS = {
    en: {
      title: "Tellus Gaming Leaderboard",
      subtitle: "Cumulative ranking across every Tellus gaming event.",
      rank: "Rank", player: "Player", points: "Points",
      bracketTitle: "Latest event", rewardsTitle: "Winners & rewards",
      loginDiscord: "Sign in with Discord", loginedAs: "Signed in as",
      empty: "No results yet.",
    },
    es: {
      title: "Leaderboard Gaming Tellus",
      subtitle: "Ranking acumulado cruzando todos los eventos gaming de Tellus.",
      rank: "Puesto", player: "Jugador", points: "Puntos",
      bracketTitle: "Último evento", rewardsTitle: "Ganadores y premios",
      loginDiscord: "Iniciar sesión con Discord", loginedAs: "Sesión iniciada como",
      empty: "Todavía no hay resultados.",
    },
  };
  const lang = (localStorage.getItem("tellus-lang") || "en").startsWith("es") ? "es" : "en";
  const t = (key) => STRINGS[lang][key] ?? key;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function loadRanking() {
    const { data, error } = await supabase
      .from("leaderboard_public_view")
      .select("*")
      .order("total_points", { ascending: false })
      .limit(50);
    const el = document.querySelector("#lb-ranking");
    if (error || !data?.length) { el.innerHTML = `<p>${t("empty")}</p>`; return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>${t("rank")}</th><th>${t("player")}</th><th>${t("points")}</th></tr></thead>
        <tbody>${data.map((row, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${row.avatar_url ? `<img src="${esc(row.avatar_url)}" alt="" class="lb-avatar" />` : ""}${esc(row.display_name || "—")}</td>
            <td>${row.total_points}</td>
          </tr>`).join("")}</tbody>
      </table>`;
  }

  async function loadLatestBracket() {
    const { data, error } = await supabase
      .from("event_bracket_public_view")
      .select("*")
      .order("event_date", { ascending: false })
      .limit(50);
    const el = document.querySelector("#lb-bracket");
    if (error || !data?.length) { el.innerHTML = `<p>${t("empty")}</p>`; return; }
    const latestEventId = data[0].event_id;
    const rows = data.filter((r) => r.event_id === latestEventId);
    el.innerHTML = `
      <h3>${esc(rows[0].event_name)}</h3>
      <ul>${rows.map((r) => `<li>${esc(r.game)} — ${esc(r.display_name || "—")} — ${r.match_status}${r.placement ? ` (#${r.placement})` : ""}</li>`).join("")}</ul>`;
  }

  async function loadRewards() {
    const { data, error } = await supabase
      .from("gaming_rewards_public_view")
      .select("*")
      .limit(30);
    const el = document.querySelector("#lb-rewards");
    if (error || !data?.length) { el.innerHTML = `<p>${t("empty")}</p>`; return; }
    el.innerHTML = `<ul>${data.map((r) => `<li>${esc(r.display_name || "—")} — ${esc(r.description)}</li>`).join("")}</ul>`;
  }

  function renderAuth(session) {
    const el = document.querySelector("#lb-auth");
    if (!session) {
      el.innerHTML = `<button id="lb-discord-login">${t("loginDiscord")}</button>`;
      document.querySelector("#lb-discord-login").addEventListener("click", () => {
        supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: "https://telluscoop.org/leaderboard" } });
      });
      return;
    }
    el.innerHTML = `<span>${t("loginedAs")} ${esc(session.user.user_metadata?.full_name || session.user.email)}</span>`;
    supabase.functions.invoke("discord-verify", { headers: { Authorization: `Bearer ${session.access_token}` } });
  }

  async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    renderAuth(session);
    supabase.auth.onAuthStateChange((_event, newSession) => renderAuth(newSession));
  }

  document.querySelector("#lb-title").textContent = t("title");
  document.querySelector("#lb-subtitle").textContent = t("subtitle");
  document.querySelector("#lb-bracket-title").textContent = t("bracketTitle");
  document.querySelector("#lb-rewards-title").textContent = t("rewardsTitle");

  loadRanking();
  loadLatestBracket();
  loadRewards();
  initAuth();
})();
