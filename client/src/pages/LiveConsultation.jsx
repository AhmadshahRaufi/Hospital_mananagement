import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, Video, Settings2 } from "lucide-react";
import api from "../api/axios.js";
import { StatusBadge } from "./PatientDetail.jsx";

export default function LiveConsultation() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({ doctor: "", scheduledAt: "", durationMinutes: 20, meetingLink: "" });
  const [zoomConnected, setZoomConnected] = useState(false);

  const load = () => api.get("/live-consultation").then((r) => setSessions(r.data));
  useEffect(() => {
    load();
    api.get("/hr/staff", { params: { role: "doctor" } }).then((r) => setDoctors(r.data));
    api.get("/settings").then((r) => setZoomConnected(!!r.data.zoom?.connected));
  }, []);
  useEffect(() => {
    if (!patientQuery) return setPatientResults([]);
    const tm = setTimeout(() => api.get("/patients", { params: { q: patientQuery, limit: 6 } }).then((r) => setPatientResults(r.data.patients)), 300);
    return () => clearTimeout(tm);
  }, [patientQuery]);

  const save = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return toast.error(t("common.required_field"));
    if (!form.doctor) return toast.error(t("common.required_field"));
    try {
      await api.post("/live-consultation", { ...form, patient: selectedPatient._id });
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ doctor: "", scheduledAt: "", durationMinutes: 20, meetingLink: "" });
      setSelectedPatient(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const setStatus = async (id, status) => { await api.put(`/live-consultation/${id}`, { status }); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{t("liveConsultation.title")}</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("liveConsultation.startCall")}</button>
      </div>

      {!zoomConnected && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <Settings2 size={16} /> {t("liveConsultation.title")} — {t("common.warning")}
        </div>
      )}

      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("liveConsultation.patient")}</th><th>{t("liveConsultation.doctor")}</th><th>{t("common.date")}</th><th>{t("common.time")}</th><th>{t("common.status")}</th><th>—</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s._id}>
                <td className="font-medium">{s.patient?.name}</td>
                <td>{s.doctor?.name}</td>
                <td>{new Date(s.scheduledAt).toLocaleDateString()}</td>
                <td>{s.durationMinutes} min</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{s.meetingLink ? <a href={s.meetingLink} target="_blank" rel="noreferrer" className="text-brand-600 text-xs flex items-center gap-1"><Video size={13} /> {t("liveConsultation.joinCall")}</a> : "—"}</td>
                <td>{s.status === "scheduled" && <button className="text-xs text-brand-600" onClick={() => setStatus(s._id, "ongoing")}>{t("liveConsultation.startCall")}</button>}</td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">{t("liveConsultation.noActiveCalls")}</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("liveConsultation.startCall")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div className="relative">
                <label className="label">{t("liveConsultation.patient")} *</label>
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
              <div><label className="label">{t("liveConsultation.doctor")} *</label><select className="input" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })}><option value="">{t("common.select")}…</option>{doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("common.date")} *</label><input type="datetime-local" required className="input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
                <div><label className="label">{t("common.time")}</label><input type="number" className="input" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></div>
              </div>
              <div><label className="label">URL</label><input className="input" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://zoom.us/j/…" dir="ltr" /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
