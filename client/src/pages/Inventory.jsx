import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, AlertTriangle, PlusCircle, MinusCircle } from "lucide-react";
import api from "../api/axios.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";

export default function Inventory() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", unit: "pcs", quantity: 0, lowStockThreshold: 5, location: "" });

  const load = () => api.get("/inventory", { params: { lowStock: showLowStock || undefined } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [showLowStock]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/inventory", form);
      toast.success(t("inventory.itemAdded"));
      setShowModal(false);
      setForm({ name: "", category: "", unit: "pcs", quantity: 0, lowStockThreshold: 5, location: "" });
      load();
      bumpDataVersion(CHANNELS.inventory, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const adjust = async (id, delta) => {
    await api.post(`/inventory/${id}/adjust`, { delta, reason: delta > 0 ? t("inventory.restockReason") : t("inventory.usageReason") });
    load();
    bumpDataVersion(CHANNELS.inventory, CHANNELS.dashboard);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-800">{t("inventory.title")}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showLowStock} onChange={(e) => setShowLowStock(e.target.checked)} /> {t("inventory.lowStockOnly")}
          </label>
          <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("inventory.addItemStock")}</button>
        </div>
      </div>

      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("inventory.itemName")}</th><th>{t("inventory.category")}</th><th>{t("inventory.unit")}</th><th>{t("inventory.quantity")}</th><th>{t("inventory.location")}</th><th>{t("common.actions")}</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i._id}>
                <td className="font-medium">{i.name}</td>
                <td>{i.category || "—"}</td>
                <td>{i.unit}</td>
                <td className={i.quantity <= i.lowStockThreshold ? "text-rose-600 font-medium flex items-center gap-1" : ""}>
                  {i.quantity <= i.lowStockThreshold && <AlertTriangle size={13} />} {i.quantity}
                </td>
                <td>{i.location || "—"}</td>
                <td className="flex gap-2">
                  <button onClick={() => adjust(i._id, 1)} title={t("inventory.increaseStock")}><PlusCircle size={16} className="text-emerald-600" /></button>
                  <button onClick={() => adjust(i._id, -1)} title={t("inventory.decreaseStock")}><MinusCircle size={16} className="text-rose-600" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("inventory.noItems")}</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("inventory.addItemStock")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("inventory.itemName")} *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">{t("inventory.category")}</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("inventory.unit")}</label><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div><label className="label">{t("inventory.quantity")}</label><input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              </div>
              <div><label className="label">{t("inventory.reorderLevel")}</label><input type="number" className="input" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} /></div>
              <div><label className="label">{t("inventory.location")}</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
