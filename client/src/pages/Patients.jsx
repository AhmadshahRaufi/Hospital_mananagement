import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, Search, X, Trash2, Upload, ShieldCheck, Skull, UserX } from "lucide-react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRole } from "../utils/permissions.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";

const emptyForm = {
  name: "", gender: "male", dob: "", phone: "", email: "", address: "",
  province: "", city: "", guardianName: "", bloodGroup: "", maritalStatus: "not_specified",
  nationalId: "", remarks: "",
};

// View tabs are keyed so the labels translate via i18n without losing the
// underlying filter value (active / disabled / dead / tpa).
const VIEWS = [
  { key: "active", labelKey: "patients.active", icon: Search },
  { key: "disabled", labelKey: "patients.disabled", icon: UserX },
  { key: "dead", labelKey: "patients.deceased", icon: Skull },
  { key: "tpa", labelKey: "patients.tpa", icon: ShieldCheck },
];

export default function Patients() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = hasRole(user, "receptionist");
  const [params, setParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [view, setView] = useState("active");
  const [selected, setSelected] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const load = async (query = q, v = view) => {
    const res = await api.get("/patients", { params: { q: query, limit: 100, view: v } });
    setPatients(res.data.patients);
    setSelected([]);
  };

  // Watch the URL `q` query param so the header search box refetches the
  // list even when the user is already on /patients (e.g. they search from
  // the header twice in a row — only the URL changed, the component never
  // remounted). Without this, the second search silently does nothing.
  useEffect(() => {
    const urlQ = params.get("q") || "";
    if (urlQ !== q) {
      setQ(urlQ);
      load(urlQ);
    }
    /* eslint-disable-next-line */
  }, [params]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [view]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(q);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/patients", form);
      toast.success(`${t("patients.saved")}: ${res.data.patientId}`);
      setShowModal(false);
      setForm(emptyForm);
      load();
      bumpDataVersion(CHANNELS.patients, CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected(selected.length === patients.length ? [] : patients.map((p) => p._id));

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(t("patients.bulkDeactivate", { count: selected.length }))) return;
    await api.post("/patients/bulk-deactivate", { ids: selected });
    toast.success(t("patients.deleted"));
    load();
    bumpDataVersion(CHANNELS.patients, CHANNELS.dashboard);
  };

  const reactivate = async (id) => { await api.put(`/patients/${id}/reactivate`); load(); };
  const markDeceased = async (id) => {
    if (!window.confirm(t("patients.confirmMarkDeceased"))) return;
    await api.put(`/patients/${id}/mark-deceased`, {});
    load();
    bumpDataVersion(CHANNELS.patients, CHANNELS.dashboard);
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
        const res = await api.post("/setup/import/patients", { rows });
        toast.success(`${t("common.created")} ${res.data.created} / ${res.data.failed}`);
        setShowImport(false);
        load();
      } catch (err) {
        toast.error(err.response?.data?.message || t("common.error"));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-800">{t("patients.title")}</h1>
        <div className="flex gap-2">
          {canManage && <button className="btn-secondary" onClick={() => setShowImport(true)}><Upload size={16} /> {t("patients.bulkImport")}</button>}
          {canManage && <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("patients.registerPatient")}</button>}
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${view === v.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <v.icon size={14} /> {t(v.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md flex-1">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-2.5 text-slate-400" size={16} />
            <input className="input ps-9" placeholder={t("patients.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn-secondary">{t("common.search")}</button>
        </form>
        {canManage && selected.length > 0 && view === "active" && (
          <button className="btn-danger" onClick={deleteSelected}><Trash2 size={15} /> {t("patients.disabled")} ({selected.length})</button>
        )}
      </div>

      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead>
            <tr>
              {view === "active" && canManage && <th><input type="checkbox" checked={selected.length === patients.length && patients.length > 0} onChange={toggleAll} /></th>}
              <th>{t("patients.patientId")}</th><th>{t("patients.fullName")}</th><th>{t("patients.gender")}</th><th>{t("patients.age")}</th><th>{t("common.phone")}</th><th>{t("patients.address")}</th>
              {view === "tpa" && <th>{t("nav.insurance")}</th>}
              {view === "dead" && <th>{t("common.date")}</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p._id}>
                {view === "active" && canManage && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggleSelect(p._id)} />
                  </td>
                )}
                <td className="font-mono text-xs text-brand-700 cursor-pointer" onClick={() => navigate(`/patients/${p._id}`)}>{p.patientId}</td>
                <td className="font-medium text-slate-700 cursor-pointer" onClick={() => navigate(`/patients/${p._id}`)}>{p.name}</td>
                <td className="capitalize">{t(`patients.${p.gender}`, { defaultValue: p.gender })}</td>
                <td>{p.age ?? "—"}</td>
                <td dir="ltr">{p.phone}</td>
                <td>{p.province || "—"}</td>
                {view === "tpa" && <td>{p.tpa?.provider || "—"}</td>}
                {view === "dead" && <td>{p.deathDate ? new Date(p.deathDate).toLocaleDateString() : "—"}</td>}
                <td className="flex gap-2">
                  {canManage && view === "disabled" && <button className="text-xs text-emerald-600" onClick={() => reactivate(p._id)}>{t("patients.reactivate")}</button>}
                  {canManage && view === "active" && <button className="text-xs text-slate-500" onClick={() => markDeceased(p._id)}>{t("patients.markDeceased")}</button>}
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10">{t("patients.noPatients")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold">{t("patients.addNew")}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">{t("patients.fullName")} *</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("patients.gender")} *</label>
                <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="male">{t("patients.male")}</option><option value="female">{t("patients.female")}</option><option value="other">{t("patients.other")}</option>
                </select>
              </div>
              <div>
                <label className="label">{t("common.date")}</label>
                <input type="date" className="input" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("patients.maritalStatus")}</label>
                <select className="input" value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
                  <option value="not_specified">{t("patients.marital_not_specified")}</option>
                  <option value="single">{t("patients.marital_single")}</option>
                  <option value="married">{t("patients.marital_married")}</option>
                  <option value="widowed">{t("patients.marital_widowed")}</option>
                  <option value="separated">{t("patients.marital_separated")}</option>
                </select>
              </div>
              <div>
                <label className="label">{t("patients.nationalId")}</label>
                <input className="input" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="label">{t("common.phone")} *</label>
                <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="label">{t("common.email")}</label>
                <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
              </div>
              <div>
                <label className="label">{t("patients.province")}</label>
                <input className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("patients.city")}</label>
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t("common.address")}</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("patients.guardianName")}</label>
                <input className="input" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("patients.bloodGroup")}</label>
                <input className="input" placeholder="O+" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t("patients.remarks")}</label>
                <textarea className="input" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
                <button className="btn-primary" disabled={saving}>{saving ? t("common.loading") : t("patients.save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("patients.bulkImport")}</h2><button onClick={() => setShowImport(false)}><X size={20} /></button></div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-500" dir="ltr">{t("patients.csvFormat")}</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile} className="input" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
