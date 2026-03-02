import { useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, ShoppingBag, DollarSign, Package, ToggleLeft, ToggleRight, CalendarClock, Lock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MONTHS, MONTHS_FULL } from "@/lib/mockData";
import type { Employee, Product, Cycle } from "@shared/schema";

interface OrderWithItems {
  id: number; employee_id: number; employee_name: string; employee_registration: string | null;
  status: string; total: string; cycle_id: number;
  items: { id: number; product_id: number; quantity: number; product_name_snapshot: string;
    group_name_snapshot: string; subgroup_name_snapshot: string | null; unit_price: string }[];
}

interface GroupWithSubs {
  id: number; name: string; description: string | null; item_limit: number | null; sort_order: number;
  subgroups: { id: number; group_id: number; name: string; item_limit: number | null }[];
}

interface CurrentCycleData { cycle: Cycle; isOpen: boolean; naturallyOpen: boolean; overrideActive: boolean; overrideTarget: "current" | "previous" | null; daysRemaining: number; daysUntilOpen: number; }

const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export default function AdminDashboard() {
  const { toast } = useToast();
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: orders = [] } = useQuery<OrderWithItems[]>({ queryKey: ["/api/orders"] });
  const { data: groups = [] } = useQuery<GroupWithSubs[]>({ queryKey: ["/api/groups"] });
  const { data: cycles = [] } = useQuery<Cycle[]>({ queryKey: ["/api/cycles"] });
  const { data: currentCycleData } = useQuery<CurrentCycleData>({ queryKey: ["/api/cycle/current"] });
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [showMonthDialog, setShowMonthDialog] = useState(false);

  const updateSettings = useMutation({
    mutationFn: (data: Record<string, string>) => apiRequest("PATCH", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycle/current"] });
    },
  });

  const isOpen = currentCycleData?.isOpen ?? false;
  const naturallyOpen = currentCycleData?.naturallyOpen ?? false;
  const overrideActive = currentCycleData?.overrideActive ?? false;
  const overrideTarget = currentCycleData?.overrideTarget ?? null;

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const previousMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
  const previousMonthYear = currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const handleToggleCycle = () => {
    if (overrideActive) {
      updateSettings.mutate({ cycleOverride: "", cycleOverrideMonth: "" }, {
        onSuccess: () => toast({ title: "Override removido. Voltou ao comportamento automático." }),
      });
    } else {
      if (naturallyOpen) {
        updateSettings.mutate({ cycleOverride: "force_closed", cycleOverrideMonth: "" }, {
          onSuccess: () => toast({ title: "Pedidos temporariamente fechados." }),
        });
      } else {
        setShowMonthDialog(true);
      }
    }
  };

  const handleForceOpen = (target: "current" | "previous") => {
    setShowMonthDialog(false);
    const monthLabel = target === "previous"
      ? `${MONTHS_FULL[previousMonthIndex]}/${previousMonthYear}`
      : `${MONTHS_FULL[currentMonthIndex]}/${now.getFullYear()}`;
    updateSettings.mutate(
      { cycleOverride: "force_open", cycleOverrideMonth: target },
      { onSuccess: () => toast({ title: `Pedidos abertos para ${monthLabel}.` }) },
    );
  };

  const activeProducts = products.filter(p => p.available).length;
  const totalValue = orders.reduce((s, o) => s + parseFloat(o.total || "0"), 0);

  const currentMonth = new Date().getMonth();
  const currentMonthOrders = orders.filter(o => {
    const cycle = cycles.find(c => c.id === o.cycle_id);
    return cycle && cycle.month === currentMonth + 1 && cycle.year === selectedYear;
  });

  const chartData = MONTHS.map((label, i) => {
    const monthOrders = orders.filter(o => {
      const cycle = cycles.find(c => c.id === o.cycle_id);
      return cycle && cycle.month === i + 1 && cycle.year === selectedYear;
    });
    const valor = monthOrders.reduce((s, o) => {
      if (selectedGroup === "all") return s + parseFloat(o.total || "0");
      const groupName = groups.find(g => String(g.id) === selectedGroup)?.name;
      const groupItems = o.items?.filter(item => item.group_name_snapshot === groupName) || [];
      return s + groupItems.reduce((sum, item) => sum + parseFloat(item.unit_price) * item.quantity, 0);
    }, 0);
    const funcionarios = selectedGroup === "all"
      ? new Set(monthOrders.map(o => o.employee_id)).size
      : new Set(monthOrders.filter(o => o.items?.some(item => item.group_name_snapshot === groups.find(g => String(g.id) === selectedGroup)?.name)).map(o => o.employee_id)).size;
    return { label, valor, funcionarios };
  });

  const cards = [
    { icon: Users, label: "Funcionários", value: employees.length, color: "bg-blue-50 text-blue-700" },
    { icon: ShoppingBag, label: "Pedidos este mês", value: currentMonthOrders.length, color: "bg-amber-50 text-amber-700" },
    { icon: DollarSign, label: "Total em pedidos", value: `R$ ${totalValue.toFixed(2).replace(".", ",")}`, color: "bg-green-50 text-green-700" },
    { icon: Package, label: "Produtos ativos", value: activeProducts, color: "bg-purple-50 text-purple-700" },
  ];

  const recentOrders = orders.slice(-5).reverse();

  return (
    <div className="px-4 py-4 space-y-4">
      <div className={`rounded-2xl p-4 flex items-center justify-between ${isOpen ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`} data-testid="admin-cycle-control">
        <div className="flex items-center gap-3">
          {isOpen ? <CalendarClock size={20} className="text-green-600 flex-shrink-0" /> : <Lock size={20} className="text-red-500 flex-shrink-0" />}
          <div>
            <p className={`text-sm font-bold ${isOpen ? "text-green-800" : "text-red-700"}`}>
              {isOpen ? "Pedidos abertos" : "Pedidos fechados"}
              {overrideActive && <span className="ml-1 text-xs font-normal">(manual)</span>}
            </p>
            <p className={`text-xs mt-0.5 ${isOpen ? "text-green-600" : "text-red-500"}`}>
              {overrideActive
                ? (isOpen
                  ? `Aberto para ${overrideTarget === "previous" ? MONTHS_FULL[previousMonthIndex] + "/" + previousMonthYear : MONTHS_FULL[currentMonthIndex] + "/" + now.getFullYear()}`
                  : "Fechado manualmente pelo administrador")
                : (naturallyOpen ? `${currentCycleData?.daysRemaining ?? 0} dia(s) restante(s)` : `Abre em ${currentCycleData?.daysUntilOpen ?? 0} dia(s)`)
              }
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleCycle}
          disabled={updateSettings.isPending}
          className="flex-shrink-0 p-1"
          data-testid="button-toggle-cycle"
          title={isOpen ? "Fechar pedidos" : "Abrir pedidos"}
        >
          {isOpen
            ? <ToggleRight size={40} className="text-green-600" />
            : <ToggleLeft size={40} className="text-gray-400" />
          }
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm" data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className={"w-10 h-10 rounded-xl flex items-center justify-center mb-3 " + color}><Icon size={20} /></div>
            <p className="text-2xl font-extrabold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="font-bold text-gray-800 text-sm">Visão Anual</h2>
          <div className="flex gap-2">
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="text-xs border border-gray-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500" data-testid="select-year">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500" data-testid="select-group">
              <option value="all">Todos</option>
              {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
            </select>
          </div>
        </div>
        {chartData.some(d => d.valor > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="valor" name="Valor (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="funcionarios" name="Funcionários" stroke="#14532d" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-gray-400"><p className="text-sm">Sem dados para exibir</p></div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h2 className="font-bold text-gray-800 text-sm">Pedidos Recentes</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><p className="text-sm">Nenhum pedido ainda</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map(order => (
              <div key={order.id} className="px-4 py-3 flex items-center justify-between" data-testid={`row-order-${order.id}`}>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{order.employee_name}</p>
                  <p className="text-xs text-gray-500">{order.items.length} item(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={"text-xs font-bold px-2 py-0.5 rounded-full " +
                    (order.status === "confirmed" ? "bg-green-100 text-green-700" :
                     order.status === "closed" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700")}>
                    {order.status === "confirmed" ? "Confirmado" : order.status === "closed" ? "Fechado" : "Em edição"}
                  </span>
                  <p className="text-sm font-extrabold text-green-900">R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMonthDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-extrabold text-lg mb-2" data-testid="text-month-dialog-title">Abrir pedidos para qual mês?</h3>
            <p className="text-gray-500 text-sm mb-5">
              Escolha o mês de referência para os pedidos que serão realizados durante esta abertura.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleForceOpen("previous")}
                className="w-full py-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl font-bold text-sm flex flex-col items-center"
                data-testid="button-open-previous-month"
              >
                <span>{MONTHS_FULL[previousMonthIndex]} / {previousMonthYear}</span>
                <span className="text-xs font-normal text-amber-600 mt-0.5">Postergando o prazo do mês anterior</span>
              </button>
              <button
                onClick={() => handleForceOpen("current")}
                className="w-full py-3.5 bg-green-50 border border-green-200 text-green-800 rounded-2xl font-bold text-sm flex flex-col items-center"
                data-testid="button-open-current-month"
              >
                <span>{MONTHS_FULL[currentMonthIndex]} / {now.getFullYear()}</span>
                <span className="text-xs font-normal text-green-600 mt-0.5">Antecipando a abertura do mês atual</span>
              </button>
              <button
                onClick={() => setShowMonthDialog(false)}
                className="w-full py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600 text-sm"
                data-testid="button-cancel-month-dialog"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
