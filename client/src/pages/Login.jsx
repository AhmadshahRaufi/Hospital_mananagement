import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Stethoscope, Lock, User, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";

// Demo accounts are keyed by role, so the Login screen can translate each
// role label via i18n without needing to keep parallel label strings here.
const DEMO_ACCOUNTS = [
  { role: "super_admin", username: "admin", password: "Admin@123" },
  { role: "admin", username: "manager", password: "Manager@123" },
  { role: "receptionist", username: "reception", password: "Reception@123" },
  { role: "doctor", username: "doctor", password: "Doctor@123" },
  { role: "nurse", username: "nurse", password: "Nurse@123" },
  { role: "pharmacist", username: "pharmacist", password: "Pharmacist@123" },
  { role: "lab_tech", username: "labtech", password: "Labtech@123" },
  { role: "radiologist", username: "radiologist", password: "Radiologist@123" },
  { role: "accountant", username: "accountant", password: "Accountant@123" },
  { role: "inventory_manager", username: "storekeeper", password: "Storekeeper@123" },
];

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("login.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4 relative">
      {/* Language switcher floats in the corner so the user can pick their
          preferred language BEFORE signing in — the entire login card
          re-renders instantly in the chosen language. */}
      <div className="absolute top-4 end-4 z-10">
        <div className="bg-white/95 backdrop-blur rounded-lg shadow-md">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-brand-950 px-8 py-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center mb-3">
              <Stethoscope className="text-white" size={28} />
            </div>
            <h1 className="text-white text-xl font-semibold">{t("login.title")}</h1>
            <p className="text-brand-200 text-sm mt-1">{t("login.subtitle")}</p>
          </div>
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="label">{t("login.username")}</label>
              <div className="relative">
                <User className="absolute start-3 top-2.5 text-slate-400" size={18} />
                <input
                  className="input ps-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t("login.password")}</label>
              <div className="relative">
                <Lock className="absolute start-3 top-2.5 text-slate-400" size={18} />
                <input
                  type="password"
                  className="input ps-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </button>
            <details className="pt-1 group">
              <summary className="text-xs text-center text-slate-400 cursor-pointer select-none list-none flex items-center justify-center gap-1 hover:text-slate-600">
                {t("login.demoAccounts")}
                <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2 rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    type="button"
                    key={acc.username}
                    onClick={() => {
                      setUsername(acc.username);
                      setPassword(acc.password);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50 text-start"
                  >
                    <span className="text-slate-500">{t(`roles.${acc.role}`)}</span>
                    <span className="font-mono text-slate-700" dir="ltr">{acc.username} / {acc.password}</span>
                  </button>
                ))}
              </div>
            </details>
          </form>
        </div>
      </div>
    </div>
  );
}
