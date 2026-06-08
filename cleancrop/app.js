// ── Sample Data ──────────────────────────────────────────────────────────────

const colors = ['c1','c2','c3','c4','c5','c6','c7','c8'];
function colorFor(name) { let h=0; for(let c of name) h=(h+c.charCodeAt(0))%8; return colors[h]; }
function initials(name) { return name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(); }
function avatar(name, size='') { return `<span class="avatar ${colorFor(name)} ${size}">${initials(name)}</span>`; }

const db = {
  clients: [
    { id:1, name:'Paccar Australia', legal:'Paccar Australia Pty Ltd', contact:'Daniel Nguyen', phone:'+61 3 9544 1200', email:'accounts@paccar.com.au', address:'14 Industrial Dr, Dandenong South VIC 3175', status:'active', since:'Jan 2023' },
    { id:2, name:'Bunnings Group', legal:'Bunnings Group Ltd', contact:'Sarah Kim', phone:'+61 3 8831 9777', email:'facilities@bunnings.com.au', address:'196 Governor Rd, Braeside VIC 3195', status:'active', since:'Mar 2023' },
    { id:3, name:'Coles Group', legal:'Coles Group Ltd', contact:'Mike Tran', phone:'+61 3 9829 5111', email:'ops@coles.com.au', address:'60 Swann Dr, Truganina VIC 3029', status:'active', since:'Jun 2023' },
    { id:4, name:'Monash Health', legal:'Monash Health', contact:'Priya Sharma', phone:'+61 3 9594 6666', email:'facilities@monashhealth.org', address:'246 Clayton Rd, Clayton VIC 3168', status:'active', since:'Aug 2022' },
    { id:5, name:'Wesfarmers Logistics', legal:'Wesfarmers Logistics Pty Ltd', contact:'Tom Wong', phone:'+61 8 9327 4211', email:'tm.wong@wesfarmers.com.au', address:'1 Wesfarmers Way, Midland WA 6056', status:'active', since:'Feb 2024' },
    { id:6, name:'Linfox DC', legal:'Linfox Pty Ltd', contact:'Jane Lee', phone:'+61 3 9279 4400', email:'j.lee@linfox.com', address:'1 Lockheed Ave, Tullamarine VIC 3043', status:'inactive', since:'Oct 2022' },
  ],
  sites: [
    { id:1, clientId:1, name:'Melbourne Plant', address:'14 Industrial Dr, Dandenong South VIC 3175', supervisor:'Priya Shah', paymentType:'Fixed per site', budget:9600, status:'active', contractStart:'01 Jan 2026' },
    { id:2, clientId:1, name:'Laverton Depot', address:'8 Boundary Rd, Laverton North VIC 3026', supervisor:'Daniel Nguyen', paymentType:'Hourly', budget:6400, status:'active', contractStart:'01 Mar 2026' },
    { id:3, clientId:2, name:'Braeside Store', address:'196 Governor Rd, Braeside VIC 3195', supervisor:'Jamie Reyes', paymentType:'Fixed per site', budget:5200, status:'active', contractStart:'01 Apr 2026' },
    { id:4, clientId:3, name:'Truganina DC', address:'60 Swann Dr, Truganina VIC 3029', supervisor:'Priya Shah', paymentType:'Hourly', budget:8000, status:'active', contractStart:'01 Jun 2026' },
    { id:5, clientId:4, name:'Clayton Hospital', address:'246 Clayton Rd, Clayton VIC 3168', supervisor:'Maria Okafor', paymentType:'Fixed per site', budget:18960, status:'active', contractStart:'15 Aug 2022' },
    { id:6, clientId:6, name:'Hume Distribution', address:'1 Lockheed Ave, Tullamarine VIC 3043', supervisor:'Tom Kovac', paymentType:'Hourly', budget:3800, status:'ended', contractStart:'01 Oct 2022' },
  ],
  shifts: [
    { id:1, siteId:1, name:'Paint booth — morning', description:'Daily clean of paint booth: spray prep, booth wipe-down, PPE check, restock consumables.', type:'Recurring', frequency:'Weekly', days:['M','T','W','T2','F'], start:'06:00', end:'12:00', hrs:6, fixedMonth:3480, payRate:32.80, status:'active', operatives:2 },
    { id:2, siteId:1, name:'Parts area', description:'Clean and tidy parts storage area.', type:'Recurring', frequency:'Weekly', days:['M','T','W','T2','F'], start:'06:00', end:'10:00', hrs:4, fixedMonth:2600, payRate:30.10, status:'active', operatives:1 },
    { id:3, siteId:1, name:'Mask-up bay', description:'3x weekly mask-up bay deep clean.', type:'Recurring', frequency:'Weekly', days:['M','W','F'], start:'13:00', end:'18:00', hrs:5, fixedMonth:1800, payRate:29.50, status:'draft', operatives:2 },
    { id:4, siteId:2, name:'Dock area sweep', description:'Morning sweep of loading docks.', type:'Recurring', frequency:'Weekly', days:['M','T','W','T2','F'], start:'05:00', end:'08:00', hrs:3, fixedMonth:1600, payRate:28.00, status:'active', operatives:1 },
    { id:5, siteId:3, name:'Amenities weekend', description:'Weekend amenities clean.', type:'Recurring', frequency:'Weekly', days:['Sa','Su'], start:'07:00', end:'09:00', hrs:2, fixedMonth:1200, payRate:35.20, status:'active', operatives:2 },
    { id:6, siteId:5, name:'Ward A & B', description:'Full ward cleaning — morning shift.', type:'Recurring', frequency:'Weekly', days:['M','T','W','T2','F','Sa','Su'], start:'06:00', end:'14:00', hrs:8, fixedMonth:8000, payRate:31.00, status:'active', operatives:4 },
  ],
  employees: [
    { id:1, name:'Jamie Reyes', position:'Paint booth operative', primarySite:'Melbourne Plant', siteId:1, abn:'12 345 678 901', entity:'Individual', phone:'0412 345 678', email:'jamie.reyes@mail.com', address:'10 Example St, Dandenong VIC 3175', rate:32.80, status:'active', isLead:true, started:'12 Jan 2026' },
    { id:2, name:'Sanjay Patel', position:'Paint booth operative', primarySite:'Melbourne Plant', siteId:1, abn:'98 765 432 109', entity:'Partnership', phone:'0423 456 789', email:'sanjay.patel@mail.com', address:'22 Surrey Rd, Keysborough VIC 3173', rate:29.50, status:'active', isLead:false, started:'04 Feb 2026' },
    { id:3, name:'Maria Okafor', position:'Paint booth operative', primarySite:'Melbourne Plant', siteId:1, abn:'45 678 901 234', entity:'Individual', phone:'0434 567 890', email:'maria.okafor@mail.com', address:'5 Glen Way, Noble Park VIC 3174', rate:29.50, status:'leave', isLead:false, started:'18 Mar 2026' },
    { id:4, name:'Aisha Lin', position:'Mask-up operative', primarySite:'Melbourne Plant', siteId:1, abn:'34 567 890 123', entity:'Individual', phone:'0445 678 901', email:'aisha.lin@mail.com', address:'42 Kingsway, Glen Waverley VIC 3150', rate:29.50, status:'active', isLead:false, started:'18 Mar 2026' },
    { id:5, name:'Tom Kovac', position:'Mask-up operative', primarySite:'Laverton Depot', siteId:2, abn:'56 789 012 345', entity:'Individual', phone:'0456 789 012', email:'tom.kovac@mail.com', address:'7 Princes Hwy, Laverton VIC 3028', rate:28.00, status:'active', isLead:false, started:'05 Apr 2026' },
    { id:6, name:'David Lambrou', position:'Floor cleaner', primarySite:'Truganina DC', siteId:4, abn:'67 890 123 456', entity:'Individual', phone:'0467 890 123', email:'david.l@mail.com', address:'33 Dohertys Rd, Truganina VIC 3029', rate:28.00, status:'active', isLead:false, started:'10 Apr 2026' },
    { id:7, name:'Priya Shah', position:'Supervisor', primarySite:'Clayton Hospital', siteId:5, abn:'78 901 234 567', entity:'Company', phone:'0478 901 234', email:'priya.shah@mail.com', address:'18 Clayton Rd, Clayton VIC 3168', rate:38.00, status:'active', isLead:true, started:'01 Aug 2022' },
    { id:8, name:'Daniel Nguyen', position:'Floater', primarySite:'Multiple sites', siteId:null, abn:'89 012 345 678', entity:'Individual', phone:'0489 012 345', email:'d.nguyen@mail.com', address:'55 Smith St, Collingwood VIC 3066', rate:32.00, status:'active', isLead:false, started:'15 Jan 2026' },
  ],
  replacements: [
    { id:1, shiftId:1, original:3, cover:4, reason:'Annual', startDate:'18 Apr 2026', endDate:'08 May 2026', scope:'Date range', payRate:29.50, status:'ongoing', hoursTotal:12 },
    { id:2, shiftId:1, original:1, cover:8, reason:'Sick', startDate:'02 May 2026', endDate:'02 May 2026', scope:'Single day', payRate:32.80, status:'upcoming', hoursTotal:6 },
    { id:3, shiftId:2, original:2, cover:6, reason:'Personal', startDate:'10 Mar 2026', endDate:'14 Mar 2026', scope:'Date range', payRate:29.50, status:'past', hoursTotal:20 },
  ],
  invoices: [
    { id:1, clientId:1, period:'May 2026', amount:21578, status:'pending', due:'05 Jun 2026' },
    { id:2, clientId:2, period:'May 2026', amount:8420, status:'paid', due:'05 Jun 2026' },
    { id:3, clientId:4, period:'May 2026', amount:18960, status:'paid', due:'05 Jun 2026' },
    { id:4, clientId:1, period:'Apr 2026', amount:21578, status:'paid', due:'05 May 2026' },
    { id:5, clientId:3, period:'May 2026', amount:5200, status:'pending', due:'05 Jun 2026' },
  ],
  payslips: [
    { id:1, empId:1, period:'March 2026', hrs:158, gross:5182.40, super:621.89, status:'paid', paidDate:'5 Apr' },
    { id:2, empId:1, period:'February 2026', hrs:144, gross:4723.20, super:566.78, status:'paid', paidDate:'5 Mar' },
    { id:3, empId:1, period:'January 2026', hrs:152, gross:4985.60, super:598.27, status:'paid', paidDate:'5 Feb' },
    { id:4, empId:2, period:'March 2026', hrs:148, gross:4366.00, super:523.92, status:'paid', paidDate:'5 Apr' },
  ],
};

// ── Computed helpers ─────────────────────────────────────────────────────────

function clientRevenue(cid) {
  return db.sites.filter(s=>s.clientId===cid).reduce((sum,s)=>sum+s.budget,0);
}

function clientProfit(cid) {
  const sites = db.sites.filter(s=>s.clientId===cid);
  let cost=0;
  sites.forEach(site=>{
    db.shifts.filter(sh=>sh.siteId===site.id).forEach(sh=>{
      const wkHrs = sh.hrs * sh.days.length * 4.33;
      cost += wkHrs * sh.payRate;
    });
  });
  return clientRevenue(cid) - Math.round(cost);
}

function clientSiteCount(cid) { return db.sites.filter(s=>s.clientId===cid).length; }

function siteShiftCount(sid) { return db.shifts.filter(s=>s.siteId===sid).length; }

function shiftEmployees(shiftId) {
  return db.employees.filter(e => {
    const site = db.sites.find(s=>s.id === db.shifts.find(sh=>sh.id===shiftId)?.siteId);
    return site && e.siteId === site.id;
  });
}

// ── Router ───────────────────────────────────────────────────────────────────

let currentView = 'dashboard';
let viewParam = null;

function navigate(view, param=null) {
  currentView = view;
  viewParam = param;
  render();
  document.querySelector('.main').scrollTo(0,0);
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  document.querySelectorAll('nav a').forEach(a=>{
    a.classList.toggle('active', a.dataset.view === currentView.split('-')[0]);
  });

  const topbar = document.getElementById('topbar-title');
  const page = document.getElementById('page');

  const views = {
    dashboard: renderDashboard,
    clients: renderClients,
    'client-detail': () => renderClientDetail(viewParam),
    'client-new': renderClientNew,
    sites: renderSites,
    'site-detail': () => renderSiteDetail(viewParam),
    'site-new': renderSiteNew,
    shifts: renderShifts,
    'shift-detail': () => renderShiftDetail(viewParam),
    'shift-new': () => renderShiftNew(viewParam),
    employees: renderEmployees,
    'employee-detail': () => renderEmployeeDetail(viewParam),
    'employee-new': renderEmployeeNew,
    replacements: renderReplacements,
    payroll: renderPayroll,
  };

  const titles = {
    dashboard: ['Dashboard', 'Overview of your business'],
    clients: ['Clients', `${db.clients.length} total · ${db.clients.filter(c=>c.status==='active').length} active`],
    'client-detail': ['Client', ''],
    'client-new': ['New Client', ''],
    sites: ['Sites', `${db.sites.length} total · ${db.sites.filter(s=>s.status==='active').length} active`],
    'site-detail': ['Site', ''],
    'site-new': ['New Site', ''],
    shifts: ['Shifts', `${db.shifts.length} total · ${db.shifts.filter(s=>s.status==='active').length} active`],
    'shift-detail': ['Shift', ''],
    'shift-new': ['Add Shift', ''],
    employees: ['Employees', `${db.employees.length} total · ${db.employees.filter(e=>e.status==='active').length} active · ${db.employees.filter(e=>e.status==='leave').length} on leave`],
    'employee-detail': ['Employee', ''],
    'employee-new': ['New Employee', ''],
    replacements: ['Replacements & Leave', ''],
    payroll: ['Payroll & Invoicing', ''],
  };

  const t = titles[currentView] || ['CleanCrop',''];
  topbar.innerHTML = `<div class="topbar-title-text">${t[0]}</div><div class="sub">${t[1]}</div>`;
  page.innerHTML = (views[currentView] || renderDashboard)();
  bindEvents();
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function renderDashboard() {
  const totalRev = db.clients.reduce((s,c)=>s+clientRevenue(c.id),0);
  const totalEmp = db.employees.filter(e=>e.status==='active').length;
  const onLeave  = db.employees.filter(e=>e.status==='leave').length;
  const pending  = db.invoices.filter(i=>i.status==='pending').reduce((s,i)=>s+i.amount,0);

  return `
  <div class="stats-row">
    <div class="stat-card">
      <div class="label">Monthly Revenue</div>
      <div class="value">$${totalRev.toLocaleString()}</div>
      <div class="sub">${db.clients.filter(c=>c.status==='active').length} active clients</div>
    </div>
    <div class="stat-card">
      <div class="label">Active Employees</div>
      <div class="value">${totalEmp}</div>
      <div class="sub">${onLeave} on leave today</div>
    </div>
    <div class="stat-card">
      <div class="label">Active Shifts</div>
      <div class="value">${db.shifts.filter(s=>s.status==='active').length}</div>
      <div class="sub">across ${db.sites.filter(s=>s.status==='active').length} sites</div>
    </div>
    <div class="stat-card">
      <div class="label">Invoices Pending</div>
      <div class="value">$${pending.toLocaleString()}</div>
      <div class="sub">${db.invoices.filter(i=>i.status==='pending').length} invoices outstanding</div>
    </div>
  </div>

  <div class="dash-grid">
    <div class="card">
      <div class="card-header"><h3>Top Clients by Revenue</h3></div>
      <div style="padding:8px 0">
        ${db.clients.filter(c=>c.status==='active').sort((a,b)=>clientRevenue(b.id)-clientRevenue(a.id)).slice(0,5).map(c=>`
          <div class="payroll-row" style="padding:12px 20px" onclick="navigate('client-detail',${c.id})">
            <div>
              <div style="font-weight:500">${c.name}</div>
              <div style="font-size:12px;color:#6b7280">${clientSiteCount(c.id)} sites</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:600">$${clientRevenue(c.id).toLocaleString()}/mo</div>
              <div style="font-size:12px;color:#16a34a">$${clientProfit(c.id).toLocaleString()} profit</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Recent Activity</h3></div>
      <div style="padding:8px 20px">
        <div class="activity-item"><div class="activity-dot"></div><div class="activity-text">Maria Okafor marked on leave — Paint booth morning</div><div class="activity-time">2h ago</div></div>
        <div class="activity-item"><div class="activity-dot" style="background:#10b981"></div><div class="activity-text">Invoice #INV-005 sent to Coles Group — $5,200</div><div class="activity-time">5h ago</div></div>
        <div class="activity-item"><div class="activity-dot" style="background:#f59e0b"></div><div class="activity-text">New shift added: Amenities weekend — Braeside Store</div><div class="activity-time">Yesterday</div></div>
        <div class="activity-item"><div class="activity-dot" style="background:#8b5cf6"></div><div class="activity-text">Aisha Lin assigned as cover for Maria Okafor</div><div class="activity-time">Yesterday</div></div>
        <div class="activity-item"><div class="activity-dot" style="background:#10b981"></div><div class="activity-text">Bunnings Group invoice paid — $8,420</div><div class="activity-time">2 days ago</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Staff on Leave</h3>
        <button class="btn btn-sm btn-secondary" onclick="navigate('replacements')">View all</button>
      </div>
      <table>
        <thead><tr><th>Employee</th><th>Site / Shift</th><th>Cover</th><th>Until</th></tr></thead>
        <tbody>
          ${db.replacements.filter(r=>r.status==='ongoing').map(r=>{
            const orig = db.employees.find(e=>e.id===r.original);
            const cov  = db.employees.find(e=>e.id===r.cover);
            const shift = db.shifts.find(s=>s.id===r.shiftId);
            return `<tr>
              <td><div class="emp-row">${avatar(orig.name)}<span class="emp-name">${orig.name}</span></div></td>
              <td>${shift.name}</td>
              <td><div class="emp-row">${avatar(cov.name)}<span>${cov.name}</span></div></td>
              <td>${r.endDate}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-header"><h3>Invoices</h3>
        <button class="btn btn-sm btn-secondary" onclick="navigate('payroll')">View all</button>
      </div>
      <table>
        <thead><tr><th>Client</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          ${db.invoices.slice(0,5).map(inv=>{
            const client = db.clients.find(c=>c.id===inv.clientId);
            return `<tr>
              <td>${client.name}</td>
              <td>${inv.period}</td>
              <td style="font-weight:600">$${inv.amount.toLocaleString()}</td>
              <td><span class="badge badge-${inv.status}">${inv.status.charAt(0).toUpperCase()+inv.status.slice(1)}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Clients ──────────────────────────────────────────────────────────────────

function renderClients() {
  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h3>Clients</h3>
        <div class="sub">${db.clients.length} total · ${db.clients.filter(c=>c.status==='active').length} active</div>
      </div>
      <div class="card-controls">
        <div class="search-box"><input id="clientSearch" placeholder="Search clients by name or contact..." oninput="filterTable('clientSearch','clientTable')"></div>
        <select onchange="filterByStatus(this,'clientTable')">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button class="btn btn-primary" onclick="navigate('client-new')">+ New client</button>
      </div>
    </div>
    <table id="clientTable">
      <thead><tr><th>Name</th><th>Contact</th><th>Sites</th><th>Monthly</th><th>Status</th></tr></thead>
      <tbody>
        ${db.clients.map(c=>`
          <tr onclick="navigate('client-detail',${c.id})" data-status="${c.status}">
            <td style="font-weight:500">${c.name}</td>
            <td>${c.phone}</td>
            <td>${clientSiteCount(c.id)}</td>
            <td style="font-weight:600">$${clientRevenue(c.id).toLocaleString()}</td>
            <td><span class="badge badge-${c.status==='active'?'active':'ended'}">${c.status==='active'?'Active':'Inactive'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="padding:10px 20px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6">Showing ${db.clients.length} of ${db.clients.length}</div>
  </div>`;
}

function renderClientDetail(id) {
  const c = db.clients.find(x=>x.id===id);
  if (!c) return '<p>Client not found.</p>';
  const sites = db.sites.filter(s=>s.clientId===id);
  const rev = clientRevenue(id);
  const profit = clientProfit(id);
  const activeShifts = sites.flatMap(s=>db.shifts.filter(sh=>sh.siteId===s.id && sh.status==='active')).length;

  return `
  <div class="breadcrumb">
    <a onclick="navigate('clients')">Clients</a><span class="sep">›</span><span>${c.name}</span>
  </div>
  <div class="detail-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div class="name">${c.name}</div>
        <div class="meta">Client since ${c.since}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary btn-sm">Edit</button>
        <span class="badge badge-${c.status==='active'?'active':'ended'}">${c.status==='active'?'Active':'Inactive'}</span>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><div class="label">Legal name</div><div class="value">${c.legal}</div></div>
      <div class="detail-field"><div class="label">Contact name</div><div class="value">${c.contact}</div></div>
      <div class="detail-field"><div class="label">Contact phone</div><div class="value">${c.phone}</div></div>
      <div class="detail-field"><div class="label">Contact email</div><div class="value">${c.email}</div></div>
      <div class="detail-field"><div class="label">Address</div><div class="value">${c.address}</div></div>
    </div>
  </div>

  <div class="perf-row">
    <div class="perf-card"><div class="p-label">Sites</div><div class="p-value">${sites.length}</div></div>
    <div class="perf-card"><div class="p-label">Active Shifts</div><div class="p-value">${activeShifts}</div></div>
    <div class="perf-card"><div class="p-label">Monthly Revenue</div><div class="p-value" style="font-size:18px">$${rev.toLocaleString()}</div></div>
    <div class="perf-card"><div class="p-label">Profit</div><div class="p-value" style="font-size:18px;color:#16a34a">$${profit.toLocaleString()}</div></div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>${sites.length} Sites</h3>
      <button class="btn btn-primary btn-sm" onclick="navigate('site-new')">+ New site</button>
    </div>
    <table>
      <thead><tr><th>Site name</th><th>Address</th><th>Shifts</th><th>Monthly</th><th>Status</th></tr></thead>
      <tbody>
        ${sites.map(s=>`
          <tr onclick="navigate('site-detail',${s.id})">
            <td style="font-weight:500">${s.name}</td>
            <td style="color:#6b7280">${s.address}</td>
            <td>${siteShiftCount(s.id)} shifts</td>
            <td style="font-weight:600">$${s.budget.toLocaleString()}</td>
            <td><span class="badge badge-${s.status==='active'?'active':'ended'}">${s.status==='active'?'Active':'Ended'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderClientNew() {
  return `
  <div class="breadcrumb">
    <a onclick="navigate('clients')">Clients</a><span class="sep">›</span><span>New</span>
  </div>
  <div class="form-page">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:20px">New client</h2>
    <div class="form-card">
      <div class="form-section-title">Company</div>
      <div class="form-row single"><div class="form-group"><label>Legal name</label><input placeholder="e.g. Paccar Australia Pty Ltd"></div></div>
    </div>
    <div class="form-card">
      <div class="form-section-title">Primary Contact</div>
      <div class="form-row">
        <div class="form-group"><label>Contact name</label><input placeholder="Full name"></div>
        <div class="form-group"><label>Contact phone</label><input placeholder="+61..."></div>
      </div>
      <div class="form-row single"><div class="form-group"><label>Contact email</label><input placeholder="accounts@company.com.au"></div></div>
      <div class="form-row single"><div class="form-group"><label>Address</label><textarea placeholder="Street, suburb, state, postcode" style="min-height:60px"></textarea></div></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="navigate('clients')">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewClient()">Create client</button>
    </div>
  </div>`;
}

// ── Sites ────────────────────────────────────────────────────────────────────

function renderSites() {
  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h3>Sites</h3>
        <div class="sub">${db.sites.length} total · ${db.sites.filter(s=>s.status==='active').length} active</div>
      </div>
      <div class="card-controls">
        <div class="search-box"><input id="siteSearch" placeholder="Search sites..." oninput="filterTable('siteSearch','siteTable')"></div>
        <select>
          <option>All clients</option>
          ${db.clients.map(c=>`<option>${c.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="navigate('site-new')">+ New site</button>
      </div>
    </div>
    <table id="siteTable">
      <thead><tr><th>Name</th><th>Client</th><th>Address</th><th>Shifts</th><th>Status</th></tr></thead>
      <tbody>
        ${db.sites.map(s=>{
          const client = db.clients.find(c=>c.id===s.clientId);
          return `<tr onclick="navigate('site-detail',${s.id})">
            <td style="font-weight:500">${s.name}</td>
            <td>${client?.name||''}</td>
            <td style="color:#6b7280">${s.address}</td>
            <td>${siteShiftCount(s.id)}</td>
            <td><span class="badge badge-${s.status==='active'?'active':'ended'}">${s.status==='active'?'Active':'Ended'}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="padding:10px 20px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6">Showing ${db.sites.length} of ${db.sites.length}</div>
  </div>`;
}

function renderSiteDetail(id) {
  const s = db.sites.find(x=>x.id===id);
  if (!s) return '<p>Site not found.</p>';
  const client = db.clients.find(c=>c.id===s.clientId);
  const shifts = db.shifts.filter(sh=>sh.siteId===id);

  return `
  <div class="breadcrumb">
    <a onclick="navigate('clients')">Clients</a><span class="sep">›</span>
    <a onclick="navigate('client-detail',${client.id})">${client.name}</a><span class="sep">›</span>
    <span>${s.name}</span>
  </div>
  <div class="detail-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div class="name">${s.name}</div>
        <div class="meta">${client.name} · ${s.status==='active'?'Active':'Ended'} contract</div>
      </div>
      <button class="btn btn-secondary btn-sm">Edit site</button>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><div class="label">Site name</div><div class="value">${s.name}</div></div>
      <div class="detail-field"><div class="label">Address</div><div class="value">${s.address}</div></div>
      <div class="detail-field"><div class="label">Client contact</div><div class="value">${client.contact} · ${client.phone}</div></div>
      <div class="detail-field"><div class="label">Assigned supervisor</div><div class="value">${s.supervisor}</div></div>
      <div class="detail-field"><div class="label">Default payment type</div><div class="value">${s.paymentType}</div></div>
      <div class="detail-field"><div class="label">Monthly budget</div><div class="value">$${s.budget.toLocaleString()} / month</div></div>
      <div class="detail-field"><div class="label">Contract start</div><div class="value">${s.contractStart}</div></div>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active">Shifts <span class="count">${shifts.length}</span></div>
    <div class="tab">Timesheets</div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>${shifts.length} Shifts</h3>
      <button class="btn btn-primary btn-sm" onclick="navigate('shift-new',${id})">+ Add shift</button>
    </div>
    <table>
      <thead><tr><th>Area</th><th>Schedule</th><th>Operatives</th><th>Hours / wk</th><th>Rate</th><th>Status</th></tr></thead>
      <tbody>
        ${shifts.map(sh=>{
          const wkHrs = sh.hrs * sh.days.length;
          return `<tr onclick="navigate('shift-detail',${sh.id})">
            <td style="font-weight:500">${sh.name}</td>
            <td style="color:#6b7280">${sh.frequency} · ${sh.hrs} hrs/shift</td>
            <td>${sh.operatives}</td>
            <td>${wkHrs}</td>
            <td>$${sh.payRate}/hr</td>
            <td><span class="badge badge-${sh.status}">${sh.status.charAt(0).toUpperCase()+sh.status.slice(1)}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderSiteNew() {
  return `
  <div class="breadcrumb">
    <a onclick="navigate('sites')">Sites</a><span class="sep">›</span><span>New</span>
  </div>
  <div class="form-page">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:20px">New site</h2>
    <div class="form-card">
      <div class="form-section-title">Site Details</div>
      <div class="form-row">
        <div class="form-group"><label>Site name</label><input placeholder="e.g. Melbourne Plant"></div>
        <div class="form-group"><label>Client</label><select>${db.clients.map(c=>`<option>${c.name}</option>`).join('')}</select></div>
      </div>
      <div class="form-row single"><div class="form-group"><label>Address</label><input placeholder="Street, suburb, state, postcode"></div></div>
      <div class="form-row">
        <div class="form-group"><label>Assigned supervisor</label><select>${db.employees.map(e=>`<option>${e.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Contract start date</label><input type="date"></div>
      </div>
    </div>
    <div class="form-card">
      <div class="form-section-title">Payment</div>
      <div class="form-row">
        <div class="form-group"><label>Payment type</label><select><option>Fixed per site</option><option>Hourly</option></select></div>
        <div class="form-group"><label>Monthly budget ($)</label><input type="number" placeholder="0.00"></div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="navigate('sites')">Cancel</button>
      <button class="btn btn-primary" onclick="showToast('Site saved!')">Create site</button>
    </div>
  </div>`;
}

// ── Shifts ───────────────────────────────────────────────────────────────────

function renderShifts() {
  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h3>All Shifts</h3>
        <div class="sub">${db.shifts.length} total · ${db.shifts.filter(s=>s.status==='active').length} active</div>
      </div>
      <div class="card-controls">
        <div class="search-box"><input id="shiftSearch" placeholder="Search shifts..." oninput="filterTable('shiftSearch','shiftTable')"></div>
        <select>
          <option>All sites</option>
          ${db.sites.map(s=>`<option>${s.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="navigate('shift-new',null)">+ Add shift</button>
      </div>
    </div>
    <table id="shiftTable">
      <thead><tr><th>Shift name</th><th>Site</th><th>Schedule</th><th>Operatives</th><th>Rate</th><th>Fixed/mo</th><th>Status</th></tr></thead>
      <tbody>
        ${db.shifts.map(sh=>{
          const site = db.sites.find(s=>s.id===sh.siteId);
          return `<tr onclick="navigate('shift-detail',${sh.id})">
            <td style="font-weight:500">${sh.name}</td>
            <td style="color:#6b7280">${site?.name||''}</td>
            <td>${sh.frequency} · ${sh.hrs}h</td>
            <td>${sh.operatives}</td>
            <td>$${sh.payRate}/hr</td>
            <td style="font-weight:600">$${sh.fixedMonth.toLocaleString()}</td>
            <td><span class="badge badge-${sh.status}">${sh.status.charAt(0).toUpperCase()+sh.status.slice(1)}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderShiftDetail(id) {
  const sh = db.shifts.find(x=>x.id===id);
  if (!sh) return '<p>Shift not found.</p>';
  const site = db.sites.find(s=>s.id===sh.siteId);
  const client = db.clients.find(c=>c.id===site?.clientId);
  const emps = db.employees.filter(e=>e.siteId===site?.id);
  const covers = db.replacements.filter(r=>r.shiftId===id);
  const ongoing = covers.filter(r=>r.status==='ongoing');
  const upcoming = covers.filter(r=>r.status==='upcoming');
  const past = covers.filter(r=>r.status==='past');

  return `
  <div class="breadcrumb">
    <a onclick="navigate('clients')">Clients</a><span class="sep">›</span>
    <a onclick="navigate('client-detail',${client?.id})">${client?.name}</a><span class="sep">›</span>
    <a onclick="navigate('site-detail',${site?.id})">${site?.name}</a><span class="sep">›</span>
    <span>${sh.name}</span>
  </div>
  <div class="detail-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div class="name">${sh.name}</div>
        <div class="meta">${site?.name} · ${sh.type}, ${sh.frequency}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary btn-sm">Edit shift</button>
        <span class="badge badge-${sh.status}">${sh.status.charAt(0).toUpperCase()+sh.status.slice(1)}</span>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><div class="label">Shift name</div><div class="value">${sh.name}</div></div>
      <div class="detail-field"><div class="label">Shift type</div><div class="value">${sh.type}</div></div>
      <div class="detail-field"><div class="label">Frequency</div><div class="value">${sh.frequency}</div></div>
      <div class="detail-field"><div class="label">Days of week</div><div class="value">
        <div class="day-selector" style="pointer-events:none">
          ${['M','T','W','T','F','S','S'].map((d,i)=>`<span class="day-btn ${sh.days.includes(i===3?'T2':d)?'active':''}" style="display:inline-flex;align-items:center;justify-content:center">${d}</span>`).join('')}
        </div>
      </div></div>
      <div class="detail-field"><div class="label">Start time</div><div class="value">${sh.start}</div></div>
      <div class="detail-field"><div class="label">End time</div><div class="value">${sh.end}</div></div>
      <div class="detail-field"><div class="label">Hrs / shift</div><div class="value">${sh.hrs}</div></div>
      <div class="detail-field"><div class="label">Payment</div><div class="value">$${sh.fixedMonth.toLocaleString()} / month · Fixed</div></div>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px">
    <div class="card-header">
      <h3>Regular Team <span style="font-weight:400;color:#6b7280;font-size:13px">${emps.length} assigned</span></h3>
      <button class="btn btn-primary btn-sm" onclick="showModal('assignEmployee')">+ Assign employee</button>
    </div>
    <table>
      <thead><tr><th>Employee</th><th>Position</th><th>Responsibilities</th><th>Pay rate</th><th>Status</th></tr></thead>
      <tbody>
        ${emps.map(e=>`<tr onclick="navigate('employee-detail',${e.id})">
          <td><div class="emp-row">${avatar(e.name)}<div><div class="emp-name">${e.name}${e.isLead?' <span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:1px 6px;border-radius:4px;font-weight:600">Lead</span>':''}</div><div style="font-size:11px;color:#9ca3af">Started ${e.started}</div></div></div></td>
          <td>${e.position}</td>
          <td style="color:#6b7280;font-size:12.5px">Spray prep, booth cleaning, PPE checks</td>
          <td>$${e.rate}/hr</td>
          <td><span class="badge badge-${e.status==='active'?'active':e.status==='leave'?'leave':'ended'}">${e.status==='active'?'Active':e.status==='leave'?'On leave':'Ended'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Covers</h3>
      <button class="btn btn-primary btn-sm" onclick="navigate('replacements')">+ New cover</button>
    </div>
    <div style="padding:0 20px">
      <div class="tabs" style="margin-bottom:0">
        <div class="tab active" id="tab-ongoing" onclick="switchCoverTab('ongoing')">Ongoing <span class="count">${ongoing.length}</span></div>
        <div class="tab" id="tab-upcoming" onclick="switchCoverTab('upcoming')">Upcoming <span class="count">${upcoming.length}</span></div>
        <div class="tab" id="tab-past" onclick="switchCoverTab('past')">Past <span class="count">${past.length}</span></div>
      </div>
    </div>
    <div id="covers-content">
      ${renderCoversTab(ongoing)}
    </div>
  </div>`;
}

function renderCoversTab(covers) {
  if (!covers.length) return `<div class="empty-state"><div class="icon">📋</div><p>No covers in this period.</p></div>`;
  return `<table>
    <thead><tr><th>Date / Range</th><th>Original</th><th>Cover</th><th>Reason</th><th>Action</th></tr></thead>
    <tbody>
      ${covers.map(r=>{
        const orig = db.employees.find(e=>e.id===r.original);
        const cov  = db.employees.find(e=>e.id===r.cover);
        return `<tr>
          <td><div style="font-weight:500">${r.startDate} – ${r.endDate}</div><div style="font-size:12px;color:#16a34a">${r.status==='ongoing'?'● Active':''}</div></td>
          <td><div class="emp-row">${avatar(orig.name)}<span>${orig.name}</span></div></td>
          <td><div class="emp-row">${avatar(cov.name)}<span>${cov.name}</span></div></td>
          <td><span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:10px;font-size:12px">${r.reason}</span></td>
          <td>${r.status==='ongoing'?'<button class="btn btn-sm btn-danger">End early</button>':''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ${covers[0]?.status==='ongoing'?`<div style="padding:10px 20px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6">Hours covered so far: <strong>${covers[0].hoursTotal} hrs</strong> · <strong>$${(covers[0].hoursTotal*covers[0].payRate).toFixed(2)}</strong> · Updates as timesheets approve</div>`:''}`;
}

function renderShiftNew(siteId) {
  const site = siteId ? db.sites.find(s=>s.id===siteId) : null;
  return `
  <div class="breadcrumb">
    <a onclick="navigate('shifts')">Shifts</a><span class="sep">›</span><span>New shift</span>
  </div>
  <div class="form-page" style="max-width:640px">
    <div style="font-size:13px;color:#6b7280;margin-bottom:4px">${site?.name||'Select a site'}</div>
    <h2 style="font-size:20px;font-weight:700;margin-bottom:20px">Add shift</h2>
    <div class="form-card">
      <div class="form-section-title">Shift Details</div>
      <div class="form-row single"><div class="form-group"><label>Shift name</label><input id="sn_name" placeholder="Paint booth — morning" oninput="updateShiftPreview()"></div></div>
      <div class="form-row single"><div class="form-group"><label>Description</label><textarea id="sn_desc" placeholder="Daily clean of paint booth: spray prep, booth wipe-down, PPE check, restock consumables."></textarea></div></div>
      <div class="form-group" style="margin-bottom:14px">
        <label>Shift type</label>
        <div class="toggle-group">
          <button class="toggle-btn active" onclick="setToggle(this,'shiftType')">Recurring</button>
          <button class="toggle-btn" onclick="setToggle(this,'shiftType')">One-off</button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label>Frequency</label>
        <div class="toggle-group">
          <button class="toggle-btn active" onclick="setToggle(this,'freq')">Weekly</button>
          <button class="toggle-btn" onclick="setToggle(this,'freq')">Monthly</button>
          <button class="toggle-btn" onclick="setToggle(this,'freq')">Quarterly</button>
          <button class="toggle-btn" onclick="setToggle(this,'freq')">Yearly</button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label>Days of week</label>
        <div class="day-selector">
          ${['M','T','W','T','F','S','S'].map((d,i)=>`<button class="day-btn${i<5?' active':''}" onclick="this.classList.toggle('active');updateShiftPreview()">${d}</button>`).join('')}
        </div>
      </div>
      <div class="form-row triple">
        <div class="form-group"><label>Start time</label><input id="sn_start" type="time" value="06:00" oninput="updateShiftPreview()"></div>
        <div class="form-group"><label>End time</label><input id="sn_end" type="time" value="12:00" oninput="updateShiftPreview()"></div>
        <div class="form-group"><label>Hrs / shift</label><input id="sn_hrs" type="number" value="6" oninput="updateShiftPreview()"></div>
      </div>
    </div>
    <div class="form-card">
      <div class="form-section-title">Payment</div>
      <div class="form-row">
        <div class="form-group"><label>Fixed per month ($)</label><input id="sn_fixed" type="number" placeholder="3480" oninput="updateShiftPreview()"></div>
        <div class="form-group"><label>Employee default pay rate ($/hr)</label><input id="sn_rate" type="number" placeholder="29.50" oninput="updateShiftPreview()"></div>
      </div>
      <div class="profit-preview" id="shiftPreview">
        Weekly: — · Cost: — · Revenue: —
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="navigate('shifts')">Cancel</button>
      <button class="btn btn-primary" onclick="showToast('Shift saved!')">Save shift</button>
    </div>
  </div>`;
}

// ── Employees ────────────────────────────────────────────────────────────────

function renderEmployees() {
  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h3>Employees</h3>
        <div class="sub">${db.employees.length} total · ${db.employees.filter(e=>e.status==='active').length} active · ${db.employees.filter(e=>e.status==='leave').length} on leave · ${db.employees.filter(e=>e.status==='ended').length} ended</div>
      </div>
      <div class="card-controls">
        <div class="search-box"><input id="empSearch" placeholder="Search by name, ABN, position..." oninput="filterTable('empSearch','empTable')"></div>
        <select>
          <option>All sites</option>
          ${db.sites.map(s=>`<option>${s.name}</option>`).join('')}
        </select>
        <select>
          <option>All status</option>
          <option>Active</option>
          <option>On leave</option>
          <option>Ended</option>
        </select>
        <button class="btn btn-primary" onclick="navigate('employee-new')">+ Add employee</button>
      </div>
    </div>
    <table id="empTable">
      <thead><tr><th>Employee</th><th>Position</th><th>Primary site</th><th>ABN</th><th>Contact</th><th>Status</th></tr></thead>
      <tbody>
        ${db.employees.map(e=>`
          <tr onclick="navigate('employee-detail',${e.id})">
            <td><div class="emp-row">${avatar(e.name)}<div><div class="emp-name">${e.name}${e.isLead?' <span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:1px 6px;border-radius:4px;font-weight:600">Lead</span>':''}</div><div class="emp-sub">${e.position}</div></div></div></td>
            <td>${e.position}</td>
            <td>${e.primarySite}</td>
            <td style="color:#6b7280;font-family:monospace">${e.abn}</td>
            <td>${e.phone}</td>
            <td><span class="badge badge-${e.status==='active'?'active':e.status==='leave'?'leave':'ended'}">${e.status==='active'?'Active':e.status==='leave'?'On leave':'Ended'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="padding:10px 20px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6">Showing ${db.employees.length} of ${db.employees.length}</div>
  </div>`;
}

function renderEmployeeDetail(id) {
  const e = db.employees.find(x=>x.id===id);
  if (!e) return '<p>Employee not found.</p>';
  const payslips = db.payslips.filter(p=>p.empId===id);

  return `
  <div class="breadcrumb">
    <a onclick="navigate('employees')">Employees</a><span class="sep">›</span><span>${e.name}</span>
  </div>
  <div class="detail-header">
    <div style="display:flex;align-items:center;gap:16px">
      ${avatar(e.name)}
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="name">${e.name}</div>
          <span class="badge badge-${e.status==='active'?'active':e.status==='leave'?'leave':'ended'}">${e.status==='active'?'Active':e.status==='leave'?'On leave':'Ended'}</span>
        </div>
        <div class="meta">${e.position} · ${e.primarySite} · Started ${e.started} · $${e.rate}/hr</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="navigate('employees')">Back</button>
        <button class="btn btn-secondary btn-sm">Edit</button>
      </div>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active">Earnings</div>
    <div class="tab">Shifts <span class="count">3</span></div>
    <div class="tab">Profile</div>
  </div>

  <div class="card" style="margin-bottom:20px">
    <div class="card-header">
      <div>
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">This Month</div>
        <div style="font-size:15px;font-weight:600">April 2026</div>
        <div style="font-size:12px;color:#6b7280">15 days into the month · 15 days remaining</div>
      </div>
      <span class="badge badge-pending">In progress</span>
    </div>
    <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;border-bottom:1px solid #f3f4f6">
      <div><div style="font-size:11px;color:#9ca3af;text-transform:uppercase">Hours so far</div><div style="font-size:24px;font-weight:700">82 <span style="font-size:14px;color:#9ca3af">hrs</span></div><div style="font-size:12px;color:#6b7280">of ~180 expected</div></div>
      <div><div style="font-size:11px;color:#9ca3af;text-transform:uppercase">Earnings so far</div><div style="font-size:24px;font-weight:700">$2,690</div><div style="font-size:12px;color:#6b7280">+ $323 super</div></div>
      <div><div style="font-size:11px;color:#9ca3af;text-transform:uppercase">Projected total</div><div style="font-size:24px;font-weight:700">$5,250</div><div style="font-size:12px;color:#6b7280">if rest of month is regular</div></div>
      <div><div style="font-size:11px;color:#9ca3af;text-transform:uppercase">Pay date</div><div style="font-size:24px;font-weight:700">5 May</div><div style="font-size:12px;color:#6b7280">next month</div></div>
    </div>
    <div style="padding:12px 20px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:600">Hours worked this month</div>
        <a style="font-size:12px;color:#3b82f6;cursor:pointer">Open timesheet ↗</a>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Site · Shift</th><th>Hrs</th><th>Rate</th><th>Earned</th></tr></thead>
        <tbody>
          <tr><td>Mon 1 Apr</td><td>Paccar — Melbourne / Paint booth morning · recurring</td><td>6</td><td>$32.80</td><td style="font-weight:600">$196.80</td></tr>
          <tr><td>Tue 2 Apr</td><td>Paccar — Melbourne / Paint booth morning · recurring</td><td>6</td><td>$32.80</td><td style="font-weight:600">$196.80</td></tr>
          <tr><td>Sat 5 Apr</td><td>Paccar — Melbourne / Paint spill cleanup · one-off</td><td>5</td><td>$32.80</td><td style="font-weight:600">$164.00</td></tr>
          <tr><td>Sat 12 Apr</td><td>Bunnings — Braeside / Amenities weekend · recurring</td><td>2</td><td>$35.20</td><td style="font-weight:600">$70.40</td></tr>
          <tr><td>Mon 14 Apr</td><td>Paccar — Melbourne / Parts area · covering Maria</td><td>4</td><td>$32.80</td><td style="font-weight:600">$131.20</td></tr>
        </tbody>
      </table>
      <div style="padding:10px 0;font-size:12px;color:#6b7280">+ 12 more rows · 1–14 Apr shown · <a style="color:#3b82f6;cursor:pointer">View all</a> &nbsp;&nbsp; Total this month so far: <strong>82 hrs · $2,690.00</strong> · Updates after each timesheet approval</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Past Invoices</h3>
      <a style="font-size:12px;color:#3b82f6;cursor:pointer">View all ↗</a>
    </div>
    <table>
      <thead><tr><th>Period</th><th>Hours</th><th>Gross</th><th>Super</th><th>Status</th></tr></thead>
      <tbody>
        ${payslips.map(p=>`<tr>
          <td><div style="font-weight:500">${p.period}</div><div style="font-size:12px;color:#6b7280">Paid ${p.paidDate}</div></td>
          <td>${p.hrs}</td>
          <td style="font-weight:600">$${p.gross.toFixed(2)}</td>
          <td>$${p.super.toFixed(2)}</td>
          <td><span class="badge badge-paid">Paid</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${payslips.length ? `<div style="padding:10px 20px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6">Last 4 months total: <strong>586 hrs · $19,220.80</strong> · avg $4,805 / month</div>` : ''}
  </div>`;
}

function renderEmployeeNew() {
  return `
  <div class="breadcrumb">
    <a onclick="navigate('employees')">Employees</a><span class="sep">›</span><span>New employee</span>
  </div>
  <div class="form-page">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:20px">Add employee</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:20px">Subcontractor profile, business details and onboarding documents.</p>
    <div class="form-card">
      <div class="form-section-title">Basics</div>
      <div style="margin-bottom:16px">
        <div style="width:60px;height:60px;border-radius:50%;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9ca3af;font-size:22px">+</div>
        <div style="font-size:12px;color:#3b82f6;margin-top:6px;cursor:pointer">Upload photo</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>First name</label><input placeholder="First name"></div>
        <div class="form-group"><label>Last name</label><input placeholder="Last name"></div>
      </div>
    </div>
    <div class="form-card">
      <div class="form-section-title">Business Details</div>
      <div class="form-group" style="margin-bottom:14px">
        <label>Entity type</label>
        <div class="toggle-group">
          <button class="toggle-btn active" onclick="setToggle(this,'entity')">Individual</button>
          <button class="toggle-btn" onclick="setToggle(this,'entity')">Partnership</button>
          <button class="toggle-btn" onclick="setToggle(this,'entity')">Company</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>ABN</label><input placeholder="12 345 678 901"></div>
        <div class="form-group"><label>Trading name <span style="color:#9ca3af">(optional)</span></label><input placeholder="Trading name"></div>
      </div>
    </div>
    <div class="form-card">
      <div class="form-section-title">Contact</div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input placeholder="04XX XXX XXX"></div>
        <div class="form-group"><label>Email</label><input placeholder="name@mail.com"></div>
      </div>
      <div class="form-row single"><div class="form-group"><label>Address <span style="color:#9ca3af">(optional)</span></label><input placeholder="Street, suburb, state, postcode"></div></div>
    </div>
    <div class="form-card">
      <div class="form-section-title">Documents</div>
      <div style="border:2px dashed #d1d5db;border-radius:8px;padding:24px;text-align:center;cursor:pointer;color:#9ca3af;margin-bottom:12px">
        <div style="font-size:28px;margin-bottom:8px">↑</div>
        <div style="font-size:13px"><span style="color:#3b82f6">Click to upload</span> or drag and drop</div>
        <div style="font-size:12px;margin-top:4px">PDF, JPG or PNG · up to 10MB each</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[['PDF','ABN registration.pdf','280 KB · uploaded 23 Apr 2026',''],
           ['JPG','Drivers licence.jpg','1.4 MB · uploaded 23 Apr 2026',''],
           ['PDF','Public liability insurance.pdf','540 KB · uploaded 23 Apr 2026 · <span style="color:#b45309">expires 30 Jun 2026</span>',''],
           ['DOC','Subcontractor agreement.docx','96 KB · uploaded 23 Apr 2026','']].map(([type,name,meta])=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #e5e7eb;border-radius:7px">
            <span style="background:#f3f4f6;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;color:#374151">${type}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${name}</div>
              <div style="font-size:12px;color:#6b7280">${meta}</div>
            </div>
            <button style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px">×</button>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="navigate('employees')">Cancel</button>
      <button class="btn btn-primary" onclick="showToast('Employee saved!')">Save employee</button>
    </div>
  </div>`;
}

// ── Replacements ─────────────────────────────────────────────────────────────

function renderReplacements() {
  return `
  <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
    <div></div>
    <button class="btn btn-primary" onclick="showModal('addReplacement')">+ New replacement</button>
  </div>

  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><h3>Ongoing Covers <span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:10px;font-size:12px;margin-left:8px">${db.replacements.filter(r=>r.status==='ongoing').length} active</span></h3></div>
    <table>
      <thead><tr><th>Date / Range</th><th>Original</th><th>Cover</th><th>Shift</th><th>Reason</th><th>Action</th></tr></thead>
      <tbody>
        ${db.replacements.filter(r=>r.status==='ongoing').map(r=>{
          const orig=db.employees.find(e=>e.id===r.original);
          const cov=db.employees.find(e=>e.id===r.cover);
          const shift=db.shifts.find(s=>s.id===r.shiftId);
          return `<tr>
            <td><div style="font-weight:500">${r.startDate}</div><div style="font-size:12px;color:#16a34a">● Active · day 2 of 5</div></td>
            <td><div class="emp-row">${avatar(orig.name)}<span>${orig.name}</span></div></td>
            <td><div class="emp-row">${avatar(cov.name)}<span>${cov.name}</span></div></td>
            <td style="color:#6b7280">${shift.name}</td>
            <td><span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:10px;font-size:12px">${r.reason}</span></td>
            <td><button class="btn btn-sm btn-danger">End early</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><h3>Upcoming Covers</h3></div>
    <table>
      <thead><tr><th>Date / Range</th><th>Original</th><th>Cover</th><th>Shift</th><th>Reason</th><th></th></tr></thead>
      <tbody>
        ${db.replacements.filter(r=>r.status==='upcoming').map(r=>{
          const orig=db.employees.find(e=>e.id===r.original);
          const cov=db.employees.find(e=>e.id===r.cover);
          const shift=db.shifts.find(s=>s.id===r.shiftId);
          return `<tr>
            <td style="font-weight:500">${r.startDate}</td>
            <td><div class="emp-row">${avatar(orig.name)}<span>${orig.name}</span></div></td>
            <td><div class="emp-row">${avatar(cov.name)}<span>${cov.name}</span></div></td>
            <td style="color:#6b7280">${shift.name}</td>
            <td><span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:12px">${r.reason}</span></td>
            <td><button class="btn btn-sm btn-secondary">Cancel</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-header"><h3>Past Covers</h3></div>
    <table>
      <thead><tr><th>Date / Range</th><th>Original</th><th>Cover</th><th>Shift</th><th>Reason</th><th>Hours</th></tr></thead>
      <tbody>
        ${db.replacements.filter(r=>r.status==='past').map(r=>{
          const orig=db.employees.find(e=>e.id===r.original);
          const cov=db.employees.find(e=>e.id===r.cover);
          const shift=db.shifts.find(s=>s.id===r.shiftId);
          return `<tr>
            <td style="color:#6b7280">${r.startDate} – ${r.endDate}</td>
            <td><div class="emp-row">${avatar(orig.name)}<span>${orig.name}</span></div></td>
            <td><div class="emp-row">${avatar(cov.name)}<span>${cov.name}</span></div></td>
            <td style="color:#6b7280">${shift.name}</td>
            <td><span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">${r.reason}</span></td>
            <td>${r.hoursTotal} hrs</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Payroll ───────────────────────────────────────────────────────────────────

function renderPayroll() {
  return `
  <div class="tabs">
    <div class="tab active">Invoices</div>
    <div class="tab">Payslips</div>
    <div class="tab">Timesheets</div>
  </div>

  <div style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap">
    <div class="stat-card" style="flex:1;min-width:160px">
      <div class="label">Total Invoiced (May)</div>
      <div class="value">$${db.invoices.filter(i=>i.period==='May 2026').reduce((s,i)=>s+i.amount,0).toLocaleString()}</div>
    </div>
    <div class="stat-card" style="flex:1;min-width:160px">
      <div class="label">Pending Payment</div>
      <div class="value" style="color:#b45309">$${db.invoices.filter(i=>i.status==='pending').reduce((s,i)=>s+i.amount,0).toLocaleString()}</div>
    </div>
    <div class="stat-card" style="flex:1;min-width:160px">
      <div class="label">Collected (May)</div>
      <div class="value" style="color:#16a34a">$${db.invoices.filter(i=>i.status==='paid'&&i.period==='May 2026').reduce((s,i)=>s+i.amount,0).toLocaleString()}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Invoices</h3>
      <div class="card-controls">
        <select><option>May 2026</option><option>Apr 2026</option><option>Mar 2026</option></select>
        <button class="btn btn-primary btn-sm">+ Generate invoices</button>
      </div>
    </div>
    <table>
      <thead><tr><th>Client</th><th>Period</th><th>Amount</th><th>Due date</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${db.invoices.map(inv=>{
          const client=db.clients.find(c=>c.id===inv.clientId);
          return `<tr>
            <td style="font-weight:500">${client.name}</td>
            <td>${inv.period}</td>
            <td style="font-weight:600">$${inv.amount.toLocaleString()}</td>
            <td style="color:#6b7280">${inv.due}</td>
            <td><span class="badge badge-${inv.status}">${inv.status.charAt(0).toUpperCase()+inv.status.slice(1)}</span></td>
            <td><button class="btn btn-sm btn-secondary">View PDF</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="card" style="margin-top:20px">
    <div class="card-header">
      <h3>Payslips</h3>
      <div class="card-controls">
        <select><option>April 2026</option><option>March 2026</option></select>
        <button class="btn btn-primary btn-sm">Generate payslips</button>
      </div>
    </div>
    <table>
      <thead><tr><th>Employee</th><th>Period</th><th>Hours</th><th>Gross</th><th>Super</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${db.payslips.map(p=>{
          const emp=db.employees.find(e=>e.id===p.empId);
          return `<tr>
            <td><div class="emp-row">${avatar(emp.name)}<span class="emp-name">${emp.name}</span></div></td>
            <td>${p.period}</td>
            <td>${p.hrs}</td>
            <td style="font-weight:600">$${p.gross.toFixed(2)}</td>
            <td>$${p.super.toFixed(2)}</td>
            <td><span class="badge badge-paid">Paid</span></td>
            <td><button class="btn btn-sm btn-secondary">PDF</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Modals ────────────────────────────────────────────────────────────────────

function showModal(type) {
  let content = '';
  if (type === 'assignEmployee') {
    content = `
      <div class="modal-header">
        <h3>Assign employee</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="form-section-title" style="margin-bottom:14px">Assignment</div>
      <div class="form-group" style="margin-bottom:14px"><label>Employee</label>
        <select>${db.employees.map(e=>`<option>${e.name} — ${e.position}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="margin-bottom:14px"><label>Position</label><input placeholder="Paint booth operative"></div>
      <div class="form-group" style="margin-bottom:14px"><label>Responsibilities</label><input placeholder="Spray prep, booth cleaning, PPE checks"></div>
      <div class="form-group" style="margin-bottom:14px"><label>Pay rate ($/hr)</label><input type="number" placeholder="29.50"></div>
      <div style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:#f9fafb;border-radius:7px;margin-bottom:16px">
        <input type="checkbox" id="isSup" style="margin-top:2px">
        <label for="isSup" style="font-size:13px"><strong>Is supervisor</strong> — Can approve timesheets and manage other employees on this shift.</label>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="closeModal();showToast('Employee assigned!')">Assign</button>
      </div>`;
  } else if (type === 'addReplacement') {
    content = `
      <div class="modal-header">
        <h3>Add replacement</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Cover an employee while they are on leave or unavailable.</p>
      <div class="form-group" style="margin-bottom:14px"><label>Employee on leave</label>
        <select>${db.employees.map(e=>`<option>${e.name} — ${e.position}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="margin-bottom:14px"><label>Replacement employee</label>
        <select>${db.employees.map(e=>`<option>${e.name} — ${e.position}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="margin-bottom:14px"><label>Replacement scope</label>
        <div class="toggle-group">
          <button class="toggle-btn" onclick="setToggle(this,'scope')">Single day</button>
          <button class="toggle-btn active" onclick="setToggle(this,'scope')">Date range</button>
          <button class="toggle-btn" onclick="setToggle(this,'scope')">Specific days</button>
        </div>
      </div>
      <div class="form-row" style="margin-bottom:14px">
        <div class="form-group"><label>Start date</label><input type="date"></div>
        <div class="form-group"><label>End date</label><input type="date"></div>
      </div>
      <div class="form-group" style="margin-bottom:14px"><label>Pay rate ($/hr)</label><input type="number" placeholder="29.50"></div>
      <div class="form-group" style="margin-bottom:16px"><label>Notes (optional)</label><textarea placeholder="Any handover details for the replacement" style="min-height:60px"></textarea></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="closeModal();showToast('Replacement saved!')">Save replacement</button>
      </div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${content}</div>`;
  overlay.addEventListener('click', e => { if (e.target===overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function filterTable(inputId, tableId) {
  const q = document.getElementById(inputId).value.toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row=>{
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function filterByStatus(select, tableId) {
  const val = select.value;
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row=>{
    row.style.display = (!val || row.dataset.status===val) ? '' : 'none';
  });
}

function setToggle(btn, group) {
  btn.closest('.toggle-group').querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (group === 'shiftType' || group === 'freq') updateShiftPreview();
}

function switchCoverTab(tab) {
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  const covers = db.replacements.filter(r=>r.status===tab);
  const content = document.getElementById('covers-content');
  if (content) content.innerHTML = renderCoversTab(covers);
}

function updateShiftPreview() {
  const hrs = parseFloat(document.getElementById('sn_hrs')?.value)||0;
  const rate = parseFloat(document.getElementById('sn_rate')?.value)||0;
  const fixed = parseFloat(document.getElementById('sn_fixed')?.value)||0;
  const activeDays = document.querySelectorAll('.day-btn.active').length||5;
  const wkHrs = hrs * activeDays;
  const wkCost = wkHrs * rate;
  const wkRev = fixed / 4.33;
  const preview = document.getElementById('shiftPreview');
  if (preview) {
    preview.textContent = `Weekly: ${wkHrs} hrs · $${wkCost.toFixed(0)} cost · $${wkRev.toFixed(0)} revenue`;
  }
}

function saveNewClient() {
  showToast('Client created!');
  navigate('clients');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1e40af;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.2);animation:fadeIn 0.2s';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2500);
}

function bindEvents() {
  // Events are bound inline via onclick attributes
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', ()=>{
  render();

  document.querySelectorAll('nav a').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      navigate(a.dataset.view);
    });
  });
});
