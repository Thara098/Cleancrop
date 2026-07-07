/* ============================================================
   CleanCops — full prototype
   Storage: Supabase (PostgreSQL + Storage)
   ============================================================ */

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
// Paste your Supabase project URL and anon key here (supabase.com → project settings → API)
const SUPABASE_URL = 'https://qghddefdefzwvmonwqij.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eu3hml1YME-ttmUUsBJd4A_XURyJZap';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── 1. CONFIG & HELPERS ──────────────────────────────────────────────────────

const ACCOUNTS = [
  { username: 'admin',  password: 'cleancops', role: 'manager', name: 'Admin Manager' },
  { username: 'worker', password: 'cleancops', role: 'field',   name: 'Field Worker' },
];

const NOW   = new Date();
const GST   = 0.10;
const SUPER = 0.115; // Australian super rate 2024-25
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS= ['#0d9488','#2563eb','#7c3aed','#db2777','#ea580c','#0891b2','#84cc16','#65a30d'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const el = id => document.getElementById(id);
let _uid = 1000;
const uid = () => 'id' + (++_uid) + Math.random().toString(36).slice(2,6);

const pad   = n => String(n).padStart(2,'0');
const esc   = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = n => '$'+Math.round(n).toLocaleString('en-AU');

function toDateStr(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function parseDate(s){ const[y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function sameDay(a,b){ return toDateStr(a)===toDateStr(b); }
function addDays(d,n){ const t=new Date(d); t.setDate(t.getDate()+n); return t; }
function startOfWeekMon(d){ const t=new Date(d); t.setHours(0,0,0,0); const dow=(t.getDay()+6)%7; t.setDate(t.getDate()-dow); return t; }
function monthName(d){ return MON[d.getMonth()]+' '+d.getFullYear(); }
function fmtD(d){ return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]; }
function fmtDShort(d){ return d.getDate()+' '+MON[d.getMonth()]; }
function fmtT(timeStr){
  if(!timeStr) return '';
  const[h,m]=timeStr.split(':').map(Number);
  const ap=h<12?'am':'pm'; const hh=h%12||12;
  return hh+(m?':'+pad(m):'')+ap;
}
function timeDiffHrs(t1,t2){
  const[h1,m1]=(t1||'0:00').split(':').map(Number);
  const[h2,m2]=(t2||'0:00').split(':').map(Number);
  let mins=(h2*60+m2)-(h1*60+m1);
  if(mins<0) mins+=24*60; // handle overnight shifts
  return Math.round(mins/60*10)/10;
}
function colorFor(name){ let h=0; for(const c of String(name)) h=(h+c.charCodeAt(0))%COLORS.length; return COLORS[h]; }
function initials(name){ return String(name).split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase(); }
function av(name,color,cls=''){
  return `<span class="avatar ${cls}" style="background:${color||colorFor(name)}">${initials(name)}</span>`;
}
function stars(n){ let h=''; for(let i=1;i<=5;i++) h+=`<span class="${i<=n?'':'off'}">★</span>`; return `<span class="stars">${h}</span>`; }

function sbadge(status){
  const m={
    scheduled:  ['b-slate','Scheduled'],
    in_progress:['b-amber','In progress'],
    completed:  ['b-green','Completed'],
    overdue:    ['b-red',  'Overdue'],
  };
  const[cls,lbl]=m[status]||['b-slate',status];
  return `<span class="badge ${cls}"><span class="dot"></span>${lbl}</span>`;
}

// ─── 2. STORAGE ───────────────────────────────────────────────────────────────

async function sbUpload(path, file){
  const {error} = await _sb.storage.from('uploads').upload(path, file, {upsert:true});
  if(error) throw error;
  const {data} = _sb.storage.from('uploads').getPublicUrl(path);
  return data.publicUrl;
}

const Store = {
  all(k){ return db[k]||[]; },
  save(k, arr){
    db[k] = arr;
    _sb.from(k).upsert(arr).then(({error})=>{ if(error) console.error('save',k,error); });
  },
  add(k, item){
    if(!db[k]) db[k]=[];
    db[k].push(item);
    _sb.from(k).insert(item).then(({error})=>{ if(error) console.error('add',k,error); });
    return item;
  },
  update(k, id, patch){
    db[k] = (db[k]||[]).map(x=>x.id===id?{...x,...patch}:x);
    _sb.from(k).update(patch).eq('id',id).then(({error})=>{ if(error) console.error('update',k,error); });
    return db[k].find(x=>x.id===id);
  },
  remove(k, id){
    db[k] = (db[k]||[]).filter(x=>x.id!==id);
    _sb.from(k).delete().eq('id',id).then(({error})=>{ if(error) console.error('remove',k,error); });
  },
};

// ─── 3. DB (live data) ───────────────────────────────────────────────────────

const db = {};
function loadDB(){
  if(!db.clients)    db.clients    = [];
  if(!db.sites)      db.sites      = [];
  if(!db.employees)  db.employees  = [];
  if(!db.shifts)     db.shifts     = [];
  if(!db.jobs)       db.jobs       = [];
  if(!db.invoices)   db.invoices   = [];
  if(!db.payslips)   db.payslips   = [];
  if(!db.empinvoices)db.empinvoices= [];
}

// ─── 5. STATE ─────────────────────────────────────────────────────────────────

const S = {
  view:      'dashboard',
  role:      'manager',
  fieldEmp:  'e1',
  calView:   'regular',
  invView:   'company',
  calMonth:  new Date(NOW.getFullYear(), NOW.getMonth(), 1),
  payMonth:  new Date(NOW.getFullYear(), NOW.getMonth(), 1),
  invMonth:  new Date(NOW.getFullYear(), NOW.getMonth(), 1),
  weekOff:   0,
  modal:     null,
  filters:   {q:'', status:'', site:'', emp:''},
};

// ─── 6. LOOKUPS ───────────────────────────────────────────────────────────────

const getClient   = id => db.clients.find(x=>x.id===id);
const getSite     = id => db.sites.find(x=>x.id===id);
const getEmployee = id => db.employees.find(x=>x.id===id);
const getShift    = id => db.shifts.find(x=>x.id===id);
const getJob      = id => db.jobs.find(x=>x.id===id);
const clientOf    = siteId => { const s=getSite(siteId); return s?getClient(s.clientId):null; };

function shiftsForSite(siteId){ return db.shifts.filter(s=>s.siteId===siteId); }
function shiftsForEmp(empId)  { return db.shifts.filter(s=>s.assignedTo===empId); }

function calEventsForDate(date, calView='all'){
  const dow = date.getDay();
  const ds  = toDateStr(date);
  return db.shifts
    .filter(s=>s.status==='active')
    .filter(s=> calView==='regular' ? s.type==='recurring' :
                calView==='adhoc'   ? s.type==='oneoff'    : true)
    .filter(s=> s.type==='recurring' ? s.days.includes(dow) : s.date===ds)
    .map(s=>{
      const job = db.jobs.find(j=>j.shiftId===s.id && j.date===ds);
      return {shift:s, job, date, ds};
    });
}

function getOrCreateJob(shiftId, ds){
  let j = db.jobs.find(x=>x.shiftId===shiftId && x.date===ds);
  if(!j){
    const sh = getShift(shiftId);
    j = {
      id: uid(),
      shiftId,
      siteId: sh.siteId,
      date: ds,
      assignedTo: sh.assignedTo,
      status: 'scheduled',
      startedAt: null,
      completedAt: null,
      scope: (sh.scope||[]).map(t=>({id:uid(),text:t,done:false})),
      photos: [],
      receipts: [],
      feedback: null,
      cover: null,
      notes: '',
      numPeople: '',
      inductionDone: false,
      clockIn: '',
      breakStart: '',
      breakEnd: '',
      clockOut: '',
    };
    Store.add('jobs', j);
  }
  return j;
}

function jobDispStatus(job, shift){
  if(!job) return 'scheduled';
  if(job.status==='completed') return 'completed';
  if(job.status==='in_progress') return 'in_progress';
  // check overdue
  if(shift){
    const due = new Date(job.date);
    const[eh,em]=shift.endTime.split(':').map(Number);
    due.setHours(eh,em,0,0);
    if(due < NOW) return 'overdue';
  }
  return 'scheduled';
}

function monthRevenue(d){
  return db.shifts
    .filter(s=>s.status==='active')
    .reduce((sum,s)=>{
      const hrs = timeDiffHrs(s.startTime, s.endTime);
      let days=0;
      for(let dd=1; dd<=31; dd++){
        const dt=new Date(d.getFullYear(),d.getMonth(),dd);
        if(dt.getMonth()!==d.getMonth()) break;
        if(s.days.includes(dt.getDay())) days++;
      }
      return sum + hrs * days * s.chargeRate;
    }, 0);
}
function monthCost(d){
  return db.shifts
    .filter(s=>s.status==='active')
    .reduce((sum,s)=>{
      const hrs = timeDiffHrs(s.startTime, s.endTime);
      let days=0;
      for(let dd=1; dd<=31; dd++){
        const dt=new Date(d.getFullYear(),d.getMonth(),dd);
        if(dt.getMonth()!==d.getMonth()) break;
        if(s.days.includes(dt.getDay())) days++;
      }
      return sum + hrs * days * s.payRate;
    }, 0);
}

// ─── 7. RENDER ENGINE ────────────────────────────────────────────────────────

function render(){
  // show login if not authenticated (session-based — clears on tab close)
  const auth = JSON.parse(sessionStorage.getItem('cc_auth')||'null');
  if(!auth){
    el('loginScreen').style.display='flex';
    el('appShell').style.display='none';
    return;
  }
  el('loginScreen').style.display='none';
  el('appShell').style.display='flex';

  paintSidebar(auth);
  const views = {
    dashboard, calendar, jobs, clients, sites, shifts, employees, payroll, invoices, report, field,
  };
  el('root').innerHTML = `<div class="wrap">${(views[S.view]||dashboard)()}</div>`;
  el('modalRoot').innerHTML = S.modal ? S.modal() : '';
  bindAll();
}

function paintSidebar(auth){
  // role seg
  // Only managers can see the role toggle
  const roleSeg = el('roleSeg');
  if(roleSeg) roleSeg.style.display = auth?.role==='manager' ? '' : 'none';
  document.querySelectorAll('#roleSeg button').forEach(b=>b.classList.toggle('on',b.dataset.role===S.role));
  // field user picker
  const up=el('userPick');
  if(S.role==='field'){
    up.style.display='block';
    up.innerHTML=`<select onchange="app.setFieldEmp(this.value)">
        ${db.employees.map(e=>`<option value="${e.id}" ${e.id===S.fieldEmp?'selected':''}>${esc(e.name)}${e.status==='sick'?' (sick)':''}</option>`).join('')}
      </select>`;
  } else { up.style.display='none'; }
  // nav items (sidebar)
  const NAV_ICONS = {
    dashboard:`<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>`,
    calendar:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M1.5 6.5h13M5 1.5v2M11 1.5v2" stroke-linecap="round"/><circle cx="5.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="10" r="1" fill="currentColor" stroke="none"/></svg>`,
    jobs:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2a4 4 0 0 0-4 4c0 .4.1.8.2 1.1L2.6 10.7A1.5 1.5 0 1 0 4.8 13l3.6-3.6c.3.1.7.2 1.1.2a4 4 0 1 0 .5-7.6z"/></svg>`,
    clients:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="4" width="13" height="10.5" rx="1.5"/><path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" stroke-linecap="round"/><path d="M1.5 9h13M6 9v5.5M10 9v5.5" stroke-linecap="round"/></svg>`,
    sites:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z" stroke-linejoin="round"/><circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    shifts:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    employees:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14.5c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke-linecap="round"/></svg>`,
    payroll:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4v8M6 5.5h3a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 0 0 3h3.5" stroke-linecap="round"/></svg>`,
    invoices:`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5.5h6M5 8.5h6M5 11.5h4" stroke-linecap="round"/></svg>`,
    report:`<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="3.5" height="6" rx="1"/><rect x="6.25" y="5.5" width="3.5" height="9.5" rx="1"/><rect x="11.5" y="2" width="3.5" height="13" rx="1"/></svg>`,
  };
  const nav=el('mnav');
  if(S.role==='manager'){
    nav.style.display='flex';
    const items=[
      ['dashboard','Dashboard'],['calendar','Calendar'],['jobs','Jobs'],
      ['clients','Clients'],['sites','Sites'],['shifts','Shifts'],
      ['employees','Employees'],['payroll','Payroll'],['invoices','Invoices'],['report','Report'],
    ];
    nav.innerHTML=items.map(([k,l])=>`<button class="${S.view===k?'on':''}" onclick="app.go('${k}')">
      <span class="nav-icon">${NAV_ICONS[k]}</span>${l}
    </button>`).join('');
  } else { nav.style.display='none'; }
  // logged-in user chip
  const sbUser=el('sbUser');
  if(auth && sbUser){
    sbUser.innerHTML=`${av(auth.name, null,'av-sm')}
      <div><div class="sb-name">${esc(auth.name)}</div><div class="sb-role">${auth.role==='manager'?'Manager':'Field Worker'}</div></div>`;
  }
}

// keep old name as alias so nothing else breaks
const paintTop = () => { const auth=JSON.parse(sessionStorage.getItem('cc_auth')||'null'); if(auth) paintSidebar(auth); };

function bindAll(){
  // day-btn toggles inside forms (modal)
  document.querySelectorAll('.day-btn').forEach(b=>{
    b.onclick=()=>{ b.classList.toggle('on'); calcShiftProfit(); };
  });
}

// ─── 8. VIEWS ────────────────────────────────────────────────────────────────

/* ── Dashboard ── */
function dashboard(){
  const todayEvt = calEventsForDate(NOW);
  const rev = monthRevenue(S.invMonth);
  const cost= monthCost(S.invMonth);
  const sick= db.employees.filter(e=>e.status==='sick').length;
  const activeShifts = db.shifts.filter(s=>s.status==='active').length;

  const todayRows = todayEvt.map(({shift,job})=>{
    const emp  = getEmployee(shift.assignedTo);
    const site = getSite(shift.siteId);
    if(!emp||!site) return '';
    const st = jobDispStatus(job, shift);
    return `<div class="row clk" onclick="app.openEvent('${shift.id}','${toDateStr(NOW)}')">
      ${av(emp.name, emp.color, 'av-sm')}
      <div class="grow">
        <div class="t truncate">${esc(shift.name)} <span class="muted">· ${esc(site.name)}</span></div>
        <div class="s">${fmtT(shift.startTime)}–${fmtT(shift.endTime)} · ${esc(emp.name)}</div>
      </div>
      <div class="right">${sbadge(st)}</div>
    </div>`;
  }).join('');

  const recentJobs = db.jobs.filter(j=>j.status==='completed')
    .sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)).slice(0,5);

  const recentRows = recentJobs.map(j=>{
    const sh = getShift(j.shiftId), site = getSite(j.siteId), emp = getEmployee(j.assignedTo);
    if(!sh||!site||!emp) return '';
    return `<div class="row clk" onclick="app.openJob('${j.id}')">
      ${av(emp.name,emp.color,'av-sm')}
      <div class="grow">
        <div class="t truncate">${esc(sh.name)}</div>
        <div class="s">${esc(site.name)} · ${j.date}</div>
      </div>
      <div class="right">${sbadge('completed')}</div>
    </div>`;
  }).join('') || '<div class="empty">No completed jobs yet.</div>';

  return `
  <h1 class="page-title">Operations dashboard</h1>
  <p class="page-sub">${fmtD(NOW)} · ${todayEvt.length} shifts scheduled today</p>
  <div class="grid kpis" style="margin-bottom:14px">
    <div class="kpi"><div class="lbl">Monthly revenue</div><div class="val">${money(rev)}</div><div class="sub">ex-GST · ${monthName(S.invMonth)}</div></div>
    <div class="kpi"><div class="lbl">Subcontractor cost</div><div class="val">${money(cost)}</div><div class="sub">payroll this month</div></div>
    <div class="kpi"><div class="lbl">Gross profit</div><div class="val">${money(rev-cost)}</div><div class="sub">${rev?Math.round((rev-cost)/rev*100):0}% margin</div></div>
    <div class="kpi"><div class="lbl">Active shifts</div><div class="val">${activeShifts}</div><div class="sub">across ${db.sites.length} sites</div></div>
    <div class="kpi ${sick?'attn':''}"><div class="lbl">On sick leave</div><div class="val" ${sick?'style="color:var(--red)"':''}>${sick}</div><div class="sub">${db.employees.filter(e=>e.status==='active').length} active workers</div></div>
    <div class="kpi"><div class="lbl">Clients</div><div class="val">${db.clients.length}</div><div class="sub">${db.sites.length} sites total</div></div>
  </div>
  <div class="grid cards-2">
    <div class="card">
      <div class="hd">Today's shifts <span class="muted" style="font-weight:400;font-size:13px">${todayEvt.length} jobs</span>
        <button class="btn sm" onclick="app.go('calendar')">Calendar →</button>
      </div>
      <div class="bd">${todayRows||'<div class="empty">No shifts scheduled today.</div>'}</div>
    </div>
    <div class="card">
      <div class="hd">Recent completed jobs</div>
      <div class="bd">${recentRows}</div>
    </div>
  </div>
  <div class="grid cards-2">
    <div class="card">
      <div class="hd">Clients <button class="btn sm primary" onclick="app.newClient()">+ New client</button></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>Sites</th><th>Status</th></tr></thead>
        <tbody>${db.clients.map(c=>`<tr class="clk" onclick="app.openClient('${c.id}')">
          <td><b>${esc(c.name)}</b><div class="s">${esc(c.contact)}</div></td>
          <td class="num">${db.sites.filter(s=>s.clientId===c.id).length}</td>
          <td><span class="badge b-green"><span class="dot"></span>Active</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="hd">Subcontractors</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>Rate</th><th>Status</th></tr></thead>
        <tbody>${db.employees.map(e=>`<tr class="clk" onclick="app.openEmployee('${e.id}')">
          <td><div style="display:flex;align-items:center;gap:8px">${av(e.name,e.color,'av-sm')}<div><b>${esc(e.name)}</b><div class="s">${esc(e.position)}</div></div></div></td>
          <td class="num">$${e.payRate}/h</td>
          <td>${e.status==='sick'?'<span class="badge b-purple"><span class="dot"></span>Sick</span>':'<span class="badge b-green"><span class="dot"></span>Active</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`;
}

/* ── Calendar ── */
function calendar(){
  const m  = S.calMonth;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const grid  = startOfWeekMon(first);
  const dows  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let cells='';
  for(let i=0;i<42;i++){
    const cd   = addDays(grid,i);
    const other= cd.getMonth()!==m.getMonth();
    const isToday = sameDay(cd,NOW);
    const evts = calEventsForDate(cd, S.calView);
    const chips= evts.slice(0,3).map(({shift,job})=>{
      const emp=getEmployee(shift.assignedTo);
      if(!emp) return '';
      const st=jobDispStatus(job,shift);
      const dotColor = st==='completed'?'var(--green)':st==='overdue'?'var(--red)':st==='in_progress'?'var(--amber)':emp.color;
      return `<div class="cal-chip" title="${esc(shift.name)} · ${esc(emp.name)}"><span class="cd" style="background:${dotColor}"></span><span style="overflow:hidden;text-overflow:ellipsis">${esc(getSite(shift.siteId)?.name||'')} ${fmtT(shift.startTime)}</span></div>`;
    }).join('');
    const more = evts.length>3?`<div class="cal-more">+${evts.length-3} more</div>`:'';
    const dateNumHtml = isToday?`<span class="today-num">${cd.getDate()}</span>`:`<span>${cd.getDate()}</span>`;
    cells+=`<div class="cal-cell ${other?'other':''} ${isToday?'today':''} ${(!other&&evts.length)?'has':''}" ${(!other&&evts.length)?`onclick="app.openDay(${cd.getFullYear()},${cd.getMonth()},${cd.getDate()})"`:''}>
      <div class="cal-date">${dateNumHtml}${evts.length&&!other?`<span class="cnt">${evts.length}</span>`:''}</div>
      ${chips}${more}
    </div>`;
  }

  const legend = db.employees.map(e=>`<span class="cal-chip" style="width:auto;display:inline-flex"><span class="cd" style="background:${e.color}"></span>${esc(e.name.split(' ')[0])}</span>`).join('');

  const calViewLabel = S.calView==='regular'
    ? 'Regular Calendar – Recurring Ongoing'
    : 'Ad Hoc Calendar – One-off Jobs';
  const calSubtitle = S.calView==='regular'
    ? 'Showing recurring shifts · click any day to open'
    : 'Showing one-off jobs · click any day to open';

  return `
  <div class="calhead no-print">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <h1 class="page-title" style="margin:0">${calViewLabel}</h1>
      <select class="cal-view-sel" onchange="app.setCalView(this.value)">
        <option value="regular" ${S.calView==='regular'?'selected':''}>Regular – Recurring Ongoing</option>
        <option value="adhoc"   ${S.calView==='adhoc'  ?'selected':''}>Ad Hoc – One-off Jobs</option>
      </select>
    </div>
    <div class="spacer"></div>
    <div class="seg no-print">
      <button onclick="app.calNav(-1)">‹</button>
      <button class="on" style="cursor:default;min-width:130px">${monthName(m)}</button>
      <button onclick="app.calNav(1)">›</button>
    </div>
    <button class="btn no-print" onclick="app.calToday()">Today</button>
    <button class="btn primary no-print" onclick="app.newShift()">+ Shift</button>
  </div>
  <p class="page-sub">${calSubtitle}</p>
  <div class="card">
    <div class="bd" style="padding:0">
      <div class="cal">
        ${dows.map(d=>`<div class="dow">${d}</div>`).join('')}
        ${cells}
      </div>
      <div style="padding:0 14px 12px"><div class="legend">${legend}</div></div>
    </div>
  </div>`;
}

/* ── Jobs ── */
function jobs(){
  const f=S.filters;
  let list=[...db.jobs].sort((a,b)=>b.date.localeCompare(a.date));
  if(f.status) list=list.filter(j=>jobDispStatus(j,getShift(j.shiftId))===f.status);
  if(f.site)   list=list.filter(j=>j.siteId===f.site);
  if(f.emp)    list=list.filter(j=>j.assignedTo===f.emp);
  if(f.q){ const q=f.q.toLowerCase(); list=list.filter(j=>{
    const sh=getShift(j.shiftId),site=getSite(j.siteId),emp=getEmployee(j.assignedTo);
    return [sh?.name,site?.name,emp?.name].some(s=>s?.toLowerCase().includes(q));
  });}

  return `
  <h1 class="page-title">Jobs / work orders</h1>
  <p class="page-sub">${list.length} of ${db.jobs.length} stored jobs · recurring shifts show on the calendar</p>
  <div class="filters">
    <input placeholder="🔍 Search…" id="jobs_search" value="${esc(f.q)}" oninput="app.filterQ(this.value)">
    <select onchange="app.filter('status',this.value)">
      <option value="">All statuses</option>
      ${['scheduled','in_progress','completed','overdue'].map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
    </select>
    <select onchange="app.filter('site',this.value)">
      <option value="">All sites</option>
      ${db.sites.map(s=>`<option value="${s.id}" ${f.site===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
    </select>
    <select onchange="app.filter('emp',this.value)">
      <option value="">All workers</option>
      ${db.employees.map(e=>`<option value="${e.id}" ${f.emp===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}
    </select>
  </div>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Shift</th><th>Site</th><th>Worker</th><th>Date</th><th>Scope</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${list.length ? list.map(j=>{
        const sh=getShift(j.shiftId),site=getSite(j.siteId),emp=getEmployee(j.assignedTo);
        if(!sh||!site||!emp) return '';
        const st=jobDispStatus(j,sh);
        const done=j.scope.filter(s=>s.done).length;
        return `<tr class="clk" onclick="app.openJob('${j.id}')">
          <td><b>${esc(sh.name)}</b></td>
          <td>${esc(site.name)}</td>
          <td><div style="display:flex;align-items:center;gap:7px">${av(emp.name,emp.color,'av-sm')}<span>${esc(emp.name.split(' ')[0])}</span></div></td>
          <td>${j.date}</td>
          <td><div style="display:flex;align-items:center;gap:7px"><div class="prog" style="width:70px"><i style="width:${j.scope.length?Math.round(done/j.scope.length*100):0}%"></i></div><span class="s">${done}/${j.scope.length}</span></div></td>
          <td>${sbadge(st)}</td>
          <td><button class="btn sm" onclick="event.stopPropagation();app.openJob('${j.id}')">Open</button></td>
        </tr>`;
      }).join('') : '<tr><td colspan="7" class="empty">No jobs recorded yet. Start a job from the calendar.</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

/* ── Clients ── */
function clients(){
  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Clients</h1>
    <div class="spacer"></div>
    <button class="btn primary" onclick="app.newClient()">+ New client</button>
  </div>
  <p class="page-sub">${db.clients.length} clients · ${db.sites.length} sites</p>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Client</th><th>Contact</th><th>Phone</th><th>Sites</th><th>Monthly rev.</th><th>Actions</th></tr></thead>
      <tbody>${db.clients.map(c=>{
        const sitesC=db.sites.filter(s=>s.clientId===c.id);
        const rev=sitesC.reduce((sum,s)=>sum+s.budget,0);
        return `<tr class="clk" onclick="app.openClient('${c.id}')">
          <td><b>${esc(c.name)}</b><div class="s muted">${esc(c.legal||'')}</div></td>
          <td>${esc(c.contact)}</td><td>${esc(c.phone)}</td>
          <td class="num">${sitesC.length}</td>
          <td class="num"><b>${money(rev)}</b></td>
          <td><button class="btn sm" onclick="event.stopPropagation();app.editClient('${c.id}')">Edit</button>
              <button class="btn sm danger" onclick="event.stopPropagation();app.deleteItem('clients','${c.id}')">Delete</button></td>
        </tr>`;}).join('')}
      </tbody>
    </table></div>
  </div>`;
}

/* ── Sites ── */
function sites(){
  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Sites</h1>
    <div class="spacer"></div>
    <button class="btn primary" onclick="app.newSite()">+ New site</button>
  </div>
  <p class="page-sub">${db.sites.length} sites across ${db.clients.length} clients</p>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Site</th><th>Client</th><th>Address</th><th>Billing</th><th>Budget/mo</th><th>Shifts</th><th>Actions</th></tr></thead>
      <tbody>${db.sites.map(s=>{
        const c=getClient(s.clientId),sup=getEmployee(s.supervisor);
        return `<tr class="clk" onclick="app.openSite('${s.id}')">
          <td><b>${esc(s.name)}</b><div class="s muted">Supervisor: ${esc(sup?.name||'—')}</div></td>
          <td>${esc(c?.name||'—')}</td>
          <td class="muted">${esc(s.address)}</td>
          <td>${esc(s.billing)}</td>
          <td class="num">${money(s.budget)}</td>
          <td class="num">${shiftsForSite(s.id).length}</td>
          <td><button class="btn sm" onclick="event.stopPropagation();app.editSite('${s.id}')">Edit</button>
              <button class="btn sm danger" onclick="event.stopPropagation();app.deleteItem('sites','${s.id}')">Delete</button></td>
        </tr>`;}).join('')}
      </tbody>
    </table></div>
  </div>`;
}

/* ── Shifts ── */
function shifts(){
  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Shifts</h1>
    <div class="spacer"></div>
    <button class="btn primary" onclick="app.newShift()">+ New shift</button>
  </div>
  <p class="page-sub">${db.shifts.filter(s=>s.status==='active').length} active shifts · click calendar to see schedule</p>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Shift name</th><th>Site</th><th>Days</th><th>Time</th><th>Worker</th><th>Charge rate</th><th>Pay rate</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${db.shifts.map(sh=>{
        const site=getSite(sh.siteId),emp=getEmployee(sh.assignedTo);
        const dayNames=sh.days.map(d=>DAYS[d].slice(0,3)).join(', ');
        const hrs=timeDiffHrs(sh.startTime,sh.endTime);
        return `<tr>
          <td><b>${esc(sh.name)}</b></td>
          <td>${esc(site?.name||'—')}</td>
          <td class="muted" style="font-size:12px">${dayNames}</td>
          <td>${fmtT(sh.startTime)}–${fmtT(sh.endTime)} <span class="muted s">${hrs}h</span></td>
          <td>${emp?`<div style="display:flex;align-items:center;gap:6px">${av(emp.name,emp.color,'av-sm')}<span>${esc(emp.name.split(' ')[0])}</span></div>`:'—'}</td>
          <td class="num">$${sh.chargeRate}/h</td>
          <td class="num">$${sh.payRate}/h</td>
          <td><span class="badge ${sh.status==='active'?'b-green':'b-slate'}">${sh.status}</span></td>
          <td><button class="btn sm" onclick="app.editShift('${sh.id}')">Edit</button>
              <button class="btn sm danger" onclick="app.deleteItem('shifts','${sh.id}')">Delete</button></td>
        </tr>`;}).join('')}
      </tbody>
    </table></div>
  </div>`;
}

/* ── Employees ── */
function employees(){
  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Subcontractors</h1>
    <div class="spacer"></div>
    <button class="btn primary" onclick="app.newEmployee()">+ Add subcontractor</button>
  </div>
  <p class="page-sub">${db.employees.filter(e=>e.status==='active').length} active · ${db.employees.filter(e=>e.status==='sick').length} on sick leave</p>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Name</th><th>Position</th><th>ABN</th><th>Pay rate</th><th>Skills</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${db.employees.map(e=>`<tr class="clk" onclick="app.openEmployee('${e.id}')">
        <td><div style="display:flex;align-items:center;gap:10px">${av(e.name,e.color)}<div><b>${esc(e.name)}</b><div class="s">${esc(e.entity)} · ${esc(e.phone)}</div></div></div></td>
        <td>${esc(e.position)}</td>
        <td class="muted" style="font-family:monospace;font-size:12.5px">${esc(e.abn)}</td>
        <td class="num">$${e.payRate}/h</td>
        <td class="muted">${esc(e.skills)}</td>
        <td>${e.status==='sick'?'<span class="badge b-purple"><span class="dot"></span>Sick leave</span>':'<span class="badge b-green"><span class="dot"></span>Active</span>'}</td>
        <td><button class="btn sm" onclick="event.stopPropagation();app.editEmployee('${e.id}')">Edit</button>
            <button class="btn sm danger" onclick="event.stopPropagation();app.deleteItem('employees','${e.id}')">Del</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

/* ── Payroll helpers ── */
function payrollCalc(e, yr, mo){
  const monthStr    = `${yr}-${pad(mo+1)}`;
  const periodStart = `${yr}-${pad(mo+1)}-01`;
  const periodEnd   = `${yr}-${pad(mo+1)}-25`;

  function jobActualHrs(j){
    if(j.clockIn && j.clockOut) return Math.max(0, timeDiffHrs(j.clockIn,j.clockOut) - (j.breakStart&&j.breakEnd ? timeDiffHrs(j.breakStart,j.breakEnd):0));
    return null;
  }

  // Only count completed jobs in the billing period
  const completedJobs = db.jobs.filter(j=>
    j.assignedTo===e.id &&
    j.date>=periodStart && j.date<=periodEnd &&
    j.status==='completed'
  );

  const bySite = {};
  completedJobs.forEach(j=>{
    const sh = getShift(j.shiftId), site = getSite(j.siteId);
    if(!sh||!site) return;
    const shiftHrs = timeDiffHrs(sh.startTime, sh.endTime);
    const actual = jobActualHrs(j);
    const hrs = actual !== null ? actual : shiftHrs;
    if(!bySite[site.id]) bySite[site.id]={site, shift:sh, schedHrs:0, actualHrs:0, hasActual:false, jobsDone:0, jobsTotal:0};
    bySite[site.id].schedHrs += shiftHrs;
    bySite[site.id].actualHrs += hrs;
    if(actual!==null) bySite[site.id].hasActual=true;
    bySite[site.id].jobsDone++;
    bySite[site.id].jobsTotal++;
  });

  const totalSchedHrs  = Object.values(bySite).reduce((sum,v)=>sum+v.schedHrs, 0);
  const totalActualHrs = Object.values(bySite).reduce((sum,v)=>sum+v.actualHrs, 0);
  const billedHrs = totalActualHrs || totalSchedHrs;
  const gross     = billedHrs * (e.payRate||0);
  const superAmt  = e.superEligible !== false ? gross * SUPER : 0;
  const total     = gross + superAmt;
  const inv       = db.empinvoices.find(i=>i.empId===e.id && i.month===monthStr) || {status:'pending',invoiceFile:'',invoiceAmount:''};

  return {bySite, totalSchedHrs, totalActualHrs, billedHrs, gross, superAmt, total, inv, monthStr};
}

/* ── Payroll summary list ── */
function payroll(){
  const d = S.payMonth;
  const yr = d.getFullYear(), mo = d.getMonth();

  const statusColors = {pending:'b-slate',submitted:'b-blue',approved:'b-amber',paid:'b-green'};

  let grandTotal = 0;
  const rows = db.employees.map(e=>{
    const {total, billedHrs, inv} = payrollCalc(e, yr, mo);
    grandTotal += total;
    const statusLabel = (inv.status||'pending');
    return `
    <tr style="cursor:pointer" onclick="app.openEmpInvoice('${e.id}','${yr}','${mo}')">
      <td><div style="display:flex;align-items:center;gap:10px">${av(e.name,e.color,'av-sm')}<div><b>${esc(e.name)}</b>${e.preferred?` <span style="color:var(--muted-c);font-weight:400">(${esc(e.preferred)})</span>`:''}<div class="s">${esc(e.empType||'Contractor')} · $${e.payRate}/h</div></div></div></td>
      <td class="num">${billedHrs.toFixed(1)}h</td>
      <td class="num">${money(total)}</td>
      <td><span class="badge ${statusColors[statusLabel]}">${statusLabel.charAt(0).toUpperCase()+statusLabel.slice(1)}</span></td>
      <td><button class="btn sm primary" onclick="event.stopPropagation();app.openEmpInvoice('${e.id}','${yr}','${mo}')">Open Invoice</button></td>
    </tr>`;
  }).join('');

  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Payroll &amp; Invoices</h1>
    <div class="spacer"></div>
    <div class="seg no-print">
      <button onclick="app.payNav(-1)">‹</button>
      <button class="on" style="cursor:default;min-width:140px">${monthName(d)}</button>
      <button onclick="app.payNav(1)">›</button>
    </div>
  </div>
  <p class="page-sub">Billing period: 1–25 ${monthName(d)} · Super rate: 11.5% · Total payable: <b>${money(grandTotal)}</b></p>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Employee</th><th>Hours</th><th>Total payable</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

/* ── Employee invoice modal ── */
function empInvoiceModal(empId, yr, mo){
  const e = getEmployee(empId);
  if(!e) return;
  const d = new Date(yr, mo, 1);

  S.modal = ()=>{
    const {bySite, totalSchedHrs, totalActualHrs, billedHrs, gross, superAmt, total, inv, monthStr} = payrollCalc(e, yr, mo);
    const submitted = parseFloat(inv.invoiceAmount)||0;
    const diff = submitted ? Math.abs(total - submitted) : null;
    const match = diff!==null && diff<0.5;
    const statusColors = {pending:'b-slate',submitted:'b-blue',approved:'b-amber',paid:'b-green'};

    const siteRows = Object.values(bySite).map(({site, shift, schedHrs, actualHrs, hasActual, jobsDone, jobsTotal})=>`
      <tr>
        <td>
          <div style="font-weight:600">${esc(site.name)}</div>
          <div class="s">${esc(site.address||'')}</div>
        </td>
        <td class="num">${esc(shift.name)}</td>
        <td class="num">${fmtT(shift.startTime)} – ${fmtT(shift.endTime)}</td>
        <td class="num">${jobsDone}/${jobsTotal} days</td>
        <td class="num">${schedHrs.toFixed(1)}h</td>
        <td class="num">${hasActual ? actualHrs.toFixed(1)+'h' : '<span class="muted">—</span>'}</td>
        <td class="num">${money(schedHrs*(e.payRate||0))}</td>
      </tr>`).join('');

    const hasSites = Object.keys(bySite).length > 0;

    const inner = `
    <div class="mhd">
      <div>
        <div style="display:flex;align-items:center;gap:10px">${av(e.name,e.color,'av-sm')}
          <div>
            <div style="font-size:16px;font-weight:700">${esc(e.name)}${e.preferred?' ('+esc(e.preferred)+')':''}</div>
            <div class="s">Billing period: 1–25 ${monthName(d)} · ${esc(e.empType||'Contractor')} · $${e.payRate}/h</div>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${statusColors[inv.status]||'b-slate'}">${(inv.status||'pending').charAt(0).toUpperCase()+(inv.status||'pending').slice(1)}</span>
        <button class="x" onclick="app.close()">×</button>
      </div>
    </div>
    <div class="mbd">

      <div class="sec">Assigned Shifts &amp; Sites</div>
      ${hasSites ? `
      <div class="tbl-wrap" style="margin-bottom:18px"><table>
        <thead><tr><th>Site</th><th>Shift</th><th>Times</th><th>Days done</th><th>Sched hrs</th><th>Actual hrs</th><th>Amount</th></tr></thead>
        <tbody>${siteRows}</tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right;font-weight:600">Totals</td>
          <td class="num"><b>${totalSchedHrs.toFixed(1)}h</b></td>
          <td class="num"><b>${totalActualHrs>0?totalActualHrs.toFixed(1)+'h':'—'}</b></td>
          <td class="num"><b>${money(totalSchedHrs*(e.payRate||0))}</b></td>
        </tr></tfoot>
      </table></div>` : `<p class="muted" style="font-size:13px;margin-bottom:16px">No active shifts assigned to this employee.</p>`}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        <div class="kpi"><div class="lbl">Billed hours</div><div class="val">${billedHrs.toFixed(1)}h</div></div>
        <div class="kpi"><div class="lbl">Pay rate</div><div class="val">$${e.payRate}/h</div></div>
        <div class="kpi"><div class="lbl">Gross pay</div><div class="val">${money(gross)}</div></div>
        <div class="kpi"><div class="lbl">Super (11.5% of base)</div><div class="val">${e.superEligible!==false ? money(superAmt) : '<span style="color:var(--muted-c);font-size:13px">Not eligible</span>'}</div></div>
        <div class="kpi" style="grid-column:span 2;border-color:var(--brand)"><div class="lbl">System total payable</div><div class="val" style="color:var(--brand);font-size:26px">${money(total)}</div></div>
      </div>

      <div class="sec">Invoice Cross-Check</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div class="field" style="flex:1;min-width:180px">
          <label>Employee submitted amount ($)</label>
          <input class="input" type="number" id="inv_amt_${e.id}" placeholder="0.00" value="${inv.invoiceAmount||''}">
        </div>
        <button class="btn sm primary" onclick="app.saveInvAmount('${e.id}','${monthStr}')">Save</button>
        ${submitted ? `<span class="badge ${match?'b-green':'b-red'}" style="align-self:center">${match?'✓ Matches system total':'✗ Differs by '+money(diff)}</span>` : ''}
      </div>

      <div class="sec">Employee Invoice File</div>
      ${inv.invoiceFile ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px 14px;background:#f0fdf4;border:1px solid #22c55e;border-radius:8px">
        <span style="color:#16a34a;font-size:15px">✓</span>
        <span style="flex:1;font-size:13px;font-weight:600">${esc(inv.invoiceFile)}</span>
        <button class="btn sm primary" onclick="app.downloadEmpInvoice('${e.id}','${monthStr}')">Download</button>
      </div>` : ''}
      <label class="uploader" style="margin-bottom:16px">
        ${inv.invoiceFile ? 'Replace file' : '＋ Upload invoice (PDF or image)'}
        <input type="file" accept=".pdf,image/*" onchange="app.uploadEmpInvoice(event,'${e.id}','${monthStr}')">
      </label>

      <div class="sec">Status</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${['pending','submitted','approved','paid'].map(s=>`<button class="btn sm ${inv.status===s?'primary':''}" onclick="app.setInvStatus('${e.id}','${monthStr}','${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`).join('')}
      </div>

    </div>
    <div class="mbd" style="border-top:1px solid var(--border);padding-top:14px">
      <button class="btn" onclick="app.close()">Close</button>
    </div>`;
    return ovl(inner, true);
  };
  render();
}

/* ── Invoices ── */
function invoices(){
  const d   = S.invMonth;
  const yr  = d.getFullYear(), mo = d.getMonth();
  const monthStr    = `${yr}-${pad(mo+1)}`;
  const isCompany   = S.invView === 'company';

  /* ── Company view ── */
  function companyView(){
    const rows = db.clients.map(c=>{
      const sitesC = db.sites.filter(s=>s.clientId===c.id);
      let subtotal = 0;
      sitesC.forEach(s=>{
        db.shifts.filter(sh=>sh.siteId===s.id&&sh.status==='active').forEach(sh=>{
          const h=timeDiffHrs(sh.startTime,sh.endTime);
          let days=0;
          for(let dd=1;dd<=31;dd++){
            const dt=new Date(yr,mo,dd);
            if(dt.getMonth()!==mo) break;
            if(sh.days.includes(dt.getDay())) days++;
          }
          subtotal+=h*days*sh.chargeRate;
        });
      });
      const gst=subtotal*GST;
      return {c,sitesC,subtotal,gst,total:subtotal+gst};
    });
    const grandTotal=rows.reduce((s,r)=>s+r.total,0);
    return `
    <p class="page-sub">Estimated client invoices · active recurring shifts × charge rate + 10% GST · Grand total: <b>${money(grandTotal)}</b></p>
    <div class="card">
      <div class="tbl-wrap"><table>
        <thead><tr><th>Client</th><th>Sites</th><th>Subtotal</th><th>GST 10%</th><th>Total</th><th></th></tr></thead>
        <tbody>${rows.map(({c,sitesC,subtotal,gst,total})=>`<tr>
          <td><b>${esc(c.name)}</b></td>
          <td class="num">${sitesC.length}</td>
          <td class="num">${money(subtotal)}</td>
          <td class="num">${money(gst)}</td>
          <td class="num"><b>${money(total)}</b></td>
          <td><button class="btn sm" onclick="window.print()">Print</button></td>
        </tr>`).join('')}
        <tr><td colspan="4" style="text-align:right;font-weight:700">Grand total (incl. GST)</td><td class="num"><b>${money(grandTotal)}</b></td><td></td></tr>
        </tbody>
      </table></div>
    </div>`;
  }

  /* ── Employee view ── */
  function employeeView(){
    const statusColors = {pending:'b-slate',submitted:'b-blue',approved:'b-amber',paid:'b-green'};
    let grandTotal = 0;
    const rows = db.employees.map(e=>{
      const {total, billedHrs, inv} = payrollCalc(e, yr, mo);
      grandTotal += total;
      const statusLabel = inv.status||'pending';
      const hasFile = !!inv.invoiceFile;
      return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px">${av(e.name,e.color,'av-sm')}<div><b>${esc(e.name)}</b>${e.preferred?` <span style="color:var(--muted-c)">(${esc(e.preferred)})</span>`:''}<div class="s">${esc(e.empType||'Contractor')}</div></div></div></td>
        <td class="num">${billedHrs.toFixed(1)}h</td>
        <td class="num">${money(total)}</td>
        <td>${hasFile
          ? `<span style="color:var(--green);font-size:13px">✓ ${esc(inv.invoiceFile)}</span>`
          : `<span class="muted" style="font-size:13px">Not uploaded</span>`}</td>
        <td><span class="badge ${statusColors[statusLabel]}">${statusLabel.charAt(0).toUpperCase()+statusLabel.slice(1)}</span></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn sm primary" onclick="app.openEmpInvoice('${e.id}','${yr}','${mo}')">Open</button>
          ${hasFile ? `<button class="btn sm" onclick="app.downloadEmpInvoice('${e.id}','${monthStr}')">Download</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    return `
    <p class="page-sub">Employee invoices · billing period 1–25 ${monthName(d)} · Total payable: <b>${money(grandTotal)}</b></p>
    <div class="card">
      <div class="tbl-wrap"><table>
        <thead><tr><th>Employee</th><th>Hours</th><th>Total payable</th><th>Invoice file</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Invoicing</h1>
    <div class="spacer"></div>
    <select class="cal-view-sel" onchange="app.setInvView(this.value)">
      <option value="company"  ${isCompany?'selected':''}>Company Invoices — Clients</option>
      <option value="employee" ${!isCompany?'selected':''}>Employee Invoices — Staff</option>
    </select>
    <div class="seg no-print">
      <button onclick="app.invNav(-1)">‹</button>
      <button class="on" style="cursor:default;min-width:130px">${monthName(d)}</button>
      <button onclick="app.invNav(1)">›</button>
    </div>
    <button class="btn no-print" onclick="window.print()">Print</button>
  </div>
  ${isCompany ? companyView() : employeeView()}`;
}

/* ── Weekly Report ── */
function report(){
  const ws=addDays(startOfWeekMon(NOW),S.weekOff*7);
  const we=addDays(ws,6);
  const rows=db.employees.map(e=>{
    let total=0,completed=0,hrs=0;
    for(let i=0;i<7;i++){
      const d=addDays(ws,i);
      const evts=calEventsForDate(d).filter(ev=>ev.shift.assignedTo===e.id);
      total+=evts.length;
      evts.forEach(({shift,job})=>{
        if(job?.status==='completed'){completed++; hrs+=timeDiffHrs(shift.startTime,shift.endTime);}
      });
    }
    return {e,total,completed,hrs,pay:hrs*e.payRate};
  });
  return `
  <div class="calhead">
    <h1 class="page-title" style="margin:0">Weekly report</h1>
    <div class="spacer"></div>
    <div class="seg no-print">
      <button onclick="app.week(-1)">‹ Prev</button>
      <button class="on" style="cursor:default">${fmtDShort(ws)} – ${fmtDShort(we)} ${we.getFullYear()}</button>
      <button onclick="app.week(1)">Next ›</button>
    </div>
    <button class="btn no-print" onclick="window.print()">🖨 Print</button>
  </div>
  <p class="page-sub">Shift summary by subcontractor for the selected week</p>
  <div class="card">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Subcontractor</th><th>Shifts assigned</th><th>Completed</th><th>Hours</th><th>Est. pay</th><th>Status</th></tr></thead>
      <tbody>${rows.map(({e,total,completed,hrs,pay})=>`<tr>
        <td><div style="display:flex;align-items:center;gap:10px">${av(e.name,e.color,'av-sm')}<b>${esc(e.name)}</b></div></td>
        <td class="num">${total}</td>
        <td class="num">${completed}</td>
        <td class="num">${hrs.toFixed(1)}h</td>
        <td class="num">${money(pay)}</td>
        <td>${e.status==='sick'?'<span class="badge b-purple"><span class="dot"></span>Sick</span>':'<span class="badge b-green"><span class="dot"></span>Active</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

/* ── Field view ── */
function field(){
  const emp=getEmployee(S.fieldEmp);
  if(!emp) return '<div class="wrap"><div class="empty">Select a worker above.</div></div>';
  const mine=db.shifts.filter(s=>s.assignedTo===emp.id&&s.status==='active');
  const todayEvt=calEventsForDate(NOW).filter(ev=>ev.shift.assignedTo===emp.id);
  const weekStart=startOfWeekMon(NOW);
  let wkTotal=0,wkDone=0;
  for(let i=0;i<7;i++){
    const d=addDays(weekStart,i);
    calEventsForDate(d).filter(ev=>ev.shift.assignedTo===emp.id).forEach(({shift,job})=>{
      wkTotal++; if(job?.status==='completed') wkDone++;
    });
  }
  const monthHrs=mine.reduce((sum,s)=>{
    const h=timeDiffHrs(s.startTime,s.endTime);
    let days=0;
    for(let dd=1;dd<=31;dd++){
      const dt=new Date(NOW.getFullYear(),NOW.getMonth(),dd);
      if(dt.getMonth()!==NOW.getMonth()) break;
      if(s.days.includes(dt.getDay())) days++;
    }
    return sum+h*days;
  },0);
  const monthPay=monthHrs*emp.payRate;

  // upcoming 7 days
  const upcomingGroups={};
  for(let i=0;i<7;i++){
    const d=addDays(NOW,i);
    const evts=calEventsForDate(d).filter(ev=>ev.shift.assignedTo===emp.id);
    if(evts.length) upcomingGroups[toDateStr(d)]=evts;
  }

  return `<div class="phone">
    <div class="ptop">
      <div class="hi">Good ${NOW.getHours()<12?'morning':NOW.getHours()<18?'afternoon':'evening'},</div>
      <div class="nm">${esc(emp.name.split(' ')[0])} 👋</div>
      <div class="pstat">
        <div class="b"><div class="v">${todayEvt.length}</div><div class="l">today</div></div>
        <div class="b"><div class="v">${wkDone}/${wkTotal}</div><div class="l">this week</div></div>
        <div class="b"><div class="v">${money(monthPay)}</div><div class="l">est. pay</div></div>
      </div>
    </div>
    <div class="pbody">
      ${emp.status==='sick'
        ?`<div class="sick-banner">🤒 You're on sick leave. <button class="btn sm" style="margin-left:auto" onclick="app.clearSick('${emp.id}')">I'm back</button></div>`
        :`<button class="btn block danger" onclick="app.markSick('${emp.id}')">🤒 Report sick & request cover</button>`}
      ${Object.entries(upcomingGroups).map(([ds,evts])=>{
        const dt=parseDate(ds);
        const lbl=sameDay(dt,NOW)?'Today — '+fmtD(dt):fmtD(dt);
        return `<div class="daygroup">${lbl}</div>`
          +evts.map(({shift,job})=>{
            const site=getSite(shift.siteId);
            const st=jobDispStatus(job,shift);
            const isToday=sameDay(dt,NOW);
            const done=job?job.scope.filter(s=>s.done).length:0;
            const tot=shift.scope?.length||0;
            return `<div class="jobcard ${isToday?'today':''}" onclick="app.openEvent('${shift.id}','${ds}')">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
                <div><div class="jt">${esc(shift.name)}</div><div class="jl">📍 ${esc(site?.name||'')}</div></div>
                ${sbadge(st)}
              </div>
              <div class="jl" style="margin-top:8px">🕐 ${fmtT(shift.startTime)}–${fmtT(shift.endTime)}</div>
              ${tot?`<div class="prog" style="margin-top:9px;width:100%"><i style="width:${Math.round(done/tot*100)}%"></i></div>`:''}
            </div>`;
          }).join('');
      }).join('') || '<div class="empty">No upcoming shifts.</div>'}
    </div>
  </div>`;
}

// ─── 9. MODALS ────────────────────────────────────────────────────────────────

function ovl(inner, wide=false){
  return `<div class="overlay" onclick="if(event.target===this)app.close()">
    <div class="modal ${wide?'wide':''}">${inner}</div>
  </div>`;
}

/* ── Job / event modal ── */
function jobModalFor(jobId){
  const j=getJob(jobId);
  if(!j) return ()=>'';
  return ()=>{
    const sh=getShift(j.shiftId),site=getSite(j.siteId),emp=getEmployee(j.assignedTo);
    if(!sh||!site||!emp) return '';
    const st=jobDispStatus(j,sh);
    const done=j.scope.filter(s=>s.done).length;
    return ovl(`
      <div class="mhd">
        <div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
            ${sbadge(st)}
            <span class="badge ${sh.type==='oneoff'?'b-purple':'b-blue'}">${sh.type==='oneoff'?'One-off':'Recurring'}</span>
          </div>
          <h2 style="margin:0 0 2px;font-size:19px">${esc(sh.name)}</h2>
          <div class="muted" style="font-size:13px">📍 ${esc(site.name)} · ${j.date}</div>
        </div>
        <button class="x" onclick="app.close()">×</button>
      </div>
      <div class="mbd">

        <div class="sec" style="margin-top:0">Job details</div>
        <dl class="kv">
          <dt>Company</dt><dd><b>${esc(clientOf(site.id)?.name||'—')}</b></dd>
          <dt>Address</dt><dd>${esc(site.address||'—')}</dd>
          <dt>Scheduled</dt><dd>${fmtT(sh.startTime)} – ${fmtT(sh.endTime)} · ${timeDiffHrs(sh.startTime,sh.endTime)}h</dd>
          <dt>Worker</dt><dd>${esc(emp.name)}</dd>
          ${S.role==='manager'?`<dt>Pricing</dt><dd>$${sh.chargeRate}/h charge · $${sh.payRate}/h cost</dd>`:''}
        </dl>

        <div class="sec">Number of people on site</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <input class="input" type="number" min="1" id="jf_people" placeholder="e.g. 2" value="${esc(j.numPeople||'')}" style="max-width:120px">
          <button class="btn sm" onclick="app.saveJobField('${j.id}','numPeople',el('jf_people').value)">Save</button>
        </div>

        <div class="sec">Induction</div>
        <label class="chk-row" style="margin-bottom:14px">
          <input type="checkbox" ${j.inductionDone?'checked':''} onchange="app.saveJobField('${j.id}','inductionDone',this.checked)">
          <span>Site induction completed</span>
        </label>

        <div class="sec">Time &amp; breaks</div>
        <div class="form-grid" style="margin-bottom:8px">
          <div class="field"><label>Clock in</label><input class="input" type="time" id="jf_clockin" value="${j.clockIn||''}" onchange="app.saveJobField('${j.id}','clockIn',this.value)"></div>
          <div class="field"><label>Clock out</label><input class="input" type="time" id="jf_clockout" value="${j.clockOut||''}" onchange="app.saveJobField('${j.id}','clockOut',this.value)"></div>
        </div>
        <div class="form-grid" style="margin-bottom:14px">
          <div class="field"><label>Break start</label><input class="input" type="time" id="jf_bstart" value="${j.breakStart||''}" onchange="app.saveJobField('${j.id}','breakStart',this.value)"></div>
          <div class="field"><label>Break end</label><input class="input" type="time" id="jf_bend" value="${j.breakEnd||''}" onchange="app.saveJobField('${j.id}','breakEnd',this.value)"></div>
        </div>

        <div class="sec">Job description / scope — ${done}/${j.scope.length}</div>
        ${j.scope.map(sc=>`
          <div class="scope-item ${sc.done?'done':''}">
            <div class="chk ${sc.done?'on':''}" onclick="app.toggleScope('${j.id}','${sc.id}')">${sc.done?'✓':''}</div>
            <span class="txt">${esc(sc.text)}</span>
          </div>`).join('')}
        ${j.notes?`<div class="note" style="margin-top:10px">📝 ${esc(j.notes)}</div>`:''}

        <div class="sec">Photos${!j.photos.some(p=>p.type==='after')&&st==='completed'?' <span class="badge b-amber">missing after photo</span>':''}</div>
        <div class="photos">${j.photos.length===0?'<div class="muted" style="font-size:13px;margin-bottom:8px">No photos yet.</div>':''}
          ${j.photos.map(p=>`<div class="photo"><img src="${p.url}" alt=""><div class="cap"><span class="${p.type==='before'?'ph-before':'ph-after'}">${p.type==='before'?'Before':'After'}</span><span>${p.ts}</span></div></div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <label class="uploader" style="flex:1">＋ Before photo<input type="file" accept="image/*" onchange="app.onPhoto(event,'before','${j.id}')"></label>
          <label class="uploader" style="flex:1">＋ After photo<input type="file" accept="image/*" onchange="app.onPhoto(event,'after','${j.id}')"></label>
        </div>

        <div class="sec">Consumer goods receipts</div>
        <div style="margin-bottom:8px">
          ${(j.receipts||[]).length===0?'<div class="muted" style="font-size:13px;margin-bottom:8px">No receipts uploaded yet.</div>':''}
          ${(j.receipts||[]).map(r=>`<div class="row"><span class="badge b-blue">🧾</span><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${r.ts}</div></div></div>`).join('')}
        </div>
        <label class="uploader">＋ Upload receipt<input type="file" accept="image/*,.pdf" onchange="app.onReceipt(event,'${j.id}')"></label>

        ${j.feedback?`
          <div class="sec">Client feedback</div>
          <div class="card" style="margin-bottom:0"><div class="bd">
            ${stars(j.feedback.rating)} <b>${j.feedback.rating}.0</b>
            ${j.feedback.comment?`<div style="margin-top:6px">"${esc(j.feedback.comment)}"</div>`:''}
          </div></div>` : (st==='completed'?`
          <div class="sec">Simulate client feedback</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div class="field"><label>Rating</label>
              <select class="input" id="fbRating"><option value="5">★★★★★ 5</option><option value="4">★★★★ 4</option><option value="3">★★★ 3</option><option value="2">★★ 2</option><option value="1">★ 1</option></select>
            </div>
            <div class="field" style="flex:1"><label>Comment</label><input class="input" id="fbComment" placeholder="e.g. Very thorough, thank you."></div>
            <button class="btn primary" onclick="app.addFeedback('${j.id}')">Submit</button>
          </div>`:'') }

        <div class="sec">Actions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${st==='scheduled'?`<button class="btn primary" onclick="app.startJob('${j.id}')">▶ Start job</button>`:''}
          ${st==='in_progress'?`<button class="btn primary" onclick="app.completeJob('${j.id}')">✓ Mark complete</button>`:''}
          ${st==='overdue'?`<button class="btn danger" onclick="app.completeJob('${j.id}')">Mark completed</button>`:''}
        </div>
      </div>`, true);
  };
}

/* ── Day modal ── */
function dayModal(y,mo,d){
  return ()=>{
    const date=new Date(y,mo,d);
    const evts=calEventsForDate(date, S.calView).sort((a,b)=>a.shift.startTime.localeCompare(b.shift.startTime));
    return ovl(`
      <div class="mhd"><div>
        <h2 style="margin:0;font-size:19px">${fmtD(date)}</h2>
        <div class="muted" style="font-size:13px">${evts.length} shift${evts.length!==1?'s':''}</div>
      </div><button class="x" onclick="app.close()">×</button></div>
      <div class="mbd">${evts.length ? evts.map(({shift,job})=>{
        const emp=getEmployee(shift.assignedTo), site=getSite(shift.siteId);
        if(!emp||!site) return '';
        const st=jobDispStatus(job,shift);
        const done=job?job.scope.filter(s=>s.done).length:0;
        return `<div class="row clk" onclick="app.openEvent('${shift.id}','${toDateStr(date)}')">
          ${av(emp.name,emp.color,'av-sm')}
          <div class="grow">
            <div class="t">${esc(shift.name)} <span class="muted">· ${esc(site.name)}</span></div>
            <div class="s">🕐 ${fmtT(shift.startTime)}–${fmtT(shift.endTime)} · ${esc(emp.name)}</div>
            ${job?`<div class="prog" style="margin-top:5px;width:120px"><i style="width:${job.scope.length?Math.round(done/job.scope.length*100):0}%"></i></div>`:''}
          </div>
          <div class="right">
            ${sbadge(st)}
            <span class="badge ${shift.type==='oneoff'?'b-purple':'b-blue'}" style="font-size:11px">${shift.type==='oneoff'?'One-off':'Recurring'}</span>
          </div>
        </div>`;
      }).join('') : '<div class="empty">No shifts.</div>'}</div>`, false);
  };
}

/* ── Client detail modal ── */
function clientDetailModal(cid){
  return ()=>{
    const c=getClient(cid);
    if(!c) return '';
    const sitesC=db.sites.filter(s=>s.clientId===cid);
    const rev=sitesC.reduce((s,x)=>s+x.budget,0);
    return ovl(`
      <div class="mhd"><div>
        <h2 style="margin:0;font-size:19px">${esc(c.name)}</h2>
        <div class="muted" style="font-size:13px">${esc(c.legal||'')} · since ${esc(c.since||'')}</div>
      </div>
      <button class="btn sm" onclick="app.editClient('${cid}');app.close()">Edit</button>
      <button class="x" onclick="app.close()">×</button></div>
      <div class="mbd">
        <dl class="kv">
          <dt>Address</dt><dd>${esc(c.address||'—')}</dd>
          <dt>Monthly budget</dt><dd><b>${money(rev)}</b></dd>
        </dl>
        <div class="sec">Primary contact</div>
        <dl class="kv">
          <dt>Name</dt><dd>${esc(c.c1name||c.contact||'—')}</dd>
          <dt>Mobile</dt><dd><a href="tel:${esc(c.c1phone||c.phone)}">${esc(c.c1phone||c.phone||'—')}</a></dd>
          <dt>Email</dt><dd><a href="mailto:${esc(c.c1email||c.email)}">${esc(c.c1email||c.email||'—')}</a></dd>
        </dl>
        <div class="sec">Secondary contact</div>
        <dl class="kv">
          <dt>Name</dt><dd>${esc(c.c2name||'—')}</dd>
          <dt>Mobile</dt><dd>${c.c2phone?`<a href="tel:${esc(c.c2phone)}">${esc(c.c2phone)}</a>`:'—'}</dd>
          <dt>Email</dt><dd>${c.c2email?`<a href="mailto:${esc(c.c2email)}">${esc(c.c2email)}</a>`:'—'}</dd>
        </dl>
        <div class="sec">Sites (${sitesC.length})</div>
        ${sitesC.map(s=>`<div class="row clk" onclick="app.openSite('${s.id}')">
          <div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.address)}</div></div>
          <div class="right">${money(s.budget)}/mo</div>
        </div>`).join('')||'<div class="empty">No sites yet.</div>'}
        <div style="margin-top:12px"><button class="btn primary" onclick="app.newSiteForClient('${cid}')">+ Add site</button></div>
      </div>`);
  };
}

/* ── Site detail modal ── */
function siteDetailModal(sid){
  return ()=>{
    const s=getSite(sid);
    if(!s) return '';
    const c=getClient(s.clientId), sup=getEmployee(s.supervisor);
    const sh=shiftsForSite(sid);
    return ovl(`
      <div class="mhd"><div>
        <h2 style="margin:0;font-size:19px">${esc(s.name)}</h2>
        <div class="muted" style="font-size:13px">${esc(c?.name||'')} · ${esc(s.billing)}</div>
      </div>
      <button class="btn sm" onclick="app.editSite('${sid}');app.close()">Edit</button>
      <button class="x" onclick="app.close()">×</button></div>
      <div class="mbd">
        <dl class="kv">
          <dt>Address</dt><dd>${esc(s.address)}</dd>
          <dt>Supervisor</dt><dd>${esc(sup?.name||'—')}</dd>
          <dt>Billing</dt><dd>${esc(s.billing)}</dd>
          <dt>Budget</dt><dd>${money(s.budget)}/mo</dd>
          <dt>Charge rate</dt><dd>$${s.chargeRate}/h</dd>
          <dt>Contract start</dt><dd>${esc(s.contractStart)}</dd>
        </dl>
        <div class="sec">Shifts (${sh.length})</div>
        ${sh.map(x=>`<div class="row">
          <div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${x.days.map(d=>DAYS[d].slice(0,3)).join(', ')} · ${fmtT(x.startTime)}–${fmtT(x.endTime)}</div></div>
          <span class="badge ${x.status==='active'?'b-green':'b-slate'}">${x.status}</span>
        </div>`).join('')||'<div class="empty">No shifts yet.</div>'}
        <div style="margin-top:12px"><button class="btn primary" onclick="app.newShiftForSite('${sid}')">+ Add shift</button></div>
      </div>`);
  };
}

/* ── Employee detail modal ── */
function employeeDetailModal(eid){
  return ()=>{
    const e=getEmployee(eid);
    if(!e) return '';
    const myShifts=shiftsForEmp(eid);
    const docsSoon=e.docs?.filter(dc=>{if(!dc.expiry)return false;return new Date(dc.expiry)<=addDays(NOW,60);})||[];
    return ovl(`
      <div class="mhd">
        ${av(e.name,e.color)}
        <div><h2 style="margin:0;font-size:19px">${esc(e.name)}${e.preferred?` <span style="font-weight:400;color:var(--muted-c)">(${esc(e.preferred)})</span>`:''}</h2>
          <div class="muted" style="font-size:13px">${esc(e.empType||e.entity||'Contractor')} · ABN ${esc(e.abn||'—')}</div>
        </div>
        <button class="btn sm" onclick="app.editEmployee('${eid}');app.close()">Edit</button>
        <button class="x" onclick="app.close()">×</button>
      </div>
      <div class="mbd">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${e.status==='sick'?'<span class="badge b-purple"><span class="dot"></span>Sick leave</span>':e.status==='inactive'?'<span class="badge b-slate"><span class="dot"></span>Inactive</span>':'<span class="badge b-green"><span class="dot"></span>Active</span>'}
          <span class="badge b-slate">$${e.payRate}/h${e.superEligible!==false?' · +11.5% super':''}</span>
        </div>
        <dl class="kv">
          <dt>Phone</dt><dd>${e.phone?`<a href="tel:${esc(e.phone)}">${esc(e.phone)}</a>`:'—'}</dd>
          <dt>Email</dt><dd>${e.email?`<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>`:'—'}</dd>
          <dt>Skills</dt><dd>${esc(e.skills||'—')}</dd>
          <dt>Since</dt><dd>${esc(e.since||'—')}</dd>
          ${e.passport?`<dt>Passport</dt><dd>${esc(e.passport)}${e.passportFile?` · <span style="color:var(--green)">✓ on file</span>`:''}</dd>`:''}
        </dl>
        <div class="sec">Emergency contact</div>
        <dl class="kv">
          <dt>Name</dt><dd>${esc(e.ecName||'—')}</dd>
          <dt>Relationship</dt><dd>${esc(e.ecRel||'—')}</dd>
          <dt>Mobile</dt><dd>${e.ecPhone?`<a href="tel:${esc(e.ecPhone)}">${esc(e.ecPhone)}</a>`:'—'}</dd>
        </dl>
        <div class="sec">Compliance</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span class="badge ${e.pli?'b-green':'b-red'}">Public liability ${e.pli?'✓':'✗'}</span>
          <span class="badge ${e.policeCheck?'b-green':'b-red'}">Police check ${e.policeCheck?'✓':'✗'}</span>
          <span class="badge ${e.whiteCard?'b-green':'b-red'}">White card ${e.whiteCard?'✓':'✗'}</span>
          <span class="badge ${e.wwcCheck?'b-green':'b-red'}">WWC check ${e.wwcCheck?'✓':'✗'}</span>
        </div>
        ${e.notes?`<div class="note" style="margin-top:10px">📝 ${esc(e.notes)}</div>`:''}
        ${(e.attachments||[]).length?`
        <div class="sec">Attachments (${e.attachments.length})</div>
        ${e.attachments.map(f=>`<div class="row"><span class="badge b-blue">📄</span><div class="grow"><div class="t">${esc(f)}</div></div></div>`).join('')}`:''}
        <div class="sec">Assigned shifts (${myShifts.length})</div>
        ${myShifts.map(sh=>{const site=getSite(sh.siteId);return `<div class="row">
          <div class="grow"><div class="t">${esc(sh.name)}</div><div class="s">${esc(site?.name||'')} · ${sh.days.map(d=>DAYS[d].slice(0,3)).join(', ')}</div></div>
          <span class="badge ${sh.status==='active'?'b-green':'b-slate'}">${sh.status}</span>
        </div>`;}).join('')||'<div class="empty">No shifts assigned.</div>'}
      </div>`);
  };
}

/* ── Create/Edit Client ── */
function clientFormModal(existingId){
  const c = existingId ? getClient(existingId) : null;
  const title = c ? 'Edit client' : 'New client';
  return ()=>ovl(`
    <div class="mhd"><div><h2 style="margin:0">${title}</h2></div><button class="x" onclick="app.close()">×</button></div>
    <div class="mbd">
      <div class="form-grid single"><div class="field"><label>Company name *</label><input class="input" id="cf_name" value="${esc(c?.name||'')}"></div></div>
      <div class="form-grid single"><div class="field"><label>Legal name</label><input class="input" id="cf_legal" value="${esc(c?.legal||'')}"></div></div>
      <div class="form-grid single"><div class="field"><label>Address</label><textarea class="input" id="cf_address">${esc(c?.address||'')}</textarea></div></div>

      <div class="sec" style="margin-top:16px">Primary contact *</div>
      <div class="form-grid">
        <div class="field"><label>Full name *</label><input class="input" id="cf_c1name" placeholder="e.g. Jane Smith" value="${esc(c?.c1name||'')}"></div>
        <div class="field"><label>Mobile *</label><input class="input" type="tel" id="cf_c1phone" placeholder="e.g. 0412 345 678" value="${esc(c?.c1phone||c?.phone||'')}"></div>
      </div>
      <div class="form-grid single"><div class="field"><label>Email *</label><input class="input" type="email" id="cf_c1email" placeholder="e.g. jane@company.com" value="${esc(c?.c1email||c?.email||'')}"></div></div>

      <div class="sec" style="margin-top:16px">Secondary contact (optional)</div>
      <div class="form-grid">
        <div class="field"><label>Full name *</label><input class="input" id="cf_c2name" placeholder="e.g. John Lee" value="${esc(c?.c2name||'')}"></div>
        <div class="field"><label>Mobile *</label><input class="input" type="tel" id="cf_c2phone" placeholder="e.g. 0498 765 432" value="${esc(c?.c2phone||'')}"></div>
      </div>
      <div class="form-grid single"><div class="field"><label>Email *</label><input class="input" type="email" id="cf_c2email" placeholder="e.g. john@company.com" value="${esc(c?.c2email||'')}"></div></div>

      <div class="form-actions">
        <button class="btn" onclick="app.close()">Cancel</button>
        <button class="btn primary" onclick="app.saveClient('${existingId||''}')">Save client</button>
      </div>
    </div>`);
}

/* ── Create/Edit Site ── */
function siteFormModal(existingId, prefillClientId){
  const s = existingId ? getSite(existingId) : null;
  const title = s ? 'Edit site' : 'New site';
  return ()=>ovl(`
    <div class="mhd"><div><h2 style="margin:0">${title}</h2></div><button class="x" onclick="app.close()">×</button></div>
    <div class="mbd">
      <div class="form-grid">
        <div class="field"><label>Site name *</label><input class="input" id="sf_name" value="${esc(s?.name||'')}"></div>
        <div class="field"><label>Client *</label>
          <select class="input" id="sf_client">
            ${db.clients.map(c=>`<option value="${c.id}" ${(s?.clientId||prefillClientId)===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid single"><div class="field"><label>Address *</label><input class="input" id="sf_address" value="${esc(s?.address||'')}"></div></div>
      <div class="form-grid">
        <div class="field"><label>Billing type</label>
          <select class="input" id="sf_billing">
            <option ${s?.billing==='Fixed monthly'?'selected':''}>Fixed monthly</option>
            <option ${s?.billing==='Hourly'?'selected':''}>Hourly</option>
          </select>
        </div>
        <div class="field"><label>Monthly budget ($)</label><input class="input" type="number" id="sf_budget" value="${s?.budget||''}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Charge rate ($/h)</label><input class="input" type="number" id="sf_charge" value="${s?.chargeRate||''}"></div>
        <div class="field"><label>Default pay rate ($/h)</label><input class="input" type="number" id="sf_pay" value="${s?.payRate||''}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Supervisor</label>
          <select class="input" id="sf_sup">
            <option value="">— none —</option>
            ${db.employees.map(e=>`<option value="${e.id}" ${s?.supervisor===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Contract start</label><input class="input" type="date" id="sf_start" value="${s?.contractStart||''}"></div>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="app.close()">Cancel</button>
        <button class="btn primary" onclick="app.saveSite('${existingId||''}')">Save site</button>
      </div>
    </div>`, true);
}

/* ── Create/Edit Shift ── */
function shiftFormModal(existingId, prefillSiteId){
  const sh = existingId ? getShift(existingId) : null;
  const title = sh ? 'Edit shift' : 'New shift';
  const selDays = sh?.days || [1,2,3,4,5];
  return ()=>ovl(`
    <div class="mhd"><div><h2 style="margin:0">${title}</h2></div><button class="x" onclick="app.close()">×</button></div>
    <div class="mbd">
      <div class="form-grid">
        <div class="field"><label>Shift name *</label><input class="input" id="shf_name" value="${esc(sh?.name||'')}"></div>
        <div class="field"><label>Site *</label>
          <select class="input" id="shf_site">
            ${db.sites.map(s=>`<option value="${s.id}" ${(sh?.siteId||prefillSiteId)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid triple">
        <div class="field"><label>Start time</label><input class="input" type="time" id="shf_start" value="${sh?.startTime||'06:00'}" oninput="calcShiftProfit()"></div>
        <div class="field"><label>End time</label><input class="input" type="time" id="shf_end" value="${sh?.endTime||'09:00'}" oninput="calcShiftProfit()"></div>
        <div class="field"><label>Type</label>
          <select class="input" id="shf_type" onchange="app.toggleShiftType()">
            <option value="recurring" ${sh?.type!=='oneoff'?'selected':''}>Recurring</option>
            <option value="oneoff" ${sh?.type==='oneoff'?'selected':''}>One-off</option>
          </select>
        </div>
      </div>
      <div id="shf_days_row" style="display:${sh?.type==='oneoff'?'none':'block'}">
        <div class="field" style="margin-bottom:14px"><label>Days of week</label>
          <div class="day-picker">
            ${[1,2,3,4,5,6,0].map((d,i)=>`<button type="button" class="day-btn ${selDays.includes(d)?'on':''}" data-day="${d}">${DAY_LABELS[i].slice(0,1)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div id="shf_date_row" style="display:${sh?.type==='oneoff'?'block':'none'}">
        <div class="field" style="margin-bottom:14px"><label>Job date *</label>
          <input class="input" type="date" id="shf_date" value="${sh?.date||toDateStr(NOW)}">
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Charge rate ($/h) *</label><input class="input" type="number" id="shf_charge" value="${sh?.chargeRate||''}" oninput="calcShiftProfit()"></div>
        <div class="field"><label>Pay rate ($/h) *</label><input class="input" type="number" id="shf_pay" value="${sh?.payRate||''}" oninput="calcShiftProfit()"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Assigned worker</label>
          <select class="input" id="shf_emp">
            <option value="">— unassigned —</option>
            ${db.employees.map(e=>`<option value="${e.id}" ${sh?.assignedTo===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="input" id="shf_status">
            <option value="active" ${sh?.status!=='inactive'?'selected':''}>Active</option>
            <option value="inactive" ${sh?.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-grid single"><div class="field"><label>Scope of work (one task per line)</label>
        <textarea class="input" id="shf_scope" style="min-height:90px">${(sh?.scope||[]).join('\n')}</textarea>
      </div></div>
      <div class="profit-bar" id="profitBar">Fill in times and rates to see profit estimate.</div>
      <div class="form-actions">
        <button class="btn" onclick="app.close()">Cancel</button>
        <button class="btn primary" onclick="app.saveShift('${existingId||''}')">Save shift</button>
      </div>
    </div>`, true);
}

/* ── Create/Edit Employee ── */
function employeeFormModal(existingId){
  const e = existingId ? getEmployee(existingId) : null;
  const title = e ? 'Edit subcontractor' : 'New subcontractor';
  const chk = (id, label, checked) =>
    `<label class="chk-row"><input type="checkbox" id="${id}" ${checked?'checked':''}><span>${label}</span></label>`;
  return ()=>ovl(`
    <div class="mhd"><div><h2 style="margin:0">${title}</h2></div><button class="x" onclick="app.close()">×</button></div>
    <div class="mbd">

      <div class="sec" style="margin-top:0">Personal details</div>
      <div class="form-grid">
        <div class="field"><label>Full name *</label><input class="input" id="ef_name" value="${esc(e?.name||'')}"></div>
        <div class="field"><label>Preferred name</label><input class="input" id="ef_preferred" placeholder="e.g. nickname" value="${esc(e?.preferred||'')}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Phone</label><input class="input" type="tel" id="ef_phone" value="${esc(e?.phone||'')}"></div>
        <div class="field"><label>Email</label><input class="input" type="email" id="ef_email" value="${esc(e?.email||'')}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Employee type *</label>
          <select class="input" id="ef_emptype">
            ${['Full time','Part time','Casual','Contractor'].map(t=>`<option ${(e?.empType||'Casual')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Position</label><input class="input" id="ef_position" placeholder="e.g. Cleaner, Supervisor" value="${esc(e?.position||'')}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Pay rate ($/h) *</label><input class="input" type="number" id="ef_pay" value="${e?.payRate||''}"></div>
        <div class="field"><label>Super eligible</label>
          <select class="input" id="ef_supereligible">
            <option value="yes" ${(e?.superEligible!==false)?'selected':''}>Yes — 11.5% super on top</option>
            <option value="no" ${e?.superEligible===false?'selected':''}>No — pay rate only</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>ABN</label>
          <input class="input" id="ef_abn" placeholder="e.g. 12 345 678 901" value="${esc(e?.abn||'')}" oninput="app.fmtAbn(this)" maxlength="14">
          <div id="ef_abn_status" style="font-size:12px;margin-top:4px;color:var(--muted-c)">${e?.abnVerified?`<span style="color:var(--green)">✓ Verified</span>`:'Enter 11-digit ABN'}</div>
          <button type="button" class="btn sm" style="margin-top:6px" onclick="app.verifyAbn()">Verify ABN</button>
        </div>
        <div class="field"><label>Started</label><input class="input" type="month" id="ef_since" value="${esc(e?.since||'')}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Skills / site types</label>
          <select class="input" id="ef_skills">
            <option value="">Select skill type</option>
            ${['Cleaning','General Labour','Manager'].map(s=>`<option value="${s}" ${e?.skills===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="input" id="ef_status">
            <option value="active" ${e?.status==='active'||!e?'selected':''}>Active</option>
            <option value="sick" ${e?.status==='sick'?'selected':''}>Sick leave</option>
            <option value="inactive" ${e?.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>

      <div class="sec">Passport</div>
      <div class="form-grid single">
        <div class="field"><label>Passport number</label><input class="input" id="ef_passport" placeholder="e.g. PA1234567" value="${esc(e?.passport||'')}"></div>
      </div>
      <div class="field" style="margin-bottom:14px">
        <label>Passport document</label>
        <label class="uploader" style="margin-top:4px">
          ${e?.passportFile?`<span style="color:var(--green)">✓ ${esc(e.passportFile)}</span> · replace`:'＋ Upload passport scan'}
          <input type="file" accept="image/*,.pdf" onchange="app.uploadPassport(event,'${existingId||''}')">
        </label>
      </div>

      <div class="sec">Emergency contact</div>
      <div class="form-grid">
        <div class="field"><label>Contact name</label><input class="input" id="ef_ecname" placeholder="e.g. Sarah Smith" value="${esc(e?.ecName||'')}"></div>
        <div class="field"><label>Relationship</label><input class="input" id="ef_ecrel" placeholder="e.g. Spouse, Parent" value="${esc(e?.ecRel||'')}"></div>
      </div>
      <div class="form-grid single">
        <div class="field"><label>Emergency mobile</label><input class="input" type="tel" id="ef_ecphone" placeholder="e.g. 0412 345 678" value="${esc(e?.ecPhone||'')}"></div>
      </div>

      <div class="sec">Compliance checks</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;min-width:220px"><input type="checkbox" id="ef_pli" ${e?.pli?'checked':''}> Public liability insurance</label>
          <input class="input" id="ef_pli_ref" placeholder="Policy / reference number" value="${esc(e?.pliRef||'')}" style="flex:1;min-width:160px">
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;min-width:220px"><input type="checkbox" id="ef_police" ${e?.policeCheck?'checked':''}> Police check</label>
          <input class="input" id="ef_police_ref" placeholder="Reference number" value="${esc(e?.policeRef||'')}" style="flex:1;min-width:160px">
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;min-width:220px"><input type="checkbox" id="ef_wcard" ${e?.whiteCard?'checked':''}> White card</label>
          <input class="input" id="ef_wcard_ref" placeholder="Card / licence number" value="${esc(e?.whiteCardRef||'')}" style="flex:1;min-width:160px">
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;min-width:220px"><input type="checkbox" id="ef_wwc" ${e?.wwcCheck?'checked':''}> Working With Children (WWC) check</label>
          <input class="input" id="ef_wwc_ref" placeholder="WWC number" value="${esc(e?.wwcRef||'')}" style="flex:1;min-width:160px">
        </div>
      </div>

      <div class="sec">Other attachments</div>
      <div class="field" style="margin-bottom:14px">
        <label>Upload documents (certifications, ID, etc.)</label>
        <label class="uploader" style="margin-top:4px">
          ＋ Add attachment(s)
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onchange="app.uploadAttachments(event,'${existingId||''}')">
        </label>
        ${(e?.attachments||[]).length?`<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
          ${(e.attachments||[]).map((f,i)=>`<div style="display:flex;align-items:center;gap:8px;font-size:13px">
            <span style="color:var(--green)">✓</span>
            <span style="flex:1">${esc(f)}</span>
            <button class="btn sm danger" onclick="app.removeAttachment('${existingId||''}',${i})">Remove</button>
          </div>`).join('')}
        </div>`:'<div class="muted" style="font-size:12px;margin-top:6px">No attachments yet.</div>'}
      </div>

      <div class="sec">Account Details</div>
      <div class="form-grid">
        <div class="field"><label>Bank name</label><input class="input" id="ef_bankname" placeholder="e.g. Commonwealth Bank" value="${esc(e?.bankName||'')}"></div>
        <div class="field"><label>Name on account</label><input class="input" id="ef_bankacctname" placeholder="Full name as on account" value="${esc(e?.bankAcctName||'')}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>BSB</label><input class="input" id="ef_bsb" placeholder="e.g. 062-000" maxlength="7" value="${esc(e?.bsb||'')}"></div>
        <div class="field"><label>Account number</label><input class="input" id="ef_acctno" placeholder="e.g. 12345678" value="${esc(e?.acctNo||'')}"></div>
      </div>

      <div class="sec">Special notes</div>
      <div class="form-grid single">
        <div class="field"><textarea class="input" id="ef_notes" placeholder="Any additional notes…" style="min-height:80px">${esc(e?.notes||'')}</textarea></div>
      </div>

      <div class="form-actions">
        <button class="btn" onclick="app.close()">Cancel</button>
        <button class="btn primary" onclick="app.saveEmployee('${existingId||''}')">Save</button>
      </div>
    </div>`, true);
}

// ─── 10. APP ACTIONS ─────────────────────────────────────────────────────────

function calcShiftProfit(){
  const t1=el('shf_start')?.value, t2=el('shf_end')?.value;
  const cr=parseFloat(el('shf_charge')?.value)||0, pr=parseFloat(el('shf_pay')?.value)||0;
  const bar=el('profitBar'); if(!bar) return;
  if(!t1||!t2||!cr) { bar.textContent='Fill in times and rates to see profit estimate.'; return; }
  const hrs=timeDiffHrs(t1,t2);
  const activeDays=document.querySelectorAll('.day-btn.on').length||5;
  const wkRev=hrs*activeDays*cr, wkCost=hrs*activeDays*pr, wkProfit=wkRev-wkCost;
  bar.textContent=`Weekly: ${hrs*activeDays}h · Revenue ${money(wkRev)} · Cost ${money(wkCost)} · Profit ${money(wkProfit)}`;
}

function toast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:22px;right:22px;background:var(--brand);color:#fff;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:500;z-index:999;box-shadow:0 4px 14px rgba(0,0,0,.2)';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2400);
}

const app = {
  login(){
    try {
      const user = (el('loginUser')||{}).value.trim().toLowerCase();
      const pass = (el('loginPass')||{}).value;
      const acct = ACCOUNTS.find(a=>a.username===user && a.password===pass);
      const errEl = el('loginErr');
      if(!acct){
        errEl.textContent='Incorrect username or password.';
        errEl.style.display='block';
        return;
      }
      errEl.style.display='none';
      sessionStorage.setItem('cc_auth', JSON.stringify({username:acct.username, name:acct.name, role:acct.role}));
      S.role = acct.role;
      S.view = acct.role==='field' ? 'field' : 'dashboard';
      render();
    } catch(e) {
      const errEl = el('loginErr');
      if(errEl){ errEl.textContent='Error: '+e.message; errEl.style.display='block'; }
      console.error('login error', e);
    }
  },
  logout(){
    sessionStorage.removeItem('cc_auth');
    render();
  },

  go(v){ S.view=v; render(); },
  close(){ S.modal=null; render(); },
  setRole(r){ S.role=r; if(r==='field'){ S.view='field'; } else { S.view='dashboard'; } render(); },
  setFieldEmp(id){ S.fieldEmp=id; render(); },
  setCalView(v){ S.calView=v; render(); },
  toggleShiftType(){
    const isOneOff = el('shf_type')?.value==='oneoff';
    const dr=el('shf_days_row'), dtr=el('shf_date_row');
    if(dr)  dr.style.display  = isOneOff ? 'none'  : 'block';
    if(dtr) dtr.style.display = isOneOff ? 'block' : 'none';
  },
  calNav(d){ S.calMonth=new Date(S.calMonth.getFullYear(), S.calMonth.getMonth()+d, 1); render(); },
  calToday(){ S.calMonth=new Date(NOW.getFullYear(),NOW.getMonth(),1); render(); },
  payNav(d){ S.payMonth=new Date(S.payMonth.getFullYear(), S.payMonth.getMonth()+d, 1); render(); },
  invNav(d){ S.invMonth=new Date(S.invMonth.getFullYear(), S.invMonth.getMonth()+d, 1); render(); },
  setInvView(v){ S.invView=v; render(); },

  downloadEmpInvoice(empId, monthStr){
    const inv = db.empinvoices.find(i=>i.empId===empId && i.month===monthStr);
    if(!inv?.invoiceUrl){ toast('No invoice file uploaded yet.'); return; }
    window.open(inv.invoiceUrl, '_blank');
  },

  openEmpInvoice(empId, yr, mo){ empInvoiceModal(empId, parseInt(yr), parseInt(mo)); },

  saveInvAmount(empId, monthStr){
    const val = document.getElementById('inv_amt_'+empId)?.value || '';
    let inv = db.empinvoices.find(i=>i.empId===empId && i.month===monthStr);
    if(!inv){ inv={id:'ei'+Date.now(), empId, month:monthStr, invoiceFile:'', invoiceAmount:'', status:'pending', uploadedAt:''}; db.empinvoices.push(inv); }
    inv.invoiceAmount = val;
    if(val && inv.status==='pending') inv.status='submitted';
    Store.save('empinvoices', db.empinvoices);
    render();
  },

  async uploadEmpInvoice(event, empId, monthStr){
    const file = event.target.files[0]; if(!file) return;
    toast('Uploading invoice...');
    try {
      const url = await sbUpload(`invoices/${empId}/${monthStr}/${file.name}`, file);
      let inv = db.empinvoices.find(i=>i.empId===empId && i.month===monthStr);
      if(!inv){
        inv={id:'ei'+Date.now(), empId, month:monthStr, invoiceFile:'', invoiceUrl:'', invoiceAmount:'', status:'pending', uploadedAt:''};
        db.empinvoices.push(inv);
      }
      inv.invoiceFile = file.name; inv.invoiceUrl = url;
      inv.uploadedAt = new Date().toISOString();
      if(inv.status==='pending') inv.status='submitted';
      Store.save('empinvoices', db.empinvoices);
      toast('Invoice uploaded: '+file.name); render();
    } catch(e){ console.error(e); toast('Upload failed — check Storage bucket.'); }
  },

  setInvStatus(empId, monthStr, status){
    let inv = db.empinvoices.find(i=>i.empId===empId && i.month===monthStr);
    if(!inv){ inv={id:'ei'+Date.now(), empId, month:monthStr, invoiceFile:'', invoiceAmount:'', status:'pending', uploadedAt:''}; db.empinvoices.push(inv); }
    inv.status = status;
    Store.save('empinvoices', db.empinvoices);
    render();
  },
  week(d){ S.weekOff+=d; render(); },
  filter(k,v){ S.filters[k]=v; render(); },
  filterQ(v){
    S.filters.q=v;
    // re-render only the jobs list, preserving search input focus
    const root=document.getElementById('root');
    if(root && S.view==='jobs'){
      const focused=document.activeElement?.id;
      const pos=document.activeElement?.selectionStart;
      render();
      const el2=document.getElementById(focused);
      if(el2){ el2.focus(); try{ el2.setSelectionRange(pos,pos); }catch{} }
    }
  },

  // ABN helpers
  fmtAbn(input){
    let v=input.value.replace(/\D/g,'').slice(0,11);
    if(v.length>2) v=v.slice(0,2)+' '+v.slice(2);
    if(v.length>6) v=v.slice(0,6)+' '+v.slice(6);
    if(v.length>10) v=v.slice(0,10)+' '+v.slice(10);
    input.value=v;
  },
  verifyAbn(){
    const raw=(el('ef_abn')?.value||'').replace(/\s/g,'');
    const status=el('ef_abn_status');
    if(!status) return;
    if(raw.length!==11||!/^\d{11}$/.test(raw)){ status.innerHTML='<span style="color:#ef4444">ABN must be 11 digits</span>'; return; }
    // ABN checksum validation (Australian algorithm)
    const weights=[10,1,3,5,7,9,11,13,15,17,19];
    const digits=raw.split('').map(Number);
    digits[0]-=1;
    const sum=digits.reduce((s,d,i)=>s+d*weights[i],0);
    if(sum%89===0){
      status.innerHTML='<span style="color:var(--green)">✓ Valid ABN format</span>';
    } else {
      status.innerHTML='<span style="color:#ef4444">✗ Invalid ABN — check the number</span>';
    }
  },

  openDay(y,m,d){ S.modal=dayModal(y,m,d); render(); },

  openEvent(shiftId, ds){
    const j = getOrCreateJob(shiftId, ds);
    S.modal = jobModalFor(j.id);
    render();
  },

  openJob(id){ S.modal=jobModalFor(id); render(); },

  openClient(id){ S.modal=clientDetailModal(id); render(); },
  openSite(id){ S.modal=siteDetailModal(id); render(); },
  openEmployee(id){ S.modal=employeeDetailModal(id); render(); },

  // ── Client CRUD ──
  newClient(){ S.modal=clientFormModal(null); render(); },
  editClient(id){ S.modal=clientFormModal(id); render(); },
  saveClient(id){
    const name=el('cf_name')?.value.trim();
    const c1name=el('cf_c1name')?.value.trim();
    const c1phone=el('cf_c1phone')?.value.trim();
    const c1email=el('cf_c1email')?.value.trim();
    const c2name=el('cf_c2name')?.value.trim();
    const c2phone=el('cf_c2phone')?.value.trim();
    const c2email=el('cf_c2email')?.value.trim();
    if(!name)    { toast('Company name is required.'); return; }
    if(!c1name)  { toast('Primary contact name is required.'); return; }
    if(!c1phone) { toast('Primary contact mobile is required.'); return; }
    if(!c1email) { toast('Primary contact email is required.'); return; }
    // secondary contact is optional
    const data={
      name, legal:el('cf_legal')?.value.trim()||'',
      address:el('cf_address')?.value.trim()||'',
      c1name, c1phone, c1email,
      c2name, c2phone, c2email,
      contact:c1name, phone:c1phone, email:c1email,
      status:'active',
    };
    if(id){ Store.update('clients',id,data); toast('Client updated.'); }
    else { Store.add('clients',{...data, id:uid(), since: new Date().getFullYear()+'-'+pad(new Date().getMonth()+1)}); toast('Client created!'); }
    S.modal=null; render();
  },

  // ── Site CRUD ──
  newSite(){ S.modal=siteFormModal(null,null); render(); },
  newSiteForClient(cid){ S.modal=siteFormModal(null,cid); render(); },
  editSite(id){ S.modal=siteFormModal(id,null); render(); },
  saveSite(id){
    const name=el('sf_name')?.value.trim();
    if(!name){ toast('Site name is required.'); return; }
    const data={
      name, clientId:el('sf_client')?.value||'',
      address:el('sf_address')?.value.trim()||'',
      billing:el('sf_billing')?.value||'Fixed monthly',
      budget:parseFloat(el('sf_budget')?.value)||0,
      chargeRate:parseFloat(el('sf_charge')?.value)||0,
      payRate:parseFloat(el('sf_pay')?.value)||0,
      supervisor:el('sf_sup')?.value||'',
      contractStart:el('sf_start')?.value||'',
      status:'active', hue: Math.floor(Math.random()*360),
    };
    if(id){ Store.update('sites',id,data); toast('Site updated.'); }
    else { Store.add('sites',{...data, id:uid()}); toast('Site created!'); }
    S.modal=null; render();
  },

  // ── Shift CRUD ──
  newShift(){ S.modal=shiftFormModal(null,null); render(); },
  newShiftForSite(sid){ S.modal=shiftFormModal(null,sid); render(); },
  editShift(id){ S.modal=shiftFormModal(id,null); render(); },
  saveShift(id){
    const name=el('shf_name')?.value.trim();
    if(!name){ toast('Shift name is required.'); return; }
    const days=[...document.querySelectorAll('.day-btn.on')].map(b=>parseInt(b.dataset.day));
    const scopeRaw=el('shf_scope')?.value||'';
    const scope=scopeRaw.split('\n').map(s=>s.trim()).filter(Boolean);
    const type=el('shf_type')?.value||'recurring';
    const data={
      name, siteId:el('shf_site')?.value||'',
      type,
      days: type==='oneoff' ? [] : days,
      date: type==='oneoff' ? (el('shf_date')?.value||toDateStr(NOW)) : null,
      startTime:el('shf_start')?.value||'06:00',
      endTime:el('shf_end')?.value||'09:00',
      chargeRate:parseFloat(el('shf_charge')?.value)||0,
      payRate:parseFloat(el('shf_pay')?.value)||0,
      assignedTo:el('shf_emp')?.value||'',
      status:el('shf_status')?.value||'active',
      scope,
    };
    if(id){ Store.update('shifts',id,data); toast('Shift updated.'); }
    else { Store.add('shifts',{...data, id:uid()}); toast('Shift created!'); }
    S.modal=null; render();
  },

  // ── Employee CRUD ──
  newEmployee(){ S.modal=employeeFormModal(null); render(); },
  editEmployee(id){ S.modal=employeeFormModal(id); render(); },
  saveEmployee(id){
    const name=el('ef_name')?.value.trim();
    if(!name){ toast('Full name is required.'); return; }
    const data={
      name,
      preferred:el('ef_preferred')?.value.trim()||'',
      phone:el('ef_phone')?.value.trim()||'',
      email:el('ef_email')?.value.trim()||'',
      empType:el('ef_emptype')?.value||'Casual',
      position:el('ef_position')?.value.trim()||'',
      abn:el('ef_abn')?.value.trim()||'',
      payRate:parseFloat(el('ef_pay')?.value)||0,
      superEligible: el('ef_supereligible')?.value !== 'no',
      skills:el('ef_skills')?.value||'',
      status:el('ef_status')?.value||'active',
      since:el('ef_since')?.value.trim()||'',
      passport:el('ef_passport')?.value.trim()||'',
      ecName:el('ef_ecname')?.value.trim()||'',
      ecRel:el('ef_ecrel')?.value.trim()||'',
      ecPhone:el('ef_ecphone')?.value.trim()||'',
      pli:el('ef_pli')?.checked||false,       pliRef:el('ef_pli_ref')?.value.trim()||'',
      policeCheck:el('ef_police')?.checked||false, policeRef:el('ef_police_ref')?.value.trim()||'',
      whiteCard:el('ef_wcard')?.checked||false,    whiteCardRef:el('ef_wcard_ref')?.value.trim()||'',
      wwcCheck:el('ef_wwc')?.checked||false,       wwcRef:el('ef_wwc_ref')?.value.trim()||'',
      bankName:el('ef_bankname')?.value.trim()||'',
      bankAcctName:el('ef_bankacctname')?.value.trim()||'',
      bsb:el('ef_bsb')?.value.trim()||'',
      acctNo:el('ef_acctno')?.value.trim()||'',
      notes:el('ef_notes')?.value.trim()||'',
      color: colorFor(name),
      docs:[],
    };
    if(id){ const existing=getEmployee(id); Store.update('employees',id,{...data, color:existing?.color||colorFor(name), docs:existing?.docs||[], passportFile:existing?.passportFile||'', attachments:existing?.attachments||[]}); toast('Subcontractor updated.'); }
    else { Store.add('employees',{...data, id:uid(), passportFile:'', attachments:[]}); toast('Subcontractor created!'); }
    S.modal=null; render();
  },
  async uploadPassport(event, empId){
    const file=event.target.files[0]; if(!file) return;
    if(!empId){ toast('Save the employee first.'); return; }
    toast('Uploading passport...');
    try {
      const url = await sbUpload(`employees/${empId}/passport/${file.name}`, file);
      Store.update('employees',empId,{passportFile:file.name, passportUrl:url});
      toast('Passport uploaded.'); render();
    } catch(e){ console.error(e); toast('Upload failed — check Storage bucket.'); }
  },
  async uploadAttachments(event, empId){
    if(!empId){ toast('Save the subcontractor first, then add attachments.'); return; }
    const files=[...event.target.files]; if(!files.length) return;
    toast(`Uploading ${files.length} file(s)...`);
    const existing=getEmployee(empId);
    const current=existing?.attachments||[];
    try {
      const newFiles = await Promise.all(files.map(f=>
        sbUpload(`employees/${empId}/attachments/${Date.now()}_${f.name}`, f).then(url=>({name:f.name,url}))
      ));
      Store.update('employees',empId,{attachments:[...current,...newFiles]});
      toast(`${files.length} attachment(s) uploaded.`);
      S.modal=()=>employeeFormModal(empId)(); render();
    } catch(e){ console.error(e); toast('Upload failed — check Storage bucket.'); }
  },
  removeAttachment(empId, idx){
    const existing=getEmployee(empId); if(!existing) return;
    const attachments=(existing.attachments||[]).filter((_,i)=>i!==idx);
    Store.update('employees',empId,{attachments});
    toast('Attachment removed.');
    S.modal=()=>employeeFormModal(empId)(); render();
  },

  // ── Delete ──
  deleteItem(key, id){
    if(!confirm('Delete this item? This cannot be undone.')) return;
    Store.remove(key, id);
    toast('Deleted.');
    render();
  },

  // ── Job actions ──
  startJob(id){
    Store.update('jobs',id,{status:'in_progress', startedAt:new Date().toISOString()});
    toast('Job started!'); S.modal=jobModalFor(id); render();
  },
  completeJob(id){
    const j=getJob(id);
    if(j){
      const updated=Store.update('jobs',id,{status:'completed', completedAt:new Date().toISOString(),
        scope:j.scope.map(s=>({...s,done:true}))});
    }
    toast('Job marked complete!'); S.modal=jobModalFor(id); render();
  },
  toggleScope(jobId, scopeId){
    const j=getJob(jobId); if(!j) return;
    const scope=j.scope.map(s=>s.id===scopeId?{...s,done:!s.done}:s);
    Store.update('jobs',jobId,{scope});
    S.modal=jobModalFor(jobId); render();
  },
  addFeedback(jobId){
    const r=parseInt(el('fbRating')?.value)||5;
    const c=el('fbComment')?.value.trim()||'';
    Store.update('jobs',jobId,{feedback:{rating:r,comment:c,ts:new Date().toISOString()}});
    toast('Feedback saved!'); S.modal=jobModalFor(jobId); render();
  },
  saveJobField(jobId, field, value){
    Store.update('jobs', jobId, {[field]: value});
    S.modal=jobModalFor(jobId); render();
  },
  async onPhoto(event, type, jobId){
    const file=event.target.files[0]; if(!file) return;
    toast('Uploading photo...');
    try {
      const url = await sbUpload(`jobs/${jobId}/photos/${type}_${Date.now()}_${file.name}`, file);
      const j=getJob(jobId); if(!j) return;
      const photos=[...(j.photos||[]),{type, url, name:file.name, ts:new Date().toLocaleTimeString()}];
      Store.update('jobs',jobId,{photos});
      toast(`${type==='before'?'Before':'After'} photo uploaded!`);
      S.modal=jobModalFor(jobId); render();
    } catch(e){ console.error(e); toast('Photo upload failed — check Storage bucket.'); }
  },
  async onReceipt(event, jobId){
    const file=event.target.files[0]; if(!file) return;
    toast('Uploading receipt...');
    try {
      const url = await sbUpload(`jobs/${jobId}/receipts/${Date.now()}_${file.name}`, file);
      const j=getJob(jobId); if(!j) return;
      const receipts=[...(j.receipts||[]),{name:file.name, url, ts:new Date().toLocaleTimeString()}];
      Store.update('jobs',jobId,{receipts});
      toast('Receipt uploaded: '+file.name);
      S.modal=jobModalFor(jobId); render();
    } catch(e){ console.error(e); toast('Receipt upload failed — check Storage bucket.'); }
  },

  // ── Sick leave ──
  markSick(id){
    if(!confirm('Mark as sick and notify manager?')) return;
    Store.update('employees',id,{status:'sick'});
    toast('Marked as sick. Manager notified.'); render();
  },
  clearSick(id){
    Store.update('employees',id,{status:'active'});
    toast('Welcome back! Status set to active.'); render();
  },
};

// expose calcShiftProfit globally (called from oninput)
window.calcShiftProfit = calcShiftProfit;
// expose app globally so inline onclick handlers can always reach it
window.app = app;

// ─── 11. INIT ────────────────────────────────────────────────────────────────

async function initApp(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appShell').style.display='none';
  document.body.insertAdjacentHTML('beforeend',
    '<div id="loadingScreen" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;z-index:999;gap:16px">' +
    '<div style="font-size:28px;font-weight:800;color:#0d9488">CleanCops</div>' +
    '<div style="font-size:13px;color:#64748b">Loading data...</div>' +
    '<div style="width:40px;height:4px;background:#e2e8f0;border-radius:4px;overflow:hidden"><div style="width:40%;height:100%;background:#0d9488;animation:ldpulse 1s infinite alternate"></div></div>' +
    '</div>' +
    '<style>@keyframes ldpulse{from{transform:translateX(0)}to{transform:translateX(150%)}}</style>'
  );

  // Load all tables from Supabase
  const TABLES = ['clients','sites','employees','shifts','jobs','empinvoices'];
  try {
    await Promise.all(TABLES.map(async t=>{
      const {data, error} = await _sb.from(t).select('*');
      if(error) console.error('load',t,error);
      else db[t] = data || [];
    }));
  } catch(e){
    console.error('Supabase load error:', e);
  }

  loadDB();
  document.getElementById('loadingScreen')?.remove();
  render();

  document.querySelectorAll('#roleSeg button').forEach(b=>{
    b.addEventListener('click', ()=>app.setRole(b.dataset.role));
  });

  // Real-time sync via Supabase channels
  TABLES.forEach(t=>{
    _sb.channel(t)
      .on('postgres_changes', {event:'*', schema:'public', table:t}, ()=>{
        _sb.from(t).select('*').then(({data})=>{ if(data){ db[t]=data; render(); } });
      })
      .subscribe();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
