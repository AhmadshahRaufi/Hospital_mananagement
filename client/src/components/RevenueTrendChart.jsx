import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../api/axios.js";

const fmt = (n, currency = "") => `${currency ? currency + " " : ""}${Number(n || 0).toLocaleString()}`;

// Revenue / other income / expense over time, with a Daily <-> Monthly
// toggle. Used on the super admin dashboard and again in Reports so both
// places show the same shape of chart per the brief ("daily, monthly... and
// same in the reports section"). Recharts animates the area draw-in by
// default; we also fade the whole card in on mount/period switch.
export default function RevenueTrendChart({ currency = "", title = "Revenue & Income", defaultPeriod = "daily", height = 300 }) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = period === "daily" ? "/dashboard/daily-trend" : "/dashboard/monthly-trend";
    api
      .get(url, period === "daily" ? { params: { days: 30 } } : undefined)
      .then((r) => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="card animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-slate-700">{title} — {period === "daily" ? "Last 30 Days" : "Last 12 Months"}</h3>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {["daily", "monthly"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                period === p ? "bg-white shadow-sm text-brand-700" : "text-slate-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-slate-400 animate-pulse-soft">Loading chart…</div>
      ) : data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">No data for this period yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} key={period}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1c5ff5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#1c5ff5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "daily" ? 3 : 0} />
            <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip formatter={(v, name) => [fmt(v, currency), name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1c5ff5" fill="url(#revGrad)" strokeWidth={2} animationDuration={700} />
            <Area type="monotone" dataKey="otherIncome" name="Other Income" stroke="#22c55e" fill="url(#incGrad)" strokeWidth={2} animationDuration={700} animationBegin={100} />
            <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} animationDuration={700} animationBegin={200} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
