// NightWing prototype engine: simulated pilot neighbourhood, scoring and routing.
// All data here is illustrative. Nothing is read from real sensors or services.

export type NodeId =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
  | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T";

export type PlaceType = "college" | "transit" | "market" | "hostel" | "hospital" | "work" | "home";

export interface MapNode { x: number; y: number; name: string; type?: PlaceType }

export type Status = "open" | "pending" | "verified" | "reopened";
export type Fault = null | "bulb" | "power";
export type Zone = "red" | "orange" | "green";
export type LightCat = "lit" | "dim" | "dark";

export interface Segment {
  id: number;
  a: NodeId;
  b: NodeId;
  base: number;           // base light level 0-1
  potholes: number;
  failAt: number | null;  // hour (24 = midnight) after which the light fails
  name: string;
  len: number;            // map units
  mx: number;
  my: number;
  area: string;           // e.g. "South East"
  vuln: number;           // 1 near colleges, hostels, transit, hospitals; 0.3 otherwise
  persist: number;        // days dark
  reports: number;        // independent readings
  status: Status;
  fault: Fault;
  ticket?: string;
  foundBy?: string;
  samples?: Record<string, number>; // residents' light measurements (0-1), one per person
  bumpBy?: string[];      // residents whose phones felt a pothole bump here
}

export const M_PER_UNIT = 5;          // 1 map unit = 5 metres
export const MIN_PER_UNIT = 12 / 1000; // two-wheeler at about 25 km/h

export const NODES: Record<NodeId, MapNode> = {
  A: { x: 80, y: 80, name: "Campus Gate", type: "college" },
  B: { x: 300, y: 80, name: "Temple St Junction" },
  C: { x: 520, y: 80, name: "Metro Station", type: "transit" },
  D: { x: 760, y: 80, name: "North Junction" },
  E: { x: 920, y: 80, name: "Ring Road Junction" },
  F: { x: 80, y: 250, name: "Girls' Hostel", type: "hostel" },
  G: { x: 300, y: 250, name: "Library Junction" },
  H: { x: 520, y: 250, name: "Market Junction", type: "market" },
  I: { x: 760, y: 250, name: "Park Junction" },
  J: { x: 920, y: 250, name: "Bus Terminus", type: "transit" },
  K: { x: 80, y: 420, name: "West Junction" },
  L: { x: 300, y: 420, name: "Bus Stop", type: "transit" },
  M: { x: 520, y: 420, name: "Central Junction" },
  N: { x: 760, y: 420, name: "Hospital", type: "hospital" },
  O: { x: 920, y: 420, name: "East Junction" },
  P: { x: 80, y: 580, name: "PG Street", type: "hostel" },
  Q: { x: 300, y: 580, name: "School Junction" },
  R: { x: 520, y: 580, name: "Tech Park", type: "work" },
  S: { x: 760, y: 580, name: "Lake Junction" },
  T: { x: 920, y: 580, name: "Residential Colony", type: "home" },
};

type Raw = [NodeId, NodeId, number, number, number | null, string];
const RAW: Raw[] = [
  ["A", "B", 0.82, 0, null, "College Road"], ["B", "C", 0.85, 0, null, "Temple Street"], ["C", "D", 0.72, 0, 24, "Metro Link Road"], ["D", "E", 0.22, 1, null, "North Ring Road"],
  ["F", "G", 0.78, 0, null, "Hostel Road"], ["G", "H", 0.8, 0, null, "Library Street"], ["H", "I", 0.66, 0, null, "Market Road"], ["I", "J", 0.7, 0, 23, "Terminus Road"],
  ["K", "L", 0.2, 2, null, "West Cross Street"], ["L", "M", 0.52, 1, null, "Bus Stop Road"], ["M", "N", 0.82, 0, null, "Hospital Road"], ["N", "O", 0.15, 0, null, "East Service Lane"],
  ["P", "Q", 0.42, 0, null, "PG Lane"], ["Q", "R", 0.72, 0, null, "School Road"], ["R", "S", 0.3, 1, null, "Lake View Road"], ["S", "T", 0.76, 0, 23, "Colony Main Road"],
  ["A", "F", 0.8, 0, null, "Campus Avenue"], ["F", "K", 0.62, 0, null, "Hostel Back Road"], ["K", "P", 0.24, 1, null, "West Lane"],
  ["B", "G", 0.3, 0, null, "Temple Back Street"], ["G", "L", 0.74, 0, 24, "Library Cross Road"], ["L", "Q", 0.2, 1, null, "School Back Lane"],
  ["C", "H", 0.9, 0, null, "Metro Main Road"], ["H", "M", 0.82, 0, null, "Central Avenue"], ["M", "R", 0.78, 0, null, "Tech Park Road"],
  ["D", "I", 0.5, 1, null, "Park Avenue"], ["I", "N", 0.18, 2, null, "Hospital Back Road"], ["N", "S", 0.7, 0, null, "Lake Road"],
  ["E", "J", 0.8, 0, null, "Ring Road"], ["J", "O", 0.32, 0, null, "Depot Lane"], ["O", "T", 0.2, 1, null, "Colony Back Road"],
  ["R", "L", 0.12, 2, null, "Lake Bund Road"], ["L", "F", 0.18, 1, null, "Canal Road"],
];

export const SAFE_SPOTS = [
  { x: 546, y: 226, k: "+", name: "24-hour pharmacy" },
  { x: 546, y: 444, k: "P", name: "Police booth" },
  { x: 786, y: 226, k: "F", name: "24-hour petrol bunk" },
  { x: 326, y: 556, k: "+", name: "24-hour pharmacy" },
  { x: 946, y: 226, k: "P", name: "Police booth" },
];

const VULN = new Set<PlaceType>(["college", "hostel", "transit", "hospital"]);

function rng(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSegments(): Segment[] {
  const rand = rng(11);
  return RAW.map(([a, b, base, potholes, failAt, name], id) => {
    const A = NODES[a], B = NODES[b];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const col = mx < 410 ? "West" : mx < 640 ? "Central" : "East";
    const row = my < 335 ? "North" : "South";
    const p = rand(), q = rand();
    const near = (n: MapNode) => (n.type ? VULN.has(n.type) : false);
    return {
      id, a, b, base, potholes, failAt, name,
      len: Math.hypot(A.x - B.x, A.y - B.y), mx, my,
      area: `${row} ${col}`,
      vuln: near(A) || near(B) ? 1 : 0.3,
      persist: base < 0.6 ? 2 + Math.floor(p * 19) : 0,
      reports: base < 0.6 ? 2 + Math.floor(q * 8) : 0,
      status: "open", fault: null,
    };
  });
}

export const LANDMARKS = (Object.keys(NODES) as NodeId[]).filter((k) => NODES[k].type);

export function lightAt(e: Segment, hour: number): number {
  if (e.fault === "power") return 0.05;
  if (e.status === "verified") return 0.85;
  if (e.fault === "bulb") return 0.08;
  const sim = e.failAt && hour >= e.failAt ? 0.1 : e.base;
  const m = measuredLight(e);
  if (!m) return sim;
  // One reading is only a hint: residents' readings take over gradually and fully count from CONFIRM_READINGS people.
  const w = Math.min(1, m.count / CONFIRM_READINGS);
  return sim * (1 - w) + m.avg * w;
}
/** Readings needed before residents' measurements fully replace the estimate for a road. */
export const CONFIRM_READINGS = 3;
/** Pothole bumps from this many different residents add a confirmed pothole. */
export const CONFIRM_BUMPS = 2;
export function measuredLight(e: Segment): { avg: number; count: number } | null {
  const v = Object.values(e.samples || {});
  return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length } : null;
}
export const lightCat = (l: number): LightCat => (l >= 0.6 ? "lit" : l >= 0.3 ? "dim" : "dark");
/** Danger Index weights. Starting values; city engineers can tune them in the console. Always sum to 1. */
export const DEFAULT_WEIGHTS = { dark: 0.5, pot: 0.35, vuln: 0.15 };
export const WEIGHTS = { ...DEFAULT_WEIGHTS };
export function setWeights(w: { dark: number; pot: number; vuln: number }) {
  const t = w.dark + w.pot + w.vuln || 1;
  WEIGHTS.dark = w.dark / t; WEIGHTS.pot = w.pot / t; WEIGHTS.vuln = w.vuln / t;
}
export function parts(e: Segment, hour: number) {
  const dk = 1 - lightAt(e, hour);
  return { dark: WEIGHTS.dark * dk, pot: WEIGHTS.pot * Math.min(1, e.potholes / 2), vuln: WEIGHTS.vuln * e.vuln };
}
export function danger(e: Segment, hour: number): number {
  const p = parts(e, hour);
  return p.dark + p.pot + p.vuln;
}
export function zoneOf(e: Segment, hour: number): Zone {
  const l = lightAt(e, hour);
  if (l < 0.3 && e.potholes) return "red";
  if (l < 0.3 || (l < 0.6 && e.potholes)) return "orange";
  return "green";
}
export function level(d: number): { label: "Low" | "Medium" | "High"; zone: Zone } {
  return d < 0.35 ? { label: "Low", zone: "green" } : d < 0.55 ? { label: "Medium", zone: "orange" } : { label: "High", zone: "red" };
}
export function priority(e: Segment, hour: number): number {
  const dk = 1 - lightAt(e, hour);
  return Math.round(100 * (0.4 * dk + 0.25 * Math.min(1, e.persist / 21) + 0.2 * e.vuln + 0.15 * Math.min(1, e.reports / 9)));
}
export function hourLabel(h: number): string {
  const hh = h % 24;
  return `${hh % 12 || 12}:00 ${hh < 12 ? "AM" : "PM"}`;
}
export const metres = (u: number) => Math.round((u * M_PER_UNIT) / 10) * 10;

export function buildIndex(segs: Segment[]) {
  const between = new Map<string, Segment>();
  const adj = new Map<NodeId, { to: NodeId; e: Segment }[]>();
  (Object.keys(NODES) as NodeId[]).forEach((k) => adj.set(k, []));
  segs.forEach((e) => {
    between.set(e.a + e.b, e); between.set(e.b + e.a, e);
    adj.get(e.a)!.push({ to: e.b, e }); adj.get(e.b)!.push({ to: e.a, e });
  });
  return { between, adj };
}
export type Index = ReturnType<typeof buildIndex>;

export interface Route { nodes: NodeId[]; edges: Segment[] }

export function dijkstra(idx: Index, from: NodeId, to: NodeId, cost: (e: Segment) => number, forbid?: Set<number>): Route | null {
  const ids = Object.keys(NODES) as NodeId[];
  const dist = new Map<NodeId, number>(ids.map((k) => [k, Infinity]));
  const prev = new Map<NodeId, { u: NodeId; e: Segment }>();
  const done = new Set<NodeId>();
  dist.set(from, 0);
  for (;;) {
    let u: NodeId | null = null, best = Infinity;
    for (const k of ids) { const d = dist.get(k)!; if (!done.has(k) && d < best) { best = d; u = k; } }
    if (u === null || u === to) break;
    done.add(u);
    for (const { to: v, e } of idx.adj.get(u)!) {
      if (forbid && forbid.has(e.id)) continue;
      const nd = dist.get(u)! + cost(e);
      if (nd < dist.get(v)!) { dist.set(v, nd); prev.set(v, { u, e }); }
    }
  }
  if (dist.get(to) === Infinity) return null;
  const nodes: NodeId[] = [to], edges: Segment[] = [];
  let c: NodeId = to;
  while (c !== from) { const p = prev.get(c)!; edges.unshift(p.e); nodes.unshift(p.u); c = p.u; }
  return { nodes, edges };
}

export function routeStats(r: Route, hour: number) {
  const len = r.edges.reduce((s, e) => s + e.len, 0);
  const d = r.edges.reduce((s, e) => s + danger(e, hour) * e.len, 0) / len;
  return {
    min: Math.max(1, Math.round(len * MIN_PER_UNIT)),
    km: ((len * M_PER_UNIT) / 1000).toFixed(1),
    dark: r.edges.filter((e) => lightAt(e, hour) < 0.3).length,
    pot: r.edges.reduce((s, e) => s + e.potholes, 0),
    danger: d,
  };
}

export function hazardText(e: Segment, hour: number, dist: number | null): string | null {
  const dark = lightAt(e, hour) < 0.3, pot = e.potholes > 0;
  const where = dist == null ? "" : ` ahead in ${Math.max(50, Math.round(dist / 50) * 50)} metres`;
  if (dark && pot) return `Dark stretch${where}, pothole reported.`;
  if (dark) return `Dark stretch${where}.`;
  if (pot) return `Pothole${where}.`;
  return null;
}

export function diagnose(dropped: Segment[]): { type: "bulb" | "power"; area: string; count: number } {
  const by = new Map<string, number>();
  dropped.forEach((e) => by.set(e.area, (by.get(e.area) || 0) + 1));
  const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0] || ["", 0];
  return top[1] >= 4 ? { type: "power", area: top[0], count: top[1] } : { type: "bulb", area: top[0], count: top[1] };
}

export function priorityList(segs: Segment[], hour: number): Segment[] {
  const open = segs
    .filter((e) => e.fault !== "power" && e.status !== "verified" && (lightAt(e, hour) < 0.6 || e.status !== "open"))
    .sort((a, b) => priority(b, hour) - priority(a, hour));
  const top = open.slice(0, 6);
  // New confirmed faults (bulb failures, citizen reports) always stay visible, even outside the top six.
  open.slice(6).forEach((e) => { if (e.fault === "bulb" || e.status !== "open") top.push(e); });
  return top.concat(segs.filter((e) => e.status === "verified"));
}

export function nearestSafeSpot(e: Segment) {
  let best = SAFE_SPOTS[0], bd = Infinity;
  SAFE_SPOTS.forEach((s) => { const d = Math.hypot(s.x - e.mx, s.y - e.my); if (d < bd) { bd = d; best = s; } });
  return { spot: best, metres: metres(bd) };
}

/* ------------------------------------------------------------------ */
/* Geography: the simulated pilot grid is pinned to a real area so GPS */
/* readings and alert map links have real coordinates.                 */
/* ------------------------------------------------------------------ */
// Map (0,0) top-left -> about 13.0400 N, 80.2330 E; 1 map unit = 5 m.
const GEO = { lat0: 13.04, lng0: 80.233, mLat: 111320, mLng: 111320 * Math.cos((13.04 * Math.PI) / 180) };
export function toLatLng(x: number, y: number) {
  return { lat: +(GEO.lat0 - (y * M_PER_UNIT) / GEO.mLat).toFixed(6), lng: +(GEO.lng0 + (x * M_PER_UNIT) / GEO.mLng).toFixed(6) };
}
export function fromLatLng(lat: number, lng: number) {
  return { x: ((lng - GEO.lng0) * GEO.mLng) / M_PER_UNIT, y: ((GEO.lat0 - lat) * GEO.mLat) / M_PER_UNIT };
}
/** Nearest road to a GPS point, or null when the point is outside the pilot area. */
export function nearestSegment(segs: Segment[], lat: number, lng: number): { seg: Segment; metres: number } | null {
  const p = fromLatLng(lat, lng);
  if (p.x < -100 || p.x > 1100 || p.y < -100 || p.y > 760) return null;
  let best: Segment | null = null, bd = Infinity;
  segs.forEach((e) => {
    const A = NODES[e.a], B = NODES[e.b], dx = B.x - A.x, dy = B.y - A.y;
    const t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(A.x + dx * t - p.x, A.y + dy * t - p.y);
    if (d < bd) { bd = d; best = e; }
  });
  return best ? { seg: best, metres: Math.round(bd * M_PER_UNIT) } : null;
}
export const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

/** Tamil voice text for a hazard. */
export function hazardTextTa(e: Segment, hour: number, dist: number | null): string | null {
  const dark = lightAt(e, hour) < 0.3, pot = e.potholes > 0;
  const where = dist == null ? "" : `இன்னும் ${Math.max(50, Math.round(dist / 50) * 50)} மீட்டரில் `;
  if (dark && pot) return `${where}இருண்ட சாலை, பள்ளம் உள்ளது.`;
  if (dark) return `${where}இருண்ட சாலை.`;
  if (pot) return `${where}பள்ளம் உள்ளது.`;
  return null;
}
