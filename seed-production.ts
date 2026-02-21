import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

async function seedProduction() {
  // Get production database URL
  const prodDbUrl = process.env.DATABASE_URL;
  
  if (!prodDbUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  console.log("🔗 Connecting to production database...");
  const sql = neon(prodDbUrl);
  
  try {
    // Delete existing admin if any (to start fresh)
    await sql`DELETE FROM customers WHERE email = 'admin@chip.am'`;
    console.log("✓ Cleared any existing admin");

    // Create admin account
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const result = await sql`
      INSERT INTO customers (
        email, password, role, company_name, tax_id, 
        delivery_address, bank_name, bank_account, 
        representative_name, phone, messenger, messenger_contact
      ) VALUES (
        'admin@chip.am', 
        ${hashedPassword}, 
        'admin', 
        'chip.am Admin', 
        '00000000', 
        'Yerevan, Armenia', 
        'Admin Bank', 
        '0000000000000000',
        'Administrator', 
        '+374XXXXXXXX', 
        'telegram', 
        '@admin'
      )
      RETURNING email, role
    `;
    console.log("✅ Admin created:", result[0]);

    // Create sample products
    console.log("\n📦 Creating sample products...");
    
    await sql`DELETE FROM products`; // Clear existing
    
    const products = [
      {
        name: "Ноутбук HP Pavilion 15",
        sku: "HP-PAV-15-001",
        price: 450000,
        stock: "in_stock",
        eta: "1-2 дня",
        available_quantity: 50,
        description: "15.6\" Full HD, Intel Core i5, 8GB RAM, 512GB SSD"
      },
      {
        name: "Монитор Dell UltraSharp 27\"",
        sku: "DELL-US-27-002",
        price: 180000,
        stock: "low_stock",
        eta: null,
        available_quantity: 5,
        description: "27\" 4K UHD, IPS панель, USB-C"
      },
      {
        name: "Клавиатура Logitech MX Keys",
        sku: "LOG-MX-KEY-003",
        price: 35000,
        stock: "on_order",
        eta: "5-7 дней",
        available_quantity: 100,
        description: "Беспроводная, механическая, подсветка"
      }
    ];

    for (const p of products) {
      await sql`
        INSERT INTO products (name, sku, price, stock, eta, available_quantity, description)
        VALUES (${p.name}, ${p.sku}, ${p.price}, ${p.stock}, ${p.eta}, ${p.available_quantity}, ${p.description})
      `;
    }
    
    console.log(`✅ Created ${products.length} products`);
    
    // Verify
    const adminCheck = await sql`SELECT email, role FROM customers WHERE email = 'admin@chip.am'`;
    const productCount = await sql`SELECT COUNT(*) as count FROM products`;
    
    console.log("\n✅ Production database seeded successfully!");
    console.log("\nVerification:");
    console.log("  Admin:", adminCheck[0]?.email, adminCheck[0]?.role);
    console.log("  Products:", productCount[0]?.count);
    console.log("\n🔐 Login credentials:");
    console.log("  Email: admin@chip.am");
    console.log("  Password: admin123");
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

seedProduction().then(() => process.exit(0)).catch(() => process.exit(1));
