import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { MONTHS_FULL } from "@/lib/mockData";
import type { Cycle } from "@shared/schema";

interface OrderItem { id: number; product_id: number; quantity: number; product_name_snapshot: string; group_name_snapshot: string; subgroup_name_snapshot: string | null; unit_price: string; }
interface OrderData { id: number; employee_id: number; employee_name: string; status: string; total: string; cycle_id: number; items: OrderItem[]; }

const STATUS_LABELS: Record<string, string> = {
  draft: "Em edição",
  confirmed: "Confirmado",
  closed: "Fechado",
};

function groupItems(items: OrderItem[]) {
  const map = new Map<string, OrderItem[]>();
  for (const item of items) {
    const key = item.group_name_snapshot || "Outros";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([groupName, groupItems]) => ({
    groupName,
    items: groupItems,
    subtotal: groupItems.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0),
  }));
}

export default function HistoryPage() {
  const { user } = useAuthStore();
  const { data: orders = [] } = useQuery<OrderData[]>({ queryKey: ["/api/orders"] });
  const { data: cycles = [] } = useQuery<Cycle[]>({ queryKey: ["/api/cycles"] });

  const myOrders = orders
    .filter(o => o.employee_id === user?.id)
    .map(o => {
      const cycle = cycles.find(c => c.id === o.cycle_id);
      return { ...o, cycle };
    })
    .sort((a, b) => {
      if (!a.cycle || !b.cycle) return 0;
      return (b.cycle.year * 100 + b.cycle.month) - (a.cycle.year * 100 + a.cycle.month);
    });

  const [currentIndex, setCurrentIndex] = useState(0);

  if (myOrders.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <Clock size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-400 font-medium">Nenhum pedido encontrado no histórico.</p>
      </div>
    );
  }

  const selected = myOrders[currentIndex];
  const grouped = selected?.items ? groupItems(selected.items) : [];
  const grandTotal = parseFloat(selected?.total || "0");
  const cycleLabel = selected?.cycle
    ? `${MONTHS_FULL[selected.cycle.month - 1]} / ${selected.cycle.year}`
    : `Pedido #${selected?.id}`;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-2 py-2">
        <button
          onClick={() => setCurrentIndex(i => Math.min(i + 1, myOrders.length - 1))}
          disabled={currentIndex >= myOrders.length - 1}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 disabled:opacity-30"
          data-testid="button-history-prev"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="font-bold text-gray-800 text-sm" data-testid="text-history-period">
          {cycleLabel}
        </p>
        <button
          onClick={() => setCurrentIndex(i => Math.max(i - 1, 0))}
          disabled={currentIndex <= 0}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 disabled:opacity-30"
          data-testid="button-history-next"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {selected && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-gray-800">{cycleLabel}</p>
            <span className={"text-xs font-bold px-2.5 py-1 rounded-full " +
              (selected.status === "confirmed" ? "bg-green-100 text-green-700" :
               selected.status === "closed" ? "bg-gray-100 text-gray-500" :
               "bg-amber-100 text-amber-700")}
              data-testid="status-history-order"
            >
              {STATUS_LABELS[selected.status] || selected.status}
            </span>
          </div>

          {grouped.map((group, gi) => (
            <div key={group.groupName}>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{group.groupName}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {group.items.map(item => (
                  <div key={item.id} className="px-4 py-2.5 flex items-center justify-between" data-testid={`row-history-item-${item.id}`}>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.product_name_snapshot}</p>
                      {item.subgroup_name_snapshot && (
                        <p className="text-xs text-gray-400">{item.subgroup_name_snapshot}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{item.quantity}x</p>
                      <p className="text-xs text-gray-500">
                        R$ {(parseFloat(item.unit_price) * item.quantity).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-gray-50/60 flex justify-between border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500">Subtotal {group.groupName}</p>
                <p className="text-xs font-bold text-gray-700">R$ {group.subtotal.toFixed(2).replace(".", ",")}</p>
              </div>
              {gi < grouped.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}

          <div className="px-4 py-3 border-t border-gray-200 flex justify-between bg-green-50/50">
            <p className="font-bold text-gray-700">Total Geral</p>
            <p className="font-extrabold text-green-900" data-testid="text-history-total">
              R$ {grandTotal.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
