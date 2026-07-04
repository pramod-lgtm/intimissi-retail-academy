// ============================================================
//  INTIMISSI RETAIL ACADEMY — DATA LAYER
//  All brand, category, quiz, employee, store, level data
// ============================================================

const IRA_DATA = {

  // ── EMPLOYEE LEVELS (RPG System) ──────────────────────────
  levels: [
    { id: 1,  name: 'Recruit',          minXP: 0,     badge: '🌱', color: '#7cb342', title: 'Just getting started' },
    { id: 2,  name: 'Junior Stylist',   minXP: 500,   badge: '💫', color: '#1e88e5', title: 'Learning the craft' },
    { id: 3,  name: 'Stylist',          minXP: 1500,  badge: '✨', color: '#00897b', title: 'Building confidence' },
    { id: 4,  name: 'Senior Stylist',   minXP: 3000,  badge: '⭐', color: '#8e24aa', title: 'Trusted professional' },
    { id: 5,  name: 'Fit Specialist',   minXP: 6000,  badge: '🎯', color: '#f4511e', title: 'Fitting expert' },
    { id: 6,  name: 'Bra Expert',       minXP: 10000, badge: '💎', color: '#e91e63', title: 'Product authority' },
    { id: 7,  name: 'Master Corsetier', minXP: 15000, badge: '🏅', color: '#880e4f', title: 'Elite craftsperson' },
    { id: 8,  name: 'Elite Stylist',    minXP: 22000, badge: '👑', color: '#c9a84c', title: 'Top performer' },
    { id: 9,  name: 'Retail Champion',  minXP: 30000, badge: '🔥', color: '#d32f2f', title: 'Store legend' },
    { id: 10, name: 'Legend',           minXP: 50000, badge: '🌟', color: '#f9a825', title: 'Intimissi Hall of Fame' }
  ],

  // ── BADGE DEFINITIONS ─────────────────────────────────────
  badges: [
    // Academy Badges
    { id:'first_quiz',   name:'First Step',        icon:'🎓', desc:'Passed your first quiz',           tier:'bronze',   category:'academy' },
    { id:'quiz5',        name:'Quiz Hustler',       icon:'📝', desc:'Passed 5 quizzes',                 tier:'silver',   category:'academy' },
    { id:'quiz10',       name:'Knowledge Seeker',   icon:'🧠', desc:'Passed 10 quizzes',                tier:'gold',     category:'academy' },
    { id:'perfect_quiz', name:'Perfect Score',      icon:'💯', desc:'100% on any quiz',                 tier:'gold',     category:'academy' },
    { id:'all_brands',   name:'Brand Master',       icon:'🏷️', desc:'Completed all brand modules',      tier:'platinum', category:'academy' },
    { id:'all_cats',     name:'Category Expert',    icon:'📂', desc:'Completed all category modules',   tier:'gold',     category:'academy' },
    { id:'all_skills',   name:'Selling Pro',        icon:'💼', desc:'Completed all selling modules',    tier:'gold',     category:'academy' },
    { id:'all_modules',  name:'Complete Package',   icon:'🎯', desc:'Completed every single module',    tier:'diamond',  category:'academy' },
    // Streak Badges
    { id:'streak3',      name:'Hot Streak',         icon:'🔥', desc:'3-day login streak',               tier:'bronze',   category:'streak' },
    { id:'streak7',      name:'Week Warrior',       icon:'⚡', desc:'7-day login streak',               tier:'silver',   category:'streak' },
    { id:'streak14',     name:'Two Week Force',     icon:'💪', desc:'14-day login streak',              tier:'gold',     category:'streak' },
    { id:'streak30',     name:'Monthly Legend',     icon:'🌟', desc:'30-day login streak',              tier:'diamond',  category:'streak' },
    // XP Badges
    { id:'xp500',        name:'Rising Star',        icon:'⭐', desc:'Reached 500 XP',                  tier:'bronze',   category:'xp' },
    { id:'xp2000',       name:'XP Machine',         icon:'💫', desc:'Reached 2000 XP',                 tier:'silver',   category:'xp' },
    { id:'xp5000',       name:'Power Level',        icon:'🏆', desc:'Reached 5000 XP',                 tier:'gold',     category:'xp' },
    { id:'xp10000',      name:'XP Titan',           icon:'👑', desc:'Reached 10,000 XP',               tier:'diamond',  category:'xp' },
    // Sales Excellence (rank-based, no ₹ values shown to stylists)
    { id:'atv_top10',    name:'High Ticket',        icon:'🎫', desc:'Top 10% ATV in store',            tier:'silver',   category:'sales' },
    { id:'upt_top10',    name:'Bundle King/Queen',  icon:'📦', desc:'Top 10% UPT in store',            tier:'silver',   category:'sales' },
    { id:'conv_top10',   name:'Closer',             icon:'🎯', desc:'Top 10% conversion rate',         tier:'silver',   category:'sales' },
    { id:'rank1',        name:'Store Champion',     icon:'🥇', desc:'Ranked #1 in your store',         tier:'gold',     category:'sales' },
    { id:'rank_top3',    name:'Podium Finisher',    icon:'🏆', desc:'Top 3 in store this month',       tier:'gold',     category:'sales' },
    // Social Badges
    { id:'first_applause',name:'Fan Favourite',     icon:'👏', desc:'Received your first applause',    tier:'bronze',   category:'social' },
    { id:'applause10',   name:'Crowd Pleaser',      icon:'🎉', desc:'Received 10 applauses',           tier:'silver',   category:'social' },
    { id:'gave_applause',name:'Team Player',        icon:'🤝', desc:'Gave applause to a colleague',    tier:'bronze',   category:'social' },
    // Mission Badges
    { id:'mission1',     name:'Mission Ready',      icon:'📋', desc:'Completed your first mission',    tier:'bronze',   category:'mission' },
    { id:'mission10',    name:'Mission Possible',   icon:'🚀', desc:'Completed 10 missions',           tier:'silver',   category:'mission' },
    { id:'mission30',    name:'Mission Impossible', icon:'💥', desc:'Completed 30 missions',           tier:'gold',     category:'mission' },
    // Special
    { id:'early_bird',   name:'Early Bird',         icon:'🌅', desc:'Logged in before 9am',            tier:'bronze',   category:'special' },
    { id:'night_owl',    name:'Night Owl',           icon:'🦉', desc:'Logged in after 8pm',             tier:'bronze',   category:'special' },
    { id:'weekend_grind',name:'Weekend Warrior',    icon:'🗓️', desc:'Trained on a weekend',            tier:'silver',   category:'special' }
  ],

  // ── MISSION TEMPLATES ─────────────────────────────────────
  missionTemplates: [
    { id:'m_quiz',      text:'Complete any {n} quiz today',       xp:50,  type:'quiz',    target:1 },
    { id:'m_video',     text:'Watch a training video',            xp:30,  type:'video',   target:1 },
    { id:'m_brand',     text:'Finish a brand module',             xp:80,  type:'brand',   target:1 },
    { id:'m_login',     text:'Log in 3 days in a row',            xp:40,  type:'streak',  target:3 },
    { id:'m_atv',       text:'Focus on ATV — upsell every bill',  xp:60,  type:'sales',   target:0 },
    { id:'m_upt',       text:'Add a cross-sell item each bill',   xp:60,  type:'sales',   target:0 },
    { id:'m_applause',  text:'Recognise a teammate today',        xp:20,  type:'social',  target:1 },
    { id:'m_score',     text:'Score 80%+ on any quiz',            xp:70,  type:'quiz',    target:1 }
  ],

  // ── PERFORMANCE INDEX WEIGHTS ─────────────────────────────
  piWeights: {
    salesRankPctile:   0.35,  // rank among all SPs
    atvPctile:         0.25,  // avg ticket value percentile
    uptPctile:         0.20,  // units per ticket percentile
    academyCompletion: 0.12,  // % of modules completed
    streakBonus:       0.08   // streak consistency
  },

  // ── STORES ────────────────────────────────────────────────
  stores: [
    { id: 'AMANORA', name: 'Amanora Mall',      city: 'Pune'    },
    { id: 'PHOENIX', name: 'Phoenix MarketCity', city: 'Pune'    },
    { id: 'SEASONS', name: 'Seasons Mall',       city: 'Pune'    },
    { id: 'NEXUS',   name: 'Nexus Mall',         city: 'Pune'    },
    { id: 'PALLADIUM',name:'Palladium Mall',     city: 'Mumbai'  },
    { id: 'INFINITI', name:'Infiniti Mall',      city: 'Mumbai'  },
    { id: 'FORUM',   name: 'Forum Mall',         city: 'Bangalore'},
    { id: 'ORION',   name: 'Orion Mall',         city: 'Bangalore'}
  ],

  // ── DEFAULT USERS ─────────────────────────────────────────
  defaultUsers: [
    { id:'admin1', name:'Admin User',     role:'Super Admin',    storeId:null,      pin:'0000', xp:9999, level:5, joinDate:'2022-01-01' },
    { id:'hr1',    name:'Priya Sharma',   role:'HR',             storeId:null,      pin:'1111', xp:4200, level:4, joinDate:'2022-03-15' },
    { id:'ops1',   name:'Rahul Mehta',    role:'Operations Head',storeId:null,      pin:'2222', xp:5100, level:5, joinDate:'2021-06-01' },
    { id:'am1',    name:'Sneha Patel',    role:'Area Manager',   storeId:null,      pin:'3333', xp:3800, level:4, joinDate:'2022-01-20' },
    { id:'sm1',    name:'Kavya Rao',      role:'Store Manager',  storeId:'PHOENIX', pin:'4444', xp:2900, level:4, joinDate:'2022-07-10' },
    { id:'ss1',    name:'Anita Desai',    role:'Senior Stylist', storeId:'PHOENIX', pin:'5555', xp:2100, level:3, joinDate:'2023-02-14' },
    { id:'rs1',    name:'Meera Joshi',    role:'Retail Stylist', storeId:'PHOENIX', pin:'6666', xp: 750, level:2, joinDate:'2024-04-01' },
    { id:'rs2',    name:'Divya Singh',    role:'Retail Stylist', storeId:'AMANORA', pin:'7777', xp: 220, level:1, joinDate:'2025-01-10' },
    { id:'rs3',    name:'Pooja Kumar',    role:'Retail Stylist', storeId:'SEASONS', pin:'8888', xp:1200, level:2, joinDate:'2023-11-05' },
    { id:'rs4',    name:'Ritu Nair',      role:'Retail Stylist', storeId:'NEXUS',   pin:'9999', xp:3300, level:4, joinDate:'2022-09-18' }
  ],

  // ── BRANDS ────────────────────────────────────────────────
  brands: [
    {
      id: 'amante',
      name: 'Amante',
      tagline: 'Discover Yourself',
      logo: '💗',
      color: '#e91e63',
      targetCustomer: 'Modern urban woman, 25–40 years, fashion-forward, seeks comfort with style',
      priceRange: '₹699 – ₹2,499',
      usp: 'European-inspired silhouettes tailored for the Indian body — full coverage with fashionable design',
      fabric: 'Microfibre, Lace, Cotton blends, Memory foam cups',
      bestSellers: ['T-Shirt Bra', 'Full Coverage Bra', 'Seamless Panties'],
      crossSell: ['Matching panties', 'Camisoles', 'Shapewear'],
      objectionHandling: {
        'Price is high': 'Amante uses premium European-grade microfibre — it retains shape wash after wash. Cost per wear is actually lower than budget brands.',
        'Not my size': 'Amante offers 28AA to 42F — one of the widest ranges in India. Let me measure you for the perfect fit.',
        'I prefer cotton': 'Our microfibre is softer than cotton and moisture-wicking — much better for all-day wear.'
      },
      videoFile: 'amante brand soni.mp4',
      trainer: 'Soni',
      quiz: [
        { q:'What is Amante\'s core USP?', opts:['Budget pricing','European-inspired Indian fit','Only cotton fabric','Limited size range'], ans:1, diff:'easy' },
        { q:'What is Amante\'s price range?', opts:['₹299–₹999','₹699–₹2,499','₹2,500–₹5,000','₹100–₹500'], ans:1, diff:'easy' },
        { q:'Which fabric technology does Amante primarily use?', opts:['Only cotton','Silk blends','Microfibre & memory foam','Nylon only'], ans:2, diff:'medium' },
        { q:'A customer says Amante is expensive. Best response?', opts:['Offer a discount immediately','Explain cost per wear and premium fabric quality','Say nothing','Suggest a cheaper brand'], ans:1, diff:'medium' },
        { q:'Amante\'s target customer is:', opts:['Teenager, 13–18','Modern urban woman, 25–40','Senior woman, 60+','Working professional, 50+'], ans:1, diff:'easy' },
        { q:'Which of these is an Amante best-seller?', opts:['Sports bra only','T-shirt bra','Strapless only','Nursing bra'], ans:1, diff:'easy' },
        { q:'What cross-sell works best with an Amante bra?', opts:['Socks','Matching Amante panties','Hair accessories','Shoes'], ans:1, diff:'medium' },
        { q:'Amante size range goes up to:', opts:['36C','38D','42F','40B'], ans:2, diff:'medium' },
        { q:'SCENARIO: Customer wants a bra for office daily wear with full support. Best Amante recommendation?', opts:['Sports bra','Fashion bralette','Full Coverage Microfibre T-shirt bra','Strapless fashion bra'], ans:2, diff:'hard' },
        { q:'Amante is inspired by which region\'s fashion sensibility?', opts:['American','Korean','European','African'], ans:2, diff:'easy' }
      ]
    },
    {
      id: 'c9',
      name: 'C9',
      tagline: 'Performance Meets Style',
      logo: '🏃',
      color: '#00897b',
      targetCustomer: 'Active woman, 20–35 years, gym-goer, yoga practitioner, fitness enthusiast',
      priceRange: '₹599 – ₹1,999',
      usp: 'High-performance activewear bras with superior moisture-wicking and bounce control',
      fabric: 'Nylon, Spandex, Dry-fit technology, Anti-odour treatment',
      bestSellers: ['Sports Bra (High Support)', 'Yoga Bra', 'Active Shorts'],
      crossSell: ['Active leggings', 'Gym shorts', 'Socks', 'Water bottles'],
      objectionHandling: {
        'Price is high': 'C9 uses advanced moisture-wicking Dri-fit technology that keeps you comfortable through 2-hour workouts. Performance gear is an investment in your health.',
        'Regular bra works for gym': 'Regular bras lack the support and flexibility needed. C9 sports bras prevent tissue damage during high-impact activities.'
      },
      videoFile: 'C9.mp4',
      trainer: 'Team',
      quiz: [
        { q:'C9 primarily targets which customer?', opts:['Bridal shoppers','Active fitness women','Senior women','Office workers only'], ans:1, diff:'easy' },
        { q:'What technology makes C9 ideal for workouts?', opts:['Cotton comfort','Dry-fit moisture wicking','Silk smooth','Lace fashion'], ans:1, diff:'easy' },
        { q:'Best cross-sell with a C9 sports bra?', opts:['Formal wear','Active leggings or gym shorts','Evening gown','Silk camisole'], ans:1, diff:'easy' },
        { q:'C9 price range is:', opts:['₹99–₹299','₹599–₹1,999','₹3,000–₹6,000','₹200–₹500'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer is buying a C9 sports bra for high-impact running. What support level should you recommend?', opts:['Light support bralette','Medium support yoga bra','High support sports bra','Fashion bra'], ans:2, diff:'medium' },
        { q:'Which fabric is NOT typically used in C9?', opts:['Spandex','Nylon','Pure silk','Dry-fit blend'], ans:2, diff:'medium' },
        { q:'Why is a regular bra unsuitable for gym workouts?', opts:['It\'s too expensive','Lacks bounce control and flexibility','Too many colours','Not fashionable'], ans:1, diff:'medium' },
        { q:'C9 anti-odour treatment helps with:', opts:['Water resistance','Bacteria and sweat odour during exercise','UV protection','Heat retention'], ans:1, diff:'hard' }
      ]
    },
    {
      id: 'enamor',
      name: 'Enamor',
      tagline: 'Made With Love',
      logo: '❤️',
      color: '#c62828',
      targetCustomer: 'Value-conscious woman, 28–45, seeking everyday comfort and reliability',
      priceRange: '₹449 – ₹1,499',
      usp: 'India\'s most trusted everyday bra brand — perfect fit, lasting comfort, great value',
      fabric: 'Cotton, Cotton-modal blends, Light microfibre',
      bestSellers: ['Cotton Everyday Bra', 'Wirefree Bra', 'Everyday Panties'],
      crossSell: ['Everyday panties', 'Camisoles', 'Shapewear'],
      objectionHandling: {
        'Too expensive for cotton': 'Enamor uses premium cotton blends with reinforced stitching — they outlast cheaper brands by 3x.',
        'Same as other brands': 'Enamor is India\'s No.1 bra brand. The fit is engineered specifically for Indian body proportions.'
      },
      videoFile: 'Enamor.mp4',
      trainer: 'Team',
      quiz: [
        { q:'Enamor is best positioned as:', opts:['Luxury brand','Value everyday comfort brand','Sports brand','Bridal brand'], ans:1, diff:'easy' },
        { q:'Enamor\'s primary fabric is:', opts:['Pure silk','Latex','Cotton and cotton-modal','Nylon only'], ans:2, diff:'easy' },
        { q:'Best Enamor recommendation for a first-time bra buyer?', opts:['Padded push-up','Cotton everyday wirefree bra','Strapless fashion bra','Sports bra'], ans:1, diff:'medium' },
        { q:'Enamor\'s price range is:', opts:['₹99–₹299','₹449–₹1,499','₹3,000+','₹2,000–₹4,000'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer wants a comfortable bra for daily home and office use, budget ₹600. Best choice?', opts:['Amante premium bra','Enamor cotton everyday bra','C9 sports bra','Triumph luxury bra'], ans:1, diff:'medium' },
        { q:'Enamor is known as India\'s No.1 brand in which segment?', opts:['Sports','Fashion/Lingerie luxury','Everyday bras','Swimwear'], ans:2, diff:'medium' },
        { q:'What is Enamor\'s key USP over cheaper brands?', opts:['It has sequins','Indian proportion fit and durability','Only comes in white','Imported fabric'], ans:1, diff:'hard' }
      ]
    },
    {
      id: 'imp',
      name: 'IMP',
      tagline: 'Intimate Performance',
      logo: '✨',
      color: '#5c6bc0',
      targetCustomer: 'Young woman, 18–30, fashion-forward, seeks trendy accessories and performance innerwear',
      priceRange: '₹399 – ₹1,299',
      usp: 'Trendy accessories, socks, and intimate apparel for young fashion-conscious women',
      fabric: 'Cotton blends, Microfibre, Lace trim',
      bestSellers: ['Fashion Socks', 'Accessories', 'Trendy Panties'],
      crossSell: ['Complete accessory sets', 'Matching socks', 'Intimate apparel'],
      objectionHandling: {
        'Never heard of this brand': 'IMP specialises in accessories and intimate performance wear — it\'s a specialist brand many customers discover and love.',
      },
      videoFile: 'Imp.mp4',
      trainer: 'Team',
      quiz: [
        { q:'IMP primarily targets which age group?', opts:['45–60','18–30 fashion-forward','60+','Children'], ans:1, diff:'easy' },
        { q:'IMP is best known for:', opts:['Luxury lingerie','Accessories and performance intimate wear','Swimwear only','Maternity wear'], ans:1, diff:'easy' },
        { q:'Best cross-sell with IMP accessories?', opts:['Formal wear','Complete matching accessory sets','Sports equipment','Evening gowns'], ans:1, diff:'medium' },
        { q:'SCENARIO: Young college girl wants trendy socks and accessories. Which brand to recommend?', opts:['Triumph','IMP','Enamor','C9'], ans:1, diff:'medium' },
        { q:'IMP price range is:', opts:['₹1,500–₹5,000','₹399–₹1,299','₹50–₹100','₹3,000+'], ans:1, diff:'easy' }
      ]
    },
    {
      id: 'jockey',
      name: 'Jockey',
      tagline: 'Wear the Best',
      logo: '👟',
      color: '#1565c0',
      targetCustomer: 'Comfort-seeking woman/man, 20–50, values quality basics and everyday innerwear',
      priceRange: '₹299 – ₹1,499',
      usp: 'Premium quality basics — the world\'s most trusted innerwear brand known for durability and comfort',
      fabric: 'Premium cotton, Cotton-modal, Micromodal',
      bestSellers: ['Classic Briefs', 'Trunk Boxers', 'T-Shirt Bra', 'Camisoles'],
      crossSell: ['Matching sets', 'Camisoles', 'Loungewear'],
      objectionHandling: {
        'Too expensive for innerwear': 'Jockey lasts 2–3 years versus 6–8 months for cheaper brands. The quality difference is immediate when you wear it.',
        'Brand loyalty to another brand': 'Jockey is worn by over 150 million people worldwide. The comfort is unmatched — just try one pair and you\'ll understand.'
      },
      videoFile: 'Jockey.mp4',
      trainer: 'Team',
      quiz: [
        { q:'Jockey\'s global reputation is based on:', opts:['Fashion trends','Premium quality basics and durability','Luxury pricing','Fast fashion'], ans:1, diff:'easy' },
        { q:'Which fabric makes Jockey Micromodal special?', opts:['Water-resistant','Softer than silk, eco-friendly','Latex-based','Wool blend'], ans:1, diff:'medium' },
        { q:'Jockey target customer is:', opts:['Only young women','Men only','Comfort-seeking 20–50 both genders','Children only'], ans:2, diff:'easy' },
        { q:'Best upsell from Jockey briefs?', opts:['Jockey camisole or loungewear set','Expensive watch','Another brand\'s product','Nothing'], ans:0, diff:'medium' },
        { q:'SCENARIO: Customer says Jockey is expensive for basic underwear. Best response?', opts:['Agree and offer a discount','Explain 2–3 year durability vs 6–8 months cheaper brands','Ignore the objection','Change subject'], ans:1, diff:'hard' },
        { q:'Jockey price range is:', opts:['₹50–₹99','₹299–₹1,499','₹5,000+','₹2,000–₹4,000'], ans:1, diff:'easy' },
        { q:'Jockey Cotton-Modal blend offers:', opts:['Water resistance','Softness and moisture management','UV protection','Fragrance'], ans:1, diff:'medium' }
      ]
    },
    {
      id: 'littlelacy',
      name: 'Little Lacy',
      tagline: 'Delicate. Feminine. You.',
      logo: '🎀',
      color: '#ad1457',
      targetCustomer: 'Young woman, 18–28, seeks feminine lace designs, romantic and occasion wear',
      priceRange: '₹599 – ₹2,199',
      usp: 'Intricate lace lingerie with feminine designs — perfect for special occasions and gifting',
      fabric: 'Lace, Satin, Mesh, Embroidered fabrics',
      bestSellers: ['Lace Bra Sets', 'Bridal Sets', 'Gift Sets'],
      crossSell: ['Matching panties (always)', 'Gift boxes', 'Perfume', 'Camisoles'],
      objectionHandling: {
        'Not comfortable enough': 'Little Lacy uses soft lace lined with microfibre for all-day comfort without compromising the feminine look.',
        'Only for special occasions': 'Our customers wear Little Lacy every day — feeling beautiful daily boosts confidence at work and in life.'
      },
      videoFile: 'littlelacy saniya.mp4',
      trainer: 'Saniya',
      quiz: [
        { q:'Little Lacy is best suited for which occasion?', opts:['Gym workout','Everyday basics','Special occasions and gifting','Maternity'], ans:2, diff:'easy' },
        { q:'What is Little Lacy\'s primary design language?', opts:['Sporty','Minimalist basics','Feminine lace and embroidery','Industrial'], ans:2, diff:'easy' },
        { q:'Best cross-sell with every Little Lacy bra?', opts:['Sports socks','Matching lace panties (always)','Heavy equipment','Kitchen items'], ans:1, diff:'easy' },
        { q:'Little Lacy customer is typically:', opts:['60+ senior','18–28 seeking romance and femininity','Corporate executive, 50+','Child'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer is buying a gift for friend\'s birthday. Best recommendation?', opts:['Basic cotton bra','Little Lacy gift set with lace bra + panty','Sports bra','Men\'s brief'], ans:1, diff:'medium' },
        { q:'Lace comfort objection: "It looks itchy." Best response?', opts:['Agree it\'s itchy','Explain microfibre lining makes it comfortable all day','Say nothing','Offer a refund'], ans:1, diff:'hard' },
        { q:'Little Lacy price range is:', opts:['₹99–₹299','₹599–₹2,199','₹5,000+','₹200–₹400'], ans:1, diff:'easy' }
      ]
    },
    {
      id: 'nkya',
      name: 'Nykaa Fashion',
      tagline: 'Own Your Beauty',
      logo: '💋',
      color: '#e91e63',
      targetCustomer: 'Trend-conscious woman, 20–35, influenced by social media, seeks fashion-forward lingerie',
      priceRange: '₹499 – ₹1,899',
      usp: 'Social media inspired lingerie — vibrant colours, bold designs, photography-worthy aesthetics',
      fabric: 'Lace, Mesh, Satin, Neon fabrics',
      bestSellers: ['Coloured bra sets', 'Bralettes', 'Cheeky panties'],
      crossSell: ['Matching sets', 'Loungewear', 'Bralettes'],
      objectionHandling: {
        'Too bold for me': 'Start with a semi-bold colour — coral or dusty rose — they photograph beautifully and feel confident without being extreme.',
        'Nykaa is just an app': 'Nykaa Fashion lingerie is designed by expert stylists — the quality matches what you see online, often better in person.'
      },
      videoFile: 'NKYA - SHRUTI.mp4',
      trainer: 'Shruti',
      quiz: [
        { q:'Nykaa Fashion lingerie is inspired by:', opts:['Industrial design','Social media trends and bold fashion','Traditional wear','Sports performance'], ans:1, diff:'easy' },
        { q:'Nykaa target customer is:', opts:['Senior women, 60+','Trend-conscious 20–35, social media influenced','Men only','Athletes'], ans:1, diff:'easy' },
        { q:'Best upsell with a Nykaa bralette?', opts:['Boring basics','Bold matching cheeky panty + loungewear set','Sports equipment','Nothing'], ans:1, diff:'medium' },
        { q:'SCENARIO: Customer follows fashion influencers and wants to look good in mirror selfies. Best brand?', opts:['Enamor basics','C9 sports','Nykaa Fashion bold coloured set','Jockey classic white'], ans:2, diff:'medium' },
        { q:'Nykaa price range is:', opts:['₹99–₹199','₹499–₹1,899','₹5,000+','₹3,000–₹6,000'], ans:1, diff:'easy' },
        { q:'Nykaa Fashion\'s standout design feature is:', opts:['Only white and beige colours','Bold colours, vibrant designs, aesthetic appeal','Only cotton fabric','Anti-bacterial only'], ans:1, diff:'medium' }
      ]
    },
    {
      id: 'triumph',
      name: 'Triumph',
      tagline: 'Fit for Life',
      logo: '👸',
      color: '#6a1b9a',
      targetCustomer: 'Discerning woman, 30–55, seeks premium European quality, full support, body confidence',
      priceRange: '₹1,299 – ₹4,999',
      usp: 'German-engineered premium lingerie — superior fit technology, full support, lifelong quality',
      fabric: 'Premium microfibre, Jacquard lace, Memory foam, Sculpting fabrics',
      bestSellers: ['Doreen (Classic Full Cup)', 'Beauty-Full (Support)', 'Satin Deluxe'],
      crossSell: ['Premium shapewear', 'Luxury sleepwear', 'Body'],
      objectionHandling: {
        'Too expensive': 'Triumph bras are engineered in Germany with 130+ years of fit expertise. One Triumph bra lasts 3–5 years. Per-day cost is under ₹3.',
        'Same as cheaper brands': 'Triumph\'s Doreen has been the world\'s best-selling bra for 40+ years — because the fit science is unmatched.',
        'I don\'t need such quality': 'Every woman deserves the right support — poor bra fit causes back pain and posture issues. Triumph prevents that.'
      },
      videoFile: 'Triumph - ranjana.mp4',
      trainer: 'Ranjana',
      quiz: [
        { q:'Triumph is headquartered in:', opts:['France','USA','Germany','Japan'], ans:2, diff:'medium' },
        { q:'Triumph\'s heritage spans how many years?', opts:['10 years','50 years','130+ years','5 years'], ans:2, diff:'hard' },
        { q:'Triumph price range is:', opts:['₹99–₹399','₹1,299–₹4,999','₹5,000–₹10,000','₹500–₹900'], ans:1, diff:'easy' },
        { q:'Triumph\'s world\'s best-selling bra is:', opts:['T-Shirt Bra','The Doreen','Strapless','Sports bra'], ans:1, diff:'medium' },
        { q:'SCENARIO: Customer, 42 years old, has back pain from poor bra support. Best recommendation?', opts:['Cheap cotton bra','Triumph Beauty-Full full support bra','Sports bra','Bralette'], ans:1, diff:'hard' },
        { q:'How do you justify Triumph\'s premium price?', opts:['You don\'t — offer a discount','130 years of German engineering, lasts 3–5 years, <₹3/day','It\'s a famous brand','Nothing more to say'], ans:1, diff:'hard' },
        { q:'Triumph target customer is:', opts:['Teen girls','Discerning woman 30–55 seeking premium quality','Only athletes','Budget shoppers'], ans:1, diff:'easy' },
        { q:'Triumph premium fabric includes:', opts:['Only cotton','Memory foam and premium microfibre','Polyester only','Rubber'], ans:1, diff:'medium' }
      ]
    },
    {
      id: 'wecoal',
      name: 'WECOAL',
      tagline: 'Wear Your World',
      logo: '🌍',
      color: '#2e7d32',
      targetCustomer: 'Eco-conscious woman, 22–38, values sustainability, natural fabrics, ethical fashion',
      priceRange: '₹699 – ₹2,299',
      usp: 'Sustainable intimate wear — organic cotton, eco-friendly dyes, ethical manufacturing',
      fabric: 'GOTS-certified Organic Cotton, Bamboo blend, Natural dyes',
      bestSellers: ['Organic Cotton Bra', 'Bamboo Panties', 'Natural collection'],
      crossSell: ['Organic cotton panties', 'Bamboo sleepwear', 'Eco gift sets'],
      objectionHandling: {
        'Expensive for cotton': 'WECOAL uses GOTS-certified organic cotton — grown without pesticides, better for your skin and the planet.',
        'Not familiar with brand': 'WECOAL is a certified sustainable brand — worn by customers who care about what touches their skin and the Earth.'
      },
      videoFile: 'WECOAL.mp4',
      trainer: 'Team',
      quiz: [
        { q:'WECOAL\'s core brand value is:', opts:['Luxury fashion','Sustainability and eco-consciousness','Sports performance','Fast fashion'], ans:1, diff:'easy' },
        { q:'WECOAL uses which certified organic fabric?', opts:['Regular polyester','GOTS-certified organic cotton','Synthetic only','Nylon'], ans:1, diff:'medium' },
        { q:'WECOAL target customer is:', opts:['Luxury shopper, 55+','Eco-conscious woman, 22–38','Athlete only','Budget shopper'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer mentions she only buys organic, chemical-free products. Best brand?', opts:['Triumph','Jockey','WECOAL','Little Lacy'], ans:2, diff:'medium' },
        { q:'WECOAL price range is:', opts:['₹99–₹299','₹699–₹2,299','₹5,000+','₹50–₹100'], ans:1, diff:'easy' },
        { q:'Bamboo fabric in WECOAL offers:', opts:['Water resistance','Natural anti-bacterial and temperature regulation','UV protection only','No benefits'], ans:1, diff:'hard' }
      ]
    },
    {
      id: 'zewami',
      name: 'Zewami',
      tagline: 'Confidence in Every Curve',
      logo: '💃',
      color: '#e65100',
      targetCustomer: 'Plus-size woman, 25–50, seeks beautiful well-fitting lingerie in larger sizes with full support',
      priceRange: '₹799 – ₹2,999',
      usp: 'India\'s premium plus-size lingerie — sizes 36–52, full support, beautiful designs without compromise',
      fabric: 'Stretch microfibre, Supportive lace, Power mesh, Wide band construction',
      bestSellers: ['Plus-size Full Coverage Bra', 'Minimiser Bra', 'Full Brief'],
      crossSell: ['Shapewear', 'Comfortable full brief', 'Supportive camisole'],
      objectionHandling: {
        'I can\'t find my size anywhere': 'Zewami offers sizes 36 to 52 — one of India\'s widest plus-size ranges. Let me find your perfect size today.',
        'Plus-size lingerie looks frumpy': 'Zewami designs are as beautiful as standard sizes — lace, colours, fashionable cuts — all designed for larger bodies.',
        'Do larger bras give enough support': 'Zewami\'s power mesh panels and wide band construction are engineered specifically for full support at larger sizes.'
      },
      videoFile: 'Zewami - Preeti.mp4',
      trainer: 'Preeti',
      quiz: [
        { q:'Zewami specialises in:', opts:['Petite sizes only','Plus-size lingerie, 36–52','Sports bras only','Teen lingerie'], ans:1, diff:'easy' },
        { q:'Zewami\'s size range is:', opts:['28–34','36–52','24–30','40–42 only'], ans:1, diff:'easy' },
        { q:'Zewami\'s power mesh panels provide:', opts:['Fashion only','Full support for larger sizes','Water resistance','Fragrance'], ans:1, diff:'medium' },
        { q:'SCENARIO: Customer says she can never find her size (44DD). Best response?', opts:['Sorry we don\'t have it','Zewami goes up to 52 — let me find your exact fit right now','Try online','Check another store'], ans:1, diff:'medium' },
        { q:'Best cross-sell with a Zewami full coverage bra?', opts:['Sports equipment','Shapewear or comfortable full brief','Teen accessories','Nothing'], ans:1, diff:'medium' },
        { q:'Zewami price range is:', opts:['₹99–₹299','₹799–₹2,999','₹5,000+','₹200–₹400'], ans:1, diff:'easy' },
        { q:'Zewami target customer is:', opts:['Petite woman only','Plus-size woman 25–50 seeking fashion + support','Teen girl','Athlete'], ans:1, diff:'easy' }
      ]
    }
  ],

  // ── CATEGORIES ───────────────────────────────────────────
  categories: [
    {
      id: 'types-of-bras',
      name: 'Types of Bras',
      icon: '👙',
      color: '#880e4f',
      description: 'Master every bra type — from T-shirt bras to plunge, balconette to full coverage',
      videoFile: 'Types of Bras.mp4',
      types: [
        { name:'T-Shirt Bra', desc:'Smooth, seamless cups. Best for fitted clothing.', customer:'Daily office wear, fitted tops' },
        { name:'Balconette', desc:'Wide-set straps, demi cup. Enhances décolletage.', customer:'Low-neck tops, occasion wear' },
        { name:'Push-Up', desc:'Angled padding lifts and enhances. Creates cleavage.', customer:'Party, evening wear, confidence boost' },
        { name:'Full Coverage', desc:'Covers full breast. Maximum support and comfort.', customer:'Heavy bust, back pain, daily support' },
        { name:'Sports Bra', desc:'High-impact support, moisture-wicking.', customer:'Gym, running, yoga, exercise' },
        { name:'Strapless', desc:'No straps, backless design. Silicone grip.', customer:'Off-shoulder, backless outfits' },
        { name:'Bralette', desc:'Unstructured, no underwire. Comfort first.', customer:'Casual wear, lounging, fashion display' },
        { name:'Underwired', desc:'Wire under cup for shape and lift.', customer:'Formal wear, structured support' }
      ],
      quiz: [
        { q:'Which bra type is best for fitted office wear?', opts:['Sports bra','T-shirt bra','Strapless','Push-up'], ans:1, diff:'easy' },
        { q:'A balconette bra is best suited for:', opts:['High-neck clothing','Low-neck and occasion tops','Sports activities','Maternity'], ans:1, diff:'easy' },
        { q:'Customer needs a bra for backless dress. Recommend:', opts:['Full coverage','Strapless silicone bra','Sports bra','Underwired'], ans:1, diff:'easy' },
        { q:'Full coverage bra is ideal for customer with:', opts:['Small bust wanting enhancement','Heavy bust with back pain','Teen customer','Sports enthusiast'], ans:1, diff:'medium' },
        { q:'What makes a sports bra different from regular bras?', opts:['Colour only','High-impact support and moisture wicking','Price','Design only'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer, 35 years, wears formal shirts daily, heavy bust, has shoulder pain. Best recommendation?', opts:['Push-up bra','Full coverage underwired bra with wide straps','Bralette','Sports bra'], ans:1, diff:'hard' },
        { q:'A push-up bra is recommended for:', opts:['Office daily wear','High-neck tops','Evening party or date wear','Gym workouts'], ans:2, diff:'medium' },
        { q:'Bralette is best described as:', opts:['High support structured bra','Unstructured comfort bra without underwire','Sports performance bra','Padded push-up'], ans:1, diff:'easy' },
        { q:'Which bra type is specifically designed for exercise?', opts:['Balconette','Strapless','Sports bra','Push-up'], ans:2, diff:'easy' },
        { q:'MATCH: Customer says "I want to look my best for my friend\'s wedding, I\'m wearing a saree." Best bra?', opts:['Sports bra','T-shirt bra for smooth under blouse','Strapless','Bralette'], ans:1, diff:'hard' }
      ]
    },
    {
      id: 'fashion-bras',
      name: 'Types of Fashion Bras',
      icon: '💅',
      color: '#4a148c',
      description: 'Master fashion-forward bra styles — lace, mesh, coloured, designer bras',
      videoFile: 'Types of Fashion Bra.mp4',
      types: [
        { name:'Lace Bra', desc:'Decorative lace cups and bands. Feminine and romantic.', customer:'Special occasions, gifting, confidence' },
        { name:'Mesh Bra', desc:'Sheer mesh panels. Modern, edgy aesthetic.', customer:'Bold fashion, styling under sheer tops' },
        { name:'Coloured/Printed', desc:'Bold colours, patterns, prints.', customer:'Social media savvy, fashion-forward, youth' },
        { name:'Embroidered', desc:'Hand or machine embroidery on fabric.', customer:'Bridal, premium gifting, luxury customers' },
        { name:'Body/Bodysuit', desc:'All-in-one. Tucks in, smooth silhouette.', customer:'Formal wear, events, tuck-in tops' }
      ],
      quiz: [
        { q:'Lace bras are most popular for which occasion?', opts:['Daily gym','Special occasions and gifting','Sports training','Maternity'], ans:1, diff:'easy' },
        { q:'Mesh bras appeal to which customer profile?', opts:['Conservative senior','Bold fashion-forward youth','Athletes','Eco-conscious'], ans:1, diff:'easy' },
        { q:'Best recommendation for bridal lingerie?', opts:['Basic cotton','Embroidered luxury bra set','Sports bra','Mesh bra'], ans:1, diff:'medium' },
        { q:'A bodysuit/body bra is ideal for:', opts:['Gym sessions','Formal events with tuck-in tops','Daily casual home wear','Night sports'], ans:1, diff:'medium' },
        { q:'SCENARIO: Customer is shopping for bridal trousseau. Best fashion bra?', opts:['Cotton Enamor','Embroidered Little Lacy bridal set','C9 sports bra','Jockey basic'], ans:1, diff:'hard' }
      ]
    },
    {
      id: 'types-of-panties',
      name: 'Types of Panties',
      icon: '🩱',
      color: '#b71c1c',
      description: 'Complete guide to panty styles — briefs, thongs, boyshorts, hipsters and more',
      videoFile: 'Types of Panty.mp4',
      types: [
        { name:'Brief', desc:'Full coverage, classic. Most comfortable for daily wear.', customer:'Daily comfort, older demographic' },
        { name:'Hipster', desc:'Low rise, wide waistband. Modern everyday.', customer:'Jeans, low-rise pants wearers' },
        { name:'Bikini', desc:'Mid-rise. Balanced coverage and fashion.', customer:'Versatile everyday, gym-casual' },
        { name:'Thong', desc:'Minimal back. Eliminates panty lines.', customer:'Fitted clothing, bodycon dresses' },
        { name:'G-String', desc:'Even less coverage than thong.', customer:'Very fitted fashion wear' },
        { name:'Boyshort', desc:'Full coverage. Shorts-like. Comfortable.', customer:'Casual, gym, comfort seekers' },
        { name:'High-Waist Brief', desc:'Covers waist. Tummy control.', customer:'Post-partum, shapewear preference' }
      ],
      quiz: [
        { q:'Which panty eliminates panty lines under bodycon dresses?', opts:['Brief','Boyshort','Thong','High waist'], ans:2, diff:'easy' },
        { q:'High-waist brief is recommended for:', opts:['Teen customers','Post-partum or shapewear preference','Gym workouts','Formal events'], ans:1, diff:'medium' },
        { q:'A hipster panty has:', opts:['Very high rise','Low rise and wide waistband','No waistband','Thong back'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer buying a saree, concerned about visible panty line. Best recommendation?', opts:['Brief','Boyshort','Seamless thong or bikini','High waist brief'], ans:2, diff:'medium' },
        { q:'Always cross-sell panties when selling:', opts:['A bra (always offer matching panty)','Only when customer asks','Never — different section','Only on discount days'], ans:0, diff:'easy' },
        { q:'Boyshort panties are most popular with which activity?', opts:['Formal events','Casual wear and gym','Swimming only','Office only'], ans:1, diff:'easy' }
      ]
    },
    {
      id: 'swimwear',
      name: 'Types of Swimwear',
      icon: '🏊',
      color: '#01579b',
      description: 'Complete swimwear guide — bikinis, one-pieces, tankinis, swim shorts',
      videoFile: 'Types of Swimwear.mp4',
      types: [
        { name:'One-Piece',  desc:'Full coverage. Flattering silhouette.',  customer:'Family trips, modest preference, mature' },
        { name:'Bikini',     desc:'Two-piece. Fashion and beach ready.',     customer:'Young, confident, beach/pool parties' },
        { name:'Tankini',    desc:'Tank top + bikini bottom.',               customer:'Modest yet fashionable, mum-friendly' },
        { name:'Swim Shorts', desc:'Board shorts or swim shorts.',           customer:'Active water sports, teen boys, casual' },
        { name:'Swim Dress', desc:'Dress-style swimwear.',                   customer:'Conservative customers, cover-up style' }
      ],
      quiz: [
        { q:'Which swimwear offers maximum coverage for conservative customers?', opts:['Bikini','Swim Dress or One-piece','Swim shorts','Tankini'], ans:1, diff:'easy' },
        { q:'Tankini is popular for which customer?', opts:['Competitive swimmer','Modest yet fashionable, family trips','Young beach party goer','Male swimmer'], ans:1, diff:'medium' },
        { q:'SCENARIO: Family with 3 kids on a beach vacation. Mother, 38, wants stylish but modest option. Best?', opts:['Bikini','Swim Dress or One-piece','Swim shorts','Mini bikini'], ans:1, diff:'medium' },
        { q:'Which swimwear is most popular with young fashion-forward customers?', opts:['Swim dress','One-piece only','Bikini (two-piece)','Swim shorts'], ans:2, diff:'easy' },
        { q:'Cross-sell to complete any swimwear purchase?', opts:['Nothing extra','Sun hat, sunscreen, beach bag, cover-up','Only the swimwear','Formal wear'], ans:1, diff:'medium' }
      ]
    },
    {
      id: 'camisoles',
      name: 'Types of Camisoles',
      icon: '👗',
      color: '#1b5e20',
      description: 'Guide to camisoles and layering pieces — from basic to luxury',
      videoFile: 'Types of Camies.mp4',
      types: [
        { name:'Basic Cami',    desc:'Thin strap cami. Worn under sheer tops.',  customer:'Layering under work blouses' },
        { name:'Padded Cami',   desc:'Built-in soft cups. No bra needed.',        customer:'Casual wear, comfort home wear' },
        { name:'Lace Cami',     desc:'Lace trim or full lace.',                   customer:'Fashion layering, occasion, gift' },
        { name:'Shapewear Cami',desc:'Tummy control. Firm compression.',          customer:'Formal events, tummy concern' },
        { name:'Sleep Cami',    desc:'Soft, loose, for lounging/sleep.',          customer:'Home wear, gifting, comfort lovers' }
      ],
      quiz: [
        { q:'Padded cami is recommended when customer wants:', opts:['Extra support and no separate bra','Maximum sports support','Swimwear alternative','Only for sleep'], ans:0, diff:'easy' },
        { q:'Shapewear cami provides:', opts:['Fashion design only','Tummy control and compression','Sports performance','No benefit'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer is wearing a sheer office blouse and needs to look professional. Best?', opts:['Bikini bra visible under blouse','Basic cami as an inner layer','Nothing','Heavy jacket'], ans:1, diff:'medium' },
        { q:'Sleep cami is best marketed for:', opts:['Gym sessions','Gifting and comfort home wear','Formal events','Sports'], ans:1, diff:'easy' },
        { q:'Which cami type is best for festive or special occasion gifting?', opts:['Basic white cami','Lace cami in a gift set','Shapewear cami','Sports cami'], ans:1, diff:'medium' }
      ]
    },
    {
      id: 'accessories',
      name: 'IMP Accessories',
      icon: '👜',
      color: '#e65100',
      description: 'Accessories training — bra strap clips, extenders, nipple covers, body tape and more',
      videoFile: 'IMP Accessories.mp4',
      types: [
        { name:'Bra Strap Clips',   desc:'Racerback conversion. Hides straps.',      customer:'Racerback tops, halter necks' },
        { name:'Bra Extenders',     desc:'Adds 1–3 hook rows to existing bra.',       customer:'Weight change, pregnancy, fitting issue' },
        { name:'Nipple Covers',     desc:'Silicone/fabric covers. Discreet.',         customer:'Braless styling, deep neck, backless' },
        { name:'Body Tape',         desc:'Fashion tape for fabric and skin.',          customer:'Deep neck, backless, strapless outfits' },
        { name:'Shoulder Pads',     desc:'Add shape and posture under clothing.',      customer:'Blazers, formal wear, posture aid' },
        { name:'Silicon Bra',       desc:'Adhesive bra. Completely strapless/backless.',customer:'Backless, strapless, deep back outfits' }
      ],
      quiz: [
        { q:'Bra strap clips are used to:', opts:['Extend bra size','Convert to racerback, hide straps','Add padding','Change colour'], ans:1, diff:'easy' },
        { q:'Nipple covers are recommended for:', opts:['Heavy bust support','Braless styling under deep neck outfits','Sports','Daily office'], ans:1, diff:'easy' },
        { q:'SCENARIO: Customer is wearing a backless dress to a party. Which accessory?', opts:['Bra extender','Silicone adhesive bra or body tape','Shoulder pads','Bra clips'], ans:1, diff:'medium' },
        { q:'Bra extenders are most useful when:', opts:['Customer wants a new style','Customer\'s existing bra feels tight at the back','Changing colour','Sports activity'], ans:1, diff:'easy' },
        { q:'Body tape is used for:', opts:['Extending bra life','Securing clothing to skin for deep neck or backless styles','Protecting fabric','Sports support'], ans:1, diff:'easy' },
        { q:'Best time to offer accessories during a sale?', opts:['After the customer pays','Only if they ask','While showing the main product — always suggest matching accessories','Never'], ans:2, diff:'hard' }
      ]
    }
  ],

  // ── SELLING SKILLS MODULES ────────────────────────────────
  sellingModules: [
    {
      id: 'greet-need',
      name: 'Greeting & Need Analysis',
      icon: '🤝',
      color: '#00695c',
      lessons: [
        { title: 'The Perfect Greeting', content: 'Warmth, eye contact, smile. Within 30 seconds of entry. Use customer\'s name if known.' },
        { title: 'SPIN Need Analysis', content: 'Situation – Problem – Implication – Need Payoff. Ask open questions first.' },
        { title: 'Reading Customer Body Language', content: 'Rushing = quick suggestion. Browsing = explore. Hesitant = reassure.' }
      ],
      quiz: [
        { q:'How soon should you greet a customer entering the store?', opts:['5 minutes','Whenever convenient','Within 30 seconds','Only if they ask'], ans:2, diff:'easy' },
        { q:'SPIN in need analysis stands for:', opts:['Sell-Push-Insist-Now','Situation-Problem-Implication-NeedPayoff','Simple-Product-Item-Note','None of these'], ans:1, diff:'medium' },
        { q:'Customer is browsing slowly, no eye contact. Best action?', opts:['Ignore them','Approach immediately with a hard sell','Give space, then gently offer help after 2 minutes','Ask them to hurry'], ans:2, diff:'medium' }
      ]
    },
    {
      id: 'upsell-crosssell',
      name: 'Upselling & Cross-Selling',
      icon: '📈',
      color: '#e65100',
      lessons: [
        { title: 'The ABV Formula', content: 'Always Bring Value. Every bra needs a matching panty. Every purchase deserves a complete set.' },
        { title: 'The Upgrade Story', content: 'Compare two products. Show value difference. Make premium feel worth it.' },
        { title: 'Timing the Cross-Sell', content: 'Cross-sell BEFORE billing, not after. While the customer is engaged.' }
      ],
      quiz: [
        { q:'ABV in retail stands for:', opts:['Average Billing Value','Always Buy Variety','Always Bring Value','Above Budget Value'], ans:0, diff:'easy' },
        { q:'Best time to suggest a matching panty?', opts:['After billing','At the door exit','While customer is trying the bra — before decision','Only on discount'], ans:2, diff:'medium' },
        { q:'Customer buys ₹999 bra. You should attempt to:', opts:['Just close the sale','Offer matching panty + accessories to increase bill','Lower the price','End interaction'], ans:1, diff:'medium' }
      ]
    },
    {
      id: 'bra-fitting',
      name: 'Bra Fitting Expertise',
      icon: '📏',
      color: '#880e4f',
      lessons: [
        { title: 'Measuring Band Size', content: 'Measure directly under the bust. In inches. Add 4–5 if even, add 5 if odd. This is band size.' },
        { title: 'Measuring Cup Size', content: 'Measure across the fullest part of the bust. Difference from band = cup size (1"=A, 2"=B, 3"=C, 4"=D...)' },
        { title: 'The 7 Signs of Wrong Fit', content: 'Straps digging, band riding up, cup overflow, gap in cups, underwire on breast tissue, center doesn\'t lie flat, back is higher than front.' },
        { title: 'Sister Size Method', content: 'If 34C doesn\'t fit: try 36B (same cup volume, larger band) or 32D (same cup volume, smaller band).' }
      ],
      quiz: [
        { q:'To measure band size, measure:', opts:['Across bust fullest point','Directly under the bust','Around waist','Shoulder to shoulder'], ans:1, diff:'easy' },
        { q:'If under-bust is 31 inches, band size is:', opts:['30','32','36','34'], ans:2, diff:'medium' },
        { q:'Cup size D means the bust-to-band difference is:', opts:['1 inch','2 inches','3 inches','4 inches'], ans:3, diff:'hard' },
        { q:'Sister size of 34C with a larger band?', opts:['36A','36B','34D','32D'], ans:1, diff:'hard' },
        { q:'How many signs of wrong bra fit should you check?', opts:['2','4','7','10'], ans:2, diff:'medium' },
        { q:'Band riding up the back means:', opts:['Perfect fit','Band is too large — go smaller','Band is too small','Correct strap adjustment needed'], ans:1, diff:'medium' }
      ]
    }
  ],

  // ── AI COACH KNOWLEDGE BASE ──────────────────────────────
  aiCoachKB: {
    greeting: "Namaste! I'm your Intimissi AI Coach. Ask me anything about products, selling techniques, bra fitting, or how to handle customer situations.",
    topics: {
      'bra fitting': 'Measure under bust for band size. Measure fullest point for cup. Difference = cup (1"=A, 2"=B, 3"=C, 4"=D). Check 7 signs of poor fit.',
      'cross selling': 'Always offer a matching panty with every bra. Offer accessories when relevant. Cross-sell BEFORE billing.',
      'objection price': 'Never lower the price first. Emphasize value, quality, cost-per-wear, and brand story. Offer EMI if available.',
      'amante': 'European-inspired Indian fit. ₹699–₹2,499. Microfibre. T-shirt bra is best seller. Target: modern urban woman 25–40.',
      'triumph': '130+ years German engineering. ₹1,299–₹4,999. Doreen is world\'s best-selling bra. For discerning woman 30–55.',
      'jockey': 'Premium basics. ₹299–₹1,499. Micromodal fabric. Lasts 2–3 years. Daily comfort focused.',
      'sports bra': 'Recommend C9 for gym/running. High impact needs high support. Moisture wicking essential.',
      'size help': 'Band = under bust + rounding. Cup = fullest bust - band = letter. Sister sizing helps when exact size unavailable.',
      'customer complaint': 'Listen fully. Empathize. Solve first, explain later. Escalate to manager if needed. Document feedback.',
      'upsell': 'Upgrade from basic to premium by showing value difference. "For ₹300 more, you get memory foam cups that last twice as long."',
      'new customer': 'Start with greeting within 30 seconds. Ask open questions. Do a proper fitting. Build trust before recommending.'
    }
  }
};

// Generate XP thresholds and level names
IRA_DATA.getLevelForXP = function(xp) {
  let level = IRA_DATA.levels[0];
  for (const l of IRA_DATA.levels) {
    if (xp >= l.minXP) level = l;
  }
  return level;
};

IRA_DATA.getNextLevel = function(currentLevel) {
  const idx = IRA_DATA.levels.findIndex(l => l.id === currentLevel.id);
  return IRA_DATA.levels[idx + 1] || null;
};

IRA_DATA.getXPProgress = function(xp) {
  const current = IRA_DATA.getLevelForXP(xp);
  const next = IRA_DATA.getNextLevel(current);
  if (!next) return { pct: 100, current, next: null };
  const range = next.minXP - current.minXP;
  const earned = xp - current.minXP;
  return { pct: Math.round((earned / range) * 100), current, next };
};
