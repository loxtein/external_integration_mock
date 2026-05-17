const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3002;
const DUMMY_SECRET = 'super_secret';

const generateRandomUsers = () => {
    const domains = ['external.com', 'partner.io', 'company.net', 'service.org'];
    const firstNames = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko'];
    const lastNames = ['Pratama', 'Santoso', 'Dewi', 'Wulandari', 'Kurniawan', 'Hidayat', 'Lestari', 'Saputra', 'Sari', 'Susanto'];
    const users = [];
    for (let i = 0; i < 3; i++) {
        const first = firstNames[Math.floor(Math.random() * firstNames.length)];
        const last = lastNames[Math.floor(Math.random() * lastNames.length)];
        const randomNum = Math.floor(100 + Math.random() * 900);
        const email = `${first.toLowerCase()}.${last.toLowerCase()}${randomNum}@${domains[Math.floor(Math.random() * domains.length)]}`;
        users.push({
            email,
            password: '123456',
            name: `${first} ${last}`
        });
    }
    return users;
};

let DUMMY_USERS = generateRandomUsers();

const authCodes = new Map();

// --- GET /login ---
app.get('/login', (req, res) => {
    const { redirect_uri, state } = req.query;

    if (!redirect_uri || !state) {
        return res.status(400).send('Missing redirect_uri or state');
    }

    DUMMY_USERS = generateRandomUsers();

    res.send(renderLoginPage(redirect_uri, state));
});

// --- POST /login ---
app.post('/login', (req, res) => {
    const { redirect_uri, state, email, password } = req.body;

    if (!redirect_uri || !state) {
        return res.status(400).send('Missing redirect_uri or state');
    }

    let user = DUMMY_USERS.find(u => u.email === email && u.password === password);

    if (!user && password === '123456') {
        const namePart = email.split('@')[0].split('.');
        const name = namePart.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        user = { email, password, name: name || 'User' };
        DUMMY_USERS.push(user);
    }

    if (!user) {
        return res.send(renderLoginPage(redirect_uri, state, 'Email atau password salah.'));
    }

    const pair_code = crypto.randomBytes(16).toString('hex');

    authCodes.set(pair_code, {
        email: user.email,
        name: user.name,
        expires_at: Date.now() + 5 * 60 * 1000,
        used: false,
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', pair_code);
    redirectUrl.searchParams.append('state', state);

    res.redirect(redirectUrl.toString());
});

// --- POST /api/verify ---
app.post('/api/verify', (req, res) => {
    const { code, secret_key } = req.body;
    console.log(`[VERIFY] code=${code}`);

    if (secret_key !== DUMMY_SECRET) {
        return res.status(401).json({ error: 'invalid_client' });
    }

    const codeData = authCodes.get(code);

    if (!codeData || codeData.used || Date.now() > codeData.expires_at) {
        return res.status(400).json({ error: 'invalid_grant' });
    }

    codeData.used = true;

    res.json({
        email: codeData.email,
        name: codeData.name,
    });
});

// --- POST /api/memberships ---
app.post('/api/memberships', (req, res) => {
    const { emails, secret_key } = req.body;
    console.log(`[MEMBERSHIPS] emails=${JSON.stringify(emails)}`);

    if (secret_key !== DUMMY_SECRET) {
        return res.status(401).json({ error: 'invalid_client' });
    }

    const result = (emails || []).map(email => ({
        email,
        status: 'ACTIVE',
        expires_at: '2026-12-31T00:00:00Z',
    }));

    res.json(result);
});

// --- Login Page Renderer ---
function renderLoginPage(redirect_uri, state, error = '') {
    const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>External Company — Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
    }
    .card {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .card h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
      color: #f1f5f9;
    }
    .card p.subtitle {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
    }
    .error-msg {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 0.3rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 0.7rem 0.9rem;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      background: rgba(15, 23, 42, 0.6);
      color: #f1f5f9;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 1rem;
    }
    input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
    button {
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
    }
    button:active { transform: translateY(0); }
    .hint {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
      font-size: 0.75rem;
      color: #64748b;
    }
    .hint table { width: 100%; border-collapse: collapse; margin-top: 0.4rem; }
    .hint th, .hint td {
      text-align: left;
      padding: 0.25rem 0.4rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    }
    .hint th { color: #94a3b8; }
    .hint td { color: #cbd5e1; font-family: monospace; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>External Company</h2>
    <p class="subtitle">Authorize your account to connect with SaaS platform</p>

    ${error ? `<div class="error-msg">${escHtml(error)}</div>` : ''}

    <form method="POST" action="/login">
      <input type="hidden" name="redirect_uri" value="${escHtml(redirect_uri)}">
      <input type="hidden" name="state" value="${escHtml(state)}">

      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="you@external.com" required>

      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="••••••" required>

      <button type="submit">Authorize &amp; Connect</button>
    </form>

    <div class="hint">
      <strong>Dummy Accounts:</strong>
      <table>
        <tr><th>Email</th><th>Password</th></tr>
        ${DUMMY_USERS.map(u => `<tr><td>${escHtml(u.email)}</td><td>${escHtml(u.password)}</td></tr>`).join('')}
      </table>
    </div>
  </div>
</body>
</html>`;
}

app.listen(PORT, () => console.log(`Mock External Server running on http://localhost:${PORT}`));
