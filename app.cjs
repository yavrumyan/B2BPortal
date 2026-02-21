'use strict';
const fs = require('fs');
const path = require('path');

// Load .env before importing the app (PassengerEnvVar alone is not reliable)
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
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

// Dynamic import loads the ESM app in the SAME process so lsnode.js
// can intercept http.listen() correctly (subprocess approach does NOT work).
import(path.join(__dirname, 'dist', 'index.js')).catch(err => {
  console.error('[STARTUP] Fatal error loading app:', err);
  process.exit(1);
});
