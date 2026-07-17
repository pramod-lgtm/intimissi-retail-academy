// ============================================================
//  INTIMISSI RETAIL ACADEMY — APPLICATION ENGINE
// ============================================================

const APP = {
  state: {
    user: null,
    currentPage: null,
    currentBrand: null,
    currentCategory: null,
    currentModule: null,
    videoWatchPct: 0,
    quizSession: null,
    salesData: null
  },

  // ── STORAGE HELPERS ──────────────────────────────────────
  storage: {
    get: (k, def = null) => { try { const v = localStorage.getItem('ira_' + k); return v ? JSON.parse(v) : def; } catch { return def; } },
    set: (k, v) => { try { localStorage.setItem('ira_' + k, JSON.stringify(v)); } catch {} },
    del: (k) => localStorage.removeItem('ira_' + k)
  },

  // ── INIT ─────────────────────────────────────────────────
  init() {
    this.ensureDefaultData();
    this.bindGlobalEvents();
    // Wait for cloud config (PINs) before showing login
    this.loadConfig(function() {
      const saved = APP.storage.get('session');
      if (saved && saved.userId) {
        const users = APP.storage.get('users', []);
        const user = users.find(function(u) { return u.id === saved.userId; });
        if (user) { APP.loginUser(user); return; }
      }
      APP.showLogin();
    });
  },

  ensureDefaultData() {
    // Always sync real salesperson users from SALES_DATA
    if (typeof SALES_DATA !== 'undefined') {
      this.syncSalesPersonUsers();
    } else if (!this.storage.get('users')) {
      this.storage.set('users', JSON.parse(JSON.stringify(IRA_DATA.defaultUsers)));
    }
    if (!this.storage.get('progress')) this.storage.set('progress', {});
    if (!this.storage.get('xp_log')) this.storage.set('xp_log', []);
    if (!this.storage.get('video_urls')) this.storage.set('video_urls', {});
  },

  loadConfig(callback) {
    fetch('/api/config')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(cfg) {
        if (!cfg) return;
        // Merge cloud video_urls into localStorage (cloud wins)
        if (cfg.video_urls && Object.keys(cfg.video_urls).length) {
          var local = APP.storage.get('video_urls', {});
          var changed = false;
          Object.keys(cfg.video_urls).forEach(function(k) {
            if (cfg.video_urls[k] && local[k] !== cfg.video_urls[k]) {
              local[k] = cfg.video_urls[k];
              changed = true;
            }
          });
          if (changed) {
            APP.storage.set('video_urls', local);
            // Re-render video containers that are currently on screen
            Object.keys(cfg.video_urls).forEach(function(moduleId) {
              var container = document.getElementById('vid-container-' + moduleId);
              var input = document.getElementById('vid-url-' + moduleId);
              if (container) {
                var url = cfg.video_urls[moduleId];
                if (input) input.value = url || '';
                var brand = IRA_DATA.brands.find(function(b) { return b.id === moduleId; });
                var cat = IRA_DATA.categories.find(function(c) { return c.id === moduleId; });
                var localFile = (brand && brand.videoFile) || (cat && cat.videoFile) || '';
                container.innerHTML = APP.buildVideoEmbed(url, localFile, moduleId);
              }
            });
          }
        }
        // Apply PIN overrides (cloud wins over default 1234)
        if (cfg.pin_overrides && Object.keys(cfg.pin_overrides).length) {
          var users = APP.storage.get('users', []);
          var pinChanged = false;
          users.forEach(function(u) {
            if (cfg.pin_overrides[u.id]) { u.pin = cfg.pin_overrides[u.id]; pinChanged = true; }
          });
          if (pinChanged) APP.storage.set('users', users);
        }
        // Pull month target sheets, JC cycle data and executive performance
        // uploaded from other devices — all months, cloud wins.
        if (cfg.jc_targets) {
          Object.keys(cfg.jc_targets).forEach(function(m) {
            localStorage.setItem('jc_targets_' + m, JSON.stringify(cfg.jc_targets[m]));
          });
        }
        if (cfg.jc_data) {
          Object.keys(cfg.jc_data).forEach(function(m) {
            var jc = cfg.jc_data[m];
            if (jc.daily)  localStorage.setItem('jc_daily_' + m, JSON.stringify(jc.daily));
            if (jc.cycles) localStorage.setItem('jc_cycles_' + m, JSON.stringify(jc.cycles));
            if (jc.updatedAt) localStorage.setItem('jc_updated_' + m, jc.updatedAt);
          });
        }
        if (cfg.exec_perf) {
          Object.keys(cfg.exec_perf).forEach(function(m) {
            localStorage.setItem('exec_perf_' + m, JSON.stringify(cfg.exec_perf[m]));
          });
        }
      })
      .catch(function() {})
      .finally(function() {
        // Order matters: pick the active month first, then apply that month's
        // executive data, then rebuild users and roster statuses.
        APP.applyMonthlyTargets();
        APP.applyExecPerf();
        APP.syncSalesPersonUsers();
        APP.markRosterStatus();
        if (callback) callback();
      }); // always proceed even if offline
  },

  // Switch JC_DATA to the uploaded target sheet for the current calendar
  // month; if none, fall back to the most recent uploaded month, else the
  // built-in seed month stays active.
  applyMonthlyTargets() {
    if (typeof JC_DATA === 'undefined') return;
    const now = new Date().toISOString().slice(0, 7);
    const months = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('jc_targets_')) months.push(k.slice(11));
    }
    if (!months.length) return;
    let pick = null;
    if (months.includes(now)) pick = now;
    else {
      const past = months.filter(m => m < now).sort();
      if (past.length && JC_DATA.seedMonth < past[past.length - 1]) pick = past[past.length - 1];
    }
    if (!pick) return;
    try {
      JC_DATA.applyTargets(JSON.parse(localStorage.getItem('jc_targets_' + pick)));
    } catch(e) {}
  },

  // ── EXECUTIVE PERFORMANCE (uploaded month data) ──────────
  getExecPerf() {
    if (typeof JC_DATA === 'undefined') return null;
    try {
      const blob = JSON.parse(localStorage.getItem('exec_perf_' + JC_DATA.monthCode));
      if (blob && blob.persons && Object.keys(blob.persons).length) return blob;
    } catch(e) {}
    return null;
  },

  // Merge the uploaded month into SALES_DATA so every page (leaderboard,
  // dashboard, live scoreboard, PI) reflects current performance.
  // New executives in the file become new SALES_DATA salespersons.
  applyExecPerf() {
    if (typeof SALES_DATA === 'undefined') return;
    const blob = this.getExecPerf();
    if (!blob) return;
    const month = JC_DATA.monthCode;
    const persons = blob.persons;

    Object.keys(persons).forEach(slug => {
      const p = persons[slug];
      let sp = SALES_DATA.salespersons.find(s =>
        s.username === slug || s.name.toLowerCase() === (p.name || '').toLowerCase());
      if (!sp) {
        sp = { id: 'sp_' + slug.replace(/[^a-z0-9]+/g, '_'), name: p.name, username: slug,
               store: p.store || '', bills: 0, qty: 0, atv: 0, upt: 0, custCount: 0,
               workDays: 0, salesPerDay: 0, rankSales: 999, rankATV: 999, rankUPT: 999,
               rankCust: 999, rankBills: 999, rankDaily: 999, salesPctile: 0, atvPctile: 0,
               uptPctile: 0, custPctile: 0, monthly: [], fromUpload: true };
        SALES_DATA.salespersons.push(sp);
      }
      if (p.store) sp.store = p.store; // reflects transfers
      const entry = { month, sales: p.sales || 0, bills: p.bills || 0, qty: p.qty || 0, cust: p.bills || 0 };
      const mIdx = sp.monthly.findIndex(m => m.month === month);
      if (mIdx >= 0) sp.monthly[mIdx] = entry; else sp.monthly.push(entry);
      sp._mtd = p.sales || 0;
      if (p.bills > 0) {
        sp.atv = p.sales / p.bills;
        if (p.qty > 0) sp.upt = p.qty / p.bills;
        if (sp.fromUpload) sp.bills = p.bills;
      }
    });

    // Re-rank everyone present in the file by this month's numbers
    const inFile = SALES_DATA.salespersons.filter(s =>
      persons[s.username] || Object.values(persons).some(p => (p.name || '').toLowerCase() === s.name.toLowerCase()));
    const pct = (i, n) => n > 1 ? Math.round((n - 1 - i) / (n - 1) * 100) : 100;
    [...inFile].sort((a, b) => (b._mtd || 0) - (a._mtd || 0))
      .forEach((s, i) => { s.rankSales = i + 1; s.salesPctile = pct(i, inFile.length); });
    const withATV = inFile.filter(s => s.atv > 0);
    [...withATV].sort((a, b) => b.atv - a.atv)
      .forEach((s, i) => { s.rankATV = i + 1; s.atvPctile = pct(i, withATV.length); });
    const withUPT = inFile.filter(s => s.upt > 0);
    [...withUPT].sort((a, b) => b.upt - a.upt)
      .forEach((s, i) => { s.rankUPT = i + 1; s.uptPctile = pct(i, withUPT.length); });
  },

  // Anyone missing from the latest uploaded month file is marked Absent/Left.
  // Without an upload there is no roster info, so everyone stays active.
  markRosterStatus() {
    const blob = this.getExecPerf();
    if (!blob) return;
    const inFile = new Set();
    Object.keys(blob.persons).forEach(slug => {
      inFile.add(slug);
      inFile.add((blob.persons[slug].name || '').toLowerCase());
    });
    const users = this.storage.get('users', []);
    let changed = false;
    users.forEach(u => {
      if (!['Retail Stylist', 'Senior Stylist'].includes(u.role)) return;
      const active = inFile.has((u.username || '').toLowerCase()) || inFile.has((u.name || '').toLowerCase());
      const st = active ? 'active' : 'left';
      if (u.status !== st) { u.status = st; changed = true; }
    });
    if (changed) this.storage.set('users', users);
  },

  // Users still on the roster (management is always active)
  activeUsers() {
    return this.storage.get('users', []).filter(u => u.status !== 'left');
  },

  syncConfig(patch) {
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch(function() {});
  },

  // Sync real salespersons from SALES_DATA into the user store
  syncSalesPersonUsers() {
    const existing = this.storage.get('users', []);
    const existingMap = {};
    existing.forEach(u => { existingMap[u.id] = u; });

    // Always include admin/management accounts
    const mgmtUsers = IRA_DATA.defaultUsers.filter(u =>
      ['Super Admin','HR','Operations Head','Area Manager'].includes(u.role)
    );

    // Build users from real salesperson data (fromUpload = new joiner via admin file)
    const spUsers = SALES_DATA.salespersons
      .filter(sp => sp.name && sp.name !== '[NONE]' && (sp.bills >= 5 || sp.fromUpload))
      .map(sp => {
        const prev = existingMap[sp.id] || {};
        return {
          id:       sp.id,
          name:     sp.name,
          username: sp.username,
          role:     prev.role || 'Retail Stylist',
          storeId:  sp.store,
          pin:      prev.pin || '1234',   // default PIN, admin can reset
          xp:       prev.xp  || 0,
          level:    prev.level || 1,
          joinDate: prev.joinDate || (sp.fromUpload ? new Date().toISOString().slice(0,10) : '2023-04-01'),
          status:   prev.status || 'active',
          salesId:  sp.id   // link to SALES_DATA record
        };
      });

    // Add store managers for each store from management pool
    const storeManagers = IRA_DATA.defaultUsers.filter(u =>
      u.role === 'Store Manager'
    );

    // Preserve overridden PINs / XP on management accounts across rebuilds
    const merged = mgmtUsers.map(m => existingMap[m.id] ? { ...m, ...existingMap[m.id] } : m);
    storeManagers.forEach(m => {
      if (!existingMap[m.id]) merged.push(m);
      else merged.push({ ...m, ...existingMap[m.id] });
    });
    spUsers.forEach(u => {
      // preserve existing XP/progress
      if (existingMap[u.id]) {
        merged.push({ ...u, xp: existingMap[u.id].xp || 0, pin: existingMap[u.id].pin || u.pin });
      } else {
        merged.push(u);
      }
    });
    // Keep users added manually via the Add User form (not backed by sales data)
    const includedIds = new Set(merged.map(m => m.id));
    existing.forEach(u => { if (!includedIds.has(u.id) && !u.salesId) merged.push(u); });

    this.storage.set('users', merged);
  },

  // Get real SALES_DATA record for a user
  getSalesRecord(user) {
    if (typeof SALES_DATA === 'undefined') return null;
    const id = user.salesId || user.id;
    return SALES_DATA.salespersons.find(sp => sp.id === id) || null;
  },

  // Get real store record
  getStoreRecord(storeName) {
    if (typeof SALES_DATA === 'undefined') return null;
    return SALES_DATA.stores.find(s => s.name === storeName) || null;
  },

  // ── AUTH ─────────────────────────────────────────────────
  showLogin() {
    document.getElementById('screen-login').classList.add('active');
    document.getElementById('app-shell').classList.remove('active');
    this.renderLoginForm();
  },

  renderLoginForm() {
    const el = document.getElementById('login-form-area');
    const users = this.activeUsers(); // people marked Absent/Left cannot log in

    // Group by store for stylists, separate management
    const mgmt = users.filter(u => !['Retail Stylist','Senior Stylist'].includes(u.role));
    const stylists = users.filter(u => ['Retail Stylist','Senior Stylist'].includes(u.role));

    // Group stylists by store
    const byStore = {};
    stylists.forEach(u => {
      const store = u.storeId || 'Unknown Store';
      if (!byStore[store]) byStore[store] = [];
      byStore[store].push(u);
    });
    const storeNames = Object.keys(byStore).sort();

    el.innerHTML = `
      <div class="field-group">
        <label>Select Store / Role</label>
        <select id="login-store">
          <option value="">-- Select Store or Role --</option>
          <optgroup label="Management">
            ${mgmt.length > 0 ? '<option value="__mgmt__">Management / Admin</option>' : ''}
          </optgroup>
          <optgroup label="Stores">
            ${storeNames.map(s => `<option value="store:${s}">${s} (${byStore[s].length} staff)</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div class="field-group" id="login-user-wrap" style="display:none">
        <label>Select Name</label>
        <select id="login-user"><option value="">-- Select --</option></select>
      </div>
      <div class="field-group" id="login-pin-wrap" style="display:none">
        <label>PIN (4 digits)</label>
        <input type="password" id="login-pin" maxlength="4" placeholder="••••" inputmode="numeric">
      </div>
      <div id="login-error" class="text-sm" style="color:var(--red);margin-bottom:0.75rem;display:none"></div>
      <button class="btn btn-gold btn-full btn-lg" onclick="APP.attemptLogin()">Enter Academy</button>
    `;

    document.getElementById('login-store').addEventListener('change', e => {
      const val = e.target.value;
      const userWrap = document.getElementById('login-user-wrap');
      const pinWrap  = document.getElementById('login-pin-wrap');
      if (!val) { userWrap.style.display = 'none'; pinWrap.style.display = 'none'; return; }
      const sel = document.getElementById('login-user');
      let pool = [];
      if (val === '__mgmt__') pool = mgmt;
      else if (val.startsWith('store:')) pool = byStore[val.slice(6)] || [];
      sel.innerHTML = '<option value="">-- Select Name --</option>' +
        pool.map(u => `<option value="${u.id}">${u.name}${val==='__mgmt__' ? ' — ' + u.role : ''}</option>`).join('');
      userWrap.style.display = 'block';
      sel.addEventListener('change', () => {
        pinWrap.style.display = sel.value ? 'block' : 'none';
        document.getElementById('login-pin').value = '';
      });
    });
  },

  attemptLogin() {
    const userId = document.getElementById('login-user')?.value;
    const pin = document.getElementById('login-pin')?.value;
    const err = document.getElementById('login-error');
    if (!userId || !pin) { err.textContent = 'Please select your name and enter your PIN.'; err.style.display = 'block'; return; }
    const users = this.storage.get('users', []);
    const user = users.find(u => u.id === userId);
    if (!user || user.pin !== pin) { err.textContent = 'Invalid PIN. Please try again.'; err.style.display = 'block'; return; }
    err.style.display = 'none';
    this.storage.set('session', { userId: user.id });
    this.addXP(user.id, 10, 'Daily Login');
    this.loginUser(user);
  },

  loginUser(user) {
    this.state.user = user;
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('app-shell').classList.add('active');
    this.buildShell();
    this.navigate('dashboard');
    this.toast(`Welcome back, ${user.name.split(' ')[0]}! 🎓`, 'success');
    // Check for newly earned badges after login XP is applied
    setTimeout(() => this.checkAndAwardBadges(this.getUser()), 1500);
  },

  logout() {
    this.storage.del('session');
    this.state.user = null;
    document.getElementById('app-shell').classList.remove('active');
    this.showLogin();
  },

  // ── SHELL ────────────────────────────────────────────────
  buildShell() {
    const u = this.state.user;
    const store = u.storeId ? IRA_DATA.stores.find(s => s.id === u.storeId) : null;
    const users = this.storage.get('users', []);
    const freshUser = users.find(x => x.id === u.id) || u;
    const lp = IRA_DATA.getXPProgress(freshUser.xp || 0);
    const lvl = lp.current;

    document.getElementById('sidebar-user-name').textContent = u.name;
    document.getElementById('sidebar-user-role').textContent = u.role;
    document.getElementById('sidebar-user-store').textContent = store ? store.name : (u.storeId || 'All Stores');
    document.getElementById('sidebar-avatar').textContent = u.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('sidebar-xp-fill').style.width = lp.pct + '%';
    document.getElementById('sidebar-xp-label').textContent = lvl.badge + ' ' + lvl.name;
    document.getElementById('sidebar-xp-val').textContent = (freshUser.xp || 0) + ' XP';

    // Build navigation based on role
    this.buildNav();
  },

  buildNav() {
    const u = this.state.user;
    const role = u.role;
    const isAdmin = ['Super Admin', 'HR', 'Operations Head'].includes(role);
    const isManager = ['Area Manager', 'Store Manager'].includes(role);
    const isStylist = ['Senior Stylist', 'Retail Stylist'].includes(role);
    // Key persons own a store's JC target this month — give them direct access
    const isJCKeyPerson = !isAdmin && !isManager &&
      typeof JC_DATA !== 'undefined' && JC_DATA.getStoresForUser(u).length > 0;

    const learningNav = `
      <div class="nav-section">
        <div class="nav-section-title">Performance</div>
        <div class="nav-item" onclick="APP.navigate('dashboard')"><span class="icon">🏠</span><span>My Dashboard</span></div>
        <div class="nav-item" onclick="APP.navigate('missions')"><span class="icon">📋</span><span>Daily Missions</span></div>
        ${isJCKeyPerson ? `<div class="nav-item" onclick="APP.navigate('jc-performance')"><span class="icon">🎯</span><span>My JC Target</span></div>` : ''}
        <div class="nav-item" onclick="APP.navigate('report-card')"><span class="icon">📊</span><span>Report Card</span></div>
        <div class="nav-item" onclick="APP.navigate('social-wall')"><span class="icon">👏</span><span>Recognition Wall</span></div>
        <div class="nav-item" onclick="APP.navigate('live-store')"><span class="icon">⚡</span><span>Live Scoreboard</span></div>
      </div>
      <div class="nav-section">
        <div class="nav-section-title">Learning</div>
        <div class="nav-item" onclick="APP.navigate('brand-academy')"><span class="icon">🏷️</span><span>Brand Academy</span></div>
        <div class="nav-item" onclick="APP.navigate('category-academy')"><span class="icon">📂</span><span>Category Academy</span></div>
        <div class="nav-item" onclick="APP.navigate('selling-skills')"><span class="icon">📈</span><span>Selling Skills</span></div>
        <div class="nav-item" onclick="APP.navigate('ai-coach')"><span class="icon">🤖</span><span>AI Coach</span></div>
        <div class="nav-item" onclick="APP.navigate('leaderboard')"><span class="icon">🏆</span><span>Leaderboard</span></div>
        <div class="nav-item" onclick="APP.navigate('my-certs')"><span class="icon">🎓</span><span>My Certificates</span></div>
      </div>`;

    const managerNav = isManager || isAdmin ? `
      <div class="nav-section">
        <div class="nav-section-title">Management</div>
        <div class="nav-item" onclick="APP.navigate('jc-performance')"><span class="icon">🎯</span><span>JC Cycle Tracker</span></div>
        <div class="nav-item" onclick="APP.navigate('manager-dashboard')"><span class="icon">📊</span><span>Team Dashboard</span></div>
        <div class="nav-item" onclick="APP.navigate('store-analytics')"><span class="icon">🏪</span><span>Store Analytics</span></div>
      </div>` : '';

    const adminNav = isAdmin ? `
      <div class="nav-section">
        <div class="nav-section-title">Administration</div>
        <div class="nav-item" onclick="APP.navigate('admin')"><span class="icon">⚙️</span><span>Admin Panel</span></div>
        <div class="nav-item" onclick="APP.navigate('manage-users')"><span class="icon">👥</span><span>Manage Users</span></div>
        <div class="nav-item" onclick="APP.navigate('data-upload')"><span class="icon">📤</span><span>Upload Sales Data</span></div>
        <div class="nav-item" onclick="APP.navigate('reports')"><span class="icon">📋</span><span>Reports</span></div>
      </div>` : '';

    const bottomNav = `
      <div class="nav-section">
        <div class="nav-item" onclick="APP.navigate('profile')"><span class="icon">👤</span><span>My Profile</span></div>
        <div class="nav-item" onclick="APP.logout()"><span class="icon">🚪</span><span>Logout</span></div>
      </div>`;

    const fullNav = learningNav + managerNav + adminNav + bottomNav;
    document.getElementById('sidebar-nav').innerHTML = fullNav;

    // Mobile: drawer mirrors the full nav; bottom tab bar carries the core pages
    const drawerNav = document.getElementById('mobile-drawer-nav');
    if (drawerNav) drawerNav.innerHTML = fullNav;
    const hasJC = isAdmin || isManager || isJCKeyPerson;
    const tabs = [
      { page: 'dashboard',   icon: '🏠', label: 'Home' },
      { page: 'missions',    icon: '📋', label: 'Missions' },
      hasJC ? { page: 'jc-performance', icon: '🎯', label: 'JC Cycle' }
            : { page: 'leaderboard',    icon: '🏆', label: 'Ranks' },
      { page: 'live-store',  icon: '⚡', label: 'Live' }
    ];
    const bn = document.getElementById('bottom-nav');
    if (bn) bn.innerHTML = tabs.map(t =>
      `<button class="bn-item" data-page="${t.page}" onclick="APP.navigate('${t.page}')"><span class="bn-icon">${t.icon}</span><span>${t.label}</span></button>`
    ).join('') + `<button class="bn-item" onclick="APP.openDrawer()"><span class="bn-icon">☰</span><span>More</span></button>`;
  },

  openDrawer()  { document.getElementById('mobile-drawer')?.classList.add('open'); },
  closeDrawer() { document.getElementById('mobile-drawer')?.classList.remove('open'); },

  // ── NAVIGATION ───────────────────────────────────────────
  navigate(page, params = {}) {
    this.state.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('onclick')?.includes(`'${page}'`)) el.classList.add('active');
    });
    document.querySelectorAll('#bottom-nav .bn-item').forEach(b =>
      b.classList.toggle('active', b.dataset.page === page));
    this.closeDrawer();

    const content = document.getElementById('page-content');
    const topTitle = document.getElementById('top-bar-title');
    content.innerHTML = '<div class="spinner" style="margin:4rem auto"></div>';

    setTimeout(() => {
      try {
        switch (page) {
          case 'dashboard':       topTitle.textContent = '🏠 My Dashboard';          this.renderDashboard(content); break;
          case 'brand-academy':   topTitle.textContent = '🏷️ Brand Academy';         this.renderBrandAcademy(content); break;
          case 'brand-module':    topTitle.textContent = '📖 Brand Training';        this.renderBrandModule(content, params.brandId); break;
          case 'category-academy':topTitle.textContent = '📂 Category Academy';      this.renderCategoryAcademy(content); break;
          case 'category-module': topTitle.textContent = '📖 Category Training';     this.renderCategoryModule(content, params.catId); break;
          case 'selling-skills':  topTitle.textContent = '📈 Selling Skills';        this.renderSellingSkills(content); break;
          case 'skill-module':    topTitle.textContent = '📖 Skill Training';        this.renderSkillModule(content, params.moduleId); break;
          case 'video-player':    topTitle.textContent = '▶️ Video Lesson';          this.renderVideoPlayer(content, params); break;
          case 'quiz':            topTitle.textContent = '📝 Assessment';            this.renderQuiz(content, params); break;
          case 'results':         topTitle.textContent = '📊 Results';               this.renderResults(content, params); break;
          case 'certificate':     topTitle.textContent = '🎓 Certificate';           this.renderCertificate(content, params); break;
          case 'missions':         topTitle.textContent = '📋 Daily Missions';         this.renderMissions(content); break;
          case 'report-card':     topTitle.textContent = '📊 My Report Card';        this.renderReportCard(content); break;
          case 'social-wall':     topTitle.textContent = '👏 Recognition Wall';      this.renderSocialWall(content); break;
          case 'live-store':      topTitle.textContent = '⚡ Live Scoreboard';       this.renderLiveStore(content); break;
          case 'leaderboard':     topTitle.textContent = '🏆 Leaderboard';           this.renderLeaderboard(content); break;
          case 'my-certs':        topTitle.textContent = '🎓 My Certificates';       this.renderMyCerts(content); break;
          case 'ai-coach':        topTitle.textContent = '🤖 AI Retail Coach';       this.renderAICoach(content); break;
          case 'jc-performance':   topTitle.textContent = '🎯 JC Cycle Tracker';      this.renderJCPerformance(content); break;
          case 'data-upload':      topTitle.textContent = '📤 Upload Sales Data';     this.renderDataUpload(content); break;
          case 'manager-dashboard':topTitle.textContent='📊 Team Dashboard';         this.renderManagerDashboard(content); break;
          case 'store-analytics': topTitle.textContent = '🏪 Store Analytics';       this.renderStoreAnalytics(content); break;
          case 'admin':           topTitle.textContent = '⚙️ Admin Panel';           this.renderAdmin(content); break;
          case 'manage-users':    topTitle.textContent = '👥 Manage Users';          this.renderManageUsers(content); break;
          case 'reports':         topTitle.textContent = '📋 Reports';               this.renderReports(content); break;
          case 'profile':         topTitle.textContent = '👤 My Profile';            this.renderProfile(content); break;
          default: content.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><h3>Page not found</h3></div>';
        }
      } catch(e) {
        content.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error loading page</h3><p class="muted mt-2">${e.message}</p></div>`;
        console.error(e);
      }
    }, 0);
  },

  // ── DASHBOARD ────────────────────────────────────────────
  renderDashboard(el) {
    const u = this.getUser();
    const lp = IRA_DATA.getXPProgress(u.xp || 0);
    const prog = this.storage.get('progress', {});
    const myProg = prog[u.id] || {};
    const totalModules = IRA_DATA.brands.length + IRA_DATA.categories.length + IRA_DATA.sellingModules.length;
    const completedModules = Object.values(myProg).filter(p => p.quizPassed).length;
    const completionPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
    const users = this.storage.get('users', []);
    const allUsers = users.filter(u2 => u2.xp > 0).sort((a, b) => (b.xp||0) - (a.xp||0));
    const myLBRank = allUsers.findIndex(u2 => u2.id === u.id) + 1;

    // Real sales KPIs (rank/percentile only for stylists)
    const sp = typeof SALES_DATA !== 'undefined' ? this.getSalesRecord(u) : null;
    const isStylist = ['Retail Stylist','Senior Stylist'].includes(u.role);
    const canSeeAbsolute = !isStylist;

    // Store record for this user's store
    const storeRec = (typeof SALES_DATA !== 'undefined' && u.storeId)
      ? SALES_DATA.stores.find(s => s.name === u.storeId) : null;

    // Pending modules (not completed)
    const pending = [...IRA_DATA.brands.slice(0,3), ...IRA_DATA.categories.slice(0,2)]
      .filter(m => !(myProg[m.id]?.quizPassed));

    // Build sales KPI cards — rank/pctile only for stylists
    let salesSection = '';
    if (sp) {
      const n = typeof SALES_DATA !== 'undefined' ? SALES_DATA.meta.totalSP : 1;
      const atvLabel  = canSeeAbsolute ? `₹${Math.round(sp.atv).toLocaleString('en-IN')}` : `Top ${Math.round(100 - sp.atvPctile) + 1}%`;
      const uptLabel  = canSeeAbsolute ? sp.upt.toFixed(2)                                 : `Top ${Math.round(100 - sp.uptPctile) + 1}%`;
      const custLabel = canSeeAbsolute ? sp.custCount                                       : `Top ${Math.round(100 - sp.custPctile) + 1}%`;
      const billLabel = canSeeAbsolute ? sp.bills                                           : `Rank #${sp.rankBills} of ${n}`;
      const salesRankLabel = `#${sp.rankSales} of ${n}`;
      salesSection = `
      <div class="section-header"><h3>📊 My Sales Performance</h3><span class="text-xs muted">${isStylist ? 'Rankings shown — no absolute data' : 'Full data — manager view'}</span></div>
      <div class="kpi-grid">
        <div class="card"><div class="card-title">Sales Rank</div><div class="card-value gold">${salesRankLabel}</div><div class="card-sub">Overall percentile: ${Math.round(sp.salesPctile)}%</div></div>
        <div class="card"><div class="card-title">ATV</div><div class="card-value">${atvLabel}</div><div class="card-sub">Avg Ticket Value · Rank #${sp.rankATV}</div></div>
        <div class="card"><div class="card-title">UPT</div><div class="card-value">${uptLabel}</div><div class="card-sub">Units Per Ticket · Rank #${sp.rankUPT}</div></div>
        <div class="card"><div class="card-title">Customers</div><div class="card-value">${custLabel}</div><div class="card-sub">Unique buyers · Rank #${sp.rankCust}</div></div>
        <div class="card"><div class="card-title">Bills</div><div class="card-value">${billLabel}</div><div class="card-sub">Transactions handled</div></div>
        <div class="card"><div class="card-title">Productivity</div><div class="card-value">${canSeeAbsolute ? '₹'+Math.round(sp.salesPerDay).toLocaleString('en-IN') : 'Top '+Math.round(100-sp.rankDaily/n*100+1)+'%'}</div><div class="card-sub">Per workday · Rank #${sp.rankDaily}</div></div>
      </div>
      ${sp.monthly && sp.monthly.length > 0 ? this.renderMonthlyTrend(sp, storeRec, isStylist) : ''}`;
    }

    const pi = this.calculatePI(u, sp, { completionPct });
    const streak = this.getStreak(u);
    const missions = this.getDailyMissions(u, sp, myProg);
    const badges = this.getEarnedBadges(u, sp, myProg);
    const completedMissions = (this.storage.get('completed_missions_' + u.id) || []);

    el.innerHTML = `<div class="fade-in">
      <!-- WELCOME HERO -->
      <div class="card card-gold mb-2">
        <div style="display:flex;align-items:flex-start;gap:1.5rem;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div class="text-sm muted mb-1">Welcome back</div>
            <div class="text-2xl font-bold">${u.name} <span style="font-size:1.2rem">${lp.current.badge}</span></div>
            <div class="text-sm" style="color:var(--gold);margin-top:0.25rem">${lp.current.name}${lp.next ? ' → ' + lp.next.name : ' · Legend'}</div>
            <div style="margin-top:1rem">
              <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:#666;margin-bottom:0.35rem">
                <span>${u.xp || 0} XP</span>
                ${lp.next ? `<span>${lp.next.minXP} XP to ${lp.next.name}</span>` : '<span>MAX LEVEL</span>'}
              </div>
              <div class="xp-bar"><div class="xp-fill" style="width:${lp.pct}%"></div></div>
            </div>
          </div>
          <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
            <!-- PI Ring -->
            <div class="pi-ring-wrap" onclick="APP.navigate('report-card')" title="Performance Index">
              <svg viewBox="0 0 60 60" class="pi-ring">
                <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/>
                <circle cx="30" cy="30" r="25" fill="none" stroke="var(--gold)" stroke-width="5"
                  stroke-dasharray="${Math.round(pi * 1.571)} 157.1" stroke-linecap="round" transform="rotate(-90 30 30)"/>
              </svg>
              <div class="pi-ring-val">${pi}</div>
              <div class="pi-ring-label">PI Score</div>
            </div>
            <!-- Streak -->
            <div class="streak-badge ${streak.current >= 3 ? 'hot' : ''}" onclick="APP.navigate('missions')">
              <div class="streak-fire">${streak.current >= 7 ? '🔥' : streak.current >= 3 ? '⚡' : '📅'}</div>
              <div class="streak-num">${streak.current}</div>
              <div class="streak-label">Day Streak</div>
            </div>
          </div>
        </div>
      </div>

      <!-- QUICK STATS -->
      <div class="kpi-grid">
        <div class="card kpi-hover" onclick="APP.navigate('leaderboard')"><div class="card-title">Academy Rank</div><div class="card-value gold">${myLBRank > 0 ? '#' + myLBRank : '–'}</div><div class="card-sub">Among all stylists</div></div>
        <div class="card kpi-hover" onclick="APP.navigate('missions')"><div class="card-title">Today's Missions</div><div class="card-value">${completedMissions.filter(m=>m.date===new Date().toDateString()).length}/${missions.length}</div><div class="card-sub">${missions.length > 0 ? '+' + missions.reduce((s,m)=>s+m.xp,0) + ' XP available' : 'All done!'}</div></div>
        <div class="card kpi-hover" onclick="APP.navigate('report-card')"><div class="card-title">Badges Earned</div><div class="card-value">${badges.length}</div><div class="card-sub">of ${IRA_DATA.badges.length} total</div></div>
        <div class="card kpi-hover" onclick="APP.navigate('report-card')"><div class="card-title">Learning Progress</div><div class="card-value">${completionPct}%</div><div class="card-sub">${completedModules} of ${totalModules} modules</div></div>
      </div>

      <!-- DAILY MISSIONS PREVIEW -->
      ${missions.length > 0 ? `
      <div class="section-header"><h3>📋 Today's Missions</h3><button class="btn btn-outline btn-sm" onclick="APP.navigate('missions')">View All</button></div>
      <div class="missions-preview">
        ${missions.slice(0,3).map(m => {
          const done = completedMissions.some(c => c.id === m.id && c.date === new Date().toDateString());
          return `<div class="mission-card-mini ${done?'done':''}">
            <div class="mission-icon">${done?'✅':'🎯'}</div>
            <div class="mission-text">${m.text}</div>
            <div class="mission-xp">+${m.xp} XP</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- LEARNING KPI -->
      <div class="kpi-grid">

      <!-- SALES KPIs (real data) -->
      ${salesSection}

      <!-- CONTINUE LEARNING -->
      ${pending.length > 0 ? `
      <div class="section-header"><h3>🎯 Continue Learning</h3><button class="btn btn-outline btn-sm" onclick="APP.navigate('brand-academy')">View All</button></div>
      <div class="module-grid">
        ${pending.slice(0,4).map(m => {
          const p = myProg[m.id] || {};
          const isBrand = !!m.videoFile && IRA_DATA.brands.some(b => b.id === m.id);
          return `<div class="module-card" style="--card-color:${m.color||'var(--gold)'}" onclick="APP.navigate('${isBrand ? 'brand-module' : 'category-module'}', {${isBrand ? 'brandId' : 'catId'}:'${m.id}'})">
            <div class="module-icon">${m.logo || m.icon || '📖'}</div>
            <h4>${m.name}</h4>
            <p>${m.tagline || m.description || ''}</p>
            <div class="progress-bar-wrap"><div class="progress-bar"><div class="progress-bar-fill" style="width:${p.watchPct||0}%"></div></div></div>
            <div class="meta"><span class="text-xs muted">Watch: ${p.watchPct||0}%</span><span class="badge-pill badge-${p.quizPassed?'green':'gold'}">${p.quizPassed?'✓ Done':'Start'}</span></div>
          </div>`;
        }).join('')}
      </div>` : `<div class="card" style="text-align:center;padding:2rem">
        <div style="font-size:2rem">🏆</div>
        <h3 class="mt-1 gold">All modules explored!</h3>
        <p class="muted mt-1">Check leaderboard for your ranking</p>
      </div>`}

      <hr class="divider">

      <!-- SKILL MAP -->
      <div class="section-header"><h3>🧠 Skill Progress</h3></div>
      <div class="card">
        <div class="skill-map">
          ${this.renderSkillBars(u.id, myProg)}
        </div>
      </div>
    </div>`;
  },

  renderMonthlyTrend(sp, storeRec, isStylist) {
    const months = sp.monthly.slice(-6);
    if (!months.length) return '';
    const storeMonths = storeRec ? storeRec.monthly : [];
    const rows = months.map(m => {
      const sm = storeMonths.find(x => x.month === m.month);
      const storeAtv = sm && sm.bills > 0 ? sm.sales / sm.bills : 0;
      const myAtv = m.bills > 0 ? m.sales / m.bills : 0;
      const vsStore = storeAtv > 0 ? Math.round((myAtv / storeAtv) * 100) : 0;
      const atvDisplay = isStylist ? `${vsStore}% of store avg` : `₹${Math.round(myAtv).toLocaleString('en-IN')}`;
      return `<tr><td class="text-sm">${m.month}</td><td>${isStylist ? m.bills : m.bills} bills</td><td>${atvDisplay}</td></tr>`;
    }).join('');
    return `
    <div class="section-header"><h3>📅 Monthly Trend (Last 6 Months)</h3></div>
    <div class="card" style="overflow-x:auto">
      <table class="data-table"><thead><tr><th>Month</th><th>Bills</th><th>ATV ${isStylist ? 'vs Store' : ''}</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
  },

  kpiMini(title, value, sub) {
    return `<div style="text-align:center">
      <div style="font-size:1.6rem;font-weight:900;color:var(--gold)">${value}</div>
      <div style="font-size:0.72rem;color:#666;text-transform:uppercase;letter-spacing:0.06em">${title}</div>
      <div style="font-size:0.7rem;color:#444">${sub}</div>
    </div>`;
  },

  renderSkillBars(userId, myProg) {
    const skills = [
      { name: 'Brand Knowledge', ids: IRA_DATA.brands.map(b => b.id), color: '#c9a84c' },
      { name: 'Product Categories', ids: IRA_DATA.categories.map(c => c.id), color: '#1565c0' },
      { name: 'Selling Skills', ids: IRA_DATA.sellingModules.map(m => m.id), color: '#2e7d32' },
      { name: 'Bra Fitting', ids: ['bra-fitting'], color: '#880e4f' },
      { name: 'Customer Service', ids: ['greet-need'], color: '#e65100' }
    ];
    return skills.map(s => {
      const passed = s.ids.filter(id => myProg[id]?.quizPassed).length;
      const pct = s.ids.length > 0 ? Math.round((passed / s.ids.length) * 100) : 0;
      return `<div class="skill-row">
        <div class="skill-name">${s.name}</div>
        <div class="skill-bar"><div class="skill-fill" style="width:${pct}%;background:${s.color}"></div></div>
        <div class="skill-pct">${pct}%</div>
      </div>`;
    }).join('');
  },

  // ── BRAND ACADEMY ────────────────────────────────────────
  renderBrandAcademy(el) {
    const prog = this.storage.get('progress', {})[this.state.user.id] || {};
    el.innerHTML = `<div class="fade-in">
      <div class="text-sm muted mb-2">Complete brand training to earn brand specialist certificates and XP</div>
      <div class="module-grid">
        ${IRA_DATA.brands.map(b => {
          const p = prog[b.id] || {};
          return `<div class="module-card" style="--card-color:${b.color}" onclick="APP.navigate('brand-module',{brandId:'${b.id}'})">
            <div class="module-icon">${b.logo}</div>
            <h4>${b.name}</h4>
            <p>${b.tagline}</p>
            <div class="text-xs muted mt-1">Trainer: ${b.trainer}</div>
            <div class="progress-bar-wrap mt-1"><div class="progress-bar"><div class="progress-bar-fill" style="width:${p.watchPct||0}%"></div></div></div>
            <div class="meta">
              <span class="text-xs muted">Video: ${p.watchPct||0}%</span>
              <span class="badge-pill badge-${p.quizPassed?'green':p.watchPct?'blue':'gold'}">${p.quizPassed?'✓ Certified':p.watchPct?'In Progress':'Start'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  renderBrandModule(el, brandId) {
    const brand = IRA_DATA.brands.find(b => b.id === brandId);
    if (!brand) { el.innerHTML = '<div class="empty-state">Brand not found</div>'; return; }
    const prog = this.storage.get('progress', {})[this.state.user.id]?.[brandId] || {};
    const customUrls = this.storage.get('video_urls', {});
    const videoUrl = customUrls[brandId] || '';

    el.innerHTML = `<div class="fade-in">
      <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap">
        <span style="font-size:2rem">${brand.logo}</span>
        <div>
          <h2 style="font-size:1.4rem;font-weight:900">${brand.name}</h2>
          <div class="text-sm" style="color:${brand.color}">${brand.tagline}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          ${prog.quizPassed ? '<span class="badge-pill badge-green">✓ Certified</span>' : ''}
          <button class="btn btn-ghost btn-sm" onclick="APP.navigate('brand-academy')">← Back</button>
        </div>
      </div>

      <!-- VIDEO SECTION -->
      <div class="card mb-2">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
          <h3>🎬 Brand Training Video</h3>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <span class="badge-pill badge-gold">Watch ≥90% to unlock quiz</span>
          </div>
        </div>
        <div class="video-url-input">
          <input type="text" id="vid-url-${brandId}" placeholder="Paste video URL (YouTube, Google Drive, MP4...) or leave blank for local file" value="${videoUrl}">
          <button class="btn btn-outline btn-sm" onclick="APP.saveVideoUrl('${brandId}')">Save URL</button>
        </div>
        <div class="video-container" id="vid-container-${brandId}">
          ${this.buildVideoEmbed(videoUrl, brand.videoFile, brandId)}
        </div>
        <div style="margin-top:0.75rem;display:flex;justify-content:space-between;align-items:center">
          <div class="text-sm muted">Local file: <code style="font-size:0.78rem;color:var(--gold)">${brand.videoFile}</code></div>
          <div class="text-sm" style="color:${(prog.watchPct||0)>=90?'#66bb6a':'#888'}">Watched: <strong>${prog.watchPct||0}%</strong></div>
        </div>
      </div>

      <!-- BRAND INFO CARDS -->
      <div class="grid-2 mb-2">
        <div class="card">
          <div class="card-title">Target Customer</div>
          <div style="margin-top:0.5rem;font-size:0.9rem">${brand.targetCustomer}</div>
        </div>
        <div class="card">
          <div class="card-title">Price Range</div>
          <div class="card-value" style="font-size:1.4rem">${brand.priceRange}</div>
        </div>
        <div class="card">
          <div class="card-title">USP</div>
          <div style="margin-top:0.5rem;font-size:0.88rem">${brand.usp}</div>
        </div>
        <div class="card">
          <div class="card-title">Fabric Technology</div>
          <div style="margin-top:0.5rem;font-size:0.88rem">${brand.fabric}</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-title">Best Sellers</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
          ${brand.bestSellers.map(s => `<span class="chip">⭐ ${s}</span>`).join('')}
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-title">Cross-Sell Opportunities</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
          ${brand.crossSell.map(s => `<span class="chip">🔗 ${s}</span>`).join('')}
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-title">Objection Handling Scripts</div>
        ${Object.entries(brand.objectionHandling).map(([obj, ans]) => `
          <div style="margin-top:1rem;padding:0.85rem;background:var(--black3);border-radius:var(--radius)">
            <div style="font-size:0.82rem;color:var(--red);font-weight:600;margin-bottom:0.35rem">❓ "${obj}"</div>
            <div style="font-size:0.88rem;color:#ccc">✅ ${ans}</div>
          </div>`).join('')}
      </div>

      <!-- QUIZ UNLOCK -->
      <div class="card card-gold" style="text-align:center;padding:2rem">
        ${prog.quizPassed
          ? `<div style="font-size:2rem">🏆</div><h3 class="gold mt-1">Quiz Passed! Certificate Earned.</h3>
             <div class="text-sm muted mt-1">Score: ${prog.quizScore}% on ${new Date(prog.quizDate).toLocaleDateString()}</div>
             <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.25rem;flex-wrap:wrap">
               <button class="btn btn-gold" onclick="APP.navigate('certificate',{type:'brand',id:'${brandId}',name:'${brand.name}'})">🎓 View Certificate</button>
               <button class="btn btn-outline" onclick="APP.navigate('quiz',{type:'brand',id:'${brandId}',name:'${brand.name}'})">Retake Quiz</button>
             </div>`
          : (prog.watchPct||0) >= 90
          ? `<div style="font-size:2rem">✅</div><h3 class="gold mt-1">Video Completed! Quiz Unlocked.</h3>
             <p class="muted mt-1">Test your ${brand.name} brand knowledge</p>
             <button class="btn btn-gold btn-lg mt-2" onclick="APP.navigate('quiz',{type:'brand',id:'${brandId}',name:'${brand.name}'})">📝 Start Quiz</button>`
          : `<div style="font-size:2rem">🔒</div><h3 class="mt-1">Quiz Locked</h3>
             <p class="muted mt-1">Watch at least 90% of the training video to unlock the quiz</p>
             <button class="btn btn-outline mt-2" onclick="APP.markVideoWatched('${brandId}')">✓ Mark as Watched (Demo)</button>`}
      </div>
    </div>`;
  },

  buildVideoEmbed(url, localFile, moduleId) {
    if (url) {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const vid = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
        if (vid) return `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?enablejsapi=1" frameborder="0" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%"></iframe>`;
      }
      if (url.includes('drive.google.com')) {
        const fid = url.match(/\/d\/([^/]+)/)?.[1];
        if (fid) return `<iframe width="100%" height="100%" src="https://drive.google.com/file/d/${fid}/preview" frameborder="0" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%"></iframe>`;
      }
      if (url.match(/\.(mp4|webm|mov)$/i)) {
        return `<video id="vid-${moduleId}" controls onended="APP.onVideoEnd('${moduleId}')" ontimeupdate="APP.onVideoProgress(this,'${moduleId}')" style="width:100%;height:100%;position:absolute;inset:0">
          <source src="${url}"><p style="color:#888;padding:2rem">Video not available at this URL.</p></video>`;
      }
    }
    // Try local file path
    const localPath = `C:/Users/Pramod karwa/Videos/4K Video Downloader+/${localFile.includes('Accessories')||localFile.includes('Types')?'By Category':'Brand'}/${localFile}`;
    return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;text-align:center">
      <div style="font-size:2.5rem">🎬</div>
      <div style="font-size:0.9rem;color:#888">Paste a video URL above, or play the local file below</div>
      <div style="font-size:0.78rem;color:#555;font-family:monospace;word-break:break-all;max-width:400px">${localFile}</div>
      <button class="btn btn-outline btn-sm" onclick="APP.markVideoWatched('${moduleId}')">✓ I've Watched This Video (Mark Complete)</button>
    </div>`;
  },

  saveVideoUrl(moduleId) {
    const url = document.getElementById('vid-url-' + moduleId)?.value?.trim();
    const urls = this.storage.get('video_urls', {});
    urls[moduleId] = url;
    this.storage.set('video_urls', urls);
    const container = document.getElementById('vid-container-' + moduleId);
    if (container) {
      const brand = IRA_DATA.brands.find(b => b.id === moduleId);
      const cat = IRA_DATA.categories.find(c => c.id === moduleId);
      const mod = IRA_DATA.sellingModules.find(m => m.id === moduleId);
      const localFile = brand?.videoFile || cat?.videoFile || '';
      container.innerHTML = this.buildVideoEmbed(url, localFile, moduleId);
    }
    // Sync to cloud so all devices get the URL
    const patch = { video_urls: {} };
    patch.video_urls[moduleId] = url;
    this.syncConfig(patch);
    this.toast('Video URL saved!', 'success');
  },

  onVideoProgress(vid, moduleId) {
    if (!vid.duration) return;
    const pct = Math.round((vid.currentTime / vid.duration) * 100);
    const prog = this.storage.get('progress', {});
    if (!prog[this.state.user.id]) prog[this.state.user.id] = {};
    if (!prog[this.state.user.id][moduleId]) prog[this.state.user.id][moduleId] = {};
    const current = prog[this.state.user.id][moduleId].watchPct || 0;
    if (pct > current) {
      prog[this.state.user.id][moduleId].watchPct = pct;
      this.storage.set('progress', prog);
      if (pct >= 90 && current < 90) {
        this.addXP(this.state.user.id, 50, 'Video Completed');
        this.toast('🎉 Video completed! Quiz unlocked. +50 XP', 'success');
      }
    }
  },

  onVideoEnd(moduleId) { this.markVideoWatched(moduleId); },

  markVideoWatched(moduleId) {
    const prog = this.storage.get('progress', {});
    if (!prog[this.state.user.id]) prog[this.state.user.id] = {};
    if (!prog[this.state.user.id][moduleId]) prog[this.state.user.id][moduleId] = {};
    prog[this.state.user.id][moduleId].watchPct = 100;
    this.storage.set('progress', prog);
    this.addXP(this.state.user.id, 50, 'Video Watched');
    this.toast('Video marked as watched! Quiz unlocked. +50 XP', 'success');
    // Re-render current page
    setTimeout(() => { const page = this.state.currentPage; const params = this.state.currentParams || {}; this.navigate(page, params); }, 500);
    this.state.currentParams = this.state.currentParams || {};
  },

  // ── CATEGORY ACADEMY ─────────────────────────────────────
  renderCategoryAcademy(el) {
    const prog = this.storage.get('progress', {})[this.state.user.id] || {};
    el.innerHTML = `<div class="fade-in">
      <div class="text-sm muted mb-2">Master every product category to become a complete lingerie expert</div>
      <div class="module-grid">
        ${IRA_DATA.categories.map(c => {
          const p = prog[c.id] || {};
          return `<div class="module-card" style="--card-color:${c.color}" onclick="APP.navigate('category-module',{catId:'${c.id}'})">
            <div class="module-icon">${c.icon}</div>
            <h4>${c.name}</h4>
            <p>${c.description}</p>
            <div class="progress-bar-wrap mt-1"><div class="progress-bar"><div class="progress-bar-fill" style="width:${p.watchPct||0}%"></div></div></div>
            <div class="meta">
              <span class="text-xs muted">Video: ${p.watchPct||0}%</span>
              <span class="badge-pill badge-${p.quizPassed?'green':p.watchPct?'blue':'gold'}">${p.quizPassed?'✓ Certified':p.watchPct?'In Progress':'Start'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  renderCategoryModule(el, catId) {
    const cat = IRA_DATA.categories.find(c => c.id === catId);
    if (!cat) { el.innerHTML = '<div class="empty-state">Category not found</div>'; return; }
    const prog = this.storage.get('progress', {})[this.state.user.id]?.[catId] || {};
    const customUrls = this.storage.get('video_urls', {});
    const videoUrl = customUrls[catId] || '';
    this.state.currentParams = { catId };

    el.innerHTML = `<div class="fade-in">
      <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap">
        <span style="font-size:2rem">${cat.icon}</span>
        <div><h2 style="font-size:1.4rem;font-weight:900">${cat.name}</h2><div class="text-sm muted">${cat.description}</div></div>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="APP.navigate('category-academy')">← Back</button>
      </div>

      <div class="card mb-2">
        <h3 class="mb-2">🎬 Category Training Video</h3>
        <div class="video-url-input">
          <input type="text" id="vid-url-${catId}" placeholder="Paste video URL..." value="${videoUrl}">
          <button class="btn btn-outline btn-sm" onclick="APP.saveVideoUrl('${catId}')">Save URL</button>
        </div>
        <div class="video-container" id="vid-container-${catId}">
          ${this.buildVideoEmbed(videoUrl, 'By Category/' + cat.videoFile, catId)}
        </div>
        <div style="margin-top:0.75rem;display:flex;justify-content:space-between;align-items:center">
          <div class="text-sm muted">File: <code style="font-size:0.78rem;color:var(--gold)">${cat.videoFile}</code></div>
          <div class="text-sm" style="color:${(prog.watchPct||0)>=90?'#66bb6a':'#888'}">Watched: <strong>${prog.watchPct||0}%</strong></div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-title">Product Types in This Category</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem;margin-top:0.75rem">
          ${cat.types.map(t => `<div style="background:var(--black3);border-radius:var(--radius);padding:0.85rem">
            <div style="font-weight:700;margin-bottom:0.35rem;color:${cat.color}">${t.name}</div>
            <div style="font-size:0.82rem;color:#888;margin-bottom:0.35rem">${t.desc}</div>
            <div style="font-size:0.75rem;color:#555">👤 ${t.customer}</div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card card-gold" style="text-align:center;padding:2rem">
        ${prog.quizPassed
          ? `<div style="font-size:2rem">🏆</div><h3 class="gold mt-1">Quiz Passed! Certificate Earned.</h3>
             <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.25rem;flex-wrap:wrap">
               <button class="btn btn-gold" onclick="APP.navigate('certificate',{type:'category',id:'${catId}',name:'${cat.name}'})">🎓 View Certificate</button>
               <button class="btn btn-outline" onclick="APP.navigate('quiz',{type:'category',id:'${catId}',name:'${cat.name}'})">Retake</button>
             </div>`
          : (prog.watchPct||0) >= 90
          ? `<div style="font-size:2rem">✅</div><h3 class="gold mt-1">Quiz Unlocked!</h3>
             <button class="btn btn-gold btn-lg mt-2" onclick="APP.navigate('quiz',{type:'category',id:'${catId}',name:'${cat.name}'})">📝 Start Quiz</button>`
          : `<div style="font-size:2rem">🔒</div><h3 class="mt-1">Watch Video to Unlock Quiz</h3>
             <button class="btn btn-outline mt-2" onclick="APP.markVideoWatched('${catId}')">✓ Mark as Watched (Demo)</button>`}
      </div>
    </div>`;
  },

  // ── SELLING SKILLS ───────────────────────────────────────
  renderSellingSkills(el) {
    const prog = this.storage.get('progress', {})[this.state.user.id] || {};
    el.innerHTML = `<div class="fade-in">
      <div class="text-sm muted mb-2">Master the art of luxury retail selling</div>
      <div class="module-grid">
        ${IRA_DATA.sellingModules.map(m => {
          const p = prog[m.id] || {};
          return `<div class="module-card" style="--card-color:${m.color}" onclick="APP.navigate('skill-module',{moduleId:'${m.id}'})">
            <div class="module-icon">${m.icon}</div>
            <h4>${m.name}</h4>
            <p>${m.lessons.length} lessons</p>
            <div class="meta mt-2">
              <span class="text-xs muted">${m.quiz.length} quiz questions</span>
              <span class="badge-pill badge-${p.quizPassed?'green':'gold'}">${p.quizPassed?'✓ Done':'Start'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  renderSkillModule(el, moduleId) {
    const mod = IRA_DATA.sellingModules.find(m => m.id === moduleId);
    if (!mod) return;
    const prog = this.storage.get('progress', {})[this.state.user.id]?.[moduleId] || {};

    el.innerHTML = `<div class="fade-in">
      <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1.5rem">
        <span style="font-size:2rem">${mod.icon}</span>
        <div><h2>${mod.name}</h2></div>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="APP.navigate('selling-skills')">← Back</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:1rem;margin-bottom:2rem">
        ${mod.lessons.map((l, i) => `<div class="card">
          <div style="display:flex;gap:0.75rem;align-items:flex-start">
            <div style="width:32px;height:32px;border-radius:50%;background:${mod.color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;flex-shrink:0">${i+1}</div>
            <div>
              <div style="font-weight:700;margin-bottom:0.35rem">${l.title}</div>
              <div style="font-size:0.88rem;color:#aaa;line-height:1.6">${l.content}</div>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <div class="card card-gold" style="text-align:center;padding:2rem">
        ${prog.quizPassed
          ? `<div style="font-size:2rem">🏆</div><h3 class="gold mt-1">Completed! Score: ${prog.quizScore}%</h3>
             <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.25rem">
               <button class="btn btn-gold" onclick="APP.navigate('certificate',{type:'skill',id:'${moduleId}',name:'${mod.name}'})">🎓 Certificate</button>
               <button class="btn btn-outline" onclick="APP.navigate('quiz',{type:'skill',id:'${moduleId}',name:'${mod.name}'})">Retake</button>
             </div>`
          : `<button class="btn btn-gold btn-lg" onclick="APP.navigate('quiz',{type:'skill',id:'${moduleId}',name:'${mod.name}'})">📝 Take Quiz (${mod.quiz.length} questions)</button>`}
      </div>
    </div>`;
  },

  // ── QUIZ ENGINE ──────────────────────────────────────────
  renderQuiz(el, params) {
    const { type, id, name } = params;
    let questions = [];
    if (type === 'brand') questions = (IRA_DATA.brands.find(b => b.id === id)?.quiz || []);
    else if (type === 'category') questions = (IRA_DATA.categories.find(c => c.id === id)?.quiz || []);
    else if (type === 'skill') questions = (IRA_DATA.sellingModules.find(m => m.id === id)?.quiz || []);

    if (!questions.length) { el.innerHTML = '<div class="empty-state">No questions found</div>'; return; }

    // Shuffle and pick up to 10
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(questions.length, 10));

    this.state.quizSession = {
      type, id, name,
      questions: shuffled,
      current: 0,
      answers: [],
      score: 0,
      startTime: Date.now()
    };

    this.renderQuizQuestion(el);
  },

  renderQuizQuestion(el) {
    const qs = this.state.quizSession;
    if (!qs) return;
    const { questions, current } = qs;
    const q = questions[current];
    const pct = Math.round(((current) / questions.length) * 100);

    el.innerHTML = `<div class="quiz-wrap fade-in">
      <div class="quiz-progress"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-header">
        <div class="question-count">Question ${current + 1} of ${questions.length} · ${qs.name}</div>
        <h2 style="margin-top:0.5rem;font-size:1rem;color:#888">${q.diff === 'hard' ? '🔴 Hard' : q.diff === 'medium' ? '🟡 Medium' : '🟢 Easy'}</h2>
      </div>
      <div class="question-card">
        <div class="question-text">${q.q}</div>
        <div class="options-grid">
          ${q.opts.map((opt, i) => `
            <button class="option-btn" onclick="APP.selectAnswer(${i})" id="opt-${i}">
              <span class="opt-letter">${'ABCD'[i]}</span>
              <span>${opt}</span>
            </button>`).join('')}
        </div>
        <div class="explanation" id="quiz-explanation"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="text-sm muted">Score: ${qs.score}/${current}</div>
        <button class="btn btn-gold btn-sm hidden" id="quiz-next-btn" onclick="APP.nextQuestion()">
          ${current + 1 === questions.length ? '📊 See Results' : 'Next Question →'}
        </button>
      </div>
    </div>`;
  },

  selectAnswer(optIdx) {
    const qs = this.state.quizSession;
    const q = qs.questions[qs.current];
    const opts = document.querySelectorAll('.option-btn');
    opts.forEach(btn => btn.disabled = true);

    const selected = document.getElementById('opt-' + optIdx);
    const correct = document.getElementById('opt-' + q.ans);
    selected.classList.add('selected');

    const isCorrect = optIdx === q.ans;
    if (isCorrect) {
      selected.classList.add('correct');
      qs.score++;
    } else {
      selected.classList.add('wrong');
      correct.classList.add('correct');
    }

    qs.answers.push({ optIdx, correct: isCorrect });

    const expEl = document.getElementById('quiz-explanation');
    if (expEl) {
      expEl.textContent = isCorrect ? '✅ Correct! ' + (q.explanation || 'Well done!') : `❌ The correct answer is: ${q.opts[q.ans]}`;
      expEl.classList.add('show');
    }

    document.getElementById('quiz-next-btn')?.classList.remove('hidden');
  },

  nextQuestion() {
    const qs = this.state.quizSession;
    qs.current++;
    if (qs.current >= qs.questions.length) {
      this.finishQuiz();
    } else {
      this.renderQuizQuestion(document.getElementById('page-content'));
    }
  },

  finishQuiz() {
    const qs = this.state.quizSession;
    const scorePct = Math.round((qs.score / qs.questions.length) * 100);
    const passed = scorePct >= 80;

    // Save progress
    const prog = this.storage.get('progress', {});
    const uid = this.state.user.id;
    if (!prog[uid]) prog[uid] = {};
    if (!prog[uid][qs.id]) prog[uid][qs.id] = {};
    const prev = prog[uid][qs.id];
    const attempts = (prev.attempts || 0) + 1;
    prog[uid][qs.id] = {
      ...prev,
      quizScore: scorePct,
      quizPassed: passed || prev.quizPassed,
      attempts,
      quizDate: new Date().toISOString(),
      watchPct: prev.watchPct || 100
    };
    this.storage.set('progress', prog);

    // Award XP
    const xp = passed ? 200 : 50;
    this.addXP(uid, xp, passed ? 'Quiz Passed' : 'Quiz Attempted');
    if (passed) this.addXP(uid, 50, 'Certificate Earned');

    this.navigate('results', {
      type: qs.type, id: qs.id, name: qs.name,
      score: qs.score, total: qs.questions.length,
      scorePct, passed, attempts,
      timeMs: Date.now() - qs.startTime
    });
  },

  renderResults(el, params) {
    const { type, id, name, score, total, scorePct, passed, attempts } = params;
    const color = passed ? '#66bb6a' : scorePct >= 60 ? '#ffd54f' : '#ef9a9a';
    const r = 54; const circ = 2 * Math.PI * r;
    const dash = circ - (scorePct / 100) * circ;

    el.innerHTML = `<div class="results-card fade-in">
      <div class="score-ring">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--black4)" stroke-width="8"/>
          <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${circ}" stroke-dashoffset="${dash}" stroke-linecap="round"/>
        </svg>
        <div class="score-text">
          <div class="pct" style="color:${color}">${scorePct}%</div>
          <div class="label">${passed?'PASSED':'FAILED'}</div>
        </div>
      </div>

      <h2 style="font-size:1.5rem;margin-bottom:0.5rem">${passed ? '🎉 Congratulations!' : '📚 Keep Learning'}</h2>
      <p class="muted">${name}</p>
      <div style="display:flex;gap:2rem;justify-content:center;margin:1.5rem 0;flex-wrap:wrap">
        <div style="text-align:center"><div style="font-size:1.4rem;font-weight:700;color:${color}">${score}/${total}</div><div class="text-xs muted">Correct</div></div>
        <div style="text-align:center"><div style="font-size:1.4rem;font-weight:700;color:var(--gold)">${attempts}</div><div class="text-xs muted">Attempt${attempts>1?'s':''}</div></div>
        <div style="text-align:center"><div style="font-size:1.4rem;font-weight:700;${passed?'color:#66bb6a':'color:#ef9a9a'}">${passed?'+200 XP':'+50 XP'}</div><div class="text-xs muted">Earned</div></div>
      </div>

      ${passed
        ? `<div style="background:rgba(46,125,50,0.1);border:1px solid #2e7d32;border-radius:var(--radius);padding:1rem;margin-bottom:1.5rem;font-size:0.88rem">
            ✅ You've passed! Your certificate has been issued. Keep up the excellent work!
           </div>`
        : attempts >= 3
        ? `<div style="background:rgba(198,40,40,0.1);border:1px solid var(--red);border-radius:var(--radius);padding:1rem;margin-bottom:1.5rem;font-size:0.88rem">
            ⚠️ Maximum attempts reached. Please review the training video and content before retrying.
           </div>`
        : `<div style="background:rgba(201,168,76,0.1);border:1px solid var(--gold3);border-radius:var(--radius);padding:1rem;margin-bottom:1.5rem;font-size:0.88rem">
            💡 You need 80% to pass. Review the training content and try again. (${3-attempts} attempt${3-attempts!==1?'s':''} remaining)
           </div>`}

      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
        ${passed ? `<button class="btn btn-gold" onclick="APP.navigate('certificate',{type:'${type}',id:'${id}',name:'${name}'})">🎓 View Certificate</button>` : ''}
        ${!passed && attempts < 3 ? `<button class="btn btn-outline" onclick="APP.navigate('quiz',{type:'${type}',id:'${id}',name:'${name}'})">🔄 Retry Quiz</button>` : ''}
        <button class="btn btn-ghost" onclick="APP.navigate('${type==='brand'?'brand-academy':type==='category'?'category-academy':'selling-skills'}')">← Back to Academy</button>
      </div>
    </div>`;
  },

  // ── CERTIFICATE ──────────────────────────────────────────
  renderCertificate(el, params) {
    const { type, id, name } = params;
    const u = this.getUser();
    const prog = this.storage.get('progress', {})[u.id]?.[id] || {};
    if (!prog.quizPassed) { el.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><h3>Complete and pass the quiz first</h3></div>'; return; }

    const certId = 'IRA-' + type.toUpperCase().slice(0,2) + '-' + id.slice(0,4).toUpperCase() + '-' + u.id.slice(-4).toUpperCase();
    const date = prog.quizDate ? new Date(prog.quizDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : new Date().toLocaleDateString();
    const store = u.storeId ? IRA_DATA.stores.find(s => s.id === u.storeId)?.name || u.storeId : 'Head Office';

    el.innerHTML = `<div class="cert-wrap fade-in">
      <div class="certificate" id="certificate-el">
        <div class="cert-top">Intimissi Retail Academy</div>
        <div class="cert-brand">INTIMISSI</div>
        <div class="cert-title">RETAIL EXCELLENCE PROGRAMME</div>
        <div class="cert-presents">This is to certify that</div>
        <div class="cert-name">${u.name}</div>
        <div class="cert-for">has successfully completed training in</div>
        <div class="cert-course">${name}</div>
        <div class="text-sm muted">Score: ${prog.quizScore}% · Store: ${store} · ${date}</div>
        <div class="cert-footer">
          <div class="cert-sign"><span>Pramod Karwa</span>Director, Intimissi</div>
          <div class="cert-qr">
            <div style="font-size:1.5rem">▣</div>
            <div style="margin-top:0.35rem">${certId}</div>
          </div>
          <div class="cert-sign"><span>Learning & Development</span>Intimissi Academy</div>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
        <button class="btn btn-gold" onclick="APP.printCertificate()">🖨️ Print / Download PDF</button>
        <button class="btn btn-outline" onclick="APP.navigate('my-certs')">All Certificates</button>
        <button class="btn btn-ghost" onclick="APP.navigate('dashboard')">← Dashboard</button>
      </div>
    </div>`;
  },

  printCertificate() {
    const el = document.getElementById('certificate-el');
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Certificate</title>
      <style>
        body{background:#0d0d0d;color:#fafafa;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;}
        .certificate{background:#1a1a1a;border:2px solid #9a7a2a;border-radius:20px;padding:3rem;text-align:center;max-width:700px;width:100%}
        .cert-brand{font-size:1.5rem;font-weight:900;color:#c9a84c;margin:0.5rem 0}
        .cert-name{font-size:2.25rem;font-weight:900;color:#fafafa;margin:0.5rem 0 1.5rem;font-style:italic}
        .cert-course{font-size:1.25rem;font-weight:700;color:#c9a84c;margin:0.5rem 0 2rem}
        .cert-footer{display:flex;justify-content:space-around;margin-top:2rem;padding-top:2rem;border-top:1px solid #2e2e2e}
        .muted{color:#888;font-size:0.85rem}
        @media print{body{background:white;color:black}.certificate{background:white;border-color:#888}.cert-brand,.cert-course{color:#333}.cert-name{color:#000}}
      </style></head><body>${el.outerHTML}
      <script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    w.document.close();
  },

  // ── MY CERTIFICATES ──────────────────────────────────────
  renderMyCerts(el) {
    const u = this.getUser();
    const prog = this.storage.get('progress', {})[u.id] || {};
    const certs = [];
    IRA_DATA.brands.forEach(b => { if (prog[b.id]?.quizPassed) certs.push({ type:'brand', id:b.id, name:b.name, icon:b.logo, score:prog[b.id].quizScore, date:prog[b.id].quizDate }); });
    IRA_DATA.categories.forEach(c => { if (prog[c.id]?.quizPassed) certs.push({ type:'category', id:c.id, name:c.name, icon:c.icon, score:prog[c.id].quizScore, date:prog[c.id].quizDate }); });
    IRA_DATA.sellingModules.forEach(m => { if (prog[m.id]?.quizPassed) certs.push({ type:'skill', id:m.id, name:m.name, icon:m.icon, score:prog[m.id].quizScore, date:prog[m.id].quizDate }); });

    el.innerHTML = certs.length === 0
      ? `<div class="empty-state"><div class="icon">🎓</div><h3>No certificates yet</h3><p class="muted mt-1">Complete brand and category quizzes to earn certificates</p><button class="btn btn-gold mt-2" onclick="APP.navigate('brand-academy')">Start Learning</button></div>`
      : `<div class="fade-in">
          <div class="text-sm muted mb-2">${certs.length} certificate${certs.length!==1?'s':''} earned</div>
          <div class="module-grid">
            ${certs.map(c => `<div class="card" style="text-align:center;cursor:pointer" onclick="APP.navigate('certificate',{type:'${c.type}',id:'${c.id}',name:'${c.name}'})">
              <div style="font-size:2.5rem;margin-bottom:0.75rem">${c.icon}</div>
              <h4>${c.name}</h4>
              <div class="badge-pill badge-green mt-1">✓ ${c.score}%</div>
              <div class="text-xs muted mt-1">${c.date ? new Date(c.date).toLocaleDateString() : ''}</div>
              <button class="btn btn-outline btn-sm mt-2">View Certificate</button>
            </div>`).join('')}
          </div>
        </div>`;
  },

  // ── LEADERBOARD ──────────────────────────────────────────
  renderLeaderboard(el) {
    const users = this.activeUsers();
    const prog  = this.storage.get('progress', {});
    const me    = this.state.user;
    const isStylist = ['Retail Stylist','Senior Stylist'].includes(me.role);

    const enriched = users.map(u => {
      const myProg   = prog[u.id] || {};
      const completed = Object.values(myProg).filter(p => p.quizPassed).length;
      const lp       = IRA_DATA.getLevelForXP(u.xp || 0);
      const sp       = typeof SALES_DATA !== 'undefined' ? this.getSalesRecord(u) : null;
      return { ...u, completed, level: lp, sp };
    });

    // Tab 1: Sales performers (by real rankSales if available, else XP)
    const byPerf = typeof SALES_DATA !== 'undefined'
      ? [...enriched].filter(u => u.sp).sort((a,b) => a.sp.rankSales - b.sp.rankSales)
      : [...enriched].sort((a,b) => (b.xp||0) - (a.xp||0));

    // Tab 2: Learners (by modules completed then XP)
    const byLearning = [...enriched].sort((a,b) => b.completed !== a.completed ? b.completed - a.completed : (b.xp||0) - (a.xp||0));

    // Tab 3: Stores from SALES_DATA
    const storeRows = typeof SALES_DATA !== 'undefined'
      ? [...SALES_DATA.stores].sort((a,b) => a.rank - b.rank)
      : [];

    el.innerHTML = `<div class="fade-in">
      <div class="leaderboard-tabs" id="lb-tabs">
        <button class="tab-btn active" onclick="APP.switchLBTab('perf',this)">🏆 Top Performers</button>
        <button class="tab-btn" onclick="APP.switchLBTab('learning',this)">📚 Top Learners</button>
        <button class="tab-btn" onclick="APP.switchLBTab('store',this)">🏪 Store Rankings</button>
      </div>

      <!-- TOP PERFORMERS (sales rank) -->
      <div id="lb-content-perf">
        <div class="text-xs muted mb-1" style="margin-top:0.5rem">Ranked by overall sales performance · ${isStylist ? 'No absolute sales values shown' : 'ATV in ₹ — manager view'}</div>
        <table class="leaderboard-table">
          <thead><tr><th>#</th><th>Name</th><th>Store</th><th>Level</th><th>ATV Rank</th><th>UPT Rank</th><th style="width:120px">Sales Pctile</th></tr></thead>
          <tbody>
            ${byPerf.map((u,i) => {
              const sp = u.sp;
              const atvDisplay = sp ? (isStylist ? `#${sp.rankATV}` : `₹${Math.round(sp.atv).toLocaleString('en-IN')}`) : '—';
              const pctile = sp ? Math.round(sp.salesPctile) : 0;
              return `<tr class="lb-row ${u.id===me.id?'lb-me':''}">
                <td><div class="lb-rank ${i<3?'r'+(i+1):''}">${['🥇','🥈','🥉'][i]||('#'+(i+1))}</div></td>
                <td><div class="lb-name">${u.name}${u.id===me.id?' 👈':''}</div><div class="lb-store">${u.storeId||'—'}</div></td>
                <td><div class="lb-store">${u.storeId||'—'}</div></td>
                <td>${u.level?.badge||''} ${u.level?.name||''}</td>
                <td>${atvDisplay}</td>
                <td>${sp ? `#${sp.rankUPT}` : '—'}</td>
                <td class="lb-bar-cell">
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="lb-bar" style="flex:1"><div class="lb-bar-fill" style="width:${pctile}%"></div></div>
                    <span class="text-xs">${pctile}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- TOP LEARNERS -->
      <div id="lb-content-learning" class="hidden">
        <table class="leaderboard-table">
          <thead><tr><th>#</th><th>Name</th><th>Store</th><th>Level</th><th>Modules</th><th>XP</th></tr></thead>
          <tbody>
            ${byLearning.map((u,i)=>`<tr class="lb-row ${u.id===me.id?'lb-me':''}">
              <td><div class="lb-rank ${i<3?'r'+(i+1):''}">${['🥇','🥈','🥉'][i]||('#'+(i+1))}</div></td>
              <td><div class="lb-name">${u.name}${u.id===me.id?' 👈':''}</div></td>
              <td><div class="lb-store">${u.storeId||'—'}</div></td>
              <td>${u.level?.badge||''} ${u.level?.name||''}</td>
              <td><div class="lb-score">${u.completed} modules</div></td>
              <td>${u.xp||0} XP</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- STORE RANKINGS -->
      <div id="lb-content-store" class="hidden">
        <div class="text-sm muted mb-2">Store rankings from real sales data · All values shown as ranks and percentages only</div>
        ${storeRows.length > 0 ? `
        <table class="leaderboard-table">
          <thead><tr><th>Rank</th><th>Store</th><th>Staff</th><th>ATV Rank</th><th>UPT Rank</th><th>Cust Rank</th><th style="width:140px">Bills Trend</th></tr></thead>
          <tbody>
            ${storeRows.map((s,i) => {
              const n = SALES_DATA.stores.length;
              const atvPctile = Math.round((n - s.rank) / Math.max(n-1,1) * 100);
              return `<tr class="lb-row ${me.storeId===s.name?'lb-me':''}">
                <td><div class="lb-rank ${i<3?'r'+(i+1):''}">${['🥇','🥈','🥉'][i]||('#'+(i+1))}</div></td>
                <td><div class="lb-name">${s.name}${me.storeId===s.name?' 👈':''}</div></td>
                <td>${s.spCount} staff</td>
                <td>#${s.rank} of ${n}</td>
                <td>#${s.rank} of ${n}</td>
                <td>#${s.rank} of ${n}</td>
                <td class="lb-bar-cell">
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="lb-bar" style="flex:1"><div class="lb-bar-fill" style="width:${atvPctile}%"></div></div>
                    <span class="text-xs">${atvPctile}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : '<div class="card muted" style="text-align:center;padding:2rem">Store data not available</div>'}
      </div>
    </div>`;
  },

  switchLBTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['perf','learning','store'].forEach(t => {
      const el = document.getElementById('lb-content-' + t);
      if (el) el.classList.toggle('hidden', t !== tab);
    });
  },

  // ── AI COACH ─────────────────────────────────────────────
  renderAICoach(el) {
    const u = this.getUser();
    const sp = this.getSalesRecord(u);
    const prog = this.storage.get('progress', {});
    const insights = this.getPersonalizedInsights(u, sp, prog);
    const completeMission = () => this.completeMission('daily_coach', 20);

    el.innerHTML = `<div class="fade-in" style="max-width:800px;margin:0 auto">

      <!-- Personalized Daily Insights -->
      ${insights.length > 0 ? `
      <div class="section-header"><h3>🎯 Today's Personalized Coaching</h3><span class="muted text-xs">Based on your performance data</span></div>
      ${insights.map(ins=>`<div class="coach-insight">
        <div class="coach-insight-header">${ins.icon} ${ins.title}</div>
        <div class="coach-insight-body">${ins.body}</div>
        <div class="coach-insight-action">→ ${ins.action}</div>
      </div>`).join('')}
      <hr class="divider">` : ''}

      <div class="section-header"><h3>🤖 Ask AI Coach</h3></div>
      <div class="coach-layout">
        <div class="coach-messages" id="coach-msgs">
          <div class="msg msg-ai">${IRA_DATA.aiCoachKB.greeting}</div>
        </div>
        <div>
          <div class="quick-questions mb-1">
            ${['How do I measure bra size?','Best bra for daily office?','How to cross-sell?','Handle price objection','Recommend for gym','Triumph vs Amante?','How to improve my ATV?','What is sister sizing?'].map(q=>
              `<button class="quick-q" onclick="APP.askCoach('${q}')">${q}</button>`).join('')}
          </div>
          <div class="coach-input-row">
            <input class="coach-input" id="coach-input" placeholder="Ask me anything about products, selling, fitting..." onkeydown="if(event.key==='Enter'){APP.sendCoach();${insights.length?'':''}}" >
            <button class="btn btn-gold" onclick="APP.sendCoach()">Ask →</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  getPersonalizedInsights(u, sp, prog) {
    const insights = [];
    const myProg = (prog || {})[u.id] || {};
    const completedCount = Object.values(myProg).filter(p => p.quizPassed).length;
    const totalModules = IRA_DATA.brands.length + IRA_DATA.categories.length + (IRA_DATA.sellingModules||[]).length;
    const streak = this.getStreak(u);

    if (sp) {
      // ATV coaching
      if (sp.atvPctile < 50) {
        insights.push({
          icon: '🎫',
          title: 'Boost Your Average Ticket Value',
          body: `Your ATV is in the bottom ${Math.round(100-sp.atvPctile)}% of stylists. The store average is likely higher. Try this: Before every billing, say "Would you like a matching panty to complete the set?" — this alone adds ₹300–500 per transaction.`,
          action: `Target: add one cross-sell item per customer today. Even 2 success = meaningful ATV lift.`
        });
      } else if (sp.atvPctile >= 80) {
        insights.push({
          icon: '🏆',
          title: 'Maintain Your ATV Leadership',
          body: `You're in the top ${Math.round(100-sp.atvPctile)+1}% for Avg Ticket Value — excellent! Your upselling and cross-selling skills are paying off. Now focus on UPT to make every bill even stronger.`,
          action: `Aim for 3+ items per bill. Suggest accessories (bralette, cami) with every lingerie purchase.`
        });
      }

      // UPT coaching
      if (sp.uptPctile < 40) {
        insights.push({
          icon: '📦',
          title: 'Improve Units Per Transaction',
          body: `Your UPT of ${sp.upt.toFixed(1)} is below the store benchmark. Every bra sale is an opportunity: matching panties, backup size, or a sports bra for the gym. The "ABV" rule — Always Bring Value — means never letting a customer leave with just one item.`,
          action: `Next customer: show them 2 options minimum. "While I have your size, let me show you something else you'd love."`
        });
      }

      // Conversion coaching
      if (sp.rankSales > 5 && sp.bills < 10) {
        insights.push({
          icon: '🎯',
          title: 'Convert More Browsing to Buying',
          body: `With ${sp.bills} transactions, focus on greeting every customer within 30 seconds. Research shows a warm greeting within 30 seconds increases purchase likelihood by 40%. Use open questions: "What brings you in today?" not "Can I help you?"`,
          action: `Today: greet every customer by name after fitting. "Let me check your exact size — that's how we find your perfect fit."`
        });
      }

      // Top performer nudge
      if (sp.salesPctile >= 75) {
        insights.push({
          icon: '🌟',
          title: 'You\'re a Top Performer — Lead by Example',
          body: `You're in the top ${Math.round(100-sp.salesPctile)+1}% of all stylists. Your store looks to you. Share what's working — how you open the fitting room conversation, how you recommend the right size, how you close a cross-sell.`,
          action: `Mentor a colleague today. Teaching reinforces your own skills and earns recognition.`
        });
      }
    }

    // Learning coaching
    if (completedCount < 3) {
      insights.push({
        icon: '🎓',
        title: 'Unlock Your Product Knowledge Edge',
        body: `You've completed ${completedCount} of ${totalModules} training modules. Stylists with 5+ completions typically perform 20% better because they can speak confidently about product benefits, fabrics, and fit — which builds customer trust and reduces price objections.`,
        action: `Complete one brand module today. Start with Amante or Enamor — highest customer ask in most stores.`
      });
    }

    // Streak coaching
    if (streak.current === 0) {
      insights.push({
        icon: '🔥',
        title: 'Start Your Streak Today',
        body: `Daily engagement is the foundation of top performance. Logging in daily keeps your skills fresh, your missions active, and your XP multiplier growing. A 7-day streak gives you 1.5× XP on every mission.`,
        action: `Log in tomorrow to start your streak. Set a daily reminder at 9am.`
      });
    }

    return insights.slice(0, 3);
  },

  askCoach(question) {
    document.getElementById('coach-input').value = question;
    this.sendCoach();
  },

  sendCoach() {
    const input = document.getElementById('coach-input');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    const msgs = document.getElementById('coach-msgs');
    msgs.innerHTML += `<div class="msg msg-user">${question}</div>`;

    const answer = this.getCoachAnswer(question);
    setTimeout(() => {
      msgs.innerHTML += `<div class="msg msg-ai">${answer}</div>`;
      msgs.scrollTop = msgs.scrollHeight;
      this.addXP(this.state.user.id, 5, 'AI Coach Interaction');
    }, 600);
    msgs.scrollTop = msgs.scrollHeight;
  },

  getCoachAnswer(q) {
    const ql = q.toLowerCase();
    const kb = IRA_DATA.aiCoachKB.topics;

    if (ql.includes('measure') || ql.includes('size') || ql.includes('fit')) return kb['size help'] + ' ' + kb['bra fitting'];
    if (ql.includes('cross') || ql.includes('cross-sell') || ql.includes('crosssell')) return kb['cross selling'];
    if (ql.includes('price') || ql.includes('expensive') || ql.includes('cost') || ql.includes('objection')) return kb['objection price'];
    if (ql.includes('amante')) return kb['amante'];
    if (ql.includes('triumph')) return kb['triumph'];
    if (ql.includes('jockey')) return kb['jockey'];
    if (ql.includes('gym') || ql.includes('sport') || ql.includes('exercise') || ql.includes('workout')) return kb['sports bra'];
    if (ql.includes('upsell') || ql.includes('upgrade')) return kb['upsell'];
    if (ql.includes('greet') || ql.includes('new customer') || ql.includes('welcome')) return kb['new customer'];
    if (ql.includes('complaint') || ql.includes('return') || ql.includes('unhappy')) return kb['customer complaint'];
    if (ql.includes('office') || ql.includes('daily') || ql.includes('everyday')) return 'For daily office wear, recommend a T-shirt bra for smooth silhouette under formal tops. Amante Full Coverage or Enamor Everyday Cotton work best. Always suggest a matching panty — ask "Would you like a matching set today?"';
    if (ql.includes('triumph') && ql.includes('amante')) return 'Triumph: German premium, 130+ years heritage, ₹1,299–₹4,999, best for 30–55 year old with full support need. Amante: European-inspired Indian fit, ₹699–₹2,499, great for modern urban 25–40 wanting fashion + comfort. Triumph is the premium upsell when customer shows quality preference.';
    if (ql.includes('balconette') || ql.includes('bra type')) return 'T-shirt bra: smooth, daily office. Balconette: low necklines, occasion. Push-up: evening/party. Full coverage: heavy bust, back pain. Sports: gym. Strapless: backless outfits. Match bra type to outfit and occasion always.';
    if (ql.includes('panty') || ql.includes('panties')) return 'Brief: full coverage daily. Hipster: low-rise jeans. Bikini: versatile everyday. Thong: bodycon/fitted wear (no panty lines). Boyshort: casual + gym. High-waist: post-partum or tummy concern. ALWAYS offer matching panty with every bra purchase.';

    // Default rich response
    const suggestions = Object.keys(kb).slice(0, 3);
    return `Great question! For "${q}", let me share what I know:\n\nHere are relevant topics I can help with: ${suggestions.join(', ')}. Please ask more specifically — for example: "How do I recommend a bra for someone with back pain?" or "What's the Triumph brand story?" I'm trained on all 10 brands, 6 categories, and Intimissi's selling methodology. 💡`;
  },

  // ── JC CYCLE PERFORMANCE ─────────────────────────────────
  renderJCPerformance(el) {
    if (typeof JC_DATA === 'undefined') {
      el.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>JC Data not loaded</h3></div>';
      return;
    }
    const u = this.state.user;
    // Company-wide view: senior management only. Everyone else sees at most their own store.
    const seesAll = ['Super Admin','HR','Operations Head','Area Manager'].includes(u.role);
    const today = new Date().toISOString().slice(0,10);
    const currentCycle = JC_DATA.getCurrentCycle(today);
    const daily = JC_DATA.getLiveDaily();

    const displayStores = seesAll ? JC_DATA.stores : JC_DATA.getStoresForUser(u);
    if (displayStores.length === 0) {
      el.innerHTML = `<div class="empty-state fade-in">
        <div class="icon">🎯</div>
        <h3>No JC Target Assigned</h3>
        <p class="muted">You're not a key person for a JC cycle store this month.<br>
        Keep crushing your daily missions and leaderboard rank — key persons are picked every month.</p>
      </div>`;
      return;
    }

    // Grand total row (company-wide — senior management only)
    const grandAchieved = JC_DATA.stores.reduce((sum, s) => {
      const liveS = JC_DATA.getLiveStore(s.id);
      return sum + liveS.cycles.reduce((a, c) => a + c.achieved, 0);
    }, 0);
    const grandPct = JC_DATA.totalTarget > 0 ? grandAchieved / JC_DATA.totalTarget : 0;

    // Daily chart for the last 7 days — scoped to the stores this user may see
    const last7 = daily.slice(-7);
    const storeIds = displayStores.map(s => s.id);
    const dailyTotals = last7.map(d => ({ date: d.date, total: storeIds.reduce((s, id) => s + (d[id] || 0), 0) }));
    const maxDaily = Math.max(...dailyTotals.map(d => d.total), 1);
    const chartScope = seesAll ? 'All Stores' : displayStores.map(s => s.shortName).join(' + ');

    el.innerHTML = `<div class="fade-in">
      <!-- HEADER SUMMARY -->
      ${seesAll ? `<div class="jc-header-card">
        <div class="jc-month-label">${JC_DATA.month} · JC Cycle ${currentCycle} Active</div>
        <div class="jc-grand-row">
          <div>
            <div class="jc-grand-val">₹${Math.round(grandAchieved/1000)}K</div>
            <div class="jc-grand-label">Total Achieved (MTD)</div>
          </div>
          <div>
            <div class="jc-grand-val" style="color:${grandPct>=1?'#4caf50':grandPct>=0.5?'var(--gold)':'#ef5350'}">${Math.round(grandPct*100)}%</div>
            <div class="jc-grand-label">of ₹${Math.round(JC_DATA.totalTarget/100000)}L Month Target</div>
          </div>
          <div>
            <div class="jc-grand-val">Cycle ${currentCycle}</div>
            <div class="jc-grand-label">Current Period</div>
          </div>
        </div>
        <div class="jc-grand-bar-wrap">
          <div class="jc-grand-bar" style="width:${Math.min(100,Math.round(grandPct*100))}%"></div>
        </div>
      </div>` : `<div class="jc-header-card">
        <div class="jc-month-label">${JC_DATA.month} · JC Cycle ${currentCycle} Active</div>
        <div class="jc-grand-row">
          <div>
            <div class="jc-grand-val">🎯 My JC Mission</div>
            <div class="jc-grand-label">You are the key person for ${displayStores.map(s=>s.shortName).join(' & ')} — own it!</div>
          </div>
        </div>
      </div>`}

      <!-- DAILY TREND CHART -->
      <div class="section-header"><h3>📈 Daily Sales Trend</h3><span class="muted text-xs">Last ${last7.length} days · ${chartScope}</span></div>
      <div class="card jc-chart-wrap">
        <div class="jc-bar-chart">
          ${dailyTotals.map(d => {
            const pct = Math.round(d.total / maxDaily * 100);
            const dt = new Date(d.date + 'T00:00:00');
            const label = dt.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
            const isToday = d.date === today;
            return `<div class="jc-bar-col">
              <div class="jc-bar-body">
                <div class="jc-bar-amount" style="bottom:calc(${pct}% + 3px)">₹${Math.round(d.total/1000)}K</div>
                <div class="jc-bar-fill ${isToday?'today':''}" style="height:${pct}%"></div>
              </div>
              <div class="jc-bar-label ${isToday?'today':''}">${label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- STORE-WISE JC CYCLE CARDS -->
      <div class="section-header"><h3>🏪 ${seesAll ? 'Store Performance by JC Cycle' : 'My Store — JC Cycles'}</h3>
        ${['Super Admin','HR','Operations Head'].includes(u.role) ? `<button class="btn btn-outline btn-sm" onclick="APP.navigate('data-upload')">📤 Update Data</button>` : ''}
      </div>
      <div class="jc-store-grid">
        ${displayStores.map(s => {
          const liveS = JC_DATA.getLiveStore(s.id);
          const totalAchieved = liveS.cycles.reduce((a, c) => a + c.achieved, 0);
          const monthPct = liveS.monthTarget > 0 ? totalAchieved / liveS.monthTarget : 0;
          const activeCycle = liveS.cycles[currentCycle - 1];
          const activePct = activeCycle.target > 0 ? activeCycle.achieved / activeCycle.target : 0;
          const todayAmt = daily.find(d => d.date === today)?.[s.id] || 0;
          const reqPerDay = this.jcRequiredPerDay(activeCycle, today);
          const statusColor = activePct >= 1 ? '#4caf50' : activePct >= 0.75 ? '#ffd700' : activePct >= 0.5 ? '#ff9800' : '#ef5350';
          const statusLabel = activePct >= 1 ? '✅ On Target' : activePct >= 0.75 ? '📈 Good' : activePct >= 0.5 ? '⚡ Push Now' : '🚨 Behind';

          return `<div class="jc-store-card">
            <div class="jc-store-header">
              <div>
                <div class="jc-store-name">${s.shortName}</div>
                <div class="jc-store-kp">${s.keyPersons.map(kp=>kp.name).join(' & ')}</div>
              </div>
              <div class="jc-status-pill" style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40">${statusLabel}</div>
            </div>

            <!-- Active Cycle Progress -->
            <div class="jc-cycle-active">
              <div class="jc-cycle-label">Cycle ${currentCycle} · ${activeCycle.label}</div>
              <div class="jc-cycle-amounts">
                <span class="jc-achieved">₹${Math.round(activeCycle.achieved/1000)}K</span>
                <span class="jc-separator"> / </span>
                <span class="jc-target">₹${Math.round(activeCycle.target/1000)}K</span>
                <span class="jc-pct" style="color:${statusColor}">${Math.round(activePct*100)}%</span>
              </div>
              <div class="jc-prog-bar"><div class="jc-prog-fill" style="width:${Math.min(100,Math.round(activePct*100))}%;background:${statusColor}"></div></div>
              ${reqPerDay > 0 ? `<div class="jc-req-day muted text-xs">Need ₹${Math.round(reqPerDay/1000)}K/day to hit cycle target</div>` : '<div class="jc-req-day" style="color:#4caf50">Cycle target achieved! 🎉</div>'}
            </div>

            <!-- All 3 Cycles Mini -->
            <div class="jc-cycles-mini">
              ${liveS.cycles.map(c => {
                const p = c.target > 0 ? Math.min(1, c.achieved / c.target) : 0;
                const col = p >= 1 ? '#4caf50' : p >= 0.5 ? 'var(--gold)' : '#666';
                const active = c.n === currentCycle;
                return `<div class="jc-mini-cycle ${active?'active':''}">
                  <div class="jc-mini-label">C${c.n}</div>
                  <div class="jc-mini-ring" style="--p:${Math.round(p*100)};--col:${col}">
                    <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#333" stroke-width="3"/>
                    <circle cx="16" cy="16" r="12" fill="none" stroke="${col}" stroke-width="3"
                      stroke-dasharray="${Math.round(p*75.4)} 75.4" stroke-linecap="round" transform="rotate(-90 16 16)"/>
                    </svg>
                    <div class="jc-mini-pct">${Math.round(p*100)}%</div>
                  </div>
                  <div class="jc-mini-amt">₹${Math.round(c.achieved/1000)}K</div>
                </div>`;
              }).join('')}
              <div class="jc-mini-cycle">
                <div class="jc-mini-label">MTD</div>
                <div class="jc-mini-ring">
                  <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#333" stroke-width="3"/>
                  <circle cx="16" cy="16" r="12" fill="none" stroke="${monthPct>=1?'#4caf50':monthPct>=0.5?'var(--gold)':'#ef5350'}" stroke-width="3"
                    stroke-dasharray="${Math.round(Math.min(1,monthPct)*75.4)} 75.4" stroke-linecap="round" transform="rotate(-90 16 16)"/>
                  </svg>
                  <div class="jc-mini-pct">${Math.round(monthPct*100)}%</div>
                </div>
                <div class="jc-mini-amt" style="color:var(--gold)">Month</div>
              </div>
            </div>

            <!-- Incentive row: admins see all; key persons only ever reach their own store here -->
            ${`<div class="jc-incentive-row">
              <span class="text-xs muted">Incentive @ 100%: <strong>₹${s.incentive.toLocaleString('en-IN')}</strong></span>
              ${s.keyPersons.length > 1 ? `<span class="text-xs muted">(${s.keyPersons.map(kp=>kp.name+' '+kp.split+'%').join(' / ')})</span>` : ''}
              <span class="text-xs" style="color:${monthPct>=1?'#4caf50':'#888'}">${monthPct>=1?'✅ Earned!':'~₹'+Math.round(s.incentive*monthPct).toLocaleString('en-IN')+' projected'}</span>
            </div>`}
          </div>`;
        }).join('')}
      </div>

      <!-- DAILY TABLE -->
      <div class="section-header mt-2"><h3>📅 Day-wise Sales Log</h3></div>
      <div class="card" style="overflow-x:auto">
        <table class="data-table jc-daily-table">
          <thead><tr><th>Date</th>${displayStores.map(s=>`<th>${s.shortName}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>
            ${daily.slice().reverse().filter(d => d.date >= JC_DATA.monthCode + '-01').map(d => {
              const rowTotal = displayStores.reduce((sum, s) => sum + (d[s.id]||0), 0);
              const isToday = d.date === today;
              return `<tr class="${isToday?'today-row':''}">
                <td class="text-sm">${new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</td>
                ${displayStores.map(s => {
                  const amt = d[s.id] || 0;
                  return `<td class="${amt===0?'muted text-sm':''}">${amt>0?'₹'+amt.toLocaleString('en-IN'):'—'}</td>`;
                }).join('')}
                <td class="font-bold" style="color:var(--gold)">₹${rowTotal.toLocaleString('en-IN')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  // Calculate required daily amount to hit cycle target
  jcRequiredPerDay(cycle, today) {
    const endDate = new Date(cycle.end + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const daysLeft = Math.max(0, Math.ceil((endDate - todayDate) / 86400000) + 1);
    const remaining = cycle.target - cycle.achieved;
    if (remaining <= 0) return 0;
    return daysLeft > 0 ? remaining / daysLeft : remaining;
  },

  // ── DATA UPLOAD PAGE ──────────────────────────────────────
  renderDataUpload(el) {
    const role = this.state.user?.role;
    if (!['Super Admin', 'HR', 'Operations Head'].includes(role)) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><h3>Admin access only</h3><p class="muted">Ask your admin to upload sales data.</p></div>';
      return;
    }
    el.innerHTML = `<div class="fade-in">
      <div class="section-header">
        <h3>📤 Upload Sales Data</h3>
        <span class="muted text-xs">Upload daily store data or bill-level export from Tally</span>
      </div>

      <!-- Format Guide -->
      <div class="upload-guide-tabs">
        <button class="tab-btn active" onclick="APP.switchUploadTab('exec',this)">🧑‍💼 Executive Performance</button>
        <button class="tab-btn" onclick="APP.switchUploadTab('targets',this)">🎯 Monthly Targets</button>
        <button class="tab-btn" onclick="APP.switchUploadTab('daily',this)">📊 Daily Store Summary</button>
        <button class="tab-btn" onclick="APP.switchUploadTab('bills',this)">🧾 Bill Detail (Tally Export)</button>
      </div>

      <div id="upload-tab-targets" class="hidden">
        <div class="card upload-format-card">
          <div class="card-title">Expected CSV Format — Monthly Target Sheet (upload once per month)</div>
          <div class="upload-format-preview">Month,Store,KeyPerson,MonthTarget,Cycle1Target,Cycle2Target,Cycle3Target,Incentive
2026-08,001 Mahagun,Aradhya,700000,224000,231000,245000,3500
2026-08,004 Kamla Nagar,Sonali 50 / Shalu 50,950000,304000,313500,332500,4750
2026-08,007 Rohini,Preeti 67 / Priyanka 33,850000,272000,280500,297500,4250
2026-08,011 New Store,Ritika,400000,,,,2000</div>
          <div class="text-xs muted mt-1">Sets next month's store targets, JC cycle targets (1–10 / 11–20 / 21–end),
          key persons and incentives in one go. Cycle target columns are optional — left blank they are split from the
          month target by days. Multiple key persons: <strong>"Sonali 50 / Shalu 50"</strong> (numbers = % split, optional).
          New stores are added automatically. Upload before the month starts — the app switches over on the 1st on every device.
          Type key person names exactly as they appear in the app.</div>
        </div>
      </div>

      <div id="upload-tab-exec">
        <div class="card upload-format-card">
          <div class="card-title">Expected CSV Format — Executive Performance (recommended)</div>
          <div class="upload-format-preview">Date,Store,Executive,Amount,Bills,Qty
2026-07-15,001 Mahagun,Aradhya,24500,9,21
2026-07-15,001 Mahagun,Ritika,11200,5,9
2026-07-15,002 Burari,Khushi,8200,4,11
2026-07-16,006 V3s,Pinki,19800,7,18</div>
          <div class="text-xs muted mt-1">One row per executive per day. Bills and Qty columns are optional.
          This single file updates <strong>everything</strong>: executive leaderboards, store JC cycles, and the team roster —
          new names are added automatically as new joiners, and anyone missing from the file is marked Absent/Left.</div>
        </div>
      </div>

      <div id="upload-tab-daily" class="hidden">
        <div class="card upload-format-card">
          <div class="card-title">Expected CSV Format — Daily Store Summary</div>
          <div class="upload-format-preview">Date,Store,Amount
2026-07-08,001 Mahagun,24500
2026-07-08,002 Burari,8200
2026-07-08,004 Kamla Nagar,31000
2026-07-08,006 V3s,19800
2026-07-08,007 Rohini,28400
2026-07-08,008 Elan Epic,5100
2026-07-08,009 Pacific Av,12300
2026-07-08,010 Mukherjee Nagar,9700</div>
          <div class="text-xs muted mt-1">Store names must match exactly: 001 Mahagun · 002 Burari · 004 Kamla Nagar · 006 V3s · 007 Rohini · 008 Elan Epic · 009 Pacific Av · 010 Mukherjee Nagar</div>
        </div>
      </div>

      <div id="upload-tab-bills" class="hidden">
        <div class="card upload-format-card">
          <div class="card-title">Expected CSV Format — Tally Bill Export</div>
          <div class="upload-format-preview">Date,Vch Number,Customer,Bill Ref,Qty,Total Amount,Location,User
2026-07-08,2627/Mn/S/800,Priya,2627/Mn/S/26/800,3,2499,001 Mahagun,Mgsales
2026-07-08,2627/Roh/S/1220,Sneha,,2,1299,007 Rohini,Rohinisales</div>
          <div class="text-xs muted mt-1">Matches the Tally pivot export format. Location column is used to identify the store.</div>
        </div>
      </div>

      <!-- Upload Area -->
      <div class="card upload-drop-zone" id="upload-drop-zone">
        <div class="upload-icon">📂</div>
        <div class="upload-text">Drop your CSV file here or click to browse</div>
        <div class="muted text-xs">Supports .csv files · Max 5MB</div>
        <input type="file" id="upload-file-input" accept=".csv,.txt" style="display:none" onchange="APP.handleFileUpload(this)">
        <button class="btn btn-gold mt-2" onclick="document.getElementById('upload-file-input').click()">Choose File</button>
      </div>

      <!-- Preview Area (hidden until file loaded) -->
      <div id="upload-preview" class="hidden">
        <div class="section-header"><h3>📋 Preview — Parsed Data</h3><span id="upload-row-count" class="muted text-xs"></span></div>
        <div class="card" style="overflow-x:auto;max-height:400px;overflow-y:auto">
          <div id="upload-table-wrap"></div>
        </div>
        <div style="display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap">
          <button class="btn btn-gold" onclick="APP.confirmUpload()">✅ Confirm & Update Dashboard</button>
          <button class="btn btn-outline" onclick="APP.clearUpload()">✕ Cancel</button>
        </div>
      </div>

      <!-- Success message -->
      <div id="upload-success" class="hidden">
        <div class="card" style="border-left:4px solid #4caf50;margin-top:1rem">
          <div class="font-bold" style="color:#4caf50">✅ Data uploaded successfully!</div>
          <div class="text-sm muted mt-1" id="upload-success-msg"></div>
          <div style="margin-top:1rem;display:flex;gap:0.75rem;flex-wrap:wrap">
            <button class="btn btn-gold" onclick="APP.navigate('jc-performance')">View JC Tracker →</button>
            <button class="btn btn-outline" onclick="APP.navigate('live-store')">Live Scoreboard →</button>
            <button class="btn btn-ghost" onclick="APP.clearUpload()">Upload More</button>
          </div>
        </div>
      </div>

      <!-- Current Data Status -->
      <div class="section-header mt-2"><h3>📊 Current Data Status</h3></div>
      <div class="kpi-grid">
        <div class="card"><div class="card-title">Data Last Updated</div><div class="card-value text-lg">${localStorage.getItem('jc_updated_' + JC_DATA.monthCode) || JC_DATA.updatedAt}</div><div class="card-sub">Latest upload</div></div>
        <div class="card"><div class="card-title">Days With Data</div><div class="card-value">${JC_DATA.getLiveDaily().filter(d=>Object.values(d).slice(1).some(v=>v>0)).length}</div><div class="card-sub">of ${new Date().getDate()} days this month</div></div>
        <div class="card"><div class="card-title">Total Recorded</div><div class="card-value gold">₹${Math.round(JC_DATA.getLiveDaily().reduce((s,d)=>s+JC_DATA.stores.reduce((ss,st)=>ss+(d[st.id]||0),0),0)/1000)}K</div><div class="card-sub">Sales MTD</div></div>
      </div>

      <!-- Quick Manual Entry -->
      <div class="section-header mt-2"><h3>✏️ Quick Daily Entry</h3><span class="muted text-xs">Add today's numbers manually</span></div>
      <div class="card">
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">
          <div>
            <label class="text-xs muted">Date</label>
            <input type="date" id="manual-date" class="input-text" style="margin-top:0.25rem" value="${new Date().toISOString().slice(0,10)}">
          </div>
        </div>
        <div class="manual-entry-grid">
          ${JC_DATA.stores.map(s => `<div class="manual-entry-row">
            <label class="manual-store-label">${s.shortName}<br><span class="text-xs muted">${s.keyPersons.map(kp=>kp.name).join(' & ')}</span></label>
            <input type="number" id="manual-${s.id}" class="input-text manual-amount" placeholder="₹ Amount" min="0">
          </div>`).join('')}
        </div>
        <button class="btn btn-gold mt-2" onclick="APP.saveManualEntry()" style="width:100%">💾 Save Daily Entry</button>
      </div>
    </div>`;

    // Drop zone drag events
    const dz = document.getElementById('upload-drop-zone');
    if (dz) {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragging');
        const f = e.dataTransfer.files[0];
        if (f) this.processUploadedFile(f);
      });
    }
  },

  switchUploadTab(tab, btn) {
    document.querySelectorAll('.upload-guide-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['exec','targets','daily','bills'].forEach(t => {
      const el = document.getElementById('upload-tab-' + t);
      if (el) el.classList.toggle('hidden', t !== tab);
    });
  },

  handleFileUpload(input) {
    const f = input.files[0];
    if (f) this.processUploadedFile(f);
  },

  processUploadedFile(file) {
    if (!file.name.match(/\.(csv|txt)$/i)) { this.toast('Please upload a .csv file', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = this.parseCSV(text);
        this.showUploadPreview(parsed, text);
      } catch(err) {
        this.toast('Error reading file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('File must have a header row and at least one data row');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cells.length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
      rows.push(row);
    }
    return { headers, rows, format: this.detectCSVFormat(headers) };
  },

  detectCSVFormat(headers) {
    const h = headers.map(x => x.toLowerCase());
    const hn = h.map(x => x.replace(/[\s_]+/g, ''));
    if (hn.includes('monthtarget') || hn.includes('keyperson')) return 'targets';
    if (h.includes('executive') || h.includes('staff') || h.includes('salesperson') || h.includes('employee')) return 'exec';
    if (h.includes('location') || h.includes('user') || h.includes('vch number')) return 'bills';
    if (h.includes('store') && h.includes('amount')) return 'daily';
    if (h.includes('date') && h.length <= 4) return 'daily';
    return 'unknown';
  },

  showUploadPreview(parsed, rawText) {
    const preview = document.getElementById('upload-preview');
    const wrap = document.getElementById('upload-table-wrap');
    const countEl = document.getElementById('upload-row-count');
    if (!preview || !wrap) return;

    // Store parsed data for confirm step
    this._pendingUpload = parsed;

    const maxPreviewRows = 20;
    const rows = parsed.rows.slice(0, maxPreviewRows);

    wrap.innerHTML = `<table class="data-table">
      <thead><tr>${parsed.headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r=>`<tr>${parsed.headers.map(h=>`<td class="text-sm">${r[h]||'—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>${parsed.rows.length > maxPreviewRows ? `<div class="muted text-xs p-2">Showing first ${maxPreviewRows} of ${parsed.rows.length} rows</div>` : ''}`;

    if (countEl) countEl.textContent = `${parsed.rows.length} rows · Format: ${parsed.format}`;
    preview.classList.remove('hidden');
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Accept 2026-07-15, 15-07-2026 and 15/07/2026 (day-first, Indian exports)
  normalizeDate(raw) {
    const s = (raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return '';
  },

  // Accept 2026-08, 08-2026, 08/2026, "Aug 2026", "August 2026"
  normalizeMonth(raw) {
    const s = (raw || '').trim();
    let m = s.match(/^(\d{4})[\/-](\d{1,2})$/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0');
    m = s.match(/^(\d{1,2})[\/-](\d{4})$/);
    if (m) return m[2] + '-' + m[1].padStart(2, '0');
    const d = new Date('1 ' + s);
    if (!isNaN(d)) return d.toISOString().slice(0, 7);
    return '';
  },

  confirmUpload() {
    const parsed = this._pendingUpload;
    if (!parsed) return;

    let updatedDays = 0, updatedStores = 0;

    if (parsed.format === 'targets') {
      // Format: Month, Store, KeyPerson, MonthTarget [, Cycle1Target, Cycle2Target, Cycle3Target, Incentive]
      const norm = r => {
        const o = {};
        Object.keys(r).forEach(k => { o[k.toLowerCase().replace(/[\s_]+/g, '')] = r[k]; });
        return o;
      };
      const num = v => parseInt(String(v || '0').replace(/[^0-9]/g, '')) || 0;

      let monthCode = '';
      const stores = [];
      let skipped = 0;
      parsed.rows.forEach(raw => {
        const r = norm(raw);
        const mc = this.normalizeMonth(r['month']) || monthCode;
        const storeName = (r['store'] || '').trim();
        const target = num(r['monthtarget'] || r['target']);
        if (!mc || !storeName || !target) { skipped++; return; }
        monthCode = mc;

        // Key persons: "Sonali 50 / Shalu 50" or "Aradhya" or "Preeti & Vandana"
        const kpRaw = (r['keyperson'] || r['keypersons'] || '').trim();
        const kpParts = kpRaw.split(/[\/&+,]/).map(x => x.trim()).filter(Boolean);
        const keyPersons = kpParts.map(part => {
          const m = part.match(/^(.*?)\s+(\d{1,3})\s*%?$/);
          const name = (m ? m[1] : part).trim();
          return { name,
                   user: name.toLowerCase().replace(/\s+/g, '.'),
                   split: m ? parseInt(m[2]) : Math.round(100 / kpParts.length) };
        });

        // Store id from the leading store number ("011 New Store" -> "011")
        const idMatch = storeName.match(/^(\d{2,4})\b/);
        const id = idMatch ? idMatch[1] : storeName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8);
        const shortName = storeName.replace(/^\d+\s*/, '') || storeName;

        // Cycle targets: use given values or split the month target by days
        const y = parseInt(monthCode.slice(0, 4)), mo = parseInt(monthCode.slice(5, 7));
        const dim = new Date(y, mo, 0).getDate();
        let c1 = num(r['cycle1target'] || r['cycle1']);
        let c2 = num(r['cycle2target'] || r['cycle2']);
        let c3 = num(r['cycle3target'] || r['cycle3']);
        if (!c1 && !c2 && !c3) {
          c1 = Math.round(target * 10 / dim);
          c2 = Math.round(target * 10 / dim);
          c3 = target - c1 - c2;
        }
        const pad = n => String(n).padStart(2, '0');
        stores.push({
          id, code: shortName.slice(0, 3), name: storeName, shortName,
          keyPersons, monthTarget: target, incentive: num(r['incentive']),
          userCode: '',
          cycles: [
            { n: 1, label: `${new Date(y, mo-1, 1).toLocaleString('en-IN',{month:'short'})} 1–10`,  start: `${monthCode}-01`, end: `${monthCode}-10`, target: c1, achieved: 0 },
            { n: 2, label: `${new Date(y, mo-1, 1).toLocaleString('en-IN',{month:'short'})} 11–20`, start: `${monthCode}-11`, end: `${monthCode}-20`, target: c2, achieved: 0 },
            { n: 3, label: `${new Date(y, mo-1, 1).toLocaleString('en-IN',{month:'short'})} 21–${dim}`, start: `${monthCode}-21`, end: `${monthCode}-${pad(dim)}`, target: c3, achieved: 0 }
          ]
        });
      });

      if (!monthCode || !stores.length) {
        this.toast('No valid target rows found — check the Month, Store and MonthTarget columns', 'error');
        return;
      }

      const blob = {
        monthCode,
        label: JC_DATA.monthLabel(monthCode),
        totalTarget: stores.reduce((s, x) => s + x.monthTarget, 0),
        stores,
        updatedAt: new Date().toISOString().slice(0, 10)
      };
      localStorage.setItem('jc_targets_' + monthCode, JSON.stringify(blob));
      const tPatch = {};
      tPatch[monthCode] = blob;
      this.syncConfig({ jc_targets: tPatch });

      // Apply now if this sheet is for the current (or an already-active) month
      const nowMonth = new Date().toISOString().slice(0, 7);
      const appliedNow = monthCode <= nowMonth;
      if (appliedNow) {
        this.applyMonthlyTargets();
        this.buildNav(); // key persons may have changed
      }

      this._pendingUpload = null;
      const success = document.getElementById('upload-success');
      const msg = document.getElementById('upload-success-msg');
      const preview = document.getElementById('upload-preview');
      if (preview) preview.classList.add('hidden');
      if (success) success.classList.remove('hidden');
      if (msg) msg.innerHTML =
        `<strong>${blob.label}</strong> target sheet saved · ${stores.length} stores · ` +
        `Total ₹${(blob.totalTarget / 100000).toFixed(1)}L` +
        (skipped ? ` · ${skipped} rows skipped` : '') +
        `<br>Key persons: ${stores.map(s => s.keyPersons.map(k => k.name).join(' & ') + ' (' + s.shortName + ')').join(', ')}` +
        (appliedNow
          ? `<br>✅ Applied now — all dashboards are on ${blob.label}`
          : `<br>📅 Will activate automatically on 1 ${blob.label} on every device`);
      this.toast(appliedNow ? blob.label + ' targets applied! 🎯' : blob.label + ' targets scheduled 📅', 'success');
      return;
    }

    if (parsed.format === 'exec') {
      // Format: Date, Store, Executive, Amount [, Bills, Qty]
      const month = JC_DATA.monthCode;
      let blob;
      try { blob = JSON.parse(localStorage.getItem('exec_perf_' + month)) || {}; } catch(e) { blob = {}; }
      if (!blob.persons) blob.persons = {};

      const prevRoster = new Set(this.storage.get('users', [])
        .filter(u => ['Retail Stylist','Senior Stylist'].includes(u.role) && u.status !== 'left')
        .map(u => u.id));

      let rows = 0, skipped = 0;
      const touchedDates = new Set();
      parsed.rows.forEach(r => {
        const date = this.normalizeDate(r['Date'] || r['date']);
        const name = (r['Executive'] || r['executive'] || r['Staff'] || r['Salesperson'] || r['Employee'] || '').trim();
        let store = (r['Store'] || r['store'] || r['Location'] || '').trim();
        const amount = parseInt(String(r['Amount'] || r['amount'] || '0').replace(/[^0-9]/g, '')) || 0;
        const bills  = parseInt(String(r['Bills']  || r['bills']  || '0').replace(/[^0-9]/g, '')) || 0;
        const qty    = parseInt(String(r['Qty']    || r['qty']    || '0').replace(/[^0-9]/g, '')) || 0;
        if (!date || !name) { skipped++; return; }
        if (date.slice(0, 7) !== month) { skipped++; return; } // only current month
        const jcStore = JC_DATA.stores.find(s =>
          s.name.toLowerCase() === store.toLowerCase() ||
          s.shortName.toLowerCase() === store.toLowerCase() ||
          s.id === store.slice(0, 3));
        if (jcStore) store = jcStore.name;
        const slug = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.\-]/g, '');
        if (!blob.persons[slug]) blob.persons[slug] = { name, store, daily: {} };
        const p = blob.persons[slug];
        p.name = name;
        if (store) p.store = store;
        p.daily[date] = { a: amount, b: bills, q: qty };
        touchedDates.add(date);
        rows++;
      });

      // Person month totals
      Object.values(blob.persons).forEach(p => {
        p.sales = 0; p.bills = 0; p.qty = 0;
        Object.values(p.daily || {}).forEach(d => { p.sales += d.a || 0; p.bills += d.b || 0; p.qty += d.q || 0; });
      });
      blob.updatedAt = new Date().toISOString().slice(0, 10);
      localStorage.setItem('exec_perf_' + month, JSON.stringify(blob));
      const execPatch = {};
      execPatch[month] = blob;
      this.syncConfig({ exec_perf: execPatch });

      // Derive store-level daily totals for the uploaded dates → feeds JC cycles
      if (touchedDates.size > 0) {
        const existing = JC_DATA.getLiveDaily();
        const map = {};
        existing.forEach(d => { map[d.date] = { ...d }; });
        touchedDates.forEach(date => {
          if (!map[date]) map[date] = { date };
          JC_DATA.stores.forEach(s => {
            let sum = 0, seen = false;
            Object.values(blob.persons).forEach(p => {
              const d = (p.daily || {})[date];
              if (d && p.store === s.name) { sum += d.a || 0; seen = true; }
            });
            if (seen) map[date][s.id] = sum;
          });
        });
        const newDaily = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem('jc_daily_' + month, JSON.stringify(newDaily));
        this.recalcJCCycles(newDaily);
      }

      // Roster: add new joiners, mark missing as left
      this.applyExecPerf();
      this.syncSalesPersonUsers();
      this.markRosterStatus();

      const usersNow = this.storage.get('users', []);
      const stylistsNow = usersNow.filter(u => ['Retail Stylist','Senior Stylist'].includes(u.role));
      const joiners = stylistsNow.filter(u => u.status !== 'left' && !prevRoster.has(u.id)).map(u => u.name);
      const left    = stylistsNow.filter(u => u.status === 'left').map(u => u.name);

      this._pendingUpload = null;
      const success = document.getElementById('upload-success');
      const msg = document.getElementById('upload-success-msg');
      const preview = document.getElementById('upload-preview');
      if (preview) preview.classList.add('hidden');
      if (success) success.classList.remove('hidden');
      if (msg) msg.innerHTML =
        `${rows} rows across ${touchedDates.size} day${touchedDates.size !== 1 ? 's' : ''} · ` +
        `${Object.keys(blob.persons).length} executives on roster` +
        (skipped ? ` · ${skipped} rows skipped` : '') +
        (joiners.length ? `<br>🆕 New joiners added: ${joiners.join(', ')}` : '') +
        (left.length ? `<br>👋 Marked Absent/Left: ${left.join(', ')}` : '');
      this.toast('Executive performance updated! 🚀', 'success');
      this.checkJCBadges();
      return;
    }

    if (parsed.format === 'daily') {
      // Format: Date, Store, Amount
      const dailyMap = {};
      parsed.rows.forEach(r => {
        const date = (r['Date'] || r['date'] || '').trim().slice(0,10);
        let store = (r['Store'] || r['store'] || r['Location'] || '').trim();
        const amount = parseInt((r['Amount'] || r['amount'] || '0').replace(/[^0-9]/g,'')) || 0;
        if (!date || !store) return;
        // Match store to JC_DATA store ID
        const matchedStore = JC_DATA.stores.find(s => s.name.toLowerCase() === store.toLowerCase() || s.shortName.toLowerCase() === store.toLowerCase() || s.id === store.slice(0,3));
        if (!matchedStore) return;
        if (!dailyMap[date]) dailyMap[date] = {};
        dailyMap[date][matchedStore.id] = (dailyMap[date][matchedStore.id] || 0) + amount;
        updatedStores++;
      });
      // Merge into existing daily data
      const existing = JC_DATA.getLiveDaily();
      const existingMap = {};
      existing.forEach(d => { existingMap[d.date] = { ...d }; });
      Object.keys(dailyMap).forEach(date => {
        if (!existingMap[date]) existingMap[date] = { date };
        Object.assign(existingMap[date], dailyMap[date]);
        updatedDays++;
      });
      const newDaily = Object.values(existingMap).sort((a,b) => a.date.localeCompare(b.date));
      localStorage.setItem('jc_daily_' + JC_DATA.monthCode, JSON.stringify(newDaily));

      // Recalculate cycle achievements
      this.recalcJCCycles(newDaily);

    } else if (parsed.format === 'bills') {
      // Format: Date, Vch Number, Customer, Bill Ref, Qty, Total Amount, Location, User
      const dailyMap = {};
      parsed.rows.forEach(r => {
        const date = (r['Date'] || r['date'] || '').trim().slice(0,10);
        const store = (r['Location'] || r['location'] || '').trim();
        const amount = parseInt((r['Total Amount'] || r['Amount'] || '0').replace(/[^0-9]/g,'')) || 0;
        if (!date || !store || amount <= 0) return;
        const matchedStore = JC_DATA.stores.find(s => s.name.toLowerCase() === store.toLowerCase() || store.startsWith(s.id));
        if (!matchedStore) return;
        if (!dailyMap[date]) dailyMap[date] = {};
        dailyMap[date][matchedStore.id] = (dailyMap[date][matchedStore.id] || 0) + amount;
        updatedStores++;
      });
      const existing = JC_DATA.getLiveDaily();
      const existingMap = {};
      existing.forEach(d => { existingMap[d.date] = { ...d }; });
      Object.keys(dailyMap).forEach(date => {
        if (!existingMap[date]) existingMap[date] = { date };
        Object.assign(existingMap[date], dailyMap[date]);
        updatedDays++;
      });
      const newDaily = Object.values(existingMap).sort((a,b) => a.date.localeCompare(b.date));
      localStorage.setItem('jc_daily_' + JC_DATA.monthCode, JSON.stringify(newDaily));
      this.recalcJCCycles(newDaily);
    }

    this._pendingUpload = null;
    const success = document.getElementById('upload-success');
    const msg = document.getElementById('upload-success-msg');
    const preview = document.getElementById('upload-preview');
    if (preview) preview.classList.add('hidden');
    if (success) success.classList.remove('hidden');
    if (msg) msg.textContent = `Updated ${updatedDays} day${updatedDays!==1?'s':''} · ${updatedStores} store-day records processed`;
    this.toast('Sales data updated! Dashboard refreshed.', 'success');
    this.checkJCBadges();
  },

  recalcJCCycles(dailyData) {
    const cycleAchieved = {};
    JC_DATA.stores.forEach(s => { cycleAchieved[s.id] = [0, 0, 0]; });
    dailyData.forEach(d => {
      const dayNum = parseInt(d.date.slice(8,10));
      const cycleIdx = dayNum <= 10 ? 0 : dayNum <= 20 ? 1 : 2;
      JC_DATA.stores.forEach(s => {
        cycleAchieved[s.id][cycleIdx] += (d[s.id] || 0);
      });
    });
    localStorage.setItem('jc_cycles_' + JC_DATA.monthCode, JSON.stringify(cycleAchieved));
    const todayStr = new Date().toISOString().slice(0,10);
    localStorage.setItem('jc_updated_' + JC_DATA.monthCode, todayStr);
    // Push to cloud so every device (key persons' phones) gets the update on next load
    const patch = {};
    patch[JC_DATA.monthCode] = { daily: dailyData, cycles: cycleAchieved, updatedAt: todayStr };
    this.syncConfig({ jc_data: patch });
  },

  saveManualEntry() {
    const date = document.getElementById('manual-date')?.value;
    if (!date) { this.toast('Please select a date', 'error'); return; }
    const entry = { date };
    let hasData = false;
    JC_DATA.stores.forEach(s => {
      const val = parseInt(document.getElementById('manual-' + s.id)?.value || '0') || 0;
      entry[s.id] = val;
      if (val > 0) hasData = true;
    });
    if (!hasData) { this.toast('Please enter at least one store amount', 'error'); return; }

    const existing = JC_DATA.getLiveDaily();
    const idx = existing.findIndex(d => d.date === date);
    if (idx >= 0) Object.assign(existing[idx], entry);
    else existing.push(entry);
    existing.sort((a,b) => a.date.localeCompare(b.date));
    localStorage.setItem('jc_daily_' + JC_DATA.monthCode, JSON.stringify(existing));
    this.recalcJCCycles(existing);
    this.toast('Daily entry saved! ✅', 'success');
    this.navigate('jc-performance');
  },

  clearUpload() {
    this._pendingUpload = null;
    const preview = document.getElementById('upload-preview');
    const success = document.getElementById('upload-success');
    const fileInput = document.getElementById('upload-file-input');
    if (preview) preview.classList.add('hidden');
    if (success) success.classList.add('hidden');
    if (fileInput) fileInput.value = '';
  },

  checkJCBadges() {
    const u = this.getUser();
    const storeId = JC_DATA.getStoresForUser(u)[0]?.id;
    if (!storeId) return;
    const liveS = JC_DATA.getLiveStore(storeId);
    const earnedIds = [];
    liveS.cycles.forEach(c => {
      const p = c.target > 0 ? c.achieved / c.target : 0;
      if (p >= 0.5)  earnedIds.push('jc1_50');
      if (p >= 0.75) earnedIds.push('jc1_75');
      if (p >= 1.0)  earnedIds.push('jc1_100');
    });
    const allHit = liveS.cycles.every(c => c.target > 0 && c.achieved >= c.target);
    if (allHit) earnedIds.push('jc_3x');
    const monthPct = liveS.monthTarget > 0 ? liveS.cycles.reduce((a,c)=>a+c.achieved,0)/liveS.monthTarget : 0;
    if (monthPct >= 1) earnedIds.push('incentive_win');
    const prev = this.storage.get('earned_jc_badges_' + u.id) || [];
    const prevSet = new Set(prev);
    earnedIds.forEach(id => {
      if (!prevSet.has(id)) {
        const badge = IRA_DATA.badges.find(b => b.id === id);
        if (badge) this.toast(`${badge.icon} JC Badge: ${badge.name}!`, 'success');
      }
    });
    this.storage.set('earned_jc_badges_' + u.id, [...new Set([...prev, ...earnedIds])]);
  },

  // ── MANAGER DASHBOARD ────────────────────────────────────
  renderManagerDashboard(el) {
    const users = this.activeUsers();
    const prog  = this.storage.get('progress', {});
    const u     = this.state.user;
    const isAdmin = ['Super Admin', 'HR', 'Operations Head'].includes(u.role);
    const teamUsers = isAdmin ? users : users.filter(x => x.storeId === u.storeId);
    const totalModules = IRA_DATA.brands.length + IRA_DATA.categories.length + IRA_DATA.sellingModules.length;

    const teamData = teamUsers.map(x => {
      const myProg   = prog[x.id] || {};
      const completed = Object.values(myProg).filter(p => p.quizPassed).length;
      const trainPct = Math.round((completed / totalModules) * 100);
      const lp       = IRA_DATA.getLevelForXP(x.xp || 0);
      const sp       = typeof SALES_DATA !== 'undefined' ? this.getSalesRecord(x) : null;
      return { ...x, completed, trainPct, levelInfo: lp, sp };
    });

    // Real store cards from SALES_DATA
    const storeList = typeof SALES_DATA !== 'undefined'
      ? (isAdmin ? SALES_DATA.stores : SALES_DATA.stores.filter(s => s.name === u.storeId))
      : [];
    const totalStores = storeList.length;

    // Build AI coaching recommendations for the manager
    const needsCoaching = teamData.filter(x => x.trainPct < 30 || (x.sp && x.sp.salesPctile < 30));
    const champions     = teamData.filter(x => x.sp && x.sp.salesPctile >= 75);
    const improving     = teamData.filter(x => x.sp && x.sp.salesPctile >= 40 && x.sp.salesPctile < 75);
    const promotionReady= teamData.filter(x => x.trainPct >= 70 && x.sp && x.sp.salesPctile >= 70 && (x.xp||0) >= 2000);

    el.innerHTML = `<div class="fade-in">

      <!-- MANAGER AI BRIEFING -->
      <div class="card card-gold mb-2">
        <div class="card-title">🤖 AI Manager Briefing — Today</div>
        <div class="text-sm" style="margin-top:0.5rem;line-height:1.8;color:#ddd">
          ${needsCoaching.length > 0 ? `⚠️ <strong>${needsCoaching.length} team member${needsCoaching.length>1?'s':''} need${needsCoaching.length===1?'s':''} coaching</strong> — low training or sales performance.<br>` : ''}
          ${champions.length > 0 ? `🏆 <strong>${champions.map(x=>x.name.split(' ')[0]).join(', ')}</strong> — deserves recognition today.<br>` : ''}
          ${promotionReady.length > 0 ? `⭐ <strong>${promotionReady[0].name}</strong> is promotion-ready — consider a conversation.<br>` : ''}
          ${needsCoaching.length === 0 && champions.length === 0 ? `✅ Team is on track. Focus on learning module completion this week.` : ''}
        </div>
      </div>

      <div class="kpi-grid mb-2">
        <div class="card"><div class="card-title">Team Members</div><div class="card-value">${teamData.length}</div></div>
        <div class="card"><div class="card-title">Avg Training</div><div class="card-value">${Math.round(teamData.reduce((s,x)=>s+x.trainPct,0)/Math.max(teamData.length,1))}%</div></div>
        <div class="card"><div class="card-title">Top Performers</div><div class="card-value gold">${champions.length}</div><div class="card-sub">Top 25% sales</div></div>
        <div class="card"><div class="card-title">Need Coaching</div><div class="card-value" style="color:#ef5350">${needsCoaching.length}</div><div class="card-sub">Low training/sales</div></div>
      </div>

      <!-- COACHING CARDS -->
      ${needsCoaching.length > 0 ? `
      <div class="section-header"><h3>⚠️ Needs Coaching</h3></div>
      <div class="coaching-grid">
        ${needsCoaching.map(x => {
          const issues = [];
          if (x.trainPct < 30) issues.push(`training at ${x.trainPct}%`);
          if (x.sp && x.sp.salesPctile < 30) issues.push(`sales in bottom ${Math.round(100-x.sp.salesPctile)}%`);
          return `<div class="coaching-card risk">
            <div class="coaching-tag red">⚠ Needs Coaching</div>
            <div class="coaching-name">${x.name}</div>
            <div class="coaching-store">${x.storeId || '—'}</div>
            <div class="coaching-action">Issues: ${issues.join(', ')}.<br>Suggested: 1-on-1 this week. Review product knowledge, observe one customer interaction, set a specific ATV target for next 7 days.</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${champions.length > 0 ? `
      <div class="section-header"><h3>🏆 Champions — Recognise Today</h3></div>
      <div class="coaching-grid">
        ${champions.map(x => `<div class="coaching-card champion">
          <div class="coaching-tag green">🏆 Champion</div>
          <div class="coaching-name">${x.name}</div>
          <div class="coaching-store">${x.storeId || '—'} · Sales Rank #${x.sp.rankSales}</div>
          <div class="coaching-action">ATV Rank #${x.sp.rankATV} · UPT ${x.sp.upt.toFixed(1)}<br>Suggested: Public recognition in today's briefing. Give applause on the Recognition Wall.</div>
        </div>`).join('')}
      </div>` : ''}

      ${promotionReady.length > 0 ? `
      <div class="section-header"><h3>⭐ Promotion Ready</h3></div>
      <div class="coaching-grid">
        ${promotionReady.map(x => `<div class="coaching-card ready">
          <div class="coaching-tag gold">⭐ Promotion Ready</div>
          <div class="coaching-name">${x.name}</div>
          <div class="coaching-store">${x.storeId || '—'} · ${x.levelInfo.badge} ${x.levelInfo.name}</div>
          <div class="coaching-action">${x.xp||0} XP · ${x.trainPct}% training · Top ${Math.round(100-x.sp.salesPctile)+1}% sales<br>Suggested: Career conversation. Discuss next role, responsibilities, and development plan.</div>
        </div>`).join('')}
      </div>` : ''}

      <!-- STORE PERFORMANCE (real data) -->
      <div class="section-header"><h3>🏪 Store Performance — Real KPIs</h3><span class="text-xs muted">ATV, UPT, Bills visible to managers only</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem;margin-bottom:2rem">
        ${storeList.sort((a,b) => a.rank - b.rank).map(s => {
          const pctile = Math.round((totalStores - s.rank) / Math.max(totalStores-1,1) * 100);
          return `<div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <div><strong>${s.name}</strong><div class="text-xs muted">${s.spCount} staff</div></div>
              <span class="badge-pill badge-gold">Rank #${s.rank} of ${totalStores}</span>
            </div>
            ${[
              ['ATV', '₹'+Math.round(s.atv).toLocaleString('en-IN'), pctile, '#c9a84c'],
              ['UPT', s.upt.toFixed(2), pctile, '#1565c0'],
              ['Bills', s.bills.toLocaleString('en-IN'), pctile, '#2e7d32'],
              ['Customers', s.custCount.toLocaleString('en-IN'), pctile, '#8e24aa'],
            ].map(([label,val,pct,color])=>
              `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
                <div style="width:90px;font-size:0.78rem;color:#aaa">${label}</div>
                <div style="font-size:0.85rem;font-weight:600;min-width:80px">${val}</div>
                <div class="skill-bar" style="flex:1"><div class="skill-fill" style="width:${pct}%;background:${color}"></div></div>
              </div>`).join('')}
          </div>`;
        }).join('')}
      </div>

      <!-- TEAM TABLE -->
      <div class="section-header"><h3>👥 Team Training + Sales</h3></div>
      <div class="card" style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Store</th><th>Level</th><th>Training</th><th>Bills</th><th>ATV</th><th>Sales Rank</th><th>Status</th></tr></thead>
          <tbody>
            ${teamData.sort((a,b)=>b.trainPct-a.trainPct).map(x=>`<tr>
              <td>${x.name}</td>
              <td class="text-sm muted">${x.storeId||'—'}</td>
              <td>${x.levelInfo.badge} ${x.levelInfo.name}</td>
              <td>
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <div class="progress-bar" style="width:70px"><div class="progress-bar-fill" style="width:${x.trainPct}%;background:${x.trainPct>=70?'#2e7d32':x.trainPct>=40?'#c9a84c':'#c62828'}"></div></div>
                  <span class="text-sm">${x.trainPct}%</span>
                </div>
              </td>
              <td>${x.sp ? x.sp.bills : '—'}</td>
              <td>${x.sp ? '₹'+Math.round(x.sp.atv).toLocaleString('en-IN') : '—'}</td>
              <td>${x.sp ? '#'+x.sp.rankSales : '—'}</td>
              <td><span class="badge-pill badge-${x.trainPct>=70?'green':x.trainPct>=40?'gold':'red'}">${x.trainPct>=70?'On Track':x.trainPct>=40?'In Progress':'Needs Help'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  // ── STORE ANALYTICS ──────────────────────────────────────
  renderStoreAnalytics(el) {
    const u = this.state.user;
    const isStylist = ['Retail Stylist','Senior Stylist'].includes(u.role);
    const stores = typeof SALES_DATA !== 'undefined' ? SALES_DATA.stores : [];
    const n = stores.length;

    el.innerHTML = `<div class="fade-in">
      <div class="text-sm muted mb-2">
        ${isStylist ? 'Rankings and percentiles shown — no absolute sales data per data policy.' : 'Full KPI view — manager access.'}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.25rem">
        ${stores.length === 0 ? '<div class="card muted text-center" style="padding:2rem">Sales data not loaded</div>' :
          stores.sort((a,b) => a.rank - b.rank).map(s => {
            const pctile = Math.round((n - s.rank) / Math.max(n-1,1) * 100);
            const isMyStore = u.storeId === s.name;
            const metrics = isStylist ? [
              { label:'Sales Rank',   val: `#${s.rank} of ${n}`, barPct: pctile,  color:'#c9a84c' },
              { label:'ATV Rank',     val: `#${s.rank} of ${n}`, barPct: pctile,  color:'#1565c0' },
              { label:'UPT Rank',     val: `#${s.rank} of ${n}`, barPct: pctile,  color:'#2e7d32' },
              { label:'Cust Rank',    val: `#${s.rank} of ${n}`, barPct: pctile,  color:'#8e24aa' },
            ] : [
              { label:'ATV',          val: `₹${Math.round(s.atv).toLocaleString('en-IN')}`, barPct: pctile, color:'#c9a84c' },
              { label:'UPT',          val: s.upt.toFixed(2),                                  barPct: pctile, color:'#1565c0' },
              { label:'Bills',        val: s.bills.toLocaleString('en-IN'),                   barPct: pctile, color:'#2e7d32' },
              { label:'Customers',    val: s.custCount.toLocaleString('en-IN'),               barPct: pctile, color:'#8e24aa' },
              { label:'Staff',        val: s.spCount,                                          barPct: Math.round(s.spCount/Math.max(...stores.map(x=>x.spCount))*100), color:'#e65100' },
            ];
            return `<div class="card${isMyStore?' card-gold':''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                <div><strong>${s.name}</strong>${isMyStore?'<span class="badge-pill badge-gold" style="margin-left:0.5rem">My Store</span>':''}</div>
                <span class="badge-pill badge-${s.rank<=2?'gold':s.rank<=4?'blue':'ghost'}">Rank #${s.rank}</span>
              </div>
              ${metrics.map(m=>`<div class="skill-row" style="margin-bottom:0.6rem">
                <div class="skill-name" style="font-size:0.78rem;width:90px">${m.label}</div>
                <div style="font-size:0.82rem;font-weight:600;min-width:80px">${m.val}</div>
                <div class="skill-bar"><div class="skill-fill" style="width:${m.barPct}%;background:${m.color}"></div></div>
              </div>`).join('')}
            </div>`;
          }).join('')}
      </div>
    </div>`;
  },

  // ── ADMIN PANEL ──────────────────────────────────────────
  renderAdmin(el) {
    el.innerHTML = `<div class="fade-in">
      <div class="admin-tabs" id="admin-tabs">
        ${['Video Library','Course Manager','Brands','Categories','Settings'].map((t,i)=>
          `<button class="tab-btn ${i===0?'active':''}" onclick="APP.switchAdminTab('${t}',this)">${t}</button>`).join('')}
      </div>
      <div id="admin-content">
        ${this.renderAdminVideoLib()}
      </div>
    </div>`;
  },

  switchAdminTab(tab, btn) {
    document.querySelectorAll('#admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('admin-content');
    switch(tab) {
      case 'Video Library':  content.innerHTML = this.renderAdminVideoLib(); break;
      case 'Course Manager': content.innerHTML = this.renderAdminCourseManager(); break;
      case 'Brands':         content.innerHTML = this.renderAdminBrands(); break;
      case 'Categories':     content.innerHTML = this.renderAdminCats(); break;
      case 'Settings':       content.innerHTML = this.renderAdminSettings(); break;
    }
  },

  renderAdminVideoLib() {
    const customUrls = this.storage.get('video_urls', {});
    const allModules = [
      ...IRA_DATA.brands.map(b => ({ id:b.id, name:b.name, icon:b.logo, type:'Brand', file:b.videoFile, trainer:b.trainer })),
      ...IRA_DATA.categories.map(c => ({ id:c.id, name:c.name, icon:c.icon, type:'Category', file:c.videoFile, trainer:'Team' }))
    ];
    return `<div>
      <div class="section-header"><h3>📹 Video Library Management</h3></div>
      <div class="text-sm muted mb-2">Paste YouTube, Google Drive, or direct MP4 URLs for each training module</div>
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        ${allModules.map(m => `
          <div class="card" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
            <span style="font-size:1.5rem">${m.icon}</span>
            <div style="min-width:140px"><strong>${m.name}</strong><div class="text-xs muted">${m.type} · ${m.trainer}</div></div>
            <input type="text" value="${customUrls[m.id]||''}" id="admin-vid-${m.id}" placeholder="Paste video URL..." style="flex:1;min-width:200px;background:var(--black3);border:1px solid var(--black4);border-radius:var(--radius);color:var(--white);padding:0.5rem 0.85rem;font-family:var(--font)">
            <button class="btn btn-outline btn-sm" onclick="APP.adminSaveVideoUrl('${m.id}')">Save</button>
            <div class="text-xs muted" style="min-width:80px">${customUrls[m.id]?'✅ URL Set':'⚠️ No URL'}</div>
          </div>`).join('')}
      </div>
    </div>`;
  },

  adminSaveVideoUrl(moduleId) {
    const val = document.getElementById('admin-vid-' + moduleId)?.value?.trim();
    const urls = this.storage.get('video_urls', {});
    urls[moduleId] = val;
    this.storage.set('video_urls', urls);
    this.toast('URL saved for module ' + moduleId, 'success');
  },

  renderAdminCourseManager() {
    return `<div>
      <div class="section-header"><h3>📚 Course Manager</h3><button class="btn btn-gold btn-sm" onclick="APP.toast('Feature: Upload new course module','success')">+ Add Course</button></div>
      <div class="card mb-2">
        <div class="card-title">Current Learning Paths</div>
        <div style="margin-top:0.75rem">
          ${[
            { name:'Brand Academy', count: IRA_DATA.brands.length + ' brands', icon:'🏷️' },
            { name:'Category Academy', count: IRA_DATA.categories.length + ' categories', icon:'📂' },
            { name:'Selling Skills', count: IRA_DATA.sellingModules.length + ' modules', icon:'📈' }
          ].map(p => `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:var(--black3);border-radius:var(--radius);margin-bottom:0.5rem">
            <span style="font-size:1.5rem">${p.icon}</span>
            <div style="flex:1"><strong>${p.name}</strong><div class="text-xs muted">${p.count}</div></div>
            <button class="btn btn-ghost btn-sm">Edit</button>
          </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Quiz Settings</div>
        <div class="form-row mt-1">
          <div class="form-field"><label>Passing Score (%)</label><input type="number" value="80" min="50" max="100"></div>
          <div class="form-field"><label>Max Attempts</label><input type="number" value="3" min="1" max="10"></div>
          <div class="form-field"><label>Video Watch Threshold (%)</label><input type="number" value="90" min="50" max="100"></div>
          <div class="form-field"><label>Questions per Quiz</label><input type="number" value="10" min="5" max="20"></div>
        </div>
        <button class="btn btn-gold btn-sm mt-1" onclick="APP.toast('Settings saved','success')">Save Settings</button>
      </div>
    </div>`;
  },

  renderAdminBrands() {
    return `<div>
      <div class="section-header"><h3>🏷️ Brand Management</h3></div>
      <div class="card" style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Brand</th><th>Target Customer</th><th>Price Range</th><th>Quiz Qs</th><th>Trainer</th><th>Actions</th></tr></thead>
          <tbody>
            ${IRA_DATA.brands.map(b => `<tr>
              <td><span style="font-size:1.2rem">${b.logo}</span> <strong>${b.name}</strong></td>
              <td class="text-sm muted">${b.targetCustomer.slice(0,40)}...</td>
              <td>${b.priceRange}</td>
              <td>${b.quiz.length}</td>
              <td>${b.trainer}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="APP.navigate('brand-module',{brandId:'${b.id}'})">View →</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  renderAdminCats() {
    return `<div>
      <div class="section-header"><h3>📂 Category Management</h3></div>
      <div class="card" style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Category</th><th>Types</th><th>Quiz Qs</th><th>Actions</th></tr></thead>
          <tbody>
            ${IRA_DATA.categories.map(c => `<tr>
              <td><span style="font-size:1.2rem">${c.icon}</span> <strong>${c.name}</strong></td>
              <td>${c.types.length}</td>
              <td>${c.quiz.length}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="APP.navigate('category-module',{catId:'${c.id}'})">View →</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  renderAdminSettings() {
    return `<div>
      <div class="section-header"><h3>⚙️ Platform Settings</h3></div>
      <div class="card mb-2">
        <div class="card-title">Gamification</div>
        <div class="form-row mt-1">
          <div class="form-field"><label>XP for Video Watch</label><input type="number" value="50"></div>
          <div class="form-field"><label>XP for Quiz Pass</label><input type="number" value="200"></div>
          <div class="form-field"><label>XP for Daily Login</label><input type="number" value="10"></div>
          <div class="form-field"><label>XP for AI Coach Use</label><input type="number" value="5"></div>
        </div>
        <button class="btn btn-gold btn-sm mt-1" onclick="APP.toast('XP settings saved','success')">Save</button>
      </div>
      <div class="card mb-2">
        <div class="card-title">Data Management</div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
          <button class="btn btn-outline btn-sm" onclick="APP.exportData()">⬇️ Export All Data</button>
          <button class="btn btn-outline btn-sm" onclick="APP.resetProgress()">🔄 Reset All Progress</button>
          <button class="btn btn-danger btn-sm" onclick="APP.confirmResetAll()">⚠️ Factory Reset</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Sales Data Integration</div>
        <p class="text-sm muted mt-1">Connect the Intimissi retail Excel data to this academy for live KPI tracking</p>
        <div style="background:var(--black3);border-radius:var(--radius);padding:1rem;margin-top:0.75rem;font-size:0.82rem;font-family:monospace;color:#888">
          Source: J:\\My Drive\\Intimissi Retail Dashboard\\STORE_SALES_DATA_FROM 2023 TO TILL_16.06.2026 (1).xlsx<br>
          Status: <span style="color:#66bb6a">✓ Connected via dashboard generator</span>
        </div>
        <button class="btn btn-outline btn-sm mt-1" onclick="APP.toast('Sales data refresh triggered. Regenerate dashboard HTML to update KPIs.','success')">🔄 Refresh KPIs</button>
      </div>
    </div>`;
  },

  exportData() {
    const data = {
      users: this.storage.get('users', []),
      progress: this.storage.get('progress', {}),
      xpLog: this.storage.get('xp_log', [])
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ira_data_' + new Date().toISOString().split('T')[0] + '.json';
    a.click(); URL.revokeObjectURL(url);
    this.toast('Data exported!', 'success');
  },

  resetProgress() {
    if (!confirm('Reset all learning progress? User accounts will be kept.')) return;
    this.storage.set('progress', {});
    this.toast('Progress reset', 'success');
  },

  confirmResetAll() {
    if (!confirm('⚠️ This will delete ALL data including user accounts. Continue?')) return;
    localStorage.clear();
    location.reload();
  },

  // ── MANAGE USERS ─────────────────────────────────────────
  renderManageUsers(el) {
    const users = this.storage.get('users', []);
    el.innerHTML = `<div class="fade-in">
      <div class="section-header">
        <h3>👥 User Management</h3>
        <button class="btn btn-gold btn-sm" onclick="APP.showAddUserModal()">+ Add User</button>
      </div>
      <div class="card" style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Status</th><th>Role</th><th>Store</th><th>XP</th><th>Level</th><th>Join Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map(u => {
              const store = u.storeId ? IRA_DATA.stores.find(s=>s.id===u.storeId)?.name || u.storeId : '—';
              const lp = IRA_DATA.getLevelForXP(u.xp||0);
              const isLeft = u.status === 'left';
              return `<tr ${isLeft ? 'style="opacity:0.55"' : ''}>
                <td><strong>${u.name}</strong></td>
                <td>${isLeft ? '<span class="badge-pill" style="background:rgba(239,83,80,0.15);color:#ef5350;font-size:0.68rem;padding:2px 8px;border-radius:10px;font-weight:700">Absent/Left</span>' : '<span style="color:#66bb6a;font-size:0.72rem">● Active</span>'}</td>
                <td class="text-sm">${u.role}</td>
                <td class="text-sm muted">${store}</td>
                <td class="gold">${u.xp||0}</td>
                <td>${lp.badge} ${lp.name}</td>
                <td class="text-sm muted">${u.joinDate||'—'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="APP.resetUserPin('${u.id}')">Reset PIN</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div id="add-user-form" class="card mt-2 hidden">
        <h3 class="mb-2">Add New User</h3>
        <div class="form-row">
          <div class="form-field"><label>Full Name</label><input id="nu-name" placeholder="Employee Full Name"></div>
          <div class="form-field"><label>Role</label><select id="nu-role">${['Retail Stylist','Senior Stylist','Store Manager','Area Manager','HR','Operations Head','Super Admin'].map(r=>`<option>${r}</option>`).join('')}</select></div>
          <div class="form-field"><label>Store</label><select id="nu-store"><option value="">Head Office</option>${IRA_DATA.stores.map(s=>`<option value="${s.id}">${s.name} - ${s.city}</option>`).join('')}</select></div>
          <div class="form-field"><label>PIN (4 digits)</label><input id="nu-pin" maxlength="4" placeholder="1234" type="password" inputmode="numeric"></div>
        </div>
        <div style="display:flex;gap:0.75rem">
          <button class="btn btn-gold" onclick="APP.addUser()">Add User</button>
          <button class="btn btn-ghost" onclick="document.getElementById('add-user-form').classList.add('hidden')">Cancel</button>
        </div>
      </div>
    </div>`;
  },

  showAddUserModal() {
    document.getElementById('add-user-form')?.classList.remove('hidden');
  },

  addUser() {
    const name = document.getElementById('nu-name')?.value?.trim();
    const role = document.getElementById('nu-role')?.value;
    const storeId = document.getElementById('nu-store')?.value || null;
    const pin = document.getElementById('nu-pin')?.value?.trim();
    if (!name || !pin || pin.length !== 4) { this.toast('Please fill all fields. PIN must be 4 digits.', 'error'); return; }
    const users = this.storage.get('users', []);
    const id = 'u' + Date.now();
    users.push({ id, name, role, storeId: storeId || null, pin, xp: 0, level: 1, joinDate: new Date().toISOString().split('T')[0] });
    this.storage.set('users', users);
    this.toast('User ' + name + ' added!', 'success');
    this.navigate('manage-users');
  },

  resetUserPin(userId) {
    const newPin = prompt('Enter new 4-digit PIN for this user:');
    if (!newPin || newPin.length !== 4 || isNaN(newPin)) { this.toast('Invalid PIN', 'error'); return; }
    const users = this.storage.get('users', []);
    const u = users.find(x => x.id === userId);
    if (u) {
      u.pin = newPin;
      this.storage.set('users', users);
      const patch = { pin_overrides: {} };
      patch.pin_overrides[userId] = newPin;
      this.syncConfig(patch);
      this.toast('PIN updated and synced!', 'success');
    }
  },

  // ── REPORTS ──────────────────────────────────────────────
  renderReports(el) {
    const users = this.storage.get('users', []);
    const prog = this.storage.get('progress', {});
    const totalModules = IRA_DATA.brands.length + IRA_DATA.categories.length + IRA_DATA.sellingModules.length;

    const report = users.map(u => {
      const myProg = prog[u.id] || {};
      const done = Object.values(myProg).filter(p => p.quizPassed).length;
      return { ...u, done, pct: Math.round((done/totalModules)*100) };
    }).sort((a,b) => b.pct - a.pct);

    el.innerHTML = `<div class="fade-in">
      <div class="section-header">
        <h3>📋 Training Completion Report</h3>
        <button class="btn btn-gold btn-sm" onclick="APP.exportData()">⬇️ Export Data</button>
      </div>
      <div class="text-sm muted mb-2">Showing training completion rates across all employees</div>
      <div class="card" style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Rank</th><th>Name</th><th>Role</th><th>Store</th><th>Completion %</th><th>Modules Done</th><th>XP</th><th>Level</th></tr></thead>
          <tbody>
            ${report.map((u,i) => {
              const store = u.storeId ? IRA_DATA.stores.find(s=>s.id===u.storeId)?.name : 'Head Office';
              const lp = IRA_DATA.getLevelForXP(u.xp||0);
              return `<tr>
                <td>${i+1}</td>
                <td><strong>${u.name}</strong></td>
                <td class="text-sm">${u.role}</td>
                <td class="text-sm muted">${store||'—'}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:0.5rem">
                    <div class="progress-bar" style="width:80px"><div class="progress-bar-fill" style="width:${u.pct}%;background:${u.pct>=70?'#2e7d32':u.pct>=40?'#c9a84c':'#c62828'}"></div></div>
                    <span>${u.pct}%</span>
                  </div>
                </td>
                <td>${u.done}/${totalModules}</td>
                <td class="gold">${u.xp||0}</td>
                <td>${lp.badge} ${lp.name}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  // ── PROFILE ──────────────────────────────────────────────
  renderProfile(el) {
    const u = this.getUser();
    const lp = IRA_DATA.getXPProgress(u.xp || 0);
    const prog = this.storage.get('progress', {})[u.id] || {};
    const certs = [...IRA_DATA.brands, ...IRA_DATA.categories, ...IRA_DATA.sellingModules].filter(m => prog[m.id]?.quizPassed).length;
    const store = u.storeId ? IRA_DATA.stores.find(s => s.id === u.storeId)?.name : 'Head Office';

    el.innerHTML = `<div class="fade-in" style="max-width:600px;margin:0 auto">
      <div class="card card-gold" style="text-align:center;padding:2.5rem;margin-bottom:1.5rem">
        <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--gold3),var(--gold));display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:var(--black);margin:0 auto 1rem">
          ${u.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <h2 style="font-size:1.5rem">${u.name}</h2>
        <div style="color:var(--gold);font-size:0.9rem">${u.role}</div>
        <div class="muted text-sm mt-1">${store}</div>
        <div style="display:flex;gap:2rem;justify-content:center;margin-top:1.5rem">
          ${this.kpiMini('XP', u.xp||0, 'Total')}
          ${this.kpiMini('Level', lp.current.badge + ' ' + lp.current.name, 'Current')}
          ${this.kpiMini('Certs', certs, 'Earned')}
        </div>
        <div style="margin-top:1.5rem">
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:#666;margin-bottom:0.35rem">
            <span>${lp.current.name}</span>
            ${lp.next ? `<span>${lp.next.name} (${lp.next.minXP} XP)</span>` : '<span>MAX LEVEL 🏆</span>'}
          </div>
          <div class="xp-bar" style="height:8px"><div class="xp-fill" style="width:${lp.pct}%;height:100%"></div></div>
          <div class="text-xs muted mt-1">${lp.pct}% to next level</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-title">Change PIN</div>
        <div style="display:flex;gap:0.75rem;margin-top:0.75rem;align-items:center;flex-wrap:wrap">
          <input type="password" id="new-pin" placeholder="New 4-digit PIN" maxlength="4" inputmode="numeric" style="background:var(--black3);border:1px solid var(--black4);border-radius:var(--radius);color:var(--white);padding:0.65rem 1rem;font-family:var(--font)">
          <button class="btn btn-outline" onclick="APP.changePin()">Update PIN</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Member Since</div>
        <div style="font-size:1rem;margin-top:0.5rem">${u.joinDate || 'Unknown'}</div>
      </div>
    </div>`;
  },

  changePin() {
    const pin = document.getElementById('new-pin')?.value?.trim();
    if (!pin || pin.length !== 4 || isNaN(pin)) { this.toast('PIN must be exactly 4 digits', 'error'); return; }
    const users = this.storage.get('users', []);
    const u = users.find(x => x.id === this.state.user.id);
    if (u) {
      u.pin = pin;
      this.storage.set('users', users);
      // Sync to cloud so the new PIN works on all devices
      const patch = { pin_overrides: {} };
      patch.pin_overrides[u.id] = pin;
      this.syncConfig(patch);
      this.toast('PIN updated successfully!', 'success');
    }
  },

  // ── XP & GAMIFICATION ───────────────────────────────────
  addXP(userId, amount, reason) {
    const users = this.storage.get('users', []);
    const u = users.find(x => x.id === userId);
    if (u) {
      u.xp = (u.xp || 0) + amount;
      this.storage.set('users', users);
      const log = this.storage.get('xp_log', []);
      log.push({ userId, amount, reason, date: new Date().toISOString() });
      if (log.length > 500) log.shift();
      this.storage.set('xp_log', log);
      if (userId === this.state.user?.id) {
        this.state.user = u;
        this.updateSidebarXP(u);
      }
    }
  },

  updateSidebarXP(u) {
    const lp = IRA_DATA.getXPProgress(u.xp || 0);
    const fill = document.getElementById('sidebar-xp-fill');
    const label = document.getElementById('sidebar-xp-label');
    const val = document.getElementById('sidebar-xp-val');
    if (fill) fill.style.width = lp.pct + '%';
    if (label) label.textContent = lp.current.badge + ' ' + lp.current.name;
    if (val) val.textContent = (u.xp || 0) + ' XP';
  },

  // ── RPOS: PERFORMANCE INDEX ──────────────────────────────
  calculatePI(u, sp, extra) {
    const w = IRA_DATA.piWeights;
    let score = 0;
    // Sales rank percentile (0–100)
    if (sp) {
      score += (sp.salesPctile || 0) * w.salesRankPctile;
      score += (sp.atvPctile   || 0) * w.atvPctile;
      score += (sp.uptPctile   || 0) * w.uptPctile;
    } else {
      // Non-SP: distribute weight to other factors
      score += 50 * (w.salesRankPctile + w.atvPctile + w.uptPctile);
    }
    score += ((extra && extra.completionPct) || 0) * w.academyCompletion;
    const streak = this.getStreak(u);
    const streakScore = Math.min(100, streak.current * 5);
    score += streakScore * w.streakBonus;
    return Math.min(100, Math.round(score));
  },

  // ── RPOS: STREAK TRACKING ────────────────────────────────
  getStreak(u) {
    const log = this.storage.get('xp_log', []);
    const loginDays = [...new Set(
      log.filter(e => e.userId === u.id && e.reason === 'Daily Login')
         .map(e => new Date(e.date).toDateString())
    )].sort((a,b) => new Date(b) - new Date(a));

    let current = 0;
    let d = new Date();
    for (let i = 0; i < 90; i++) {
      if (loginDays.includes(d.toDateString())) { current++; d.setDate(d.getDate()-1); }
      else { break; }
    }
    return { current, longest: Math.max(current, this.storage.get('best_streak_'+u.id) || 0) };
  },

  // ── RPOS: DAILY MISSIONS ─────────────────────────────────
  getDailyMissions(u, sp, prog) {
    const seed = u.id + new Date().toDateString();
    let hash = 0;
    for (const c of seed) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
    const myProg = prog[u.id] || {};
    const completedModuleCount = Object.values(myProg).filter(p => p.quizPassed).length;

    const pool = [
      { id:'daily_quiz',    text:'Pass any quiz with 70%+ score',         xp:50, type:'quiz'    },
      { id:'daily_video',   text:'Watch a training video today',           xp:30, type:'video'   },
      { id:'daily_brand',   text:'Explore a Brand Academy module',         xp:40, type:'brand'   },
      { id:'daily_login',   text:'Log in for 3 days in a row',             xp:40, type:'streak'  },
      { id:'daily_skill',   text:'Complete a Selling Skills lesson',       xp:35, type:'skill'   },
      { id:'daily_perfect', text:'Score 100% on any quiz',                 xp:80, type:'quiz'    },
      { id:'daily_social',  text:'Give a colleague applause today',        xp:25, type:'social'  },
      { id:'daily_coach',   text:'Ask the AI Coach a question',            xp:20, type:'coach'   },
    ];

    // Pick 3 missions deterministically based on day seed
    const picks = [];
    const used = new Set();
    let n = Math.abs(hash);
    while (picks.length < 3 && picks.length < pool.length) {
      const idx = n % pool.length;
      if (!used.has(idx)) { used.add(idx); picks.push(pool[idx]); }
      n = Math.floor(n / pool.length) + idx + 1;
    }
    return picks;
  },

  completeMission(missionId, xp) {
    const u = this.getUser();
    const today = new Date().toDateString();
    const key = 'completed_missions_' + u.id;
    const done = this.storage.get(key) || [];
    if (done.some(m => m.id === missionId && m.date === today)) return;
    done.push({ id: missionId, date: today });
    this.storage.set(key, done);
    this.addXP(u.id, xp, 'Mission: ' + missionId);
    this.toast(`Mission complete! +${xp} XP`, 'success');
    this.checkAndAwardBadges(u);
  },

  // ── RPOS: BADGES ─────────────────────────────────────────
  getEarnedBadges(u, sp, prog) {
    const myProg = (prog || this.storage.get('progress',{}))[u.id] || {};
    const completedKeys = Object.keys(myProg).filter(k => myProg[k].quizPassed);
    const log = this.storage.get('xp_log', []);
    const streak = this.getStreak(u);
    const completedMissions = (this.storage.get('completed_missions_'+u.id) || []);
    const applause = this.storage.get('applause', []) || [];
    const hour = new Date().getHours();

    const earned = [];
    const check = (id) => {
      const badge = IRA_DATA.badges.find(b => b.id === id);
      if (badge && !earned.find(e => e.id === id)) earned.push(badge);
    };

    // Academy badges
    if (completedKeys.length >= 1)  check('first_quiz');
    if (completedKeys.length >= 5)  check('quiz5');
    if (completedKeys.length >= 10) check('quiz10');
    if (Object.values(myProg).some(p => p.lastScore >= 100)) check('perfect_quiz');
    if (IRA_DATA.brands.every(b => myProg[b.id]?.quizPassed)) check('all_brands');
    if (IRA_DATA.categories.every(c => myProg[c.id]?.quizPassed)) check('all_cats');
    const allTotal = IRA_DATA.brands.length + IRA_DATA.categories.length + (IRA_DATA.sellingModules||[]).length;
    if (completedKeys.length >= allTotal && allTotal > 0) check('all_modules');

    // Streak badges
    if (streak.current >= 3)  check('streak3');
    if (streak.current >= 7)  check('streak7');
    if (streak.current >= 14) check('streak14');
    if (streak.current >= 30) check('streak30');

    // XP badges
    const xp = u.xp || 0;
    if (xp >= 500)   check('xp500');
    if (xp >= 2000)  check('xp2000');
    if (xp >= 5000)  check('xp5000');
    if (xp >= 10000) check('xp10000');

    // Sales badges (rank-based, safe for all roles)
    if (sp) {
      if (sp.rankATV === 1 || sp.rankUPT === 1) check('rank1');
      if (sp.rankSales <= 3) check('rank_top3');
      if (sp.atvPctile >= 90) check('atv_top10');
      if (sp.uptPctile >= 90) check('upt_top10');
    }

    // Mission badges
    const totalMissions = completedMissions.length;
    if (totalMissions >= 1)  check('mission1');
    if (totalMissions >= 10) check('mission10');
    if (totalMissions >= 30) check('mission30');

    // Social
    const myApplause = applause.filter(a => a.to === u.id);
    const gaveApplause = applause.filter(a => a.from === u.id);
    if (myApplause.length >= 1)  check('first_applause');
    if (myApplause.length >= 10) check('applause10');
    if (gaveApplause.length >= 1) check('gave_applause');

    // Special
    if (hour < 9)  check('early_bird');
    if (hour >= 20) check('night_owl');
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) check('weekend_grind');

    return earned;
  },

  checkAndAwardBadges(u) {
    const prog = this.storage.get('progress', {});
    const sp = this.getSalesRecord(u);
    const newBadges = this.getEarnedBadges(u, sp, prog);
    const prev = this.storage.get('earned_badges_' + u.id) || [];
    const prevIds = new Set(prev.map(b => b.id));
    newBadges.forEach(b => {
      if (!prevIds.has(b.id)) {
        this.toast(`${b.icon} Badge Unlocked: ${b.name}!`, 'success');
      }
    });
    this.storage.set('earned_badges_' + u.id, newBadges);
  },

  // ── RPOS: MISSIONS SCREEN ────────────────────────────────
  renderMissions(el) {
    const u = this.getUser();
    const sp = this.getSalesRecord(u);
    const prog = this.storage.get('progress', {});
    const missions = this.getDailyMissions(u, sp, prog);
    const completedToday = (this.storage.get('completed_missions_'+u.id)||[])
      .filter(m => m.date === new Date().toDateString());
    const streak = this.getStreak(u);
    const allDone = completedToday.filter(m => missions.some(ms => ms.id === m.id));

    el.innerHTML = `<div class="fade-in">
      <div class="section-header"><h3>📋 Today's Missions</h3><span class="muted text-sm">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</span></div>

      <!-- Streak banner -->
      <div class="card streak-banner ${streak.current>=7?'hot':''}">
        <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
          <div style="font-size:2.5rem">${streak.current>=14?'🔥':streak.current>=7?'⚡':streak.current>=3?'✨':'📅'}</div>
          <div style="flex:1">
            <div class="text-lg font-bold">${streak.current}-Day Streak${streak.current>=7?' 🔥':''}</div>
            <div class="muted text-sm">Best: ${streak.longest} days · Keep it up to earn bonus XP!</div>
          </div>
          <div class="streak-multiplier">
            <div class="text-2xl font-bold" style="color:var(--gold)">${streak.current>=7?'2×':streak.current>=3?'1.5×':'1×'}</div>
            <div class="text-xs muted">XP Multiplier</div>
          </div>
        </div>
      </div>

      <!-- Today's Missions -->
      <div class="missions-list">
        ${missions.map(m => {
          const done = completedToday.some(c => c.id === m.id);
          const mult = streak.current >= 7 ? 2 : streak.current >= 3 ? 1.5 : 1;
          const finalXP = Math.round(m.xp * mult);
          return `<div class="mission-card ${done?'mission-done':''}">
            <div class="mission-status">${done?'<span class="done-check">✅</span>':'<div class="mission-circle"></div>'}</div>
            <div class="mission-body">
              <div class="mission-title">${m.text}</div>
              <div class="mission-meta">
                ${mult > 1 ? `<span class="xp-tag streaked">+${finalXP} XP <span class="mult-badge">${mult}×</span></span>` : `<span class="xp-tag">+${finalXP} XP</span>`}
              </div>
            </div>
            ${!done ? `<button class="btn btn-outline btn-sm" onclick="APP.completeMission('${m.id}',${finalXP})">Mark Done</button>` : ''}
          </div>`;
        }).join('')}
      </div>

      <!-- Progress -->
      <div class="card" style="margin-top:1rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
          <span class="font-bold">Mission Progress</span>
          <span class="gold font-bold">${allDone.length}/${missions.length} Done</span>
        </div>
        <div class="xp-bar"><div class="xp-fill" style="width:${missions.length?Math.round(allDone.length/missions.length*100):0}%"></div></div>
        ${allDone.length === missions.length ? '<div class="mt-1 text-sm gold">🏆 All missions complete! Incredible work today.</div>' : ''}
      </div>

      <!-- Weekly history -->
      <div class="section-header mt-2"><h3>📅 This Week</h3></div>
      <div class="week-strip">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,i)=>{
          const d = new Date(); d.setDate(d.getDate() - ((d.getDay()-i+7)%7));
          const isFuture = d > new Date();
          const dayStr = d.toDateString();
          const hadLogin = (this.storage.get('xp_log',[])).some(e=>e.userId===u.id&&e.reason==='Daily Login'&&new Date(e.date).toDateString()===dayStr);
          const isToday = dayStr === new Date().toDateString();
          return `<div class="day-dot ${hadLogin?'active':''} ${isToday?'today':''} ${isFuture?'future':''}">
            <div class="day-label">${day}</div>
            <div class="day-circle">${hadLogin?'✓':isToday?'·':''}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ── RPOS: REPORT CARD ────────────────────────────────────
  renderReportCard(el) {
    const u = this.getUser();
    const sp = this.getSalesRecord(u);
    const prog = this.storage.get('progress', {});
    const myProg = prog[u.id] || {};
    const completedKeys = Object.keys(myProg).filter(k => myProg[k].quizPassed);
    const totalModules = IRA_DATA.brands.length + IRA_DATA.categories.length + (IRA_DATA.sellingModules||[]).length;
    const completionPct = totalModules > 0 ? Math.round(completedKeys.length / totalModules * 100) : 0;
    const lp = IRA_DATA.getXPProgress(u.xp || 0);
    const streak = this.getStreak(u);
    const pi = this.calculatePI(u, sp, { completionPct });
    const badges = this.getEarnedBadges(u, sp, prog);
    const isStylist = ['Retail Stylist','Senior Stylist'].includes(u.role);

    const tierColors = { bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#e5e4e2', diamond:'#b9f2ff' };

    // Strengths & weaknesses based on SP data
    let strengths = [], weaknesses = [];
    if (sp) {
      if (sp.atvPctile >= 70)  strengths.push('High Ticket Value (ATV)');
      if (sp.uptPctile >= 70)  strengths.push('Strong Cross-Selling (UPT)');
      if (sp.salesPctile >= 70) strengths.push('Overall Sales Performance');
      if (sp.atvPctile < 40)   weaknesses.push('Avg Ticket Value needs improvement');
      if (sp.uptPctile < 40)   weaknesses.push('Cross-selling & upselling');
      if (sp.salesPctile < 40) weaknesses.push('Overall sales volume');
    }
    if (completionPct < 50) weaknesses.push('Academy module completion');
    if (completionPct >= 80) strengths.push('Learning & Development');
    if (streak.current >= 7) strengths.push('Consistent daily engagement');

    el.innerHTML = `<div class="fade-in">
      <!-- Report Card Header -->
      <div class="report-card-hero">
        <div class="report-avatar">${u.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div>
        <div class="report-info">
          <h2 class="report-name">${u.name}</h2>
          <div class="report-role">${u.role}${u.storeId ? ' · ' + u.storeId : ''}</div>
          <div class="report-level">${lp.current.badge} ${lp.current.name} <span class="muted text-sm">· ${lp.current.title}</span></div>
        </div>
        <div class="pi-score-big">
          <div class="pi-big-val" style="color:${pi>=75?'#4caf50':pi>=50?'var(--gold)':'#f44336'}">${pi}</div>
          <div class="pi-big-label">Performance Index</div>
          <div class="pi-rating">${pi>=80?'🔥 Excellent':pi>=65?'⭐ Good':pi>=50?'📈 Average':'💪 Improving'}</div>
        </div>
      </div>

      <!-- XP Progress -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
          <div><div class="font-bold">${lp.current.badge} ${lp.current.name}</div><div class="text-sm muted">${u.xp||0} XP total</div></div>
          ${lp.next ? `<div class="text-sm muted">Next: ${lp.next.badge} ${lp.next.name} at ${lp.next.minXP} XP</div>` : '<div class="text-sm gold">MAX LEVEL</div>'}
        </div>
        <div class="xp-bar"><div class="xp-fill" style="width:${lp.pct}%"></div></div>
        <div style="font-size:0.75rem;color:#666;margin-top:0.35rem;text-align:right">${lp.pct}% to next level</div>
      </div>

      <!-- KPI Grid -->
      <div class="kpi-grid">
        <div class="card"><div class="card-title">🔥 Streak</div><div class="card-value gold">${streak.current}</div><div class="card-sub">days · Best: ${streak.longest}</div></div>
        <div class="card"><div class="card-title">🎓 Modules</div><div class="card-value">${completionPct}%</div><div class="card-sub">${completedKeys.length} of ${totalModules} done</div></div>
        ${sp ? `<div class="card"><div class="card-title">📊 Sales Rank</div><div class="card-value">#${sp.rankSales}</div><div class="card-sub">Percentile: ${Math.round(sp.salesPctile)}%</div></div>` : ''}
        ${sp ? `<div class="card"><div class="card-title">🎫 ATV Rank</div><div class="card-value">#${sp.rankATV}</div><div class="card-sub">Percentile: ${Math.round(sp.atvPctile)}%</div></div>` : ''}
      </div>

      <!-- PI Breakdown -->
      ${sp ? `<div class="section-header"><h3>📊 Performance Breakdown</h3></div>
      <div class="card">
        ${[
          { label:'Sales Performance', val: Math.round(sp.salesPctile), max:100 },
          { label:'Avg Ticket Value',  val: Math.round(sp.atvPctile),   max:100 },
          { label:'Units Per Ticket',  val: Math.round(sp.uptPctile),   max:100 },
          { label:'Academy Progress',  val: completionPct,              max:100 },
          { label:'Daily Streak',      val: Math.min(100,streak.current*5), max:100 }
        ].map(row=>`<div class="pi-row">
            <div class="pi-row-label">${row.label}</div>
            <div class="pi-row-bar"><div class="pi-row-fill" style="width:${row.val}%;background:${row.val>=70?'#4caf50':row.val>=50?'var(--gold)':'#f44336'}"></div></div>
            <div class="pi-row-val">${row.val}%</div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Strengths & Weaknesses -->
      ${strengths.length || weaknesses.length ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        ${strengths.length ? `<div class="card strength-card"><div class="card-title" style="color:#4caf50">💪 Strengths</div>${strengths.map(s=>`<div class="sw-item">✅ ${s}</div>`).join('')}</div>` : ''}
        ${weaknesses.length ? `<div class="card weakness-card"><div class="card-title" style="color:#f44336">🎯 Focus Areas</div>${weaknesses.map(w=>`<div class="sw-item">→ ${w}</div>`).join('')}</div>` : ''}
      </div>` : ''}

      <!-- Badges -->
      <div class="section-header"><h3>🏅 My Badges (${badges.length})</h3><button class="btn btn-outline btn-sm" onclick="APP.navigate('missions')">Earn More</button></div>
      ${badges.length > 0 ? `<div class="badges-grid">
        ${badges.map(b=>`<div class="badge-item tier-${b.tier}" title="${b.desc}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-tier">${b.tier}</div>
        </div>`).join('')}
      </div>` : '<div class="card text-center muted" style="padding:2rem">Complete modules and missions to earn badges!</div>'}

      <!-- Career Path -->
      <div class="section-header mt-2"><h3>🗺️ Career Path</h3></div>
      <div class="career-path">
        ${IRA_DATA.levels.map(lvl=>{
          const done = (u.xp||0) >= lvl.minXP;
          const current = lp.current.id === lvl.id;
          return `<div class="career-step ${done?'done':''} ${current?'current':''}">
            <div class="career-badge">${lvl.badge}</div>
            <div class="career-name">${lvl.name}</div>
            <div class="career-xp">${lvl.minXP.toLocaleString()} XP</div>
          </div>`;
        }).join('<div class="career-arrow">→</div>')}
      </div>
    </div>`;
  },

  // ── RPOS: SOCIAL / RECOGNITION WALL ─────────────────────
  renderSocialWall(el) {
    const u = this.getUser();
    const users = this.activeUsers();
    const allUsersById = {};
    this.storage.get('users', []).forEach(x => { allUsersById[x.id] = x; });
    const applause = this.storage.get('applause', []) || [];
    const myApplause = applause.filter(a => a.to === u.id);

    el.innerHTML = `<div class="fade-in">
      <div class="section-header"><h3>👏 Recognition Wall</h3><span class="muted text-sm">Celebrate your team's wins</span></div>

      <!-- Give Applause -->
      <div class="card give-applause-card">
        <div class="card-title">🎉 Give Applause</div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem;align-items:flex-end">
          <div style="flex:1;min-width:150px">
            <label class="text-xs muted">Recognise</label>
            <select id="applause-to" class="input-select" style="width:100%;margin-top:0.25rem">
              <option value="">Select colleague...</option>
              ${users.filter(x=>x.id!==u.id&&['Retail Stylist','Senior Stylist','Store Manager'].includes(x.role)).map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}
            </select>
          </div>
          <div style="flex:2;min-width:200px">
            <label class="text-xs muted">Message</label>
            <input id="applause-msg" class="input-text" style="width:100%;margin-top:0.25rem" placeholder="Amazing work on the fitting today! 🎉" maxlength="120">
          </div>
          <button class="btn btn-gold" onclick="APP.giveApplause()">👏 Applaud</button>
        </div>
      </div>

      <!-- My Recognition -->
      ${myApplause.length > 0 ? `<div class="card" style="border-left:4px solid var(--gold);margin-bottom:1rem">
        <div class="card-title gold">⭐ You've been recognised ${myApplause.length} time${myApplause.length!==1?'s':''}</div>
        <div class="text-sm muted mt-1">Keep shining!</div>
      </div>` : ''}

      <!-- Feed -->
      <div class="recognition-feed">
        ${applause.length === 0 ? `<div class="empty-state"><div class="icon">👏</div><h3>Be the first!</h3><p class="muted">Recognise a colleague's great work above.</p></div>` :
        applause.slice().reverse().map(a => {
          const from = allUsersById[a.from];
          const to = allUsersById[a.to];
          if (!from || !to) return '';
          return `<div class="applause-card">
            <div class="applause-avatars">
              <div class="mini-avatar">${from.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
              <div class="applause-arrow">👏</div>
              <div class="mini-avatar gold-avatar">${to.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
            </div>
            <div class="applause-content">
              <div class="applause-who"><strong>${from.name}</strong> applauded <strong>${to.name}</strong></div>
              ${a.msg ? `<div class="applause-msg">"${a.msg}"</div>` : ''}
              <div class="applause-time muted text-xs">${new Date(a.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  giveApplause() {
    const toId = document.getElementById('applause-to')?.value;
    const msg  = document.getElementById('applause-msg')?.value?.trim();
    if (!toId) { this.toast('Please select a colleague', 'error'); return; }
    const u = this.getUser();
    const applause = this.storage.get('applause', []) || [];
    // Limit 3 per day per user
    const today = new Date().toDateString();
    const todayCount = applause.filter(a=>a.from===u.id&&new Date(a.date).toDateString()===today).length;
    if (todayCount >= 3) { this.toast('You can applaud up to 3 times per day', 'error'); return; }
    applause.push({ from: u.id, to: toId, msg, date: new Date().toISOString() });
    this.storage.set('applause', applause);
    this.addXP(u.id, 20, 'Gave Applause');
    this.checkAndAwardBadges(u);
    this.toast('Applause sent! +20 XP', 'success');
    this.navigate('social-wall');
  },

  // ── RPOS: LIVE STORE SCOREBOARD ──────────────────────────
  renderLiveStore(el) {
    const users = this.activeUsers();
    const u = this.getUser();
    const isStylist = ['Retail Stylist','Senior Stylist'].includes(u.role);
    const canSeeAbsolute = !isStylist;

    if (typeof SALES_DATA === 'undefined') {
      el.innerHTML = `<div class="empty-state"><div class="icon">⚡</div><h3>Sales data not loaded</h3></div>`;
      return;
    }

    const sps = SALES_DATA.salespersons.filter(sp => sp.bills >= 5).sort((a,b)=>b.rankSales-a.rankSales||a.rankSales-b.rankSales);
    const topSP = [...SALES_DATA.salespersons].sort((a,b)=>a.rankSales-b.rankSales)[0];
    const storeScores = SALES_DATA.stores.slice().sort((a,b)=>(b.sales||0)-(a.sales||0));

    // Group by store for the per-store leaderboard
    const myStoreSPs = u.storeId ? sps.filter(sp=>sp.store===u.storeId) : sps.slice(0,10);

    el.innerHTML = `<div class="fade-in">
      <div class="section-header"><h3>⚡ Live Store Scoreboard</h3><span class="badge-pill badge-green" style="animation:pulse 2s infinite">LIVE</span></div>

      <!-- Today's Champion -->
      ${topSP ? `<div class="champion-card">
        <div style="font-size:2.5rem;margin-bottom:0.5rem">🥇</div>
        <div class="champion-label">Top Performer</div>
        <div class="champion-name">${topSP.name}</div>
        <div class="champion-store">${topSP.store}</div>
        <div class="champion-stats">
          <span>Rank #1 Overall</span>
          ${canSeeAbsolute ? `<span>₹${Math.round(topSP.atv).toLocaleString('en-IN')} ATV</span>` : `<span>ATV Rank #${topSP.rankATV}</span>`}
          <span>${topSP.bills} Bills</span>
        </div>
      </div>` : ''}

      <!-- All-Store Leaderboard -->
      <div class="section-header"><h3>🏆 ${u.storeId ? u.storeId + ' Store' : 'All Stylists'} Ranking</h3></div>
      <div class="lb-table">
        <div class="lb-header">
          <span>Rank</span><span>Name</span><span>ATV</span><span>UPT</span><span>Bills</span>
        </div>
        ${myStoreSPs.slice(0,15).map((sp,i) => {
          const isMe = users.some(x=>(x.salesId||x.id)===sp.id && x.id===u.id);
          const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
          return `<div class="lb-row ${isMe?'me-row':''}">
            <span class="lb-rank">${medal || '#'+sp.rankSales}</span>
            <span class="lb-name">${sp.name}</span>
            <span>${canSeeAbsolute ? '₹'+Math.round(sp.atv).toLocaleString('en-IN') : 'Rank #'+sp.rankATV}</span>
            <span>${sp.upt.toFixed(1)}</span>
            <span>${sp.bills}</span>
          </div>`;
        }).join('')}
      </div>

      <!-- Store Comparison -->
      ${canSeeAbsolute && storeScores.length > 0 ? `
      <div class="section-header mt-2"><h3>🏪 Store Rankings</h3></div>
      <div class="store-ranking-list">
        ${storeScores.slice(0,8).map((s,i)=>`<div class="store-rank-row">
          <span class="lb-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
          <span>${s.name}</span>
          <span class="muted text-sm">${s.bills} bills</span>
          <span class="gold font-bold">₹${Math.round(s.sales/s.bills||0).toLocaleString('en-IN')} ATV</span>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  },

  // ── HELPERS ──────────────────────────────────────────────
  getUser() {
    const users = this.storage.get('users', []);
    return users.find(u => u.id === this.state.user?.id) || this.state.user || {};
  },

  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  },

  bindGlobalEvents() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { /* close modals */ }
    });
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => APP.init());
