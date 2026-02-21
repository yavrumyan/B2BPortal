
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function addOrderColumns() {
  try {
    console.log("Adding payment_status and delivery_status columns to orders table...");
    
    // Add payment_status column
    await db.execute(sql`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'not_paid' NOT NULL
    `);
    
    // Add delivery_status column
    await db.execute(sql`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'processing' NOT NULL
    `);
    
    console.log("Columns added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error adding columns:", error);
    process.exit(1);
  }
}

addOrderColumns();
