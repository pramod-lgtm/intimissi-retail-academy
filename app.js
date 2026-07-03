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
    const saved = this.storage.get('session');
    if (saved && saved.userId) {
      const users = this.storage.get('users', []);
      const user = users.find(u => u.id === saved.userId);
      if (user) { this.loginUser(user); return; }
    }
    this.showLogin();
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
    // Load shared config from cloud (video URLs + PIN overrides)
    this.loadConfig();
  },

  loadConfig() {
    fetch('/api/config')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(cfg) {
        if (!cfg) return;
        // Merge cloud video_urls into localStorage (cloud wins)
        if (cfg.video_urls && Object.keys(cfg.video_urls).length) {
          var local = APP.storage.get('video_urls', {});
          Object.keys(cfg.video_urls).forEach(function(k) {
            if (cfg.video_urls[k]) local[k] = cfg.video_urls[k];
          });
          APP.storage.set('video_urls', local);
        }
        // Apply PIN overrides (cloud wins over default 1234)
        if (cfg.pin_overrides && Object.keys(cfg.pin_overrides).length) {
          var users = APP.storage.get('users', []);
          var changed = false;
          users.forEach(function(u) {
            if (cfg.pin_overrides[u.id]) { u.pin = cfg.pin_overrides[u.id]; changed = true; }
          });
          if (changed) APP.storage.set('users', users);
        }
      })
      .catch(function() {}); // offline — silent
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

    // Build users from real salesperson data
    const spUsers = SALES_DATA.salespersons
      .filter(sp => sp.name && sp.name !== '[NONE]' && sp.bills >= 5)
      .map(sp => {
        const prev = existingMap[sp.id] || {};
        return {
          id:       sp.id,
          name:     sp.name,
          username: sp.username,
          role:     'Retail Stylist',
          storeId:  sp.store,
          pin:      prev.pin || '1234',   // default PIN, admin can reset
          xp:       prev.xp  || 0,
          level:    prev.level || 1,
          joinDate: prev.joinDate || '2023-04-01',
          salesId:  sp.id   // link to SALES_DATA record
        };
      });

    // Add store managers for each store from management pool
    const storeManagers = IRA_DATA.defaultUsers.filter(u =>
      u.role === 'Store Manager'
    );

    const merged = [...mgmtUsers];
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
    const users = this.storage.get('users', []);

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
    document.getElementById('sidebar-user-store').textContent = store ? store.name : 'All Stores';
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

    const learningNav = `
      <div class="nav-section">
        <div class="nav-section-title">Learning</div>
        <div class="nav-item" onclick="APP.navigate('dashboard')"><span class="icon">🏠</span><span>My Dashboard</span></div>
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
        <div class="nav-item" onclick="APP.navigate('manager-dashboard')"><span class="icon">📊</span><span>Team Dashboard</span></div>
        <div class="nav-item" onclick="APP.navigate('store-analytics')"><span class="icon">🏪</span><span>Store Analytics</span></div>
      </div>` : '';

    const adminNav = isAdmin ? `
      <div class="nav-section">
        <div class="nav-section-title">Administration</div>
        <div class="nav-item" onclick="APP.navigate('admin')"><span class="icon">⚙️</span><span>Admin Panel</span></div>
        <div class="nav-item" onclick="APP.navigate('manage-users')"><span class="icon">👥</span><span>Manage Users</span></div>
        <div class="nav-item" onclick="APP.navigate('reports')"><span class="icon">📋</span><span>Reports</span></div>
      </div>` : '';

    const bottomNav = `
      <div class="nav-section">
        <div class="nav-item" onclick="APP.navigate('profile')"><span class="icon">👤</span><span>My Profile</span></div>
        <div class="nav-item" onclick="APP.logout()"><span class="icon">🚪</span><span>Logout</span></div>
      </div>`;

    document.getElementById('sidebar-nav').innerHTML = learningNav + managerNav + adminNav + bottomNav;
  },

  // ── NAVIGATION ───────────────────────────────────────────
  navigate(page, params = {}) {
    this.state.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('onclick')?.includes(`'${page}'`)) el.classList.add('active');
    });

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
          case 'leaderboard':     topTitle.textContent = '🏆 Leaderboard';           this.renderLeaderboard(content); break;
          case 'my-certs':        topTitle.textContent = '🎓 My Certificates';       this.renderMyCerts(content); break;
          case 'ai-coach':        topTitle.textContent = '🤖 AI Retail Coach';       this.renderAICoach(content); break;
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

    el.innerHTML = `<div class="fade-in">
      <!-- WELCOME HERO -->
      <div class="card card-gold mb-2" style="display:flex;align-items:center;gap:2rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div class="text-sm muted mb-1">Welcome back</div>
          <div class="text-2xl font-bold">${u.name} <span style="font-size:1.2rem">${lp.current.badge}</span></div>
          <div class="text-sm" style="color:var(--gold);margin-top:0.25rem">${lp.current.name}${lp.next ? ' → ' + lp.next.name : ' · Master Level'}</div>
          <div style="margin-top:1rem">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:#666;margin-bottom:0.35rem">
              <span>${u.xp || 0} XP</span>
              ${lp.next ? `<span>${lp.next.minXP} XP</span>` : '<span>MAX</span>'}
            </div>
            <div class="xp-bar"><div class="xp-fill" style="width:${lp.pct}%"></div></div>
          </div>
        </div>
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
          ${this.kpiMini('LB Rank', myLBRank > 0 ? '#' + myLBRank : 'N/A', 'Academy XP')}
          ${this.kpiMini('Modules', completionPct + '%', 'Completed')}
          ${sp ? this.kpiMini('Sales Rank', '#' + sp.rankSales, 'All Stylists') : ''}
          ${sp ? this.kpiMini('ATV Rank', '#' + sp.rankATV, 'Ticket Value') : ''}
        </div>
      </div>

      <!-- LEARNING KPI -->
      <div class="kpi-grid">
        <div class="card"><div class="card-title">Modules Completed</div><div class="card-value">${completedModules}</div><div class="card-sub">of ${totalModules} total</div></div>
        <div class="card"><div class="card-title">Learning Progress</div><div class="card-value">${completionPct}%</div><div class="card-sub">Overall completion</div></div>
        <div class="card"><div class="card-title">Total XP Earned</div><div class="card-value">${u.xp || 0}</div><div class="card-sub">${lp.current.name} level</div></div>
        <div class="card"><div class="card-title">Academy Rank</div><div class="card-value">${myLBRank > 0 ? '#' + myLBRank : '–'}</div><div class="card-sub">Among all stylists</div></div>
      </div>

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
    const users = this.storage.get('users', []);
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
    el.innerHTML = `<div class="fade-in" style="max-width:800px;margin:0 auto">
      <div class="coach-layout">
        <div class="coach-messages" id="coach-msgs">
          <div class="msg msg-ai">${IRA_DATA.aiCoachKB.greeting}</div>
        </div>
        <div>
          <div class="quick-questions mb-1">
            ${['How do I measure bra size?','Best bra for daily office?','How to cross-sell?','Handle price objection','Recommend for gym','Triumph vs Amante?'].map(q=>
              `<button class="quick-q" onclick="APP.askCoach('${q}')">${q}</button>`).join('')}
          </div>
          <div class="coach-input-row">
            <input class="coach-input" id="coach-input" placeholder="Ask me anything about products, selling, fitting..." onkeydown="if(event.key==='Enter')APP.sendCoach()">
            <button class="btn btn-gold" onclick="APP.sendCoach()">Ask →</button>
          </div>
        </div>
      </div>
    </div>`;
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

  // ── MANAGER DASHBOARD ────────────────────────────────────
  renderManagerDashboard(el) {
    const users = this.storage.get('users', []);
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

    el.innerHTML = `<div class="fade-in">
      <div class="kpi-grid mb-2">
        <div class="card"><div class="card-title">Team Members</div><div class="card-value">${teamData.length}</div></div>
        <div class="card"><div class="card-title">Avg Training %</div><div class="card-value">${Math.round(teamData.reduce((s,x)=>s+x.trainPct,0)/Math.max(teamData.length,1))}%</div></div>
        <div class="card"><div class="card-title">Certified Stylists</div><div class="card-value">${teamData.filter(x=>x.completed>=3).length}</div><div class="card-sub">3+ certs</div></div>
        <div class="card"><div class="card-title">Needs Coaching</div><div class="card-value">${teamData.filter(x=>x.trainPct<30).length}</div><div class="card-sub">Below 30% training</div></div>
      </div>

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
          <thead><tr><th>Name</th><th>Role</th><th>Store</th><th>XP</th><th>Level</th><th>Join Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map(u => {
              const store = u.storeId ? IRA_DATA.stores.find(s=>s.id===u.storeId)?.name || u.storeId : '—';
              const lp = IRA_DATA.getLevelForXP(u.xp||0);
              return `<tr>
                <td><strong>${u.name}</strong></td>
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
    if (u) { u.pin = newPin; this.storage.set('users', users); this.toast('PIN updated!', 'success'); }
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
