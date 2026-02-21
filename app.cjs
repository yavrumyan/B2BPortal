'use strict';
const fs = require('fs');
const path = require('path');

// Load env vars from .env files. Checks two locations:
//   1. /home/<user>/.b2b_env  — outside deployment dir, survives auto-deploys
//   2. <app_dir>/.env         — local fallback (wiped on each auto-deploy)
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

// Home dir env (persists across deployments)
loadEnvFile(path.join(require('os').homedir(), '.b2b_env'));
// App dir env (convenience fallback)
loadEnvFile(path.join(__dirname, '.env'));

// Dynamic import loads the ESM app in the SAME process so lsnode.js
// can intercept http.listen() correctly (subprocess approach does NOT work).
import(path.join(__dirname, 'dist', 'index.js')).catch(err => {
  console.error('[STARTUP] Fatal error loading app:', err);
  process.exit(1);
});
