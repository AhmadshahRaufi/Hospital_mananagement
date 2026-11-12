import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Receipt,
  Pill,
  FlaskConical,
  Radio,
  Boxes,
  UserCog,
  Wallet,
  FileBarChart,
  Settings as SettingsIcon,
  Bell,
  CalendarDays,
  Search,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Glasses,
  Scissors,
  MessageSquare,
  Video,
  SlidersHorizontal,
  Ambulance,
  Bed,
  CalendarPlus,
  ClipboardList,
  FileText,
  HeartPulse,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { canAccess, roleLabel } from "../utils/permissions.js";
import api from "../api/axios.js";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";

// Each nav item carries a translation key (`i18nKey`) instead of a literal
// English label so the sidebar automatically re-renders in the active
// language whenever i18n's `languageChanged` event fires.
const NAV_GROUPS = [
  {
    labelKey: "nav.groups.core",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
      { to: "/patients", labelKey: "nav.patients", icon: Users },
      { to: "/appointments", labelKey: "nav.appointments", icon: CalendarPlus },
      { to: "/opd", labelKey: "nav.opd", icon: Stethoscope },
      { to: "/emergency", labelKey: "nav.emergency", icon: Ambulance },
      { to: "/ipd", labelKey: "nav.ipd", icon: Bed },
      { to: "/emr", labelKey: "nav.emr", icon: ClipboardList },
      { to: "/nursing", labelKey: "nav.nursing", icon: HeartPulse },
      { to: "/billing", labelKey: "nav.billing", icon: Receipt },
      { to: "/pharmacy", labelKey: "nav.pharmacy", icon: Pill },
      { to: "/lab/pathology", labelKey: "nav.laboratory", icon: FlaskConical },
      { to: "/lab/radiology", labelKey: "nav.radiology", icon: Radio },
      { to: "/diagnostics", labelKey: "nav.diagnostics", icon: FileText },
      { to: "/optical", labelKey: "nav.optical", icon: Glasses },
      { to: "/operations", labelKey: "nav.operations", icon: Scissors },
      { to: "/ot-schedule", labelKey: "nav.otSchedule", icon: Stethoscope },
      { to: "/documents", labelKey: "nav.documents", icon: FileText },
      { to: "/insurance", labelKey: "nav.insurance", icon: ShieldCheck },
      { to: "/live-consultation", labelKey: "nav.liveConsultation", icon: Video },
      { to: "/inventory", labelKey: "nav.inventory", icon: Boxes },
      { to: "/hr", labelKey: "nav.hr", icon: UserCog },
    ],
  },
  {
    labelKey: "nav.groups.finance",
    items: [
      { to: "/finance", labelKey: "nav.financePage", icon: Wallet },
    ],
  },
  {
    labelKey: "nav.groups.engagement",
    items: [
      { to: "/communications", labelKey: "nav.communications", icon: MessageSquare },
    ],
  },
  {
    labelKey: "nav.groups.reports",
    items: [
      { to: "/reports", labelKey: "nav.reports", icon: FileBarChart },
      { to: "/print-center", labelKey: "nav.printCenter", icon: Printer },
    ],
  },
  {
    labelKey: "nav.groups.setup",
    items: [
      { to: "/setup", labelKey: "nav.lookupLists", icon: SlidersHorizontal },
      { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
    ],
  },
];

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/notifications").then((res) => setNotifications(res.data)).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(user, item.to)),
  })).filter((group) => group.items.length > 0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/patients?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-[72px]"} hidden md:flex h-screen flex-col bg-brand-950 text-brand-100 transition-all duration-200 shrink-0`}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Stethoscope size={18} className="text-white" />
          </div>
          {sidebarOpen && <span className="font-semibold text-white truncate">{t("app.name")}</span>}
        </div>
        <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.labelKey}>
              {sidebarOpen && (
                <p className="px-3 text-[11px] uppercase tracking-wider text-brand-300/70 mb-1.5">{t(group.labelKey)}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? "bg-brand-600 text-white" : "text-brand-100/80 hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    <item.icon size={18} className="shrink-0" />
                    {sidebarOpen && <span className="truncate">{t(item.labelKey)}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="m-2 p-2 rounded-lg hover:bg-white/5 text-brand-200 flex items-center justify-center"
        >
          <Menu size={18} />
        </button>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute start-0 top-0 bottom-0 w-72 bg-brand-950 text-brand-100 flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
              <span className="font-semibold text-white">{t("app.name")}</span>
              <button onClick={() => setMobileOpen(false)}><X className="text-white" size={20} /></button>
            </div>
            <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto py-3 px-2 space-y-5">
              {visibleGroups.map((group) => (
                <div key={group.labelKey}>
                  <p className="px-3 text-[11px] uppercase tracking-wider text-brand-300/70 mb-1.5">{t(group.labelKey)}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                            isActive ? "bg-brand-600 text-white" : "text-brand-100/80 hover:bg-white/5"
                          }`
                        }
                      >
                        <item.icon size={18} />
                        <span>{t(item.labelKey)}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="min-w-0 flex-1 h-screen flex flex-col overflow-hidden">
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center gap-4 px-4 md:px-6 z-30">
          <button className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute start-3 top-2.5 text-slate-400" size={16} />
              <input
                className="input ps-9 bg-slate-50"
                placeholder={t("layout.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>
          <div className="ms-auto flex items-center gap-1.5">
            <LanguageSwitcher />
            <NavLink to="/calendar" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title={t("layout.calendar")}>
              <CalendarDays size={20} />
            </NavLink>
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative"
                title={t("layout.notifications")}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 bg-rose-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute end-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 max-h-96 overflow-y-auto">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-medium text-sm">{t("layout.notifications")}</span>
                    {notifications.length > 0 && (
                      <button
                        className="text-xs text-rose-600"
                        onClick={async () => {
                          await api.delete("/notifications/clear-all");
                          setNotifications([]);
                        }}
                      >
                        {t("layout.clearAll")}
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-400 px-4 py-6 text-center">{t("layout.noNotifications")}</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className={`px-4 py-2.5 text-sm border-b border-slate-50 ${!n.isRead ? "bg-brand-50/50" : ""}`}>
                        <p className="font-medium text-slate-700">{n.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 ps-2 pe-1 py-1.5 rounded-lg hover:bg-slate-100">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block text-start">
                  <p className="text-sm font-medium leading-tight">{user?.name}</p>
                  <p className="text-xs text-slate-400 leading-tight">{roleLabel(user?.role)}</p>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              {menuOpen && (
                <div className="absolute end-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1">
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                    className="w-full text-start px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    {t("layout.settings")}
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-start px-4 py-2 text-sm hover:bg-slate-50 text-rose-600 flex items-center gap-2"
                  >
                    <LogOut size={14} /> {t("layout.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1600px] w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
