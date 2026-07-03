// Vercel serverless function — cloud config store via GitHub
// GET  /api/config → returns current config.json from GitHub
// POST /api/config → merges patch into config.json and commits to GitHub

const https = require('https');

const REPO  = process.env.GITHUB_REPO  || 'pramod-lgtm/intimissi-retail-academy';
const TOKEN = process.env.GITHUB_TOKEN || '';
const FILE  = 'config.json';

function ghRequest(method, path, body) {
  return new Promise(function(resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'token ' + TOKEN,
        'User-Agent': 'ira-academy',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, function(res) {
      let buf = '';
      res.on('data', function(c) { buf += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch(e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // GET — return current config
  if (req.method === 'GET') {
    try {
      const r = await ghRequest('GET', '/repos/' + REPO + '/contents/' + FILE);
      if (r.status === 200) {
        const content = Buffer.from(r.body.content, 'base64').toString('utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(content);
      } else {
        // Return error details so we can debug
        res.status(200).json({ video_urls: {}, pin_overrides: {}, _debug: { status: r.status, body: r.body, repo: REPO, hasToken: !!TOKEN } });
      }
    } catch(e) {
      res.status(200).json({ video_urls: {}, pin_overrides: {}, _debug: { error: e.message, repo: REPO, hasToken: !!TOKEN } });
    }
    return;
  }

  // POST — merge and commit
  if (req.method === 'POST') {
    if (!TOKEN) { res.status(500).json({ error: 'GITHUB_TOKEN not set', repo: REPO }); return; }

    // Read body manually (Vercel raw functions don't auto-parse)
    let patch;
    try {
      const buf = await new Promise(function(resolve, reject) {
        const chunks = [];
        req.on('data', function(c) { chunks.push(c); });
        req.on('end', function() { resolve(Buffer.concat(chunks)); });
        req.on('error', reject);
      });
      patch = JSON.parse(buf.toString('utf8'));
    } catch(e) {
      // Fallback: try req.body if already parsed
      patch = req.body;
    }
    if (!patch || typeof patch !== 'object') {
      res.status(400).json({ error: 'Invalid body', bodyType: typeof req.body }); return;
    }

    // Read current file (need SHA for update)
    let currentConfig = { video_urls: {}, pin_overrides: {} };
    let sha = null;
    try {
      const r = await ghRequest('GET', '/repos/' + REPO + '/contents/' + FILE);
      if (r.status === 200) {
        sha = r.body.sha;
        currentConfig = JSON.parse(Buffer.from(r.body.content, 'base64').toString('utf8'));
        if (!currentConfig.video_urls) currentConfig.video_urls = {};
        if (!currentConfig.pin_overrides) currentConfig.pin_overrides = {};
      }
    } catch(e) {}

    // Merge patch
    if (patch.video_urls) Object.assign(currentConfig.video_urls, patch.video_urls);
    if (patch.pin_overrides) Object.assign(currentConfig.pin_overrides, patch.pin_overrides);

    // Commit
    const newContent = Buffer.from(JSON.stringify(currentConfig, null, 2)).toString('base64');
    const commitBody = { message: 'config: sync update', content: newContent };
    if (sha) commitBody.sha = sha;

    try {
      const r = await ghRequest('PUT', '/repos/' + REPO + '/contents/' + FILE, commitBody);
      if (r.status === 200 || r.status === 201) {
        res.status(200).json({ ok: true });
      } else {
        res.status(500).json({ error: 'GitHub commit failed', status: r.status, detail: r.body });
      }
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
