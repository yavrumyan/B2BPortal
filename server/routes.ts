import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupSession, isAuthenticated, isAdmin } from "./auth";
import bcrypt from "bcryptjs";
import {
  insertBusinessRegistrationSchema,
  insertProductSchema,
  insertOrderSchema,
  insertInquirySchema,
  insertOfferSchema,
  inquiries,
  orders,
  customers,
  orderComments,
  type InsertOrderComment,
} from "@shared/schema";
import { eq, desc, and, lt, ne, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendAdminNewRegistrationEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusChangedEmail,
  sendAdminNewOrderEmail,
  sendNewOfferEmail,
  sendAdminNewInquiryEmail,
} from "./email.js";
import { generateInvoicePDF, generatePriceListPDF } from "./pdf.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // One-time initialization endpoint to seed production database
  app.post("/api/init-database", async (req, res) => {
    try {
      // Check if admin already exists
      const existingAdmin = await storage.getCustomerByEmail("admin@chip.am");
      if (existingAdmin) {
        return res.json({
          message: "Database already initialized",
          admin: "exists",
          products: (await storage.getProducts()).length
        });
      }

      // Create admin
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createCustomer({
        companyName: "chip.am Admin",
        taxId: "00000000",
        deliveryAddress: "Yerevan, Armenia",
        bankName: "Admin Bank",
        bankAccount: "0000000000000000",
        representativeName: "Administrator",
        email: "admin@chip.am",
        phone: "+374XXXXXXXX",
        messenger: "telegram",
        messengerContact: "@admin",
        password: hashedPassword,
        role: "admin",
        status: "approved",
        customerType: "дилер",
        cart: [],
      });

      // Create sample products if none exist
      const existingProducts = await storage.getProducts();
      if (existingProducts.length === 0) {
        await storage.createProduct({
          name: "Ноутбук HP Pavilion 15",
          sku: "HP-PAV-15-001",
          price: 450000,
          stock: "in_stock",
          eta: "1-2 дня",
          availableQuantity: 50,
          description: "15.6\" Full HD, Intel Core i5, 8GB RAM, 512GB SSD",
        });
        await storage.createProduct({
          name: "Монитор Dell UltraSharp 27\"",
          sku: "DELL-US-27-002",
          price: 180000,
          stock: "low_stock",
          availableQuantity: 5,
          description: "27\" 4K UHD, IPS панель, USB-C",
        });
        await storage.createProduct({
          name: "Клавиатура Logitech MX Keys",
          sku: "LOG-MX-KEY-003",
          price: 35000,
          stock: "on_order",
          eta: "5-7 дней",
          availableQuantity: 100,
          description: "Беспроводная, механическая, подсветка",
        });
      }

      res.json({
        success: true,
        message: "Database initialized successfully",
        credentials: { email: "admin@chip.am", password: "admin123" }
      });
    } catch (error) {
      console.error("Init database error:", error);
      res.status(500).json({ message: "Failed to initialize database" });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log("[LOGIN] Attempting login for:", email);
      const customer = await storage.getCustomerByEmail(email);

      if (!customer) {
        console.log("[LOGIN] Customer not found:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log("[LOGIN] Customer found:", email, "role:", customer.role);
      const isValidPassword = await bcrypt.compare(password, customer.password);
      console.log("[LOGIN] Password valid:", isValidPassword);

      if (!isValidPassword) {
        console.log("[LOGIN] Invalid password for:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Block login for pending and rejected accounts
      if (customer.status === 'pending') {
        return res.status(403).json({ message: "Ваша заявка ожидает одобрения администратора" });
      }
      if (customer.status === 'rejected') {
        return res.status(403).json({ message: "Ваша заявка была отклонена" });
      }

      // Regenerate session to prevent session fixation attacks
      const oldSessionData = req.session;
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        // Copy any existing session data and set customer ID
        Object.assign(req.session, oldSessionData);
        req.session.customerId = customer.id;

        const { password: _, ...customerWithoutPassword } = customer;
        res.json(customerWithoutPassword);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // GET logout for direct browser navigation
  app.get("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });

  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      const { password: _, ...customerWithoutPassword } = customer;
      res.json(customerWithoutPassword);
    } catch (error) {
      console.error("Get customer error:", error);
      res.status(500).json({ message: "Failed to get customer" });
    }
  });

  app.post("/api/auth/recover-password", async (req, res) => {
    try {
      const { email } = req.body;
      const customer = await storage.getCustomerByEmail(email);

      if (customer) {
        try {
          const token = await storage.createPasswordResetToken(customer.id);
          const { sendPasswordResetEmail } = await import("./email");
          await sendPasswordResetEmail(email, token);
          console.log(`[RECOVERY] Password reset email sent to: ${email}`);
        } catch (emailError: any) {
          console.error("[RECOVERY] Failed to send reset email:", emailError.message || emailError);
        }
      }

      res.json({ message: "Если аккаунт с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля." });
    } catch (error) {
      console.error("Password recovery error:", error);
      res.status(500).json({ message: "Ошибка при запросе восстановления пароля" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Токен и новый пароль обязательны." });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Пароль должен быть не менее 6 символов." });
      }

      const resetToken = await storage.getValidResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Ссылка для восстановления пароля недействительна или истекла." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateCustomerPassword(resetToken.customerId, hashedPassword);
      await storage.markResetTokenUsed(resetToken.id);

      console.log(`[RECOVERY] Password reset successful for customer: ${resetToken.customerId}`);
      res.json({ message: "Пароль успешно изменён. Теперь вы можете войти с новым паролем." });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Ошибка при сбросе пароля" });
    }
  });

  // Delete customer route (admin only)
  app.delete("/api/customers/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Delete customer error:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Registration route - creates a customer with "pending" status
  app.post("/api/registrations", async (req, res) => {
    try {
      const validatedData = insertBusinessRegistrationSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      const customer = await storage.createCustomer({
        ...validatedData,
        password: hashedPassword,
        role: 'customer',
        status: 'pending', // Start as pending
        customerType: 'дилер',
        cart: [],
      });

      const { password: _, ...customerWithoutPassword } = customer;
      // Fire-and-forget email notifications
      sendAdminNewRegistrationEmail(customer).catch(e => console.error('[EMAIL]', e));
      res.json(customerWithoutPassword);
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  // Product routes (public read, admin write)
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      const customerId = req.session?.customerId;
      
      // Filter products by customer type if authenticated (but admins see all)
      let filteredProducts = products;
      if (customerId) {
        const customer = await storage.getCustomerById(customerId);
        // Admins see all products regardless of visibility settings
        if (customer && customer.role !== "admin" && customer.customerType) {
          filteredProducts = products.filter(p => {
            // If visibleCustomerTypes is null or empty, product is visible to all
            if (!p.visibleCustomerTypes || p.visibleCustomerTypes.length === 0) {
              return true;
            }
            // Otherwise, check if customer's type is in the array
            return p.visibleCustomerTypes.includes(customer.customerType);
          });
        }
      }
      
      res.json(filteredProducts);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ message: "Failed to get products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ message: "Failed to get product" });
    }
  });

  app.post("/api/products", isAdmin, async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.json(product);
    } catch (error: any) {
      console.error("Create product error:", error);
      res.status(400).json({ message: error.message || "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ message: "Product deleted" });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.post("/api/products/bulk-import", isAdmin, async (req, res) => {
    try {
      const { products } = req.body;
      
      if (!Array.isArray(products)) {
        return res.status(400).json({ message: "Products must be an array" });
      }

      if (products.length === 0) {
        return res.status(400).json({ message: "No products to import" });
      }

      // Delete all existing products to ensure catalog has exactly these products
      await storage.deleteAllProducts();

      // Create each product (no upsert needed since we cleared everything)
      const importedProducts = await Promise.all(
        products.map(async (productData: any) => {
          // Remove id field to let database generate new IDs, or preserve it if provided
          const { id, ...dataWithoutId } = productData;
          const validatedData = insertProductSchema.parse(dataWithoutId);
          return await storage.createProduct(validatedData);
        })
      );

      res.json({
        message: `Successfully imported ${importedProducts.length} products (catalog replaced)`,
        count: importedProducts.length,
        products: importedProducts
      });
    } catch (error: any) {
      console.error("Bulk import error:", error);
      res.status(400).json({ message: error.message || "Failed to import products" });
    }
  });

  // Order routes
  app.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // If admin, return all orders. Otherwise, return only customer's orders
      const orders = customer.role === 'admin'
        ? await storage.getOrders()
        : await storage.getOrders(req.session.customerId);

      res.json(orders);
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ message: "Failed to get orders" });
    }
  });

  app.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      // Check customer account status before allowing order placement
      const orderingCustomer = await storage.getCustomerById(req.session.customerId!);
      if (!orderingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      if (orderingCustomer.status === 'pending') {
        return res.status(403).json({ message: "Ваша заявка ожидает одобрения администратора" });
      }
      if (orderingCustomer.status === 'rejected') {
        return res.status(403).json({ message: "Ваша заявка была отклонена" });
      }
      if (orderingCustomer.status === 'paused') {
        return res.status(403).json({ message: "Ваш аккаунт временно приостановлен из-за задолженности" });
      }

      // Fetch product names for each item and validate stock availability
      const itemsWithNames = await Promise.all(
        req.body.items.map(async (item: { productId: string; quantity: number; price: number; name?: string }) => {
          // Check if this is an offer item (custom item from offer, not in product catalog)
          const isOfferItem = item.productId.startsWith('offer-');
          
          if (isOfferItem) {
            // For offer items, use the provided name and don't check stock
            return {
              productId: item.productId,
              name: item.name || "Custom Offer Item",
              quantity: item.quantity,
              price: item.price,
            };
          }

          // For catalog products, validate they exist and have stock
          const product = await storage.getProductById(item.productId);
          
          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }

          // Check if sufficient quantity is available
          if (product.availableQuantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.availableQuantity}, Requested: ${item.quantity}`);
          }

          return {
            productId: item.productId,
            name: product.name,
            quantity: item.quantity,
            price: item.price,
          };
        })
      );

      const validatedData = insertOrderSchema.parse({
        ...req.body,
        items: itemsWithNames,
        customerId: req.session.customerId,
      });

      // Create the order
      const order = await storage.createOrder(validatedData);

      // Fire-and-forget order confirmation emails
      Promise.all([
        sendOrderConfirmationEmail(orderingCustomer, order),
        sendAdminNewOrderEmail(orderingCustomer, order),
      ]).catch(e => console.error('[EMAIL]', e));

      // Deduct quantities from product stock (only for catalog products, not offer items)
      // Also update inquiry status for offer items
      await Promise.all(
        itemsWithNames.map(async (item) => {
          // For offer items, update inquiry status to "Заказано"
          if (item.productId.startsWith('offer-')) {
            const offerId = item.productId.substring(6); // Remove "offer-" prefix
            const offer = await storage.getOfferById(offerId);
            if (offer) {
              await storage.updateInquiryStatus(offer.inquiryId, "Заказано");
            }
            return;
          }
          
          // For catalog products, deduct stock
          const product = await storage.getProductById(item.productId);
          if (product) {
            const newQuantity = product.availableQuantity - item.quantity;
            await storage.updateProduct(item.productId, {
              availableQuantity: newQuantity
            });
          }
        })
      );

      res.json(order);
    } catch (error: any) {
      console.error("Create order error:", error);
      res.status(400).json({ message: error.message || "Failed to create order" });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Only allow admin or the order owner to view
      if (customer.role !== 'admin' && order.customerId !== req.session.customerId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get customer name for the order
      const orderCustomer = await storage.getCustomerById(order.customerId);
      res.json({
        ...order,
        customerName: orderCustomer?.companyName || "Unknown"
      });
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ message: "Failed to get order" });
    }
  });

  app.patch("/api/orders/:id/status", isAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      res.json(order);
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.patch("/api/orders/:id/payment-status", isAdmin, async (req, res) => {
    try {
      const { paymentStatus } = req.body;
      const order = await storage.updateOrderPaymentStatus(req.params.id, paymentStatus);

      if (order) {
        // Update customer status based on new overdue payment totals
        await storage.updateCustomerStatusByDebt(order.customerId);
        // Notify customer of payment status change
        const customer = await storage.getCustomerById(order.customerId);
        if (customer) {
          sendOrderStatusChangedEmail(customer, order, 'payment').catch(e => console.error('[EMAIL]', e));
        }
      }

      res.json(order);
    } catch (error) {
      console.error("Update payment status error:", error);
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });

  app.patch("/api/orders/:id/delivery-status", isAdmin, async (req, res) => {
    try {
      const { deliveryStatus } = req.body;
      const order = await storage.updateOrderDeliveryStatus(req.params.id, deliveryStatus);

      if (order) {
        // Notify customer of delivery status change
        const customer = await storage.getCustomerById(order.customerId);
        if (customer) {
          sendOrderStatusChangedEmail(customer, order, 'delivery').catch(e => console.error('[EMAIL]', e));
        }
      }

      res.json(order);
    } catch (error) {
      console.error("Update delivery status error:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  app.patch("/api/orders/:id/delivery-date", isAdmin, async (req, res) => {
    try {
      const { deliveryDate } = req.body;
      const order = await storage.updateOrderDeliveryDate(req.params.id, deliveryDate);
      res.json(order);
    } catch (error) {
      console.error("Update delivery date error:", error);
      res.status(500).json({ message: "Failed to update delivery date" });
    }
  });

  app.patch("/api/orders/:id/items", isAdmin, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Items must be an array" });
      }
      const order = await storage.updateOrderItems(req.params.id, items);
      res.json(order);
    } catch (error) {
      console.error("Update order items error:", error);
      res.status(500).json({ message: "Failed to update order items" });
    }
  });

  app.patch("/api/orders/:id/seen", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const order = customer.role === 'admin' 
        ? await storage.markOrderAsAdminSeen(req.params.id)
        : await storage.markOrderAsSeen(req.params.id);
      res.json(order);
    } catch (error) {
      console.error("Mark order as seen error:", error);
      res.status(500).json({ message: "Failed to mark order as seen" });
    }
  });

  app.delete("/api/orders/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteOrder(req.params.id);
      res.json({ message: "Order deleted" });
    } catch (error) {
      console.error("Delete order error:", error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  app.get("/api/customers/:id/stats", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Only allow admin or the customer themselves to view stats
      if (customer.role !== 'admin' && req.params.id !== req.session.customerId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const stats = await storage.getCustomerOrderStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Get customer stats error:", error);
      res.status(500).json({ message: "Failed to get customer stats" });
    }
  });

  // Customer management routes (Admin Panel)
  app.get("/api/customers", isAdmin, async (req, res) => {
    try {
      const allCustomers = await storage.getCustomers();

      // Fetch order stats and update status for each customer
      const customersWithStats = await Promise.all(
        allCustomers.map(async (customer) => {
          // Update customer status based on overdue payments
          const updatedCustomer = await storage.updateCustomerStatusByDebt(customer.id);
          
          const stats = await storage.getCustomerOrderStats(customer.id);
          const { password, ...customerWithoutPassword } = updatedCustomer;
          return {
            ...customerWithoutPassword,
            totalOrders: stats.orderCount,
            totalAmount: stats.totalOrderAmount,
            overdueAmount: stats.overduePayments,
          };
        })
      );

      res.json(customersWithStats);
    } catch (error: any) {
      console.error('[GET /api/customers] Error:', error);
      res.status(500).json({ message: error.message || "Failed to fetch customers" });
    }
  });

  // Cart routes
  app.get("/api/cart", isAuthenticated, async (req, res) => {
    try {
      const cart = await storage.getCart(req.session.customerId!);
      res.json(cart);
    } catch (error) {
      console.error("Get cart error:", error);
      res.status(500).json({ message: "Failed to get cart" });
    }
  });

  app.post("/api/cart", isAuthenticated, async (req, res) => {
    try {
      await storage.updateCart(req.session.customerId!, req.body.cart);
      res.json({ message: "Cart updated" });
    } catch (error) {
      console.error("Update cart error:", error);
      res.status(500).json({ message: "Failed to update cart" });
    }
  });

  app.delete("/api/cart", isAuthenticated, async (req, res) => {
    try {
      await storage.clearCart(req.session.customerId!);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Clear cart error:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  app.patch("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get the requesting customer
      const requestingCustomer = await storage.getCustomerById(req.session.customerId!);
      if (!requestingCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Check if user is admin or updating their own profile
      const isAdmin = requestingCustomer.role === 'admin';
      const isOwnProfile = requestingCustomer.id === id;

      if (!isAdmin && !isOwnProfile) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Ensure email is not updated directly
      delete updates.email;
      delete updates.id;
      delete updates.createdAt;
      delete updates.password; // Don't allow password updates via this route

      // Only admins can update role, status, and customerType
      if (!isAdmin) {
        delete updates.role;
        delete updates.status;
        delete updates.customerType;
      }

      // Validate status if provided (admin only)
      if (updates.status) {
        const validStatuses = ["pending", "approved", "limited", "paused", "rejected"];
        if (!validStatuses.includes(updates.status.toLowerCase())) {
          return res.status(400).json({ message: "Invalid status. Must be pending, approved, limited, paused, or rejected" });
        }
      }

      // Validate customerType if provided (admin only)
      if (updates.customerType) {
        const validCustomerTypes = ["дилер", "корпоративный", "гос. учреждение"];
        if (!validCustomerTypes.includes(updates.customerType)) {
          return res.status(400).json({ message: "Invalid customer type. Must be дилер, корпоративный, or гос. учреждение" });
        }
      }

      // Check if there are any fields left to update
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updatedCustomer = await storage.updateCustomer(id, updates);

      // Send email when admin approves or rejects a registration
      if (isAdmin && updates.status && updatedCustomer.role !== 'admin') {
        if (updates.status === 'approved') {
          sendRegistrationApprovedEmail(updatedCustomer).catch(e => console.error('[EMAIL]', e));
        } else if (updates.status === 'rejected') {
          sendRegistrationRejectedEmail(updatedCustomer).catch(e => console.error('[EMAIL]', e));
        }
      }

      const { password: _, ...customerWithoutPassword } = updatedCustomer;
      res.json(customerWithoutPassword);
    } catch (error: any) {
      console.error("Update customer error:", error);
      res.status(400).json({ message: error.message || "Failed to update customer" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Get settings error:", error);
      res.status(500).json({ message: error.message || "Failed to get settings" });
    }
  });

  app.patch("/api/settings", isAdmin, async (req, res) => {
    try {
      const { corporateMarkupPercentage, governmentMarkupPercentage } = req.body;
      
      // Validate input
      if (corporateMarkupPercentage !== undefined && (typeof corporateMarkupPercentage !== "number" || corporateMarkupPercentage < 0 || corporateMarkupPercentage > 100)) {
        return res.status(400).json({ message: "Corporate markup percentage must be between 0 and 100" });
      }
      if (governmentMarkupPercentage !== undefined && (typeof governmentMarkupPercentage !== "number" || governmentMarkupPercentage < 0 || governmentMarkupPercentage > 100)) {
        return res.status(400).json({ message: "Government markup percentage must be between 0 and 100" });
      }

      const updates: any = {};
      if (corporateMarkupPercentage !== undefined) updates.corporateMarkupPercentage = corporateMarkupPercentage;
      if (governmentMarkupPercentage !== undefined) updates.governmentMarkupPercentage = governmentMarkupPercentage;

      const settings = await storage.updateSettings(updates);
      res.json(settings);
    } catch (error: any) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: error.message || "Failed to update settings" });
    }
  });

  // Inquiry routes
  app.post("/api/inquiries", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertInquirySchema.parse({
        ...req.body,
        customerId: req.session.customerId,
      });
      const inquiry = await storage.createInquiry(validatedData);

      // Notify admin about new inquiry (fire-and-forget)
      storage.getCustomerById(req.session.customerId!).then(cust => {
        if (cust) sendAdminNewInquiryEmail(cust).catch(e => console.error('[EMAIL]', e));
      }).catch(() => {});

      res.json(inquiry);
    } catch (error: any) {
      console.error("Create inquiry error:", error);
      const message = error.issues ? error.issues.map((i: any) => i.message).join(", ") : error.message;
      res.status(400).json({ message: message || "Failed to create inquiry" });
    }
  });

  app.get("/api/inquiries", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const customerInquiries = customer.role === 'admin'
        ? await storage.getInquiries()
        : await storage.getInquiries(req.session.customerId);

      // Include offers for each inquiry
      const inquiriesWithOffers = await Promise.all(
        customerInquiries.map(async (inquiry: any) => {
          const offers = await storage.getOffersByInquiry(inquiry.id);
          return { ...inquiry, offers };
        })
      );

      res.json(inquiriesWithOffers);
    } catch (error) {
      console.error("Get inquiries error:", error);
      res.status(500).json({ message: "Failed to get inquiries" });
    }
  });

  app.get("/api/inquiries/:id", isAuthenticated, async (req, res) => {
    try {
      const inquiry = await storage.getInquiryById(req.params.id);
      if (!inquiry) {
        return res.status(404).json({ message: "Inquiry not found" });
      }

      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer || (customer.role !== 'admin' && inquiry.customerId !== req.session.customerId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const inquiryOffers = await storage.getOffersByInquiry(req.params.id);
      res.json({ ...inquiry, offers: inquiryOffers });
    } catch (error) {
      console.error("Get inquiry error:", error);
      res.status(500).json({ message: "Failed to get inquiry" });
    }
  });

  app.patch("/api/inquiries/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      const inquiry = await storage.updateInquiryStatus(req.params.id, status);
      res.json(inquiry);
    } catch (error: any) {
      console.error("Update inquiry status error:", error);
      res.status(500).json({ message: error.message || "Failed to update inquiry status" });
    }
  });

  // Offer routes
  app.post("/api/offers", isAdmin, async (req, res) => {
    try {
      const validatedData = insertOfferSchema.parse(req.body);
      const offer = await storage.createOffer(validatedData);
      
      // Update inquiry status to "Получено предложение" and mark as unseen
      const inquiry = await storage.getInquiryById(req.body.inquiryId);
      if (inquiry) {
        if (inquiry.status === "Отправлено") {
          await storage.updateInquiryStatus(req.body.inquiryId, "Получено предложение");
        }
        // Mark inquiry as unseen so customer sees the badge
        await db.update(inquiries).set({ seen: false }).where(eq(inquiries.id, req.body.inquiryId));

        // Notify customer about new offer
        const inquiryCustomer = await storage.getCustomerById(inquiry.customerId);
        if (inquiryCustomer) {
          sendNewOfferEmail(inquiryCustomer, req.body.inquiryId).catch(e => console.error('[EMAIL]', e));
        }
      }

      res.json(offer);
    } catch (error: any) {
      console.error("Create offer error:", error);
      res.status(400).json({ message: error.message || "Failed to create offer" });
    }
  });

  app.get("/api/offers/inquiry/:inquiryId", isAuthenticated, async (req, res) => {
    try {
      const offers = await storage.getOffersByInquiry(req.params.inquiryId);
      res.json(offers);
    } catch (error) {
      console.error("Get offers error:", error);
      res.status(500).json({ message: "Failed to get offers" });
    }
  });

  app.patch("/api/offers/:id/seen", isAuthenticated, async (req, res) => {
    try {
      const offer = await storage.markOfferAsSeen(req.params.id);
      res.json(offer);
    } catch (error: any) {
      console.error("Mark offer seen error:", error);
      res.status(500).json({ message: error.message || "Failed to mark offer as seen" });
    }
  });

  app.get("/api/offers/unread-count", isAuthenticated, async (req, res) => {
    try {
      const count = await storage.getUnreadOffersCountByCustomer(req.session.customerId!);
      res.json({ count });
    } catch (error: any) {
      console.error("Get unread count error:", error);
      res.status(500).json({ message: error.message || "Failed to get unread count" });
    }
  });

  app.patch("/api/inquiries/:id/reject", isAdmin, async (req, res) => {
    try {
      const inquiry = await storage.updateInquiryStatus(req.params.id, "Нет предложения");
      res.json(inquiry);
    } catch (error: any) {
      console.error("Reject inquiry error:", error);
      res.status(500).json({ message: error.message || "Failed to reject inquiry" });
    }
  });

  app.patch("/api/inquiries/:id/seen", isAuthenticated, async (req, res) => {
    try {
      const inquiry = await storage.markInquiryAsSeen(req.params.id);
      res.json(inquiry);
    } catch (error: any) {
      console.error("Mark inquiry seen error:", error);
      res.status(500).json({ message: error.message || "Failed to mark inquiry as seen" });
    }
  });

  app.delete("/api/inquiries/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteInquiry(req.params.id);
      res.json({ message: "Inquiry deleted" });
    } catch (error: any) {
      console.error("Delete inquiry error:", error);
      res.status(500).json({ message: error.message || "Failed to delete inquiry" });
    }
  });

  // ─── Analytics ──────────────────────────────────────────────────────────────

  app.get("/api/analytics", isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // All orders
      const allOrders = await storage.getOrders();
      const allCustomers = await storage.getCustomers();
      const nonAdminCustomers = allCustomers.filter(c => c.role !== 'admin');

      // Revenue this month vs last month
      const thisMonthOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfThisMonth);
      const lastMonthOrders = allOrders.filter(o => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        return d >= startOfLastMonth && d < startOfThisMonth;
      });
      const revenueThisMonth = thisMonthOrders.reduce((s, o) => s + o.total, 0);
      const revenueLastMonth = lastMonthOrders.reduce((s, o) => s + o.total, 0);

      // Orders per day (last 30 days)
      const dailyMap = new Map<string, { date: string; orders: number; revenue: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dailyMap.set(key, { date: key, orders: 0, revenue: 0 });
      }
      allOrders.forEach(o => {
        if (!o.createdAt) return;
        const key = new Date(o.createdAt).toISOString().slice(0, 10);
        if (dailyMap.has(key)) {
          const entry = dailyMap.get(key)!;
          entry.orders += 1;
          entry.revenue += o.total;
        }
      });
      const dailyOrders = Array.from(dailyMap.values());

      // Revenue by customer type
      const revenueByType: Record<string, number> = { дилер: 0, корпоративный: 0, 'гос. учреждение': 0 };
      for (const order of allOrders) {
        const cust = allCustomers.find(c => c.id === order.customerId);
        if (cust) {
          const type = cust.customerType ?? 'дилер';
          revenueByType[type] = (revenueByType[type] ?? 0) + order.total;
        }
      }
      const revenueByTypeArr = Object.entries(revenueByType).map(([type, value]) => ({ type, value }));

      // Top 5 customers by revenue
      const customerRevenue = new Map<string, number>();
      for (const order of allOrders) {
        customerRevenue.set(order.customerId, (customerRevenue.get(order.customerId) ?? 0) + order.total);
      }
      const topCustomers = Array.from(customerRevenue.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, revenue]) => {
          const cust = allCustomers.find(c => c.id === id);
          return { id, name: cust?.companyName ?? id, revenue };
        });

      // Top 5 products by revenue
      const productRevenue = new Map<string, { name: string; revenue: number }>();
      for (const order of allOrders) {
        const items = (order.items as any[]) ?? [];
        for (const item of items) {
          const key = item.productId ?? item.name;
          const existing = productRevenue.get(key);
          if (existing) {
            existing.revenue += item.price * item.quantity;
          } else {
            productRevenue.set(key, { name: item.name ?? key, revenue: item.price * item.quantity });
          }
        }
      }
      const topProducts = Array.from(productRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Overdue total (unpaid or partial, older than 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const overdueOrders = allOrders.filter(o =>
        o.paymentStatus !== 'paid' &&
        o.createdAt && new Date(o.createdAt) < sevenDaysAgo
      );
      const overdueTotal = overdueOrders.reduce((s, o) => {
        const paid = o.paymentStatus === 'partially_paid' ? o.total * 0.5 : 0;
        return s + (o.total - paid);
      }, 0);

      res.json({
        revenueThisMonth,
        revenueLastMonth,
        totalOrders: allOrders.length,
        totalCustomers: nonAdminCustomers.length,
        overdueTotal,
        dailyOrders,
        revenueByType: revenueByTypeArr,
        topCustomers,
        topProducts,
      });
    } catch (error: any) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: error.message || "Failed to get analytics" });
    }
  });

  // ─── Order Comments ──────────────────────────────────────────────────────────

  app.get("/api/orders/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) return res.status(401).json({ message: "Unauthorized" });

      // Only admin or the order owner can see comments
      if (customer.role !== 'admin' && order.customerId !== customer.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const comments = await storage.getOrderComments(req.params.id);

      // Filter out internal comments for non-admins
      const visibleComments = customer.role === 'admin'
        ? comments
        : comments.filter(c => !c.isInternal);

      res.json(visibleComments);
    } catch (error: any) {
      console.error("Get comments error:", error);
      res.status(500).json({ message: error.message || "Failed to get comments" });
    }
  });

  app.post("/api/orders/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) return res.status(401).json({ message: "Unauthorized" });

      // Only admin or order owner can comment
      if (customer.role !== 'admin' && order.customerId !== customer.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { message, isInternal } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Only admins can post internal notes
      const internal = customer.role === 'admin' ? Boolean(isInternal) : false;

      const comment = await storage.addOrderComment({
        orderId: req.params.id,
        authorId: customer.id,
        authorRole: customer.role,
        authorName: customer.role === 'admin' ? 'Менеджер' : customer.companyName,
        message: message.trim(),
        isInternal: internal,
      });

      res.json(comment);
    } catch (error: any) {
      console.error("Add comment error:", error);
      res.status(500).json({ message: error.message || "Failed to add comment" });
    }
  });

  // ─── PDF Endpoints ───────────────────────────────────────────────────────────

  app.get("/api/orders/:id/pdf", isAuthenticated, async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const requestingCustomer = await storage.getCustomerById(req.session.customerId!);
      if (!requestingCustomer) return res.status(401).json({ message: "Unauthorized" });

      // Only admin or order owner can download
      if (requestingCustomer.role !== 'admin' && order.customerId !== requestingCustomer.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const orderCustomer = await storage.getCustomerById(order.customerId);
      if (!orderCustomer) return res.status(404).json({ message: "Customer not found" });

      const pdfBuffer = await generateInvoicePDF(
        { ...order, customerName: orderCustomer.companyName },
        orderCustomer
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Generate invoice PDF error:", error);
      res.status(500).json({ message: error.message || "Failed to generate PDF" });
    }
  });

  app.get("/api/price-list/pdf", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.session.customerId!);
      if (!customer) return res.status(401).json({ message: "Unauthorized" });

      const products = await storage.getProducts();
      const settings = await storage.getSettings();

      const pdfBuffer = await generatePriceListPDF(customer, products, settings);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="price-list-${customer.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Generate price list PDF error:", error);
      res.status(500).json({ message: error.message || "Failed to generate price list PDF" });
    }
  });

  // Admin: generate price list PDF for any customer
  app.get("/api/customers/:id/price-list/pdf", isAdmin, async (req, res) => {
    try {
      const customer = await storage.getCustomerById(req.params.id);
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const products = await storage.getProducts();
      const settings = await storage.getSettings();

      const pdfBuffer = await generatePriceListPDF(customer, products, settings);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="price-list-${customer.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Generate customer price list PDF error:", error);
      res.status(500).json({ message: error.message || "Failed to generate price list PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}