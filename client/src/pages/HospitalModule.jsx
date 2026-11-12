import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Activity, Ambulance, Bed, CalendarPlus, ClipboardList, FileText,
  HeartPulse, Plus, Printer, ShieldCheck, Stethoscope, Upload,
} from "lucide-react";
import api from "../api/axios.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";

// All module titles and field labels carry translation keys so the page
// title, table headers, and form labels all flip into the active language.
const MODULES = {
  appointments: {
    titleKey: "hospitalModule.appointments",
    icon: CalendarPlus,
    key: "hospital_appointments",
    fields: [
      ["patient", "opd.patient"],
      ["doctor", "opd.doctor"],
      ["department", "opd.department"],
      ["date", "common.date", "date"],
      ["time", "common.time", "time"],
      ["status", "common.status", "select", ["booked", "arrived", "completed", "cancelled", "no_show"]],
    ],
    columns: ["patient", "doctor", "department", "date", "time", "status"],
  },
  ipd: {
    titleKey: "hospitalModule.ipd",
    icon: Bed,
    key: "hospital_ipd_admissions",
    fields: [
      ["patient", "opd.patient"],
      ["consultant", "opd.doctor"],
      ["ward", "opd.department"],
      ["room", "common.address"],
      ["bed", "common.address"],
      ["admissionDate", "common.date", "date"],
      ["status", "common.status", "select", ["admitted", "transferred", "discharged"]],
    ],
    columns: ["patient", "consultant", "ward", "room", "bed", "admissionDate", "status"],
  },
  emergency: {
    titleKey: "hospitalModule.emergency",
    icon: Ambulance,
    key: "hospital_emergency_cases",
    fields: [
      ["patient", "opd.patient"],
      ["arrivalMode", "common.type", "select", ["walk_in", "ambulance", "referral"]],
      ["triageLevel", "common.status", "select", ["red", "orange", "yellow", "green", "blue"]],
      ["chiefComplaint", "opd.chiefComplaint"],
      ["assignedDoctor", "opd.doctor"],
      ["status", "common.status", "select", ["waiting", "in_treatment", "observed", "admitted", "referred", "discharged"]],
    ],
    columns: ["patient", "triageLevel", "chiefComplaint", "assignedDoctor", "status"],
  },
  emr: {
    titleKey: "hospitalModule.emr",
    icon: ClipboardList,
    key: "hospital_emr_notes",
    fields: [
      ["patient", "opd.patient"],
      ["doctor", "opd.doctor"],
      ["noteType", "common.type", "select", ["soap", "progress", "history", "procedure", "discharge_summary"]],
      ["diagnosis", "opd.diagnosis"],
      ["plan", "common.notes", "textarea"],
      ["followUp", "common.date", "date"],
    ],
    columns: ["patient", "doctor", "noteType", "diagnosis", "followUp"],
  },
  nursing: {
    titleKey: "hospitalModule.nursing",
    icon: HeartPulse,
    key: "hospital_nursing_tasks",
    fields: [
      ["patient", "opd.patient"],
      ["ward", "opd.department"],
      ["task", "common.name"],
      ["priority", "common.status", "select", ["routine", "urgent", "stat"]],
      ["dueAt", "common.date", "datetime-local"],
      ["status", "common.status", "select", ["pending", "done", "cancelled"]],
    ],
    columns: ["patient", "ward", "task", "priority", "dueAt", "status"],
  },
  documents: {
    titleKey: "hospitalModule.documents",
    icon: Upload,
    key: "hospital_documents",
    fields: [
      ["patient", "opd.patient"],
      ["documentType", "common.type", "select", ["photo", "consent", "prescription", "lab_report", "radiology_report", "staff_document"]],
      ["title", "common.name"],
      ["fileUrl", "common.upload"],
      ["notes", "common.notes", "textarea"],
    ],
    columns: ["patient", "documentType", "title", "fileUrl"],
  },
  insurance: {
    titleKey: "hospitalModule.insurance",
    icon: ShieldCheck,
    key: "hospital_insurance_claims",
    fields: [
      ["patient", "opd.patient"],
      ["provider", "common.name"],
      ["policyNumber", "common.name"],
      ["claimAmount", "common.amount", "number"],
      ["approvalCode", "common.name"],
      ["status", "common.status", "select", ["draft", "submitted", "approved", "rejected", "paid"]],
    ],
    columns: ["patient", "provider", "policyNumber", "claimAmount", "status"],
  },
  ot: {
    titleKey: "hospitalModule.ot",
    icon: Stethoscope,
    key: "hospital_ot_schedule",
    fields: [
      ["patient", "opd.patient"],
      ["operation", "operations.type"],
      ["surgeon", "operations.surgeon"],
      ["anesthetist", "operations.anesthetist"],
      ["scheduledAt", "common.date", "datetime-local"],
      ["status", "common.status", "select", ["scheduled", "in_progress", "completed", "cancelled"]],
    ],
    columns: ["patient", "operation", "surgeon", "scheduledAt", "status"],
  },
  diagnostics: {
    titleKey: "hospitalModule.diagnostics",
    icon: Activity,
    key: "hospital_diagnostic_tracking",
    fields: [
      ["patient", "opd.patient"],
      ["orderType", "common.type", "select", ["pathology", "radiology"]],
      ["sampleId", "common.name"],
      ["barcode", "common.name"],
      ["status", "common.status", "select", ["ordered", "sample_collected", "processing", "reported", "verified"]],
      ["abnormalFlag", "common.status", "select", ["none", "low", "high", "critical"]],
    ],
    columns: ["patient", "orderType", "sampleId", "barcode", "status", "abnormalFlag"],
  },
  print: {
    titleKey: "hospitalModule.print",
    icon: Printer,
    key: "hospital_print_jobs",
    fields: [
      ["patient", "opd.patient"],
      ["document", "common.type", "select", ["invoice", "prescription", "lab_report", "discharge_summary", "payslip", "consent_form"]],
      ["template", "common.name"],
      ["status", "common.status", "select", ["draft", "ready", "printed"]],
    ],
    columns: ["patient", "document", "template", "status"],
  },
};

const DEFAULT_VALUES = {
  status: "booked",
  priority: "routine",
  triageLevel: "yellow",
  arrivalMode: "walk_in",
  noteType: "soap",
  documentType: "consent",
  orderType: "pathology",
  abnormalFlag: "none",
};

const REQUIRED_FIELDS = {
  appointments: ["patient", "doctor", "department", "date", "time"],
  ipd: ["patient", "consultant", "ward", "room", "bed", "admissionDate"],
  emergency: ["patient", "assignedDoctor", "chiefComplaint", "triageLevel"],
  emr: ["patient", "doctor", "noteType", "diagnosis"],
  nursing: ["patient", "ward", "task", "priority", "dueAt"],
  documents: ["patient", "documentType", "title"],
  insurance: ["patient", "provider", "policyNumber", "claimAmount"],
  ot: ["patient", "operation", "surgeon", "scheduledAt"],
  diagnostics: ["patient", "orderType", "sampleId", "status"],
  print: ["patient", "document", "template", "status"],
};

const PATIENT_FIELDS = new Set(["patient"]);
const STAFF_FIELDS = new Set(["doctor", "consultant", "assignedDoctor", "surgeon", "anesthetist"]);

function emptyForm(fields) {
  return Object.fromEntries(fields.map(([name]) => [name, DEFAULT_VALUES[name] || ""]));
}

function Field({ field, value, entityName, entityCode, onChange, onSelectEntity, required, t }) {
  const [name, labelKey, type = "text", options = []] = field;
  const label = `${t(labelKey)}${required ? " *" : ""}`;
  const isPatientField = PATIENT_FIELDS.has(name);
  const isStaffField = STAFF_FIELDS.has(name);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isPatientField && !isStaffField) return undefined;
    if (!query.trim() || value) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      const request = isPatientField
        ? api.get("/patients", { params: { q: query, limit: 8 } }).then((r) => r.data.patients || [])
        : api.get("/hr/staff", { params: { q: query, role: name === "anesthetist" ? undefined : "doctor", limit: 8 } }).then((r) => r.data || []);
      request.then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [isPatientField, isStaffField, query, value]);

  if (isPatientField || isStaffField) {
    const placeholder = isPatientField ? t("patients.searchPlaceholder") : t("common.search");
    return (
      <div className="relative">
        <label className="label">{label}</label>
        {value ? (
          <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            <div className="text-sm">
              <span className="font-medium text-slate-700">{entityName || value}</span>
              {entityCode && <span className="text-slate-400 ms-2">{entityCode}</span>}
            </div>
            <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => onSelectEntity(name, null)}>{t("common.edit")}</button>
          </div>
        ) : (
          <>
            <input className="input" required={required} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
            {(results.length > 0 || searching) && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {searching && <p className="text-xs text-slate-400 px-3 py-2">{t("common.loading")}</p>}
                {results.map((item) => (
                  <button
                    type="button"
                    key={item._id}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => { onSelectEntity(name, item); setQuery(""); setResults([]); }}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-slate-400 text-xs">{item.patientId || item.staffId || item.role?.replaceAll("_", " ")}</span>
                  </button>
                ))}
                {!searching && results.length === 0 && query.trim() && (
                  <p className="text-xs text-slate-400 px-3 py-2">{t("common.noResults")}</p>
                )}
              </div>
            )}
          </>
        )}
        <input type="hidden" required={required} value={value || ""} onChange={() => {}} />
      </div>
    );
  }
  if (type === "select") {
    return (
      <div>
        <label className="label">{label}</label>
        <select className="input" required={required} value={value} onChange={(e) => onChange(name, e.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
    );
  }
  if (type === "textarea") {
    return (
      <div className="sm:col-span-2">
        <label className="label">{label}</label>
        <textarea className="input" required={required} rows={3} value={value} onChange={(e) => onChange(name, e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" required={required} type={type} value={value} onChange={(e) => onChange(name, e.target.value)} />
    </div>
  );
}

export default function HospitalModule({ type }) {
  const { t } = useTranslation();
  const config = MODULES[type] || MODULES.appointments;
  const Icon = config.icon;
  // Rows now come from the API (PostgreSQL via /api/hospital-module/:type)
  // instead of localStorage. This means records are visible to all users,
  // survive browser cache clears, and are included in DB backups.
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(() => emptyForm(config.fields));
  const [filter, setFilter] = useState("");
  const requiredFields = REQUIRED_FIELDS[type] || [];

  // Fetch from the API whenever the module type changes (e.g. user navigates
  // from /appointments to /ipd). Re-runs on dataVersion bumps too, so other
  // pages that bump `dashboard` cause this list to refresh.
  const load = () => {
    api
      .get(`/hospital-module/${type}`)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]));
  };
  useEffect(() => {
    setForm(emptyForm(config.fields));
    load();
    // eslint-disable-next-line
  }, [type]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value || "").toLowerCase().includes(q)));
  }, [filter, rows]);

  const save = async (e) => {
    e.preventDefault();
    if (requiredFields.some((field) => !String(form[field] || "").trim())) {
      toast.error(t("common.required_field"));
      return;
    }
    try {
      const res = await api.post(`/hospital-module/${type}`, form);
      setRows([res.data, ...rows]);
      setForm(emptyForm(config.fields));
      toast.success(t("common.saved"));
      bumpDataVersion(CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    }
  };

  const markDone = async (id) => {
    try {
      const res = await api.put(`/hospital-module/${type}/${id}`, { status: "completed" });
      setRows(rows.map((row) => (row.id === id ? res.data : row)));
      bumpDataVersion(CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    }
  };

  const selectEntity = (name, entity) => {
    setForm((current) => ({
      ...current,
      [name]: entity?._id || "",
      [`${name}Name`]: entity?.name || "",
      [`${name}Code`]: entity?.patientId || entity?.staffId || "",
    }));
  };

  const displayValue = (row, column) => {
    if (PATIENT_FIELDS.has(column) || STAFF_FIELDS.has(column)) return row[`${column}Name`] || row[column] || "-";
    return row[column] || "-";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
            <Icon size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{t(config.titleKey)}</h1>
            <p className="text-sm text-slate-500">{t("hospitalModule.comingSoon")}</p>
          </div>
        </div>
        <input className="input max-w-xs" placeholder={t("common.search")} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <form onSubmit={save} className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {config.fields.map((field) => (
          <Field
            key={field[0]}
            field={field}
            value={form[field[0]] || ""}
            entityName={form[`${field[0]}Name`] || ""}
            entityCode={form[`${field[0]}Code`] || ""}
            onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
            onSelectEntity={selectEntity}
            required={requiredFields.includes(field[0])}
            t={t}
          />
        ))}
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <button className="btn-primary"><Plus size={16} /> {t("common.save")}</button>
        </div>
      </form>

      <div className="card !p-0 table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {config.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}
              <th>{t("common.date")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                {config.columns.map((column) => (
                  <td key={column} className="capitalize">{String(displayValue(row, column)).replaceAll("_", " ")}</td>
                ))}
                <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                <td>
                  {row.status && !["completed", "done", "printed", "paid", "discharged"].includes(row.status) && (
                    <button className="text-xs text-brand-700" onClick={() => markDone(row.id)}>{t("opd.completed")}</button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + 2} className="text-center text-slate-400 py-10">
                  {t("hospitalModule.noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex items-start gap-3">
          <FileText className="text-brand-600 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-slate-600">{t("hospitalModule.comingSoon")}</p>
        </div>
      </div>
    </div>
  );
}
