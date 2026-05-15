const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'messages.log');
const errorFile = path.join(logDir, 'errors.log');

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function logMessage(channel, sender, direction, text) {
  const entry = {
    timestamp: new Date().toISOString(),
    channel,
    sender,
    direction,
    text,
  };
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(logFile, line, (err) => {
    if (err) console.error('Failed to write message log:', err);
  });
}

function logError(context, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message: error?.message || String(error),
    status: error?.response?.status,
    data: error?.response?.data,
  };
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(errorFile, line, () => {});
  console.error(`[ERROR][${context}]`, entry.message, entry.data || '');
}

module.exports = { logMessage, logError };
