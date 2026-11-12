import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, X, Trash2 } from "lucide-react";
import api from "../api/axios.js";

export default function CalendarPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", start: "", end: "" });

  const load = () => api.get("/calendar").then((r) => setEvents(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/calendar", form);
    toast.success(t("calendar.eventAdded"));
    setShowModal(false);
    setForm({ title: "", description: "", start: "", end: "" });
    load();
  };

  const remove = async (id) => { await api.delete(`/calendar/${id}`); load(); };

  const grouped = events.reduce((acc, e) => {
    const d = new Date(e.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    (acc[d] = acc[d] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{t("calendar.eventsTitle")}</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t("calendar.newEvent")}</button>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([date, evs]) => (
          <div key={date} className="card">
            <p className="text-sm font-medium text-slate-500 mb-2">{date}</p>
            <div className="space-y-2">
              {evs.map((e) => (
                <div key={e._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    {e.description && <p className="text-xs text-slate-500">{e.description}</p>}
                  </div>
                  <button onClick={() => remove(e._id)}><Trash2 size={15} className="text-rose-500" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-center text-slate-400 py-16">{t("calendar.noEvents")}</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold">{t("calendar.newEvent")}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={save} className="p-6 space-y-3">
              <div><label className="label">{t("calendar.eventTitle")} *</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="label">{t("calendar.start")} *</label><input type="datetime-local" required className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
              <div><label className="label">{t("calendar.end")}</label><input type="datetime-local" className="input" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
              <div><label className="label">{t("common.description")}</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("common.cancel")}</button><button className="btn-primary">{t("common.save")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
