import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Trash2, Receipt, CheckCircle2, Printer, AlertTriangle } from "lucide-react";
import api from "../api/axios.js";
import { StatusBadge } from "./PatientDetail.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRole } from "../utils/permissions.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";
import { triggerPrint } from "../utils/print.js";
import BillPrintModal from "../components/BillPrintModal.jsx";

const normalizeMedicineName = (value = "") => value.trim().toLowerCase();

export default function OPDVisitDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = hasRole(user, "doctor", "nurse");
  const [visit, setVisit] = useState(null);
  const [vitalDefs, setVitalDefs] = useState([]);
  const [settings, setSettings] = useState({ clinicName: "Clinic", currency: "AFN" });
  const [medicineStock, setMedicineStock] = useState([]);
  const [saving, setSaving] = useState(false);
  const [printBillId, setPrintBillId] = useState(null);

  const [vitals, setVitals] = useState([]);
  const [symptoms, setSymptoms] = useState("");
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [prescription, setPrescription] = useState([{ medicineName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);

  const load = () => api.get(`/opd/${id}`).then((r) => {
    const v = r.data;
    setVisit(v);
    setVitals(v.vitals?.length ? v.vitals : []);
    setSymptoms((v.symptoms || []).join(", "));
    setFindings((v.findings || []).join(", "));
    setDiagnosis(v.diagnosis || "");
    setNotes(v.notes || "");
    if (v.prescription?.length) setPrescription(v.prescription);
  });

  useEffect(() => {
    load();
    api.get("/setup/vitals").then((r) => setVitalDefs(r.data));
    api.get("/settings").then((r) => setSettings(r.data));
    api.get("/opd/medicine-stock").then((r) => setMedicineStock(r.data));
    // eslint-disable-next-line
  }, [id]);

  const medicineStockByName = useMemo(() => {
    const stockMap = new Map();
    medicineStock.forEach((medicine) => stockMap.set(normalizeMedicineName(medicine.name), medicine));
    return stockMap;
  }, [medicineStock]);

  const getMedicineStockInfo = (name) => {
    const term = normalizeMedicineName(name);
    if (!term) return null;
    const exact = medicineStockByName.get(term);
    if (exact) {
      return exact.availableQty > 0
        ? { type: "in", text: `${t("pharmacy.stock")}: ${exact.availableQty} ${exact.unit || ""}` }
        : { type: "out", text: t("pharmacy.outOfStock") };
    }
    const closeMatch = medicineStock.find((medicine) => normalizeMedicineName(medicine.name).includes(term));
    if (closeMatch) {
      return closeMatch.availableQty > 0
        ? { type: "in", text: `${closeMatch.name}: ${closeMatch.availableQty} ${closeMatch.unit || ""}` }
        : { type: "out", text: `${closeMatch.name} — ${t("pharmacy.outOfStock")}` };
    }
    return { type: "out", text: t("pharmacy.outOfStock") };
  };

  const toggleVital = (vd) => {
    setVitals((prev) => {
      const exists = prev.find((x) => x.name === vd.name);
      if (exists) return prev.filter((x) => x.name !== vd.name);
      return [...prev, { vital: vd._id, name: vd.name, unit: vd.unit, value: "" }];
    });
  };
  const setVitalValue = (name, value) => setVitals((prev) => prev.map((v) => (v.name === name ? { ...v, value } : v)));

  const updatePrescriptionRow = (i, field, value) => {
    setPrescription((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };
  const addPrescriptionRow = () => setPrescription((p) => [...p, { medicineName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const removePrescriptionRow = (i) => setPrescription((p) => p.filter((_, idx) => idx !== i));

  const saveConsultation = async () => {
    setSaving(true);
    try {
      await api.put(`/opd/${id}`, {
        vitals,
        symptoms: symptoms.split(",").map((s) => s.trim()).filter(Boolean),
        findings: findings.split(",").map((s) => s.trim()).filter(Boolean),
        diagnosis,
        notes,
        prescription: prescription.filter((p) => p.medicineName),
        status: "in_consultation",
      });
      toast.success(t("common.saved"));
      load();
      bumpDataVersion(CHANNELS.opd, CHANNELS.dashboard);
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const printPrescription = () => {
    if (!prescription.some((row) => row.medicineName?.trim())) return toast.error(t("common.required_field"));
    triggerPrint({ delay: 200 });
  };

  const completeAndBill = async () => {
    setSaving(true);
    try {
      await saveConsultation();
      let billId = visit.bill?._id || visit.bill;
      if (!billId) {
        const billRes = await api.post("/billing", {
          patient: visit.patient._id,
          opdVisit: visit._id,
          items: [
            {
              description: t("opd.title"),
              category: "opd",
              quantity: 1,
              unitPrice: visit.consultationFee || 0,
              taxPercent: 0,
              discountPercent: 0,
            },
          ],
        });
        billId = billRes.data._id;
      }
      await api.post(`/opd/${id}/complete`);
      toast.success(t("common.saved"));
      bumpDataVersion(CHANNELS.opd, CHANNELS.billing, CHANNELS.pharmacy, CHANNELS.dashboard);
      setPrintBillId(billId);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!visit) return <p className="text-slate-400">{t("common.loading")}</p>;

  const printablePrescription = prescription.filter((row) => row.medicineName?.trim());

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{visit.visitNumber} - {visit.patient?.name}</h1>
          <p className="text-sm text-slate-500">{visit.patient?.patientId} - {t("opd.doctor")} {visit.doctor?.name} - {new Date(visit.visitDate).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={printPrescription}><Printer size={16} /> {t("common.print")}</button>
          <StatusBadge status={visit.status} />
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-slate-700 mb-3">{t("opd.vitals")}</h3>
        {canEdit ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {vitalDefs.map((vd) => {
                const active = vitals.some((v) => v.name === vd.name);
                return (
                  <button
                    key={vd._id}
                    type="button"
                    onClick={() => toggleVital(vd)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${active ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {vd.name}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {vitals.map((v) => (
                <div key={v.name}>
                  <label className="label">{v.name} {v.unit && `(${v.unit})`}</label>
                  <input className="input" value={v.value} onChange={(e) => setVitalValue(v.name, e.target.value)} />
                </div>
              ))}
            </div>
          </>
        ) : vitals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {vitals.map((v) => (
              <div key={v.name}>
                <p className="text-xs text-slate-400">{v.name} {v.unit && `(${v.unit})`}</p>
                <p className="text-sm font-medium text-slate-700">{v.value || "-"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t("common.noData")}</p>
        )}
      </div>

      <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
        {canEdit ? (
          <>
            <div>
              <label className="label">{t("opd.chiefComplaint")}</label>
              <input className="input" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("lab.findings")}</label>
              <input className="input" value={findings} onChange={(e) => setFindings(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("opd.diagnosis")}</label>
              <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("common.notes")}</label>
              <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div><p className="text-xs text-slate-400">{t("opd.chiefComplaint")}</p><p className="text-sm text-slate-700">{symptoms || "-"}</p></div>
            <div><p className="text-xs text-slate-400">{t("lab.findings")}</p><p className="text-sm text-slate-700">{findings || "-"}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-slate-400">{t("opd.diagnosis")}</p><p className="text-sm text-slate-700">{diagnosis || "-"}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-slate-400">{t("common.notes")}</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{notes || "-"}</p></div>
          </>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-700">{t("opd.prescription")}</h3>
          {canEdit && <button type="button" className="btn-secondary !py-1 !px-2 text-xs" onClick={addPrescriptionRow}><Plus size={14} /> {t("common.add")}</button>}
        </div>
        {canEdit ? (
          <div className="space-y-2">
            <datalist id="opd-medicine-stock">
              {medicineStock.map((medicine) => (
                <option key={medicine._id || medicine.id} value={medicine.name} />
              ))}
            </datalist>
            {prescription.map((row, i) => (
              <PrescriptionRow
                key={i}
                row={row}
                index={i}
                stockInfo={getMedicineStockInfo(row.medicineName)}
                onChange={updatePrescriptionRow}
                onRemove={removePrescriptionRow}
                t={t}
              />
            ))}
          </div>
        ) : printablePrescription.length > 0 ? (
          <div className="table-wrap !p-0 border border-slate-100 rounded-lg">
            <table className="data-table">
              <thead><tr><th>{t("opd.medication")}</th><th>{t("opd.dosage")}</th><th>{t("opd.frequency")}</th><th>{t("opd.duration")}</th><th>{t("opd.instructions")}</th></tr></thead>
              <tbody>
                {printablePrescription.map((row, i) => (
                  <tr key={i}><td className="font-medium">{row.medicineName}</td><td>{row.dosage || "-"}</td><td>{row.frequency || "-"}</td><td>{row.duration || "-"}</td><td>{row.instructions || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t("common.noData")}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {canEdit && <button className="btn-secondary" disabled={saving} onClick={saveConsultation}>{t("common.save")}</button>}
        {canEdit && visit.status !== "completed" && (
          <button className="btn-primary" disabled={saving} onClick={completeAndBill}>
            <CheckCircle2 size={16} /> {t("opd.completed")}
          </button>
        )}
        {visit.bill && (
          <button className="btn-secondary" onClick={() => setPrintBillId(visit.bill?._id || visit.bill)}><Receipt size={16} /> {t("common.view")}</button>
        )}
      </div>

      {printBillId && <BillPrintModal billId={printBillId} onClose={() => setPrintBillId(null)} />}

      <section className="print-area">
        <div className="print-header">
          {settings.logoUrl && <img src={settings.logoUrl} alt="" className="print-logo" />}
          <h1>{settings.clinicName || "Clinic"}</h1>
          <p>{settings.tagline || t("app.name")}</p>
          <p>{[settings.address, settings.phone, settings.email].filter(Boolean).join(" | ")}</p>
          {settings.printHeader && <p>{settings.printHeader}</p>}
        </div>
        <div className="print-title">{t("opd.prescription")}</div>
        <div className="print-grid">
          <div><strong>{t("opd.patient")}:</strong> {visit.patient?.name}</div>
          <div><strong>{t("patients.patientId")}:</strong> {visit.patient?.patientId}</div>
          <div><strong>{t("patients.age")} / {t("patients.gender")}:</strong> {[visit.patient?.age, visit.patient?.gender].filter(Boolean).join(" / ")}</div>
          <div><strong>{t("common.date")}:</strong> {new Date(visit.visitDate).toLocaleString()}</div>
          <div><strong>{t("opd.doctor")}:</strong> {visit.doctor?.name}</div>
          <div><strong>{t("billing.invoiceNo")}:</strong> {visit.visitNumber}</div>
        </div>
        <div className="print-section">
          <strong>{t("opd.diagnosis")}:</strong> {diagnosis || "-"}
        </div>
        <table className="print-table">
          <thead>
            <tr><th>#</th><th>{t("opd.medication")}</th><th>{t("opd.dosage")}</th><th>{t("opd.frequency")}</th><th>{t("opd.duration")}</th><th>{t("opd.instructions")}</th></tr>
          </thead>
          <tbody>
            {printablePrescription.map((row, i) => (
              <tr key={`${row.medicineName}-${i}`}>
                <td>{i + 1}</td>
                <td>{row.medicineName}</td>
                <td>{row.dosage || "-"}</td>
                <td>{row.frequency || "-"}</td>
                <td>{row.duration || "-"}</td>
                <td>{row.instructions || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-section">
          <strong>{t("common.notes")}:</strong> {notes || "-"}
        </div>
        <div className="print-signature">{t("opd.doctor")}</div>
        {settings.printFooter && <div className="print-footer">{settings.printFooter}</div>}
      </section>
    </div>
  );
}

function PrescriptionRow({ row, index, stockInfo, onChange, onRemove, t }) {
  const stockClass = stockInfo?.type === "out" ? "text-rose-600 bg-rose-50" : "text-emerald-700 bg-emerald-50";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-start">
      <div className="sm:col-span-2">
        <input
          className="input"
          list="opd-medicine-stock"
          placeholder={t("opd.medication")}
          value={row.medicineName}
          onChange={(e) => onChange(index, "medicineName", e.target.value)}
        />
        {stockInfo && (
          <div className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${stockClass}`}>
            {stockInfo.type === "out" && <AlertTriangle size={13} />}
            {stockInfo.text}
          </div>
        )}
      </div>
      <input className="input" placeholder={t("opd.dosage")} value={row.dosage} onChange={(e) => onChange(index, "dosage", e.target.value)} />
      <input className="input" placeholder={t("opd.frequency")} value={row.frequency} onChange={(e) => onChange(index, "frequency", e.target.value)} />
      <input className="input" placeholder={t("opd.duration")} value={row.duration} onChange={(e) => onChange(index, "duration", e.target.value)} />
      <div className="flex gap-1">
        <input className="input" placeholder={t("opd.instructions")} value={row.instructions} onChange={(e) => onChange(index, "instructions", e.target.value)} />
        <button type="button" onClick={() => onRemove(index)} className="text-rose-500 p-2"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}
