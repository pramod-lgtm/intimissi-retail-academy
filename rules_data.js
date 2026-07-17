// ============================================================
//  RPIMS DEFAULT RULES — Retail Performance & Incentive Mgmt
//  These are FALLBACK defaults. Live rules are edited in the
//  admin Rule Engine and stored in cloud config (rpims_rules).
//  Never hardcode changes here — use the admin panel.
// ============================================================

const DEFAULT_RULES = {
  version: 1,
  effectiveFrom: '2026-07',

  // Six pillars — weights must total 100
  weights: {
    sales:     { label: 'Sales Excellence',       pct: 40 },
    brand:     { label: 'Brand Excellence',        pct: 20 },
    ops:       { label: 'Operational Excellence',  pct: 15 },
    customer:  { label: 'Customer Excellence',     pct: 10 },
    learning:  { label: 'Learning & Compliance',   pct: 10 },
    behaviour: { label: 'Team Behaviour',          pct: 5 }
  },

  // Credits needed in a month for 100% of each pillar (sales is scored
  // from target achievement directly, so it has no credit target)
  pillarTargets: { brand: 400, ops: 1200, customer: 400, learning: 400, behaviour: 200 },

  // RPI → incentive multiplier bands (highest matching band wins)
  multiplierBands: [
    { minRPI: 90, mult: 1.10 },
    { minRPI: 75, mult: 1.00 },
    { minRPI: 60, mult: 0.80 },
    { minRPI: 0,  mult: 0.60 }
  ],

  // Incentive slabs — % achievement → payout % of realised sales
  slabs: {
    keyPerson:  [ { min: 100, pct: 0.30 }, { min: 110, pct: 0.40 }, { min: 120, pct: 0.50 } ],
    jcBonus:    [ { min: 100, pct: 0.10 }, { min: 110, pct: 0.20 }, { min: 120, pct: 0.30 } ],
    individual: [ { min: 100, pct: 0.10 }, { min: 105, pct: 0.15 }, { min: 110, pct: 0.20 } ]
  },

  // Brand-wise incentive rules: flat % of brand sales, or slabs on brand
  // target achievement (needs Brand column in the executive upload)
  brandRules: {
    IMP:      { mode: 'flat', pct: 0.5 },
    Fablush:  { mode: 'slab', slabs: [ { min: 100, pct: 2.0 }, { min: 90, pct: 1.5 }, { min: 80, pct: 1.0 }, { min: 70, pct: 0.5 } ] },
    Vieviana: { mode: 'flat', pct: 0.5 },
    Triumph:  { mode: 'flat', pct: 0.5 },
    Enamor:   { mode: 'flat', pct: 0.5 }
  },

  // Credit catalog — one tap for managers/admins. Pillar keys above.
  credits: [
    { code: 'display_photo',   label: 'Morning Display Photo',   amt:  50,  pillar: 'ops' },
    { code: 'vm_approved',     label: 'VM Approved',             amt: 100,  pillar: 'ops' },
    { code: 'promo_ontime',    label: 'Promo Executed On Time',  amt:  80,  pillar: 'ops' },
    { code: 'checklist',       label: 'Opening/Closing Checklist', amt: 40, pillar: 'ops' },
    { code: 'query_5min',      label: 'Query Answered in 5 min', amt:  50,  pillar: 'customer' },
    { code: 'lost_feedback',   label: 'Lost Feedback Captured',  amt:  30,  pillar: 'customer' },
    { code: 'customer_photo',  label: 'Customer Photo',          amt:  20,  pillar: 'customer' },
    { code: 'google_review',   label: 'Google Review',           amt:  80,  pillar: 'customer' },
    { code: 'new_loyalty',     label: 'New Loyalty Signup',      amt:  60,  pillar: 'customer' },
    { code: 'bra_set',         label: 'Bra Set Sold',            amt: 100,  pillar: 'brand' },
    { code: 'premium_product', label: 'Premium Product Sold',    amt:  40,  pillar: 'brand' },
    { code: 'brand_focus',     label: 'Brand Focus Push',        amt:  50,  pillar: 'brand' },
    { code: 'morning_brief',   label: 'Morning Brief Attended',  amt:  20,  pillar: 'learning' },
    { code: 'helping_hand',    label: 'Helped a Colleague',      amt:  40,  pillar: 'behaviour' },
    { code: 'cross_support',   label: 'Cross-Team Support',      amt:  50,  pillar: 'behaviour' },
    // Deductions
    { code: 'absent',          label: 'Absent',                  amt: -200, pillar: 'ops' },
    { code: 'late',            label: 'Late Arrival',            amt:  -50, pillar: 'ops' },
    { code: 'no_display',      label: 'No Display Photo',        amt: -100, pillar: 'ops' },
    { code: 'wrong_vm',        label: 'Wrong VM',                amt: -100, pillar: 'ops' },
    { code: 'no_lost_fb',      label: 'No Lost Feedback',        amt:  -30, pillar: 'customer' },
    { code: 'late_reply',      label: 'Late Query Reply',        amt:  -20, pillar: 'customer' },
    { code: 'complaint',       label: 'Customer Complaint',      amt: -100, pillar: 'customer' },
    { code: 'wrong_billing',   label: 'Wrong Billing',           amt: -150, pillar: 'ops' },
    { code: 'no_loyalty',      label: 'No Loyalty Capture',      amt:  -40, pillar: 'customer' },
    { code: 'no_brief',        label: 'Missed Morning Brief',    amt:  -20, pillar: 'learning' },
    { code: 'grooming',        label: 'Improper Grooming',       amt:  -50, pillar: 'ops' }
  ],

  // Automatic credits from app activity
  autoCredits: {
    modulePassed:    { amt: 40, pillar: 'learning', label: 'Module Passed' },
    applauseReceived:{ amt: 20, pillar: 'behaviour', label: 'Applause Received' }
  },

  // Wallet milestones (lifetime credits)
  milestones: [
    { at: 1000,  reward: 'Bronze Certificate' },
    { at: 2500,  reward: 'Recognition on Wall + Lunch Coupon' },
    { at: 5000,  reward: 'Silver Certificate + Shopping Voucher' },
    { at: 10000, reward: 'Gold Certificate + Extra Leave' },
    { at: 20000, reward: 'Priority Promotion Review' }
  ],

  // Redeemable rewards catalog (spend current credit balance)
  rewards: [
    { code: 'lunch',      label: 'Lunch Coupon',          cost: 500,  icon: '🍱' },
    { code: 'cert',       label: 'Achievement Certificate', cost: 800, icon: '🎓' },
    { code: 'voucher1k',  label: '₹1000 Shopping Voucher', cost: 2000, icon: '🛍️' },
    { code: 'leave',      label: 'Extra Half-Day Leave',   cost: 3000, icon: '🌴' },
    { code: 'merch',      label: 'Company Merchandise',    cost: 3500, icon: '👕' },
    { code: 'promo',      label: 'Priority Promotion Review', cost: 8000, icon: '🚀' }
  ]
};
