import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- SETTINGS ---
  app.get("/api/settings", async (_req, res) => {
    const s = await storage.getAllSettings();
    if (!s.adminPassword) {
      await storage.setSetting("adminPassword", "admin123");
      s.adminPassword = "admin123";
    }
    if (!s.recoveryEmail) {
      await storage.setSetting("recoveryEmail", "ermerson0724114@gmail.com");
      s.recoveryEmail = "ermerson0724114@gmail.com";
    }
    if (!s.companyName) {
      await storage.setSetting("companyName", "Brasfrut");
      s.companyName = "Brasfrut";
    }
    res.json(s);
  });

  app.patch("/api/settings", async (req, res) => {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await storage.setSetting(key, value);
    }
    const all = await storage.getAllSettings();
    res.json(all);
  });

  // --- AUTH ---
  app.post("/api/auth/login", async (req, res) => {
    const { type, username, password } = req.body;
    const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

    if (type === "admin") {
      const adminPassword = (await storage.getSetting("adminPassword")) || "admin123";
      if (username === "admin" && password === adminPassword) {
        await storage.createAuditLog({
          employee_id: null,
          employee_name: "Admin",
          employee_registration: "",
          action: "login_admin",
          order_id: null,
          order_total: null,
          cycle_reference: "",
          ip_address: clientIp,
          details: "Login administrativo realizado",
        });
        return res.json({ user: { id: 0, name: "Administrador", isAdmin: true }, token: "admin-token" });
      }
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    const emp = await storage.getEmployeeByRegistration(username);
    if (!emp) return res.status(401).json({ message: "Matrícula não encontrada" });
    if (emp.status === "inactive") return res.status(403).json({ message: "Funcionário desligado. Contate o administrador." });
    if (emp.is_locked) return res.status(403).json({ message: "Conta bloqueada. Contate o administrador." });
    if (!emp.password) return res.json({ needsPassword: true, employeeId: emp.id });
    if (emp.password !== password) {
      const attempts = (emp.failed_attempts || 0) + 1;
      const remaining = 5 - attempts;
      if (attempts >= 5) {
        await storage.updateEmployee(emp.id, { failed_attempts: attempts, is_locked: true });
        await storage.createAuditLog({
          employee_id: emp.id,
          employee_name: emp.name,
          employee_registration: emp.registration_number,
          action: "conta_bloqueada",
          order_id: null,
          order_total: null,
          cycle_reference: "",
          ip_address: clientIp,
          details: `Conta bloqueada após ${attempts} tentativas de login`,
        });
        return res.status(403).json({ message: "Conta bloqueada por excesso de tentativas. Contate o administrador." });
      }
      await storage.updateEmployee(emp.id, { failed_attempts: attempts });
      return res.status(401).json({ message: `Senha incorreta. ${remaining} tentativa(s) restante(s).` });
    }
    if (emp.failed_attempts > 0) {
      await storage.updateEmployee(emp.id, { failed_attempts: 0 });
    }
    await storage.createAuditLog({
      employee_id: emp.id,
      employee_name: emp.name,
      employee_registration: emp.registration_number,
      action: "login_funcionario",
      order_id: null,
      order_total: null,
      cycle_reference: "",
      ip_address: clientIp,
      details: `Login de funcionário: ${emp.name}`,
    });
    return res.json({ user: { id: emp.id, name: emp.name, isAdmin: false }, token: "emp-token" });
  });

  app.post("/api/auth/recover", async (req, res) => {
    const { email } = req.body;
    const recoveryEmail = (await storage.getSetting("recoveryEmail")) || "ermerson0724114@gmail.com";
    if (email.trim().toLowerCase() === recoveryEmail.toLowerCase()) {
      const adminPassword = (await storage.getSetting("adminPassword")) || "admin123";
      return res.json({ password: adminPassword });
    }
    return res.status(403).json({ message: "Email não autorizado para recuperação" });
  });

  app.post("/api/auth/check", async (req, res) => {
    const { username } = req.body;
    const emp = await storage.getEmployeeByRegistration(username);
    if (!emp) return res.status(404).json({ message: "Matrícula não encontrada" });
    if (emp.status === "inactive") return res.status(403).json({ message: "Funcionário desligado. Contate o administrador." });
    if (emp.is_locked) return res.status(403).json({ message: "Conta bloqueada. Contate o administrador." });
    return res.json({ needsPassword: !emp.password, employeeId: emp.id, name: emp.name });
  });

  app.post("/api/auth/create-password", async (req, res) => {
    const { employeeId, password } = req.body;
    const emp = await storage.updateEmployee(employeeId, { password });
    if (!emp) return res.status(404).json({ message: "Funcionário não encontrado" });
    return res.json({ user: { id: emp.id, name: emp.name, isAdmin: false }, token: "emp-token" });
  });

  // --- EMPLOYEES ---
  app.get("/api/employees", async (_req, res) => {
    const emps = await storage.getEmployees();
    res.json(emps);
  });

  app.post("/api/employees", async (req, res) => {
    const emp = await storage.createEmployee(req.body);
    res.json(emp);
  });

  app.patch("/api/employees/:id", async (req, res) => {
    const emp = await storage.updateEmployee(parseInt(req.params.id), req.body);
    if (!emp) return res.status(404).json({ message: "Não encontrado" });
    res.json(emp);
  });

  app.delete("/api/employees/:id", async (req, res) => {
    await storage.deleteEmployee(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/employees/bulk", async (req, res) => {
    const list = req.body as any[];
    const created = [];
    for (const item of list) {
      const emp = await storage.createEmployee(item);
      created.push(emp);
    }
    res.json(created);
  });

  app.post("/api/employees/sync", async (req, res) => {
    const list = req.body as any[];
    const fileRegistrations = new Set(list.map((e: any) => e.registration_number?.trim()).filter(Boolean));
    const allEmployees = await storage.getEmployees();
    let added = 0, reactivated = 0, deactivated = 0;
    for (const item of list) {
      const reg = item.registration_number?.trim();
      if (!reg) continue;
      const existing = allEmployees.find(e => e.registration_number === reg);
      if (existing) {
        const updates: any = {};
        if (item.name && item.name !== existing.name) updates.name = item.name;
        if (item.funcao && item.funcao !== existing.funcao) updates.funcao = item.funcao;
        if (item.setor && item.setor !== existing.setor) updates.setor = item.setor;
        if (item.distribuicao && item.distribuicao !== existing.distribuicao) updates.distribuicao = item.distribuicao;
        if (item.email && item.email !== existing.email) updates.email = item.email;
        if (item.whatsapp && item.whatsapp !== existing.whatsapp) updates.whatsapp = item.whatsapp;
        if (existing.status === "inactive") {
          updates.status = "active";
          reactivated++;
        }
        if (Object.keys(updates).length > 0) {
          await storage.updateEmployee(existing.id, updates);
        }
      } else {
        await storage.createEmployee({ ...item, status: "active", password: "", is_locked: false });
        added++;
      }
    }
    for (const emp of allEmployees) {
      if (emp.status === "active" && !fileRegistrations.has(emp.registration_number)) {
        await storage.updateEmployee(emp.id, { status: "inactive" });
        deactivated++;
      }
    }
    res.json({ added, reactivated, deactivated, total: fileRegistrations.size });
  });

  // --- GROUPS ---
  app.get("/api/groups", async (_req, res) => {
    const gs = await storage.getGroups();
    res.json(gs);
  });

  app.post("/api/groups", async (req, res) => {
    const g = await storage.createGroup(req.body);
    res.json(g);
  });

  app.patch("/api/groups/reorder", async (req, res) => {
    const items = req.body as { id: number; sort_order: number }[];
    for (const item of items) {
      await storage.updateGroup(item.id, { sort_order: item.sort_order });
    }
    const gs = await storage.getGroups();
    res.json(gs);
  });

  app.patch("/api/groups/:id", async (req, res) => {
    const g = await storage.updateGroup(parseInt(req.params.id), req.body);
    if (!g) return res.status(404).json({ message: "Não encontrado" });
    res.json(g);
  });

  app.delete("/api/groups/:id", async (req, res) => {
    await storage.deleteGroup(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // --- SUBGROUPS ---
  app.post("/api/subgroups", async (req, res) => {
    const s = await storage.createSubgroup(req.body);
    res.json(s);
  });

  app.patch("/api/subgroups/reorder", async (req, res) => {
    const items = req.body as { id: number; sort_order: number }[];
    for (const item of items) {
      await storage.updateSubgroup(item.id, { sort_order: item.sort_order });
    }
    res.json({ ok: true });
  });

  app.patch("/api/subgroups/:id", async (req, res) => {
    const s = await storage.updateSubgroup(parseInt(req.params.id), req.body);
    if (!s) return res.status(404).json({ message: "Não encontrado" });
    res.json(s);
  });

  app.delete("/api/subgroups/:id", async (req, res) => {
    await storage.deleteSubgroup(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // --- PRODUCTS ---
  app.get("/api/products", async (_req, res) => {
    const ps = await storage.getProducts();
    res.json(ps);
  });

  app.post("/api/products", async (req, res) => {
    const p = await storage.createProduct(req.body);
    res.json(p);
  });

  app.patch("/api/products/reorder", async (req, res) => {
    const items = req.body as { id: number; sort_order: number }[];
    for (const item of items) {
      await storage.updateProduct(item.id, { sort_order: item.sort_order });
    }
    res.json({ ok: true });
  });

  app.patch("/api/products/:id", async (req, res) => {
    const p = await storage.updateProduct(parseInt(req.params.id), req.body);
    if (!p) return res.status(404).json({ message: "Não encontrado" });
    res.json(p);
  });

  app.delete("/api/products/:id", async (req, res) => {
    await storage.deleteProduct(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // --- CYCLES ---
  function getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  app.get("/api/cycle/current", async (_req, res) => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const lastDay = getLastDayOfMonth(year, month);

    const naturallyOpen = day >= 15;

    const cycleOverride = await storage.getSetting("cycleOverride");
    let isOpen = naturallyOpen;
    let overrideActive = false;
    if (cycleOverride === "force_open" && !naturallyOpen) {
      isOpen = true;
      overrideActive = true;
    } else if (cycleOverride === "force_closed" && naturallyOpen) {
      isOpen = false;
      overrideActive = true;
    }

    const cycleMonth = month;
    const cycleYear = year;

    const allCycles = await storage.getCycles();
    let cycle = allCycles.find(c => c.month === cycleMonth && c.year === cycleYear);

    if (!cycle) {
      cycle = await storage.createCycle({
        month: cycleMonth,
        year: cycleYear,
        start_date: `${cycleYear}-${String(cycleMonth).padStart(2, "0")}-15T00:00:00`,
        end_date: `${cycleYear}-${String(cycleMonth).padStart(2, "0")}-${lastDay}T23:59:59`,
        status: isOpen ? "open" : "closed",
      });
    } else {
      const newStatus = isOpen ? "open" : "closed";
      if (cycle.status !== newStatus) {
        cycle = (await storage.updateCycle(cycle.id, { status: newStatus }))!;
      }
    }

    let daysRemaining = 0;
    let daysUntilOpen = 0;

    if (naturallyOpen) {
      daysRemaining = lastDay - day;
    } else {
      daysUntilOpen = 15 - day;
    }

    res.json({ cycle, isOpen, naturallyOpen, overrideActive, daysRemaining, daysUntilOpen });
  });

  app.get("/api/cycles", async (_req, res) => {
    const cs = await storage.getCycles();
    res.json(cs);
  });

  app.post("/api/cycles", async (req, res) => {
    const c = await storage.createCycle(req.body);
    res.json(c);
  });

  app.patch("/api/cycles/:id", async (req, res) => {
    const c = await storage.updateCycle(parseInt(req.params.id), req.body);
    if (!c) return res.status(404).json({ message: "Não encontrado" });
    res.json(c);
  });

  // --- ORDERS ---
  app.get("/api/orders", async (_req, res) => {
    const os = await storage.getOrders();
    res.json(os);
  });

  app.get("/api/orders/cycle/:cycleId", async (req, res) => {
    const os = await storage.getOrdersByCycle(parseInt(req.params.cycleId));
    res.json(os);
  });

  app.get("/api/orders/employee/:employeeId", async (req, res) => {
    const os = await storage.getOrdersByEmployee(parseInt(req.params.employeeId));
    res.json(os);
  });

  function getClientIp(req: any): string {
    return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  }

  async function getCycleReference(cycleId: number): Promise<string> {
    const cycle = await storage.getCycle(cycleId);
    if (!cycle) return "";
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${monthNames[cycle.month - 1]}/${cycle.year}`;
  }

  app.post("/api/orders", async (req, res) => {
    const { items, ...orderData } = req.body;
    if (orderData.employee_id && (!orderData.employee_registration || orderData.employee_registration === "")) {
      const emp = await storage.getEmployee(orderData.employee_id);
      if (emp) {
        orderData.employee_registration = emp.registration_number;
        if (!orderData.employee_name) orderData.employee_name = emp.name;
      }
    }
    const order = await storage.createOrder(orderData, items || []);

    const cycleRef = await getCycleReference(order.cycle_id);
    await storage.createAuditLog({
      employee_id: order.employee_id,
      employee_name: order.employee_name,
      employee_registration: order.employee_registration || "",
      action: "pedido_criado",
      order_id: order.id,
      order_total: order.total,
      cycle_reference: cycleRef,
      ip_address: getClientIp(req),
      details: `Pedido #${order.id} criado com ${order.items.length} item(ns), total R$ ${parseFloat(order.total).toFixed(2)}`,
    });

    res.json(order);
  });

  app.patch("/api/orders/:id", async (req, res) => {
    const { items, ...orderData } = req.body;
    const oldOrder = await storage.getOrder(parseInt(req.params.id));
    const order = await storage.updateOrder(parseInt(req.params.id), orderData, items);
    if (!order) return res.status(404).json({ message: "Não encontrado" });

    const cycleRef = await getCycleReference(order.cycle_id);
    const isAdminEdit = req.body._adminEdit;
    const actionUser = isAdminEdit ? "Admin" : order.employee_name;
    const oldTotal = oldOrder ? parseFloat(oldOrder.total).toFixed(2) : "0.00";
    const newTotal = parseFloat(order.total).toFixed(2);
    await storage.createAuditLog({
      employee_id: order.employee_id,
      employee_name: actionUser,
      employee_registration: order.employee_registration || "",
      action: "pedido_editado",
      order_id: order.id,
      order_total: order.total,
      cycle_reference: cycleRef,
      ip_address: getClientIp(req),
      details: `Pedido #${order.id} editado por ${actionUser}. Total: R$ ${oldTotal} → R$ ${newTotal}`,
    });

    res.json(order);
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(parseInt(req.params.id));
    if (order) {
      const cycleRef = await getCycleReference(order.cycle_id);
      await storage.createAuditLog({
        employee_id: order.employee_id,
        employee_name: order.employee_name,
        employee_registration: order.employee_registration || "",
        action: "pedido_excluido",
        order_id: order.id,
        order_total: order.total,
        cycle_reference: cycleRef,
        ip_address: getClientIp(req),
        details: `Pedido #${order.id} excluído. Total era R$ ${parseFloat(order.total).toFixed(2)}`,
      });
    }
    await storage.deleteOrder(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // --- AUDIT LOGS ---
  app.get("/api/audit-logs", async (_req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });

  // --- BULK MIGRATE (from localStorage) ---
  app.post("/api/migrate", async (req, res) => {
    const { employees: emps, groups: grps, products: prods, cycles: cycs, orders: ords, settings: sets } = req.body;
    const idMap: Record<string, Record<number, number>> = { groups: {}, subgroups: {}, employees: {}, cycles: {}, products: {} };

    if (sets) {
      for (const [key, value] of Object.entries(sets)) {
        await storage.setSetting(key, String(value));
      }
    }

    if (emps) {
      for (const emp of emps) {
        const { id, ...data } = emp;
        const created = await storage.createEmployee(data);
        idMap.employees[id] = created.id;
      }
    }

    if (grps) {
      for (const grp of grps) {
        const { id, subgroups: subs, ...data } = grp;
        const created = await storage.createGroup(data);
        idMap.groups[id] = created.id;
        if (subs) {
          for (const sub of subs) {
            const { id: subId, ...subData } = sub;
            const createdSub = await storage.createSubgroup({ ...subData, group_id: created.id });
            idMap.subgroups[subId] = createdSub.id;
          }
        }
      }
    }

    if (prods) {
      for (const prod of prods) {
        const { id, ...data } = prod;
        const newGroupId = idMap.groups[data.group_id] || data.group_id;
        const newSubgroupId = data.subgroup_id ? (idMap.subgroups[data.subgroup_id] || data.subgroup_id) : null;
        const created = await storage.createProduct({ ...data, group_id: newGroupId, subgroup_id: newSubgroupId });
        idMap.products[id] = created.id;
      }
    }

    if (cycs) {
      for (const cyc of cycs) {
        const { id, ...data } = cyc;
        const created = await storage.createCycle(data);
        idMap.cycles[id] = created.id;
      }
    }

    if (ords) {
      for (const ord of ords) {
        const { id, items, ...data } = ord;
        const newEmpId = idMap.employees[data.employee_id] || data.employee_id;
        const newCycleId = idMap.cycles[data.cycle_id] || data.cycle_id;
        const mappedItems = (items || []).map((item: any) => {
          const { id: itemId, ...itemData } = item;
          const newProductId = idMap.products[itemData.product_id] || itemData.product_id;
          return { ...itemData, product_id: newProductId, order_id: 0 };
        });
        await storage.createOrder({ ...data, employee_id: newEmpId, cycle_id: newCycleId }, mappedItems);
      }
    }

    res.json({ ok: true, message: "Dados migrados com sucesso!" });
  });

  return httpServer;
}
