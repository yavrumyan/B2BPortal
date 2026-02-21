import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

async function checkProdAdmin() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  console.log("Using database URL:", databaseUrl.substring(0, 30) + "...");
  
  const sql = neon(databaseUrl);
  
  try {
    // Check if admin exists
    const admins = await sql`
      SELECT email, role, password, company_name
      FROM customers 
      WHERE email = 'admin@chip.am'
    `;
    
    if (admins.length === 0) {
      console.log("❌ Admin NOT found in production database");
      console.log("\nCreating admin account...");
      
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await sql`
        INSERT INTO customers (
          email, password, role, company_name, tax_id, 
          delivery_address, bank_name, bank_account, 
          representative_name, phone, messenger, messenger_contact
        ) VALUES (
          'admin@chip.am', ${hashedPassword}, 'admin', 'chip.am Admin', 
          '00000000', 'Yerevan, Armenia', 'Admin Bank', '0000000000000000',
          'Administrator', '+374XXXXXXXX', 'telegram', '@admin'
        )
      `;
      console.log("✅ Admin created successfully");
    } else {
      const admin = admins[0];
      console.log("✅ Admin found in production:");
      console.log("   Email:", admin.email);
      console.log("   Role:", admin.role);
      console.log("   Company:", admin.company_name);
      console.log("   Password hash:", admin.password.substring(0, 10) + "...");
      
      // Test password
      const isValid = await bcrypt.compare("admin123", admin.password);
      console.log("   Password 'admin123' valid:", isValid ? "✅ YES" : "❌ NO");
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

checkProdAdmin().then(() => process.exit(0)).catch(() => process.exit(1));
