// Single source of truth for "who can see/use what" on the frontend. This is
// a UX layer only — every one of these boundaries is enforced for real on
// the server (see server/src/middleware/auth.js `allowRoles`), so even a
// tampered client can't get more access than the API allows. What this file
// controls is just: which nav links show up, and what a role sees if it
// lands on a page it doesn't need.
//
// `roles: null` (or omitted) = open to every signed-in role.
// `roles: []`   = administrators only (super_admin / admin).

import i18n from "../i18n/index.js";

export const ADMIN_ROLES = ["super_admin", "admin"];

// Raw role keys — kept stable so the rest of the app (canAccess, PAGE_ROLES,
// server-side tokens) doesn't break when a translation is added. UI labels
// are resolved through react-i18next at render time via `roleLabel(role)`.
export const ROLE_KEYS = [
  "super_admin",
  "admin",
  "receptionist",
  "doctor",
  "nurse",
  "pharmacist",
  "lab_tech",
  "radiologist",
  "accountant",
  "inventory_manager",
];

// Backwards-compatible map: returns the translated label for a role key.
// Components that previously imported `ROLE_LABELS[role]` should migrate to
// `roleLabel(role)` from a React render context (which can call useTranslation).
// For non-React call sites (e.g. seed.js console output), this falls back to
// the English label.
export const ROLE_LABELS = Object.fromEntries(
  ROLE_KEYS.map((key) => [key, key])
);

// Translate a role key to the active language's label. Safe to call from
// anywhere — falls back to the raw key if i18n isn't ready yet.
export const roleLabel = (role) => {
  if (!role) return "";
  const t = i18n.t?.bind(i18n);
  if (!t) return role;
  const label = t(`roles.${role}`, { defaultValue: role });
  return label;
};

// Named groups purely for readability below.
const FRONT_DESK = ["receptionist"];
const CLINICAL = ["doctor", "nurse"];
const LAB_STAFF = ["lab_tech", "radiologist"];
const LAB_VIEWERS = ["lab_tech", "radiologist", "receptionist", "doctor", "nurse"];
const PHARMACY_STAFF = ["pharmacist"];
const FINANCE = ["accountant"];
const STOCK = ["inventory_manager"];

// Keyed by the literal route path as used in <Route path="..."> / nav `to`.
export const PAGE_ROLES = {
  "/": null,
  "/patients": [...FRONT_DESK, ...CLINICAL, ...PHARMACY_STAFF, ...LAB_STAFF, ...FINANCE],
  "/appointments": [...FRONT_DESK, ...CLINICAL],
  "/opd": [...FRONT_DESK, ...CLINICAL],
  "/emergency": [...FRONT_DESK, ...CLINICAL],
  "/ipd": CLINICAL,
  "/emr": CLINICAL,
  "/nursing": CLINICAL,
  "/billing": [...FRONT_DESK, ...FINANCE],
  "/pharmacy": [...PHARMACY_STAFF, ...STOCK],
  "/lab": LAB_VIEWERS,
  "/diagnostics": LAB_STAFF,
  "/optical": FRONT_DESK,
  "/operations": [...CLINICAL, ...FRONT_DESK],
  "/ot-schedule": CLINICAL,
  "/documents": null,
  "/insurance": [...FRONT_DESK, ...FINANCE],
  "/live-consultation": ["doctor", ...FRONT_DESK],
  "/inventory": STOCK,
  "/hr": FINANCE,
  "/finance": FINANCE,
  "/communications": FRONT_DESK,
  "/reports": FINANCE,
  "/print-center": FRONT_DESK,
  "/setup": [],
  "/settings": null,
  "/calendar": null,
};

// True if `user` may access a page at `path`. Falls back through parent path
// segments (e.g. "/opd/64f.../edit" -> "/opd") so detail/child routes such as
// "/patients/:id" or "/lab/pathology" inherit their section's rule without
// needing a duplicate entry for every dynamic segment.
export function canAccess(user, path) {
  if (!user) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;

  const segments = path.split("/").filter(Boolean);
  for (let i = segments.length; i >= 0; i--) {
    const candidate = "/" + segments.slice(0, i).join("/");
    if (Object.prototype.hasOwnProperty.call(PAGE_ROLES, candidate)) {
      const roles = PAGE_ROLES[candidate];
      if (roles === null || roles === undefined) return true;
      return roles.includes(user.role);
    }
  }
  return true; // unlisted page: default open rather than locking staff out
}

export const isAdmin = (user) => !!user && ADMIN_ROLES.includes(user.role);

// Convenience for one-off UI checks outside the page-role table above
// (e.g. "can this role void a bill", "can this role edit a prescription").
export const hasRole = (user, ...roles) => !!user && (ADMIN_ROLES.includes(user.role) || roles.includes(user.role));
