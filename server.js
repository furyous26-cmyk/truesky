const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const PORT = process.env.PORT || 5501;
function findAppRoot() {
  const candidates = [
    __dirname,
    path.join(__dirname, 'V1'),
    path.join(process.cwd(), 'V1'),
    process.cwd(),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    } catch {}
  }
  return __dirname;
}

const ROOT = findAppRoot();
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'local-db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { charts: [], settings: [], chat: {}, aiHistory: [] }; }
}
function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function recent(items) { return [...items].sort((a,b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')).slice(0, 100); }
function norm(v) { return String(v ?? '').trim().toLowerCase(); }
function chartKey(c) { return [c.name, c.year, c.month, c.day, c.hour, String(c.minute ?? '').padStart(2, '0'), c.location].map(norm).join('|'); }
function normalizeChart(c) {
  const now = new Date().toISOString();
  return { id: c.id || makeId(), profile_type: c.profile_type || c.chart_type || 'natal', ...c, created_at: c.created_at || now, updated_at: c.updated_at || now };
}

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(ROOT, { index: 'index.html' }));

function sendIndex(req, res) {
  const indexPath = path.join(ROOT, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(500).send(`index.html não encontrado. ROOT=${ROOT}. Verifique no Render se o Root Directory aponta para a pasta do projeto.`);
}

app.get('/', sendIndex);

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', service: 'truesky-node', port: PORT, root: ROOT, indexExists: fs.existsSync(path.join(ROOT, 'index.html')) }));
app.get('/api/swiss-health', (req, res) => {
  const script = path.join(ROOT, 'py', 'swiss_ephemeris_service.py');
  const candidates = process.platform === 'win32'
    ? [[path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'), 'Programs', 'Python', 'Python311', 'python.exe'), []], ['py', ['-3.11']]]
    : [['python3', []], ['python', []]];
  const results = candidates.map(([cmd, args]) => {
    const child = spawnSync(cmd, [...args, '-c', 'import swisseph as swe; print(swe.version)'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    return { command: `${cmd} ${args.join(' ')}`.trim(), ok: child.status === 0, stdout: (child.stdout || '').trim(), stderr: (child.stderr || child.error?.message || '').trim() };
  });
  res.json({ success: results.some(r => r.ok), results, script });
});


// Calculation compatibility endpoint. The browser code already calculates charts locally in sharedNatal.js.
// This keeps older fetch('/') calls from failing when running through Node.
app.post('/', (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.natalData)) return res.json(body.natalData);
  if (Array.isArray(body.data)) return res.json(body.data);

  // If a browser page submits a form directly to '/', redirect it back to the UI
  // instead of rendering raw JSON in the browser.
  const isJsonRequest = req.is('application/json');
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  if (acceptsHtml && !isJsonRequest) {
    return res.redirect(303, '/');
  }

  return res.json({ success: true, data: body });
});

app.get('/recent-charts', (req, res) => res.json({ success: true, recentCharts: recent(readDb().charts) }));
app.get('/search-charts', (req, res) => {
  const q = String(req.query.query || '').toLowerCase();
  const charts = recent(readDb().charts).filter(c => !q || JSON.stringify(c).toLowerCase().includes(q));
  res.json({ success: true, recentCharts: charts });
});
app.post('/save-chart', (req, res) => {
  const db = readDb();
  const chart = normalizeChart(req.body || {});
  const exists = db.charts.some(c => chartKey(c) === chartKey(chart));
  if (exists) return res.json({ success: false, error: 'Chart already exists in database.', recentCharts: recent(db.charts) });
  if (db.charts.length >= 5000) return res.json({ success: false, error: 'Chart limit reached. Maximum allowed charts is 5000.', recentCharts: recent(db.charts) });
  db.charts.unshift(chart); writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});
app.post('/delete-chart', (req, res) => {
  const db = readDb();
  db.charts = db.charts.filter(c => String(c.id) !== String(req.body.id)); writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});
app.post('/update-chart-timestamp', (req, res) => {
  const db = readDb(); const id = String(req.body.id || '');
  db.charts = db.charts.map(c => String(c.id) === id ? { ...c, updated_at: new Date().toISOString() } : c); writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});

app.get('/recent-settings', (req, res) => res.json({ success: true, recentSettings: recent(readDb().settings) }));
app.post('/save-settings', (req, res) => {
  const db = readDb();
  const item = { id: makeId(), settings_name: req.body.settingsName || req.body.settings_name || 'Settings', settings_json: req.body.settings_json || '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  db.settings.unshift(item); writeDb(db);
  res.json({ success: true, recentSettings: recent(db.settings) });
});
app.post('/delete-settings', (req, res) => {
  const db = readDb(); db.settings = db.settings.filter(s => String(s.id) !== String(req.body.id)); writeDb(db);
  res.json({ success: true, recentSettings: recent(db.settings) });
});
app.post('/update-settings-timestamp', (req, res) => {
  const db = readDb(); const id = String(req.body.id || '');
  db.settings = db.settings.map(s => String(s.id) === id ? { ...s, updated_at: new Date().toISOString() } : s); writeDb(db);
  res.json({ success: true, recentSettings: recent(db.settings) });
});

app.post('/save-default-location', (req, res) => res.json({ success: true }));
app.post('/view-report', (req, res) => res.json({ success: true }));
app.post('/import-charts', (req, res) => {
  const db = readDb();
  const incoming = Array.isArray(req.body) ? req.body : (req.body.charts || req.body.recentCharts || []);
  for (const raw of incoming) {
    const chart = normalizeChart(raw);
    if (!db.charts.some(c => chartKey(c) === chartKey(chart))) db.charts.push(chart);
  }
  writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});
app.get('/export-charts', (req, res) => res.json(readDb().charts));
app.post('/delete-exported-charts', (req, res) => res.json({ success: true }));
app.post('/deleteAccount', (req, res) => res.json({ success: true }));

app.get('/chat-history/:channel', (req, res) => {
  const db = readDb(); res.json({ success: true, messages: db.chat[req.params.channel] || [] });
});
app.post('/delete-chat-message', (req, res) => res.json({ success: true }));
io.on('connection', socket => {
  socket.on('join', channel => socket.join(channel));
  socket.on('chat message', msg => {
    const channel = msg.channel || 'general'; const db = readDb();
    db.chat[channel] = db.chat[channel] || []; db.chat[channel].push({ id: makeId(), ...msg, created_at: new Date().toISOString() }); writeDb(db);
    io.to(channel).emit('chat message', db.chat[channel][db.chat[channel].length - 1]);
  });
});


app.post('/api/swiss-ephemeris', (req, res) => {
  const script = path.join(ROOT, 'py', 'swiss_ephemeris_service.py');

  // Windows often has several Python versions installed. The Swiss module was
  // confirmed on this machine with: py -3.11 -c "import swisseph".
  // Try that first, then fall back to explicit env/PATH choices.
  const candidates = [];
  const addCandidate = (cmd, args = []) => {
    const key = `${cmd} ${args.join(' ')}`.trim();
    if (!candidates.some((c) => `${c.cmd} ${c.args.join(' ')}`.trim() === key)) {
      candidates.push({ cmd, args });
    }
  };

  // Windows fix: force the same Python 3.11 where Caio confirmed:
  // py -3.11 -c "import swisseph as swe; print(swe.version)" -> 2.10.03
  // Do NOT fall back to plain "python" on Windows, because that can be Python 3.14
  // or a Microsoft Store alias without pyswisseph.
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    addCandidate(path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'), []);
    addCandidate('py', ['-3.11']);
  } else {
    addCandidate('python3', []);
    addCandidate('python', []);
  }

  if (process.env.PYTHON) {
    const envPython = process.env.PYTHON.trim();
    const envArgs = (process.env.PYTHON_ARGS || '').trim().split(/\s+/).filter(Boolean);
    if (process.platform === 'win32' && envPython.toLowerCase() === 'python') {
      // Ignore incorrect Windows PYTHON=python env. It often points to a Python
      // without swisseph and caused the "No module named swisseph" error.
    } else if (envPython.toLowerCase() === 'py' && envArgs.length === 0) {
      addCandidate('py', ['-3.11']);
    } else {
      addCandidate(envPython, envArgs);
    }
  }

  const attemptedErrors = [];
  let lastError = '';
  for (const candidate of candidates) {
    try {
      const child = spawnSync(candidate.cmd, [...candidate.args, script], {
        input: JSON.stringify(req.body || {}),
        encoding: 'utf8',
        timeout: 20000,
        cwd: ROOT,
        maxBuffer: 1024 * 1024 * 8,
        windowsHide: true,
      });
      if (child.error) {
        lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${child.error.message}`;
        attemptedErrors.push(lastError);
        continue;
      }
      const stdout = (child.stdout || '').trim();
      const stderr = (child.stderr || '').trim();
      if (!stdout) {
        lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${stderr || `exit ${child.status}`}`;
        attemptedErrors.push(lastError);
        continue;
      }
      const payload = JSON.parse(stdout);
      if (payload && payload.success !== false) return res.json(payload);
      lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${payload.error || 'Swiss returned failure'}`;
      attemptedErrors.push(lastError);
    } catch (err) {
      lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${err.message}`;
      attemptedErrors.push(lastError);
    }
  }
  res.status(500).json({
    success: false,
    error: `Swiss Ephemeris service unavailable. Attempts: ${attemptedErrors.join(' | ')}. Local Windows: py -3.11 -m pip install pyswisseph. Render/Linux: use the included Dockerfile/render.yaml so python3 has pyswisseph installed.`,
  });
});

app.post('/api/ai-chat', (req, res) => res.json({ success: true, message: 'AI local indisponível neste servidor Node básico.' }));
app.get('/api/ai-chat/history', (req, res) => res.json({ success: true, history: readDb().aiHistory }));
app.post('/api/ai-chat/clear', (req, res) => { const db = readDb(); db.aiHistory = []; writeDb(db); res.json({ success: true }); });
app.get('/api/ai-chat/suggestions', (req, res) => res.json({ success: true, suggestions: [] }));
app.post('/api/ai-chat/save-suggestions', (req, res) => res.json({ success: true }));

// SPA catch-all route - must be last
app.get(/^\/((?!.*\.[^\/]+$).)*$/, sendIndex);
app.get('*', sendIndex);
server.listen(PORT, "0.0.0.0", () => console.log(`Truesky rodando em http://localhost:${PORT}`));
