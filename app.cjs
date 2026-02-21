'use strict';
const fs = require('fs');
const path = require('path');

// Load env vars from a file, skipping keys already set in process.env
function loadEnvFile(filePath) {
  try {
    const envFile = fs.readFileSync(filePath, 'utf8');
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch (_) {}
}

// __dirname = /home/u217740454/domains/b2b.chip.am/public_html
// 3 levels up = /home/u217740454  (reliable, no os.homedir() needed)
const homeDir = path.resolve(__dirname, '../../..');

// Home dir env (persists across auto-deploys, never wiped by Hostinger)
loadEnvFile(path.join(homeDir, '.b2b_env'));
// App dir env (local fallback, wiped on each auto-deploy)
loadEnvFile(path.join(__dirname, '.env'));

// Dynamic import loads the ESM app in the SAME process so lsnode.js
// can intercept http.listen() correctly (subprocess approach does NOT work).
import(path.join(__dirname, 'dist', 'index.js')).catch(err => {
  console.error('[STARTUP] Fatal error loading app:', err);
  process.exit(1);
});
