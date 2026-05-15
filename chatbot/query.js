require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [rows] = await conn.execute(
    'SELECT id, level, step, language_code, message_text, message_type FROM bot_flows WHERE level = ? LIMIT 5',
    ['main_menu']
  );
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
})();
