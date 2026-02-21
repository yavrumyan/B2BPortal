import { storage } from "./storage";
import bcrypt from "bcryptjs";

async function seed() {
  try {
    // Create admin account if it doesn't exist
    const adminEmail = "admin@chip.am";
    const existingAdmin = await storage.getCustomerByEmail(adminEmail);

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = await storage.createCustomer({
        companyName: "chip.am Admin",
        taxId: "00000000",
        deliveryAddress: "Yerevan, Armenia",
        bankName: "Admin Bank",
        bankAccount: "0000000000000000",
        representativeName: "Administrator",
        email: adminEmail,
        phone: "+374XXXXXXXX",
        messenger: "telegram",
        messengerContact: "@admin",
        password: hashedPassword,
        role: "admin",
      });
      console.log("✓ Admin user created:", admin.email);
    } else {
      console.log("✓ Admin user already exists");
    }

    // Create sample products if none exist
    const existingProducts = await storage.getProducts();
    if (existingProducts.length === 0) {
      const sampleProducts = [
        {
          name: "Ноутбук HP Pavilion 15",
          sku: "HP-PAV-15-001",
          price: 450000,
          stock: "in_stock" as const,
          eta: "1-2 дня",
          availableQuantity: 50,
          description: "15.6\" Full HD, Intel Core i5, 8GB RAM, 512GB SSD",
          imageUrl: null,
        },
        {
          name: "Монитор Dell UltraSharp 27\"",
          sku: "DELL-US-27-002",
          price: 180000,
          stock: "low_stock" as const,
          eta: null,
          availableQuantity: 5,
          description: "27\" 4K UHD, IPS панель, USB-C",
          imageUrl: null,
        },
        {
          name: "Клавиатура Logitech MX Keys",
          sku: "LOG-MX-KEY-003",
          price: 35000,
          stock: "on_order" as const,
          eta: "5-7 дней",
          availableQuantity: 100,
          description: "Беспроводная, механическая, подсветка",
          imageUrl: null,
        },
      ];

      for (const product of sampleProducts) {
        await storage.createProduct(product);
      }
      console.log(`✓ Created ${sampleProducts.length} sample products`);
    } else {
      console.log(`✓ Found ${existingProducts.length} existing products`);
    }

    console.log("\n✓ Seed completed successfully");
    console.log("\nLogin credentials:");
    console.log("Email: admin@chip.am");
    console.log("Password: admin123");
  } catch (error) {
    console.error("Seed error:", error);
    throw error;
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));
