import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import api from "../api/axios.js";
import { StatusBadge } from "./PatientDetail.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRole } from "../utils/permissions.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";
import BillPrintModal from "../components/BillPrintModal.jsx";

const toDateTimeLocalValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
};

export default function OPD() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canBookVisit = hasRole(user, "receptionist", "doctor");
  const [params] = useSearchParams();
  const [visits, setVisits] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(params.get("new") === "1");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({ doctor: "", visitType: "new", consultationFee: 200, visitDate: toDateTimeLocalValue() });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [printBillId, setPrintBillId] = useState(null);

  const load = () => api.get("/opd", { params: { limit: 50 } }).then((r) => setVisits(r.data.visits));

  useEffect(() => {
    load();
    api.get("/hr/staff", { params: { role: "doctor" } }).then((r) => setDoctors(r.data));
    const pid = params.get("patient");
    if (pid) api.get(`/patients/${pid}`).then((r) => setSelectedPatient(r.data));
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!patientQuery) { setPatientResults([]); return; }
    const tm = setTimeout(() => {
      api.get("/patients", { params: { q: patientQuery, limit: 8 } }).then((r) => setPatientResults(r.data.patients));
    }, 300);
    return () => clearTimeout(tm);
  }, [patientQuery]);

  const createVisit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return toast.error(t("opd.selectPatient"));
    if (!form.doctor) return toast.error(t("opd.selectDoctor"));
    setSaving(true);
    try {
      const payload = {
        ...form,
        visitDate: form.visitDate ? new Date(form.visitDate).toISOString() : undefined,
      };
      const res = await api.post("/opd", { patient: selectedPatient._id, ...payload });
      toast.success(t("opd.visitCreated", { id: res.data.visitNumber }));
      setShowModal(false);
      const billId = res.data.bill?._id || res.data.bill;
      if (billId) setPrintBillId(billId);
      bumpDataVersion(CHANNELS.opd, CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const upcomingVisits = visits.filter((v) => new Date(v.visitDate) >= todayEnd);
  const todaysVisits = visits.filter((v) => {
    const visitDate = new Date(v.visitDate);
    return visitDate >= todayStart && visitDate < todayEnd;
  });
  const oldVisits = visits.filter((v) => new Date(v.visitDate) < todayStart);

  return (
    <div className="space-y-5">
      {printBillId && <BillPrintModal billId={printBillId} onClose={() => { setPrintBillId(null); load(); }} />}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{t("opd.title")}</h1>
        {canBookVisit && <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("opd.newVisit")}</button>}
      </div>

      <VisitSection title={t("opd.upcomingAppointments")} visits={upcomingVisits} emptyText={t("opd.noVisits")} onOpen={(visitId) => navigate(`/opd/${visitId}`)} />
      <VisitSection title={t("opd.todayVisits")} visits={todaysVisits} emptyText={t("opd.noVisits")} onOpen={(visitId) => navigate(`/opd/${visitId}`)} />
      <VisitSection title={t("opd.oldPatients")} visits={oldVisits} emptyText={t("opd.noVisits")} onOpen={(visitId) => navigate(`/opd/${visitId}`)} />

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold">{t("opd.newVisit")}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={createVisit} className="p-6 space-y-4">
              <div>
                <label className="label">{t("opd.patient")} *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-brand-50 rounded-lg px-3 py-2">
                    <span className="text-sm">{selectedPatient.name} • {selectedPatient.patientId}</span>
                    <button type="button" className="text-xs text-rose-600" onClick={() => setSelectedPatient(null)}>{t("common.edit")}</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input className="input" placeholder={t("patients.searchPlaceholder")} value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
                    {patientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button type="button" key={p._id} className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50"
                            onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientResults([]); }}>
                            {p.name} • {p.patientId} • {p.phone}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="label">{t("opd.doctor")} *</label>
                <select className="input" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })}>
                  <option value="">{t("common.select")}…</option>
                  {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t("opd.visitDate")}</label>
                <input type="datetime-local" className="input" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t("common.type")}</label>
                  <select className="input" value={form.visitType} onChange={(e) => setForm({ ...form, visitType: e.target.value })}>
                    <option value="new">{t("opd.visitTypeNew")}</option><option value="follow_up">{t("opd.visitTypeFollowUp")}</option><option value="emergency">{t("opd.visitTypeEmergency")}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t("opd.consultationFee")}</label>
                  <input type="number" className="input" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
                <button className="btn-primary" disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitSection({ title, visits, emptyText, onOpen }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-xs text-slate-400">{visits.length}</span>
      </div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("opd.patient")}</th><th>{t("opd.doctor")}</th><th>{t("common.date")}</th><th>{t("common.type")}</th><th>{t("common.status")}</th></tr></thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v._id} className="cursor-pointer" onClick={() => onOpen(v._id)}>
                <td className="font-mono text-xs text-brand-700">{v.visitNumber}</td>
                <td className="font-medium">{v.patient?.name}</td>
                <td>{v.doctor?.name}</td>
                <td>{new Date(v.visitDate).toLocaleString()}</td>
                <td className="capitalize">{v.visitType?.replace("_", " ")}</td>
                <td><StatusBadge status={v.status} /></td>
              </tr>
            ))}
            {visits.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
