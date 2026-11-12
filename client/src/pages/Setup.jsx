import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import api from "../api/axios.js";

// Each entity keeps a translation key for its label so the Setup tabs
// re-render in the active language. Field labels are also translated.
const ENTITIES = [
  { key: "vitals", labelKey: "setup.vitals", endpoint: "/setup/vitals", fields: [{ name: "name", labelKey: "common.name" }, { name: "unit", labelKey: "common.unit" }, { name: "referenceRange", labelKey: "common.description" }] },
  { key: "symptoms", labelKey: "opd.chiefComplaint", endpoint: "/setup/symptoms", fields: [{ name: "head", labelKey: "common.name" }, { name: "type", labelKey: "common.type" }] },
  { key: "findings", labelKey: "lab.findings", endpoint: "/setup/findings", fields: [{ name: "name", labelKey: "common.name" }, { name: "category", labelKey: "common.category" }] },
  { key: "medicine-categories", labelKey: "pharmacy.products", endpoint: "/pharmacy/categories", fields: [{ name: "name", labelKey: "common.category" }] },
  { key: "lab-categories-pathology", labelKey: "setup.tests", endpoint: "/lab/categories", listEndpoint: "/lab/categories/pathology", fields: [{ name: "name", labelKey: "common.category" }], extra: { type: "pathology" } },
  { key: "lab-categories-radiology", labelKey: "setup.radiologyTests", endpoint: "/lab/categories", listEndpoint: "/lab/categories/radiology", fields: [{ name: "name", labelKey: "common.category" }], extra: { type: "radiology" } },
  { key: "leave-types", labelKey: "hr.title", endpoint: "/hr/leave-types", fields: [{ name: "name", labelKey: "common.name" }] },
  { key: "income-heads", labelKey: "finance.income", endpoint: "/finance/income-heads", fields: [{ name: "name", labelKey: "common.name" }] },
  { key: "expense-heads", labelKey: "finance.expense", endpoint: "/finance/expense-heads", fields: [{ name: "name", labelKey: "common.name" }] },
  { key: "operation-types", labelKey: "setup.operationTypes", endpoint: "/operations", fields: [{ name: "name", labelKey: "common.name" }, { name: "category", labelKey: "common.category" }] },
];

export default function Setup() {
  const { t } = useTranslation();
  const [active, setActive] = useState(ENTITIES[0].key);
  const entity = ENTITIES.find((e) => e.key === active);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{t("setup.title")}</h1>
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {ENTITIES.map((e) => (
          <button key={e.key} onClick={() => setActive(e.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active === e.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
            {t(e.labelKey)}
          </button>
        ))}
      </div>
      <EntityManager entity={entity} />
    </div>
  );
}

function EntityManager({ entity }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});

  const load = () => api.get(entity.listEndpoint || entity.endpoint).then((r) => setItems(r.data));
  useEffect(() => { setForm({}); load(); /* eslint-disable-next-line */ }, [entity.key]);

  const save = async (e) => {
    e.preventDefault();
    if (!form[entity.fields[0].name]) return toast.error(t("common.required_field"));
    try {
      await api.post(entity.endpoint, { ...form, ...(entity.extra || {}) });
      toast.success(t("common.saved"));
      setForm({});
      load();
    } catch (err) { toast.error(err.response?.data?.message || t("common.error")); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`${entity.endpoint}/${id}`);
      load();
    } catch (err) { toast.error(t("common.error")); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
        {entity.fields.map((f) => (
          <div key={f.name}>
            <label className="label">{t(f.labelKey)}</label>
            <input className="input" value={form[f.name] || ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
          </div>
        ))}
        <button className="btn-primary"><Plus size={16} /> {t("common.add")}</button>
      </form>
      <div className="table-wrap card !p-0">
        <table className="data-table">
          <thead><tr>{entity.fields.map((f) => <th key={f.name}>{t(f.labelKey)}</th>)}<th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                {entity.fields.map((f) => <td key={f.name}>{item[f.name] || "—"}</td>)}
                <td><button onClick={() => remove(item._id)}><Trash2 size={15} className="text-rose-500" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={entity.fields.length + 1} className="text-center text-slate-400 py-10">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
