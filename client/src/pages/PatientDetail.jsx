import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ArrowLeft, Stethoscope, Receipt } from "lucide-react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRole } from "../utils/permissions.js";

export default function PatientDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canBookVisit = hasRole(user, "receptionist", "doctor");
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [bills, setBills] = useState([]);

  useEffect(() => {
    api.get(`/patients/${id}`).then((r) => setPatient(r.data)).catch(() => toast.error(t("common.error")));
    // Server-side filtering: ask /opd and /billing to return only this
    // patient's records instead of fetching the 200 most recent across ALL
    // patients and filtering client-side (which silently misses anything
    // older than the cap). The backend routes already accept a `patient`
    // query param.
    api.get("/opd", { params: { patient: id, limit: 200 } })
      .then((r) => setVisits(r.data.visits || []))
      .catch(() => setVisits([]));
    api.get("/billing", { params: { patient: id, limit: 100 } })
      .then((r) => setBills(r.data.bills || []))
      .catch(() => setBills([]));
  }, [id, t]);

  if (!patient) return <p className="text-slate-400">{t("common.loading")}</p>;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-semibold">
            {patient.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {patient.name}
              {patient.dead && <span className="badge bg-slate-200 text-slate-600">{t("common.delete")}</span>}
              {patient.tpa?.isTPA && <span className="badge bg-indigo-100 text-indigo-700">{t("nav.insurance")}</span>}
            </h1>
            <p className="text-sm text-slate-500 font-mono">{patient.patientId}</p>
            <p className="text-sm text-slate-500 capitalize">{t(`patients.${patient.gender}`, { defaultValue: patient.gender })} • <span dir="ltr">{patient.phone}</span></p>
          </div>
        </div>
        <div className="flex gap-2">
          {canBookVisit && <Link to={`/opd?patient=${patient._id}&new=1`} className="btn-primary"><Stethoscope size={16} /> {t("opd.newVisit")}</Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard label={t("common.address")} value={[patient.province, patient.city].filter(Boolean).join(", ") || "—"} />
        <InfoCard label={t("patients.bloodGroup")} value={patient.bloodGroup || "—"} />
        <InfoCard label={t("patients.fullName")} value={patient.guardianName || "—"} />
        <InfoCard label={t("patients.patientId")} value={patient.nationalId || "—"} />
        <InfoCard label={t("common.status")} value={patient.maritalStatus?.replace("_", " ") || "—"} />
        <InfoCard label={t("nav.insurance")} value={patient.tpa?.provider || "—"} />
        <InfoCard label={t("common.address")} value={patient.address || "—"} />
        <InfoCard label={t("common.notes")} value={patient.remarks || "—"} />
      </div>

      <div className="card">
        <h3 className="font-medium text-slate-700 mb-3">{t("opd.title")}</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("common.date")}</th><th>{t("opd.doctor")}</th><th>{t("common.status")}</th><th>{t("opd.diagnosis")}</th></tr></thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v._id} className="cursor-pointer" onClick={() => navigate(`/opd/${v._id}`)}>
                  <td className="font-mono text-xs">{v.visitNumber}</td>
                  <td>{new Date(v.visitDate).toLocaleDateString()}</td>
                  <td>{v.doctor?.name}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td>{v.diagnosis || "—"}</td>
                </tr>
              ))}
              {visits.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">{t("opd.noVisits")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-slate-700 mb-3">{t("billing.title")}</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("common.date")}</th><th>{t("common.total")}</th><th>{t("billing.paid")}</th><th>{t("common.status")}</th></tr></thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b._id} className="cursor-pointer" onClick={() => navigate(`/billing?id=${b._id}`)}>
                  <td className="font-mono text-xs">{b.invoiceNumber}</td>
                  <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td>{b.grandTotal?.toLocaleString()}</td>
                  <td>{b.amountPaid?.toLocaleString()}</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {bills.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">{t("billing.noBills")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const InfoCard = ({ label, value }) => (
  <div className="card">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="text-sm font-medium text-slate-700 mt-1">{value}</p>
  </div>
);

export const StatusBadge = ({ status }) => {
  const colors = {
    paid: "bg-emerald-100 text-emerald-700",
    unpaid: "bg-rose-100 text-rose-700",
    partially_paid: "bg-amber-100 text-amber-700",
    cancelled: "bg-slate-200 text-slate-600",
    completed: "bg-emerald-100 text-emerald-700",
    waiting: "bg-amber-100 text-amber-700",
    in_consultation: "bg-brand-100 text-brand-700",
  };
  return <span className={`badge ${colors[status] || "bg-slate-100 text-slate-600"}`}>{status?.replace("_", " ")}</span>;
};
