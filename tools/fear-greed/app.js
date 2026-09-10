(function () {
  "use strict";
  var endpoint = "https://rhzanxzoqmbxptvxgnfj.supabase.co/functions/v1/fear-greed";
  var loading = document.getElementById("loading-state");
  var error = document.getElementById("error-state");
  var content = document.getElementById("meter-content");
  var score = document.getElementById("score");
  var classification = document.getElementById("classification");
  var character = document.getElementById("character");
  var glow = document.querySelector(".character-glow");
  var marker = document.getElementById("meter-marker");
  var updated = document.getElementById("updated");
  var errorDetail = document.getElementById("error-detail");
  var params = new URLSearchParams(window.location.search);
  var embedType = "auto";
  var theme = params.get("theme") || "auto";
  var embedBuilder = document.getElementById("embed-builder");
  var embedCode = document.getElementById("embed-code");
  var copyStatus = document.getElementById("copy-status");

  function color(value) { return value >= 75 ? "#16c784" : value >= 55 ? "#93d900" : value >= 45 ? "#f3d42f" : value >= 25 ? "#ea8c00" : "#ea3943"; }
  function image(value) { return value < 45 ? "fear.svg" : value < 55 ? "neutral.svg" : "greed.svg"; }
  function date(value) { var d = new Date(value); return isNaN(d.getTime()) ? "Actualización no disponible" : "Actualizado " + d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }); }
  function showError(message) { loading.hidden = true; content.hidden = true; error.hidden = false; errorDetail.textContent = message || "Intenta nuevamente en unos segundos."; }
  function absoluteUrl(path) { return window.location.origin + path; }
  function generateEmbedCode() {
    var query = theme !== "auto" ? "?theme=" + encodeURIComponent(theme) : "";
    if (embedType === "fixed") {
      var dateParam = encodeURIComponent(new Date().toISOString());
      var imageUrl = absoluteUrl("/tools/fear-greed?embed=1&mode=fixed&date=" + dateParam + (theme !== "auto" ? "&theme=" + encodeURIComponent(theme) : ""));
      return '<iframe\n  src="' + imageUrl + '"\n  width="100%"\n  height="520"\n  frameborder="0"\n  style="border:0; border-radius:16px; background:transparent;"\n  loading="lazy"\n  title="Fear and Greed Index by Tellus Cooperative">\n</iframe>';
    }
    return '<iframe\n  src="' + absoluteUrl("/tools/fear-greed?embed=1" + query) + '"\n  width="100%"\n  height="520"\n  frameborder="0"\n  style="border:0; border-radius:16px; background:transparent;"\n  loading="lazy"\n  title="Fear and Greed Index by Tellus Cooperative">\n</iframe>';
  }
  function updateEmbedCode() { if (embedCode) embedCode.textContent = generateEmbedCode(); }
  function setActive(selector, target) { document.querySelectorAll(selector).forEach(function (button) { button.classList.toggle("active", button === target); }); }
  function configureEmbedMode() {
    if (params.get("embed") !== "1") return;
    document.body.classList.add("embed-mode");
    [".site-header", ".intro", ".context-card", "#embed-builder", "#usage", ".site-footer"].forEach(function (selector) { var node = document.querySelector(selector); if (node) node.hidden = true; });
    var shell = document.querySelector(".page-shell"); if (shell) shell.style.padding = "0";
    if (theme === "dark" || (theme === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)) document.body.classList.add("embed-dark");
  }
  function load() {
    loading.hidden = false; error.hidden = true; content.hidden = true;
    fetch(endpoint, { headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) throw new Error("El servicio respondió " + response.status + ".");
      return response.json();
    }).then(function (payload) {
      var data = payload && payload.data;
      var value = Number(data && data.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Respuesta inválida del índice.");
      var tone = color(value);
      score.textContent = value;
      classification.textContent = data.value_classification || "Unknown";
      score.style.color = tone; classification.style.color = tone; glow.style.backgroundColor = tone;
      character.src = "/tools/fear-greed/img/" + image(value); character.alt = data.value_classification || "Índice de sentimiento";
      marker.style.left = value + "%"; updated.textContent = date(params.get("date") || data.update_time);
      loading.hidden = true; content.hidden = false;
    }).catch(function (err) { showError(err.message); });
  }
  document.getElementById("retry-button").addEventListener("click", load);
  document.querySelectorAll("[data-embed-type]").forEach(function (button) { button.addEventListener("click", function () { embedType = button.getAttribute("data-embed-type"); setActive("[data-embed-type]", button); updateEmbedCode(); }); });
  document.querySelectorAll("[data-theme]").forEach(function (button) { button.addEventListener("click", function () { theme = button.getAttribute("data-theme"); setActive("[data-theme]", button); updateEmbedCode(); }); });
  document.getElementById("copy-embed").addEventListener("click", function () { var text = embedCode.textContent; var done = function () { copyStatus.textContent = "Código copiado."; setTimeout(function () { copyStatus.textContent = ""; }, 2200); }; if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done); else { embedCode.focus(); document.execCommand("copy"); done(); } });
  configureEmbedMode();
  updateEmbedCode();
  load();
})();
