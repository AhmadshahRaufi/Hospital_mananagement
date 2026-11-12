import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, Trash2, AlertTriangle, Glasses, ShoppingCart } from "lucide-react";
import api from "../api/axios.js";
import BillPrintModal from "../components/BillPrintModal.jsx";

export default function Optical() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("stock");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("optical.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("stock")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "stock" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><Glasses size={14} /> {t("pharmacy.stock")}</button>
        <button onClick={() => setTab("sell")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "sell" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><ShoppingCart size={14} /> {t("optical.sales")}</button>
      </div>
      {tab === "stock" ? <StockTab /> : <SellTab />}
    </div>
  );
}

function StockTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", type: "frame", brand: "", power: "", quantity: 0, lowStockThreshold: 5, purchasePrice: 0, salePrice: 0 });

  const load = () => api.get("/optical/items").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/optical/items", form);
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ name: "", type: "frame", brand: "", power: "", quantity: 0, lowStockThreshold: 5, purchasePrice: 0, salePrice: 0 });
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("optical.addProduct")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("common.type")}</th><th>{t("optical.frame")}</th><th>{t("optical.power")}</th><th>{t("common.quantity")}</th><th>{t("common.price")}</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i._id}>
                <td className="font-medium">{i.name}</td>
                <td className="capitalize">{i.type.replace("_", " ")}</td>
                <td>{i.brand || "—"}</td>
                <td>{i.power || "—"}</td>
                <td className={i.quantity <= i.lowStockThreshold ? "text-rose-600 font-medium flex items-center gap-1" : ""}>
                  {i.quantity <= i.lowStockThreshold && <AlertTriangle size={13} />} {i.quantity}
                </td>
                <td>{i.salePrice}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("optical.noSales")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("optical.addProduct")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("common.name")} *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <label className="label">{t("common.type")}</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="frame">{t("optical.frame")}</option><option value="lens">{t("optical.lens")}</option><option value="contact_lens">{t("optical.lens")}</option><option value="accessory">{t("patients.other")}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("optical.frame")}</label><input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
                <div><label className="label">{t("optical.power")}</label><input className="input" value={form.power} onChange={(e) => setForm({ ...form, power: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">{t("common.quantity")}</label><input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
                <div><label className="label">{t("common.price")}</label><input type="number" className="input" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} /></div>
                <div><label className="label">{t("common.price")}</label><input type="number" className="input" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SellTab() {
  const { t } = useTranslation();
  const [printBillId, setPrintBillId] = useState(null);
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [patient, setPatient] = useState(null);

  useEffect(() => { api.get("/optical/items").then((r) => setItems(r.data)); }, []);
  useEffect(() => {
    if (!patientQuery) return setPatientResults([]);
    const tm = setTimeout(() => api.get("/patients", { params: { q: patientQuery, limit: 6 } }).then((r) => setPatientResults(r.data.patients)), 300);
    return () => clearTimeout(tm);
  }, [patientQuery]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const addToCart = (i) => {
    if (cart.find((c) => c.item === i._id)) return;
    setCart([...cart, { item: i._id, name: i.name, quantity: 1, salePrice: i.salePrice, discountPercent: 0, available: i.quantity }]);
  };
  const updateCart = (idx, field, value) => setCart((c) => c.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  const removeFromCart = (idx) => setCart((c) => c.filter((_, i) => i !== idx));
  const total = cart.reduce((s, c) => s + c.quantity * c.salePrice * (1 - (c.discountPercent || 0) / 100), 0);

  const checkout = async () => {
    if (!cart.length) return toast.error(t("common.error"));
    try {
      const res = await api.post("/optical/sales", { patient: patient?._id, items: cart.map(({ item, quantity, salePrice, discountPercent }) => ({ item, quantity: Number(quantity), salePrice: Number(salePrice), discountPercent: Number(discountPercent) })) });
      toast.success(t("common.saved"));
      setCart([]); setPatient(null);
      api.get("/optical/items").then((r) => setItems(r.data));
      if (res.data.bill?._id) setPrintBillId(res.data.bill._id);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {printBillId && <BillPrintModal billId={printBillId} onClose={() => setPrintBillId(null)} />}
      <div className="lg:col-span-2 card">
        <input className="input mb-3" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {filtered.map((i) => (
            <button key={i._id} onClick={() => addToCart(i)} className="w-full text-start py-2 flex justify-between items-center hover:bg-slate-50 px-2 rounded">
              <span className="text-sm">{i.name} <span className="text-slate-400">({i.quantity})</span></span>
              <Plus size={15} className="text-brand-600" />
            </button>
          ))}
        </div>
      </div>
      <div className="card space-y-3">
        <h3 className="font-medium text-slate-700">{t("optical.sales")}</h3>
        <div className="relative">
          {patient ? (
            <div className="flex items-center justify-between bg-brand-50 rounded-lg px-3 py-2 text-sm"><span>{patient.name}</span><button onClick={() => setPatient(null)} className="text-xs text-rose-600">{t("common.edit")}</button></div>
          ) : (
            <>
              <input className="input" placeholder={t("opd.patient")} value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
              {patientResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {patientResults.map((p) => (<button key={p._id} className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setPatient(p); setPatientQuery(""); setPatientResults([]); }}>{p.name}</button>))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {cart.map((c, i) => (
            <div key={c.item} className="border border-slate-100 rounded-lg p-2 text-sm space-y-1">
              <div className="flex justify-between items-center"><span className="font-medium">{c.name}</span><button onClick={() => removeFromCart(i)}><Trash2 size={14} className="text-rose-500" /></button></div>
              <div className="grid grid-cols-3 gap-1">
                <input type="number" min={1} max={c.available} className="input !py-1 text-xs" value={c.quantity} onChange={(e) => updateCart(i, "quantity", e.target.value)} />
                <input type="number" className="input !py-1 text-xs" value={c.salePrice} onChange={(e) => updateCart(i, "salePrice", e.target.value)} />
                <input type="number" className="input !py-1 text-xs" placeholder="%" value={c.discountPercent} onChange={(e) => updateCart(i, "discountPercent", e.target.value)} />
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{t("common.noData")}</p>}
        </div>
        <div className="flex justify-between font-semibold border-t border-slate-100 pt-3"><span>{t("common.total")}</span><span>{total.toLocaleString()}</span></div>
        <button className="btn-primary w-full" onClick={checkout}>{t("common.save")}</button>
      </div>
    </div>
  );
}
