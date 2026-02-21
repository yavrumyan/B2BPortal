import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { pool } from "./db";

export function setupSession(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgSession = connectPg(session);
  
  app.set("trust proxy", 1);
  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
      },
    })
  );
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session && req.session.customerId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session || !req.session.customerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const customer = await storage.getCustomerById(req.session.customerId);
  if (!customer || customer.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};

// Extend session type
declare module 'express-session' {
  interface SessionData {
    customerId: string;
  }
}
