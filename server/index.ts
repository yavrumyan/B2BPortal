import express, { type Request, Response, NextFunction } from "express";
import http from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSession } from "./auth";
import { runStartupTasks } from "./startup";

// ── Diagnostic: catch startup crashes and expose via HTTP ──────────────────
let _crashHandled = false;
function _startDiagServer(errorText: string) {
  if (_crashHandled) return;
  _crashHandled = true;
  console.error("[CRASH]", errorText);
  const port = parseInt(process.env.PORT || "5000", 10);
  http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("=== STARTUP CRASH ===\n\n" + errorText);
  }).listen(port, "0.0.0.0");
}
process.on("uncaughtException", (err) => {
  _startDiagServer(
    `UncaughtException (${new Date().toISOString()})\n${err.stack || err.message}`
  );
});
process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error
    ? (reason.stack || reason.message)
    : String(reason);
  _startDiagServer(`UnhandledRejection (${new Date().toISOString()})\n${msg}`);
});
// ──────────────────────────────────────────────────────────────────────────

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Setup session BEFORE logging middleware
setupSession(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await runStartupTasks();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})().catch((err: Error) => {
  _startDiagServer(`IIFE catch (${new Date().toISOString()})\n${err.stack || err.message}`);
});