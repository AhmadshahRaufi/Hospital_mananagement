import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import api from "../api/axios.js";

export default function Finance() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("income");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("finance.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("income")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "income" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><TrendingUp size={14} /> {t("finance.income")}</button>
        <button onClick={() => setTab("expense")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "expense" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}><TrendingDown size={14} /> {t("finance.expense")}</button>
      </div>
      {tab === "income" ? <IncomeTab /> : <ExpenseTab />}
    </div>
  );
}

function IncomeTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [heads, setHeads] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", incomeHead: "", description: "", amount: "" });
  const [newHead, setNewHead] = useState("");

  const load = () => api.get("/finance/income").then((r) => setRows(r.data));
  useEffect(() => { load(); api.get("/finance/income-heads").then((r) => setHeads(r.data)); }, []);

  const addHead = async () => {
    if (!newHead) return;
    const r = await api.post("/finance/income-heads", { name: newHead });
    setHeads([...heads, r.data]);
    setForm({ ...form, incomeHead: r.data._id });
    setNewHead("");
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/finance/income", { ...form, amount: Number(form.amount) });
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ name: "", incomeHead: "", description: "", amount: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{t("finance.income")}: <span className="font-semibold text-emerald-600">{total.toLocaleString()}</span></p>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("finance.newIncome")}</button>
      </div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("common.name")}</th><th>{t("finance.category")}</th><th>{t("common.date")}</th><th>{t("common.amount")}</th><th>—</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}><td className="font-mono text-xs">{r.invoiceNumber}</td><td>{r.name}</td><td>{r.incomeHead?.name || "—"}</td><td>{new Date(r.date).toLocaleDateString()}</td><td>{r.amount.toLocaleString()}</td><td>{r.generatedBy?.name || "—"}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("finance.noTransactions")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("finance.newIncome")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("common.name")} *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <label className="label">{t("finance.category")}</label>
                <div className="flex gap-2">
                  <select className="input" value={form.incomeHead} onChange={(e) => setForm({ ...form, incomeHead: e.target.value })}>
                    <option value="">{t("common.select")}…</option>
                    {heads.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 mt-1">
                  <input className="input !py-1 text-xs" placeholder={t("finance.newIncome")} value={newHead} onChange={(e) => setNewHead(e.target.value)} />
                  <button type="button" className="btn-secondary !py-1 !px-2 text-xs" onClick={addHead}>{t("common.add")}</button>
                </div>
              </div>
              <div><label className="label">{t("common.amount")} *</label><input type="number" className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="label">{t("common.description")}</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [heads, setHeads] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", expenseHead: "", description: "", amount: "" });
  const [newHead, setNewHead] = useState("");

  const load = () => api.get("/finance/expense").then((r) => setRows(r.data));
  useEffect(() => { load(); api.get("/finance/expense-heads").then((r) => setHeads(r.data)); }, []);

  const addHead = async () => {
    if (!newHead) return;
    const r = await api.post("/finance/expense-heads", { name: newHead });
    setHeads([...heads, r.data]);
    setForm({ ...form, expenseHead: r.data._id });
    setNewHead("");
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/finance/expense", { ...form, amount: Number(form.amount) });
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ name: "", expenseHead: "", description: "", amount: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{t("finance.expense")}: <span className="font-semibold text-rose-600">{total.toLocaleString()}</span></p>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("finance.newExpense")}</button>
      </div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("common.name")}</th><th>{t("finance.category")}</th><th>{t("common.date")}</th><th>{t("common.amount")}</th><th>—</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}><td className="font-mono text-xs">{r.voucherNumber}</td><td>{r.name}</td><td>{r.expenseHead?.name || "—"}</td><td>{new Date(r.date).toLocaleDateString()}</td><td>{r.amount.toLocaleString()}</td><td>{r.generatedBy?.name || "—"}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("finance.noTransactions")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("finance.newExpense")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("common.name")} *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <label className="label">{t("finance.category")}</label>
                <select className="input" value={form.expenseHead} onChange={(e) => setForm({ ...form, expenseHead: e.target.value })}>
                  <option value="">{t("common.select")}…</option>
                  {heads.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
                <div className="flex gap-2 mt-1">
                  <input className="input !py-1 text-xs" placeholder={t("finance.newExpense")} value={newHead} onChange={(e) => setNewHead(e.target.value)} />
                  <button type="button" className="btn-secondary !py-1 !px-2 text-xs" onClick={addHead}>{t("common.add")}</button>
                </div>
              </div>
              <div><label className="label">{t("common.amount")} *</label><input type="number" className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="label">{t("common.description")}</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
