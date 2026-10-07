import { getStore } from "@netlify/blobs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

export const config = { path: "/api/*" };
const ROLES = ["super_admin", "admin", "viewer"];
const FIELDS = {
  employees: ["name", "dept", "pos", "perf", "pot", "ready", "succ", "note", "skills"],
  skills: ["name", "cat", "target"],
};
const DUMMY = bcrypt.hashSync("dummy-password", 10);
const store = () => getStore({ name: "hc-talent", consistency: "strong" });
const rd = (s, k) => s.get(k, { type: "json" });
const json = (o, status = 200, h = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...h } });
const cookie = (v, age) => `hc_token=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
const validUser = (u) => /^[a-z0-9._@-]{3,60}$/.test(u);
const validPw = (p) => typeof p === "string" && p.length >= 8 && p.length <= 100;

async function log(s, user, action, detail, ip) {
  try { await s.setJSON(`logs/${Date.now()}-${randomUUID().slice(0, 6)}`, { t: Date.now(), user, action, detail: detail || "", ip: ip || "" }); } catch {}
}
async function ensureAdmin(s) {
  const { blobs } = await s.list({ prefix: "users/" });
  const u = (process.env.ADMIN_USER || "").toLowerCase(), p = process.env.ADMIN_PASS || "";
  if (blobs.length > 0) return null;
  if (!validUser(u)) return "ADMIN_USER belum diisi / tidak valid (3-60 karakter: huruf kecil, angka, . _ @ -)";
  if (!validPw(p)) return "ADMIN_PASS belum diisi / terlalu pendek (minimal 8 karakter). Ubah di Netlify lalu Deploy ulang.";
  await s.setJSON("users/" + u, { username: u, role: "super_admin", hash: bcrypt.hashSync(p, 10), createdAt: new Date().toISOString() });
  await s.delete("fail/" + u);
  return null;
}
async function auth(req, s) {
  const m = /(?:^|;\s*)hc_token=([^;]+)/.exec(req.headers.get("cookie") || "");
  if (!m) return null;
  try {
    const { u } = jwt.verify(m[1], process.env.JWT_SECRET);
    const rec = await rd(s, "users/" + u);
    return rec ? { username: rec.username, role: rec.role } : null;
  } catch { return null; }
}
const pick = (col, b) => {
  const o = {};
  for (const k of FIELDS[col]) if (b[k] !== undefined) o[k] = b[k];
  if (col === "employees" && o.skills && typeof o.skills !== "object") delete o.skills;
  return o;
};

export default async (req, ctx) => {
  if (!process.env.JWT_SECRET) return json({ error: "Server belum dikonfigurasi (JWT_SECRET)" }, 500);
  const s = store(), ip = ctx?.ip || "", method = req.method;
  const [r0, r1, r2] = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  let body = {};
  if (method !== "GET") {
    if (!(req.headers.get("content-type") || "").includes("json")) return json({ error: "Bad request" }, 400);
    try { body = (await req.json()) || {}; } catch { body = {}; }
    if (JSON.stringify(body).length > 30000) return json({ error: "Data terlalu besar" }, 413);
  }

  if (r0 === "login" && method === "POST") {
    const setupErr = await ensureAdmin(s);
    if (setupErr) return json({ error: "Setup admin gagal: " + setupErr }, 500);
    const uname = String(body.username || "").trim().toLowerCase(), pw = String(body.password || "");
    const ok0 = validUser(uname), fk = "fail/" + uname;
    let f = ok0 ? await rd(s, fk) : null;
    if (f && f.until && f.until <= Date.now()) f = null;
    if (f && f.until > Date.now()) return json({ error: "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi." }, 429);
    const u = ok0 ? await rd(s, "users/" + uname) : null;
    const ok = await bcrypt.compare(pw, u ? u.hash : DUMMY);
    if (!u || !ok) {
      if (ok0) { const n = ((f && f.n) || 0) + 1; await s.setJSON(fk, { n, until: n >= 5 ? Date.now() + 15 * 60000 : 0 }); }
      await log(s, uname, "login_gagal", "", ip);
      return json({ error: "Username atau password salah" }, 401);
    }
    await s.delete(fk);
    await log(s, uname, "login", "", ip);
    const token = jwt.sign({ u: uname }, process.env.JWT_SECRET, { expiresIn: "8h" });
    return json({ username: uname, role: u.role }, 200, { "Set-Cookie": cookie(token, 28800) });
  }

  const me = await auth(req, s);
  if (!me) return json({ error: "Belum login" }, 401);
  const isSA = me.role === "super_admin", canWrite = me.role !== "viewer";

  if (r0 === "me") return json(me);
  if (r0 === "logout") { await log(s, me.username, "logout", "", ip); return json({ ok: 1 }, 200, { "Set-Cookie": cookie("", 0) }); }
  if (r0 === "password" && method === "POST") {
    if (!validPw(body.password)) return json({ error: "Password minimal 8 karakter" }, 400);
    const rec = await rd(s, "users/" + me.username);
    await s.setJSON("users/" + me.username, { ...rec, hash: bcrypt.hashSync(body.password, 10) });
    await log(s, me.username, "ganti_password", "", ip);
    return json({ ok: 1 });
  }

  if (r0 === "data" && FIELDS[r1]) {
    const col = r1;
    if (method === "GET" && !r2) {
      const { blobs } = await s.list({ prefix: col + "/" });
      const rows = await Promise.all(blobs.map(async (b) => ({ id: b.key.slice(col.length + 1), ...(await rd(s, b.key)) })));
      return json(rows);
    }
    if (!canWrite) return json({ error: "Akun ini hanya bisa melihat (Viewer)" }, 403);
    if (method === "POST" && !r2) {
      const id = randomUUID();
      await s.setJSON(`${col}/${id}`, { ...pick(col, body), createdBy: me.username, createdAt: new Date().toISOString() });
      await log(s, me.username, "tambah_" + col, body.name || "", ip);
      return json({ id });
    }
    if (r2 && /^[\w-]{1,60}$/.test(r2)) {
      const key = `${col}/${r2}`, old = await rd(s, key);
      if (!old) return json({ error: "Data tidak ditemukan" }, 404);
      if (method === "PUT") {
        await s.setJSON(key, { ...old, ...pick(col, body), updatedBy: me.username, updatedAt: new Date().toISOString() });
        await log(s, me.username, "ubah_" + col, old.name || "", ip);
        return json({ ok: 1 });
      }
      if (method === "DELETE") {
        await s.delete(key);
        await log(s, me.username, "hapus_" + col, old.name || "", ip);
        return json({ ok: 1 });
      }
    }
    return json({ error: "Not found" }, 404);
  }

  if (r0 === "users" || r0 === "logs") {
    if (!isSA) return json({ error: "Khusus Super Admin" }, 403);
    if (r0 === "logs") {
      const { blobs } = await s.list({ prefix: "logs/" });
      const last = blobs.map((b) => b.key).sort().slice(-300).reverse();
      return json(await Promise.all(last.map((k) => rd(s, k))));
    }
    if (method === "GET") {
      const { blobs } = await s.list({ prefix: "users/" });
      const us = await Promise.all(blobs.map((b) => rd(s, b.key)));
      return json(us.map(({ hash, ...u }) => u));
    }
    if (method === "POST") {
      const uname = String(body.username || "").trim().toLowerCase();
      if (!validUser(uname)) return json({ error: "Username 3-60 karakter (huruf kecil, angka, . _ @ -)" }, 400);
      if (!validPw(body.password)) return json({ error: "Password minimal 8 karakter" }, 400);
      if (!ROLES.includes(body.role)) return json({ error: "Role tidak valid" }, 400);
      if (await rd(s, "users/" + uname)) return json({ error: "Username sudah ada" }, 409);
      await s.setJSON("users/" + uname, { username: uname, role: body.role, hash: bcrypt.hashSync(body.password, 10), createdAt: new Date().toISOString() });
      await log(s, me.username, "tambah_user", `${uname} (${body.role})`, ip);
      return json({ ok: 1 });
    }
    const rec = r1 && validUser(r1) ? await rd(s, "users/" + r1) : null;
    if (!rec) return json({ error: "User tidak ditemukan" }, 404);
    if (method === "PUT") {
      if (body.password !== undefined) { if (!validPw(body.password)) return json({ error: "Password minimal 8 karakter" }, 400); rec.hash = bcrypt.hashSync(body.password, 10); }
      if (body.role !== undefined) { if (!ROLES.includes(body.role)) return json({ error: "Role tidak valid" }, 400); rec.role = body.role; }
      await s.setJSON("users/" + r1, rec);
      await log(s, me.username, "ubah_user", r1, ip);
      return json({ ok: 1 });
    }
    if (method === "DELETE") {
      if (r1 === me.username) return json({ error: "Tidak bisa menghapus akun sendiri" }, 400);
      await s.delete("users/" + r1);
      await log(s, me.username, "hapus_user", r1, ip);
      return json({ ok: 1 });
    }
  }
  return json({ error: "Not found" }, 404);
};
