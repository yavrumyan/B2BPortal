import { db, pool } from "./db";
import { customers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function runStartupTasks() {
  console.log("[STARTUP] Running startup tasks...");

  try {
    await ensureTablesExist();
    await seedAdminIfNeeded();
    console.log("[STARTUP] All startup tasks completed successfully.");
  } catch (err) {
    console.error("[STARTUP] Error during startup tasks:", err);
  }
}

async function ensureTablesExist() {
  console.log("[STARTUP] Verifying database tables...");

  try {
    await db.select().from(customers).limit(1);
    console.log("[STARTUP] Database tables exist.");
  } catch (err: any) {
    if (err.message?.includes("does not exist") || err.code === "42P01") {
      console.log("[STARTUP] Tables not found. Please run 'npx drizzle-kit push' to create tables.");
      console.log("[STARTUP] Attempting automatic table creation...");
      await createTables();
    } else {
      throw err;
    }
  }
}

async function createTables() {
  const { execSync } = await import("child_process");
  try {
    execSync("npx drizzle-kit push --force", {
      stdio: "inherit",
      env: { ...process.env },
      timeout: 60000,
    });
    console.log("[STARTUP] Tables created via drizzle-kit push.");
  } catch (err) {
    console.error("[STARTUP] drizzle-kit push failed, falling back to manual creation...");
    await createTablesManually();
  }
}

async function createTablesManually() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name VARCHAR(255) NOT NULL,
      tax_id VARCHAR(50) NOT NULL UNIQUE,
      delivery_address TEXT NOT NULL,
      bank_name VARCHAR(255) NOT NULL,
      bank_account VARCHAR(100) NOT NULL,
      representative_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NOT NULL,
      messenger VARCHAR(20) NOT NULL,
      messenger_contact VARCHAR(255) NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'customer',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      customer_type VARCHAR(50) NOT NULL DEFAULT 'дилер',
      cart JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_registrations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name VARCHAR(255) NOT NULL,
      tax_id VARCHAR(50) NOT NULL,
      delivery_address TEXT NOT NULL,
      bank_name VARCHAR(255) NOT NULL,
      bank_account VARCHAR(100) NOT NULL,
      representative_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      messenger VARCHAR(20) NOT NULL,
      messenger_contact VARCHAR(255) NOT NULL,
      password TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      customer_type VARCHAR(50) NOT NULL DEFAULT 'дилер',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(500) NOT NULL,
      sku VARCHAR(100),
      price INTEGER NOT NULL,
      stock VARCHAR(20) NOT NULL,
      eta VARCHAR(100),
      description TEXT,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      moq INTEGER NOT NULL DEFAULT 0,
      image_url VARCHAR(500),
      brand VARCHAR(255),
      category VARCHAR(100),
      visible_customer_types TEXT[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number VARCHAR(50) NOT NULL UNIQUE,
      customer_id VARCHAR NOT NULL REFERENCES customers(id),
      total INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      payment_status VARCHAR(20) NOT NULL DEFAULT 'not_paid',
      delivery_status VARCHAR(20) NOT NULL DEFAULT 'processing',
      delivery_date TIMESTAMP,
      items JSONB NOT NULL,
      seen BOOLEAN NOT NULL DEFAULT true,
      admin_seen BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      corporate_markup_percentage INTEGER NOT NULL DEFAULT 10,
      government_markup_percentage INTEGER NOT NULL DEFAULT 10,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id VARCHAR NOT NULL REFERENCES customers(id),
      category VARCHAR(100),
      description TEXT,
      products_requested JSONB NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Отправлено',
      deadline TIMESTAMP,
      seen BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      inquiry_id VARCHAR NOT NULL REFERENCES inquiries(id),
      product_id VARCHAR,
      product_name VARCHAR(500) NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      delivery_time VARCHAR(100) NOT NULL,
      comment TEXT,
      seen BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id VARCHAR NOT NULL REFERENCES customers(id),
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Note: the "sessions" table is created automatically by connect-pg-simple
  // (see auth.ts: createTableIfMissing: true). Do not create it here.

  console.log("[STARTUP] Database tables created manually.");
}

async function seedAdminIfNeeded() {
  console.log("[STARTUP] Checking for admin account...");

  const existingAdmin = await db
    .select()
    .from(customers)
    .where(eq(customers.role, "admin"))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log("[STARTUP] Admin account already exists, skipping seed.");
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@b2b.chip.am";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin789";

  console.log(`[STARTUP] No admin found, creating admin account (${adminEmail})...`);
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await db.insert(customers).values({
    companyName: "chip.am Admin",
    taxId: "ADMIN-000",
    deliveryAddress: "N/A",
    bankName: "N/A",
    bankAccount: "N/A",
    representativeName: "Administrator",
    email: adminEmail,
    phone: "+374",
    messenger: "telegram",
    messengerContact: "admin",
    password: hashedPassword,
    role: "admin",
    status: "approved",
    customerType: "дилер",
  });

  console.log(`[STARTUP] Admin account created: ${adminEmail}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("[STARTUP] WARNING: Using default admin password. Set ADMIN_PASSWORD env var to change it.");
  }
}
