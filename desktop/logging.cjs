const fs = require('node:fs');
const path = require('node:path');

// GUI applications may inherit a terminal pipe which disappears after launch.
// Persist diagnostics directly, without depending on stdout or stderr.
function createLogger(directory) {
  return (message) => {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, 'desktop.log');
      if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) fs.writeFileSync(file, '');
      fs.appendFileSync(file, `${new Date().toISOString()} ${String(message).trim()}\n`);
    } catch { /* Failure to write a diagnostic must not crash the desktop app. */ }
  };
}
module.exports = { createLogger };
