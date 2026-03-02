import { useState, useRef, useMemo } from "react";
import { Plus, Search, Edit2, Trash2, Unlock, Upload, X, Users, Key, UserCheck, UserX, RefreshCw, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import * as XLSX from "xlsx";

const emptyForm = { name: "", registrationNumber: "", email: "", whatsapp: "", funcao: "", setor: "", distribuicao: "", admissao: "" };

export default function AdminEmployees() {
  const { toast } = useToast();
  const { data: employees = [], isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [passwordModal, setPasswordModal] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  const [selectedSetores, setSelectedSetores] = useState<Set<string>>(new Set(["__all__"]));
  const [showSetorFilter, setShowSetorFilter] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const syncRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/employees"] });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/employees", data),
    onSuccess: invalidate,
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/employees/${id}`, data),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: invalidate,
  });
  const bulkMut = useMutation({
    mutationFn: (data: any[]) => apiRequest("POST", "/api/employees/bulk", data),
    onSuccess: invalidate,
  });
  const syncMut = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await apiRequest("POST", "/api/employees/sync", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidate();
      const parts = [];
      if (data.added > 0) parts.push(`${data.added} adicionado(s)`);
      if (data.reactivated > 0) parts.push(`${data.reactivated} reativado(s)`);
      if (data.deactivated > 0) parts.push(`${data.deactivated} desligado(s)`);
      if (parts.length === 0) parts.push("Nenhuma alteração");
      toast({ title: "Sincronização concluída", description: parts.join(", ") });
    },
  });

  const allSetores = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.setor) set.add(e.setor); });
    return Array.from(set).sort();
  }, [employees]);

  const activeEmployees = employees.filter(e => (e as any).status !== "inactive");
  const inactiveEmployees = employees.filter(e => (e as any).status === "inactive");
  const displayList = statusFilter === "active" ? activeEmployees : inactiveEmployees;

  const isAllSelected = selectedSetores.has("__all__");

  const filtered = displayList
    .filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.registration_number?.includes(search);
      const matchSetor = isAllSelected || selectedSetores.has(e.setor || "");
      return matchSearch && matchSetor;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const toggleSetor = (setor: string) => {
    setSelectedSetores(prev => {
      const next = new Set(prev);
      if (setor === "__all__") {
        return new Set(["__all__"]);
      }
      next.delete("__all__");
      if (next.has(setor)) next.delete(setor);
      else next.add(setor);
      if (next.size === 0) return new Set(["__all__"]);
      return next;
    });
  };

  const openEdit = (emp: Employee) => {
    setForm({
      name: emp.name, registrationNumber: emp.registration_number, email: emp.email || "",
      whatsapp: emp.whatsapp || "", funcao: emp.funcao || "", setor: emp.setor || "",
      distribuicao: emp.distribuicao || "", admissao: (emp as any).admissao || "",
    });
    setEditId(emp.id);
    setModal("edit");
  };

  const handleSave = () => {
    if (modal === "add") {
      createMut.mutate({
        name: form.name, registration_number: form.registrationNumber, password: "",
        email: form.email, whatsapp: form.whatsapp, funcao: form.funcao,
        setor: form.setor, distribuicao: form.distribuicao, admissao: form.admissao,
        is_locked: false, status: "active",
      });
      toast({ title: "Funcionário adicionado!" });
    } else if (editId !== null) {
      updateMut.mutate({
        id: editId, data: {
          name: form.name, registration_number: form.registrationNumber,
          email: form.email, whatsapp: form.whatsapp, funcao: form.funcao,
          setor: form.setor, distribuicao: form.distribuicao, admissao: form.admissao,
        }
      });
      toast({ title: "Funcionário atualizado!" });
    }
    setModal(null);
    setForm(emptyForm);
  };

  const handleDelete = () => {
    if (deleteId !== null) deleteMut.mutate(deleteId);
    toast({ title: "Funcionário excluído" });
    setDeleteId(null);
  };

  const handleToggleStatus = (emp: Employee) => {
    const newStatus = (emp as any).status === "inactive" ? "active" : "inactive";
    updateMut.mutate({ id: emp.id, data: { status: newStatus } });
    toast({ title: newStatus === "active" ? "Funcionário reativado!" : "Funcionário desligado!" });
  };

  const handleUnlock = (id: number) => {
    updateMut.mutate({ id, data: { is_locked: false, failed_attempts: 0 } });
    toast({ title: "Funcionário desbloqueado", variant: "success" });
  };

  const handleChangePassword = () => {
    if (!newPassword || newPassword.length < 6) return toast({ title: "Mínimo 6 caracteres", variant: "destructive" });
    if (passwordModal !== null) updateMut.mutate({ id: passwordModal, data: { password: newPassword } });
    toast({ title: "Senha alterada com sucesso!" });
    setPasswordModal(null);
    setNewPassword("");
  };

  const headerMap: Record<string, string> = {
    "matrícula": "registration_number", "matricula": "registration_number",
    "nome": "name", "name": "name",
    "email": "email", "e-mail": "email",
    "whatsapp": "whatsapp", "telefone": "whatsapp", "celular": "whatsapp",
    "função": "funcao", "funcao": "funcao", "cargo": "funcao",
    "setor": "setor", "departamento": "setor",
    "distribuição": "distribuicao", "distribuicao": "distribuicao",
    "admissão": "admissao", "admissao": "admissao", "data admissão": "admissao",
  };
  const requiredFields = ["registration_number", "name", "setor", "distribuicao"];

  const excelDateToString = (v: any): string => {
    if (typeof v === "number" && v > 30000 && v < 100000) {
      const d = new Date((v - 25569) * 86400000);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
    return String(v ?? "").trim();
  };

  const parseExcelFile = (buffer: ArrayBuffer): any[] => {
    const wb = XLSX.read(buffer, { type: "array" });
    const labels: Record<string, string> = { registration_number: "Matrícula", name: "Nome", setor: "Setor", distribuicao: "Distribuição" };

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) continue;

      const headers = Object.keys(rows[0]);
      const colMapping: Record<string, string> = {};
      for (const h of headers) {
        const normalized = h.toLowerCase().trim();
        if (headerMap[normalized]) colMapping[h] = headerMap[normalized];
      }

      const missingRequired = requiredFields.filter(f => !Object.values(colMapping).includes(f));
      if (missingRequired.length > 0) continue;

      return rows.map(row => {
        const emp: any = { registration_number: "", name: "", email: "", whatsapp: "", funcao: "", setor: "", distribuicao: "", admissao: "", password: "", is_locked: false };
        for (const [excelCol, field] of Object.entries(colMapping)) {
          emp[field] = field === "admissao" ? excelDateToString(row[excelCol]) : String(row[excelCol] ?? "").trim();
        }
        return emp;
      }).filter((e: any) => e.name && e.registration_number && e.setor && e.distribuicao);
    }

    toast({ title: `Nenhuma aba com colunas obrigatórias: ${Object.values(labels).join(", ")}`, variant: "destructive" });
    return [];
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>, mode: "add" | "sync") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const emps = parseExcelFile(reader.result as ArrayBuffer);
      if (emps.length === 0) return;
      if (mode === "sync") {
        syncMut.mutate(emps);
      } else {
        bulkMut.mutate(emps);
        toast({ title: `${emps.length} funcionário(s) importado(s)!` });
      }
      setModal(null);
    };
    reader.readAsArrayBuffer(file);
    if (csvRef.current) csvRef.current.value = "";
    if (syncRef.current) syncRef.current.value = "";
  };

  const fields = [
    { key: "name", label: "Nome completo", placeholder: "Nome do funcionário" },
    { key: "registrationNumber", label: "Matrícula", placeholder: "Ex: 001234" },
    { key: "email", label: "E-mail", placeholder: "email@brasfrut.com.br" },
    { key: "whatsapp", label: "WhatsApp", placeholder: "(11) 99999-9999" },
    { key: "funcao", label: "Função", placeholder: "Ex: Operador" },
    { key: "setor", label: "Setor", placeholder: "Ex: Produção" },
    { key: "distribuicao", label: "Distribuição", placeholder: "Ex: Matriz" },
    { key: "admissao", label: "Admissão", placeholder: "Ex: 01/01/2024" },
  ];

  if (isLoading) return <div className="text-center py-20 text-gray-400"><p className="text-sm">Carregando...</p></div>;

  return (
    <div className="bg-gray-50">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
              <Users size={20} className="text-green-800" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">Funcionários</h2>
              <p className="text-gray-500 text-xs">{activeEmployees.length} ativo(s) · {inactiveEmployees.length} desligado(s)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModal("import")} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600" data-testid="button-import"><Upload size={16} /></button>
            <button onClick={() => { setForm(emptyForm); setEditId(null); setModal("add"); }} className="w-9 h-9 bg-green-900 text-white rounded-xl flex items-center justify-center" data-testid="button-add-employee"><Plus size={18} /></button>
          </div>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          <button onClick={() => setStatusFilter("active")}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${statusFilter === "active" ? "bg-white text-green-800 shadow-sm" : "text-gray-500"}`}
            data-testid="filter-active">
            <UserCheck size={14} /> Ativos ({activeEmployees.length})
          </button>
          <button onClick={() => setStatusFilter("inactive")}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${statusFilter === "inactive" ? "bg-white text-red-600 shadow-sm" : "text-gray-500"}`}
            data-testid="filter-inactive">
            <UserX size={14} /> Desligados ({inactiveEmployees.length})
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou matrícula..."
              className="w-full bg-gray-100 text-gray-800 placeholder-gray-400 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              data-testid="input-search-employees" />
          </div>
          {allSetores.length > 0 && (
            <button
              onClick={() => setShowSetorFilter(!showSetorFilter)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!isAllSelected ? "bg-green-900 text-white" : "bg-gray-100 text-gray-600"}`}
              data-testid="button-filter-setor"
            >
              <Filter size={16} />
            </button>
          )}
        </div>

        {showSetorFilter && allSetores.length > 0 && (
          <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Filtrar por Setor</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleSetor("__all__")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isAllSelected ? "bg-green-900 text-white" : "bg-gray-100 text-gray-600"}`}
                data-testid="filter-setor-all"
              >
                Todos
              </button>
              {allSetores.map(setor => (
                <button
                  key={setor}
                  onClick={() => toggleSetor(setor)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedSetores.has(setor) ? "bg-green-900 text-white" : "bg-gray-100 text-gray-600"}`}
                  data-testid={`filter-setor-${setor}`}
                >
                  {setor}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-2 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{statusFilter === "active" ? "Nenhum funcionário ativo" : "Nenhum funcionário desligado"}</p>
          </div>
        ) : filtered.map(emp => (
          <div key={emp.id} className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 ${(emp as any).status === "inactive" ? "opacity-60" : ""}`} data-testid={`card-employee-${emp.id}`}>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${(emp as any).status === "inactive" ? "bg-gray-100" : "bg-green-100"}`}>
              <span className={`font-bold text-sm ${(emp as any).status === "inactive" ? "text-gray-500" : "text-green-800"}`}>{emp.name.split(" ").slice(0, 2).map(n => n[0]).join("")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                {(emp as any).status === "inactive" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Desligado</span>}
                {emp.is_locked && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Bloqueado</span>}
              </div>
              <p className="text-xs text-gray-500">{emp.registration_number} · {emp.funcao || emp.setor || "-"}</p>
            </div>
            <div className="flex gap-1">
              {(emp as any).status === "inactive" ? (
                <>
                  <button onClick={() => handleToggleStatus(emp)} className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-green-600" title="Reativar" data-testid={`button-reactivate-${emp.id}`}><RefreshCw size={14} /></button>
                  <button onClick={() => setDeleteId(emp.id)} className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500" title="Excluir" data-testid={`button-delete-employee-${emp.id}`}><Trash2 size={14} /></button>
                </>
              ) : (
                <>
                  {emp.is_locked && <button onClick={() => handleUnlock(emp.id)} className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600" data-testid={`button-unlock-${emp.id}`}><Unlock size={14} /></button>}
                  <button onClick={() => { setPasswordModal(emp.id); setNewPassword(""); }} className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600" data-testid={`button-password-${emp.id}`}><Key size={13} /></button>
                  <button onClick={() => openEdit(emp)} className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-green-700" data-testid={`button-edit-employee-${emp.id}`}><Edit2 size={14} /></button>
                  <button onClick={() => handleToggleStatus(emp)} className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500" title="Desligar" data-testid={`button-deactivate-${emp.id}`}><UserX size={14} /></button>
                  <button onClick={() => setDeleteId(emp.id)} className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-400" title="Excluir" data-testid={`button-delete-employee-${emp.id}`}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "92vh" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h2 className="font-extrabold text-lg">{modal === "add" ? "Novo Funcionário" : "Editar Funcionário"}</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 space-y-3 pb-2">
              {fields.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid={`input-${key}`} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-5 py-4 flex-shrink-0 bg-white border-t border-gray-100" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
              <button onClick={() => setModal(null)} className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-gray-600 font-semibold">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold" data-testid="button-save-employee">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {passwordModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-lg">Alterar Senha</h3>
              <button onClick={() => setPasswordModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500 mb-4"
              data-testid="input-new-password-admin" />
            <div className="flex gap-3">
              <button onClick={() => setPasswordModal(null)} className="flex-1 py-3 border border-gray-200 rounded-2xl text-gray-600 font-semibold">Cancelar</button>
              <button onClick={handleChangePassword} className="flex-1 py-3 bg-green-900 text-white rounded-2xl font-bold" data-testid="button-save-password">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {modal === "import" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl p-5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg">Importar Funcionários</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Formato: Planilha Excel (.xlsx, .xls)</p>
              <p className="text-xs text-gray-500">As colunas devem ter os mesmos nomes dos campos do formulário:</p>
              <code className="text-xs text-gray-500 block mt-1">Matrícula, Nome, Setor, Distribuição</code>
              <p className="text-xs text-gray-400 mt-1">Campos opcionais: Email, WhatsApp, Função, Admissão</p>
            </div>

            <input ref={syncRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleExcelImport(e, "sync")} />
            <input ref={csvRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleExcelImport(e, "add")} />

            <div className="space-y-3">
              <button onClick={() => syncRef.current?.click()}
                className="w-full py-4 bg-green-50 border-2 border-green-300 rounded-2xl text-green-800 font-semibold flex flex-col items-center gap-1"
                data-testid="button-sync-file">
                <div className="flex items-center gap-2">
                  <RefreshCw size={20} />
                  <span>Sincronizar lista</span>
                </div>
                <span className="text-xs text-green-600 font-normal">Atualiza status: quem não está no arquivo fica como desligado</span>
              </button>

              <button onClick={() => csvRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 font-semibold flex flex-col items-center gap-1"
                data-testid="button-add-file">
                <div className="flex items-center gap-2">
                  <Upload size={20} />
                  <span>Adicionar ao cadastro</span>
                </div>
                <span className="text-xs text-gray-400 font-normal">Apenas adiciona novos, sem alterar os existentes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-extrabold text-lg mb-2">Confirmar exclusão</h3>
            <p className="text-gray-500 text-sm mb-5">O funcionário será removido permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold" data-testid="button-confirm-delete-employee">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
