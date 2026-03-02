import { useState } from "react";
import { Plus, Edit2, Trash2, X, Layers, ChevronDown, ChevronUp, GripVertical, Package, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

interface SubgroupData { id: number; group_id: number; name: string; item_limit: number | null; sort_order: number; }
interface GroupData { id: number; name: string; description: string | null; item_limit: number | null; sort_order: number; subgroups: SubgroupData[]; }

export default function AdminGroups() {
  const { toast } = useToast();
  const { data: groups = [], isLoading } = useQuery<GroupData[]>({ queryKey: ["/api/groups"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", itemLimit: "" });
  const [subModal, setSubModal] = useState<{ groupId: number; id?: number } | null>(null);
  const [subForm, setSubForm] = useState({ name: "", itemLimit: "" });
  const [productModal, setProductModal] = useState<{ groupId: number; subgroupId?: number; id?: number } | null>(null);
  const [productForm, setProductForm] = useState({ name: "", price: "", unit: "un", available: true, subgroupId: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; name: string } | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const createGroup = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/groups", data), onSuccess: invalidateAll });
  const updateGroup = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/groups/${id}`, data), onSuccess: invalidateAll });
  const deleteGroup = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/groups/${id}`), onSuccess: invalidateAll });
  const reorderGroups = useMutation({ mutationFn: (data: any) => apiRequest("PATCH", "/api/groups/reorder", data), onSuccess: invalidateAll });

  const createSub = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/subgroups", data), onSuccess: invalidateAll });
  const updateSub = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/subgroups/${id}`, data), onSuccess: invalidateAll });
  const deleteSub = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/subgroups/${id}`), onSuccess: invalidateAll });

  const createProduct = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/products", data), onSuccess: invalidateAll });
  const updateProduct = useMutation({ mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/products/${id}`, data), onSuccess: invalidateAll });
  const deleteProduct = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`), onSuccess: invalidateAll });
  const reorderProducts = useMutation({ mutationFn: (data: any) => apiRequest("PATCH", "/api/products/reorder", data), onSuccess: invalidateAll });

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const moveGroup = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const reordered = groups.map((g, i) => ({
      id: g.id,
      sort_order: i === index ? target : i === target ? index : i,
    }));
    reorderGroups.mutate(reordered);
  };

  const moveProduct = (groupId: number, subgroupId: number | null, productId: number, direction: -1 | 1) => {
    const groupProducts = products
      .filter(p => p.group_id === groupId && (subgroupId ? p.subgroup_id === subgroupId : !p.subgroup_id))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = groupProducts.findIndex(p => p.id === productId);
    const target = idx + direction;
    if (target < 0 || target >= groupProducts.length) return;
    const reordered = groupProducts.map((p, i) => ({
      id: p.id,
      sort_order: i === idx ? target : i === target ? idx : i,
    }));
    reorderProducts.mutate(reordered);
  };

  const openEditGroup = (g: GroupData) => {
    setForm({ name: g.name, description: g.description || "", itemLimit: g.item_limit != null ? String(g.item_limit) : "" });
    setEditId(g.id);
    setModal("edit");
  };

  const handleSaveGroup = () => {
    const payload = { name: form.name, description: form.description, item_limit: form.itemLimit ? parseInt(form.itemLimit) : null, sort_order: editId ? undefined : groups.length };
    if (modal === "add") { createGroup.mutate(payload); toast({ title: "Grupo adicionado!" }); }
    else if (editId !== null) { updateGroup.mutate({ id: editId, data: payload }); toast({ title: "Grupo atualizado!" }); }
    setModal(null);
  };

  const handleSaveSub = () => {
    if (!subModal) return;
    const group = groups.find(g => g.id === subModal.groupId);
    const payload = { name: subForm.name, item_limit: subForm.itemLimit ? parseInt(subForm.itemLimit) : null, group_id: subModal.groupId, sort_order: subModal.id ? undefined : (group?.subgroups.length || 0) };
    if (subModal.id) { updateSub.mutate({ id: subModal.id, data: payload }); toast({ title: "Subgrupo atualizado!" }); }
    else { createSub.mutate(payload); toast({ title: "Subgrupo adicionado!" }); }
    setSubModal(null);
  };

  const openAddProduct = (groupId: number, subgroupId?: number) => {
    setProductForm({ name: "", price: "", unit: "un", available: true, subgroupId: subgroupId ? String(subgroupId) : "" });
    setProductModal({ groupId, subgroupId, id: undefined });
  };

  const openEditProduct = (p: Product) => {
    setProductForm({ name: p.name, price: p.price, unit: p.unit, available: p.available, subgroupId: p.subgroup_id ? String(p.subgroup_id) : "" });
    setProductModal({ groupId: p.group_id, subgroupId: p.subgroup_id ?? undefined, id: p.id });
  };

  const handleSaveProduct = () => {
    if (!productModal) return;
    const groupProducts = products.filter(p => p.group_id === productModal.groupId);
    const payload = {
      name: productForm.name,
      group_id: productModal.groupId,
      subgroup_id: productForm.subgroupId ? parseInt(productForm.subgroupId) : null,
      price: productForm.price,
      unit: productForm.unit,
      available: productForm.available,
      sort_order: productModal.id ? undefined : groupProducts.length,
    };
    if (productModal.id) { updateProduct.mutate({ id: productModal.id, data: payload }); toast({ title: "Produto atualizado!" }); }
    else { createProduct.mutate(payload); toast({ title: "Produto adicionado!" }); }
    setProductModal(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "group") deleteGroup.mutate(deleteTarget.id);
    else if (deleteTarget.type === "subgroup") deleteSub.mutate(deleteTarget.id);
    else if (deleteTarget.type === "product") deleteProduct.mutate(deleteTarget.id);
    toast({ title: "Excluído com sucesso!" });
    setDeleteTarget(null);
  };

  const getGroupProducts = (groupId: number, subgroupId?: number) =>
    products.filter(p => p.group_id === groupId && (subgroupId ? p.subgroup_id === subgroupId : !p.subgroup_id))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (isLoading) return <div className="text-center py-20 text-gray-400"><p className="text-sm">Carregando...</p></div>;

  return (
    <div className="bg-gray-50">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center"><Layers size={20} className="text-green-800" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-800">Grupos & Produtos</h2>
            <p className="text-gray-500 text-xs">{groups.length} grupo(s) · {products.length} produto(s)</p>
          </div>
        </div>
        <button onClick={() => { setForm({ name: "", description: "", itemLimit: "" }); setEditId(null); setModal("add"); }}
          className="w-9 h-9 bg-green-900 text-white rounded-xl flex items-center justify-center" data-testid="button-add-group"><Plus size={18} /></button>
      </div>

      <div className="px-4 py-3 space-y-2 pb-24">
        {groups.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><Layers size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum grupo cadastrado</p></div>
        ) : groups.map((g, gIndex) => {
          const isExpanded = expanded.has(g.id);
          const hasSubgroups = g.subgroups.length > 0;
          const directProducts = getGroupProducts(g.id);

          return (
            <div key={g.id} className="bg-white rounded-2xl shadow-sm overflow-hidden" data-testid={`card-group-${g.id}`}>
              <div className="flex items-center px-3 py-3 gap-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveGroup(gIndex, -1)} disabled={gIndex === 0}
                    className="w-6 h-5 flex items-center justify-center text-gray-400 disabled:opacity-20" data-testid={`button-group-up-${g.id}`}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveGroup(gIndex, 1)} disabled={gIndex === groups.length - 1}
                    className="w-6 h-5 flex items-center justify-center text-gray-400 disabled:opacity-20" data-testid={`button-group-down-${g.id}`}>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button className="flex-1 text-left min-w-0" onClick={() => toggleExpanded(g.id)}>
                  <p className="font-bold text-gray-800 truncate">{g.name}</p>
                  <p className="text-xs text-gray-500">
                    {g.item_limit ? `Limite: ${g.item_limit}` : ""}{hasSubgroups ? `${g.subgroups.length} subgrupo(s)` : `${directProducts.length} produto(s)`}
                  </p>
                </button>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEditGroup(g)} className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center text-green-700" data-testid={`button-edit-group-${g.id}`}><Edit2 size={13} /></button>
                  <button onClick={() => setDeleteTarget({ type: "group", id: g.id, name: g.name })} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-red-500" data-testid={`button-delete-group-${g.id}`}><Trash2 size={13} /></button>
                  <button onClick={() => toggleExpanded(g.id)} className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100">
                  {hasSubgroups ? (
                    <>
                      {g.subgroups.map(sub => {
                        const subProducts = getGroupProducts(g.id, sub.id);
                        return (
                          <div key={sub.id} className="border-b border-gray-50 last:border-0">
                            <div className="flex items-center px-4 py-2.5 gap-2 bg-gray-50/50">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-700">{sub.name}</p>
                                <p className="text-xs text-gray-500">Limite: {sub.item_limit ?? "—"} · {subProducts.length} produto(s)</p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => openAddProduct(g.id, sub.id)} className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center text-blue-600" data-testid={`button-add-product-sub-${sub.id}`}><Plus size={11} /></button>
                                <button onClick={() => { setSubModal({ groupId: g.id, id: sub.id }); setSubForm({ name: sub.name, itemLimit: String(sub.item_limit || "") }); }}
                                  className="w-6 h-6 bg-green-50 rounded-md flex items-center justify-center text-green-700"><Edit2 size={11} /></button>
                                <button onClick={() => setDeleteTarget({ type: "subgroup", id: sub.id, name: sub.name })}
                                  className="w-6 h-6 bg-red-50 rounded-md flex items-center justify-center text-red-500"><Trash2 size={11} /></button>
                              </div>
                            </div>
                            {subProducts.map((p, pIdx) => (
                              <ProductRow key={p.id} product={p} index={pIdx} total={subProducts.length}
                                onEdit={() => openEditProduct(p)}
                                onDelete={() => setDeleteTarget({ type: "product", id: p.id, name: p.name })}
                                onMove={(dir) => moveProduct(g.id, sub.id, p.id, dir)}
                                onToggle={() => { updateProduct.mutate({ id: p.id, data: { available: !p.available } }); }} />
                            ))}
                          </div>
                        );
                      })}
                      <div className="px-4 py-2 flex gap-2">
                        <button onClick={() => { setSubModal({ groupId: g.id }); setSubForm({ name: "", itemLimit: "" }); }}
                          className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl flex items-center justify-center gap-1" data-testid={`button-add-subgroup-${g.id}`}>
                          <Plus size={12} />Subgrupo
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {directProducts.map((p, pIdx) => (
                        <ProductRow key={p.id} product={p} index={pIdx} total={directProducts.length}
                          onEdit={() => openEditProduct(p)}
                          onDelete={() => setDeleteTarget({ type: "product", id: p.id, name: p.name })}
                          onMove={(dir) => moveProduct(g.id, null, p.id, dir)}
                          onToggle={() => { updateProduct.mutate({ id: p.id, data: { available: !p.available } }); }} />
                      ))}
                      <div className="px-4 py-2 flex gap-2">
                        <button onClick={() => openAddProduct(g.id)}
                          className="flex-1 py-2 text-xs font-semibold text-green-700 bg-green-50 rounded-xl flex items-center justify-center gap-1" data-testid={`button-add-product-group-${g.id}`}>
                          <Plus size={12} />Produto
                        </button>
                        <button onClick={() => { setSubModal({ groupId: g.id }); setSubForm({ name: "", itemLimit: "" }); }}
                          className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl flex items-center justify-center gap-1" data-testid={`button-add-subgroup-${g.id}`}>
                          <Plus size={12} />Subgrupo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl p-5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg">{modal === "add" ? "Novo Grupo" : "Editar Grupo"}</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Polpas"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid="input-group-name" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Opcional"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Limite de itens (deixe vazio se tiver subgrupos)</label>
                <input type="number" value={form.itemLimit} onChange={e => setForm({ ...form, itemLimit: e.target.value })} placeholder="Ex: 4"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal(null)} className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-gray-600 font-semibold">Cancelar</button>
              <button onClick={handleSaveGroup} className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold" data-testid="button-save-group">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {subModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl p-5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg">{subModal.id ? "Editar Subgrupo" : "Novo Subgrupo"}</h2>
              <button onClick={() => setSubModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</label>
                <input value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} placeholder="Ex: Balde 3,2kg"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid="input-subgroup-name" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Limite de itens</label>
                <input type="number" value={subForm.itemLimit} onChange={e => setSubForm({ ...subForm, itemLimit: e.target.value })} placeholder="Ex: 2"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setSubModal(null)} className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-gray-600 font-semibold">Cancelar</button>
              <button onClick={handleSaveSub} className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold" data-testid="button-save-subgroup">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {productModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl p-5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg">{productModal.id ? "Editar Produto" : "Novo Produto"}</h2>
              <button onClick={() => setProductModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</label>
                <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nome do produto"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid="input-product-name" />
              </div>
              {groups.find(g => g.id === productModal.groupId)?.subgroups.length ? (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subgrupo</label>
                  <select value={productForm.subgroupId} onChange={e => setProductForm({ ...productForm, subgroupId: e.target.value })}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Sem subgrupo</option>
                    {groups.find(g => g.id === productModal.groupId)?.subgroups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preço</label>
                  <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} placeholder="0.00"
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" data-testid="input-product-price" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidade</label>
                  <input value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })} placeholder="un"
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={productForm.available} onChange={e => setProductForm({ ...productForm, available: e.target.checked })} className="w-5 h-5 rounded accent-green-900" />
                <span className="text-sm font-medium text-gray-700">Produto disponível</span>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setProductModal(null)} className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-gray-600 font-semibold">Cancelar</button>
              <button onClick={handleSaveProduct} className="flex-1 py-3.5 bg-green-900 text-white rounded-2xl font-bold" data-testid="button-save-product">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-extrabold text-lg mb-2">Confirmar exclusão</h3>
            <p className="text-gray-500 text-sm mb-1">
              {deleteTarget.type === "group" ? "O grupo, seus subgrupos e todos os produtos serão excluídos." :
               deleteTarget.type === "subgroup" ? "O subgrupo será excluído." : "O produto será removido permanentemente."}
            </p>
            <p className="text-gray-800 font-semibold text-sm mb-5">"{deleteTarget.name}"</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold" data-testid="button-confirm-delete">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, index, total, onEdit, onDelete, onMove, onToggle }: {
  product: Product; index: number; total: number;
  onEdit: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void; onToggle: () => void;
}) {
  return (
    <div className={`flex items-center px-4 py-2 gap-2 border-b border-gray-50 last:border-0 ${!product.available ? "opacity-50" : ""}`} data-testid={`row-product-${product.id}`}>
      <div className="flex flex-col gap-0.5">
        <button onClick={() => onMove(-1)} disabled={index === 0}
          className="w-5 h-4 flex items-center justify-center text-gray-300 disabled:opacity-20"><ChevronUp size={11} /></button>
        <button onClick={() => onMove(1)} disabled={index === total - 1}
          className="w-5 h-4 flex items-center justify-center text-gray-300 disabled:opacity-20"><ChevronDown size={11} /></button>
      </div>
      <Package size={14} className="text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
          {!product.available && <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-semibold">Inativo</span>}
        </div>
        <p className="text-xs text-gray-500">R$ {parseFloat(product.price).toFixed(2).replace(".", ",")} / {product.unit}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onToggle} className={`w-6 h-6 rounded-md flex items-center justify-center ${product.available ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"}`}
          title={product.available ? "Desativar" : "Ativar"} data-testid={`button-toggle-product-${product.id}`}>
          {product.available ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button onClick={onEdit} className="w-6 h-6 bg-green-50 rounded-md flex items-center justify-center text-green-700" data-testid={`button-edit-product-${product.id}`}><Edit2 size={11} /></button>
        <button onClick={onDelete} className="w-6 h-6 bg-red-50 rounded-md flex items-center justify-center text-red-500" data-testid={`button-delete-product-${product.id}`}><Trash2 size={11} /></button>
      </div>
    </div>
  );
}
