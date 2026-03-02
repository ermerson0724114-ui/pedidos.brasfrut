import { pgTable, serial, text, integer, boolean, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  registration_number: varchar("registration_number", { length: 50 }).notNull().unique(),
  password: text("password").notNull().default(""),
  email: text("email").default(""),
  whatsapp: text("whatsapp").default(""),
  funcao: text("funcao").default(""),
  setor: text("setor").default(""),
  distribuicao: text("distribuicao").default(""),
  admissao: text("admissao").default(""),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  failed_attempts: integer("failed_attempts").notNull().default(0),
  is_locked: boolean("is_locked").notNull().default(false),
  profile_image_url: text("profile_image_url"),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  item_limit: integer("item_limit"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const subgroups = pgTable("subgroups", {
  id: serial("id").primaryKey(),
  group_id: integer("group_id").notNull(),
  name: text("name").notNull(),
  item_limit: integer("item_limit"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  group_id: integer("group_id").notNull(),
  subgroup_id: integer("subgroup_id"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  unit: varchar("unit", { length: 20 }).notNull().default("un"),
  available: boolean("available").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
});

export const cycles = pgTable("cycles", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  employee_id: integer("employee_id").notNull(),
  employee_name: text("employee_name").notNull(),
  employee_registration: text("employee_registration").default(""),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  cycle_id: integer("cycle_id").notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull(),
  product_id: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  product_name_snapshot: text("product_name_snapshot").notNull(),
  group_name_snapshot: text("group_name_snapshot").notNull(),
  subgroup_name_snapshot: text("subgroup_name_snapshot"),
  unit_price: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  employee_id: integer("employee_id"),
  employee_name: text("employee_name").notNull(),
  employee_registration: text("employee_registration").default(""),
  action: varchar("action", { length: 50 }).notNull(),
  order_id: integer("order_id"),
  order_total: decimal("order_total", { precision: 10, scale: 2 }),
  cycle_reference: text("cycle_reference").default(""),
  ip_address: text("ip_address").default(""),
  details: text("details").default(""),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, created_at: true });

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true });
export const insertSubgroupSchema = createInsertSchema(subgroups).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCycleSchema = createInsertSchema(cycles).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Subgroup = typeof subgroups.$inferSelect;
export type InsertSubgroup = z.infer<typeof insertSubgroupSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Cycle = typeof cycles.$inferSelect;
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
