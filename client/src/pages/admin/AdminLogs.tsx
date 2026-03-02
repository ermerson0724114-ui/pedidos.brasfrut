import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Shield, ShoppingBag, LogIn, Trash2, Edit2, AlertTriangle, ChevronDown, ChevronUp, Wifi } from "lucide-react";
import type { AuditLog } from "@shared/schema";

const actionConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  login_admin: { label: "Login Admin", icon: LogIn, color: "text-blue-700", bg: "bg-blue-50" },
  login_funcionario: { label: "Login", icon: LogIn, color: "text-green-700", bg: "bg-green-50" },
  conta_bloqueada: { label: "Bloqueio", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
  pedido_criado: { label: "Pedido Criado", icon: ShoppingBag, color: "text-emerald-700", bg: "bg-emerald-50" },
  pedido_editado: { label: "Pedido Editado", icon: Edit2, color: "text-amber-700", bg: "bg-amber-50" },
  pedido_excluido: { label: "Pedido Excluído", icon: Trash2, color: "text-red-700", bg: "bg-red-50" },
};

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(date: string) {
  const d = new Date(date);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminLogs() {
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({ queryKey: ["/api/audit-logs"] });
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      (log.employee_registration || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.order_id && `#${log.order_id}`.includes(search));
    const matchAction = filterAction === "all" || log.action === filterAction;
    return matchSearch && matchAction;
  });

  const actionTypes = [...new Set(logs.map(l => l.action))];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={20} className="text-green-900" />
        <h2 className="text-lg font-extrabold text-gray-900" data-testid="text-audit-logs-title">
          Log de Auditoria
        </h2>
        <span className="ml-auto text-xs text-gray-400 font-semibold" data-testid="text-audit-logs-count">
          {filtered.length} registro(s)
        </span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, matrícula, pedido..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500"
          data-testid="input-search-audit-logs"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterAction("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            filterAction === "all" ? "bg-green-900 text-white" : "bg-gray-100 text-gray-600"
          }`}
          data-testid="filter-audit-all"
        >
          Todos
        </button>
        {actionTypes.map(action => {
          const cfg = actionConfig[action] || { label: action, color: "text-gray-700", bg: "bg-gray-50" };
          return (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filterAction === action ? "bg-green-900 text-white" : "bg-gray-100 text-gray-600"
              }`}
              data-testid={`filter-audit-${action}`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400 font-semibold">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const cfg = actionConfig[log.action] || { label: log.action, icon: Shield, color: "text-gray-700", bg: "bg-gray-50" };
            const Icon = cfg.icon;
            const expanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
                data-testid={`audit-log-${log.id}`}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="w-full p-4 flex items-start gap-3 text-left"
                  data-testid={`button-expand-log-${log.id}`}
                >
                  <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                      {log.order_id && (
                        <span className="text-xs text-gray-400">#{log.order_id}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{log.employee_name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(log.created_at as unknown as string)} às {formatTime(log.created_at as unknown as string)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {log.order_total && (
                      <span className="text-sm font-bold text-green-900">
                        R$ {parseFloat(log.order_total).toFixed(2).replace(".", ",")}
                      </span>
                    )}
                    {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-50">
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div>
                        <span className="text-gray-400 block mb-0.5">ID Usuário</span>
                        <span className="font-semibold text-gray-700" data-testid={`text-log-employee-id-${log.id}`}>
                          {log.employee_id ?? "Admin"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Matrícula</span>
                        <span className="font-semibold text-gray-700" data-testid={`text-log-registration-${log.id}`}>
                          {log.employee_registration || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Referência</span>
                        <span className="font-semibold text-gray-700" data-testid={`text-log-cycle-ref-${log.id}`}>
                          {log.cycle_reference || "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <div>
                          <span className="text-gray-400 block mb-0.5">IP</span>
                          <span className="font-mono font-semibold text-gray-700 text-[11px]" data-testid={`text-log-ip-${log.id}`}>
                            {log.ip_address || "—"}
                          </span>
                        </div>
                        <Wifi size={12} className="text-gray-300 mt-4" />
                      </div>
                    </div>
                    {log.details && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-400 text-xs block mb-1">Detalhes</span>
                        <p className="text-xs text-gray-700 leading-relaxed" data-testid={`text-log-details-${log.id}`}>
                          {log.details}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
