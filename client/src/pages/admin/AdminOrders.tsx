import { useState } from "react";
import { Search, ChevronLeft, ChevronRight, ShoppingBag, Plus, Minus, Download, Trash2, Eye, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MONTHS_FULL } from "@/lib/mockData";
import type { Product, Cycle, Employee } from "@shared/schema";
import * as XLSX from "xlsx";

interface OrderItem { id: number; product_id: number; quantity: number; product_name_snapshot: string; group_name_snapshot: string; subgroup_name_snapshot: string | null; unit_price: string; }
interface OrderData { id: number; employee_id: number; employee_name: string; employee_registration: string | null; status: string; total: string; cycle_id: number; items: OrderItem[]; }
interface GroupData { id: number; name: string; subgroups: { id: number; name: string; item_limit: number | null }[]; }

const STATUS_LABELS: Record<string, string> = { draft: "Em edição", confirmed: "Confirmado", closed: "Fechado" };

export default function AdminOrders() {
  const { toast } = useToast();
  const { data: orders = [] } = useQuery<OrderData[]>({ queryKey: ["/api/orders"] });
  const { data: cycles = [] } = useQuery<Cycle[]>({ queryKey: ["/api/cycles"] });
  const { data: groups = [] } = useQuery<GroupData[]>({ queryKey: ["/api/groups"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const [cycleIndex, setCycleIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState<OrderData | null>(null);
  const [viewModal, setViewModal] = useState<OrderData | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [selectedGroup, setSelectedGroup] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);

  const sortedCycles = [...cycles].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
  const activeCycleId = sortedCycles[cycleIndex]?.id ?? null;
  const selectedCycle = sortedCycles[cycleIndex];
  const isClosed = selectedCycle?.status === "closed";
  const cycleOrders = orders.filter(o => o.cycle_id === activeCycleId);

  const updateOrder = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/orders/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });

  const deleteOrderMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });

  const handleDeleteOrder = () => {
    if (deleteOrderId !== null) {
      deleteOrderMut.mutate(deleteOrderId);
      toast({ title: "Pedido excluído" });
      setDeleteOrderId(null);
    }
  };

  const openEdit = (order: OrderData) => {
    const cartObj: Record<number, number> = {};
    order.items?.forEach(i => { cartObj[i.product_id] = i.quantity; });
    setCart(cartObj);
    setEditModal(order);
    if (groups.length > 0) setSelectedGroup(groups[0].id);
  };

  const setQty = (productId: number, delta: number) => {
    setCart(prev => {
      const next = Math.max(0, (prev[productId] || 0) + delta);
      if (next === 0) { const n = { ...prev }; delete n[productId]; return n; }
      return { ...prev, [productId]: next };
    });
  };

  const handleSaveEdit = () => {
    if (!editModal) return;
    setSaving(true);
    const items = Object.entries(cart).map(([pid, qty]) => {
      const p = products.find(pr => pr.id === parseInt(pid));
      const g = groups.find(gr => gr.id === p?.group_id);
      const sub = g?.subgroups.find(s => s.id === p?.subgroup_id);
      return { product_id: parseInt(pid), quantity: qty, product_name_snapshot: p?.name || "", group_name_snapshot: g?.name || "", subgroup_name_snapshot: sub?.name || null, unit_price: p?.price || "0", order_id: editModal.id };
    });
    const total = items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
    updateOrder.mutate({ id: editModal.id, data: { total: total.toFixed(2), items } });
    setTimeout(() => { setSaving(false); setEditModal(null); toast({ title: "Pedido atualizado!" }); }, 400);
  };

  const handleExportExcel = () => {
    if (cycleOrders.length === 0) {
      toast({ title: "Nenhum pedido para exportar", variant: "destructive" });
      return;
    }

    const allGroupNames = new Set<string>();
    cycleOrders.forEach(o => o.items?.forEach(i => { if (i.group_name_snapshot) allGroupNames.add(i.group_name_snapshot); }));
    const groupNamesList = Array.from(allGroupNames);

    if (groupNamesList.length === 0) {
      toast({ title: "Nenhum item nos pedidos", variant: "destructive" });
      return;
    }

    const wb = XLSX.utils.book_new();

    for (const groupName of groupNamesList) {
      const productNames = new Set<string>();
      cycleOrders.forEach(o => {
        o.items?.filter(i => i.group_name_snapshot === groupName).forEach(i => productNames.add(i.product_name_snapshot));
      });
      const productList = Array.from(productNames).sort();

      const headers = ["Matrícula", "Nome", "Setor", ...productList, `Total ${groupName}`];
      const rows: any[][] = [];

      for (const order of cycleOrders) {
        const emp = employees.find(e => e.id === order.employee_id);
        const groupItems = order.items?.filter(i => i.group_name_snapshot === groupName) || [];
        if (groupItems.length === 0) continue;

        const row: any[] = [
          order.employee_registration || emp?.registration_number || "",
          order.employee_name || emp?.name || "",
          emp?.setor || "",
        ];

        let groupTotal = 0;
        for (const pName of productList) {
          const item = groupItems.find(i => i.product_name_snapshot === pName);
          const qty = item ? item.quantity : 0;
          row.push(qty > 0 ? qty : "");
          if (item) groupTotal += parseFloat(item.unit_price) * item.quantity;
        }
        row.push(groupTotal);
        rows.push(row);
      }

      rows.sort((a, b) => (a[1] as string).localeCompare(b[1] as string));

      const sheetData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      const totalColIdx = headers.length - 1;
      for (let r = 1; r < sheetData.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: totalColIdx })];
        if (cell) cell.z = '#,##0.00';
      }

      const colWidths = headers.map((h, i) => {
        if (i === 0) return { wch: 12 };
        if (i === 1) return { wch: 30 };
        if (i === 2) return { wch: 18 };
        if (i === totalColIdx) return { wch: 14 };
        return { wch: Math.max(h.length + 2, 8) };
      });
      ws['!cols'] = colWidths;

      const safeSheetName = groupName.substring(0, 31).replace(/[\\/*?\[\]:]/g, "");
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    }

    const cycleName = selectedCycle ? `${MONTHS_FULL[selectedCycle.month - 1]}_${selectedCycle.year}` : "pedidos";
    XLSX.writeFile(wb, `Pedidos_${cycleName}.xlsx`);
    toast({ title: "Planilha exportada com sucesso!", variant: "success" });
  };

  const filtered = cycleOrders.filter(o =>
    o.employee_name?.toLowerCase().includes(search.toLowerCase()) || o.employee_registration?.includes(search)
  );

  const groupProducts = products.filter(p => p.group_id === selectedGroup && p.available);
  const totalValue = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = products.find(p => p.id === parseInt(id));
    return s + (p ? parseFloat(p.price) * qty : 0);
  }, 0);

  return (
    <div className="bg-gray-50">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center"><ShoppingBag size={20} className="text-green-800" /></div>
            <div><h2 className="text-lg font-extrabold text-gray-800">Pedidos</h2><p className="text-gray-500 text-xs">{cycleOrders.length} pedido(s)</p></div>
          </div>
          <button onClick={handleExportExcel}
            className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600"
            title="Exportar Excel"
            data-testid="button-export-excel">
            <Download size={16} />
          </button>
        </div>
        {sortedCycles.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-2 py-1.5 mb-3">
            <button
              onClick={() => setCycleIndex(i => Math.min(i + 1, sortedCycles.length - 1))}
              disabled={cycleIndex >= sortedCycles.length - 1}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 disabled:opacity-30"
              data-testid="button-cycle-prev"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="font-bold text-gray-800 text-sm" data-testid="text-cycle-period">
              {selectedCycle ? `${MONTHS_FULL[selectedCycle.month - 1]} / ${selectedCycle.year}` : "—"}
            </p>
            <button
              onClick={() => setCycleIndex(i => Math.max(i - 1, 0))}
              disabled={cycleIndex <= 0}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 disabled:opacity-30"
              data-testid="button-cycle-next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar funcionário..."
            className="w-full bg-gray-100 text-gray-800 placeholder-gray-400 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid="input-search-orders" />
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><ShoppingBag size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum pedido encontrado</p></div>
        ) : filtered.map(order => (
          <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm" data-testid={`card-admin-order-${order.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-800 text-sm">{order.employee_name}</p>
                <p className="text-xs text-gray-500">{order.employee_registration} · {order.items?.length} item(s)</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (order.status === "confirmed" ? "bg-green-100 text-green-700" : order.status === "closed" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700")}>
                  {STATUS_LABELS[order.status] || order.status}</span>
                <button onClick={() => setDeleteOrderId(order.id)} className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500" data-testid={`button-delete-order-${order.id}`}><Trash2 size={14} /></button>
                <button onClick={() => setViewModal(order)} className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600" title="Ver" data-testid={`button-view-order-${order.id}`}><Eye size={14} /></button>
                <button onClick={() => openEdit(order)} className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-green-700" title="Editar" data-testid={`button-edit-order-${order.id}`}><Edit2 size={14} /></button>
              </div>
            </div>
            <p className="text-sm font-extrabold text-green-900">R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}</p>
          </div>
        ))}
      </div>

      {deleteOrderId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-extrabold text-lg mb-2">Excluir pedido</h3>
            <p className="text-gray-500 text-sm mb-5">Tem certeza que deseja excluir este pedido? Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteOrderId(null)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600">Cancelar</button>
              <button onClick={handleDeleteOrder} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold" data-testid="button-confirm-delete-order">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {viewModal && (() => {
        const groupedItems = new Map<string, OrderItem[]>();
        viewModal.items?.forEach(item => {
          const key = item.group_name_snapshot || "Outros";
          if (!groupedItems.has(key)) groupedItems.set(key, []);
          groupedItems.get(key)!.push(item);
        });
        const groupEntries = Array.from(groupedItems.entries());
        const emp = employees.find(e => e.id === viewModal.employee_id);
        const grandTotal = parseFloat(viewModal.total || "0");

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
            <div className="w-full max-w-2xl bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "92vh" }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-100">
                <div>
                  <h2 className="font-extrabold text-lg" data-testid="text-view-order-name">{viewModal.employee_name}</h2>
                  <p className="text-xs text-gray-500">{viewModal.employee_registration || emp?.registration_number} · {emp?.setor || ""}</p>
                </div>
                <button onClick={() => setViewModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><span className="text-gray-600 text-lg leading-none">✕</span></button>
              </div>
              <div className="overflow-y-auto flex-1">
                {groupEntries.length === 0 ? (
                  <div className="text-center py-10 text-gray-400"><p className="text-sm">Nenhum item no pedido</p></div>
                ) : groupEntries.map(([groupName, items], gi) => {
                  const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
                  return (
                    <div key={groupName}>
                      <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{groupName}</p>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {items.map(item => (
                          <div key={item.id} className="px-5 py-3 flex items-center justify-between" data-testid={`view-item-${item.id}`}>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{item.product_name_snapshot}</p>
                              {item.subgroup_name_snapshot && <p className="text-xs text-gray-400">{item.subgroup_name_snapshot}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-800">{item.quantity}x</p>
                              <p className="text-xs text-gray-500">R$ {(parseFloat(item.unit_price) * item.quantity).toFixed(2).replace(".", ",")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 py-2 bg-gray-50/60 flex justify-between border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500">Subtotal {groupName}</p>
                        <p className="text-xs font-bold text-gray-700">R$ {subtotal.toFixed(2).replace(".", ",")}</p>
                      </div>
                      {gi < groupEntries.length - 1 && <div className="border-b border-gray-100" />}
                    </div>
                  );
                })}
                <div className="px-5 py-4 border-t border-gray-200 flex justify-between bg-green-50/50">
                  <p className="font-bold text-gray-700">Total Geral</p>
                  <p className="font-extrabold text-green-900 text-lg" data-testid="text-view-order-total">R$ {grandTotal.toFixed(2).replace(".", ",")}</p>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
                <button onClick={() => setViewModal(null)} className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold" data-testid="button-close-view-order">Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "92vh" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <div><h2 className="font-extrabold text-lg">{editModal.employee_name}</h2><p className="text-xs text-gray-500">Editar pedido</p></div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><span className="text-gray-600 text-lg leading-none">✕</span></button>
            </div>
            {groups.length > 0 && (
              <div className="px-4 flex gap-2 overflow-x-auto pb-2 flex-shrink-0">
                {groups.map(g => (
                  <button key={g.id} onClick={() => setSelectedGroup(g.id)}
                    className={"flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold " + (selectedGroup === g.id ? "bg-green-900 text-white" : "bg-gray-100 text-gray-600")}
                    data-testid={`tab-order-group-${g.id}`}>{g.name}</button>
                ))}
              </div>
            )}
            <div className="overflow-y-auto flex-1 px-4 space-y-1 pb-2">
              {groupProducts.map(product => {
                const qty = cart[product.id] || 0;
                return (
                  <div key={product.id} className="flex items-center py-2.5 gap-3 border-b border-gray-50">
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800">{product.name}</p><p className="text-xs text-gray-500">R$ {parseFloat(product.price).toFixed(2).replace(".", ",")} / {product.unit}</p></div>
                    <div className="flex items-center gap-2">
                      {qty > 0 && <button onClick={() => setQty(product.id, -1)} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center"><Minus size={12} /></button>}
                      {qty > 0 && <span className="font-bold text-gray-800 w-4 text-center text-sm">{qty}</span>}
                      <button onClick={() => setQty(product.id, 1)} className={"w-7 h-7 rounded-full flex items-center justify-center " + (qty > 0 ? "bg-green-900 text-white" : "bg-green-100 text-green-800")}><Plus size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
              <div className="flex justify-between mb-3"><span className="font-bold text-gray-700">Total</span><span className="font-extrabold text-green-900">R$ {totalValue.toFixed(2).replace(".", ",")}</span></div>
              <button onClick={handleSaveEdit} disabled={saving} className="w-full py-3.5 bg-green-900 text-white rounded-2xl font-bold disabled:opacity-60" data-testid="button-save-admin-order">{saving ? "Salvando..." : "Salvar Pedido"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
