const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const pgSession = require('connect-pg-simple')(session);
const { pool, initDB } = require('./database');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session store backed by Postgres (survives restarts)
app.use(session({
  store: new pgSession({
    pool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,             
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'         
  }
}));

// ── Auth middleware ──────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session.memberId) return res.status(401).json({ error: 'Not logged in' });
  next();
};

// ── Routes ───────────────────────────────────────────────────

// Who am I?
app.get('/api/me', (req, res) => {
  if (!req.session.memberId) return res.json({ user: null });
  res.json({ user: req.session.memberName, id: req.session.memberId });
});

// Login
app.post('/api/login', async (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
  try {
    const result = await pool.query('SELECT * FROM members WHERE name = $1', [name]);
    const member = result.rows[0];
    if (!member || !bcrypt.compareSync(String(pin), member.pin)) {
      return res.status(401).json({ error: 'Invalid name or PIN' });
    }
    req.session.memberId = member.id;
    req.session.memberName = member.name;
    res.json({ user: member.name, id: member.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Get all members (names only, for display)
app.get('/api/members', async (req, res) => {
  const result = await pool.query('SELECT id, name FROM members ORDER BY name');
  res.json(result.rows);
});

// Get visits for next 21 days
app.get('/api/visits', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.visit_date::text, v.note, m.name AS member_name, v.member_id
      FROM visits v
      JOIN members m ON v.member_id = m.id
      WHERE v.visit_date >= CURRENT_DATE
        AND v.visit_date <= CURRENT_DATE + INTERVAL '21 days'
      ORDER BY v.visit_date, m.name
    `);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add or update own visit
app.post('/api/visits', requireAuth, async (req, res) => {
  const { visit_date, note } = req.body;
  if (!visit_date) return res.status(400).json({ error: 'Date required' });
  try {
    await pool.query(
      `INSERT INTO visits (member_id, visit_date, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (member_id, visit_date)
       DO UPDATE SET note = EXCLUDED.note`,
      [req.session.memberId, visit_date, note || '']
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete own visit
app.delete('/api/visits/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    const visit = result.rows[0];
    if (!visit) return res.status(404).json({ error: 'Not found' });
    if (visit.member_id !== req.session.memberId)
      return res.status(403).json({ error: 'Not your visit' });
    await pool.query('DELETE FROM visits WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => console.log(`Office tracker running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});