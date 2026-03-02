import { useState, useEffect } from "react";
import { Plus, Minus, ShoppingCart, CheckCircle, Leaf, Edit2, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { Product, Cycle } from "@shared/schema";
import { MONTHS_FULL } from "@/lib/mockData";

interface OrderItem { id: number; product_id: number; quantity: number; product_name_snapshot: string; group_name_snapshot: string; subgroup_name_snapshot: string | null; unit_price: string; order_id: number; }
interface OrderData { id: number; employee_id: number; employee_name: string; employee_registration: string | null; status: string; total: string; cycle_id: number; items: OrderItem[]; }
interface GroupData { id: number; name: string; item_limit: number | null; subgroups: { id: number; name: string; item_limit: number | null }[]; }
interface CurrentCycleData { cycle: Cycle; isOpen: boolean; naturallyOpen: boolean; overrideActive: boolean; daysRemaining: number; daysUntilOpen: number; }

export default function OrderPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: groups = [] } = useQuery<GroupData[]>({ queryKey: ["/api/groups"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: orders = [] } = useQuery<OrderData[]>({ queryKey: ["/api/orders"] });
  const { data: currentCycleData, isLoading: cycleLoading } = useQuery<CurrentCycleData>({ queryKey: ["/api/cycle/current"], staleTime: 0 });
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });

  const budget = settings?.orderBudget ? parseFloat(settings.orderBudget) : null;

  const cartKey = `brasfrut_cart_${user?.id || 0}`;
  const [cart, setCartState] = useState<Record<number, number>>(() => {
    try { const saved = sessionStorage.getItem(cartKey); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const setCart = (updater: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => {
    setCartState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      sessionStorage.setItem(cartKey, JSON.stringify(next));
      return next;
    });
  };
  const [selectedGroup, setSelectedGroup] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showTerm, setShowTerm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);

  const activeCycle = currentCycleData?.cycle;
  const isOpen = currentCycleData?.isOpen ?? false;
  const isClosed = !isOpen;
  const existingOrder = activeCycle ? orders.find(o => o.employee_id === user?.id && o.cycle_id === activeCycle.id) : undefined;
  const hasConfirmedOrder = existingOrder?.status === "confirmed";

  const createOrder = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/orders", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });
  const updateOrder = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/orders/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });
  const deleteOrderMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });

  useEffect(() => {
    if (groups.length > 0 && selectedGroup === 0) setSelectedGroup(groups[0].id);
  }, [groups, selectedGroup]);

  useEffect(() => {
    if (existingOrder && !editing) {
      const cartObj: Record<number, number> = {};
      existingOrder.items?.forEach(i => { cartObj[i.product_id] = i.quantity; });
      setCart(cartObj);
      setSubmitted(existingOrder.status === "confirmed");
    }
  }, [existingOrder?.id]);

  const availableProducts = products.filter(p => p.available);

  const getGroupTotal = (groupId: number) =>
    availableProducts.filter(p => p.group_id === groupId).reduce((s, p) => s + (cart[p.id] || 0), 0);

  const getSubgroupTotal = (subgroupId: number) =>
    availableProducts.filter(p => p.subgroup_id === subgroupId).reduce((s, p) => s + (cart[p.id] || 0), 0);

  const totalItems = Object.values(cart).reduce((s, q) => s + q, 0);
  const totalValue = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = availableProducts.find(p => p.id === parseInt(id));
    return s + (p ? parseFloat(p.price) * qty : 0);
  }, 0);
  const remainingBudget = budget !== null ? budget - totalValue : null;

  const canAdd = (product: any) => {
    if (budget !== null) {
      const productPrice = parseFloat(product.price);
      if (productPrice > (remainingBudget ?? 0)) return false;
    }
    const group = groups.find(g => g.id === product.group_id);
    if (!group) return false;
    if (group.subgroups.length > 0 && product.subgroup_id) {
      const sub = group.subgroups.find(s => s.id === product.subgroup_id);
      if (!sub || !sub.item_limit) return true;
      return getSubgroupTotal(product.subgroup_id) < sub.item_limit;
    }
    if (group.item_limit !== null) {
      return getGroupTotal(product.group_id) < group.item_limit;
    }
    return true;
  };

  const setQty = (productId: number, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) { const n = { ...prev }; delete n[productId]; return n; }
      return { ...prev, [productId]: next };
    });
  };

  const buildOrderItems = () => {
    return Object.entries(cart).map(([pid, qty]) => {
      const p = products.find(pr => pr.id === parseInt(pid));
      const g = groups.find(gr => gr.id === p?.group_id);
      const sub = g?.subgroups.find(s => s.id === p?.subgroup_id);
      return {
        product_id: parseInt(pid),
        quantity: qty,
        product_name_snapshot: p?.name || "",
        group_name_snapshot: g?.name || "",
        subgroup_name_snapshot: sub?.name || null,
        unit_price: p?.price || "0",
      };
    });
  };

  const handleSubmit = async () => {
    if (!agreed) return toast({ title: "Aceite o termo para confirmar", variant: "destructive" });
    if (totalItems === 0) return toast({ title: "Adicione pelo menos um produto", variant: "destructive" });
    if (!activeCycle || !user) return;
    setSubmitting(true);
    const items = buildOrderItems();
    try {
      if (existingOrder) {
        await updateOrder.mutateAsync({ id: existingOrder.id, data: { items, total: totalValue.toFixed(2), status: "confirmed" } });
      } else {
        await createOrder.mutateAsync({
          employee_id: user.id,
          employee_name: user.name,
          employee_registration: "",
          status: "confirmed",
          total: totalValue.toFixed(2),
          cycle_id: activeCycle.id,
          items,
        });
      }
      setSubmitted(true);
      setEditing(false);
      setShowTerm(false);
      sessionStorage.removeItem(cartKey);
      toast({ title: "Pedido confirmado com sucesso!", variant: "success" });
      navigate("/dashboard");
    } catch {
      toast({ title: "Erro ao salvar pedido", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    if (existingOrder) {
      await deleteOrderMut.mutateAsync(existingOrder.id);
    }
    setCartState({});
    sessionStorage.removeItem(cartKey);
    setSubmitted(false);
    setEditing(false);
    setAgreed(false);
    toast({ title: "Pedido excluído" });
  };

  const handleStartEdit = () => {
    if (existingOrder) {
      const cartObj: Record<number, number> = {};
      existingOrder.items?.forEach(i => { cartObj[i.product_id] = i.quantity; });
      setCart(cartObj);
    }
    setEditing(true);
    setSubmitted(false);
    setAgreed(false);
  };

  const selectedGroupData = groups.find(g => g.id === selectedGroup);
  const groupProducts = availableProducts.filter(p => p.group_id === selectedGroup);
  const groupLimit = selectedGroupData?.item_limit;
  const groupTotal = getGroupTotal(selectedGroup);

  if (cycleLoading || groups.length === 0) {
    if (cycleLoading) {
      return (
        <div className="text-center py-20 px-4">
          <div className="animate-spin w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Carregando...</p>
        </div>
      );
    }
    return (
      <div className="text-center py-20 px-4">
        <Leaf size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-400 font-medium">Nenhum grupo/produto cadastrado ainda.</p>
        <p className="text-gray-400 text-sm mt-1">Aguarde o administrador configurar os produtos.</p>
      </div>
    );
  }

  if (hasConfirmedOrder && !editing) {
    return (
      <div className="px-4 py-8 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <CheckCircle size={40} className="mx-auto text-green-600 mb-3" />
          <h3 className="font-extrabold text-lg text-green-900 mb-1">Pedido Confirmado</h3>
          <p className="text-sm text-green-700 mb-1">
            {activeCycle ? `${MONTHS_FULL[activeCycle.month - 1]} / ${activeCycle.year}` : ""}
          </p>
          <p className="text-2xl font-extrabold text-green-900 mt-2" data-testid="text-confirmed-total">
            R$ {parseFloat(existingOrder!.total).toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-green-600 mt-1">{existingOrder!.items?.length} item(ns)</p>
        </div>

        {isOpen && (
          <div className="flex gap-3">
            <button
              onClick={handleStartEdit}
              className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
              data-testid="button-edit-existing-order"
            >
              <Edit2 size={16} />
              Editar Pedido
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="py-3.5 px-5 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-200"
              data-testid="button-delete-existing-order"
            >
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-gray-800 text-sm">Itens do Pedido</p>
          </div>
          {(() => {
            const grouped = new Map<string, typeof existingOrder.items>();
            existingOrder!.items?.forEach(item => {
              const key = item.group_name_snapshot || "Outros";
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key)!.push(item);
            });
            return Array.from(grouped.entries()).map(([groupName, items]) => {
              const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
              return (
                <div key={groupName}>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{groupName}</p>
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between border-b border-gray-50">
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
                  <div className="px-4 py-2 bg-gray-50/60 flex justify-between border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500">Subtotal {groupName}</p>
                    <p className="text-xs font-bold text-gray-700">R$ {subtotal.toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <h3 className="font-extrabold text-lg mb-2">Excluir pedido?</h3>
              <p className="text-gray-500 text-sm mb-5">Todos os itens do pedido serão removidos. Deseja continuar?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600" data-testid="button-cancel-delete">Cancelar</button>
                <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold" data-testid="button-confirm-delete">Excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-36">
      <div className="px-4 pt-4 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className={"flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold transition-all " +
              (selectedGroup === g.id ? "bg-green-900 text-white" : "bg-white text-gray-600 border border-gray-200")}
            data-testid={`tab-group-${g.id}`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {budget !== null && (
        <div className="mx-4 mt-2" data-testid="budget-bar">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Orçamento</span>
            <span className={remainingBudget !== null && remainingBudget <= 0 ? "text-red-500 font-bold" : "font-semibold"}>
              R$ {totalValue.toFixed(2).replace(".", ",")} / R$ {budget.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={"h-2.5 rounded-full transition-all " + (remainingBudget !== null && remainingBudget <= 0 ? "bg-red-500" : totalValue / budget > 0.8 ? "bg-amber-500" : "bg-green-600")}
              style={{ width: `${Math.min(100, (totalValue / budget) * 100)}%` }}
            />
          </div>
          {remainingBudget !== null && remainingBudget > 0 && (
            <p className="text-xs text-gray-400 mt-1">Saldo restante: <span className="font-semibold text-gray-600">R$ {remainingBudget.toFixed(2).replace(".", ",")}</span></p>
          )}
          {remainingBudget !== null && remainingBudget <= 0 && (
            <p className="text-xs text-red-500 font-semibold mt-1">Orçamento atingido</p>
          )}
        </div>
      )}

      {groupLimit !== null && groupLimit !== undefined && (
        <div className="mx-4 mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Limite do grupo</span>
            <span className={groupTotal >= groupLimit ? "text-red-500 font-bold" : "font-semibold"}>
              {groupTotal}/{groupLimit}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={"h-2 rounded-full transition-all " + (groupTotal >= groupLimit ? "bg-red-500" : "bg-green-600")}
              style={{ width: `${Math.min(100, (groupTotal / (groupLimit || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="px-4 pt-3 space-y-2" style={{ paddingBottom: totalItems > 0 ? "14rem" : "6rem" }}>
        {selectedGroupData && selectedGroupData.subgroups.length > 0 ? (
          selectedGroupData.subgroups.map((sub) => {
            const subProducts = groupProducts.filter(p => p.subgroup_id === sub.id);
            const subTotal = getSubgroupTotal(sub.id);
            return (
              <div key={sub.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-sm text-gray-700">{sub.name}</p>
                    {sub.item_limit && (
                      <span className={"text-xs font-bold px-2 py-0.5 rounded-full " +
                        (subTotal >= sub.item_limit ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700")}>
                        {subTotal}/{sub.item_limit}
                      </span>
                    )}
                  </div>
                </div>
                {subProducts.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    qty={cart[product.id] || 0}
                    canAdd={canAdd(product)}
                    isClosed={isClosed}
                    onAdd={() => setQty(product.id, 1)}
                    onRemove={() => setQty(product.id, -1)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {groupProducts.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">Nenhum produto neste grupo</p>
              </div>
            ) : groupProducts.map(product => (
              <ProductRow
                key={product.id}
                product={product}
                qty={cart[product.id] || 0}
                canAdd={canAdd(product)}
                isClosed={isClosed}
                onAdd={() => setQty(product.id, 1)}
                onRemove={() => setQty(product.id, -1)}
              />
            ))}
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="space-y-1 mb-2">
            {groups.map(g => {
              const groupSubtotal = availableProducts
                .filter(p => p.group_id === g.id)
                .reduce((s, p) => s + (cart[p.id] || 0) * parseFloat(p.price), 0);
              if (groupSubtotal === 0) return null;
              return (
                <div key={g.id} className="flex justify-between text-xs" data-testid={`subtotal-group-${g.id}`}>
                  <span className="text-gray-500">{g.name}</span>
                  <span className="font-semibold text-gray-700">R$ {groupSubtotal.toFixed(2).replace(".", ",")}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-green-900" />
                <span className="font-bold text-gray-800">{totalItems} item(s)</span>
              </div>
              <span className="font-extrabold text-green-900 text-lg" data-testid="text-order-total">
                R$ {totalValue.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>
          {isClosed ? (
            <p className="text-center text-sm text-red-500 font-semibold py-2">Período fechado (dia 1 a 14). Aguarde o dia 15 para confirmar pedidos.</p>
          ) : (
            <button
              onClick={() => setShowTerm(true)}
              disabled={submitting}
              className="w-full py-4 bg-green-900 text-white font-bold rounded-2xl disabled:opacity-60"
              data-testid="button-confirm-order"
            >
              {editing ? "Atualizar Pedido" : "Confirmar Pedido"}
            </button>
          )}
        </div>
      )}

      {showTerm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div
            className="w-full max-w-2xl bg-white rounded-t-3xl p-5"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <h3 className="font-extrabold text-lg mb-3">Termo de Autorização</h3>
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-2xl p-4 mb-4">
              Eu, <strong>{user?.name}</strong>, autorizo a Brasfrut Frutos do Brasil
              a realizar o desconto na minha folha de pagamento, no valor de{" "}
              <strong>R$ {totalValue.toFixed(2).replace(".", ",")}</strong>, referente ao pedido de{" "}
              <strong>{activeCycle ? `${MONTHS_FULL[activeCycle.month - 1]}/${activeCycle.year}` : ""}</strong>.
            </p>
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="w-5 h-5 rounded accent-green-900"
                data-testid="checkbox-agree"
              />
              <span className="text-sm font-medium text-gray-700">Li e concordo com o termo acima</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTerm(false)}
                className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-gray-600 font-semibold"
                data-testid="button-cancel-term"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!agreed || submitting}
                className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold disabled:opacity-60"
                data-testid="button-confirm-term"
              >
                {submitting ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-extrabold text-lg mb-2">Excluir pedido?</h3>
            <p className="text-gray-500 text-sm mb-5">Todos os itens do pedido serão removidos. Deseja continuar?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600" data-testid="button-cancel-delete">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold" data-testid="button-confirm-delete">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, qty, canAdd, isClosed, onAdd, onRemove }: {
  product: any; qty: number; canAdd: boolean; isClosed: boolean;
  onAdd: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center px-4 py-3 gap-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800">{product.name}</p>
        <p className="text-xs text-gray-500">R$ {parseFloat(product.price).toFixed(2).replace(".", ",")} / {product.unit}</p>
      </div>
      {!isClosed && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {qty > 0 && (
            <button
              onClick={onRemove}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"
              data-testid={`button-remove-${product.id}`}
            >
              <Minus size={14} />
            </button>
          )}
          {qty > 0 && <span className="font-bold text-gray-800 w-5 text-center">{qty}</span>}
          <button
            onClick={onAdd}
            disabled={!canAdd}
            className={"w-8 h-8 rounded-full flex items-center justify-center transition-colors " +
              (qty > 0 ? "bg-green-900 text-white" : "bg-green-100 text-green-800") +
              (!canAdd ? " opacity-30 cursor-not-allowed" : "")}
            data-testid={`button-add-${product.id}`}
          >
            <Plus size={14} />
          </button>
        </div>
      )}
      {isClosed && qty > 0 && (
        <span className="text-sm font-bold text-gray-700">{qty}x</span>
      )}
    </div>
  );
}
