const API=async(m,p,b)=>{const r=await fetch("/api"+p,{method:m,headers:{"Content-Type":"application/json"},credentials:"same-origin",body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw {code:r.status,message:j.error||r.statusText};return j};
const cache={employees:[],skills:[]},subs={};
const pub=c=>subs[c]&&subs[c]({docs:cache[c].map(d=>({id:d.id,data:()=>{const {id,...r}=d;return r}}))});
const load=async c=>{cache[c]=await API("GET","/data/"+c);pub(c)};
const DB={collection:c=>({onSnapshot(cb){subs[c]=cb;load(c).catch(fail);return()=>{}},async add(d){const r=await API("POST","/data/"+c,d);await load(c);return{id:r.id}}}),doc:p=>{const[c,id]=p.split("/");return{async update(d){await API("PUT",`/data/${c}/${id}`,d);await load(c)},async delete(){await API("DELETE",`/data/${c}/${id}`);await load(c)}}}};
let me=null,users=[],logs=[];

const LV=["Belum","Dasar","Menengah","Mahir","Ahli"];
const READY=["","Siap Sekarang","1–2 Tahun","3+ Tahun"];
const NINE={"3-1":"Enigma","3-2":"Growth","3-3":"Star","2-1":"Dilemma","2-2":"Core Player","2-3":"High Performer","1-1":"Risk","1-2":"Effective","1-3":"Trusted Pro"};
let db=null,emps=[],skills=[],tab="matrix",dept="",ready=false;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toast=m=>{const d=document.createElement("div");d.className="toast";d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),2500)};
const fail=e=>{if(e&&e.code===401){me=null;db=null;$("#who").innerHTML="";showLogin("Sesi berakhir, silakan masuk lagi.");return}toast("Gagal: "+(e&&e.message||e))};
const lvl=(e,s)=>Number((e.skills||{})[s.id]||0);
const tgt=s=>Number(s.target||3);

async function init(){
  render();
  try{me=await API("GET","/me")}catch(e){me=null}
  ready=true;
  if(!me){showLogin();return}
  start();
}
function start(){
  $("#login").innerHTML="";db=DB;
  $("#who").innerHTML=`Masuk sebagai <b>${esc(me.username)}</b> <span class="tag">${esc(me.role)}</span> <button class="btn sec" data-act2="chpw">Ganti Password</button> <button class="btn sec" data-act2="logout">Keluar</button>`;
  DB.collection("employees").onSnapshot(s=>{emps=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));render()});
  DB.collection("skills").onSnapshot(s=>{skills=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.cat||"").localeCompare(b.cat||"")||(a.name||"").localeCompare(b.name||""));render()});
  setInterval(()=>{if(document.hidden||!db||$("#modal").innerHTML||/SELECT|INPUT|TEXTAREA/.test(document.activeElement.tagName))return;load("employees").catch(()=>{});load("skills").catch(()=>{})},30000);
}

function nav(){
  const T=[["matrix","Skill Matrix"],["talent","Talent 9-Box"],["emps","Karyawan"],["skills","Daftar Skill"]];
  if(me&&me.role==="super_admin")T.push(["users","Pengguna & Log"]);
  $("#nav").innerHTML=T.map(t=>`<button class="${tab===t[0]?"on":""}" data-tab="${t[0]}">${t[1]}</button>`).join("");
}
function depts(){return [...new Set(emps.map(e=>e.dept).filter(Boolean))].sort()}
function filtered(){return emps.filter(e=>!dept||e.dept===dept)}
function deptBar(extra=""){
  return `<div class="bar"><select data-dept><option value="">Semua departemen</option>${depts().map(d=>`<option ${d===dept?"selected":""}>${esc(d)}</option>`).join("")}</select>${extra}</div>`;
}

function render(){
  nav();
  const a=$("#app");
  if(!ready){a.innerHTML=`<div class="empty">Memuat…</div>`;return}
  if(!db){a.innerHTML=`<div class="empty">Silakan masuk terlebih dahulu.</div>`;return}
  a.innerHTML={matrix:vMatrix,talent:vTalent,emps:vEmps,skills:vSkills,users:vUsers}[tab]();
}

function vMatrix(){
  const L=filtered();
  if(!skills.length||!emps.length)return empty();
  const allGap=L.reduce((n,e)=>n+skills.filter(s=>lvl(e,s)<tgt(s)).length,0);
  const avg=L.length?(L.reduce((n,e)=>n+skills.reduce((m,s)=>m+lvl(e,s),0),0)/(L.length*skills.length)).toFixed(1):"0";
  const cats=[...new Set(skills.map(s=>s.cat||"Umum"))];
  const head=`<tr><th class="n">Karyawan</th>${skills.map(s=>`<th title="${esc(s.cat)}">${esc(s.name)}<br><small>target ${tgt(s)}</small></th>`).join("")}<th>Gap</th></tr>`;
  const rows=L.map(e=>{
    const g=skills.filter(s=>lvl(e,s)<tgt(s)).length;
    return `<tr><td class="n"><b>${esc(e.name)}</b><small>${esc(e.pos)} · ${esc(e.dept)}</small></td>${skills.map(s=>{const v=lvl(e,s);return `<td><select class="l${v}" data-set="${e.id}|${s.id}">${LV.map((n,i)=>`<option value="${i}" ${i===v?"selected":""}>${i}</option>`).join("")}</select></td>`}).join("")}<td class="gap ${g?"bad":"ok"}">${g}</td></tr>`}).join("");
  const foot=`<tr><th class="n">Rata-rata tim</th>${skills.map(s=>{const m=L.length?L.reduce((n,e)=>n+lvl(e,s),0)/L.length:0;return `<th class="${m<tgt(s)?"bad":"ok"}">${m.toFixed(1)}</th>`}).join("")}<th></th></tr>`;
  return deptBar(`<span class="sp"></span><button class="btn sec" data-act="csv">Unduh CSV</button>`)+
  `<div class="kpis"><div class="card kpi"><b>${L.length}</b><span>Karyawan</span></div><div class="card kpi"><b>${skills.length}</b><span>Skill dinilai</span></div><div class="card kpi"><b>${avg}</b><span>Rata-rata level (0–4)</span></div><div class="card kpi"><b>${allGap}</b><span>Skill di bawah target</span></div></div>`+
  `<div class="legend">${LV.map((n,i)=>`<i class="l${i}">${i} = ${n}</i>`).join("")}</div><div class="wrap"><table>${head}${rows}${foot}</table></div>`;
}

function vTalent(){
  const L=filtered();
  if(!emps.length)return empty();
  let g=`<div class="nine">`;
  for(const p of [3,2,1]){
    g+=`<div class="axis">Potensi ${p===3?"Tinggi":p===2?"Sedang":"Rendah"}</div>`;
    for(const f of [1,2,3]){
      const m=L.filter(e=>Number(e.perf||2)===f&&Number(e.pot||2)===p);
      g+=`<div class="cellb"><h4>${NINE[p+"-"+f]} (${m.length})</h4>${m.map(e=>`<button class="chip" data-edit="${e.id}">${esc(e.name)}</button>`).join("")}</div>`;
    }
  }
  g+=`<div></div><div class="xl">Performa → Rendah · Sedang · Tinggi</div></div>`;
  const pool=L.filter(e=>e.ready).sort((a,b)=>READY.indexOf(a.ready)-READY.indexOf(b.ready));
  const t=pool.length?`<div class="wrap"><table><tr><th class="n">Nama</th><th>Jabatan saat ini</th><th>Calon pengganti untuk</th><th>Kesiapan</th></tr>${pool.map(e=>`<tr><td class="n"><b>${esc(e.name)}</b></td><td>${esc(e.pos)}</td><td>${esc(e.succ)||"-"}</td><td><span class="tag r${READY.indexOf(e.ready)-1}">${esc(e.ready)}</span></td></tr>`).join("")}</table></div>`:`<div class="empty">Belum ada karyawan dengan status kesiapan suksesi. Isi lewat tombol edit karyawan.</div>`;
  return deptBar()+g+`<h3 style="margin:22px 0 8px">Talent Pool & Suksesi</h3>`+t;
}

function vEmps(){
  const L=filtered();
  return deptBar(`<span class="sp"></span><button class="btn" data-act="addEmp">+ Tambah Karyawan</button>`)+
  (L.length?`<div class="wrap"><table><tr><th class="n">Nama</th><th>Departemen</th><th>Jabatan</th><th>Performa</th><th>Potensi</th><th>Kesiapan</th><th></th></tr>${L.map(e=>`<tr><td class="n"><b>${esc(e.name)}</b></td><td>${esc(e.dept)}</td><td>${esc(e.pos)}</td><td>${e.perf||2}</td><td>${e.pot||2}</td><td>${esc(e.ready)||"-"}</td><td><button class="btn sec" data-edit="${e.id}">Edit</button></td></tr>`).join("")}</table></div>`:empty());
}

function vSkills(){
  return `<div class="bar"><button class="btn" data-act="addSkill">+ Tambah Skill</button></div>`+
  (skills.length?`<div class="wrap"><table><tr><th class="n">Skill</th><th>Kategori</th><th>Target level</th><th></th></tr>${skills.map(s=>`<tr><td class="n"><b>${esc(s.name)}</b></td><td>${esc(s.cat)}</td><td><select data-tgt="${s.id}" style="width:auto">${[1,2,3,4].map(i=>`<option value="${i}" ${i===tgt(s)?"selected":""}>${i} – ${LV[i]}</option>`).join("")}</select></td><td><button class="btn del" data-delskill="${s.id}">Hapus</button></td></tr>`).join("")}</table></div>`:empty());
}

function empty(){
  return `<div class="card empty"><p><b>Belum ada data.</b><br>Mulai dari tab Daftar Skill dan Karyawan untuk menambahkan data.</p></div>`;
}

function empForm(e){
  e=e||{};
  const o=(arr,v)=>arr.map(x=>`<option value="${x[0]}" ${String(x[0])===String(v)?"selected":""}>${x[1]}</option>`).join("");
  $("#modal").innerHTML=`<div class="ov"><div class="modal"><h3 style="margin:0 0 6px">${e.id?"Edit":"Tambah"} Karyawan</h3>
  <label>Nama</label><input id="f_name" value="${esc(e.name)}">
  <div class="two"><div><label>Departemen</label><input id="f_dept" value="${esc(e.dept)}"></div><div><label>Jabatan</label><input id="f_pos" value="${esc(e.pos)}"></div>
  <div><label>Performa</label><select id="f_perf">${o([[1,"1 – Rendah"],[2,"2 – Sedang"],[3,"3 – Tinggi"]],e.perf||2)}</select></div>
  <div><label>Potensi</label><select id="f_pot">${o([[1,"1 – Rendah"],[2,"2 – Sedang"],[3,"3 – Tinggi"]],e.pot||2)}</select></div>
  <div><label>Kesiapan suksesi</label><select id="f_ready">${o(READY.map(r=>[r,r||"-"]),e.ready||"")}</select></div>
  <div><label>Calon pengganti untuk</label><input id="f_succ" value="${esc(e.succ)}"></div></div>
  <label>Catatan</label><textarea id="f_note">${esc(e.note)}</textarea>
  <div class="bar" style="margin:14px 0 0">${e.id?`<button class="btn del" data-act="delEmp" data-id="${e.id}">Hapus</button>`:""}<span class="sp"></span><button class="btn sec" data-act="close">Batal</button><button class="btn" data-act="saveEmp" data-id="${e.id||""}">Simpan</button></div></div></div>`;
}
function skillForm(){
  $("#modal").innerHTML=`<div class="ov"><div class="modal"><h3 style="margin:0 0 6px">Tambah Skill</h3>
  <label>Nama skill</label><input id="s_name"><label>Kategori (mis. Technical, Soft Skill)</label><input id="s_cat">
  <label>Target level</label><select id="s_tgt">${[1,2,3,4].map(i=>`<option value="${i}" ${i===3?"selected":""}>${i} – ${LV[i]}</option>`).join("")}</select>
  <div class="bar" style="margin:14px 0 0"><span class="sp"></span><button class="btn sec" data-act="close">Batal</button><button class="btn" data-act="saveSkill">Simpan</button></div></div></div>`;
}

async function demo(){
  try{
    const S=[["Analisis Masalah","Soft Skill",3],["Komunikasi","Soft Skill",3],["Excel","Technical",3],["Product Knowledge","Technical",3],["K3 / HSE Awareness","Compliance",2]];
    const ids=[];for(const s of S){const r=await db.collection("skills").add({name:s[0],cat:s[1],target:s[2]});ids.push(r.id)}
    const E=[["Contoh Karyawan A","Finance","Staff Accounting",3,2,"1–2 Tahun","Supervisor Accounting"],["Contoh Karyawan B","Sales Admin","Sales Administrator",2,3,"",""],["Contoh Karyawan C","Warehouse","Koordinator Gudang",3,3,"Siap Sekarang","Kepala Gudang"],["Contoh Karyawan D","HC","HC Officer",2,2,"",""]];
    for(const e of E){const sk={};ids.forEach(i=>sk[i]=Math.floor(Math.random()*4)+1);await db.collection("employees").add({name:e[0],dept:e[1],pos:e[2],perf:e[3],pot:e[4],ready:e[5],succ:e[6],note:"",skills:sk})}
  }catch(e){fail(e)}
}

function csv(){
  const L=filtered(),q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const h=["Nama","Departemen","Jabatan",...skills.map(s=>s.name+" (target "+tgt(s)+")"),"Jumlah Gap"];
  const r=L.map(e=>[e.name,e.dept,e.pos,...skills.map(s=>lvl(e,s)),skills.filter(s=>lvl(e,s)<tgt(s)).length]);
  return [h,...r].map(x=>x.map(q).join(",")).join("\n");
}

document.addEventListener("click",async ev=>{
  const t=ev.target.closest("button");if(!t)return;
  try{
    if(t.dataset.tab){tab=t.dataset.tab;render();return}
    if(t.dataset.edit){empForm(emps.find(e=>e.id===t.dataset.edit));return}
    if(t.dataset.delskill){if(confirm("Hapus skill ini?"))await db.doc("skills/"+t.dataset.delskill).delete();return}
    const a=t.dataset.act;if(!a)return;
    if(a==="close")$("#modal").innerHTML="";
    else if(a==="addEmp")empForm();
    else if(a==="addSkill")skillForm();
    else if(a==="demo")await demo();
    else if(a==="csv"){const u=URL.createObjectURL(new Blob(["\ufeff"+csv()],{type:"text/csv"})),a2=document.createElement("a");a2.href=u;a2.download="skill-matrix.csv";a2.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
    else if(a==="delEmp"){if(confirm("Hapus karyawan ini?")){await db.doc("employees/"+t.dataset.id).delete();$("#modal").innerHTML=""}}
    else if(a==="saveEmp"){
      const v=k=>$("#f_"+k).value.trim();
      if(!v("name")){toast("Nama wajib diisi");return}
      const d={name:v("name"),dept:v("dept"),pos:v("pos"),perf:+v("perf"),pot:+v("pot"),ready:v("ready"),succ:v("succ"),note:v("note")};
      if(t.dataset.id)await db.doc("employees/"+t.dataset.id).update(d);else await db.collection("employees").add({...d,skills:{}});
      $("#modal").innerHTML="";
    }else if(a==="saveSkill"){
      const n=$("#s_name").value.trim();if(!n){toast("Nama skill wajib diisi");return}
      await db.collection("skills").add({name:n,cat:$("#s_cat").value.trim()||"Umum",target:+$("#s_tgt").value});$("#modal").innerHTML="";
    }
  }catch(e){fail(e)}
});
document.addEventListener("change",async ev=>{
  const t=ev.target;
  try{
    if(t.dataset.dept!==undefined){dept=t.value;render()}
    else if(t.dataset.set){const [eid,sid]=t.dataset.set.split("|");const e=emps.find(x=>x.id===eid);const sk={...(e.skills||{}),[sid]:+t.value};e.skills=sk;t.className="l"+t.value;await db.doc("employees/"+eid).update({skills:sk})}
    else if(t.dataset.tgt){await db.doc("skills/"+t.dataset.tgt).update({target:+t.value})}
  }catch(e){fail(e)}
});
function showLogin(msg){$("#login").innerHTML=`<div class="ov"><form class="modal" id="lf"><h3 style="margin:0 0 4px">Masuk</h3><div class="sub">Khusus Tim HC. Masukkan username & password.</div><label>Username</label><input id="l_u" autocomplete="username" required><label>Password</label><input id="l_p" type="password" autocomplete="current-password" required>${msg?`<p class="bad">${esc(msg)}</p>`:""}<div class="bar" style="margin:14px 0 0"><span class="sp"></span><button class="btn">Masuk</button></div><div class="sub" style="margin-top:8px">Lupa password? Minta Super Admin mereset akunmu di tab Pengguna & Log.</div></form></div>`}
function vUsers(){
 return `<h3 style="margin:0 0 8px">Tambah User</h3><div class="bar"><input id="u_n" placeholder="Username / email"><input id="u_p" type="password" placeholder="Password awal (min 8)"><select id="u_r"><option value="admin">Admin</option><option value="viewer">Viewer (hanya lihat)</option><option value="super_admin">Super Admin</option></select><button class="btn" data-act2="addUser">+ Tambah</button></div>`+
 `<div class="wrap"><table><tr><th class="n">User</th><th>Role</th><th>Dibuat</th><th></th></tr>${users.map(u=>`<tr><td class="n"><b>${esc(u.username)}</b></td><td>${esc(u.role)}</td><td>${esc((u.createdAt||"").slice(0,10))}</td><td><button class="btn sec" data-act2="resetPw" data-u="${esc(u.username)}">Reset Password</button> <button class="btn del" data-act2="delUser" data-u="${esc(u.username)}">Hapus</button></td></tr>`).join("")}</table></div>`+
 `<h3 style="margin:22px 0 8px">Log Aktivitas (300 terakhir)</h3><div class="wrap"><table><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Detail</th><th>IP</th></tr>${logs.map(l=>`<tr><td>${esc(new Date(l.t).toLocaleString("id-ID"))}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td><td>${esc(l.ip)}</td></tr>`).join("")}</table></div>`;
}
async function loadUsers(){[users,logs]=await Promise.all([API("GET","/users"),API("GET","/logs")]);render()}
document.addEventListener("submit",async ev=>{if(ev.target.id!=="lf")return;ev.preventDefault();try{me=await API("POST","/login",{username:$("#l_u").value.trim(),password:$("#l_p").value});start()}catch(e){showLogin(e.message)}});
document.addEventListener("click",async ev=>{
 const t=ev.target.closest("button");if(!t)return;
 const a=t.dataset.act2,u=t.dataset.u;
 try{
  if(t.dataset.tab==="users"){await loadUsers();return}
  if(!a)return;
  if(a==="logout"){await API("POST","/logout");location.reload()}
  else if(a==="chpw"){const p=prompt("Password baru (min 8 karakter):");if(p){await API("POST","/password",{password:p});toast("Password diganti")}}
  else if(a==="addUser"){await API("POST","/users",{username:$("#u_n").value.trim(),password:$("#u_p").value,role:$("#u_r").value});await loadUsers();toast("User ditambahkan")}
  else if(a==="resetPw"){const p=prompt("Password baru untuk "+u+" (min 8 karakter):");if(p){await API("PUT","/users/"+encodeURIComponent(u),{password:p});toast("Password direset")}}
  else if(a==="delUser"){if(confirm("Hapus user "+u+"?")){await API("DELETE","/users/"+encodeURIComponent(u));await loadUsers()}}
 }catch(e){fail(e)}
});
init();
