import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, Trash2, ShoppingCart, Package, Truck, Building2, AlertTriangle, Upload, Undo2, PackageMinus, Printer, X } from "lucide-react";
import api from "../api/axios.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";
import { amountInWords } from "../utils/numberToWords.js";
import { triggerPrint } from "../utils/print.js";
import BillPrintModal from "../components/BillPrintModal.jsx";

// Each tab carries an i18n key so its label flips with the active language.
const TABS = [
  { key: "stock", labelKey: "pharmacy.stock", icon: Package },
  { key: "sell", labelKey: "pharmacy.newSale", icon: ShoppingCart },
  { key: "salereturn", labelKey: "pharmacy.returns", icon: Undo2 },
  { key: "purchase", labelKey: "pharmacy.newPurchase", icon: Truck },
  { key: "purchasereturn", labelKey: "pharmacy.returns", icon: PackageMinus },
  { key: "suppliers", labelKey: "inventory.supplier", icon: Building2 },
];

export default function Pharmacy() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("stock");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("pharmacy.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === tb.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <tb.icon size={15} /> {t(tb.labelKey)}
          </button>
        ))}
      </div>
      {tab === "stock" && <StockTab />}
      {tab === "sell" && <SellTab />}
      {tab === "salereturn" && <SaleReturnTab />}
      {tab === "purchase" && <PurchaseTab />}
      {tab === "purchasereturn" && <PurchaseReturnTab />}
      {tab === "suppliers" && <SuppliersTab />}
    </div>
  );
}

function StockTab() {
  const { t } = useTranslation();
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: "", company: "", composition: "", category: "", unit: "tablet", lowStockThreshold: 10 });

  const load = () => api.get("/pharmacy/medicines").then((r) => setMedicines(r.data));
  useEffect(() => { load(); api.get("/pharmacy/categories").then((r) => setCategories(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/pharmacy/medicines", form);
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ name: "", company: "", composition: "", category: "", unit: "tablet", lowStockThreshold: 10 });
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const handleCSVFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",");
        const row = {};
        headers.forEach((h, i) => (row[h] = values[i]?.trim()));
        return row;
      });
      try {
        const res = await api.post("/setup/import/medicines", { rows });
        toast.success(`${t("common.created")} ${res.data.created} / ${res.data.failed}`);
        setShowImport(false);
        load();
      } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => setShowImport(true)}><Upload size={16} /> {t("common.upload")}</button>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("pharmacy.addProduct")}</button>
      </div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("pharmacy.manufacturer")}</th><th>{t("pharmacy.genericName")}</th><th>{t("common.category")}</th><th>{t("common.unit")}</th><th>{t("pharmacy.stockQty")}</th></tr></thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m._id}>
                <td className="font-medium">{m.name}</td>
                <td>{m.company || "—"}</td>
                <td>{m.composition || "—"}</td>
                <td>{m.category?.name || "—"}</td>
                <td>{m.unit}</td>
                <td className={m.availableQty <= m.lowStockThreshold ? "text-rose-600 font-medium flex items-center gap-1" : ""}>
                  {m.availableQty <= m.lowStockThreshold && <AlertTriangle size={13} />} {m.availableQty}
                </td>
              </tr>
            ))}
            {medicines.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("pharmacy.noProducts")}</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={t("pharmacy.addProduct")} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-3">
            <Field label={`${t("common.name")} *`}><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label={t("pharmacy.manufacturer")}><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label={t("pharmacy.genericName")}><input className="input" value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("common.unit")}><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
              <Field label={t("pharmacy.reorderLevel")}><input type="number" className="input" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
              <button className="btn-primary">{t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal title={t("common.upload")} onClose={() => setShowImport(false)}>
          <p className="text-sm text-slate-500 mb-3" dir="ltr">CSV: name,company,composition,unit</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile} className="input" />
        </Modal>
      )}
    </div>
  );
}

function SellTab() {
  const { t } = useTranslation();
  const [medicines, setMedicines] = useState([]);
  const [printBillId, setPrintBillId] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [sales, setSales] = useState([]);

  const loadMedicines = () => api.get("/pharmacy/medicines").then((r) => setMedicines(r.data));
  const loadSales = () => api.get("/pharmacy/sales").then((r) => setSales(r.data));
  useEffect(() => { loadMedicines(); loadSales(); }, []);
  useEffect(() => {
    if (!patientQuery) return setPatientResults([]);
    const tm = setTimeout(() => api.get("/patients", { params: { q: patientQuery, limit: 6 } }).then((r) => setPatientResults(r.data.patients)), 300);
    return () => clearTimeout(tm);
  }, [patientQuery]);

  // Only in-stock medicines are sellable. Zero-stock items are excluded from
  // the list AND blocked from the cart as a second line of defense (so a
  // stale list or a race with another sale can't let one through).
  const filtered = medicines.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (m) => {
    if (!m.availableQty || m.availableQty <= 0) {
      return toast.error(`${m.name}: ${t("pharmacy.outOfStock")}`);
    }
    if (cart.find((c) => c.medicine === m._id)) return;
    const batch = [...(m.batches || [])].sort((a, b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0))[0];
    setCart([...cart, { medicine: m._id, name: m.name, quantity: 1, salePrice: batch?.salePrice || 0, discountPercent: 0, available: m.availableQty }]);
  };
  const updateCart = (i, field, value) => setCart((c) => c.map((row, idx) => {
    if (idx !== i) return row;
    const next = { ...row, [field]: value };
    // Never let quantity exceed what's actually in stock.
    if (field === "quantity" && Number(value) > row.available) {
      toast.error(`${row.name}: ${row.available} ${t("pharmacy.stockQty").toLowerCase()}`);
      next.quantity = row.available;
    }
    return next;
  }));
  const removeFromCart = (i) => setCart((c) => c.filter((_, idx) => idx !== i));

  const total = cart.reduce((s, c) => s + c.quantity * c.salePrice * (1 - (c.discountPercent || 0) / 100), 0);

  const checkout = async () => {
    if (!cart.length) return toast.error(t("common.error"));
    // Final guard: if stock dropped since the item was added, refuse the sale
    // rather than letting the API fail mid-transaction.
    for (const c of cart) {
      if (!c.available || Number(c.quantity) > c.available) {
        return toast.error(`${c.name}: ${t("pharmacy.outOfStock")}`);
      }
    }
    try {
      const res = await api.post("/pharmacy/sales", { patient: patient?._id, items: cart.map(({ medicine, quantity, salePrice, discountPercent }) => ({ medicine, quantity: Number(quantity), salePrice: Number(salePrice), discountPercent: Number(discountPercent) })) });
      toast.success(t("common.saved"));
      setCart([]); setPatient(null);
      loadMedicines();
      loadSales();
      if (res.data.bill?._id) setPrintBillId(res.data.bill._id);
      bumpDataVersion(CHANNELS.pharmacy, CHANNELS.billing, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      {printBillId && <BillPrintModal billId={printBillId} onClose={() => setPrintBillId(null)} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <input className="input mb-3" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filtered.map((m) => {
              const out = !m.availableQty || m.availableQty <= 0;
              return (
                <button key={m._id} onClick={() => addToCart(m)} disabled={out}
                  className={`w-full text-start py-2 flex justify-between items-center px-2 rounded ${out ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"}`}>
                  <span className="text-sm">
                    {m.name} <span className="text-slate-400">({m.availableQty})</span>
                    {out && <span className="ms-2 text-xs text-rose-600">{t("pharmacy.outOfStock")}</span>}
                  </span>
                  <Plus size={15} className={out ? "text-slate-300" : "text-brand-600"} />
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-6">{t("common.noData")}</p>}
          </div>
        </div>
        <div className="card space-y-3">
          <h3 className="font-medium text-slate-700">{t("pharmacy.sales")}</h3>
          <div className="relative">
            {patient ? (
              <div className="flex items-center justify-between bg-brand-50 rounded-lg px-3 py-2 text-sm">
                <span>{patient.name}</span>
                <button onClick={() => setPatient(null)} className="text-xs text-rose-600">{t("common.edit")}</button>
              </div>
            ) : (
              <>
                <input className="input" placeholder={t("opd.patient")} value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
                {patientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button key={p._id} className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setPatient(p); setPatientQuery(""); setPatientResults([]); }}>{p.name}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cart.map((c, i) => (
              <div key={c.medicine} className="border border-slate-100 rounded-lg p-2 text-sm space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{c.name}</span>
                  <button onClick={() => removeFromCart(i)}><Trash2 size={14} className="text-rose-500" /></button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <input type="number" min={1} max={c.available} className="input !py-1 text-xs" value={c.quantity} onChange={(e) => updateCart(i, "quantity", e.target.value)} />
                  <input type="number" className="input !py-1 text-xs" value={c.salePrice} onChange={(e) => updateCart(i, "salePrice", e.target.value)} />
                  <input type="number" className="input !py-1 text-xs" placeholder="%" value={c.discountPercent} onChange={(e) => updateCart(i, "discountPercent", e.target.value)} />
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{t("common.noData")}</p>}
          </div>
          <div className="flex justify-between font-semibold border-t border-slate-100 pt-3">
            <span>{t("common.total")}</span><span>{total.toLocaleString()}</span>
          </div>
          <button className="btn-primary w-full" onClick={checkout}>{t("common.save")}</button>
        </div>
      </div>

      {/* Sold-bills history — every completed pharmacy sale, newest first. */}
      <div className="table-wrap card !p-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-medium text-slate-700">{t("pharmacy.sales")}</h3>
        </div>
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("opd.patient")}</th><th>{t("pharmacy.items")}</th><th>{t("common.total")}</th><th>{t("pharmacy.paid")}</th><th>{t("common.date")}</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s._id}>
                <td className="font-mono text-xs">{s.saleNumber}</td>
                <td>{s.patient?.name || "—"}</td>
                <td>{s.items?.length || 0}</td>
                <td>{s.grandTotal?.toLocaleString()}</td>
                <td>{t("billing.cash")}</td>
                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("pharmacy.noSales")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SaleReturnTab() {
  const { t } = useTranslation();
  const [mode, setMode] = useState("fromSale"); // "fromSale" | "manual"
  const [medicines, setMedicines] = useState([]);
  const [saleQuery, setSaleQuery] = useState("");
  const [saleResults, setSaleResults] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [rows, setRows] = useState([]);
  const [refundMethod, setRefundMethod] = useState("cash");
  const [returns, setReturns] = useState([]);
  const [printReturn, setPrintReturn] = useState(null);

  const loadReturns = () => api.get("/pharmacy/sale-returns").then((r) => setReturns(r.data));
  useEffect(() => { api.get("/pharmacy/medicines").then((r) => setMedicines(r.data)); loadReturns(); }, []);

  useEffect(() => {
    if (!saleQuery) return setSaleResults([]);
    const tm = setTimeout(() => api.get("/pharmacy/sales", { params: { q: saleQuery } }).then((r) => setSaleResults(r.data.slice(0, 8))), 300);
    return () => clearTimeout(tm);
  }, [saleQuery]);

  const pickSale = (sale) => {
    setSelectedSale(sale);
    setSaleQuery(""); setSaleResults([]);
    setRows(sale.items.map((it) => ({
      medicine: it.medicineId, name: it.medicine?.name || t("pharmacy.productName"), batchId: it.batchId || "",
      maxQty: it.quantity, quantity: 0, salePrice: it.salePrice,
    })));
  };

  const clearSale = () => { setSelectedSale(null); setRows([]); };

  const updateRow = (i, field, val) => setRows((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  const addManualRow = () => setRows((p) => [...p, { medicine: "", name: "", batchId: "", maxQty: null, quantity: 1, salePrice: 0 }]);
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const switchMode = (m) => { setMode(m); setSelectedSale(null); setRows(m === "manual" ? [{ medicine: "", name: "", batchId: "", maxQty: null, quantity: 1, salePrice: 0 }] : []); };

  const totalRefund = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.salePrice) || 0), 0);

  const submit = async () => {
    const items = rows.filter((r) => r.medicine && Number(r.quantity) > 0).map((r) => ({ medicine: r.medicine, batchId: r.batchId || undefined, quantity: Number(r.quantity), salePrice: Number(r.salePrice) }));
    if (!items.length) return toast.error(t("common.required_field"));
    try {
      const res = await api.post("/pharmacy/sale-returns", { sale: selectedSale?._id, patient: selectedSale?.patientId, items, refundMethod });
      toast.success(`${t("common.saved")}: ${res.data.returnNumber}`);
      setPrintReturn(res.data);
      clearSale(); setRows(mode === "manual" ? [{ medicine: "", name: "", batchId: "", maxQty: null, quantity: 1, salePrice: 0 }] : []);
      api.get("/pharmacy/medicines").then((r) => setMedicines(r.data));
      loadReturns();
      bumpDataVersion(CHANNELS.pharmacy, CHANNELS.billing, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      {printReturn && <SaleReturnReceiptModal returnData={printReturn} onClose={() => setPrintReturn(null)} />}
      <div className="card space-y-3">
        <div className="flex gap-2 text-sm">
          <button className={`px-3 py-1.5 rounded-lg border ${mode === "fromSale" ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600"}`} onClick={() => switchMode("fromSale")}>{t("pharmacy.fromPastSale")}</button>
          <button className={`px-3 py-1.5 rounded-lg border ${mode === "manual" ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600"}`} onClick={() => switchMode("manual")}>{t("pharmacy.manualReturn")}</button>
        </div>

        {mode === "fromSale" && (
          <div className="relative">
            {selectedSale ? (
              <div className="flex items-center justify-between bg-brand-50 rounded-lg px-3 py-2 text-sm">
                <span>{t("pharmacy.sales")} <span className="font-mono">{selectedSale.saleNumber}</span> — {selectedSale.patient?.name || "—"}</span>
                <button onClick={clearSale} className="text-xs text-rose-600">{t("common.edit")}</button>
              </div>
            ) : (
              <>
                <input className="input" placeholder={t("common.search")} value={saleQuery} onChange={(e) => setSaleQuery(e.target.value)} />
                {saleResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {saleResults.map((s) => (
                      <button key={s._id} className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50 flex justify-between" onClick={() => pickSale(s)}>
                        <span className="font-mono text-xs">{s.saleNumber}</span>
                        <span>{s.patient?.name || "—"}</span>
                        <span className="text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              {mode === "manual" ? (
                <label className="sm:col-span-2">
                  <span className="label !mb-1 text-xs">{t("pharmacy.productName")}</span>
                  <select className="input" value={row.medicine} onChange={(e) => {
                    const med = medicines.find((m) => m._id === e.target.value);
                    updateRow(i, "medicine", e.target.value);
                    updateRow(i, "salePrice", med?.batches?.[0]?.salePrice || 0);
                  }}>
                    <option value="">{t("pharmacy.selectMedicine")}</option>
                    {medicines.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </label>
              ) : (
                <label className="sm:col-span-2">
                  <span className="label !mb-1 text-xs">{t("pharmacy.productName")}</span>
                  <input className="input bg-slate-50" disabled value={`${row.name} (${row.maxQty})`} />
                </label>
              )}
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.returnQty")}</span>
                <input type="number" min={0} max={row.maxQty || undefined} className="input" value={row.quantity} onChange={(e) => updateRow(i, "quantity", e.target.value)} />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.salePriceSet")}</span>
                <input type="number" className="input" value={row.salePrice} onChange={(e) => updateRow(i, "salePrice", e.target.value)} />
              </label>
              {mode === "manual" && (
                <button onClick={() => removeRow(i)}><Trash2 size={16} className="text-rose-500" /></button>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{t("common.noData")}</p>}
        </div>

        <div className="flex justify-between items-center">
          {mode === "manual" ? (
            <button className="btn-secondary !py-1 !px-2 text-xs" onClick={addManualRow}><Plus size={14} /> {t("common.add")}</button>
          ) : <span />}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="label !mb-0">{t("pharmacy.refundMethod")}</span>
              <select className="input !w-auto" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                <option value="cash">{t("billing.cash")}</option>
                <option value="card">{t("billing.card")}</option>
                <option value="credit_note">{t("patients.other")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex justify-between font-semibold border-t border-slate-100 pt-3">
          <span>{t("pharmacy.totalRefund")}</span><span>{totalRefund.toLocaleString()}</span>
        </div>
        <button className="btn-primary w-full" onClick={submit}>{t("common.save")}</button>
      </div>

      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("billing.invoiceNo")}</th><th>{t("opd.patient")}</th><th>{t("common.name")}</th><th>{t("common.amount")}</th><th>{t("common.date")}</th></tr></thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r._id}>
                <td className="font-mono text-xs">{r.returnNumber}</td>
                <td className="font-mono text-xs">{r.sale?.saleNumber || "—"}</td>
                <td>{r.patient?.name || "—"}</td>
                <td>{r.items.length}</td>
                <td>{r.totalAmount?.toLocaleString()}</td>
                <td>{new Date(r.returnDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {returns.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("pharmacy.noReturns")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseTab() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState([{ medicine: "", batchNumber: "", quantity: 1, purchasePrice: 0, salePrice: 0, taxPercent: 0, expiryDate: "" }]);
  const [purchases, setPurchases] = useState([]);

  const load = () => api.get("/pharmacy/purchases").then((r) => setPurchases(r.data));
  useEffect(() => {
    api.get("/pharmacy/suppliers").then((r) => setSuppliers(r.data.suppliers));
    api.get("/pharmacy/medicines").then((r) => setMedicines(r.data));
    load();
  }, []);

  const updateItem = (i, field, val) => setItems((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  const addRow = () => setItems((p) => [...p, { medicine: "", batchNumber: "", quantity: 1, purchasePrice: 0, salePrice: 0, taxPercent: 0, expiryDate: "" }]);
  const removeRow = (i) => setItems((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!supplier) return toast.error(t("common.required_field"));
    try {
      const res = await api.post("/pharmacy/purchases", {
        supplier,
        items: items.filter((i) => i.medicine).map((i) => ({ ...i, quantity: Number(i.quantity), purchasePrice: Number(i.purchasePrice), salePrice: Number(i.salePrice), taxPercent: Number(i.taxPercent) })),
      });
      toast.success(`${t("common.saved")}: ${res.data.purchaseNumber}`);
      setItems([{ medicine: "", batchNumber: "", quantity: 1, purchasePrice: 0, salePrice: 0, taxPercent: 0, expiryDate: "" }]);
      load();
      bumpDataVersion(CHANNELS.pharmacy, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <Field label={`${t("inventory.supplier")} *`}>
          <select className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">{t("pharmacy.selectSupplier")}</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="space-y-2">
          {items.map((row, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-8 gap-2 items-end">
              <label className="sm:col-span-2">
                <span className="label !mb-1 text-xs">{t("pharmacy.productName")}</span>
                <select className="input" value={row.medicine} onChange={(e) => updateItem(i, "medicine", e.target.value)}>
                  <option value="">{t("pharmacy.selectMedicine")}</option>
                  {medicines.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.batchNumber")}</span>
                <input className="input" value={row.batchNumber} onChange={(e) => updateItem(i, "batchNumber", e.target.value)} dir="ltr" />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("common.quantity")}</span>
                <input type="number" className="input" value={row.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.purchasePrice")}</span>
                <input type="number" className="input" value={row.purchasePrice} onChange={(e) => updateItem(i, "purchasePrice", e.target.value)} />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.salePriceSet")}</span>
                <input type="number" className="input" value={row.salePrice} onChange={(e) => updateItem(i, "salePrice", e.target.value)} />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("billing.tax")} %</span>
                <input type="number" className="input" value={row.taxPercent} onChange={(e) => updateItem(i, "taxPercent", e.target.value)} />
              </label>
              <div className="flex gap-1 items-end">
                <label className="flex-1">
                  <span className="label !mb-1 text-xs">{t("pharmacy.expiryDate")}</span>
                  <input type="date" className="input" value={row.expiryDate} onChange={(e) => updateItem(i, "expiryDate", e.target.value)} />
                </label>
                <button onClick={() => removeRow(i)}><Trash2 size={16} className="text-rose-500" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={addRow}><Plus size={14} /> {t("common.add")}</button>
          <button className="btn-primary" onClick={submit}>{t("common.save")}</button>
        </div>
      </div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("inventory.supplier")}</th><th>{t("common.name")}</th><th>{t("common.total")}</th><th>{t("common.date")}</th></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p._id}>
                <td className="font-mono text-xs">{p.purchaseNumber}</td>
                <td>{p.supplier?.name}</td>
                <td>{p.items.length}</td>
                <td>{p.grandTotal?.toLocaleString()}</td>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">{t("pharmacy.noPurchases")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseReturnTab() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [purchase, setPurchase] = useState("");
  const [items, setItems] = useState([{ medicine: "", batchNumber: "", returnQty: 1, purchasePrice: 0, taxPercent: 0 }]);
  const [returns, setReturns] = useState([]);

  const loadReturns = () => api.get("/pharmacy/purchase-returns").then((r) => setReturns(r.data));
  useEffect(() => {
    api.get("/pharmacy/suppliers").then((r) => setSuppliers(r.data.suppliers));
    api.get("/pharmacy/medicines").then((r) => setMedicines(r.data));
    api.get("/pharmacy/purchases").then((r) => setPurchases(r.data));
    loadReturns();
  }, []);

  const supplierPurchases = purchases.filter((p) => !supplier || p.supplier?.id === supplier || p.supplier?._id === supplier);

  const updateItem = (i, field, val) => setItems((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  const addRow = () => setItems((p) => [...p, { medicine: "", batchNumber: "", returnQty: 1, purchasePrice: 0, taxPercent: 0 }]);
  const removeRow = (i) => setItems((p) => p.filter((_, idx) => idx !== i));

  const pickPurchase = (id) => {
    setPurchase(id);
    const p = purchases.find((x) => x._id === id);
    if (p) {
      setSupplier(p.supplier?.id || p.supplier?._id || "");
      setItems(p.items.map((it) => ({ medicine: it.medicineId, batchNumber: it.batchNumber || "", returnQty: 0, purchasePrice: it.purchasePrice, taxPercent: it.taxPercent || 0 })));
    }
  };

  const totalReturn = items.reduce((s, it) => {
    const base = (Number(it.returnQty) || 0) * (Number(it.purchasePrice) || 0);
    return s + base + (base * (Number(it.taxPercent) || 0)) / 100;
  }, 0);

  const submit = async () => {
    if (!supplier) return toast.error(t("common.required_field"));
    const payloadItems = items.filter((i) => i.medicine && Number(i.returnQty) > 0).map((i) => ({ ...i, returnQty: Number(i.returnQty), purchasePrice: Number(i.purchasePrice), taxPercent: Number(i.taxPercent) }));
    if (!payloadItems.length) return toast.error(t("common.required_field"));
    try {
      const res = await api.post("/pharmacy/purchase-returns", { purchase: purchase || undefined, supplier, items: payloadItems });
      toast.success(`${t("common.saved")}: ${res.data.returnNumber}`);
      setPurchase(""); setItems([{ medicine: "", batchNumber: "", returnQty: 1, purchasePrice: 0, taxPercent: 0 }]);
      api.get("/pharmacy/medicines").then((r) => setMedicines(r.data));
      loadReturns();
      bumpDataVersion(CHANNELS.pharmacy, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={`${t("inventory.supplier")} *`}>
            <select className="input" value={supplier} onChange={(e) => { setSupplier(e.target.value); setPurchase(""); }}>
              <option value="">{t("pharmacy.selectSupplier")}</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t("pharmacy.purchases")}>
            <select className="input" value={purchase} onChange={(e) => pickPurchase(e.target.value)}>
              <option value="">—</option>
              {supplierPurchases.map((p) => <option key={p._id} value={p._id}>{p.purchaseNumber} — {p.grandTotal?.toLocaleString()}</option>)}
            </select>
          </Field>
        </div>
        <div className="space-y-2">
          {items.map((row, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
              <label className="sm:col-span-2">
                <span className="label !mb-1 text-xs">{t("pharmacy.productName")}</span>
                <select className="input" value={row.medicine} onChange={(e) => updateItem(i, "medicine", e.target.value)}>
                  <option value="">{t("pharmacy.selectMedicine")}</option>
                  {medicines.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.batchNumber")}</span>
                <input className="input" value={row.batchNumber} onChange={(e) => updateItem(i, "batchNumber", e.target.value)} dir="ltr" />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.returnQty")}</span>
                <input type="number" className="input" value={row.returnQty} onChange={(e) => updateItem(i, "returnQty", e.target.value)} />
              </label>
              <label>
                <span className="label !mb-1 text-xs">{t("pharmacy.purchasePrice")}</span>
                <input type="number" className="input" value={row.purchasePrice} onChange={(e) => updateItem(i, "purchasePrice", e.target.value)} />
              </label>
              <div className="flex gap-1 items-end">
                <label className="flex-1">
                  <span className="label !mb-1 text-xs">{t("billing.tax")} %</span>
                  <input type="number" className="input" value={row.taxPercent} onChange={(e) => updateItem(i, "taxPercent", e.target.value)} />
                </label>
                <button onClick={() => removeRow(i)}><Trash2 size={16} className="text-rose-500" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={addRow}><Plus size={14} /> {t("common.add")}</button>
          <span className="text-sm text-slate-500">{t("common.notes")}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-slate-100 pt-3">
          <span>{t("pharmacy.totalRefund")}</span><span>{totalReturn.toLocaleString()}</span>
        </div>
        <button className="btn-primary w-full" onClick={submit}>{t("common.save")}</button>
      </div>

      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("inventory.supplier")}</th><th>{t("billing.invoiceNo")}</th><th>{t("common.name")}</th><th>{t("common.total")}</th><th>{t("common.date")}</th></tr></thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r._id}>
                <td className="font-mono text-xs">{r.returnNumber}</td>
                <td>{r.supplier?.name || "—"}</td>
                <td className="font-mono text-xs">{r.purchase?.purchaseNumber || "—"}</td>
                <td>{r.items.length}</td>
                <td>{r.totalAmount?.toLocaleString()}</td>
                <td>{new Date(r.returnDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {returns.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("pharmacy.noReturns")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuppliersTab() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", contactPersonName: "", contactPersonPhone: "", drugLicenseNumber: "", address: "" });

  const load = () => api.get("/pharmacy/suppliers").then((r) => { setSuppliers(r.data.suppliers); setGrandTotal(r.data.grandTotalNetBalance); });
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/pharmacy/suppliers", form);
    toast.success(t("common.saved"));
    setShowModal(false);
    setForm({ name: "", contact: "", contactPersonName: "", contactPersonPhone: "", drugLicenseNumber: "", address: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("pharmacy.suppliers")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("inventory.supplier")}</th><th>{t("common.phone")}</th><th>{t("patients.guardianName")}</th><th>{t("billing.invoiceNo")}</th><th>{t("common.total")}</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s._id}>
                <td className="font-medium">{s.name}</td>
                <td dir="ltr">{s.contact || "—"}</td>
                <td>{s.contactPersonName || "—"} {s.contactPersonPhone && `(${s.contactPersonPhone})`}</td>
                <td dir="ltr">{s.drugLicenseNumber || "—"}</td>
                <td className={s.netBalance > 0 ? "text-rose-600 font-medium" : ""}>{s.netBalance?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-semibold border-t border-slate-200"><td colSpan={4} className="text-end px-4 py-2">{t("common.total")}</td><td className="px-4 py-2">{grandTotal?.toLocaleString()}</td></tr></tfoot>
        </table>
      </div>
      {showModal && (
        <Modal title={t("pharmacy.suppliers")} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-3">
            <Field label={`${t("pharmacy.supplierName")} *`}><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label={t("common.phone")}><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} dir="ltr" /></Field>
            <Field label={t("patients.guardianName")}><input className="input" value={form.contactPersonName} onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })} /></Field>
            <Field label={t("common.phone")}><input className="input" value={form.contactPersonPhone} onChange={(e) => setForm({ ...form, contactPersonPhone: e.target.value })} dir="ltr" /></Field>
            <Field label={t("billing.invoiceNo")}><input className="input" value={form.drugLicenseNumber} onChange={(e) => setForm({ ...form, drugLicenseNumber: e.target.value })} dir="ltr" /></Field>
            <Field label={t("common.address")}><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);
const Field = ({ label, children }) => (<div><label className="label">{label}</label>{children}</div>);

// Return receipt modal — shown immediately after a sale return is saved so the
// patient can collect their refund. Auto-triggers window.print() on mount.
function SaleReturnReceiptModal({ returnData, onClose }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({ currency: "AFN" });
  const printedRef = useRef(false);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data || { currency: "AFN" }));
  }, []);

  useEffect(() => {
    if (!returnData || printedRef.current) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => triggerPrint({ delay: 200 }), 300);
    return () => window.clearTimeout(timer);
  }, [returnData]);

  if (!returnData) return null;

  const totalRefund = returnData.totalAmount || returnData.items?.reduce((s, it) => s + (it.quantity * it.salePrice), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold">{t("pharmacy.returns")} — {returnData.returnNumber}</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => triggerPrint({ delay: 200 })} className="text-slate-400 hover:text-slate-600" title={t("common.print")}><Printer size={18} /></button>
            <button onClick={onClose}><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 space-y-3 text-sm text-slate-600">
          <p><span className="text-slate-400">{t("opd.patient")}:</span> {returnData.patient?.name || "—"}</p>
          <p><span className="text-slate-400">{t("common.date")}:</span> {new Date(returnData.returnDate || returnData.createdAt).toLocaleString()}</p>
          <p><span className="text-slate-400">{t("pharmacy.refundMethod")}:</span> {returnData.refundMethod || "—"}</p>
        </div>
        <section className="print-area">
          <div className="print-header">
            {settings.logoUrl && <img src={settings.logoUrl} alt="" className="print-logo" />}
            <h1>{settings.clinicName || "Clinic"}</h1>
            <p>{[settings.address, settings.phone, settings.email].filter(Boolean).join(" | ")}</p>
            {settings.printHeader && <p>{settings.printHeader}</p>}
          </div>
          <div className="print-title">{t("pharmacy.returns")} — {t("billing.title")}</div>
          <div className="print-grid">
            <div><strong>{t("billing.invoiceNo")}:</strong> {returnData.returnNumber}</div>
            <div><strong>{t("common.date")}:</strong> {new Date(returnData.returnDate || returnData.createdAt).toLocaleString()}</div>
            <div><strong>{t("opd.patient")}:</strong> {returnData.patient?.name || "-"}</div>
            <div><strong>{t("patients.patientId")}:</strong> {returnData.patient?.patientId || "-"}</div>
            <div><strong>{t("common.phone")}:</strong> {returnData.patient?.phone || "-"}</div>
            <div><strong>{t("pharmacy.refundMethod")}:</strong> {returnData.refundMethod || "cash"}</div>
            {returnData.sale?.saleNumber && <div><strong>{t("pharmacy.sales")}:</strong> {returnData.sale.saleNumber}</div>}
          </div>
          <table className="print-table">
            <thead><tr><th>#</th><th>{t("pharmacy.productName")}</th><th>{t("common.quantity")}</th><th>{t("common.price")}</th><th>{t("common.total")}</th></tr></thead>
            <tbody>
              {(returnData.items || []).map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.medicine?.name || it.medicineName || "—"}</td>
                  <td>{it.quantity}</td>
                  <td>{it.salePrice?.toLocaleString()} {settings.currency}</td>
                  <td>{(it.quantity * it.salePrice)?.toLocaleString()} {settings.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="print-totals">
            <div><span>{t("pharmacy.totalRefund")}</span><strong>{totalRefund.toLocaleString()} {settings.currency}</strong></div>
          </div>
          <p className="print-words"><strong>{t("opd.amountInWords")}:</strong> {amountInWords(totalRefund, settings.currency)}</p>
          <div className="print-section" style={{ textAlign: "center", marginTop: "12px" }}>
            {t("pharmacy.returns")} — {t("opd.cashierSignature")}
          </div>
          {settings.printFooter && <div className="print-footer">{settings.printFooter}</div>}
        </section>
      </div>
    </div>
  );
}

