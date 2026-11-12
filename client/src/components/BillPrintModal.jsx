import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Printer } from "lucide-react";
import api from "../api/axios.js";
import { amountInWords } from "../utils/numberToWords.js";
import { triggerPrint } from "../utils/print.js";

/**
 * BillPrintModal — fetches a billing record by ID, renders the print-area
 * template inline, and auto-triggers window.print() once (just like the
 * Billing page did when opened with ?print=1).
 *
 * Props:
 *   billId   — the billing record _id to fetch and print
 *   onClose  — called when the user dismisses the modal
 */
export default function BillPrintModal({ billId, onClose }) {
  const { t } = useTranslation();
  const [bill, setBill] = useState(null);
  const [settings, setSettings] = useState({ currency: "AFN" });
  const printedRef = useRef(false);

  useEffect(() => {
    if (!billId) return;
    Promise.all([
      api.get(`/billing/${billId}`),
      api.get("/settings"),
    ]).then(([billRes, settingsRes]) => {
      setBill(billRes.data);
      setSettings(settingsRes.data || { currency: "AFN" });
    });
  }, [billId]);

  // Auto-print once the bill data is loaded (mirrors Billing.jsx behaviour)
  useEffect(() => {
    if (!bill || printedRef.current) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => triggerPrint({ delay: 200 }), 300);
    return () => window.clearTimeout(timer);
  }, [bill]);

  if (!billId) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold">{bill ? bill.invoiceNumber : "…"}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => triggerPrint({ delay: 200 })}
              className="text-slate-400 hover:text-slate-600"
              title={t("common.print")}
            >
              <Printer size={18} />
            </button>
            <button onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        {bill ? (
          <div className="p-6 space-y-4">
            <div className="text-sm text-slate-600 flex items-center justify-between">
              <div>
                <p><span className="text-slate-400">{t("billing.patient")}:</span> {bill.patient?.name || "—"}</p>
                <p><span className="text-slate-400">{t("common.date")}:</span> {new Date(bill.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <table className="data-table w-full">
              <thead><tr><th>{t("common.name")}</th><th>{t("common.quantity")}</th><th>{t("common.price")}</th><th>{t("common.total")}</th></tr></thead>
              <tbody>
                {(bill.items || []).map((it, i) => (
                  <tr key={i}><td>{it.description}</td><td>{it.quantity}</td><td>{it.unitPrice}</td><td>{it.total?.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm space-y-1 border-t border-slate-100 pt-3">
              <div className="flex justify-between"><span className="text-slate-400">{t("billing.subtotal")}</span><span>{bill.subTotal?.toLocaleString()} {settings.currency}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t("billing.discount")}</span><span>-{bill.discountTotal?.toLocaleString()} {settings.currency}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t("billing.tax")}</span><span>{bill.taxTotal?.toLocaleString()} {settings.currency}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>{t("common.total")}</span><span>{bill.grandTotal?.toLocaleString()} {settings.currency}</span></div>
              <div className="flex justify-between text-emerald-600"><span>{t("billing.paid")}</span><span>{bill.amountPaid?.toLocaleString()} {settings.currency}</span></div>
              <div className="flex justify-between text-rose-600 font-medium"><span>{t("billing.amount")}</span><span>{bill.balanceDue?.toLocaleString()} {settings.currency}</span></div>
            </div>
          </div>
        ) : (
          <p className="p-6 text-slate-400 text-sm">{t("common.loading")}</p>
        )}

        {bill && (
          <section className="print-area">
            <div className="print-header">
              {settings.logoUrl && <img src={settings.logoUrl} alt="" className="print-logo" />}
              <h1>{settings.clinicName || "Clinic"}</h1>
              <p>{settings.tagline || t("app.name")}</p>
              <p>{[settings.address, settings.phone, settings.email].filter(Boolean).join(" | ")}</p>
              {settings.printHeader && <p>{settings.printHeader}</p>}
            </div>
            <div className="print-title-row">
              <div className="print-title">{t("billing.title")}</div>
              <div className={`print-stamp print-stamp-${bill.status}`}>{bill.status?.replace("_", " ")}</div>
            </div>
            <div className="print-grid">
              <div><strong>{t("billing.invoiceNo")}:</strong> {bill.invoiceNumber}</div>
              <div><strong>{t("common.date")}:</strong> {new Date(bill.createdAt).toLocaleString()}</div>
              <div><strong>{t("billing.patient")}:</strong> {bill.patient?.name || "-"}</div>
              <div><strong>{t("patients.patientId")}:</strong> {bill.patient?.patientId || "-"}</div>
              <div><strong>{t("common.phone")}:</strong> {bill.patient?.phone || "-"}</div>
              <div><strong>{t("patients.gender")}:</strong> {bill.patient?.gender || "-"}</div>
              <div><strong>{t("patients.age")}:</strong> {bill.patient?.age || "-"}</div>
              <div><strong>{t("common.address")}:</strong> {bill.patient?.address || "-"}</div>
              <div><strong>{t("billing.paymentMethod")}:</strong> {(bill.paymentMethod || "cash").replace("_", " ")}</div>
              {bill.opdVisit && <div><strong>{t("opd.doctor")}:</strong> {bill.opdVisit.doctor?.name || "-"}</div>}
              {bill.opdVisit && <div><strong>{t("opd.visitDate")}:</strong> {new Date(bill.opdVisit.visitDate).toLocaleString()}</div>}
            </div>
            <table className="print-table">
              <thead><tr><th>#</th><th>{t("common.name")}</th><th>{t("common.quantity")}</th><th>{t("common.price")}</th><th>{t("common.total")}</th></tr></thead>
              <tbody>
                {(bill.items || []).map((it, i) => (
                  <tr key={`${it.description}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{it.description}</td>
                    <td>{it.quantity}</td>
                    <td>{it.unitPrice?.toLocaleString()} {settings.currency}</td>
                    <td>{it.total?.toLocaleString()} {settings.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bill.opdVisit && (
              <div className="print-section">
                <strong>{t("opd.title")}:</strong> {bill.opdVisit.visitNumber} | {t("opd.doctor")}: {bill.opdVisit.doctor?.name || "-"} | {t("common.status")}: {bill.opdVisit.status?.replace("_", " ") || "-"}
              </div>
            )}
            {(bill.labOrders || []).length > 0 && (
              <div className="print-section">
                <strong>{t("lab.tests")}:</strong>
                <ul>
                  {bill.labOrders.map((order) => (
                    <li key={order._id || order.id}>{order.orderNumber}: {order.items?.map((item) => item.name).join(", ")}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="print-totals">
              <div><span>{t("billing.subtotal")}</span><strong>{bill.subTotal?.toLocaleString()} {settings.currency}</strong></div>
              <div><span>{t("billing.discount")}</span><strong>{bill.discountTotal?.toLocaleString()} {settings.currency}</strong></div>
              <div><span>{t("billing.tax")}</span><strong>{bill.taxTotal?.toLocaleString()} {settings.currency}</strong></div>
              <div><span>{t("common.total")}</span><strong>{bill.grandTotal?.toLocaleString()} {settings.currency}</strong></div>
              <div><span>{t("billing.paid")}</span><strong>{bill.amountPaid?.toLocaleString()} {settings.currency}</strong></div>
              <div><span>{t("billing.amount")}</span><strong>{bill.balanceDue?.toLocaleString()} {settings.currency}</strong></div>
            </div>
            <p className="print-words"><strong>{t("opd.amountInWords")}:</strong> {amountInWords(bill.grandTotal, settings.currency)}</p>
            {bill.notes && <div className="print-section"><strong>{t("common.notes")}:</strong> {bill.notes}</div>}
            <div className="print-signature">{t("opd.cashierSignature")}</div>
            {settings.printFooter && <div className="print-footer">{settings.printFooter}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
