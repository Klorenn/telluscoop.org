import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://telluscoop.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const codeHashes: Record<string, string> = {
  "hola@telluscoop.org": "500027fa5c387fa1942f89c688f82c13178084a9e6cda2ec2a0b49c6b4c8d3d5",
  "kohcuendedani@gmail.com": "2b31c0be63416ad2fe80ee3ca3a64237199679eef0109ee509f1ebda73d56ac4",
  "mishekoh@gmail.com": "b65ff71a8dfc5bc87078ed98a9c1fa7bf32c431576c10fc790809cfbe79a3ac8",
  "bastian@telluscoop.org": "dc31af65a2a6df324e52ef3a36ea3b51624f93df6384d29a9bd1a4bc9b11d806",
  "kohcuendepau@gmail.com": "a318f0501415dd51cc4d8da0a680ad52a8aa6b3c0f861dc1e4b72aba0fa82c5d",
  "inboxblessedux@gmail.com": "e26e66d1e454fc6b1e8826095bf2c9f2832fd3a111737779b22348f8a92fb1f9",
  "alexbnjmnch@gmail.com": "247345a6b7f2235ee03a884eafbfc0f9ed927bd4f6b34a8cdeb29073646eafef",
};

const displayNames: Record<string, string> = {
  "hola@telluscoop.org": "Tellus Cooperative Admin",
  "kohcuendedani@gmail.com": "Daniel",
  "mishekoh@gmail.com": "Mishelle",
  "bastian@telluscoop.org": "Bastian",
  "kohcuendepau@gmail.com": "Pau Koh",
  "inboxblessedux@gmail.com": "Joaquín Farfán",
  "alexbnjmnch@gmail.com": "Alex Hernández",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const body = await request.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (listError) throw listError;

    if (body.action === "status") {
      const available = Object.keys(codeHashes).some((email) => {
        const user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
        return !user || !user.user_metadata?.password_configured;
      });
      return json({ available });
    }

    const { email: rawEmail, code, password } = body;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || typeof code !== "string" || typeof password !== "string") {
      return json({ error: "Completa todos los campos" }, 400);
    }
    if (password.length < 10) return json({ error: "La contraseña debe tener al menos 10 caracteres" }, 400);
    const expectedHash = codeHashes[email];
    if (!expectedHash || await sha256(code.trim()) !== expectedHash) {
      return json({ error: "Correo o código temporal inválido" }, 403);
    }

    const user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!user) {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { password_configured: true, full_name: displayNames[email] },
      });
      if (createError) throw createError;
      return json({ ok: true });
    }
    if (user.user_metadata?.password_configured) {
      return json({ error: "Este código ya fue utilizado. Entra con tu contraseña." }, 409);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, password_configured: true, full_name: displayNames[email] },
    });
    if (updateError) throw updateError;
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "No pudimos configurar la cuenta" }, 500);
  }
});
