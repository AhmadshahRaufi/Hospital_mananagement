import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, Users, CalendarCheck, FileText, Wallet } from "lucide-react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin, roleLabel } from "../utils/permissions.js";
import { bumpDataVersion, CHANNELS } from "../utils/dataVersion.js";

const ROLE_OPTIONS = ["admin", "receptionist", "doctor", "pharmacist", "lab_tech", "radiologist", "accountant", "inventory_manager", "nurse"];

export default function HR() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("staff");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("hr.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <TabBtn active={tab === "staff"} onClick={() => setTab("staff")} icon={Users} label={t("hr.staff")} />
        <TabBtn active={tab === "attendance"} onClick={() => setTab("attendance")} icon={CalendarCheck} label={t("common.date")} />
        <TabBtn active={tab === "leave"} onClick={() => setTab("leave")} icon={FileText} label={t("hr.onLeave")} />
        <TabBtn active={tab === "payroll"} onClick={() => setTab("payroll")} icon={Wallet} label={t("hr.payroll")} />
      </div>
      {tab === "staff" && <StaffTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "leave" && <LeaveTab />}
      {tab === "payroll" && <PayrollTab />}
    </div>
  );
}

const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
    <Icon size={15} /> {label}
  </button>
);

function StaffTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "", password: "", role: "receptionist", department: "", designation: "", salary: "" });

  const load = () => api.get("/hr/staff").then((r) => setStaff(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register-staff", { ...form, salary: Number(form.salary) || 0 });
      toast.success(t("common.saved"));
      setShowModal(false);
      setForm({ name: "", username: "", email: "", phone: "", password: "", role: "receptionist", department: "", designation: "", salary: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  return (
    <div className="space-y-4">
      {admin && <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("hr.addStaff")}</button></div>}
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("hr.title")}</th><th>{t("common.name")}</th><th>{t("hr.role")}</th><th>{t("hr.department")}</th><th>{t("hr.role")}</th><th>{t("common.phone")}</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id}><td className="font-mono text-xs">{s.staffId}</td><td className="font-medium">{s.name}</td><td className="capitalize">{roleLabel(s.role)}</td><td>{s.department || "—"}</td><td>{s.designation || "—"}</td><td dir="ltr">{s.phone || "—"}</td></tr>
            ))}
            {staff.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("hr.noStaff")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("hr.addStaff")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="label">{t("common.name")} *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">{t("login.username")} *</label><input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" /></div>
              <div><label className="label">{t("login.password")}</label><input className="input" placeholder="changeme123" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" /></div>
              <div><label className="label">{t("common.email")}</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
              <div><label className="label">{t("common.phone")}</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
              <div>
                <label className="label">{t("hr.role")} *</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <div><label className="label">{t("hr.department")}</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div><label className="label">{t("hr.role")}</label><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div><label className="label">{t("hr.salary")}</label><input type="number" className="input" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceTab() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState({});

  useEffect(() => { api.get("/hr/staff").then((r) => setStaff(r.data)); }, []);
  useEffect(() => {
    api.get("/hr/attendance", { params: { date } }).then((r) => {
      const map = {};
      r.data.forEach((rec) => (map[rec.staff._id] = rec.status));
      setRecords(map);
    });
  }, [date]);

  const mark = async (staffId, staffName, status) => {
    // Confirm destructive states (absent / half_day) so a misclick doesn't
    // silently mark someone absent for the day. "present" and "leave" don't
    // need a prompt — they're either benign or already require approval.
    const destructive = status === "absent" || status === "half_day";
    if (destructive && !window.confirm(t("hr.confirmAttendance", { name: staffName, status: t(`hr.${status === "half_day" ? "halfDay" : status}`) }))) {
      return;
    }
    const previous = records[staffId];
    await api.post("/hr/attendance", { staff: staffId, date, status });
    setRecords((r) => ({ ...r, [staffId]: status }));
    bumpDataVersion(CHANNELS.hr, CHANNELS.dashboard);
    // 6-second undo toast for any change — lets a misclick be reversed
    // without re-opening the page or calling an admin.
    toast(
      (tt) => (
        <span className="flex items-center gap-3">
          <span>{t("hr.attendanceUpdated")}</span>
          <button
            onClick={async () => {
              if (previous) {
                await api.post("/hr/attendance", { staff: staffId, date, status: previous });
                setRecords((r) => ({ ...r, [staffId]: previous }));
              }
              toast.dismiss(tt.id);
            }}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            {t("hr.undo")}
          </button>
        </span>
      ),
      { duration: 6000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="max-w-xs"><label className="label">{t("common.date")}</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("hr.role")}</th><th>{t("common.status")}</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id}>
                <td className="font-medium">{s.name}</td>
                <td className="capitalize">{roleLabel(s.role)}</td>
                <td className="flex gap-1">
                  {["present", "absent", "half_day", "leave"].map((st) => (
                    <button key={st} onClick={() => mark(s._id, s.name, st)}
                      className={`text-xs px-2 py-1 rounded-full border capitalize ${records[s._id] === st ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-500"}`}>
                      {st === "present" ? t("hr.present") : st === "absent" ? t("hr.absent") : st === "half_day" ? t("hr.halfDay") : t("hr.leave")}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveTab() {
  const { t } = useTranslation();
  const [leaves, setLeaves] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ staff: "", fromDate: "", toDate: "", reason: "" });

  const load = () => api.get("/hr/leaves").then((r) => setLeaves(r.data));
  useEffect(() => { load(); api.get("/hr/staff").then((r) => setStaff(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/hr/leaves", form);
    toast.success(t("common.saved"));
    setShowModal(false);
    setForm({ staff: "", fromDate: "", toDate: "", reason: "" });
    load();
  };

  const setStatus = async (id, status) => { await api.put(`/hr/leaves/${id}/status`, { status }); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("hr.onLeave")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("reports.from")}</th><th>{t("reports.to")}</th><th>{t("common.description")}</th><th>{t("common.status")}</th><th>{t("common.actions")}</th></tr></thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l._id}>
                <td className="font-medium">{l.staff?.name}</td>
                <td>{new Date(l.fromDate).toLocaleDateString()}</td>
                <td>{new Date(l.toDate).toLocaleDateString()}</td>
                <td>{l.reason || "—"}</td>
                <td className="capitalize">{l.status}</td>
                <td>
                  {l.status === "pending" && (
                    <div className="flex gap-2">
                      <button className="text-xs text-emerald-600" onClick={() => setStatus(l._id, "approved")}>{t("common.save")}</button>
                      <button className="text-xs text-rose-600" onClick={() => setStatus(l._id, "rejected")}>{t("common.cancel")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("hr.onLeave")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("common.name")} *</label><select className="input" required value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}><option value="">{t("common.select")}…</option>{staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("reports.from")} *</label><input type="date" required className="input" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
                <div><label className="label">{t("reports.to")} *</label><input type="date" required className="input" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
              </div>
              <div><label className="label">{t("common.description")}</label><textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.submit")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PayrollTab() {
  const { t } = useTranslation();
  const [payslips, setPayslips] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ staff: "", month: now.getMonth() + 1, year: now.getFullYear(), basicSalary: "", allowances: 0, deductions: 0, paymentMode: "cash" });

  const load = () => api.get("/hr/payslips").then((r) => setPayslips(r.data));
  useEffect(() => { load(); api.get("/hr/staff").then((r) => setStaff(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/hr/payslips", { ...form, basicSalary: Number(form.basicSalary), allowances: Number(form.allowances), deductions: Number(form.deductions) });
      toast.success(t("common.saved"));
      setShowModal(false);
      load();
      bumpDataVersion(CHANNELS.hr, CHANNELS.billing, CHANNELS.dashboard);
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const markPaid = async (id) => { await api.put(`/hr/payslips/${id}/pay`); load(); bumpDataVersion(CHANNELS.hr, CHANNELS.billing, CHANNELS.dashboard); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("hr.runPayroll")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("billing.invoiceNo")}</th><th>{t("common.name")}</th><th>{t("hr.payrollMonth")}</th><th>{t("hr.netPay")}</th><th>{t("common.status")}</th><th></th></tr></thead>
          <tbody>
            {payslips.map((p) => (
              <tr key={p._id}>
                <td className="font-mono text-xs">{p.payslipNumber}</td>
                <td>{p.staff?.name}</td>
                <td>{p.month}/{p.year}</td>
                <td>{p.netSalary?.toLocaleString()}</td>
                <td className="capitalize">{p.status}</td>
                <td>{p.status === "pending" && <button className="text-xs text-brand-600" onClick={() => markPaid(p._id)}>{t("billing.paid")}</button>}</td>
              </tr>
            ))}
            {payslips.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("hr.runPayroll")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("common.name")} *</label><select className="input" required value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}><option value="">{t("common.select")}…</option>{staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("hr.payrollMonth")}</label><input type="number" min={1} max={12} className="input" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} /></div>
                <div><label className="label">{t("common.date")}</label><input type="number" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
              </div>
              <div><label className="label">{t("hr.basicSalary")} *</label><input type="number" required className="input" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("hr.allowances")}</label><input type="number" className="input" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
                <div><label className="label">{t("hr.deductions")}</label><input type="number" className="input" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
