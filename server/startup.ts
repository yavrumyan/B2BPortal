import { db, pool } from "./db";
import { customers, orders } from "@shared/schema";
import { eq, lt, and, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function runStartupTasks() {
  console.log("[STARTUP] Running startup tasks...");

  try {
    await ensureTablesExist();
    await seedAdminIfNeeded();
    console.log("[STARTUP] All startup tasks completed successfully.");
    scheduleOverdueReminders();
  } catch (err) {
    console.error("[STARTUP] Error during startup tasks:", err);
  }
}

function scheduleOverdueReminders() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  // Run once after 1 minute delay, then every 24 hours
  setTimeout(async () => {
    await sendOverdueReminders();
    setInterval(sendOverdueReminders, TWENTY_FOUR_HOURS);
  }, 60 * 1000);
  console.log("[STARTUP] Overdue reminder scheduler started (runs daily).");
}

async function sendOverdueReminders() {
  try {
    console.log("[OVERDUE] Checking for overdue payments...");
    const { sendOverdueReminderEmail } = await import("./email.js");

    // Find orders older than 7 days with unpaid or partial payment
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const overdueOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          ne(orders.paymentStatus, "paid"),
          lt(orders.createdAt, sevenDaysAgo)
        )
      );

    if (overdueOrders.length === 0) {
      console.log("[OVERDUE] No overdue orders found.");
      return;
    }

    // Group overdue orders by customer
    const byCustomer = new Map<string, typeof overdueOrders>();
    for (const order of overdueOrders) {
      const list = byCustomer.get(order.customerId) ?? [];
      list.push(order);
      byCustomer.set(order.customerId, list);
    }

    for (const [customerId, customerOrders] of Array.from(byCustomer)) {
      const customer = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1)
        .then(r => r[0]);

      if (!customer || customer.role === 'admin') continue;

      await sendOverdueReminderEmail(customer, customerOrders).catch(err =>
        console.error(`[OVERDUE] Failed to send reminder to ${customer.email}:`, err)
      );
    }

    console.log(`[OVERDUE] Sent reminders to ${byCustomer.size} customer(s).`);
  } catch (err) {
    console.error("[OVERDUE] Error in overdue reminder job:", err);
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_comments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      author_id VARCHAR NOT NULL,
      author_role VARCHAR(20) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_internal BOOLEAN NOT NULL DEFAULT false,
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
