import {
  customers,
  products,
  orders,
  settings,
  inquiries,
  offers,
  passwordResetTokens,
  type Customer,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type Settings,
  type InsertSettings,
  type Inquiry,
  type InsertInquiry,
  type Offer,
  type InsertOffer,
  type PasswordResetToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface IStorage {
  // Customer operations
  getCustomerById(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  getCustomers(): Promise<Customer[]>;
  updateCustomer(id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>; // Delete customer and associated data
  getCustomerOrderStats(customerId: string): Promise<{
    orderCount: number;
    totalOrderAmount: number;
    overduePayments: number;
  }>;
  updateCustomerStatusByDebt(customerId: string): Promise<Customer>; // Auto-update status based on overdue payments



  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | undefined>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  deleteAllProducts(): Promise<void>; // Delete all products
  upsertProduct(product: InsertProduct & { id?: string }): Promise<Product>; // Create or update by ID

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrders(customerId?: string): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderPaymentStatus(id: string, paymentStatus: string): Promise<Order>;
  updateOrderDeliveryStatus(id: string, deliveryStatus: string): Promise<Order>;
  updateOrderDeliveryDate(id: string, deliveryDate: string): Promise<Order>;
  updateOrderItems(id: string, items: any[]): Promise<Order>;
  markOrderAsSeen(id: string): Promise<Order>;
  markOrderAsAdminSeen(id: string): Promise<Order>;
  deleteOrder(id: string): Promise<void>; // Added deleteOrder method

  // Cart operations
  getCart(customerId: string): Promise<any[]>;
  updateCart(customerId: string, cart: any[]): Promise<void>;
  clearCart(customerId: string): Promise<void>;

  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(updates: InsertSettings): Promise<Settings>;

  // Inquiry operations
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  getInquiries(customerId?: string): Promise<Inquiry[]>;
  getInquiryById(id: string): Promise<Inquiry | undefined>;
  updateInquiryStatus(id: string, status: string): Promise<Inquiry>;
  deleteInquiry(id: string): Promise<void>;
  markInquiryAsSeen(id: string): Promise<Inquiry>;

  // Offer operations
  createOffer(offer: InsertOffer): Promise<Offer>;
  getOffersByInquiry(inquiryId: string): Promise<Offer[]>;
  markOfferAsSeen(offerId: string): Promise<Offer>;
  getUnreadOffersCountByCustomer(customerId: string): Promise<number>;

  // Password reset operations
  createPasswordResetToken(customerId: string): Promise<string>;
  getValidResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markResetTokenUsed(tokenId: string): Promise<void>;
  updateCustomerPassword(customerId: string, hashedPassword: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Customer operations
  async getCustomerById(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomerOrderStats(customerId: string): Promise<{
    orderCount: number;
    totalOrderAmount: number;
    overduePayments: number;
  }> {
    const customerOrders = await this.getOrders(customerId);
    const orderCount = customerOrders.length;
    const totalOrderAmount = customerOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate overdue payments
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const overduePayments = customerOrders
      .filter(order => {
        const orderDate = new Date(order.createdAt!);
        const isOverdue = orderDate < oneWeekAgo;
        const isNotFullyPaid = order.paymentStatus === 'not_paid' || order.paymentStatus === 'partially_paid';
        return isOverdue && isNotFullyPaid;
      })
      .reduce((sum, order) => sum + order.total, 0);

    return {
      orderCount,
      totalOrderAmount,
      overduePayments,
    };
  }

  async updateCustomer(id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer> {
    // Ensure we're not trying to update protected fields
    const safeUpdates = { ...updates };
    delete (safeUpdates as any).id;
    delete (safeUpdates as any).createdAt;

    const [updated] = await db
      .update(customers)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();

    if (!updated) {
      throw new Error("Customer not found");
    }

    return updated;
  }

  async deleteCustomer(id: string): Promise<void> {
    // Delete all orders associated with this customer first
    await db.delete(orders).where(eq(orders.customerId, id));
    // Then delete the customer
    await db.delete(customers).where(eq(customers.id, id));
  }

  async updateCustomerStatusByDebt(customerId: string): Promise<Customer> {
    const customer = await this.getCustomerById(customerId);

    if (!customer) {
      return { id: customerId } as Customer;
    }

    // Never auto-change status for pending, rejected, or admin accounts
    // Only recalculate debt-based status for approved/limited/paused customers
    if (customer.status === 'pending' || customer.status === 'rejected' || customer.role === 'admin') {
      return customer;
    }

    // Get customer stats to calculate status based on overdue payments
    const stats = await this.getCustomerOrderStats(customerId);

    let newStatus = "approved"; // Default for active customers with no overdue debt

    if (stats.totalOrderAmount > 0) {
      const overduePercentage = stats.overduePayments / stats.totalOrderAmount;

      if (overduePercentage >= 0.5) {
        // Overdue >= 50% of total orders → Paused
        newStatus = "paused";
      } else if (stats.overduePayments > 0) {
        // Overdue < 50% but has some overdue → Limited
        newStatus = "limited";
      }
    }

    // Update customer status only if it changed
    if (customer.status !== newStatus) {
      return await this.updateCustomer(customerId, { status: newStatus as any });
    }

    return customer;
  }



  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async updateProduct(id: string, productData: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async deleteAllProducts(): Promise<void> {
    await db.delete(products);
  }

  async upsertProduct(product: InsertProduct & { id?: string }): Promise<Product> {
    // If ID is provided, update the existing product
    if (product.id) {
      const existing = await db.select().from(products).where(eq(products.id, product.id));
      
      if (existing.length > 0) {
        // Update existing product by ID
        const { id, ...dataToUpdate } = product;
        const [updated] = await db
          .update(products)
          .set({ ...dataToUpdate, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();
        return updated;
      }
    }
    
    // Create new product if no ID provided or ID not found
    const { id, ...dataToInsert } = product;
    const [newProduct] = await db.insert(products).values(dataToInsert).returning();
    return newProduct;
  }

  // Order operations
  async createOrder(data: InsertOrder): Promise<Order> {
    // Generate order number based on date, sequence, and total
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    }).replace(/\//g, '');

    // Get count of orders created today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const todayOrders = await db.select()
      .from(orders)
      .where(
        sql`${orders.createdAt} >= ${startOfDay} AND ${orders.createdAt} < ${endOfDay}`
      );

    const sequence = todayOrders.length + 1;
    const orderNumber = `${dateStr}-${sequence}-${data.total}`;

    const [order] = await db.insert(orders).values({
      ...data,
      orderNumber
    }).returning();
    return order;
  }

  async getOrders(customerId?: string): Promise<Order[]> {
    if (customerId) {
      return await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, customerId))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select()
      .from(orders)
      .where(eq(orders.id, id));

    return order;
  }


  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async updateOrderPaymentStatus(id: string, paymentStatus: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ paymentStatus, seen: false, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async updateOrderDeliveryStatus(id: string, deliveryStatus: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ deliveryStatus, seen: false, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async updateOrderDeliveryDate(id: string, deliveryDate: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ deliveryDate: new Date(deliveryDate), updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async updateOrderItems(id: string, items: any[]): Promise<Order> {
    // Calculate new total from items
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const [updated] = await db
      .update(orders)
      .set({ items: items as any, total, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async markOrderAsSeen(id: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ seen: true })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async markOrderAsAdminSeen(id: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ adminSeen: true })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    return updated;
  }

  async deleteOrder(id: string): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Cart operations
  async getCart(customerId: string): Promise<any[]> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }
    return (customer as any).cart || [];
  }

  async updateCart(customerId: string, cart: any[]): Promise<void> {
    await db
      .update(customers)
      .set({ cart: cart as any, updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  }

  async clearCart(customerId: string): Promise<void> {
    await db
      .update(customers)
      .set({ cart: [] as any, updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  }

  // Settings operations
  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings).limit(1);
    if (setting) {
      return setting;
    }
    // Create default settings if none exist
    const [newSetting] = await db
      .insert(settings)
      .values({
        corporateMarkupPercentage: 10,
        governmentMarkupPercentage: 10,
      })
      .returning();
    return newSetting;
  }

  async updateSettings(updates: InsertSettings): Promise<Settings> {
    // Get existing settings
    let [existing] = await db.select().from(settings).limit(1);
    
    if (!existing) {
      // Create if doesn't exist
      [existing] = await db
        .insert(settings)
        .values({
          corporateMarkupPercentage: 10,
          governmentMarkupPercentage: 10,
        })
        .returning();
    }

    // Update the first (and only) settings row
    const [updated] = await db
      .update(settings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(settings.id, existing.id))
      .returning();

    return updated;
  }

  // Inquiry operations
  async createInquiry(inquiryData: InsertInquiry): Promise<Inquiry> {
    const [inquiry] = await db.insert(inquiries).values(inquiryData).returning();
    return inquiry;
  }

  async getInquiries(customerId?: string): Promise<Inquiry[]> {
    if (customerId) {
      return await db
        .select()
        .from(inquiries)
        .where(eq(inquiries.customerId, customerId))
        .orderBy(desc(inquiries.createdAt));
    }
    return await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  }

  async getInquiryById(id: string): Promise<Inquiry | undefined> {
    const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, id));
    return inquiry;
  }

  async updateInquiryStatus(id: string, status: string): Promise<Inquiry> {
    const [updated] = await db
      .update(inquiries)
      .set({ status, updatedAt: new Date() })
      .where(eq(inquiries.id, id))
      .returning();

    if (!updated) {
      throw new Error("Inquiry not found");
    }

    return updated;
  }

  async deleteInquiry(id: string): Promise<void> {
    // Delete all related offers first to handle foreign key constraints
    await db.delete(offers).where(eq(offers.inquiryId, id));
    // Then delete the inquiry
    await db.delete(inquiries).where(eq(inquiries.id, id));
  }

  async markInquiryAsSeen(id: string): Promise<Inquiry> {
    const [updated] = await db
      .update(inquiries)
      .set({ seen: true })
      .where(eq(inquiries.id, id))
      .returning();

    if (!updated) {
      throw new Error("Inquiry not found");
    }

    return updated;
  }

  // Offer operations
  async createOffer(offerData: InsertOffer): Promise<Offer> {
    const [offer] = await db.insert(offers).values(offerData).returning();
    return offer;
  }

  async getOffersByInquiry(inquiryId: string): Promise<Offer[]> {
    return await db
      .select()
      .from(offers)
      .where(eq(offers.inquiryId, inquiryId))
      .orderBy(desc(offers.createdAt));
  }

  async getOfferById(offerId: string): Promise<Offer | undefined> {
    const [offer] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offerId));
    return offer;
  }

  async markOfferAsSeen(offerId: string): Promise<Offer> {
    const [updated] = await db
      .update(offers)
      .set({ seen: true })
      .where(eq(offers.id, offerId))
      .returning();

    if (!updated) {
      throw new Error("Offer not found");
    }

    return updated;
  }

  async getUnreadOffersCountByCustomer(customerId: string): Promise<number> {
    // Get all inquiries for this customer
    const customerInquiries = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.customerId, customerId));

    if (customerInquiries.length === 0) {
      return 0;
    }

    const inquiryIds = customerInquiries.map(inq => inq.id);

    // Count unread offers for these inquiries
    const unreadOffers = await db
      .select()
      .from(offers)
      .where(sql`${offers.inquiryId} IN (${sql.join(inquiryIds, sql`, `)}) AND ${offers.seen} = false`);

    return unreadOffers.length;
  }
  // Password reset operations
  async createPasswordResetToken(customerId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await db.insert(passwordResetTokens).values({
      customerId,
      token,
      expiresAt,
    });

    return token;
  }

  async getValidResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      );
    return resetToken;
  }

  async markResetTokenUsed(tokenId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async updateCustomerPassword(customerId: string, hashedPassword: string): Promise<void> {
    await db
      .update(customers)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  }
}

export const storage = new DatabaseStorage();