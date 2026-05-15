const mysql = require('mysql2/promise');

let pool;

function initDB() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chatbot_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  console.log('MySQL connection pool created');
  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return pool;
}

// ─── User Management ───

async function getOrCreateUser(phone) {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
  if (rows.length > 0) {
    return rows[0];
  }
  const [result] = await db.execute(
    'INSERT INTO users (phone, current_level, current_step) VALUES (?, ?, ?)',
    [phone, 'welcome', 'start']
  );
  return {
    id: result.insertId,
    phone,
    language_code: null,
    current_level: 'welcome',
    current_step: 'start',
    is_active: 1,
  };
}

async function updateUserLanguage(phone, languageCode) {
  const db = getPool();
  await db.execute(
    'UPDATE users SET language_code = ?, current_level = ?, current_step = ? WHERE phone = ?',
    [languageCode, 'main_menu', 'start', phone]
  );
}

async function updateUserState(phone, level, step) {
  const db = getPool();
  await db.execute(
    'UPDATE users SET current_level = ?, current_step = ? WHERE phone = ?',
    [level, step, phone]
  );
}

async function resetUserToWelcome(phone) {
  const db = getPool();
  await db.execute(
    'UPDATE users SET language_code = NULL, current_level = ?, current_step = ? WHERE phone = ?',
    ['welcome', 'start', phone]
  );
}

// ─── Language ───

async function getActiveLanguages() {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM languages WHERE is_active = 1 ORDER BY id');
  return rows;
}

// ─── Bot Flow ───

async function getBotFlow(level, step, languageCode, parentOption) {
  const db = getPool();
  let query = 'SELECT * FROM bot_flows WHERE level = ? AND step = ? AND language_code = ? AND is_active = 1';
  const params = [level, step, languageCode];

  if (parentOption) {
    query += ' AND parent_option = ?';
    params.push(parentOption);
  } else {
    query += ' AND parent_option IS NULL';
  }

  const [rows] = await db.execute(query, params);
  return rows.length > 0 ? rows[0] : null;
}

// ─── Messages ───

async function logMessageToDB(userId, conversationId, direction, content, messageType, channel) {
  const db = getPool();
  await db.execute(
    'INSERT INTO messages (user_id, conversation_id, direction, message_type, content, channel) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, conversationId, direction, messageType || 'text', content, channel || 'whatsapp']
  );
}

// ─── Conversations ───

async function createConversation(userId, sessionId) {
  const db = getPool();
  const [result] = await db.execute(
    'INSERT INTO conversations (user_id, session_id) VALUES (?, ?)',
    [userId, sessionId]
  );
  return result.insertId;
}

async function getActiveConversation(userId) {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM conversations WHERE user_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1',
    [userId, 'active']
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  initDB,
  getPool,
  getOrCreateUser,
  updateUserLanguage,
  updateUserState,
  resetUserToWelcome,
  getActiveLanguages,
  getBotFlow,
  logMessageToDB,
  createConversation,
  getActiveConversation,
};
