import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from a file, skipping keys already in process.env
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
// 3 levels up  = /home/u217740454
const homeDir = path.resolve(__dirname, '../../..');

// Load from home dir first (persists across auto-deploys)
loadEnvFile(path.join(homeDir, '.b2b_env'));
// Then app dir (local fallback, wiped on each auto-deploy)
loadEnvFile(path.join(__dirname, '.env'));

// IMPORTANT: Use dynamic import() in the SAME PROCESS — NOT subprocess spawn.
// lsnode.js patches http.listen() only in the parent process. A child subprocess
// would not inherit these patches, causing Passenger to never see a ready server.
import(path.join(__dirname, 'dist', 'index.js')).catch(err => {
  console.error('[STARTUP] Fatal error loading app:', err);
  process.exit(1);
});
