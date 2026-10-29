const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { getPool } = require('./dbService');


const router = express.Router();

// ─── File Upload Setup ───
//new
function cleanFileName(name) {
  let n = name;
  // multer can hand UTF-8 names over as latin1 text; fix it only when needed
  if (![...n].some((ch) => ch.charCodeAt(0) > 255)) {
    const fixed = Buffer.from(n, 'latin1').toString('utf8');
    if (!fixed.includes('\uFFFD')) n = fixed;
  }
  return n.replace(/[^\p{L}\p{M}\p{N}.\-_ ()]/gu, '_').replace(/\s+/g, ' ').trim();
}

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
        console.log('UPLOAD:', JSON.stringify(file.originalname), '->', uniqueName);
    //const uniqueName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueName = Date.now() + '-' + cleanFileName(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'));
  }
});

// ─── Auth Middleware ───

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64 = authHeader.split(' ')[1];
  const [username, password] = Buffer.from(base64, 'base64').toString().split(':');

  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM admin_users WHERE username = ? AND password = ? AND is_active = 1',
    [username, hashPassword(password)]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.adminUser = rows[0];
  next();
}

function adminOnly(req, res, next) {
  if (req.adminUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ─── Login ───

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const db = getPool();
  const [rows] = await db.execute(
    'SELECT id, username, name, role FROM admin_users WHERE username = ? AND password = ? AND is_active = 1',
    [username, hashPassword(password)]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ success: true, user: rows[0] });
});

// ─── File Upload ───

router.post('/upload', authMiddleware, adminOnly, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = '/uploads/' + req.file.filename;
    //res.json({ success: true, file_url: fileUrl, filename: req.file.originalname });
    res.json({ success: true, file_url: fileUrl, filename: cleanFileName(req.file.originalname) });
  });
});

// ─── Bot Flows CRUD ───

router.get('/bot-flows', authMiddleware, async (req, res) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM bot_flows ORDER BY language_code, level, step');
  res.json(rows);
});

router.get('/bot-flows/:id', authMiddleware, async (req, res) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM bot_flows WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.post('/bot-flows', authMiddleware, adminOnly, async (req, res) => {
  const { level, step, language_code, message_text, message_type, options, file_url, next_level, next_step, parent_option } = req.body;

  if (!level || !step || !language_code || !message_text) {
    return res.status(400).json({ error: 'level, step, language_code, and message_text are required' });
  }

  const db = getPool();
  const optionsJson = options ? JSON.stringify(options) : null;

  const [result] = await db.execute(
    'INSERT INTO bot_flows (level, step, language_code, message_text, message_type, options, file_url, next_level, next_step, parent_option) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [level, step || 'start', language_code, message_text, message_type || 'text', optionsJson, file_url || null, next_level || null, next_step || null, parent_option || null]
  );

  res.json({ success: true, id: result.insertId });
});

router.put('/bot-flows/:id', authMiddleware, adminOnly, async (req, res) => {
  const { level, step, language_code, message_text, message_type, options, file_url, next_level, next_step, parent_option, is_active } = req.body;

  const db = getPool();
  const optionsJson = options ? JSON.stringify(options) : null;

  await db.execute(
    'UPDATE bot_flows SET level=?, step=?, language_code=?, message_text=?, message_type=?, options=?, file_url=?, next_level=?, next_step=?, parent_option=?, is_active=? WHERE id=?',
    [level, step, language_code, message_text, message_type || 'text', optionsJson, file_url || null, next_level || null, next_step || null, parent_option || null, is_active !== undefined ? is_active : 1, req.params.id]
  );

  res.json({ success: true });
});

router.delete('/bot-flows/:id', authMiddleware, adminOnly, async (req, res) => {
  const db = getPool();
  await db.execute('DELETE FROM bot_flows WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── Languages CRUD ───

router.get('/languages', authMiddleware, async (req, res) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM languages ORDER BY id');
  res.json(rows);
});

router.post('/languages', authMiddleware, adminOnly, async (req, res) => {
  const { code, name, native_name } = req.body;
  if (!code || !name || !native_name) {
    return res.status(400).json({ error: 'code, name, and native_name are required' });
  }
  const db = getPool();
  const [result] = await db.execute(
    'INSERT INTO languages (code, name, native_name) VALUES (?, ?, ?)',
    [code, name, native_name]
  );
  res.json({ success: true, id: result.insertId });
});

router.put('/languages/:id', authMiddleware, adminOnly, async (req, res) => {
  const { code, name, native_name, is_active } = req.body;
  const db = getPool();
  await db.execute(
    'UPDATE languages SET code=?, name=?, native_name=?, is_active=? WHERE id=?',
    [code, name, native_name, is_active !== undefined ? is_active : 1, req.params.id]
  );
  res.json({ success: true });
});

// ─── Users (bot users) ───

router.get('/users', authMiddleware, async (req, res) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users ORDER BY created_at DESC');
  res.json(rows);
});

router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const db = getPool();
  await db.execute('DELETE FROM messages WHERE user_id = ?', [req.params.id]);
  await db.execute('DELETE FROM conversations WHERE user_id = ?', [req.params.id]);
  await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── Admin Users CRUD ───

router.get('/admin-users', authMiddleware, adminOnly, async (req, res) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT id, username, name, role, is_active, created_at FROM admin_users ORDER BY id');
  res.json(rows);
});

router.post('/admin-users', authMiddleware, adminOnly, async (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'username, password, and name are required' });
  }
  const db = getPool();
  const [result] = await db.execute(
    'INSERT INTO admin_users (username, password, name, role) VALUES (?, ?, ?, ?)',
    [username, hashPassword(password), name, role || 'user']
  );
  res.json({ success: true, id: result.insertId });
});

router.put('/admin-users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { username, password, name, role, is_active } = req.body;
  const db = getPool();

  if (password) {
    await db.execute(
      'UPDATE admin_users SET username=?, password=?, name=?, role=?, is_active=? WHERE id=?',
      [username, hashPassword(password), name, role || 'user', is_active !== undefined ? is_active : 1, req.params.id]
    );
  } else {
    await db.execute(
      'UPDATE admin_users SET username=?, name=?, role=?, is_active=? WHERE id=?',
      [username, name, role || 'user', is_active !== undefined ? is_active : 1, req.params.id]
    );
  }

  res.json({ success: true });
});

router.delete('/admin-users/:id', authMiddleware, adminOnly, async (req, res) => {
  if (req.params.id == req.adminUser.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  const db = getPool();
  await db.execute('DELETE FROM admin_users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── Messages / Conversations ───

router.get('/messages', authMiddleware, async (req, res) => {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT m.*, u.phone FROM messages m
     JOIN users u ON m.user_id = u.id
     ORDER BY m.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

// ─── Dashboard Stats ───

router.get('/stats', authMiddleware, async (req, res) => {
  const db = getPool();
  const [[{ totalUsers }]] = await db.execute('SELECT COUNT(*) as totalUsers FROM users');
  const [[{ totalMessages }]] = await db.execute('SELECT COUNT(*) as totalMessages FROM messages');
  const [[{ totalFlows }]] = await db.execute('SELECT COUNT(*) as totalFlows FROM bot_flows');
  const [[{ totalLanguages }]] = await db.execute('SELECT COUNT(*) as totalLanguages FROM languages WHERE is_active = 1');

  res.json({ totalUsers, totalMessages, totalFlows, totalLanguages });
});

module.exports = router;
