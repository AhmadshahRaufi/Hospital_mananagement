import React from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { canAccess, roleLabel } from "../utils/permissions.js";

// Wraps the routed page area. Re-checks on every navigation (via
// useLocation) whether the signed-in role is allowed on the current path,
// and shows a calm "not part of your role" panel instead of the page when
// it isn't — rather than a silent redirect loop or a broken blank screen.
export default function RequireRole({ children }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();

  if (canAccess(user, location.pathname)) {
    return children;
  }

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{t("requireRole.title")}</h2>
        <p className="text-sm text-slate-500 mt-1.5">
          {t("requireRole.description", { role: roleLabel(user?.role) })}
        </p>
        <Link
          to="/"
          className="inline-flex mt-5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          {t("requireRole.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
