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

  function color(value) { return value >= 75 ? "#16c784" : value >= 55 ? "#93d900" : value >= 45 ? "#f3d42f" : value >= 25 ? "#ea8c00" : "#ea3943"; }
  function image(value) { return value < 45 ? "fear.svg" : value < 55 ? "neutral.svg" : "greed.svg"; }
  function date(value) { var d = new Date(value); return isNaN(d.getTime()) ? "Actualización no disponible" : "Actualizado " + d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }); }
  function showError(message) { loading.hidden = true; content.hidden = true; error.hidden = false; errorDetail.textContent = message || "Intenta nuevamente en unos segundos."; }
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
      marker.style.left = value + "%"; updated.textContent = date(data.update_time);
      loading.hidden = true; content.hidden = false;
    }).catch(function (err) { showError(err.message); });
  }
  document.getElementById("retry-button").addEventListener("click", load);
  load();
})();
