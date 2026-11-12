import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Save, Plus, KeyRound, Video, UploadCloud, Image as ImageIcon, X } from "lucide-react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../utils/permissions.js";

const ALL_TABS = [
  { key: "clinic", labelKey: "settings.clinic" },
  { key: "charges", labelKey: "setup.charges" },
  { key: "uploads", labelKey: "settings.printing" },
  { key: "video", labelKey: "settings.videoConferencing" },
  { key: "password", labelKey: "settings.updatePassword" },
];

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const tabs = admin ? ALL_TABS : ALL_TABS.filter((tb) => tb.key === "password");
  const [tab, setTab] = useState(admin ? "clinic" : "password");

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("settings.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === tb.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>
      {tab === "clinic" && admin && <ClinicTab />}
      {tab === "charges" && admin && <ChargesTab />}
      {tab === "uploads" && admin && <UploadsTab />}
      {tab === "video" && admin && <VideoTab />}
      {tab === "password" && <PasswordTab />}
    </div>
  );
}

function VideoTab() {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState({ accountEmail: "", apiKey: "", apiSecret: "", connected: false });

  useEffect(() => { api.get("/settings").then((r) => setZoom(r.data.zoom || {})); }, []);

  const connect = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/live-consultation/zoom/connect", zoom);
      setZoom(res.data);
      toast.success(t("common.saved"));
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const disconnect = async () => {
    await api.post("/live-consultation/zoom/disconnect");
    setZoom({ connected: false });
    toast.success(t("common.updated"));
  };

  return (
    <form onSubmit={connect} className="card max-w-md space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Video size={16} className="text-brand-600" />
        <span className={zoom.connected ? "text-emerald-600 font-medium" : "text-slate-400"}>{zoom.connected ? t("settings.active") : t("settings.inactive")}</span>
      </div>
      <div><label className="label">{t("common.email")}</label><input className="input" value={zoom.accountEmail || ""} onChange={(e) => setZoom({ ...zoom, accountEmail: e.target.value })} dir="ltr" /></div>
      <div><label className="label">API Key</label><input className="input" value={zoom.apiKey || ""} onChange={(e) => setZoom({ ...zoom, apiKey: e.target.value })} dir="ltr" /></div>
      <div><label className="label">API Secret</label><input type="password" className="input" value={zoom.apiSecret || ""} onChange={(e) => setZoom({ ...zoom, apiSecret: e.target.value })} dir="ltr" /></div>
      <div className="flex gap-2">
        <button className="btn-primary">{t("common.save")}</button>
        {zoom.connected && <button type="button" className="btn-secondary" onClick={disconnect}>{t("common.cancel")}</button>}
      </div>
      <p className="text-xs text-slate-400">{t("liveConsultation.noActiveCalls")}</p>
    </form>
  );
}

function ClinicTab() {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);

  useEffect(() => { api.get("/settings").then((r) => setForm(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put("/settings", form);
      toast.success(t("settings.saved"));
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  if (!form) return <p className="text-slate-400">{t("common.loading")}</p>;

  return (
    <form onSubmit={save} className="card max-w-xl space-y-4">
      <div><label className="label">{t("settings.clinicName")}</label><input className="input" value={form.clinicName || ""} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} /></div>
      <div><label className="label">{t("settings.clinicName")}</label><input className="input" value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
      <div><label className="label">{t("common.address")}</label><input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">{t("common.phone")}</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
        <div><label className="label">{t("common.email")}</label><input className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">{t("settings.currency")}</label><input className="input" value={form.currency || ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
        <div><label className="label">{t("billing.invoiceNo")}</label><input className="input" value={form.invoicePrefix || ""} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} dir="ltr" /></div>
      </div>
      <div>
        <label className="label">{t("settings.language")}</label>
        <select className="input" value={form.defaultLanguage} onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}>
          <option value="en">{t("languages.en")}</option><option value="fa">{t("languages.fa")}</option><option value="ps">{t("languages.ps")}</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={form.taxEnabled} onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })} /> {t("billing.tax")}
      </label>
      {form.taxEnabled && (
        <div className="max-w-xs"><label className="label">{t("billing.tax")} %</label><input type="number" className="input" value={form.defaultTaxPercent} onChange={(e) => setForm({ ...form, defaultTaxPercent: Number(e.target.value) })} /></div>
      )}
      <div><label className="label">{t("settings.printing")}</label><textarea className="input" rows={2} value={form.printHeader || ""} onChange={(e) => setForm({ ...form, printHeader: e.target.value })} /></div>
      <div><label className="label">{t("settings.printing")}</label><textarea className="input" rows={2} value={form.printFooter || ""} onChange={(e) => setForm({ ...form, printFooter: e.target.value })} /></div>
      <button className="btn-primary"><Save size={16} /> {t("settings.save")}</button>
    </form>
  );
}

function ImageUploadField({ label, hint, purpose, value, onChange }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      const res = await api.post("/uploads/image", fd);
      onChange(res.data.url);
      toast.success(t("common.uploaded") || t("common.saved"));
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2 -mt-1">{hint}</p>}
      <div className="flex items-center gap-4">
        <div className="w-40 h-20 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt={label} className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon className="text-slate-300" size={22} />
          )}
        </div>
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={handleFile} />
          <button type="button" className="btn-secondary" onClick={pick} disabled={uploading}>
            <UploadCloud size={14} /> {uploading ? t("common.loading") : value ? t("common.edit") : t("common.upload")}
          </button>
          {value && (
            <button type="button" className="text-xs text-rose-500 flex items-center gap-1 hover:underline" onClick={() => onChange("")}>
              <X size={12} /> {t("common.delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadsTab() {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);

  useEffect(() => { api.get("/settings").then((r) => setForm(r.data)); }, []);

  const save = async () => {
    try {
      await api.put("/settings", form);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    }
  };

  if (!form) return <p className="text-slate-400">{t("common.loading")}</p>;

  return (
    <div className="card max-w-xl space-y-6">
      <div>
        <h3 className="font-medium text-slate-700 text-sm">{t("settings.logo")}</h3>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">{t("settings.printing")}</p>
        <ImageUploadField label={t("settings.logo")} purpose="logo" value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} />
      </div>
      <div className="border-t border-slate-100 pt-5">
        <h3 className="font-medium text-slate-700 text-sm">{t("settings.labHeader")}</h3>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">{t("settings.printing")}</p>
        <div className="space-y-5">
          <ImageUploadField
            label={t("settings.labHeader")}
            purpose="lab-header"
            value={form.labReportHeaderUrl}
            onChange={(url) => setForm({ ...form, labReportHeaderUrl: url })}
          />
          <ImageUploadField
            label={t("settings.labFooter")}
            purpose="lab-footer"
            value={form.labReportFooterUrl}
            onChange={(url) => setForm({ ...form, labReportFooterUrl: url })}
          />
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={save}><Save size={16} /> {t("settings.save")}</button>
    </div>
  );
}

function ChargesTab() {
  const { t } = useTranslation();
  const [charges, setCharges] = useState([]);
  const [form, setForm] = useState({ name: "", category: "opd", standardCharge: "", taxPercent: 0 });

  const load = () => api.get("/charges").then((r) => setCharges(r.data));
  useEffect(() => { load(); }, []);

  const seed = async () => {
    const r = await api.post("/charges/seed-presets");
    toast.success(t("common.saved"));
    load();
  };

  const save = async (e) => {
    e.preventDefault();
    await api.post("/charges", { ...form, standardCharge: Number(form.standardCharge), taxPercent: Number(form.taxPercent) });
    toast.success(t("common.saved"));
    setForm({ name: "", category: "opd", standardCharge: "", taxPercent: 0 });
    load();
  };

  const remove = async (id) => {
    if (!confirm(t("common.confirm"))) return;
    await api.delete(`/charges/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <button className="btn-secondary" onClick={seed}>{t("common.add")}</button>
      </div>
      <form onSubmit={save} className="card grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2"><label className="label">{t("common.name")}</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <label className="label">{t("common.category")}</label>
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="opd">{t("nav.opd")}</option><option value="lab">{t("nav.laboratory")}</option><option value="radiology">{t("nav.radiology")}</option><option value="optical">{t("nav.optical")}</option><option value="operation">{t("nav.operations")}</option><option value="other">{t("patients.other")}</option>
          </select>
        </div>
        <div><label className="label">{t("common.amount")}</label><input type="number" className="input" required value={form.standardCharge} onChange={(e) => setForm({ ...form, standardCharge: e.target.value })} /></div>
        <button className="btn-primary"><Plus size={16} /> {t("common.add")}</button>
      </form>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("common.category")}</th><th>{t("common.amount")}</th><th>{t("billing.tax")} %</th><th></th></tr></thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c._id}>
                <td className="font-medium">{c.name}</td>
                <td className="capitalize">{c.category}</td>
                <td>{c.standardCharge}</td>
                <td>{c.taxPercent}%</td>
                <td><button className="text-xs text-rose-500 hover:underline" onClick={() => remove(c._id)}>{t("common.delete")}</button></td>
              </tr>
            ))}
            {charges.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PasswordTab() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const { logout } = useAuth();

  const save = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error(t("settings.passwordsDoNotMatch"));
    try {
      await api.post("/auth/change-password", form);
      toast.success(t("settings.passwordUpdated"));
      setTimeout(logout, 1200);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <form onSubmit={save} className="card max-w-sm space-y-4">
      <div><label className="label">{t("settings.currentPassword")}</label><input type="password" className="input" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} dir="ltr" /></div>
      <div><label className="label">{t("settings.newPassword")}</label><input type="password" className="input" required minLength={6} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} dir="ltr" /></div>
      <div><label className="label">{t("settings.confirmPassword")}</label><input type="password" className="input" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} dir="ltr" /></div>
      <button className="btn-primary"><KeyRound size={16} /> {t("settings.updatePassword")}</button>
    </form>
  );
}
