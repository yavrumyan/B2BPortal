import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';

// Load .env file if present (Hostinger hPanel env vars aren't passed to subprocesses)
try {
  const envFile = fs.readFileSync('./.env', 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch (_) { /* no .env file, continue */ }

const logFile = fs.createWriteStream('./crash-report.txt', { flags: 'a' });
logFile.write(`\n\n=== NEW DEPLOYMENT AT ${new Date().toISOString()} ===\n`);

// Spawn your actual application
const NODE = process.execPath; // full path to the current node binary
const child = spawn(NODE, ['dist/index.js'], {
  env: process.env,
  stdio: 'pipe' 
});

// Capture all terminal output (stdout and stderr) and save it to the file
child.stdout.on('data', (data) => logFile.write(data));
child.stderr.on('data', (data) => logFile.write(data));

child.on('exit', (code) => {
  logFile.write(`\n=== APP CRASHED WITH EXIT CODE ${code} ===\n`);
  
  // Start a dummy server to keep the container alive and replace the generic 503 error
  const port = parseInt(process.env.PORT || "5000", 10);
  http.createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('The Node application crashed. Please check crash-report.txt in your File Manager.');
  }).listen(port, "0.0.0.0");
});