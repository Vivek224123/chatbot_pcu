const { getExpiredSessions, expireSession } = require('./dbService');
const { sendWhatsAppMessage } = require('./whatsappService');
const { logMessage } = require('./logger');

const TIMEOUT_MIN = parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 5;
const CHECK_EVERY_MS = 30 * 1000;

const MESSAGES = {
  en: `⏳ Your session has expired due to inactivity.\n\nType *"hi"* to start again.`,
  hi: `⏳ कुछ समय तक कोई गतिविधि न होने के कारण आपका सेशन समाप्त हो गया है।\n\nदोबारा शुरू करने के लिए *"hi"* लिखें।`,
};

let running = false;

async function sweep() {
  if (running) return;
  running = true;
  try {
    const users = await getExpiredSessions(TIMEOUT_MIN);
    for (const u of users) {
      const expired = await expireSession(u.id, TIMEOUT_MIN);
      if (!expired) continue;
      const text = MESSAGES[u.language_code] || MESSAGES.en;
      try {
        await sendWhatsAppMessage(u.phone, text);
        logMessage('whatsapp', u.phone, 'outgoing', text);
      } catch (err) {
        console.error(`Session expiry message failed for ${u.phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Session sweep error:', err.message);
  } finally {
    running = false;
  }
}

function startSessionManager() {
  setInterval(sweep, CHECK_EVERY_MS);
  console.log(`Session manager started (timeout: ${TIMEOUT_MIN} min)`);
}

module.exports = { startSessionManager };