import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, Megaphone, MessageSquareWarning, FileStack, Mail } from "lucide-react";
import api from "../api/axios.js";

export default function Communications() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("notices");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("communications.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <TabBtn active={tab === "notices"} onClick={() => setTab("notices")} icon={Megaphone} label={t("communications.notices")} />
        <TabBtn active={tab === "complaints"} onClick={() => setTab("complaints")} icon={MessageSquareWarning} label={t("communications.complaints")} />
        <TabBtn active={tab === "content"} onClick={() => setTab("content")} icon={FileStack} label={t("communications.contentLibrary")} />
        <TabBtn active={tab === "messages"} onClick={() => setTab("messages")} icon={Mail} label={t("communications.emailSms")} />
      </div>
      {tab === "notices" && <NoticesTab />}
      {tab === "complaints" && <ComplaintsTab />}
      {tab === "content" && <ContentTab />}
      {tab === "messages" && <MessagesTab />}
    </div>
  );
}

const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
    <Icon size={15} /> {label}
  </button>
);

function NoticesTab() {
  const { t } = useTranslation();
  const [notices, setNotices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", message: "" });

  const load = () => api.get("/communications/notices").then((r) => setNotices(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/communications/notices", form);
    toast.success(t("common.saved"));
    setShowModal(false);
    setForm({ title: "", message: "" });
    load();
  };
  const remove = async (id) => { await api.delete(`/communications/notices/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("common.save")}</button></div>
      <div className="space-y-3">
        {notices.map((n) => (
          <div key={n._id} className="card flex justify-between items-start">
            <div>
              <p className="font-medium text-slate-800">{n.title}</p>
              <p className="text-sm text-slate-500 mt-1">{n.message}</p>
              <p className="text-xs text-slate-400 mt-2">{n.postedBy?.name} • {new Date(n.createdAt).toLocaleString()}</p>
            </div>
            <button onClick={() => remove(n._id)} className="text-xs text-rose-600">{t("common.delete")}</button>
          </div>
        ))}
        {notices.length === 0 && <p className="text-center text-slate-400 py-16">{t("communications.noHistory")}</p>}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("communications.history")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("communications.subject")} *</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="label">{t("communications.message")} *</label><textarea className="input" rows={3} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.send")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintsTab() {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ complaint: "", complaintType: "", name: "", phone: "" });

  const load = () => api.get("/communications/complaints").then((r) => setComplaints(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/communications/complaints", form);
    toast.success(t("common.saved"));
    setShowModal(false);
    setForm({ complaint: "", complaintType: "", name: "", phone: "" });
    load();
  };
  const setStatus = async (id, status) => { await api.put(`/communications/complaints/${id}/status`, { status }); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("common.add")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("communications.message")}</th><th>{t("common.type")}</th><th>{t("common.name")}</th><th>{t("common.status")}</th><th>{t("common.actions")}</th></tr></thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c._id}>
                <td>{c.complaint}</td>
                <td>{c.complaintType || "—"}</td>
                <td>{c.name || "—"} {c.phone && `(${c.phone})`}</td>
                <td className="capitalize">{c.status.replace("_", " ")}</td>
                <td className="flex gap-2">
                  {c.status !== "resolved" && <button className="text-xs text-emerald-600" onClick={() => setStatus(c._id, "resolved")}>{t("common.save")}</button>}
                  {c.status === "open" && <button className="text-xs text-brand-600" onClick={() => setStatus(c._id, "in_progress")}>{t("opd.inProgress")}</button>}
                </td>
              </tr>
            ))}
            {complaints.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">{t("communications.noHistory")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("common.add")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("communications.message")} *</label><textarea className="input" required rows={3} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} /></div>
              <div><label className="label">{t("common.type")}</label><input className="input" value={form.complaintType} onChange={(e) => setForm({ ...form, complaintType: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("common.name")}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className="label">{t("common.phone")}</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.submit")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentTab() {
  const { t } = useTranslation();
  const [content, setContent] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", type: "document", description: "", url: "" });

  const load = () => api.get("/communications/content").then((r) => setContent(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/communications/content", form);
    toast.success(t("common.saved"));
    setShowModal(false);
    setForm({ title: "", type: "document", description: "", url: "" });
    load();
  };
  const remove = async (id) => { await api.delete(`/communications/content/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("common.add")}</button></div>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr><th>{t("common.name")}</th><th>{t("common.type")}</th><th>URL</th><th>—</th><th></th></tr></thead>
          <tbody>
            {content.map((c) => (
              <tr key={c._id}>
                <td className="font-medium">{c.title}</td>
                <td className="capitalize">{c.type}</td>
                <td>{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="text-brand-600 text-xs">{t("common.view")}</a> : "—"}</td>
                <td>{c.uploadedBy?.name || "—"}</td>
                <td><button onClick={() => remove(c._id)} className="text-xs text-rose-600">{t("common.delete")}</button></td>
              </tr>
            ))}
            {content.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("common.add")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("common.name")} *</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <label className="label">{t("common.type")}</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="document">{t("communications.document")}</option>
                  <option value="image">{t("communications.image")}</option>
                  <option value="video">{t("communications.video")}</option>
                  <option value="link">{t("communications.link")}</option>
                  <option value="other">{t("communications.other")}</option>
                </select>
              </div>
              <div><label className="label">URL</label><input className="input" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} dir="ltr" /></div>
              <div><label className="label">{t("common.description")}</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesTab() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({ channel: "sms", recipients: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const load = () => api.get("/communications/messages").then((r) => setMessages(r.data));
  useEffect(() => { load(); }, []);

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/communications/messages", {
        channel: form.channel,
        recipientType: "custom",
        recipients: form.recipients.split(",").map((r) => r.trim()).filter(Boolean),
        subject: form.subject,
        body: form.body,
      });
      toast.success(t("communications.sent"));
      setForm({ channel: form.channel, recipients: "", subject: "", body: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); } finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <form onSubmit={send} className="card space-y-3">
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
          {t("communications.noHistory")}
        </div>
        <div>
          <label className="label">{t("common.type")}</label>
          <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option value="sms">{t("communications.sms")}</option><option value="email">{t("communications.email")}</option>
          </select>
        </div>
        <div><label className="label">{t("communications.to")}</label><input className="input" required value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="0770000000, patient@email.com" dir="ltr" /></div>
        {form.channel === "email" && <div><label className="label">{t("communications.subject")}</label><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>}
        <div><label className="label">{t("communications.message")} *</label><textarea className="input" rows={4} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <button className="btn-primary w-full" disabled={sending}>{sending ? t("common.loading") : t("communications.send")}</button>
      </form>
      <div className="card">
        <h3 className="font-medium text-slate-700 mb-3">{t("communications.history")}</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((m) => (
            <div key={m._id} className="border border-slate-100 rounded-lg p-3 text-sm">
              <div className="flex justify-between"><span className="font-medium capitalize">{m.channel}</span><span className="text-xs text-slate-400 capitalize">{m.status}</span></div>
              <p className="text-slate-500 mt-1">{m.body}</p>
              <p className="text-xs text-slate-400 mt-1">{t("communications.to")}: {m.recipients?.join(", ")}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="text-center text-slate-400 py-10">{t("communications.noHistory")}</p>}
        </div>
      </div>
    </div>
  );
}
