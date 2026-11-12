import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { X, Printer, Plus, Trash2, Ban, Search as SearchIcon } from "lucide-react";
import api from "../api/axios.js";
import { StatusBadge } from "./PatientDetail.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/permissions.js";
import { amountInWords } from "../utils/numberToWords.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";
import { triggerPrint } from "../utils/print.js";

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "billing.cash" },
  { value: "card", labelKey: "billing.card" },
  { value: "bank_transfer", labelKey: "billing.transfer" },
  { value: "mobile_wallet", labelKey: "billing.card" },
  { value: "insurance", labelKey: "billing.insurance" },
  { value: "other", labelKey: "patients.other" },
];

const CATEGORY_OPTIONS = ["opd", "pharmacy", "lab", "radiology", "optical", "operation", "other"];

export default function Billing() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [paymentDoctor, setPaymentDoctor] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [settings, setSettings] = useState({ currency: "AFN" });
  const [newBillOpen, setNewBillOpen] = useState(false);
  const printedBillRef = useRef("");
  const { user } = useAuth();
  const admin = isAdmin(user);

  const load = () => api.get("/billing", { params: { status: filter || undefined, limit: 50 } }).then((r) => setBills(r.data.bills));

  useEffect(() => {
    load();
    api.get("/settings").then((r) => setSettings(r.data));
    api.get("/hr/staff", { params: { role: "doctor" } }).then((r) => setDoctors(r.data || [])).catch(() => setDoctors([]));
    /* eslint-disable-next-line */
  }, [filter]);

  useEffect(() => {
    const id = params.get("id");
    if (id) api.get(`/billing/${id}`).then((r) => setSelected(r.data));
  }, [params]);

  useEffect(() => {
    if (!selected || params.get("print") !== "1" || printedBillRef.current === selected._id) return;
    printedBillRef.current = selected._id;
    const timer = window.setTimeout(() => triggerPrint({ delay: 200 }), 300);
    return () => window.clearTimeout(timer);
  }, [params, selected]);

  const openBill = async (id) => {
    const r = await api.get(`/billing/${id}`);
    setSelected(r.data);
    setParams({ id });
  };

  const closeBill = () => { setSelected(null); setParams({}); setPayAmount(""); setPaymentDoctor(""); };

  const selectedNeedsDoctor = selected?.items?.some((item) => item.category === "opd") && !selected?.opdVisit;

  const recordPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return toast.error(t("common.required_field"));
    if (selectedNeedsDoctor && !paymentDoctor) return toast.error(t("opd.selectDoctor"));
    try {
      const r = await api.post(`/billing/${selected._id}/pay`, { amount: Number(payAmount), doctor: paymentDoctor || undefined });
      setSelected(r.data);
      setPayAmount("");
      setPaymentDoctor("");
      toast.success(t("common.saved"));
      load();
      bumpDataVersion(CHANNELS.billing, CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    }
  };

  const cancelBill = async () => {
    if (!confirm(t("billing.confirmVoid"))) return;
    try {
      const r = await api.post(`/billing/${selected._id}/cancel`);
      setSelected(r.data);
      toast.success(t("common.updated"));
      load();
      // Cancelling cascades to lab/pharmacy/opd, so bump all those channels.
      bumpDataVersion(CHANNELS.billing, CHANNELS.pharmacy, CHANNELS.lab, CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-800">{t("billing.title")}</h1>
        <div className="flex items-center gap-2">
          <select className="input w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t("common.all")}</option>
            <option value="unpaid">{t("billing.unpaid")}</option>
            <option value="partially_paid">{t("billing.partial")}</option>
            <option value="paid">{t("billing.paid")}</option>
            <option value="cancelled">{t("billing.cancelled")}</option>
          </select>
          <button className="btn-primary" onClick={() => setNewBillOpen(true)}>
            <Plus size={16} /> {t("billing.newInvoice")}
          </button>
        </div>
      </div>

      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("billing.patient")}</th><th>{t("common.date")}</th><th>{t("common.total")}</th><th>{t("billing.paid")}</th><th>{t("billing.amount")}</th><th>{t("common.status")}</th></tr></thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b._id} className="cursor-pointer" onClick={() => openBill(b._id)}>
                <td className="font-mono text-xs text-brand-700">{b.invoiceNumber}</td>
                <td className="font-medium">{b.patient?.name || "—"}</td>
                <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                <td>{b.grandTotal?.toLocaleString()}</td>
                <td>{b.amountPaid?.toLocaleString()}</td>
                <td className={b.balanceDue > 0 ? "text-rose-600 font-medium" : ""}>{b.balanceDue?.toLocaleString()}</td>
                <td><StatusBadge status={b.status} /></td>
              </tr>
            ))}
            {bills.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">{t("billing.noBills")}</td></tr>}
          </tbody>
        </table>
      </div>

      {newBillOpen && (
        <NewBillModal
          currency={settings.currency}
          onClose={() => setNewBillOpen(false)}
          onCreated={(bill) => {
            setNewBillOpen(false);
            load();
            setParams({ id: bill._id });
          }}
        />
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold">{selected.invoiceNumber}</h2>
              <div className="flex items-center gap-3">
                {admin && selected.status !== "cancelled" && (
                  <button onClick={cancelBill} className="text-slate-400 hover:text-rose-600" title={t("billing.void")}><Ban size={18} /></button>
                )}
                <button onClick={() => triggerPrint({ delay: 200 })} className="text-slate-400 hover:text-slate-600" title={t("common.print")}><Printer size={18} /></button>
                <button onClick={closeBill}><X size={20} /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600 flex items-center justify-between">
                <div>
                  <p><span className="text-slate-400">{t("billing.patient")}:</span> {selected.patient?.name || "—"}</p>
                  <p><span className="text-slate-400">{t("common.date")}:</span> {new Date(selected.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              <table className="data-table w-full">
                <thead><tr><th>{t("common.name")}</th><th>{t("common.quantity")}</th><th>{t("common.price")}</th><th>{t("common.total")}</th></tr></thead>
                <tbody>
                  {(selected.items || []).map((it, i) => (
                    <tr key={i}><td>{it.description}</td><td>{it.quantity}</td><td>{it.unitPrice}</td><td>{it.total?.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
              {selected.opdVisit && (
                <div className="text-sm bg-slate-50 rounded-lg p-3 space-y-1">
                  <div className="font-medium text-slate-700">{t("opd.title")}</div>
                  <div><span className="text-slate-400">{t("billing.invoiceNo")}:</span> {selected.opdVisit.visitNumber}</div>
                  <div><span className="text-slate-400">{t("opd.doctor")}:</span> {selected.opdVisit.doctor?.name || "-"}</div>
                  <div><span className="text-slate-400">{t("common.date")}:</span> {new Date(selected.opdVisit.visitDate).toLocaleString()}</div>
                </div>
              )}
              {(selected.labOrders || []).length > 0 && (
                <div className="text-sm bg-slate-50 rounded-lg p-3 space-y-1">
                  <div className="font-medium text-slate-700">{t("lab.tests")}</div>
                  {selected.labOrders.map((order) => (
                    <div key={order._id || order.id}>
                      <span className="text-slate-400">{order.orderNumber}:</span> {order.items?.map((item) => item.name).join(", ")}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-sm space-y-1 border-t border-slate-100 pt-3">
                <div className="flex justify-between"><span className="text-slate-400">{t("billing.subtotal")}</span><span>{selected.subTotal?.toLocaleString()} {settings.currency}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t("billing.discount")}</span><span>-{selected.discountTotal?.toLocaleString()} {settings.currency}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t("billing.tax")}</span><span>{selected.taxTotal?.toLocaleString()} {settings.currency}</span></div>
                <div className="flex justify-between font-semibold text-base"><span>{t("common.total")}</span><span>{selected.grandTotal?.toLocaleString()} {settings.currency}</span></div>
                <div className="flex justify-between text-emerald-600"><span>{t("billing.paid")}</span><span>{selected.amountPaid?.toLocaleString()} {settings.currency}</span></div>
                <div className="flex justify-between text-rose-600 font-medium"><span>{t("billing.amount")}</span><span>{selected.balanceDue?.toLocaleString()} {settings.currency}</span></div>
              </div>
              {selected.status !== "paid" && selected.status !== "cancelled" && (
                <div className="space-y-2 pt-2">
                  {selectedNeedsDoctor && (
                    <select className="input" value={paymentDoctor} onChange={(e) => setPaymentDoctor(e.target.value)}>
                      <option value="">{t("opd.selectDoctor")}</option>
                      {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <input type="number" className="input" placeholder={t("billing.amountPaid")} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    <button className="btn-primary whitespace-nowrap" onClick={recordPayment}>{t("billing.recordPayment")}</button>
                  </div>
                </div>
              )}
            </div>
            <section className="print-area">
              <div className="print-header">
                {settings.logoUrl && <img src={settings.logoUrl} alt="" className="print-logo" />}
                <h1>{settings.clinicName || "Clinic"}</h1>
                <p>{settings.tagline || t("app.name")}</p>
                <p>{[settings.address, settings.phone, settings.email].filter(Boolean).join(" | ")}</p>
                {settings.printHeader && <p>{settings.printHeader}</p>}
              </div>
              <div className="print-title-row">
                <div className="print-title">{t("billing.title")}</div>
                <div className={`print-stamp print-stamp-${selected.status}`}>{selected.status?.replace("_", " ")}</div>
              </div>
              <div className="print-grid">
                <div><strong>{t("billing.invoiceNo")}:</strong> {selected.invoiceNumber}</div>
                <div><strong>{t("common.date")}:</strong> {new Date(selected.createdAt).toLocaleString()}</div>
                <div><strong>{t("billing.patient")}:</strong> {selected.patient?.name || "-"}</div>
                <div><strong>{t("patients.patientId")}:</strong> {selected.patient?.patientId || "-"}</div>
                <div><strong>{t("common.phone")}:</strong> {selected.patient?.phone || "-"}</div>
                <div><strong>{t("patients.gender")}:</strong> {selected.patient?.gender || "-"}</div>
                <div><strong>{t("patients.age")}:</strong> {selected.patient?.age || "-"}</div>
                <div><strong>{t("common.address")}:</strong> {selected.patient?.address || "-"}</div>
                <div><strong>{t("billing.paymentMethod")}:</strong> {(selected.paymentMethod || "cash").replace("_", " ")}</div>
                {selected.opdVisit && <div><strong>{t("opd.doctor")}:</strong> {selected.opdVisit.doctor?.name || "-"}</div>}
                {selected.opdVisit && <div><strong>{t("opd.visitDate")}:</strong> {new Date(selected.opdVisit.visitDate).toLocaleString()}</div>}
              </div>
              <table className="print-table">
                <thead><tr><th>#</th><th>{t("common.name")}</th><th>{t("common.quantity")}</th><th>{t("common.price")}</th><th>{t("common.total")}</th></tr></thead>
                <tbody>
                  {(selected.items || []).map((it, i) => (
                    <tr key={`${it.description}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{it.description}</td>
                      <td>{it.quantity}</td>
                      <td>{it.unitPrice?.toLocaleString()} {settings.currency}</td>
                      <td>{it.total?.toLocaleString()} {settings.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected.opdVisit && (
                <div className="print-section">
                  <strong>{t("opd.title")}:</strong> {selected.opdVisit.visitNumber} | {t("opd.doctor")}: {selected.opdVisit.doctor?.name || "-"} | {t("common.status")}: {selected.opdVisit.status?.replace("_", " ") || "-"}
                </div>
              )}
              {(selected.labOrders || []).length > 0 && (
                <div className="print-section">
                  <strong>{t("lab.tests")}:</strong>
                  <ul>
                    {selected.labOrders.map((order) => (
                      <li key={order._id || order.id}>{order.orderNumber}: {order.items?.map((item) => item.name).join(", ")}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="print-totals">
                <div><span>{t("billing.subtotal")}</span><strong>{selected.subTotal?.toLocaleString()} {settings.currency}</strong></div>
                <div><span>{t("billing.discount")}</span><strong>{selected.discountTotal?.toLocaleString()} {settings.currency}</strong></div>
                <div><span>{t("billing.tax")}</span><strong>{selected.taxTotal?.toLocaleString()} {settings.currency}</strong></div>
                <div><span>{t("common.total")}</span><strong>{selected.grandTotal?.toLocaleString()} {settings.currency}</strong></div>
                <div><span>{t("billing.paid")}</span><strong>{selected.amountPaid?.toLocaleString()} {settings.currency}</strong></div>
                <div><span>{t("billing.amount")}</span><strong>{selected.balanceDue?.toLocaleString()} {settings.currency}</strong></div>
              </div>
              <p className="print-words"><strong>{t("opd.amountInWords")}:</strong> {amountInWords(selected.grandTotal, settings.currency)}</p>
              {selected.notes && <div className="print-section"><strong>{t("common.notes")}:</strong> {selected.notes}</div>}
              <div className="print-signature">{t("opd.cashierSignature")}</div>
              {settings.printFooter && <div className="print-footer">{settings.printFooter}</div>}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function NewBillModal({ currency, onClose, onCreated }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState(null);
  const [charges, setCharges] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctor, setDoctor] = useState("");
  const [chargeToAdd, setChargeToAdd] = useState("");
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/charges").then((r) => setCharges(r.data)).catch(() => {});
    api.get("/hr/staff", { params: { role: "doctor" } }).then((r) => setDoctors(r.data || [])).catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!query.trim() || patient) { setResults([]); return; }
    setSearching(true);
    const tm = setTimeout(() => {
      api.get("/patients", { params: { q: query, limit: 6 } })
        .then((r) => setResults(r.data.patients))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(tm);
  }, [query, patient]);

  const addFromCharge = () => {
    const c = charges.find((x) => x._id === chargeToAdd);
    if (!c) return;
    setItems([...items, { description: c.name, category: c.category, quantity: 1, unitPrice: c.standardCharge, discountPercent: 0, taxPercent: c.taxPercent || 0 }]);
    setChargeToAdd("");
  };
  const addCustomItem = () => setItems([...items, { description: "", category: "other", quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 0 }]);
  const updateItem = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const hasOpdItem = items.some((it) => it.category === "opd");

  const totals = items.reduce(
    (acc, it) => {
      const lineBase = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      const discount = (lineBase * (Number(it.discountPercent) || 0)) / 100;
      const taxable = lineBase - discount;
      const tax = (taxable * (Number(it.taxPercent) || 0)) / 100;
      acc.subTotal += lineBase;
      acc.discountTotal += discount;
      acc.taxTotal += tax;
      acc.grandTotal += taxable + tax;
      return acc;
    },
    { subTotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 }
  );

  const submit = async () => {
    if (!patient) return toast.error(t("common.required_field"));
    if (!items.length) return toast.error(t("common.required_field"));
    if (items.some((it) => !it.description?.trim() || Number(it.unitPrice) <= 0)) {
      return toast.error(t("common.required_field"));
    }
    if (hasOpdItem && !doctor) return toast.error(t("opd.selectDoctor"));
    setSaving(true);
    try {
      const res = await api.post("/billing", {
        patient: patient._id,
        doctor: hasOpdItem ? doctor : undefined,
        items: items.map((it) => ({
          description: it.description.trim(),
          category: it.category,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discountPercent: Number(it.discountPercent) || 0,
          taxPercent: Number(it.taxPercent) || 0,
        })),
        paymentMethod,
        amountPaid: Number(amountPaid) || 0,
        notes: notes || undefined,
      });
      toast.success(`${t("common.saved")}: ${res.data.invoiceNumber}`);
      onCreated(res.data);
      bumpDataVersion(CHANNELS.billing, CHANNELS.opd, CHANNELS.lab, CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold">{t("billing.newInvoice")}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="label">{t("billing.patient")}</label>
            {patient ? (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-slate-700">{patient.name}</span>
                  <span className="text-slate-400 ms-2">{patient.patientId} · {patient.phone}</span>
                </div>
                <button className="text-xs text-brand-700 hover:underline" onClick={() => { setPatient(null); setQuery(""); }}>{t("common.edit")}</button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="absolute start-3 top-2.5 text-slate-400" size={16} />
                <input
                  className="input ps-9"
                  placeholder={t("patients.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {(results.length > 0 || searching) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {searching && <p className="text-xs text-slate-400 px-3 py-2">{t("common.loading")}</p>}
                    {results.map((p) => (
                      <button
                        type="button"
                        key={p._id}
                        className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                        onClick={() => { setPatient(p); setResults([]); }}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-slate-400 text-xs">{p.patientId} · {p.phone}</span>
                      </button>
                    ))}
                    {!searching && results.length === 0 && query.trim() && (
                      <p className="text-xs text-slate-400 px-3 py-2">{t("common.noResults")}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">{t("common.add")}</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={chargeToAdd} onChange={(e) => setChargeToAdd(e.target.value)}>
                <option value="">{t("common.select")}…</option>
                {charges.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} — {c.standardCharge?.toLocaleString()} {currency} ({c.category})</option>
                ))}
              </select>
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={addFromCharge} disabled={!chargeToAdd}>{t("common.add")}</button>
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={addCustomItem}>+ {t("patients.other")}</button>
            </div>
          </div>

          {hasOpdItem && (
            <div>
              <label className="label">{t("opd.doctor")} *</label>
              <select className="input" required value={doctor} onChange={(e) => setDoctor(e.target.value)}>
                <option value="">{t("opd.selectDoctor")}</option>
                {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {items.length > 0 && (
            <div className="table-wrap border border-slate-200 rounded-lg !p-0">
              <table className="data-table">
                <thead><tr><th>{t("common.description")}</th><th className="w-24">{t("common.category")}</th><th className="w-16">{t("common.quantity")}</th><th className="w-24">{t("common.price")}</th><th className="w-20">{t("billing.discount")} %</th><th className="w-20">{t("billing.tax")} %</th><th></th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td><input className="input !py-1 !text-sm" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder={t("common.description")} /></td>
                      <td>
                        <select className="input !py-1 !text-sm" value={it.category} onChange={(e) => updateItem(i, { category: e.target.value })}>
                          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td><input type="number" min={1} className="input !py-1 !text-sm" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} /></td>
                      <td><input type="number" min={0} className="input !py-1 !text-sm" value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} /></td>
                      <td><input type="number" min={0} max={100} className="input !py-1 !text-sm" value={it.discountPercent} onChange={(e) => updateItem(i, { discountPercent: e.target.value })} /></td>
                      <td><input type="number" min={0} max={100} className="input !py-1 !text-sm" value={it.taxPercent} onChange={(e) => updateItem(i, { taxPercent: e.target.value })} /></td>
                      <td><button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="text-sm space-y-1 bg-slate-50 rounded-lg p-3">
              <div className="flex justify-between"><span className="text-slate-400">{t("billing.subtotal")}</span><span>{totals.subTotal.toLocaleString()} {currency}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t("billing.discount")}</span><span>-{totals.discountTotal.toLocaleString()} {currency}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t("billing.tax")}</span><span>{totals.taxTotal.toLocaleString()} {currency}</span></div>
              <div className="flex justify-between font-semibold text-base border-t border-slate-200 pt-1 mt-1"><span>{t("common.total")}</span><span>{totals.grandTotal.toLocaleString()} {currency}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t("billing.amountPaid")}</label>
              <input type="number" min={0} className="input" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">{t("billing.paymentMethod")}</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.labelKey)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t("common.notes")}</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
            <button type="button" className="btn-primary" onClick={submit} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
