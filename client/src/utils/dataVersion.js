// Tiny pub/sub bus for cross-page data invalidation. Used to refetch the
// dashboard after mutations made on OTHER pages (e.g. pay a bill in Billing
// → Dashboard should re-fetch "Collected Today"). Avoids pulling in a full
// data-fetching library like React Query for what's really just a "refresh
// yourself" signal.
//
// Usage:
//   import { bumpDataVersion, onDataVersionChange } from "../utils/dataVersion.js";
//
//   // After a successful mutation:
//   bumpDataVersion("billing");
//
//   // In a component that should refetch when billing changes:
//   useEffect(() => onDataVersionChange("billing", () => load()), []);

const listeners = new Map(); // channel -> Set<callback>

export const CHANNELS = {
  billing: "billing",       // bills paid / voided / created
  patients: "patients",     // patient registered / deactivated / deceased
  opd: "opd",               // visit created / completed
  pharmacy: "pharmacy",     // sale / purchase / return
  lab: "lab",               // order created / verified / cancelled
  inventory: "inventory",   // item adjusted / added
  hr: "hr",                 // attendance / payslip / leave
  settings: "settings",     // clinic settings changed
  dashboard: "dashboard",   // catch-all for anything that affects dashboard KPIs
};

// Fire a refresh signal on a channel. Multiple channels can be passed.
export function bumpDataVersion(...channels) {
  for (const ch of channels) {
    const cbs = listeners.get(ch);
    if (cbs) cbs.forEach((cb) => cb(ch));
  }
}

// Subscribe a callback to one or more channels. Returns an unsubscribe fn.
export function onDataVersionChange(channelsOrChannel, callback) {
  const channels = Array.isArray(channelsOrChannel) ? channelsOrChannel : [channelsOrChannel];
  for (const ch of channels) {
    if (!listeners.has(ch)) listeners.set(ch, new Set());
    listeners.get(ch).add(callback);
  }
  return () => {
    for (const ch of channels) {
      const cbs = listeners.get(ch);
      if (cbs) cbs.delete(callback);
    }
  };
}
