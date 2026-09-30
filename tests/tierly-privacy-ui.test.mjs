import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../tierly/app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../tierly/index.html", import.meta.url), "utf8");

test("expone controles de privacidad bilingües en configuración", () => {
  for (const key of ["privacyTitle", "privacyBody", "privacyObserve", "privacyDelete"]) {
    assert.match(app, new RegExp(`${key}:`));
  }
  assert.match(app, /lb-privacy-observe/);
  assert.match(app, /lb-privacy-delete/);
  assert.match(html, /lb-privacy-block/);
});

test("usa el identificador de Discord solo para las RPC de privacidad", () => {
  assert.match(app, /identities\?\.find\(\(item\) => item\.provider === "discord"\)/);
  assert.match(app, /target_discord_user_id: discordProviderId\(\)/);
  assert.doesNotMatch(app, /console\.(log|error).*discordProviderId|console\.(log|error).*discord_user_id/);
});

test("conecta presencia, consentimiento y borrado con RPCs seguras", () => {
  assert.match(app, /tierly_accept_member_consent/);
  assert.match(app, /tierly_decline_member_consent/);
  assert.match(app, /tierly_request_member_deletion/);
  assert.match(app, /window\.confirm\(t\("privacyDeleteConfirm"\)\)/);
});
