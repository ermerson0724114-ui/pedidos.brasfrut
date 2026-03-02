import { db } from "./db";
import { eq, asc, desc } from "drizzle-orm";
import {
  settings, employees, groups, subgroups, products, cycles, orders, orderItems, auditLogs,
  type Employee, type InsertEmployee,
  type Group, type InsertGroup,
  type Subgroup, type InsertSubgroup,
  type Product, type InsertProduct,
  type Cycle, type InsertCycle,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type AuditLog, type InsertAuditLog,
} from "@shared/schema";

export interface GroupWithSubgroups extends Group {
  subgroups: Subgroup[];
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface IStorage {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByRegistration(reg: string): Promise<Employee | undefined>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<void>;

  getGroups(): Promise<GroupWithSubgroups[]>;
  getGroup(id: number): Promise<GroupWithSubgroups | undefined>;
  createGroup(data: InsertGroup): Promise<Group>;
  updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<void>;

  getSubgroups(groupId: number): Promise<Subgroup[]>;
  createSubgroup(data: InsertSubgroup): Promise<Subgroup>;
  updateSubgroup(id: number, data: Partial<InsertSubgroup>): Promise<Subgroup | undefined>;
  deleteSubgroup(id: number): Promise<void>;

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;

  getCycles(): Promise<Cycle[]>;
  getCycle(id: number): Promise<Cycle | undefined>;
  createCycle(data: InsertCycle): Promise<Cycle>;
  updateCycle(id: number, data: Partial<InsertCycle>): Promise<Cycle | undefined>;

  getOrders(): Promise<OrderWithItems[]>;
  getOrdersByCycle(cycleId: number): Promise<OrderWithItems[]>;
  getOrdersByEmployee(employeeId: number): Promise<OrderWithItems[]>;
  getOrder(id: number): Promise<OrderWithItems | undefined>;
  createOrder(data: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithItems>;
  updateOrder(id: number, data: Partial<InsertOrder>, items?: InsertOrderItem[]): Promise<OrderWithItems | undefined>;
  deleteOrder(id: number): Promise<void>;

  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  async getSetting(key: string): Promise<string | null> {
    const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  async getEmployees(): Promise<Employee[]> {
    return db.select().from(employees);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return rows[0];
  }

  async getEmployeeByRegistration(reg: string): Promise<Employee | undefined> {
    const rows = await db.select().from(employees).where(eq(employees.registration_number, reg)).limit(1);
    return rows[0];
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const rows = await db.insert(employees).values(data).returning();
    return rows[0];
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const rows = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
    return rows[0];
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  async getGroups(): Promise<GroupWithSubgroups[]> {
    const allGroups = await db.select().from(groups).orderBy(asc(groups.sort_order));
    const allSubs = await db.select().from(subgroups).orderBy(asc(subgroups.sort_order));
    return allGroups.map(g => ({
      ...g,
      subgroups: allSubs.filter(s => s.group_id === g.id),
    }));
  }

  async getGroup(id: number): Promise<GroupWithSubgroups | undefined> {
    const rows = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!rows[0]) return undefined;
    const subs = await db.select().from(subgroups).where(eq(subgroups.group_id, id));
    return { ...rows[0], subgroups: subs };
  }

  async createGroup(data: InsertGroup): Promise<Group> {
    const rows = await db.insert(groups).values(data).returning();
    return rows[0];
  }

  async updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const rows = await db.update(groups).set(data).where(eq(groups.id, id)).returning();
    return rows[0];
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(products).where(eq(products.group_id, id));
    await db.delete(subgroups).where(eq(subgroups.group_id, id));
    await db.delete(groups).where(eq(groups.id, id));
  }

  async getSubgroups(groupId: number): Promise<Subgroup[]> {
    return db.select().from(subgroups).where(eq(subgroups.group_id, groupId));
  }

  async createSubgroup(data: InsertSubgroup): Promise<Subgroup> {
    const rows = await db.insert(subgroups).values(data).returning();
    return rows[0];
  }

  async updateSubgroup(id: number, data: Partial<InsertSubgroup>): Promise<Subgroup | undefined> {
    const rows = await db.update(subgroups).set(data).where(eq(subgroups.id, id)).returning();
    return rows[0];
  }

  async deleteSubgroup(id: number): Promise<void> {
    await db.delete(subgroups).where(eq(subgroups.id, id));
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(asc(products.sort_order));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return rows[0];
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const rows = await db.insert(products).values(data).returning();
    return rows[0];
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const rows = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return rows[0];
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCycles(): Promise<Cycle[]> {
    return db.select().from(cycles);
  }

  async getCycle(id: number): Promise<Cycle | undefined> {
    const rows = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    return rows[0];
  }

  async createCycle(data: InsertCycle): Promise<Cycle> {
    const rows = await db.insert(cycles).values(data).returning();
    return rows[0];
  }

  async updateCycle(id: number, data: Partial<InsertCycle>): Promise<Cycle | undefined> {
    const rows = await db.update(cycles).set(data).where(eq(cycles.id, id)).returning();
    return rows[0];
  }

  async getOrders(): Promise<OrderWithItems[]> {
    const allOrders = await db.select().from(orders);
    const allItems = await db.select().from(orderItems);
    return allOrders.map(o => ({
      ...o,
      items: allItems.filter(i => i.order_id === o.id),
    }));
  }

  async getOrdersByCycle(cycleId: number): Promise<OrderWithItems[]> {
    const cycleOrders = await db.select().from(orders).where(eq(orders.cycle_id, cycleId));
    const allItems = await db.select().from(orderItems);
    return cycleOrders.map(o => ({
      ...o,
      items: allItems.filter(i => i.order_id === o.id),
    }));
  }

  async getOrdersByEmployee(employeeId: number): Promise<OrderWithItems[]> {
    const empOrders = await db.select().from(orders).where(eq(orders.employee_id, employeeId));
    const allItems = await db.select().from(orderItems);
    return empOrders.map(o => ({
      ...o,
      items: allItems.filter(i => i.order_id === o.id),
    }));
  }

  async getOrder(id: number): Promise<OrderWithItems | undefined> {
    const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!rows[0]) return undefined;
    const items = await db.select().from(orderItems).where(eq(orderItems.order_id, id));
    return { ...rows[0], items };
  }

  async createOrder(data: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithItems> {
    const orderRows = await db.insert(orders).values(data).returning();
    const order = orderRows[0];
    const insertedItems: OrderItem[] = [];
    for (const item of items) {
      const itemRows = await db.insert(orderItems).values({ ...item, order_id: order.id }).returning();
      insertedItems.push(itemRows[0]);
    }
    return { ...order, items: insertedItems };
  }

  async updateOrder(id: number, data: Partial<InsertOrder>, items?: InsertOrderItem[]): Promise<OrderWithItems | undefined> {
    const orderRows = await db.update(orders).set(data).where(eq(orders.id, id)).returning();
    if (!orderRows[0]) return undefined;
    const order = orderRows[0];
    if (items) {
      await db.delete(orderItems).where(eq(orderItems.order_id, id));
      const insertedItems: OrderItem[] = [];
      for (const item of items) {
        const itemRows = await db.insert(orderItems).values({ ...item, order_id: id }).returning();
        insertedItems.push(itemRows[0]);
      }
      return { ...order, items: insertedItems };
    }
    const existingItems = await db.select().from(orderItems).where(eq(orderItems.order_id, id));
    return { ...order, items: existingItems };
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.order_id, id));
    await db.delete(orders).where(eq(orders.id, id));
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.created_at));
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const rows = await db.insert(auditLogs).values(data).returning();
    return rows[0];
  }
}

export const storage = new DatabaseStorage();
