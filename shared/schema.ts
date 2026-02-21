import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Business customers table (after approval)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  taxId: varchar("tax_id", { length: 50 }).notNull().unique(),
  deliveryAddress: text("delivery_address").notNull(),
  bankName: varchar("bank_name", { length: 255 }).notNull(),
  bankAccount: varchar("bank_account", { length: 100 }).notNull(),
  representativeName: varchar("representative_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }).notNull(),
  messenger: varchar("messenger", { length: 20 }).notNull(), // telegram, whatsapp, viber
  messengerContact: varchar("messenger_contact", { length: 255 }).notNull(),
  password: text("password").notNull(),
  role: varchar("role", { length: 20 }).default("customer").notNull(), // admin or customer
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, limited, paused, rejected
  customerType: varchar("customer_type", { length: 50 }).default("дилер").notNull(), // дилер, корпоративный, гос. учреждение
  cart: jsonb('cart').default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Customer = typeof customers.$inferSelect;

// Business registrations table (pending approval)
export const businessRegistrations = pgTable("business_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  taxId: varchar("tax_id", { length: 50 }).notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  bankName: varchar("bank_name", { length: 255 }).notNull(),
  bankAccount: varchar("bank_account", { length: 100 }).notNull(),
  representativeName: varchar("representative_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  messenger: varchar("messenger", { length: 20 }).notNull(), // telegram, whatsapp, viber
  messengerContact: varchar("messenger_contact", { length: 255 }).notNull(),
  password: text("password").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected, limited, paused
  customerType: varchar("customer_type", { length: 50 }).default("дилер").notNull(), // дилер, корпоративный, гос. учреждение
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusinessRegistrationSchema = createInsertSchema(businessRegistrations).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBusinessRegistration = z.infer<typeof insertBusinessRegistrationSchema>;
export type BusinessRegistration = typeof businessRegistrations.$inferSelect;

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 500 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  price: integer("price").notNull(), // in AMD (Armenian Dram)
  stock: varchar("stock", { length: 20 }).notNull(), // in_stock, low_stock, out_of_stock, on_order
  eta: varchar("eta", { length: 100 }),
  description: text("description"),
  availableQuantity: integer("available_quantity").default(0).notNull(),
  moq: integer("moq").default(0).notNull(), // Minimum Order Quantity; 0 = no restriction
  imageUrl: varchar("image_url", { length: 500 }),
  brand: varchar("brand", { length: 255 }), // Brand name
  category: varchar("category", { length: 100 }), // Product category
  visibleCustomerTypes: text("visible_customer_types").array(), // [дилер, корпоративный, гос. учреждение]; null/empty = visible to all
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  total: integer("total").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, confirmed, completed, cancelled
  paymentStatus: varchar("payment_status", { length: 20 }).default("not_paid").notNull(), // not_paid, partially_paid, paid
  deliveryStatus: varchar("delivery_status", { length: 20 }).default("processing").notNull(), // processing, confirmed, transit, delivered
  deliveryDate: timestamp("delivery_date"),
  items: jsonb("items").notNull(), // array of { productId, name, price, quantity }
  seen: boolean().default(true).notNull(), // whether customer has viewed this order after last status update
  adminSeen: boolean().default(false).notNull(), // whether admin has viewed this order after creation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Settings table for system configuration
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  corporateMarkupPercentage: integer("corporate_markup_percentage").default(10).notNull(),
  governmentMarkupPercentage: integer("government_markup_percentage").default(10).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = Partial<Omit<Settings, 'id' | 'updatedAt'>>;

// Inquiries table for product requests from customers
export const inquiries = pgTable("inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  category: varchar("category", { length: 100 }), // deprecated - kept for backwards compatibility, now in productsRequested
  description: text("description"), // deprecated - kept for backwards compatibility, now in productsRequested
  productsRequested: jsonb("products_requested").notNull(), // array of { category, description, quantity }
  status: varchar("status", { length: 50 }).default("Отправлено").notNull(), // Отправлено, Получено предложение, Заказано, Нет предложения, Закрыто
  deadline: timestamp("deadline"),
  seen: boolean().default(false).notNull(), // whether customer has seen the inquiry updates
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInquirySchema = z.object({
  customerId: z.string(),
  productsRequested: z.array(z.object({
    category: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    image: z.string().optional(), // base64 encoded image
  })).min(1, "At least one product is required"),
  deadline: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiries.$inferSelect;

// Offers table for admin responses to inquiries
export const offers = pgTable("offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inquiryId: varchar("inquiry_id").notNull().references(() => inquiries.id),
  productId: varchar("product_id"), // link to product for cart functionality
  productName: varchar("product_name", { length: 500 }).notNull(),
  price: integer("price").notNull(), // in AMD
  quantity: integer("quantity").default(1).notNull(), // quantity offered
  deliveryTime: varchar("delivery_time", { length: 100 }).notNull(),
  comment: text("comment"),
  seen: boolean().default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  seen: true,
  createdAt: true,
});

export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offers.$inferSelect;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;