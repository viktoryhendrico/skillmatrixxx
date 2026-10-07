# Skill Matrix & Talent Management (dengan login)

Stack: static site + Netlify Functions + Netlify Blobs (tanpa database eksternal).
Fitur keamanan: password di-hash (bcrypt), sesi cookie HttpOnly/Secure/SameSite, role Super Admin/Admin/Viewer,
kunci akun 15 menit setelah 5x gagal, log aktivitas, security headers + CSP.

## Cara deploy
1. Upload folder ini ke repository GitHub (private).
2. Netlify → Add new site → Import from Git → pilih repo (build command kosong, publish `public` sudah diatur di netlify.toml).
3. Site configuration → Environment variables, isi:
   - JWT_SECRET  = teks acak minimal 32 karakter
   - ADMIN_USER  = username Super Admin pertama (huruf kecil, mis. thalia)
   - ADMIN_PASS  = password awal (min 8 karakter)
4. Deploy, buka situs, login. Akun Super Admin dibuat otomatis saat login pertama.
5. Ganti password lewat tombol "Ganti Password", lalu HAPUS variabel ADMIN_PASS dari Netlify.
6. Tambah user tim HC lewat tab "Pengguna & Log".

## Upload ke GitHub
**Lewat web (paling mudah):** buat repository baru (Private) di github.com → "uploading an existing file" → tarik semua isi folder ini (termasuk folder `public` dan `netlify`) → Commit.

**Lewat terminal:**
```
git remote add origin https://github.com/<akun>/<nama-repo>.git
git push -u origin main
```
Jangan pernah commit file `.env` atau menuliskan password/secret di dalam kode. Semua secret diisi lewat Environment variables di Netlify.

## Uji lokal (opsional)
```
npm install
npm i -g netlify-cli
cp .env.example .env   # lalu isi nilainya
netlify dev
```
