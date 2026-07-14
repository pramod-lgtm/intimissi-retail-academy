// ============================================================
//  JC CYCLE PERFORMANCE DATA — JULY 2026
//  Source: Target for Jul'26.xlsx + JC Cycle Achievments.xlsx
//  JC Cycle: Day 1–10 (Cycle 1), 11–20 (Cycle 2), 21–31 (Cycle 3)
// ============================================================

const JC_DATA = {
  month: 'July 2026',
  monthCode: '2026-07',
  totalTarget: 4750000,
  updatedAt: '2026-07-07',

  // ── STORE DEFINITIONS ─────────────────────────────────────
  stores: [
    {
      id: '001', code: 'Mn', name: '001 Mahagun',
      shortName: 'Mahagun',
      keyPersons: [{ name: 'Aradhya', user: 'aradhya', split: 100 }],
      monthTarget: 650000, incentive: 3250,
      userCode: 'Mgsales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 208000,  achieved: 117741 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 214500,  achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 227500,  achieved: 0 }
      ]
    },
    {
      id: '002', code: 'Br', name: '002 Burari',
      shortName: 'Burari',
      keyPersons: [{ name: 'Khushi', user: 'khushi', split: 100 }],
      monthTarget: 480000, incentive: 2400,
      userCode: 'Burarisales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 151200, achieved: 50708 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 164400, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 164400, achieved: 0 }
      ]
    },
    {
      id: '004', code: 'Kn', name: '004 Kamla Nagar',
      shortName: 'Kamla Nagar',
      keyPersons: [{ name: 'Sonali', user: 'sonali', split: 50 }, { name: 'Shalu', user: 'shaalu', split: 50 }],
      monthTarget: 920000, incentive: 4600,
      userCode: 'Knsales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 294400, achieved: 112338 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 303600, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 322000, achieved: 0 }
      ]
    },
    {
      id: '006', code: 'V3s', name: '006 V3s',
      shortName: 'V3s',
      keyPersons: [{ name: 'Pinki', user: 'pinki', split: 100 }],
      monthTarget: 620000, incentive: 3100,
      userCode: 'V3ssales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 196850, achieved: 118519 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 209250, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 213900, achieved: 0 }
      ]
    },
    {
      id: '007', code: 'Roh', name: '007 Rohini',
      shortName: 'Rohini',
      keyPersons: [{ name: 'Preeti', user: 'preeti.roh', split: 67 }, { name: 'Priyanka', user: 'priyanka', split: 33 }],
      monthTarget: 820000, incentive: 4100,
      userCode: 'Rohinisales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 258300, achieved: 149076 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 278800, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 282900, achieved: 0 }
      ]
    },
    {
      id: '008', code: 'Ee', name: '008 Elan Epic',
      shortName: 'Elan Epic',
      keyPersons: [{ name: 'Preeti', user: 'preeti', split: 50 }, { name: 'Vandana', user: 'vandana', split: 50 }],
      monthTarget: 320000, incentive: 1600,
      userCode: 'Epicsales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 102400, achieved: 6323 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 105600, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 112000, achieved: 0 }
      ]
    },
    {
      id: '009', code: 'Av', name: '009 Pacific Av',
      shortName: 'Pacific Av',
      keyPersons: [{ name: 'Shilat', user: 'shilat', split: 100 }],
      monthTarget: 520000, incentive: 2600,
      userCode: 'Pacificsales',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 166400, achieved: 48875 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 171600, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 182000, achieved: 0 }
      ]
    },
    {
      id: '010', code: 'Mk', name: '010 Mukherjee Nagar',
      shortName: 'Mukherjee Nagar',
      keyPersons: [{ name: 'Sneha', user: 'sneha', split: 100 }],
      monthTarget: 420000, incentive: 2100,
      userCode: 'Mngrsale',
      cycles: [
        { n: 1, label: 'Jul 1–10',  start: '2026-07-01', end: '2026-07-10', target: 134400, achieved: 48297 },
        { n: 2, label: 'Jul 11–20', start: '2026-07-11', end: '2026-07-20', target: 138600, achieved: 0 },
        { n: 3, label: 'Jul 21–31', start: '2026-07-21', end: '2026-07-31', target: 147000, achieved: 0 }
      ]
    }
  ],

  // ── DAILY STORE ACHIEVEMENT (seeded from Excel) ───────────
  // Shape: { date, stores: { storeId: amount } }
  daily: [
    { date: '2026-07-01', '001': 11812, '002': 4032,  '004': 12724, '006': 7515,  '007': 35314, '008': 0,    '009': 11592, '010': 12676 },
    { date: '2026-07-02', '001': 19942, '002': 16667, '004': 7282,  '006': 22566, '007': 14898, '008': 3026, '009': 0,     '010': 6098  },
    { date: '2026-07-03', '001': 9205,  '002': 9826,  '004': 21093, '006': 17070, '007': 26760, '008': 0,    '009': 9190,  '010': 2765  },
    { date: '2026-07-04', '001': 17870, '002': 6364,  '004': 25271, '006': 24281, '007': 24101, '008': 540,  '009': 9104,  '010': 6293  },
    { date: '2026-07-05', '001': 35593, '002': 6798,  '004': 35069, '006': 32533, '007': 26535, '008': 2757, '009': 13010, '010': 16439 },
    { date: '2026-07-06', '001': 23319, '002': 7021,  '004': 9200,  '006': 14554, '007': 17880, '008': 0,    '009': 5979,  '010': 4026  },
    { date: '2026-07-07', '001': 0,     '002': 0,     '004': 1699,  '006': 0,     '007': 3588,  '008': 0,    '009': 0,     '010': 0     }
  ],

  // ── HELPER: get current JC cycle number for a date ────────
  getCurrentCycle(dateStr) {
    const d = dateStr ? parseInt(dateStr.split('-')[2]) : new Date().getDate();
    return d <= 10 ? 1 : d <= 20 ? 2 : 3;
  },

  // ── HELPER: stores where this user is a JC key person ──────
  // Matches by exact username first, then first name; Store Managers
  // also match their store by 3-digit id prefix. Never falls back to
  // all stores — privacy: non-key-persons see nothing here.
  getStoresForUser(u) {
    if (!u) return [];
    const uname = (u.username || '').toLowerCase();
    const first = (u.name || '').split(' ')[0].toLowerCase();
    const isMgr = u.role === 'Store Manager';
    return this.stores.filter(s =>
      s.keyPersons.some(kp => (kp.user && kp.user === uname) || kp.name.toLowerCase() === first) ||
      (isMgr && u.storeId && s.id === String(u.storeId).slice(0, 3))
    );
  },

  // ── HELPER: get live daily data (localStorage overrides built-in) ──
  getLiveDaily() {
    try {
      const saved = localStorage.getItem('jc_daily_' + this.monthCode);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return this.daily;
  },

  // ── HELPER: get live store data merged with uploads ────────
  getLiveStore(storeId) {
    const store = this.stores.find(s => s.id === storeId);
    if (!store) return null;
    try {
      const saved = localStorage.getItem('jc_cycles_' + this.monthCode);
      if (saved) {
        const cycles = JSON.parse(saved);
        const storeCycles = cycles[storeId];
        if (storeCycles) {
          return { ...store, cycles: store.cycles.map((c, i) => ({ ...c, achieved: storeCycles[i] ?? c.achieved })) };
        }
      }
    } catch(e) {}
    return store;
  },

  // ── HELPER: compute totals for a store ─────────────────────
  getStoreTotals(storeId) {
    const store = this.getLiveStore(storeId);
    if (!store) return null;
    const totalAchieved = store.cycles.reduce((s, c) => s + c.achieved, 0);
    const monthPct = store.monthTarget > 0 ? totalAchieved / store.monthTarget : 0;
    const c1 = store.cycles[0];
    const c1Pct = c1.target > 0 ? c1.achieved / c1.target : 0;
    const daily = this.getLiveDaily();
    const storeDailyData = daily.map(d => ({ date: d.date, amount: d[storeId] || 0 }));
    return { store, totalAchieved, monthPct, c1Pct, storeDailyData };
  }
};
