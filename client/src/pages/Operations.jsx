import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, Settings2, ClipboardList } from "lucide-react";
import api from "../api/axios.js";
import { StatusBadge } from "./PatientDetail.jsx";
import BillPrintModal from "../components/BillPrintModal.jsx";

export default function Operations() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("records");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("operations.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("records")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "records" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><ClipboardList size={14} /> {t("operations.schedule")}</button>
        <button onClick={() => setTab("types")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "types" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><Settings2 size={14} /> {t("operations.type")}</button>
      </div>
      {tab === "records" ? <RecordsTab /> : <TypesTab />}
    </div>
  );
}

function TypesTab() {
  const { t } = useTranslation();
  const [ops, setOps] = useState([]);
  const [form, setForm] = useState({ name: "", category: "" });

  const load = () => api.get("/operations").then((r) => setOps(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/operations", form);
    toast.success(t("common.saved"));
    setForm({ name: "", category: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
        <div><label className="label">{t("common.name")}</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">{t("common.category")}</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <button className="btn-primary"><Plus size={16} /> {t("common.add")}</button>
      </form>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("common.category")}</th></tr></thead>
          <tbody>
            {ops.map((o) => (<tr key={o._id}><td className="font-medium">{o.name}</td><td>{o.category || "—"}</td></tr>))}
            {ops.length === 0 && <tr><td colSpan={2} className="text-center text-slate-400 py-10">{t("operations.noCases")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordsTab() {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [ops, setOps] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [form, setForm] = useState({ patient: "", operation: "", surgeon: "", date: "", charge: 0, notes: "" });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [printBillId, setPrintBillId] = useState(null);

  const load = () => api.get("/operations/records").then((r) => setRecords(r.data));
  useEffect(() => {
    load();
    api.get("/operations").then((r) => setOps(r.data));
    api.get("/hr/staff", { params: { role: "doctor" } }).then((r) => setDoctors(r.data));
  }, []);
  useEffect(() => {
    if (!patientQuery) return setPatientResults([]);
    const tm = setTimeout(() => api.get("/patients", { params: { q: patientQuery, limit: 6 } }).then((r) => setPatientResults(r.data.patients)), 300);
    return () => clearTimeout(tm);
  }, [patientQuery]);

  const save = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return toast.error(t("common.required_field"));
    try {
      const { data } = await api.post("/operations/records", { ...form, patient: selectedPatient._id, charge: Number(form.charge) });
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ patient: "", operation: "", surgeon: "", date: "", charge: 0, notes: "" });
      setSelectedPatient(null);
      load();
      if (data.bill?._id) setPrintBillId(data.bill._id);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const setStatus = async (id, status) => { await api.put(`/operations/records/${id}`, { status }); load(); };

  return (
    <div className="space-y-4">
      {printBillId && <BillPrintModal billId={printBillId} onClose={() => { setPrintBillId(null); load(); }} />}
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("operations.newCase")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("opd.patient")}</th><th>{t("operations.type")}</th><th>{t("operations.surgeon")}</th><th>{t("common.date")}</th><th>{t("common.status")}</th><th></th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id}>
                <td className="font-mono text-xs">{r.recordNumber}</td>
                <td>{r.patient?.name}</td>
                <td>{r.operation?.name}</td>
                <td>{r.surgeon?.name || "—"}</td>
                <td>{new Date(r.date).toLocaleDateString()}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  {r.status !== "completed" && r.status !== "cancelled" && (
                    <button className="text-xs text-brand-600" onClick={() => setStatus(r._id, "completed")}>{t("opd.completed")}</button>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">{t("operations.noCases")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("operations.newCase")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div className="relative">
                <label className="label">{t("opd.patient")} *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-brand-50 rounded-lg px-3 py-2 text-sm"><span>{selectedPatient.name}</span><button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-rose-600">{t("common.edit")}</button></div>
                ) : (
                  <>
                    <input className="input" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder={t("patients.searchPlaceholder")} />
                    {patientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {patientResults.map((p) => (<button type="button" key={p._id} className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientResults([]); }}>{p.name}</button>))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div><label className="label">{t("operations.type")} *</label><select className="input" required value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })}><option value="">{t("common.select")}…</option>{ops.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>
              <div><label className="label">{t("operations.surgeon")}</label><select className="input" value={form.surgeon} onChange={(e) => setForm({ ...form, surgeon: e.target.value })}><option value="">{t("common.select")}…</option>{doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("common.date")} *</label><input type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><label className="label">{t("common.amount")}</label><input type="number" className="input" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} /></div>
              </div>
              <div><label className="label">{t("common.notes")}</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
