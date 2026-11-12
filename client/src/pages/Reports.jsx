import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import RevenueTrendChart from "../components/RevenueTrendChart.jsx";

// Report types use translation keys; the option `value` is the raw API key
// so the backend contract stays stable across languages.
const REPORT_TYPES = [
  { key: "finance", labelKey: "reports.finance" },
  { key: "opd", labelKey: "reports.opd" },
  { key: "pharmacy", labelKey: "reports.pharmacy" },
  { key: "pathology", labelKey: "reports.lab" },
  { key: "radiology", labelKey: "lab.radiologyTitle" },
  { key: "patient", labelKey: "reports.patients" },
  { key: "birth-death", labelKey: "reports.patients" },
  { key: "tpa", labelKey: "nav.insurance" },
  { key: "ot", labelKey: "nav.operations" },
  { key: "live-consultation", labelKey: "nav.liveConsultation" },
  { key: "log", labelKey: "reports.auditLog" },
];

export default function Reports() {
  const { t } = useTranslation();
  const [type, setType] = useState("finance");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ currency: "AFN" });

  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data)).catch(() => {}); }, []);

  const runReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${type}`, { params: { from: from || undefined, to: to || undefined } });
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("reports.title")}</h1>
      <div className="card flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className="label">{t("reports.reportType")}</label>
          <select className="input" value={type} onChange={(e) => { setType(e.target.value); setData(null); }}>
            {REPORT_TYPES.map((r) => <option key={r.key} value={r.key}>{t(r.labelKey)}</option>)}
          </select>
        </div>
        <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={runReport} disabled={loading}>{loading ? t("reports.running") : t("reports.runReport")}</button>
      </div>

      {type === "finance" && <RevenueTrendChart currency={settings.currency} title={t("dashboard.revenueAndIncome")} />}

      {data && (
        <div className="card overflow-x-auto">
          {type === "finance" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label={t("reports.statRevenue")} value={data.revenue} tone="emerald" />
              <Stat label={t("reports.statOtherIncome")} value={data.otherIncome} tone="emerald" />
              <Stat label={t("reports.statExpense")} value={data.expenseTotal} tone="rose" />
              <Stat label={t("reports.statNet")} value={data.net} tone="brand" />
            </div>
          )}
          {type === "opd" && <GenericTable t={t} rows={data} columns={[["visitNumber", t("billing.invoiceNo")], ["patient.name", t("opd.patient")], ["doctor.name", t("opd.doctor")], ["status", t("common.status")], ["diagnosis", t("opd.diagnosis")]]} />}
          {(type === "pathology" || type === "radiology") && <GenericTable t={t} rows={data} columns={[["orderNumber", t("billing.invoiceNo")], ["patient.name", t("opd.patient")], ["status", t("common.status")]]} />}
          {type === "pharmacy" && (
            <>
              <p className="mb-3 text-sm text-slate-500">{t("reports.totalSales")}: <span className="font-semibold text-emerald-600">{data.total?.toLocaleString()}</span></p>
              <GenericTable t={t} rows={data.sales} columns={[["saleNumber", t("billing.invoiceNo")], ["patient.name", t("opd.patient")], ["grandTotal", t("common.total")]]} />
            </>
          )}
          {type === "patient" && <GenericTable t={t} rows={data} columns={[["patientId", t("patients.patientId")], ["name", t("common.name")], ["gender", t("patients.gender")], ["phone", t("common.phone")]]} />}
          {type === "birth-death" && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Stat label={t("reports.statNewRegistrations")} value={data.birthCount} tone="emerald" />
                <Stat label={t("reports.statDeaths")} value={data.deathCount} tone="rose" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-2">{t("reports.statNewRegistrations")}</p>
              <GenericTable t={t} rows={data.births} columns={[["patientId", t("patients.patientId")], ["name", t("common.name")], ["gender", t("patients.gender")]]} />
              <p className="text-sm font-medium text-slate-600 mb-2 mt-6">{t("reports.statDeaths")}</p>
              <GenericTable t={t} rows={data.deaths} columns={[["patientId", t("patients.patientId")], ["name", t("common.name")], ["deathDate", t("common.date")]]} />
            </>
          )}
          {type === "tpa" && <GenericTable t={t} rows={data} columns={[["patientId", t("patients.patientId")], ["name", t("common.name")], ["phone", t("common.phone")]]} />}
          {type === "ot" && (
            <>
              <p className="mb-3 text-sm text-slate-500">{t("reports.totalOtCharges")}: <span className="font-semibold text-emerald-600">{data.totalCharges?.toLocaleString()}</span></p>
              <GenericTable t={t} rows={data.records} columns={[["recordNumber", t("billing.invoiceNo")], ["patient.name", t("opd.patient")], ["operation.name", t("operations.type")], ["surgeon.name", t("operations.surgeon")], ["status", t("common.status")]]} />
            </>
          )}
          {type === "live-consultation" && <GenericTable t={t} rows={data} columns={[["patient.name", t("liveConsultation.patient")], ["doctor.name", t("liveConsultation.doctor")], ["status", t("common.status")], ["scheduledAt", t("common.date")]]} />}
          {type === "log" && <GenericTable t={t} rows={data} columns={[["userName", t("common.name")], ["action", t("common.actions")], ["module", t("common.type")], ["description", t("common.description")], ["createdAt", t("common.date")]]} />}
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value, tone }) => {
  const toneClass = { emerald: "text-emerald-600", rose: "text-rose-600", brand: "text-brand-700" }[tone];
  return (<div><p className="text-xs text-slate-400">{label}</p><p className={`text-xl font-semibold ${toneClass}`}>{Number(value || 0).toLocaleString()}</p></div>);
};

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);

const GenericTable = ({ rows, columns, t: tProp }) => {
  const emptyText = tProp ? tProp("reports.noRecords") : "No records for this range.";
  return (
  <table className="data-table w-full">
    <thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>
      {rows?.map((row, i) => (
        <tr key={row._id || i}>
          {columns.map(([path, label]) => {
            let val = getPath(row, path);
            if (val && /(At|Date)$/.test(path) && !isNaN(Date.parse(val))) val = new Date(val).toLocaleString();
            return <td key={label}>{val ?? "—"}</td>;
          })}
        </tr>
      ))}
      {(!rows || rows.length === 0) && <tr><td colSpan={columns.length} className="text-center text-slate-400 py-8">{emptyText}</td></tr>}
    </tbody>
  </table>
  );
};
