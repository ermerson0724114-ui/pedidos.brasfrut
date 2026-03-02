import { useState } from "react";
import { Plus, Edit2, Trash2, X, Package, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

interface GroupData { id: number; name: string; subgroups: { id: number; name: string; item_limit: number | null }[]; }
const emptyForm = { name: "", groupId: "", subgroupId: "", price: "", unit: "un", available: true };

export default function AdminProducts() {
  const { toast } = useToast();
  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: groups = [] } = useQuery<GroupData[]>({ queryKey: ["/api/groups"] });
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/products"] });
  const createMut = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/products", data), onSuccess: invalidate });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/products/${id}`, data), onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`), onSuccess: invalidate });

  const selectedGroup = groups.find(g => g.id === parseInt(form.groupId));
  const subgroupsList = selectedGroup?.subgroups || [];
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const getGroupName = (gid: number) => groups.find(g => g.id === gid)?.name || "-";
  const getSubgroupName = (gid: number, sid: number) => groups.find(g => g.id === gid)?.subgroups?.find(s => s.id === sid)?.name || null;

  const openEdit = (p: Product) => {
    setForm({ name: p.name, groupId: String(p.group_id || ""), subgroupId: String(p.subgroup_id || ""), price: p.price, unit: p.unit, available: p.available });
    setEditId(p.id); setModal("edit");
  };

  const handleSave = () => {
    const payload = { name: form.name, group_id: parseInt(form.groupId), subgroup_id: form.subgroupId ? parseInt(form.subgroupId) : null, price: form.price, unit: form.unit, available: form.available };
    if (modal === "add") { createMut.mutate(payload); toast({ title: "Produto adicionado!" }); }
    else if (editId !== null) { updateMut.mutate({ id: editId, data: payload }); toast({ title: "Produto atualizado!" }); }
    setModal(null); setForm(emptyForm);
  };

  const handleDelete = () => {
    if (deleteId !== null) deleteMut.mutate(deleteId);
    toast({ title: "Produto excluído!" }); setDeleteId(null);
  };

  if (isLoading) return <div className="text-center py-20 text-gray-400"><p className="text-sm">Carregando...</p></div>;

  return (
    <div className="bg-gray-50">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center"><Package size={20} className="text-green-800" /></div>
            <div><h2 className="text-lg font-extrabold text-gray-800">Produtos</h2><p className="text-gray-500 text-xs">{products.length} produto(s)</p></div>
          </div>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setModal("add"); }} className="w-9 h-9 bg-green-900 text-white rounded-xl flex items-center justify-center" data-testid="button-add-product"><Plus size={18} /></button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
            className="w-full bg-gray-100 text-gray-800 placeholder-gray-400 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid="input-search-products" />
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><Package size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum produto encontrado</p></div>
        ) : filtered.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3" data-testid={`card-product-${p.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                {!p.available && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inativo</span>}
              </div>
              <p className="text-xs text-gray-500">
                {getGroupName(p.group_id)}{p.subgroup_id ? ` · ${getSubgroupName(p.group_id, p.subgroup_id)}` : ""} · R$ {parseFloat(p.price).toFixed(2).replace(".", ",")} / {p.unit}
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(p)} className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-green-700" data-testid={`button-edit-product-${p.id}`}><Edit2 size={14} /></button>
              <button onClick={() => setDeleteId(p.id)} className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500" data-testid={`button-delete-product-${p.id}`}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "92vh" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h2 className="font-extrabold text-lg">{modal === "add" ? "Novo Produto" : "Editar Produto"}</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 space-y-3 pb-2">
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do produto"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grupo</label>
                <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value, subgroupId: "" })}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Selecione...</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select></div>
              {subgroupsList.length > 0 && (
                <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subgrupo</label>
                  <select value={form.subgroupId} onChange={e => setForm({ ...form, subgroupId: e.target.value })}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Sem subgrupo</option>{subgroupsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
              )}
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preço</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidade</label>
                <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="un"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })} className="w-5 h-5 rounded accent-green-900" />
                <span className="text-sm font-medium text-gray-700">Produto disponível</span></label>
            </div>
            <div className="flex gap-3 px-5 py-4 flex-shrink-0 bg-white border-t border-gray-100" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
              <button onClick={() => setModal(null)} className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-gray-600 font-semibold">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold" data-testid="button-save-product">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-extrabold text-lg mb-2">Confirmar exclusão</h3>
            <p className="text-gray-500 text-sm mb-5">O produto será removido permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold" data-testid="button-confirm-delete-product">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
