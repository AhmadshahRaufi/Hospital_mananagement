import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, FlaskConical, ClipboardList, FileCheck2, Printer } from "lucide-react";
import api from "../api/axios.js";
import { StatusBadge } from "./PatientDetail.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRole } from "../utils/permissions.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";
import { triggerPrint } from "../utils/print.js";
import BillPrintModal from "../components/BillPrintModal.jsx";

export default function Lab() {
  const { t } = useTranslation();
  const { type } = useParams(); // pathology | radiology
  const [tab, setTab] = useState("orders");
  const labelKey = type === "radiology" ? "lab.radiologyTitle" : "lab.title";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t(labelKey)}</h1>
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("orders")} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "orders" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><ClipboardList size={14} className="inline me-1" /> {t("lab.title")}</button>
        <button onClick={() => setTab("tests")} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "tests" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><FlaskConical size={14} className="inline me-1" /> {t("lab.tests")}</button>
      </div>
      {tab === "orders" ? <OrdersTab type={type} label={t(labelKey)} /> : <TestsTab type={type} />}
    </div>
  );
}

function TestsTab({ type }) {
  const { t } = useTranslation();
  const [tests, setTests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", normalRange: "", unit: "", sampleType: "" });

  const load = () => api.get(`/lab/tests/${type}`).then((r) => setTests(r.data));
  useEffect(() => { load(); }, [type]);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/lab/tests", { ...form, type, price: Number(form.price) });
    toast.success(t("common.saved"));
    setShowModal(false);
    setForm({ name: "", price: "", normalRange: "", unit: "", sampleType: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("common.add")} {t("lab.test")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("lab.test")}</th><th>{t("common.price")}</th><th>{t("common.description")}</th><th>{t("common.type")}</th></tr></thead>
          <tbody>
            {tests.map((tb) => (
              <tr key={tb._id}><td className="font-medium">{tb.name}</td><td>{tb.price}</td><td>{tb.normalRange || "—"}</td><td>{tb.sampleType || "—"}</td></tr>
            ))}
            {tests.length === 0 && <tr><td colSpan={4} className="text-center text-slate-400 py-10">{t("lab.noOrders")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("common.add")} {t("lab.test")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("lab.test")} *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">{t("common.price")} *</label><input type="number" className="input" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><label className="label">{t("common.description")}</label><input className="input" value={form.normalRange} onChange={(e) => setForm({ ...form, normalRange: e.target.value })} /></div>
              <div><label className="label">{t("common.type")}</label><input className="input" value={form.sampleType} onChange={(e) => setForm({ ...form, sampleType: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ type, label }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEnterResults = hasRole(user, "lab_tech", "radiologist");
  const [orders, setOrders] = useState([]);
  const [tests, setTests] = useState([]);
  const [settings, setSettings] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [selectedTests, setSelectedTests] = useState([]);
  const [resultsOrder, setResultsOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printBillId, setPrintBillId] = useState(null);

  const load = () => api.get(`/lab/orders/${type}`).then((r) => setOrders(r.data));
  useEffect(() => {
    load();
    api.get(`/lab/tests/${type}`).then((r) => setTests(r.data));
    api.get("/settings").then((r) => setSettings(r.data));
  }, [type]);
  useEffect(() => {
    if (!patientQuery) return setPatientResults([]);
    const tm = setTimeout(() => api.get("/patients", { params: { q: patientQuery, limit: 6 } }).then((r) => setPatientResults(r.data.patients)), 300);
    return () => clearTimeout(tm);
  }, [patientQuery]);

  const toggleTest = (tb) => {
    setSelectedTests((prev) =>
      prev.find((x) => x.test === tb._id)
        ? prev.filter((x) => x.test !== tb._id)
        : [...prev, { test: tb._id, name: tb.name, price: tb.price, unit: tb.unit, normalRange: tb.normalRange }]
    );
  };

  const createOrder = async () => {
    if (!patient) return toast.error(t("common.required_field"));
    if (!selectedTests.length) return toast.error(t("common.required_field"));
    try {
      const res = await api.post("/lab/orders", { type, patient: patient._id, items: selectedTests });
      toast.success(`${t("common.saved")}: ${res.data.orderNumber}`);
      setShowModal(false); setPatient(null); setSelectedTests([]);
      load();
      bumpDataVersion(CHANNELS.lab, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const generateBill = async (id) => {
    try {
      const res = await api.post(`/lab/orders/${id}/bill`);
      toast.success(t("common.saved"));
      load();
      if (res.data._id) setPrintBillId(res.data._id);
      bumpDataVersion(CHANNELS.lab, CHANNELS.billing, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      {printBillId && <BillPrintModal billId={printBillId} onClose={() => setPrintBillId(null)} />}
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("lab.newOrder")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("opd.patient")}</th><th>{t("lab.tests")}</th><th>{t("common.date")}</th><th>{t("common.status")}</th><th>{t("billing.title")}</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td className="font-mono text-xs">{o.orderNumber}</td>
                <td>{o.patient?.name}</td>
                <td>{o.items.map((i) => i.name).join(", ")}</td>
                <td>{new Date(o.orderDate).toLocaleDateString()}</td>
                <td><StatusBadge status={o.status} /></td>
                <td>{o.bill ? <span className="text-emerald-600 text-xs">{t("billing.paid")}</span> : <button className="text-xs text-brand-600" onClick={() => generateBill(o._id)}>{t("billing.newInvoice")}</button>}</td>
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {canEnterResults && (
                      <button className="text-slate-400 hover:text-brand-600" title={t("lab.uploadResult")} onClick={() => setResultsOrder(o)}>
                        <FileCheck2 size={16} />
                      </button>
                    )}
                    <button className="text-slate-400 hover:text-slate-700" title={t("common.print")} onClick={() => setPrintOrder(o)}>
                      <Printer size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">{t("lab.noOrders")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("lab.newOrder")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <label className="label">{t("lab.patient")} *</label>
                {patient ? (
                  <div className="flex items-center justify-between bg-brand-50 rounded-lg px-3 py-2 text-sm"><span>{patient.name}</span><button onClick={() => setPatient(null)} className="text-xs text-rose-600">{t("common.edit")}</button></div>
                ) : (
                  <>
                    <input className="input" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder={t("patients.searchPlaceholder")} />
                    {patientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {patientResults.map((p) => (<button key={p._id} className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setPatient(p); setPatientQuery(""); setPatientResults([]); }}>{p.name}</button>))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="label">{t("lab.selectTests")}</label>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-2">
                  {tests.map((tb) => (
                    <label key={tb._id} className="flex items-center gap-2 text-sm py-1">
                      <input type="checkbox" checked={selectedTests.some((x) => x.test === tb._id)} onChange={() => toggleTest(tb)} />
                      {tb.name} <span className="text-slate-400 ms-auto">{tb.price}</span>
                    </label>
                  ))}
                  {tests.length === 0 && <p className="text-xs text-slate-400">{t("lab.noOrders")}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary" onClick={createOrder}>{t("lab.newOrder")}</button></div>
            </div>
          </div>
        </div>
      )}
      {resultsOrder && (
        <ResultsModal
          order={resultsOrder}
          onClose={() => setResultsOrder(null)}
          onSaved={(updated) => { setResultsOrder(null); setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o))); }}
        />
      )}
      {printOrder && <PrintReportModal order={printOrder} type={type} label={label} settings={settings} onClose={() => setPrintOrder(null)} />}
    </div>
  );
}

// Lab/radiology staff key in each test's result + notes here. Saves the
// whole panel in one request; the order flips to "completed" and gets
// verifiedBy/reportedAt stamped automatically once every item has a result.
function ResultsModal({ order, onClose, onSaved }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(order.items.map((i) => ({ ...i })));
  const [saving, setSaving] = useState(false);

  const update = (idx, patch) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/lab/orders/${order._id}/result`, {
        items: items.map((it) => ({ itemId: it._id, result: it.result || "", resultNotes: it.resultNotes || "" })),
      });
      toast.success(t("common.saved"));
      onSaved(res.data);
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
          <h2 className="font-semibold">{t("lab.enterResults")} — {order.orderNumber}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">{order.patient?.name} · {order.patient?.patientId}</p>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={it._id || i} className="border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{it.name}</p>
                  <p className="text-xs text-slate-400">{t("lab.normalRange")}: {it.normalRange || "—"} {it.unit || ""}</p>
                </div>
                <div className="sm:col-span-1">
                  <label className="label">{t("lab.resultValue")}</label>
                  <input className="input" value={it.result || ""} onChange={(e) => update(i, { result: e.target.value })} placeholder="13.4" dir="ltr" />
                </div>
                <div className="sm:col-span-1">
                  <label className="label">{t("common.notes")}</label>
                  <input className="input" value={it.resultNotes || ""} onChange={(e) => update(i, { resultNotes: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Printed lab/radiology report. Uses the uploaded header/footer banner
// images from Settings when present, and falls back to the plain-text
// clinic header/footer (same as the bill/prescription templates) otherwise.
function PrintReportModal({ order, type, label, settings, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold">{t("lab.report")} — {order.orderNumber}</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => triggerPrint({ delay: 200 })} className="text-slate-400 hover:text-slate-600" title={t("common.print")}><Printer size={18} /></button>
            <button onClick={onClose}><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 text-sm text-slate-600 space-y-1">
          <p><span className="text-slate-400">{t("lab.patient")}:</span> {order.patient?.name}</p>
          <p><span className="text-slate-400">{t("common.status")}:</span> <StatusBadge status={order.status} /></p>
          <p className="text-xs text-slate-400 pt-2">{t("common.print")}</p>
        </div>

        <section className="print-area">
          {settings.labReportHeaderUrl ? (
            <img src={settings.labReportHeaderUrl} alt="" className="print-banner" />
          ) : (
            <div className="print-header">
              {settings.logoUrl && <img src={settings.logoUrl} alt="" className="print-logo" />}
              <h1>{settings.clinicName || "Clinic"}</h1>
              <p>{[settings.address, settings.phone, settings.email].filter(Boolean).join(" | ")}</p>
              {settings.printHeader && <p>{settings.printHeader}</p>}
            </div>
          )}

          <div className="print-title">{label} — {t("lab.report")}</div>
          <div className="print-grid">
            <div><strong>{t("lab.orderNumber")}:</strong> {order.orderNumber}</div>
            <div><strong>{t("common.date")}:</strong> {new Date(order.orderDate).toLocaleDateString()}</div>
            <div><strong>{t("lab.patient")}:</strong> {order.patient?.name}</div>
            <div><strong>{t("patients.patientId")}:</strong> {order.patient?.patientId || "-"}</div>
            <div><strong>{t("patients.gender")} / {t("common.date")}:</strong> {order.patient?.gender || "-"} {order.patient?.dob ? `/ ${new Date(order.patient.dob).toLocaleDateString()}` : ""}</div>
            <div><strong>{t("common.status")}:</strong> {order.status?.replace("_", " ")}</div>
          </div>

          <table className="print-table">
            <thead><tr><th>#</th><th>{t("lab.test")}</th><th>{t("lab.resultValue")}</th><th>{t("lab.normalRange")}</th><th>{t("common.unit")}</th></tr></thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={it._id || i}>
                  <td>{i + 1}</td>
                  <td>{it.name}</td>
                  <td className="font-semibold">{it.result || "—"}</td>
                  <td>{it.normalRange || "—"}</td>
                  <td>{it.unit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {order.items.some((it) => it.resultNotes) && (
            <div className="print-section">
              <strong>{t("common.notes")}:</strong>
              <ul>
                {order.items.filter((it) => it.resultNotes).map((it, i) => <li key={i}>{it.name}: {it.resultNotes}</li>)}
              </ul>
            </div>
          )}

          <div className="print-grid" style={{ marginTop: "12px" }}>
            <div><strong>{t("common.date")}:</strong> {order.reportedAt ? new Date(order.reportedAt).toLocaleString() : "—"}</div>
            <div><strong>{t("lab.verified")}:</strong> {order.verifiedBy?.name || "—"}</div>
          </div>
          <div className="print-signature">{type === "radiology" ? t("roles.radiologist") : t("roles.lab_tech")} — {t("opd.doctorSignature")}</div>

          {settings.labReportFooterUrl ? (
            <img src={settings.labReportFooterUrl} alt="" className="print-banner" />
          ) : (
            settings.printFooter && <div className="print-footer">{settings.printFooter}</div>
          )}
        </section>
      </div>
    </div>
  );
}
