import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  TrendingUp, TrendingDown, Users, AlertTriangle, Activity, Wallet, Stethoscope,
  Receipt, Pill, FlaskConical, ClipboardList, Boxes, ArrowRight,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { hasRole, roleLabel } from "../utils/permissions.js";
import useCountUp from "../hooks/useCountUp.js";
import RevenueTrendChart from "../components/RevenueTrendChart.jsx";
import { onDataVersionChange, CHANNELS } from "../utils/dataVersion.js";

const fmt = (n, currency = "AFN") => `${currency} ${Math.round(Number(n || 0)).toLocaleString()}`;
const COLORS = ["#1c5ff5", "#58a4ff", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

const TONE_CLASSES = {
  brand: "bg-brand-100 text-brand-600",
  emerald: "bg-emerald-100 text-emerald-600",
  rose: "bg-rose-100 text-rose-600",
  indigo: "bg-indigo-100 text-indigo-600",
  amber: "bg-amber-100 text-amber-600",
};

// A KPI card whose numeric value counts up on mount/refresh rather than
// snapping straight to the number — `value` must be a plain number;
// `format` turns it into the display string.
const KpiCard = ({ icon: Icon, label, value, format = (v) => v.toLocaleString(), sub, tone = "brand", delay = 0 }) => {
  const animated = useCountUp(value);
  return (
    <div className="card flex items-start justify-between animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold mt-1 text-slate-800 tabular-nums">{format(animated)}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${TONE_CLASSES[tone]}`}>
        <Icon size={20} />
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [settings, setSettings] = useState({ currency: "AFN", clinicName: "My OPD Clinic" });

  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data)).catch(() => {}); }, []);

  const isFinanceView = hasRole(user, "accountant");
  // Use the active language's locale for date formatting so Persian/Pashto
  // users see a localized weekday + month name instead of always-English.
  const locale = i18n.language?.startsWith("fa") ? "fa-AF" : i18n.language?.startsWith("ps") ? "ps-AF" : undefined;
  const dateLine = new Date().toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {settings.clinicName} — {isFinanceView ? t("dashboard.commandCenter") : `${roleLabel(user?.role)} ${t("dashboard.dashboardSuffix")}`}
          </h1>
          <p className="text-sm text-slate-500">{dateLine}</p>
        </div>
      </div>

      {isFinanceView ? <FinancialDashboard settings={settings} /> : <WorkspaceDashboard user={user} settings={settings} />}
    </div>
  );
}

function FinancialDashboard({ settings }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const navigate = useNavigate();
  const currency = settings.currency || "AFN";

  const load = () => api.get("/dashboard/summary").then((r) => setSummary(r.data)).catch(() => {});

  useEffect(() => {
    load();
    // Refetch the dashboard whenever any of these channels fire — paying a
    // bill, marking a patient deceased, completing an OPD visit, selling
    // medicine, verifying a lab order, or adjusting inventory all change
    // KPIs on this screen.
    const unsubscribe = onDataVersionChange(
      [CHANNELS.billing, CHANNELS.patients, CHANNELS.opd, CHANNELS.pharmacy, CHANNELS.lab, CHANNELS.inventory, CHANNELS.dashboard],
      () => load()
    );
    return unsubscribe;
  }, []);

  const categoryData = summary
    ? Object.entries(summary.revenueByCategory || {}).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" onClick={() => navigate("/pharmacy")}>{t("dashboard.pharmacyPurchase")}</button>
        <button className="btn-secondary" onClick={() => navigate("/finance")}>{t("dashboard.expense")}</button>
        <button className="btn-secondary" onClick={() => navigate("/patients")}>{t("dashboard.patientSearch")}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label={t("dashboard.monthlyRevenue")} value={summary?.monthlyRevenue || 0} format={(v) => fmt(v, currency)} tone="emerald" delay={0} />
        <KpiCard icon={TrendingDown} label={t("dashboard.monthlyExpense")} value={summary?.monthlyExpense || 0} format={(v) => fmt(v, currency)} tone="rose" delay={60} />
        <KpiCard icon={Wallet} label={t("dashboard.netMonthlyIncome")} value={summary?.monthlyNetIncome || 0} format={(v) => fmt(v, currency)} sub={t("dashboard.profitMargin", { value: summary?.profitMargin ?? 0 })} tone="brand" delay={120} />
        <KpiCard icon={Users} label={t("dashboard.totalPatients")} value={summary?.totalPatients || 0} sub={t("dashboard.newThisMonth", { value: summary?.newPatientsThisMonth ?? 0 })} tone="indigo" delay={180} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Activity} label={t("dashboard.waitingConsultation")} value={summary?.pendingVisitsToday || 0} tone="amber" delay={240} />
        <KpiCard icon={AlertTriangle} label={t("dashboard.lowStockMedicines")} value={summary?.lowStockCount || 0} tone="rose" delay={300} />
        <KpiCard icon={TrendingUp} label={t("dashboard.yearlyRevenue")} value={summary?.yearlyRevenue || 0} format={(v) => fmt(v, currency)} tone="emerald" delay={360} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueTrendChart currency={currency} title={t("dashboard.revenueAndIncome")} />
        </div>
        <div className="card animate-fade-up" style={{ animationDelay: "80ms" }}>
          <h3 className="font-medium text-slate-700 mb-4">{t("dashboard.revenueByDept")}</h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">{t("dashboard.noRevenue")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} animationDuration={700}>
                  {categoryData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v, currency)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card animate-fade-up" style={{ animationDelay: "120ms" }}>
        <h3 className="font-medium text-slate-700 mb-4">{t("dashboard.staffDirectory")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
          {summary?.staffSummary &&
            Object.entries(summary.staffSummary).map(([role, count]) => (
              <div key={role} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3 text-center">
                <p className="text-lg font-semibold text-slate-800">{count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{roleLabel(role)}</p>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

// Lighter, role-tailored view for everyone who isn't looking at clinic
// financials — today's operational counters only, nothing about revenue,
// salaries, or anything outside that role's own scope.
function WorkspaceDashboard({ user, settings }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  const load = () => api.get("/dashboard/workspace").then((r) => setData(r.data)).catch(() => {});

  useEffect(() => {
    load();
    // Same pattern as FinancialDashboard — refetch when something on
    // another page changes the underlying counters (visit completed,
    // bill paid, patient registered, etc.).
    const unsubscribe = onDataVersionChange(
      [CHANNELS.opd, CHANNELS.billing, CHANNELS.patients, CHANNELS.pharmacy, CHANNELS.lab, CHANNELS.inventory, CHANNELS.dashboard],
      () => load()
    );
    return unsubscribe;
  }, []);

  if (!data) return <p className="text-slate-400">{t("common.loading")}</p>;

  if (data.role === "doctor") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={Activity} label={t("dashboard.waitingForYou")} value={data.waitingCount || 0} tone="amber" delay={0} />
          <KpiCard icon={Stethoscope} label={t("dashboard.completedToday")} value={data.myCompletedToday || 0} tone="emerald" delay={60} />
          <KpiCard icon={Users} label={t("dashboard.totalPatientsSeen")} value={data.myTotalPatients || 0} tone="indigo" delay={120} />
        </div>
        <div className="card animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-700">{t("dashboard.yourQueueToday")}</h3>
            <button className="text-sm text-brand-600 flex items-center gap-1" onClick={() => navigate("/opd")}>{t("dashboard.openOpd")} <ArrowRight size={14} className="rtl:flip-x" /></button>
          </div>
          {data.myQueue?.length ? (
            <div className="divide-y divide-slate-100">
              {data.myQueue.map((v) => (
                <button key={v._id} onClick={() => navigate(`/opd/${v._id}`)} className="w-full flex items-center justify-between py-2.5 text-sm hover:bg-slate-50 px-2 -mx-2 rounded-lg text-start">
                  <span className="font-medium text-slate-700">{v.patient?.name}</span>
                  <span className="text-slate-400">{v.patient?.patientId} · {v.status.replace("_", " ")}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">{t("dashboard.noOneWaiting")}</p>
          )}
        </div>
      </div>
    );
  }

  if (data.role === "receptionist") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Users} label={t("dashboard.visitsToday")} value={data.visitsToday || 0} tone="brand" delay={0} />
        <KpiCard icon={Activity} label={t("dashboard.currentlyWaiting")} value={data.waiting || 0} tone="amber" delay={60} />
        <KpiCard icon={Wallet} label={t("dashboard.collectedToday")} value={data.collectionsToday || 0} format={(v) => fmt(v, settings.currency)} tone="emerald" delay={120} />
        <KpiCard icon={Receipt} label={t("dashboard.unpaidBillsToday")} value={data.unpaidBillsToday || 0} tone="rose" delay={180} />
      </div>
    );
  }

  if (data.role === "nurse") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard icon={Users} label={t("dashboard.visitsToday")} value={data.visitsToday || 0} tone="brand" delay={0} />
          <KpiCard icon={Activity} label={t("dashboard.waitingForVitals")} value={data.waitingQueue?.length || 0} tone="amber" delay={60} />
        </div>
        <div className="card animate-fade-up">
          <h3 className="font-medium text-slate-700 mb-3">{t("dashboard.waitingQueue")}</h3>
          {data.waitingQueue?.length ? (
            <div className="divide-y divide-slate-100">
              {data.waitingQueue.map((v) => (
                <button key={v._id} onClick={() => navigate(`/opd/${v._id}`)} className="w-full flex items-center justify-between py-2.5 text-sm hover:bg-slate-50 px-2 -mx-2 rounded-lg text-start">
                  <span className="font-medium text-slate-700">{v.patient?.name}</span>
                  <span className="text-slate-400">{t("opd.doctor")} {v.doctor?.name}</span>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 py-6 text-center">{t("dashboard.nobodyWaiting")}</p>}
        </div>
      </div>
    );
  }

  if (data.role === "pharmacist" || data.role === "inventory_manager") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Pill} label={t("dashboard.salesToday")} value={data.salesToday || 0} tone="brand" delay={0} />
        <KpiCard icon={Wallet} label={t("dashboard.salesTotalToday")} value={data.salesTotalToday || 0} format={(v) => fmt(v, settings.currency)} tone="emerald" delay={60} />
        <KpiCard icon={AlertTriangle} label={t("dashboard.lowStockMedicines")} value={data.lowStockMedicines || 0} tone="rose" delay={120} />
        <KpiCard icon={Boxes} label={t("dashboard.lowStockInventory")} value={data.lowStockInventory || 0} tone="amber" delay={180} />
      </div>
    );
  }

  if (data.role === "lab_tech" || data.role === "radiologist") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard icon={FlaskConical} label={t("dashboard.pendingOrders")} value={data.pending || 0} tone="amber" delay={0} />
        <KpiCard icon={ClipboardList} label={t("dashboard.completedTodayLab")} value={data.completedToday || 0} tone="emerald" delay={60} />
      </div>
    );
  }

  return <p className="text-slate-400">{t("dashboard.welcomeBack")}</p>;
}
