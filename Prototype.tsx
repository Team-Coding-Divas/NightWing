import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, BadgeCheck, Bell, Building2, Camera, Car, Check, ClipboardList, Clock3, Cloud, CloudOff, Copy, Download, Eye, FileText, Gauge, Handshake, Info, Landmark,
  Languages, Lightbulb, Lock, LogOut, MapPin, MessageCircle, Navigation, Phone, RefreshCw, Send, ShieldCheck, SlidersHorizontal, ThumbsDown, ThumbsUp, Truck, UserRound, Users, Volume2, Wrench, X, Zap,
} from "lucide-react";
import {
  DEFAULT_WEIGHTS, LANDMARKS, M_PER_UNIT, NODES, SAFE_SPOTS, WEIGHTS, buildIndex, createSegments, danger, diagnose, dijkstra, hazardText, hazardTextTa, hourLabel,
  level, lightAt, lightCat, mapLink, metres, nearestSafeSpot, nearestSegment, parts, priority, priorityList, routeStats, setWeights, toLatLng, zoneOf,
  type NodeId, type Route, type Segment,
} from "@/prototype/engine";
import "@/prototype/prototype.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type Gender = "" | "woman" | "man" | "other";
type Session =
  | { role: "citizen"; name: string; phone: string; gender: Gender; womanVerified: boolean; consent: boolean }
  | { role: "authority"; officerId: string };
type CitizenTab = "map" | "route" | "report" | "sensor" | "women";
type AuthorityTab = "requests" | "repairs" | "bridge";
type ReportStatus = "submitted" | "inspection" | "repair" | "awaiting" | "working" | "fixed" | "invalid";
type Lang = "en" | "ta";
interface ReportStep { status: ReportStatus; text: string; at: string; ts?: number }
export interface StreetReport {
  id: string; segId: number; road: string; area: string; issue: string; note: string;
  photo: string;          // file name
  photoData?: string;     // small JPEG thumbnail (data URL)
  lat?: number; lng?: number; acc?: number; // GPS pin from the reporter's phone
  reporter: string; reporterId: string; supporters: { name: string; id: string }[];
  createdAt: number; dueAt: number;
  status: ReportStatus; team?: string; steps: ReportStep[];
}
interface FieldReading {
  time: string; lat: number | null; lng: number | null; acc: number | null;
  light: number | null; lightSource: string; lightLabel: string; jolt: number; bump: boolean; note: string;
}
const OPEN: ReportStatus[] = ["submitted", "inspection", "repair", "awaiting"];
const MAX_OPEN_PER_PERSON = 3;
const DUE_HOURS = 48;
const ISSUES = ["Light not working", "Light flickering", "Pole or wiring damaged", "Light stays on during the day"];
const TEAMS = ["Inspection Team 1 (Ward 12)", "Inspection Team 2 (Ward 12)", "Night Patrol Team"];
const REPAIR_CREW = "Streetlight repair crew";
const INVALID_REASONS = ["Duplicate of another report", "Not a streetlight problem", "Wrong location", "Spam or test report"];
const CITIZEN_STATUS: Record<ReportStatus, { label: string; zone: "red" | "orange" | "green" | "ink" }> = {
  submitted: { label: "Sent to city officials", zone: "ink" },
  inspection: { label: "Inspection team checking", zone: "orange" },
  repair: { label: "Confirmed · with repair crew", zone: "red" },
  awaiting: { label: "Repaired · residents to confirm", zone: "orange" },
  working: { label: "Checked · light is working", zone: "green" },
  fixed: { label: "Repaired · confirmed by residents", zone: "green" },
  invalid: { label: "Closed · not a valid report", zone: "ink" },
};
const nowStamp = () => new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type Tone = "" | "ok" | "warn" | "bad";
interface LogItem { id: number; time: string; text: string; tone: Tone }
interface Contact { name: string; phone: string }
interface Ride {
  path: NodeId[]; idx: number; t: number; speed: number; paused: boolean; done: boolean;
  warned: Set<number>; expectedIds?: Set<number>; divert?: boolean; offNoted?: boolean; armedNoted?: boolean; dest?: NodeId;
}

// DEMO ONLY: one public test account so judges can open the console. Production officer
// accounts are issued by the ward office and checked on a server, never in the browser.
const DEMO_OFFICER = { id: "GCC-W12", pin: "4821" };
const OFFICERS: Record<string, string> = { [DEMO_OFFICER.id]: DEMO_OFFICER.pin };
const verifiedKey = (id: string) => `nw_verified_${id}`;
function isVerified(id: string) { try { return localStorage.getItem(verifiedKey(id)) === "1"; } catch { return false; } }
function saveVerified(id: string) { try { localStorage.setItem(verifiedKey(id), "1"); } catch { /* storage unavailable */ } }

/* ------------------------------------------------------------------ */
/* Sign-in gate                                                        */
/* ------------------------------------------------------------------ */
/** Simulated DigiLocker consent screen. It can be declined, so verification is a real choice, not a button that always works. */
function DigiConsent({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="pt-modal" role="dialog" aria-modal="true" aria-labelledby="pt-dl-title">
      <div className="pt-modal-box pt-consent">
        <p className="pt-kicker">DIGILOCKER · DEMO SCREEN</p>
        <h3 id="pt-dl-title">Share one detail with NightWing?</h3>
        <p>NightWing is asking DigiLocker to confirm <b>one thing</b>:</p>
        <ul className="pt-consent-list">
          <li className="pt-yes"><Check size={14} /> Gender on your Aadhaar record is <b>Female</b> (yes / no)</li>
          <li className="pt-no"><X size={14} /> Not shared: name, Aadhaar number, address, date of birth, photo</li>
        </ul>
        <p className="pt-fine">NightWing stores only "verified: yes". In this prototype the DigiLocker step is simulated; a real build uses the DigiLocker partner API on a server.</p>
        <div className="pt-row" style={{ justifyContent: "center" }}>
          <button type="button" className="pt-btn pt-btn-primary" disabled={busy} autoFocus onClick={() => { setBusy(true); window.setTimeout(onAllow, 900); }}><BadgeCheck size={14} /> {busy ? "Checking with DigiLocker…" : "Allow"}</button>
          <button type="button" className="pt-btn" disabled={busy} onClick={onDeny}>Deny</button>
        </div>
      </div>
    </div>
  );
}

function SignIn({ onEnter, onReset }: { onEnter: (s: Session) => void; onReset: () => void }) {
  const [who, setWho] = useState<"citizen" | "official">("citizen");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [consent, setConsent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [offId, setOffId] = useState("");
  const [pin, setPin] = useState("");
  const [offErr, setOffErr] = useState("");
  const fails = useRef(0);
  const lockUntil = useRef(0);

  const digits = phone.replace(/[^0-9]/g, "").replace(/^91(?=\d{10}$)/, "");

  function sendCode(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) return setErr("Enter your name.");
    if (digits.length !== 10) return setErr("Enter a 10-digit mobile number.");
    if (!gender) return setErr("Select your gender.");
    setErr("");
    setOtp(String(1000 + Math.floor(Math.random() * 9000)));
    setStep(2);
  }
  function verifyCode() {
    if (code.trim() !== otp) return setErr("That code doesn't match. Check the code and try again.");
    const wv = gender === "woman" && (verified || isVerified(digits));
    if (wv) saveVerified(digits);
    onEnter({ role: "citizen", name: name.trim(), phone: digits, gender, womanVerified: wv, consent });
  }
  const [declined, setDeclined] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  function startVerify() { setVerifying(true); setDeclined(false); }
  function officialSignIn(ev: FormEvent) {
    ev.preventDefault();
    const now = Date.now();
    if (now < lockUntil.current) return setOffErr(`Too many attempts. Try again in ${Math.ceil((lockUntil.current - now) / 1000)} seconds.`);
    const id = offId.trim().toUpperCase();
    if (OFFICERS[id] && OFFICERS[id] === pin.trim()) { fails.current = 0; onEnter({ role: "authority", officerId: id }); return; }
    fails.current += 1; setPin("");
    if (fails.current >= 3) { lockUntil.current = now + 30000; fails.current = 0; setOffErr("Too many attempts. Sign-in is locked for 30 seconds."); }
    else setOffErr("Officer ID or PIN is not recognised. Citizens should use the Citizen tab.");
  }

  return (
    <div className="pt-gate">
      <div className="pt-gate-inner">
        <div className="pt-gate-hero">
          <a className="pt-back" href="/"><ArrowLeft size={15} /> Back to the NightWing story</a>
          <span className="eyebrow"><span className="eyebrow-dot" /> WORKING PROTOTYPE</span>
          <h1>Sign in to<br /><em>NightWing.</em></h1>
          <p>One platform, two apps. Each person sees only what they need.</p>
          <ul className="pt-gate-points">
            <li><span className="pt-dot pt-dot-green" /><div><strong>Citizens</strong><small>Danger map, safer routes, light reports and a sensor check. Women who verify once through DigiLocker also get Women's Safety Mode.</small></div></li>
            <li><span className="pt-dot pt-dot-peach" /><div><strong>City officials</strong><small>Repair dashboard, outage diagnosis and the Civic Bridge. Citizens cannot open it.</small></div></li>
          </ul>
          <p className="pt-fine">Simulated pilot data for one campus neighbourhood. The SMS code, DigiLocker step and officer login are demonstrations only; a real deployment checks them on a server.</p>
          <div className="pt-presenter">
            <p><b>Presenting?</b> Open this page in two windows, one signed in as a citizen and one as an official. They stay in sync, so a report appears on the console straight away.</p>
            <div className="pt-row"><button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={() => { onReset(); setResetMsg("Demo data cleared. Every window starts fresh."); }}><RefreshCw size={14} /> Reset demo data</button>{resetMsg && <span className="pt-fine" role="status" style={{ margin: 0 }}>{resetMsg}</span>}</div>
          </div>
        </div>
        <div className="pt-gate-card">
          <div className="pt-seg" role="tablist" aria-label="Sign in as">
            <button type="button" role="tab" aria-selected={who === "citizen"} onClick={() => setWho("citizen")}><UserRound size={15} /> Citizen</button>
            <button type="button" role="tab" aria-selected={who === "official"} onClick={() => setWho("official")}><Building2 size={15} /> City official</button>
          </div>

          {who === "citizen" ? (
            <form className="pt-form" onSubmit={sendCode} noValidate>
              <h2>Citizen app</h2>
              {step === 1 ? (
                <>
                  <label className="pt-field" htmlFor="pt-name">Your name<input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kavya" autoComplete="off" /></label>
                  <label className="pt-field" htmlFor="pt-phone">Mobile number<input id="pt-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" autoComplete="off" /></label>
                  <label className="pt-field" htmlFor="pt-gender">Gender
                    <select id="pt-gender" value={gender} onChange={(e) => { const g = e.target.value as Gender; setGender(g); if (g !== "woman") setVerified(false); }}>
                      <option value="">Select</option><option value="woman">Woman</option><option value="man">Man</option><option value="other">Other / prefer not to say</option>
                    </select>
                  </label>
                  {gender === "woman" && (
                    <div className="pt-verify">
                      <p><strong>Verify to unlock Women's Safety Mode.</strong> You can use the map, routes and reports straight away. Verify once through DigiLocker (now or later inside the app) to unlock Ride Watch and Smart Check-In. NightWing keeps only a "verified" flag, never your documents.</p>
                      <div className="pt-row">
                        {!verified && <button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={startVerify}><BadgeCheck size={14} /> Verify with DigiLocker (demo)</button>}
                        <span className={`pt-chip ${verified ? "pt-chip-green" : ""}`}>{verified ? "Verified (demo)" : "Not verified"}</span>
                      </div>
                      {declined && <p className="pt-fine" style={{ margin: "6px 0 0" }}>You declined. You can still sign in; Women's Safety Mode stays locked until you verify.</p>}
                    </div>
                  )}
                  <label className="pt-check" htmlFor="pt-consent"><input id="pt-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Share anonymous light and pothole readings during night trips (optional, can be turned off any time)</label>
                  <p className="pt-err" role="alert">{err}</p>
                  <button className="pt-btn pt-btn-primary" type="submit">Send code</button>
                </>
              ) : (
                <>
                  <div className="pt-sms"><small>DEMO: no SMS is sent. In the real app this code arrives by SMS to +91 {digits.slice(0, 5)} {digits.slice(5)}.</small>Your NightWing code is <b>{otp}</b></div>
                  <label className="pt-field" htmlFor="pt-otp">Enter the 4-digit code<input id="pt-otp" inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verifyCode(); } }} autoComplete="one-time-code" autoFocus /></label>
                  <p className="pt-err" role="alert">{err}</p>
                  <div className="pt-row"><button type="button" className="pt-btn pt-btn-primary" onClick={verifyCode}>Verify and continue</button><button type="button" className="pt-btn" onClick={() => { setStep(1); setErr(""); setCode(""); }}>Change number</button></div>
                </>
              )}
            </form>
          ) : (
            <form className="pt-form" onSubmit={officialSignIn} noValidate>
              <h2>City Authority console</h2>
              <p className="pt-fine">For ward engineers, the electricity board and police. Citizens cannot open this console.</p>
              <div className="pt-demo-box"><Info size={15} /><div><b>Demo access for judges</b><span>Officer ID <code>{DEMO_OFFICER.id}</code> · PIN <code>{DEMO_OFFICER.pin}</code>. This test account exists only in the prototype; real officer accounts are issued by the ward office and checked on a server.</span><button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={() => { setOffId(DEMO_OFFICER.id); setPin(DEMO_OFFICER.pin); setOffErr(""); }}>Fill demo login</button></div></div>
              <label className="pt-field" htmlFor="pt-off">Officer ID<input id="pt-off" value={offId} onChange={(e) => setOffId(e.target.value)} placeholder="e.g. GCC-W12" autoComplete="off" /></label>
              <label className="pt-field" htmlFor="pt-pin">PIN<input id="pt-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" /></label>
              <p className="pt-err" role="alert">{offErr}</p>
              <button className="pt-btn pt-btn-primary" type="submit"><Lock size={14} /> Sign in</button>
            </form>
          )}
        </div>
      </div>
      {verifying && <DigiConsent onAllow={() => { setVerifying(false); setVerified(true); }} onDeny={() => { setVerifying(false); setDeclined(true); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */
const zoneLabel = { red: "Red zone", orange: "Orange zone", green: "Green zone" } as const;
function Chip({ zone, children }: { zone?: "red" | "orange" | "green" | "ink"; children: ReactNode }) {
  return <span className={`pt-chip ${zone ? `pt-chip-${zone}` : ""}`}>{children}</span>;
}
function Log({ items, empty }: { items: LogItem[]; empty: string }) {
  if (!items.length) return <p className="pt-empty">{empty}</p>;
  return <ol className="pt-log">{items.map((l) => <li key={l.id} className={l.tone ? `pt-log-${l.tone}` : ""}><b>{l.time}</b>{l.text}</li>)}</ol>;
}
function copyText(text: string, btn: HTMLButtonElement) {
  const orig = btn.textContent;
  try {
    navigator.clipboard.writeText(text).then(() => { btn.textContent = "Copied"; }, () => { btn.textContent = "Select the text to copy"; });
  } catch { btn.textContent = "Select the text to copy"; }
  window.setTimeout(() => { btn.textContent = orig; }, 1800);
}
function phoneDigits(p: string) { let d = p.replace(/[^0-9]/g, ""); if (d.length === 10) d = "91" + d; return d; }

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */
function Workspace({ session, onSignOut, segs, reports, setReports, extVer, onSegsChanged, sync }: {
  session: Session; onSignOut: () => void; segs: Segment[];
  reports: StreetReport[]; setReports: (f: (r: StreetReport[]) => StreetReport[]) => void;
  extVer: number; onSegsChanged: () => void; sync: SyncState;
}) {
  const citizen = session.role === "citizen";
  const isWoman = session.role === "citizen" && session.gender === "woman";
  const [womanVerified, setWomanVerified] = useState(session.role === "citizen" && session.womanVerified);
  const [verifying, setVerifying] = useState(false);
  const [verifyDeclined, setVerifyDeclined] = useState(false);
  function verifyInApp() { if (session.role === "citizen") { setVerifying(true); setVerifyDeclined(false); } }
  function verifyAllowed() {
    if (session.role !== "citizen") return;
    setVerifying(false); setWomanVerified(true); saveVerified(session.phone);
    addRide("DigiLocker verification complete (demo). Women's Safety Mode unlocked.", "ok");
  }

  const idx = useMemo(() => buildIndex(segs), [segs]);
  const [localVer, setVersion] = useState(0);
  const version = localVer + extVer;
  const bump = useCallback(() => { setVersion((v) => v + 1); onSegsChanged(); }, [onSegsChanged]);

  /* ---------- language (voice + alert messages) ---------- */
  const [lang, setLang] = useState<Lang>(() => { try { return (localStorage.getItem("nw_lang") as Lang) || "en"; } catch { return "en"; } });
  const langRef = useRef(lang); langRef.current = lang;
  useEffect(() => { try { localStorage.setItem("nw_lang", lang); } catch { /* ignore */ } }, [lang]);

  const [hour, setHour] = useState(22);
  const hourRef = useRef(hour); hourRef.current = hour;
  const [tab, setTab] = useState<CitizenTab | AuthorityTab>(citizen ? "map" : "requests");
  const [sel, setSel] = useState(31);

  // logs
  const logId = useRef(0);
  const [rideLog, setRideLog] = useState<LogItem[]>([]);
  const [cabLog, setCabLog] = useState<LogItem[]>([]);
  const [bridgeLog, setBridgeLog] = useState<LogItem[]>([]);
  const mk = (text: string, tone: Tone): LogItem => ({ id: ++logId.current, time: hourLabel(hourRef.current), text, tone });
  const addRide = useCallback((t: string, tone: Tone = "") => setRideLog((l) => [mk(t, tone), ...l]), []); // eslint-disable-line react-hooks/exhaustive-deps
  const addCab = useCallback((t: string, tone: Tone = "") => setCabLog((l) => [mk(t, tone), ...l]), []); // eslint-disable-line react-hooks/exhaustive-deps
  const addBridge = useCallback((t: string, tone: Tone = "") => setBridgeLog((l) => [mk(t, tone), ...l]), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (session.role === "citizen") {
      addRide(`Signed in as ${session.name}. ${session.consent ? "Sharing anonymous road readings during night trips." : "Not sharing road readings. Every feature still works."}`, "ok");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- voice ---------- */
  const [voice, setVoice] = useState(true);
  const [voiceNote, setVoiceNote] = useState("");
  const voiceRef = useRef(voice); voiceRef.current = voice;
  /** Speak `text` (English) or `ta` (Tamil) depending on the chosen language. */
  const say = useCallback((text: string, ta?: string) => {
    if (!voiceRef.current || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const taVoice = voices.find((x) => x.lang.toLowerCase().startsWith("ta"));
      // Without a Tamil voice the browser would mispronounce Tamil text, so fall back to English speech.
      const tamil = langRef.current === "ta" && ta && (taVoice || voices.length === 0);
      const u = new SpeechSynthesisUtterance(tamil ? ta : text);
      u.lang = tamil ? "ta-IN" : "en-IN";
      const v = tamil ? taVoice : voices.find((x) => x.lang.toLowerCase().startsWith("en-in")) || voices.find((x) => x.lang.toLowerCase().startsWith("en"));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch { /* speech unavailable */ }
  }, []);

  /* ---------- SafeRoute ---------- */
  const [from, setFrom] = useState<NodeId>("R");
  const [to, setTo] = useState<NodeId>("F");
  const safeCost = useCallback((e: Segment) => e.len * (1 + 4 * danger(e, hourRef.current)), []);
  const routes = useMemo(() => {
    if (from === to) return null;
    const fast = dijkstra(idx, from, to, (e) => e.len);
    const safe = dijkstra(idx, from, to, (e) => e.len * (1 + 4 * danger(e, hour)));
    return fast && safe ? { fast, safe } : null;
  }, [from, to, hour, idx, version]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Women's Safety ---------- */
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try { const s = JSON.parse(localStorage.getItem("nw_contacts") || "null"); if (Array.isArray(s) && s.length === 3) return s as Contact[]; } catch { /* storage unavailable */ }
    return [{ name: "Amma", phone: "" }, { name: "Roommate", phone: "" }, { name: "", phone: "" }];
  });
  useEffect(() => { try { localStorage.setItem("nw_contacts", JSON.stringify(contacts)); } catch { /* storage unavailable */ } }, [contacts]);
  const contactsRef = useRef(contacts); contactsRef.current = contacts;
  const [veh, setVeh] = useState(""); const vehRef = useRef(veh); vehRef.current = veh;
  const [drv, setDrv] = useState(""); const drvRef = useRef(drv); drvRef.current = drv;
  const [pick, setPick] = useState<NodeId>("C");
  const [dest, setDest] = useState<NodeId>("F");
  const [checkinOn, setCheckinOn] = useState(true); const checkinRef = useRef(checkinOn); checkinRef.current = checkinOn;
  const [wsAlert, setWsAlert] = useState<null | { kind: "ride" | "checkin" | "off" | "same"; road: string }>(null);
  const alertedRef = useRef(false);
  const [cabState, setCabState] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [wrongUsed, setWrongUsed] = useState(false);
  const [checkin, setCheckin] = useState<null | { road: string; count: number }>(null);
  const checkTimer = useRef<number | null>(null);

  const contactNames = () => {
    const n = contactsRef.current.filter((c) => c.name || c.phone).map((c) => c.name || c.phone);
    return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] || "your trusted contacts";
  };
  const tripText = () => (vehRef.current.trim() ? ` Vehicle: ${vehRef.current.trim()}${drvRef.current.trim() ? ` (driver ${drvRef.current.trim()})` : ""}.` : "");
  const tripTextTa = () => (vehRef.current.trim() ? ` வாகனம்: ${vehRef.current.trim()}${drvRef.current.trim() ? ` (ஓட்டுநர் ${drvRef.current.trim()})` : ""}.` : "");
  /** Where the rider is: the phone's GPS fix if it was shared, otherwise the simulated position on the pilot map. */
  const gpsFix = useRef<{ lat: number; lng: number; acc: number; at: number } | null>(null);
  const alertLocation = () => {
    const g = gpsFix.current;
    if (g && Date.now() - g.at < 5 * 60000) return { link: mapLink(g.lat, g.lng), real: true, acc: g.acc };
    const c = cabRef.current; const p = c ? pos(c) : NODES[pick];
    const ll = toLatLng(p.x, p.y);
    return { link: mapLink(ll.lat, ll.lng), real: false, acc: 0 };
  };
  const alertMessage = (kind: "ride" | "checkin", road: string) => {
    const when = hourLabel(hourRef.current);
    const loc = alertLocation();
    const en = (kind === "ride"
      ? `NightWing ALERT: My auto/cab left the expected route and entered a dark road (${road}) at ${when}. Please call me now. If I don't answer, call 112.`
      : `NightWing ALERT: I didn't respond to a safety check-in after my ride stopped on a dark road (${road}) at ${when}. Please call me now. If I don't answer, call 112.`) + tripText()
      + ` Location${loc.real ? ` (GPS, ±${Math.round(loc.acc)} m)` : " (simulated demo position)"}: ${loc.link}`;
    if (langRef.current !== "ta") return en;
    const ta = (kind === "ride"
      ? `NightWing எச்சரிக்கை: நான் பயணிக்கும் ஆட்டோ/கேப் எதிர்பார்த்த பாதையை விட்டு ${when} மணிக்கு இருண்ட சாலைக்கு (${road}) சென்றுள்ளது. உடனே என்னை அழைக்கவும். நான் பதிலளிக்கவில்லை என்றால் 112-ஐ அழைக்கவும்.`
      : `NightWing எச்சரிக்கை: இருண்ட சாலையில் (${road}) ${when} மணிக்கு என் பயணம் நின்ற பிறகு பாதுகாப்பு சோதனைக்கு நான் பதிலளிக்கவில்லை. உடனே என்னை அழைக்கவும். நான் பதிலளிக்கவில்லை என்றால் 112-ஐ அழைக்கவும்.`) + tripTextTa()
      + ` இருப்பிடம்: ${loc.link}`;
    return `${ta}\n\n${en}`;
  };

  /* ---------- Ride engine ---------- */
  const rideRef = useRef<Ride | null>(null);
  const cabRef = useRef<Ride | null>(null);
  const [movers, setMovers] = useState<{ rider: { x: number; y: number } | null; cab: { x: number; y: number } | null }>({ rider: null, cab: null });
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const [riding, setRiding] = useState(false);

  const cur = (r: Ride) => idx.between.get(r.path[r.idx] + r.path[r.idx + 1])!;
  const pos = (r: Ride) => {
    if (r.done) { const n = NODES[r.path[r.path.length - 1]]; return { x: n.x, y: n.y }; }
    const A = NODES[r.path[r.idx]], B = NODES[r.path[r.idx + 1]], f = Math.min(1, r.t / cur(r).len);
    return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
  };

  const watchCab = (r: Ride) => {
    const e = cur(r); if (!e) return;
    const h = hourRef.current, off = !r.expectedIds!.has(e.id), dark = lightAt(e, h) < 0.3;
    if (off && dark && !alertedRef.current) {
      alertedRef.current = true;
      setWsAlert({ kind: "ride", road: e.name });
      const msg = `Ride Watch alert. Your vehicle left the expected route and entered a dark zone on ${e.name}. Tap send to alert ${contactNames()}.`;
      addCab(msg, "bad"); say(msg, "எச்சரிக்கை. வாகனம் எதிர்பார்த்த பாதையை விட்டு இருண்ட சாலைக்குச் சென்றுள்ளது. உங்கள் நம்பகமான தொடர்புகளுக்கு எச்சரிக்கை அனுப்பவும்.");
      addBridge(`Police control room escalation prepared: ${e.name}${vehRef.current.trim() ? `, vehicle ${vehRef.current.trim()}` : ""}. Shared on the rider's confirmation.`, "bad");
    } else if (off && !r.offNoted) {
      r.offNoted = true; addCab(`Off the expected route on ${e.name}, which is lit. Monitoring.`, "warn");
      if (!alertedRef.current) setWsAlert({ kind: "off", road: e.name });
    }
    if (dark && checkinRef.current && !r.armedNoted) { r.armedNoted = true; addCab(`Entered a dark stretch (${e.name}). Smart Check-In is armed.`, "warn"); }
  };

  const onEnter = (r: Ride, kind: "ride" | "cab") => {
    if (kind === "cab") {
      if (r.divert) {
        const fromN = r.path[r.idx];
        const c = (e: Segment) => e.len * (0.2 + lightAt(e, hourRef.current) * 4);
        const dev = dijkstra(idx, fromN, r.dest!, c, new Set(r.expectedIds)) || dijkstra(idx, fromN, r.dest!, c);
        if (dev) r.path = r.path.slice(0, r.idx).concat(dev.nodes);
        r.divert = false;
        if (fastDemoRef.current) r.speed = 130; // presenter speed: reach the dark zone quickly after the wrong turn
        addCab(`Vehicle turned away from the expected route at ${NODES[fromN].name}.`, "warn");
      }
      watchCab(r);
    }
  };
  const onFrame = (r: Ride) => {
    const a = r.path[r.idx + 1], b = r.path[r.idx + 2]; if (!b) return;
    const n = idx.between.get(a + b)!; if (r.warned.has(n.id)) return;
    const remain = (cur(r).len - r.t) * M_PER_UNIT;
    if (remain <= 200) {
      r.warned.add(n.id);
      const t = hazardText(n, hourRef.current, remain);
      if (t) { addRide(`${t} (${n.name})`, lightAt(n, hourRef.current) < 0.3 && n.potholes ? "bad" : "warn"); say(t, hazardTextTa(n, hourRef.current, remain) || undefined); }
    }
  };
  const step = (r: Ride, dt: number, kind: "ride" | "cab") => {
    r.t += r.speed * dt;
    while (!r.done && r.t >= cur(r).len) {
      r.t -= cur(r).len; r.idx++;
      if (r.idx >= r.path.length - 1) {
        r.done = true; r.t = 0;
        if (kind === "ride") { addRide(`Arrived at ${NODES[r.path[r.path.length - 1]].name}.`, "ok"); say("You have arrived.", "நீங்கள் சென்றடைந்துவிட்டீர்கள்."); setRiding(false); }
        else { setCabState("done"); addCab(`Arrived at ${NODES[r.path[r.path.length - 1]].name}. Ride Watch ended.`, "ok"); }
        break;
      }
      onEnter(r, kind);
    }
    if (!r.done && kind === "ride") onFrame(r);
  };
  const tick = (ts: number) => {
    const dt = last.current ? Math.min(0.05, (ts - last.current) / 1000) : 0; last.current = ts;
    const rr = rideRef.current, cr = cabRef.current;
    if (rr && !rr.paused && !rr.done) step(rr, dt, "ride");
    if (cr && !cr.paused && !cr.done) step(cr, dt, "cab");
    setMovers({ rider: rr ? pos(rr) : null, cab: cr ? pos(cr) : null });
    if ([rr, cr].some((r) => r && !r.done)) raf.current = requestAnimationFrame(tick);
    else { raf.current = null; last.current = 0; }
  };
  const loop = () => { if (raf.current == null) { last.current = 0; raf.current = requestAnimationFrame(tick); } };
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); if (checkTimer.current) window.clearInterval(checkTimer.current); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  function startRide(route: Route) {
    const r: Ride = { path: route.nodes.slice(), idx: 0, t: 0, speed: 70, paused: false, done: false, warned: new Set() };
    rideRef.current = r; setRiding(true);
    addRide(`Ride started: ${NODES[route.nodes[0]].name} to ${NODES[route.nodes[route.nodes.length - 1]].name}.`);
    const first = route.edges[0], t0 = hazardText(first, hour, null);
    if (t0) { r.warned.add(first.id); const m = `Caution. You are starting on a ${t0.charAt(0).toLowerCase()}${t0.slice(1)}`; addRide(`${m} (${first.name})`, "warn"); say(m, `கவனம். ${hazardTextTa(first, hour, null)}`); }
    else if (!route.edges.some((e) => hazardText(e, hour, null))) say("Safest route selected. This route is well lit with no potholes reported.", "பாதுகாப்பான பாதை தேர்ந்தெடுக்கப்பட்டது. இந்தப் பாதையில் நல்ல வெளிச்சம் உள்ளது, பள்ளங்கள் இல்லை.");
    loop();
  }
  function stopRide() { rideRef.current = null; setRiding(false); setMovers((m) => ({ ...m, rider: null })); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }

  function clearCheckin() { if (checkTimer.current) { window.clearInterval(checkTimer.current); checkTimer.current = null; } setCheckin(null); }
  function startCab() {
    if (pick === dest) { setWsAlert({ kind: "same", road: "" }); return; }
    clearCheckin();
    const expected = dijkstra(idx, pick, dest, safeCost)!;
    alertedRef.current = false; setWsAlert(null); setWrongUsed(false);
    const r: Ride = { path: expected.nodes.slice(), idx: 0, t: 0, speed: 60, paused: false, done: false, warned: new Set(), expectedIds: new Set(expected.edges.map((e) => e.id)), dest };
    cabRef.current = r; setCabState("running"); setExpected(expected);
    addCab(`Ride Watch on: ${NODES[pick].name} to ${NODES[dest].name}. Trusted contacts: ${contactNames()}.`);
    if (shareGps) startGps();
    watchCab(r); loop();
  }
  const [expected, setExpected] = useState<Route | null>(null);
  const [shareGps, setShareGps] = useState(true);
  const [fastDemo, setFastDemo] = useState(true); // presenter speed: quicker auto ride and check-in for a live demo
  const fastDemoRef = useRef(fastDemo); fastDemoRef.current = fastDemo;
  const [gpsNote, setGpsNote] = useState("");
  const gpsWatch = useRef<number | null>(null);
  function startGps() {
    if (!("geolocation" in navigator)) { setGpsNote("This browser has no GPS access. Alerts will use the demo map position."); return; }
    if (gpsWatch.current != null) return;
    try {
      gpsWatch.current = navigator.geolocation.watchPosition(
        (p) => { gpsFix.current = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }; setGpsNote(`GPS on (±${Math.round(p.coords.accuracy)} m). Alerts include your live location.`); },
        () => { setGpsNote("Location was not shared, so alerts use the demo map position. Allow location to include your real position."); if (gpsWatch.current != null) navigator.geolocation.clearWatch(gpsWatch.current); gpsWatch.current = null; },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    } catch { setGpsNote("Location is blocked in this window. Alerts use the demo map position."); }
  }
  useEffect(() => () => { if (gpsWatch.current != null) try { navigator.geolocation.clearWatch(gpsWatch.current); } catch { /* ignore */ } }, []);
  function wrongTurn() { const r = cabRef.current; if (r && !r.done) { r.divert = true; setWrongUsed(true); addCab("Simulating: the driver will take a wrong turn at the next junction."); } }
  function stopCab() {
    const r = cabRef.current; if (!r || r.done) return;
    r.paused = true; setCabState("paused");
    const e = cur(r);
    if (lightAt(e, hour) < 0.3 && checkinOn) {
      addCab(`Unexpected stop on a dark stretch (${e.name}). Asking "Are you okay?"`, "warn");
      say("Are you okay? Tap I'm safe to confirm.", "நீங்கள் நலமா? பாதுகாப்பாக இருந்தால் I'm safe பொத்தானை அழுத்தவும்.");
      setCheckin({ road: e.name, count: fastDemo ? 5 : 10 });
      checkTimer.current = window.setInterval(() => {
        setCheckin((c) => {
          if (!c) return c;
          if (c.count <= 1) {
            if (checkTimer.current) { window.clearInterval(checkTimer.current); checkTimer.current = null; }
            setWsAlert({ kind: "checkin", road: c.road });
            const m = `No reply to Smart Check-In. Tap send to alert ${contactNames()}.`;
            addCab(m, "bad"); say(m, "பதில் இல்லை. உங்கள் நம்பகமான தொடர்புகளுக்கு எச்சரிக்கை அனுப்பவும்.");
            addBridge(`Smart Check-In missed on ${c.road}. Police control room escalation prepared.`, "bad");
            return null;
          }
          return { ...c, count: c.count - 1 };
        });
      }, 1000);
    } else addCab(`Stopped on ${e.name}, which is ${lightCat(lightAt(e, hour))}. Smart Check-In stays quiet on lit roads.`);
  }
  function resumeCab() { const r = cabRef.current; if (r) { r.paused = false; setCabState("running"); addCab("Ride resumed."); loop(); } }
  function importTrip() {
    setVeh("TN 09 BX 4821"); setDrv("R. Kumar");
    addCab("Trip details imported from partner ride app (demo): TN 09 BX 4821, driver R. Kumar.");
    addBridge("Ride-hailing partner shared trip details for Ride Watch: TN 09 BX 4821.");
  }

  /* ---------- Repairs & Civic Bridge ---------- */
  const [diag, setDiag] = useState<null | { type: "bulb" | "power"; area: string; count: number; road?: string }>(null);
  const [report, setReport] = useState("");
  const ticketFor = (e: Segment) => { if (!e.ticket) e.ticket = `NW-${1040 + e.id}`; return e.ticket; };

  function simBulb() {
    const c = segs.filter((e) => !e.fault && e.status === "open" && lightAt(e, hour) >= 0.6);
    if (!c.length) return;
    const pool = c.filter((e) => e.vuln === 1).length ? c.filter((e) => e.vuln === 1) : c;
    const e = pool[Math.floor(Math.random() * pool.length)];
    e.fault = "bulb"; e.persist = 0; e.reports = 1;
    setDiag({ ...diagnose([e]), road: e.name }); setSel(e.id);
    addBridge(`Bulb failure detected on ${e.name}. Ticket ${ticketFor(e)} sent to City Corporation.`, "warn"); bump();
  }
  function simPower() {
    const area = "South East"; const dropped: Segment[] = [];
    segs.forEach((e) => { if (e.area === area) { if (lightAt(e, hour) >= 0.3) dropped.push(e); e.fault = "power"; } });
    setDiag(diagnose(dropped.length >= 4 ? dropped : segs.filter((e) => e.area === area)));
    addBridge(`Area power cut in ${area}: report sent to Electricity Board, not to streetlight teams.`, "warn"); bump();
  }
  function restore() { segs.forEach((e) => { e.fault = null; }); setDiag(null); bump(); }
  function markRepaired(e: Segment) {
    e.status = "pending";
    reports.filter((r) => r.segId === e.id && r.status === "repair").forEach((r) => updateReport(r.id, "awaiting", [`The ${REPAIR_CREW.toLowerCase()} says the light on ${r.road} is repaired. Residents nearby are asked to confirm in the citizen app.`]));
    addBridge(`City Corporation marked ticket ${ticketFor(e)} (${e.name}) as repaired. Residents nearby asked to confirm in the citizen app.`);
    bump();
  }
  function makeReport() {
    const list = priorityList(segs, hour);
    let t = `NIGHTWING WARD REPAIR REPORT\nPilot area: campus neighbourhood (prototype data)\nSnapshot: ${hourLabel(hour)}\n\nPRIORITY REPAIRS (City Corporation)\n`;
    list.filter((e) => e.status !== "verified").forEach((e, i) => {
      t += `${i + 1}. ${e.name} (${e.area}) - ${lightCat(lightAt(e, hour))}, ${e.potholes} pothole(s), ${e.fault === "bulb" ? "new bulb failure" : `dark for ${e.persist} days`}, ${e.reports} report(s), priority ${priority(e, hour)}/100, status: ${e.status}${e.ticket ? `, ticket ${e.ticket}` : ""}\n`;
    });
    const ver = segs.filter((e) => e.status === "verified");
    t += `\nVERIFIED REPAIRS\n${ver.length ? ver.map((e) => `- ${e.name}`).join("\n") : "- None yet"}\n`;
    const pw = segs.filter((e) => e.fault === "power");
    t += `\nPOWER OUTAGES (sent to Electricity Board, excluded above)\n${pw.length ? `- ${pw[0].area}: ${pw.length} segments` : "- None"}\n`;
    setReport(t);
  }
  function partnerSync() {
    const dark = segs.filter((e) => e.fault !== "power" && lightAt(e, hour) < 0.6 && e.status !== "verified");
    dark.slice().sort(() => Math.random() - 0.5).slice(0, 3).forEach((e) => {
      const n = 2 + Math.floor(Math.random() * 4); e.reports += n; e.foundBy = "Delivery fleet";
      addBridge(`Delivery partner fleet: ${n} riders confirmed ${e.name} is ${lightCat(lightAt(e, hour))}${e.potholes ? " with potholes" : ""} (+${n} readings).`, "warn");
    });
    priorityList(segs, hour).filter((e) => e.status !== "verified").forEach((e) => {
      if (!e.ticket) { ticketFor(e); addBridge(`Ticket ${e.ticket} raised with City Corporation for ${e.name} (priority ${priority(e, hour)}).`); }
    });
    if (segs.some((e) => e.fault === "power")) addBridge("Electricity Board notified: area outage in South East. Streetlight tickets held back.", "warn");
    addBridge(`Navigation partner received the Danger Index for ${segs.length} segments; ${segs.filter((e) => zoneOf(e, hour) === "red").length} red segments will be avoided at night.`, "ok");
    bump();
  }

  /* ---------- Citizen streetlight reports ---------- */
  const [rSeg, setRSeg] = useState(31);
  const [rIssue, setRIssue] = useState(ISSUES[0]);
  const [rNote, setRNote] = useState("");
  const [rPhoto, setRPhoto] = useState<{ name: string; data: string } | null>(null);
  const [rGps, setRGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [rGpsMsg, setRGpsMsg] = useState("");
  const [rDone, setRDone] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [teamPick, setTeamPick] = useState<Record<string, string>>({});
  const [invalidWhy, setInvalidWhy] = useState<Record<string, string>>({});
  const [clockShift, setClockShift] = useState(0); // demo control: pretend time has passed
  const now = Date.now() + clockShift;
  const reporterName = session.role === "citizen" ? session.name : "";
  const reporterId = session.role === "citizen" ? session.phone : "";
  const involves = (r: StreetReport) => r.reporterId === reporterId || r.supporters.some((x) => x.id === reporterId);

  function pickPhoto(file: File | undefined) {
    if (!file) { setRPhoto(null); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 320 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        setRPhoto({ name: file.name, data: c.toDataURL("image/jpeg", 0.7) });
      };
      img.onerror = () => setRPhoto({ name: file.name, data: "" });
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  }
  function pinLocation() {
    if (!("geolocation" in navigator)) { setRGpsMsg("This browser can't share location. Pick the road from the list."); return; }
    setRGpsMsg("Finding your location…");
    try {
      navigator.geolocation.getCurrentPosition((p) => {
        const g = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        setRGps(g);
        const near = nearestSegment(segs, g.lat, g.lng);
        if (near) { setRSeg(near.seg.id); setRGpsMsg(`Pinned (±${Math.round(g.acc)} m). Nearest road: ${near.seg.name}, ${near.metres} m away.`); }
        else setRGpsMsg(`Pinned (±${Math.round(g.acc)} m). You are outside the simulated pilot area, so pick the road below; your GPS pin is attached to the report.`);
      }, () => setRGpsMsg("Location was not shared. Pick the road from the list."), { enableHighAccuracy: true, timeout: 15000 });
    } catch { setRGpsMsg("Location is blocked in this window. Pick the road from the list."); }
  }
  function submitReport(ev: FormEvent) {
    ev.preventDefault();
    const e = segs[rSeg];
    const at = nowStamp(), ts = Date.now();
    // 1. Duplicate: an open report already exists for this road -> add this resident as a supporter.
    const dup = reports.find((r) => r.segId === e.id && OPEN.includes(r.status));
    if (dup) {
      if (involves(dup)) { setRDone({ tone: "warn", text: `You have already reported ${e.name} (${dup.id}). We'll update you as it moves.` }); return; }
      setReports((rs) => rs.map((x) => (x.id === dup.id ? {
        ...x, supporters: [...x.supporters, { name: reporterName, id: reporterId }],
        photoData: x.photoData || rPhoto?.data, lat: x.lat ?? rGps?.lat, lng: x.lng ?? rGps?.lng, acc: x.acc ?? rGps?.acc,
        steps: [...x.steps, { status: x.status, text: `Also reported by ${reporterName}${rNote.trim() ? `: "${rNote.trim()}"` : ""}.`, at, ts }],
      } : x)));
      setRDone({ tone: "ok", text: `${e.name} is already reported (${dup.id}). We added you to it: ${dup.supporters.length + 2} residents have now reported this light, which raises its priority.` });
      setRNote(""); setRPhoto(null); return;
    }
    // 2. Rate limit: at most 3 open reports per person, to keep the queue honest.
    const mineOpen = reports.filter((r) => r.reporterId === reporterId && OPEN.includes(r.status)).length;
    if (mineOpen >= MAX_OPEN_PER_PERSON) { setRDone({ tone: "warn", text: `You already have ${mineOpen} open reports. You can send a new one when one of them is closed.` }); return; }
    const id = `SR-${Math.max(1000, ...reports.map((x) => Number(x.id.slice(3)) || 0)) + 1}`;
    const r: StreetReport = {
      id, segId: e.id, road: e.name, area: e.area, issue: rIssue, note: rNote.trim(), photo: rPhoto?.name || "", photoData: rPhoto?.data || undefined,
      lat: rGps?.lat, lng: rGps?.lng, acc: rGps?.acc,
      reporter: reporterName, reporterId, supporters: [], createdAt: ts, dueAt: ts + DUE_HOURS * 3600000, status: "submitted",
      steps: [{ status: "submitted", text: `Reported by ${reporterName}: ${rIssue.toLowerCase()} on ${e.name}. Sent to city officials, who aim to inspect within ${DUE_HOURS} hours.`, at, ts }],
    };
    setReports((rs) => [r, ...rs]);
    setRDone({ tone: "ok", text: `Report ${id} sent to city officials. You can track it below.` });
    setRNote(""); setRPhoto(null); setRGps(null); setRGpsMsg("");
  }
  function updateReport(id: string, status: ReportStatus, texts: string[], extra: Partial<StreetReport> = {}) {
    const at = nowStamp(), ts = Date.now();
    setReports((rs) => rs.map((x) => (x.id === id ? { ...x, ...extra, status, steps: [...x.steps, ...texts.map((text) => ({ status, text, at, ts }))] } : x)));
  }
  function sendTeam(r: StreetReport) {
    const team = teamPick[r.id] || TEAMS[0];
    updateReport(r.id, "inspection", [`${team} sent to check ${r.road}.`], { team });
    addBridge(`Citizen report ${r.id}: ${team} sent to inspect ${r.road}.`);
  }
  function markInvalid(r: StreetReport) {
    const why = invalidWhy[r.id] || INVALID_REASONS[0];
    updateReport(r.id, "invalid", [`Closed by the ward office: ${why.toLowerCase()}.`]);
    addBridge(`Citizen report ${r.id} closed as not valid (${why.toLowerCase()}).`);
  }
  function confirmFault(r: StreetReport) {
    const e = segs[r.segId];
    if (e.fault !== "power") e.fault = "bulb";
    e.status = "open"; e.persist = 0; e.reports += 1 + r.supporters.length; e.foundBy = "Citizen report";
    const t = ticketFor(e);
    updateReport(r.id, "repair", [`${r.team || "Inspection team"} confirmed the light is not working.`, `Sent to the ${REPAIR_CREW.toLowerCase()} (ticket ${t}).`]);
    addBridge(`Citizen report ${r.id} confirmed on site. Ticket ${t} sent to the ${REPAIR_CREW.toLowerCase()} for ${r.road}.`, "warn");
    bump();
  }
  function notConfirmed(r: StreetReport) {
    updateReport(r.id, "working", [`${r.team || "Inspection team"} found the light working. Report closed. Thank you for reporting.`]);
    addBridge(`Citizen report ${r.id}: light on ${r.road} checked and found working. Closed.`, "ok");
  }
  function crewFixed(r: StreetReport) {
    const e = segs[r.segId];
    e.status = "pending";
    updateReport(r.id, "awaiting", [`The ${REPAIR_CREW.toLowerCase()} says the light on ${r.road} is repaired. Residents nearby are asked to confirm in the citizen app.`]);
    addBridge(`Citizen report ${r.id}: crew marked ${r.road} repaired. Waiting for residents to confirm.`);
    bump();
  }
  /** A resident confirms (or rejects) a repair. Only residents can close a repair, not the office that did it. */
  function residentConfirm(e: Segment, lit: boolean) {
    const linked = reports.filter((r) => r.segId === e.id && r.status === "awaiting");
    if (lit) {
      e.status = "verified"; e.fault = null;
      linked.forEach((r) => updateReport(r.id, "fixed", [`${reporterName} confirmed the light on ${r.road} is working again. Report closed.`]));
      addBridge(`Ticket ${ticketFor(e)} closed: a resident (${reporterName}) confirmed ${e.name} is now lit. Navigation partner updated.`, "ok");
    } else {
      e.status = "reopened"; e.reports++; e.persist++;
      linked.forEach((r) => updateReport(r.id, "repair", [`${reporterName} reports ${r.road} is still dark. Sent back to the repair crew.`]));
      addBridge(`Ticket ${ticketFor(e)} reopened: a resident (${reporterName}) reports ${e.name} is still dark.`, "bad");
    }
    bump();
  }
  const openReports = reports.filter((r) => OPEN.includes(r.status) && r.status !== "awaiting").length;
  const overdue = reports.filter((r) => (r.status === "submitted" || r.status === "inspection") && now > r.dueAt).length;

  /* ---------- notifications for the signed-in citizen ---------- */
  const seenKey = `nw_seen_${reporterId}`;
  const [lastSeen] = useState<number>(() => { try { return Number(localStorage.getItem(seenKey) || 0); } catch { return 0; } });
  const updates = citizen ? reports.filter((r) => involves(r) && r.steps.some((st) => (st.ts || 0) > lastSeen && !st.text.startsWith(`Reported by ${reporterName}`) && !st.text.startsWith(`Also reported by ${reporterName}`))) : [];
  const [showUpdates, setShowUpdates] = useState(true);
  useEffect(() => { if (citizen) try { localStorage.setItem(seenKey, String(Date.now())); } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toConfirm = citizen ? segs.filter((e) => e.status === "pending") : [];

  /* ---------- Danger Index weights (city engineers) ---------- */
  const [w, setW] = useState({ ...WEIGHTS });
  function changeWeight(k: keyof typeof w, v: number) {
    const rest = (Object.keys(w) as (keyof typeof w)[]).filter((x) => x !== k);
    const left = 1 - v, sumRest = rest.reduce((t, x) => t + w[x], 0) || 1;
    const nw = { ...w, [k]: v } as typeof w;
    rest.forEach((x) => { nw[x] = (w[x] / sumRest) * left; });
    setWeights(nw); setW({ ...WEIGHTS }); bump();
  }
  function resetWeights() { setWeights(DEFAULT_WEIGHTS); setW({ ...WEIGHTS }); bump(); addBridge("Danger Index weights reset to 0.50 / 0.35 / 0.15."); }

  /* ---------- Sensor check: real phone sensors ---------- */
  const [fieldLog, setFieldLog] = useState<FieldReading[]>(() => { try { const l = JSON.parse(localStorage.getItem("nw_field_log") || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } });
  useEffect(() => { try { localStorage.setItem("nw_field_log", JSON.stringify(fieldLog.slice(0, 500))); } catch { /* ignore */ } }, [fieldLog]);
  const [cam, setCam] = useState<{ on: boolean; luma: number | null; lux: number | null; msg: string }>({ on: false, luma: null, lux: null, msg: "" });
  const [motion, setMotion] = useState<{ on: boolean; jolt: number; peak: number; bumps: number; msg: string }>({ on: false, jolt: 0, peak: 0, bumps: 0, msg: "" });
  const [geo, setGeo] = useState<{ on: boolean; lat: number | null; lng: number | null; acc: number | null; speed: number | null; msg: string }>({ on: false, lat: null, lng: null, acc: null, speed: null, msg: "" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const camTimer = useRef<number | null>(null);
  const luxSensor = useRef<{ stop: () => void } | null>(null);
  const motionH = useRef<((ev: DeviceMotionEvent) => void) | null>(null);
  const lastBump = useRef(0);
  const geoWatch = useRef<number | null>(null);
  const live = useRef({ luma: null as number | null, lux: null as number | null, lat: null as number | null, lng: null as number | null, acc: null as number | null });
  const BUMP_MS2 = 6; // jolt above gravity that counts as a pothole bump (m/s²); tune with field data

  const lightFrom = (lux: number | null, luma: number | null) => {
    if (lux != null) return { v: lux, src: "Ambient light sensor (lux)", label: lux >= 10 ? "lit" : lux >= 3 ? "dim" : "dark" };
    if (luma != null) return { v: luma, src: "Camera brightness (0-255)", label: luma >= 90 ? "lit" : luma >= 40 ? "dim" : "dark" };
    return { v: null, src: "None", label: "not measured" };
  };
  async function startCamera() {
    // Prefer a real ambient light sensor where the browser exposes one.
    const ALS = (window as unknown as { AmbientLightSensor?: new (o: object) => { illuminance: number; start: () => void; stop: () => void; addEventListener: (t: string, f: () => void) => void } }).AmbientLightSensor;
    if (ALS) {
      try {
        const sensor = new ALS({ frequency: 2 });
        sensor.addEventListener("reading", () => { live.current.lux = sensor.illuminance; setCam((c) => ({ ...c, lux: Math.round(sensor.illuminance) })); });
        sensor.start(); luxSensor.current = sensor;
      } catch { /* not allowed */ }
    }
    if (!navigator.mediaDevices?.getUserMedia) { setCam((c) => ({ ...c, msg: "Camera is not available in this browser or window. Open the site on a phone over https." })); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: 160, height: 120 }, audio: false });
      streamRef.current = st;
      const v = videoRef.current!; v.srcObject = st; await v.play();
      const c = document.createElement("canvas"); c.width = 32; c.height = 24; const g = c.getContext("2d", { willReadFrequently: true })!;
      camTimer.current = window.setInterval(() => {
        g.drawImage(v, 0, 0, 32, 24);
        const d = g.getImageData(0, 0, 32, 24).data; let t = 0;
        for (let i = 0; i < d.length; i += 4) t += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const luma = Math.round(t / (d.length / 4)); live.current.luma = luma;
        setCam((x) => ({ ...x, luma }));
      }, 500);
      setCam((x) => ({ ...x, on: true, msg: "Point the back camera along the road, away from direct lamps. Auto-exposure makes this a rough guide; it is calibrated against a lux meter in the pilot." }));
    } catch {
      setCam((x) => ({ ...x, msg: "Camera permission was not given, or this window blocks the camera (for example a preview frame). Open the GitHub Pages link on a phone." }));
    }
  }
  function stopCamera() {
    if (camTimer.current) window.clearInterval(camTimer.current); camTimer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    try { luxSensor.current?.stop(); } catch { /* ignore */ } luxSensor.current = null;
    live.current.luma = null; live.current.lux = null;
    setCam({ on: false, luma: null, lux: null, msg: "" });
  }
  async function startMotion() {
    if (typeof DeviceMotionEvent === "undefined") { setMotion((m) => ({ ...m, msg: "This device has no motion sensor (try a phone)." })); return; }
    const DM = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (DM.requestPermission) { try { if ((await DM.requestPermission()) !== "granted") { setMotion((m) => ({ ...m, msg: "Motion permission was not given." })); return; } } catch { setMotion((m) => ({ ...m, msg: "Motion permission was not given." })); return; } }
    let got = false;
    const h = (ev: DeviceMotionEvent) => {
      const a = ev.acceleration, ag = ev.accelerationIncludingGravity;
      let j = 0;
      if (a && a.x != null) j = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      else if (ag && ag.x != null) j = Math.abs(Math.hypot(ag.x || 0, ag.y || 0, ag.z || 0) - 9.81);
      else return;
      got = true;
      const t = Date.now();
      if (j > BUMP_MS2 && t - lastBump.current > 1200) {
        lastBump.current = t;
        setMotion((m) => ({ ...m, bumps: m.bumps + 1 }));
        record(`Bump detected (${j.toFixed(1)} m/s²)`, j, true);
      }
      setMotion((m) => ({ ...m, jolt: +j.toFixed(1), peak: Math.max(m.peak, +j.toFixed(1)) }));
    };
    motionH.current = h; window.addEventListener("devicemotion", h);
    setMotion((m) => ({ ...m, on: true, msg: `Listening. A jolt above ${BUMP_MS2} m/s² counts as a bump. Keep the phone in a mount or pocket while riding.` }));
    window.setTimeout(() => { if (!got) setMotion((m) => ({ ...m, msg: "No motion readings yet. Laptops and preview windows usually have no accelerometer; try a phone." })); }, 2500);
  }
  function stopMotion() { if (motionH.current) window.removeEventListener("devicemotion", motionH.current); motionH.current = null; setMotion({ on: false, jolt: 0, peak: 0, bumps: 0, msg: "" }); }
  function startGeo() {
    if (!("geolocation" in navigator)) { setGeo((g) => ({ ...g, msg: "Location is not available in this browser." })); return; }
    try {
      geoWatch.current = navigator.geolocation.watchPosition((p) => {
        Object.assign(live.current, { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
        setGeo({ on: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), speed: p.coords.speed != null ? Math.round(p.coords.speed * 3.6) : null, msg: "" });
      }, () => setGeo((g) => ({ ...g, on: false, msg: "Location permission was not given, or this window blocks it." })), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
      setGeo((g) => ({ ...g, on: true, msg: "Waiting for a GPS fix…" }));
    } catch { setGeo((g) => ({ ...g, msg: "Location is blocked in this window." })); }
  }
  function stopGeo() { if (geoWatch.current != null) try { navigator.geolocation.clearWatch(geoWatch.current); } catch { /* ignore */ } geoWatch.current = null; live.current.lat = live.current.lng = live.current.acc = null; setGeo({ on: false, lat: null, lng: null, acc: null, speed: null, msg: "" }); }
  function record(note: string, jolt = 0, isBump = false) {
    const L = live.current, lf = lightFrom(L.lux, L.luma);
    setFieldLog((l) => [{ time: new Date().toLocaleString("en-IN"), lat: L.lat, lng: L.lng, acc: L.acc != null ? Math.round(L.acc) : null, light: lf.v, lightSource: lf.src, lightLabel: lf.label, jolt: +jolt.toFixed(1), bump: isBump, note }, ...l]);
  }
  useEffect(() => () => { stopCamera(); stopMotion(); stopGeo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Send a real reading into the Danger Index for one road. */
  const [sRoad, setSRoad] = useState(4);
  const [sMsg, setSMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const bumpsSent = useRef(0);
  useEffect(() => {
    if (geo.lat == null || geo.lng == null) return;
    const near = nearestSegment(segs, geo.lat, geo.lng);
    if (near && near.metres < 150) setSRoad(near.seg.id);
  }, [geo.lat, geo.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  function simulateBump() {
    const j = 7 + Math.random() * 4;
    lastBump.current = Date.now();
    setMotion((m) => ({ ...m, on: m.on, bumps: m.bumps + 1, jolt: +j.toFixed(1), peak: Math.max(m.peak, +j.toFixed(1)) }));
    record(`Bump detected (${j.toFixed(1)} m/s², demo)`, j, true);
  }
  function sendToMap() {
    const e = segs[sRoad];
    const L = live.current, lf = lightFrom(L.lux, L.luma);
    const newBumps = motion.bumps - bumpsSent.current;
    if (lf.v == null && newBumps <= 0) { setSMsg({ tone: "warn", text: "Start the light meter, or detect a bump, before sending a reading to the map." }); return; }
    const before = zoneOf(e, hour), dBefore = Math.round(danger(e, hour) * 100);
    if (lf.v != null) e.measured = lf.label === "lit" ? 0.85 : lf.label === "dim" ? 0.45 : 0.1;
    if (newBumps > 0) { e.potholes = Math.min(3, e.potholes + 1); bumpsSent.current = motion.bumps; }
    e.reports += 1; e.foundBy = "Sensor check";
    const after = zoneOf(e, hour), dAfter = Math.round(danger(e, hour) * 100);
    record(`Sent to map: ${e.name}`);
    addBridge(`Sensor check reading added to ${e.name}: ${lf.v != null ? lf.label : "no light reading"}${newBumps > 0 ? ", pothole bump" : ""}.`);
    setSel(e.id); bump();
    setSMsg({ tone: "ok", text: `${e.name} updated from your reading: Danger Index ${dBefore} → ${dAfter}, ${zoneLabel[before].toLowerCase()} → ${zoneLabel[after].toLowerCase()}. Open the Danger map to see it.` });
  }
  const csv = () => {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return ["time,lat,lng,accuracy_m,light_value,light_source,light_label,jolt_ms2,bump,note", ...fieldLog.slice().reverse().map((r) => [r.time, r.lat, r.lng, r.acc, r.light, r.lightSource, r.lightLabel, r.jolt, r.bump ? 1 : 0, r.note].map(q).join(","))].join("\n");
  };
  function downloadCsv() {
    try {
      const url = URL.createObjectURL(new Blob([csv()], { type: "text/csv" }));
      const a = document.createElement("a"); a.href = url; a.download = "nightwing-field-log.csv"; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { /* downloads blocked */ }
  }

  /* ---------- tabs ---------- */
  const citizenTabs: { id: CitizenTab; label: string; icon: ReactNode }[] = [
    { id: "map", label: "Danger map", icon: <Eye size={15} /> },
    { id: "route", label: "SafeRoute", icon: <Navigation size={15} /> },
    { id: "report", label: `Report a light${updates.length || toConfirm.length ? ` (${updates.length + toConfirm.length})` : ""}`, icon: <Lightbulb size={15} /> },
    { id: "sensor", label: "Sensor check", icon: <Activity size={15} /> },
    ...(isWoman ? [{ id: "women" as CitizenTab, label: womanVerified ? "Women's Safety" : "Women's Safety (verify)", icon: womanVerified ? <ShieldCheck size={15} /> : <Lock size={15} /> }] : []),
  ];
  const authorityTabs: { id: AuthorityTab; label: string; icon: ReactNode }[] = [
    { id: "requests", label: `Citizen reports${openReports ? ` (${openReports})` : ""}`, icon: <ClipboardList size={15} /> },
    { id: "repairs", label: "Repair dashboard", icon: <Wrench size={15} /> },
    { id: "bridge", label: "Civic Bridge", icon: <Handshake size={15} /> },
  ];
  const tabs = citizen ? citizenTabs : authorityTabs;
  const seg = segs[sel];

  /* ---------- map ---------- */
  const showRoutes = tab === "route" && routes;
  const showExpected = tab === "women" && expected && cabState !== "idle";
  const poly = (nodes: NodeId[]) => nodes.map((k) => `${NODES[k].x},${NODES[k].y}`).join(" ");
  const counts = { red: 0, orange: 0, green: 0 };
  segs.forEach((e) => { counts[zoneOf(e, hour)]++; });

  const map = (
    <svg className="pt-map" viewBox="0 0 1000 660" role="group" aria-label="Simulated pilot neighbourhood with roads coloured by Danger Index. Use Tab to move between roads.">
      <defs><pattern id="ptDots" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#bac9c1" opacity=".56" /></pattern></defs>
      <rect width="1000" height="660" fill="#eff3ec" /><rect width="1000" height="660" fill="url(#ptDots)" />
      {[80, 300, 520, 760].map((x, i, xs) => [80, 250, 420].map((y, j) => {
        const nx = [300, 520, 760, 920][i], ny = [250, 420, 580][j];
        return <rect key={`${x}-${y}`} x={x + 22} y={y + 22} width={nx - x - 44} height={ny - y - 44} rx="12" fill="#e2ede5" />;
      }))}
      {segs.map((e) => lightAt(e, hour) >= 0.6 && <line key={`g${e.id}`} className="pt-glow" x1={NODES[e.a].x} y1={NODES[e.a].y} x2={NODES[e.b].x} y2={NODES[e.b].y} />)}
      {segs.map((e) => <line key={`c${e.id}`} className="pt-casing" x1={NODES[e.a].x} y1={NODES[e.a].y} x2={NODES[e.b].x} y2={NODES[e.b].y} />)}
      {seg && <line className="pt-sel" x1={NODES[seg.a].x} y1={NODES[seg.a].y} x2={NODES[seg.b].x} y2={NODES[seg.b].y} />}
      {segs.map((e) => <line key={`r${e.id}`} className={`pt-road pt-road-${zoneOf(e, hour)} ${e.fault === "power" ? "pt-road-power" : ""} ${showRoutes || showExpected ? "pt-road-dim" : ""}`} x1={NODES[e.a].x} y1={NODES[e.a].y} x2={NODES[e.b].x} y2={NODES[e.b].y} />)}
      {segs.map((e) => Array.from({ length: e.potholes }, (_, k) => {
        const f = (k + 1) / (e.potholes + 1), A = NODES[e.a], B = NODES[e.b];
        return <circle key={`p${e.id}-${k}`} className="pt-pot" r="6" cx={A.x + (B.x - A.x) * f} cy={A.y + (B.y - A.y) * f} />;
      }))}
      {showRoutes && <><polyline className="pt-rt-case" points={poly(routes!.safe.nodes)} /><polyline className="pt-rt-safe" points={poly(routes!.safe.nodes)} /><polyline className="pt-rt-fast" points={poly(routes!.fast.nodes)} /></>}
      {showExpected && <><polyline className="pt-rt-case" points={poly(expected!.nodes)} /><polyline className="pt-rt-exp" points={poly(expected!.nodes)} /></>}
      {segs.map((e) => {
        const pick = () => { setSel(e.id); if (citizen) setTab("map"); };
        return <line key={`h${e.id}`} className="pt-hit" tabIndex={0} role="button" aria-label={`${e.name}: ${zoneLabel[zoneOf(e, hour)]}, ${lightCat(lightAt(e, hour))}, ${e.potholes} pothole${e.potholes === 1 ? "" : "s"}. Press Enter for details.`} aria-pressed={sel === e.id}
          onClick={pick} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } }}
          x1={NODES[e.a].x} y1={NODES[e.a].y} x2={NODES[e.b].x} y2={NODES[e.b].y}><title>{e.name}</title></line>;
      })}
      {SAFE_SPOTS.map((p, i) => <g key={`s${i}`} className="pt-spot"><rect x={p.x - 11} y={p.y - 11} width="22" height="22" rx="6" /><text x={p.x} y={p.y + 4}>{p.k}</text><title>{p.name}</title></g>)}
      {(Object.keys(NODES) as NodeId[]).map((k) => <circle key={`n${k}`} className={NODES[k].type ? "pt-node pt-node-lm" : "pt-node"} r={NODES[k].type ? 9 : 6} cx={NODES[k].x} cy={NODES[k].y} />)}
      {LANDMARKS.map((k) => <text key={`l${k}`} className="pt-lbl" x={NODES[k].x} y={NODES[k].y <= 80 ? NODES[k].y - 18 : NODES[k].y + 30}>{NODES[k].name}</text>)}
      {movers.rider && <circle className="pt-rider" r="10" cx={movers.rider.x} cy={movers.rider.y} />}
      {movers.cab && <circle className="pt-cab" r="10" cx={movers.cab.x} cy={movers.cab.y} />}
    </svg>
  );

  /* ---------- panels ---------- */
  function seePanel() {
    if (!seg) return null;
    const p = parts(seg, hour), d = p.dark + p.pot + p.vuln, lv = level(d), z = zoneOf(seg, hour), near = nearestSafeSpot(seg);
    const bar = (lab: string, v: number, cls: string) => <div className="pt-dbar"><span>{lab}</span><div className="pt-track"><i className={cls} style={{ width: `${Math.round(v * 100)}%` }} /></div><em>{Math.round(v * 100)}</em></div>;
    return (
      <>
        {(updates.length > 0 || toConfirm.length > 0) && showUpdates && <button type="button" className="pt-notice pt-notice-btn" onClick={() => setTab("report")}><Bell size={16} /><span>{updates.length > 0 && <><b>{updates.length} update{updates.length === 1 ? "" : "s"}</b> on your reports. </>}{toConfirm.length > 0 && <><b>{toConfirm.length} repair{toConfirm.length === 1 ? "" : "s"}</b> near you to confirm. </>}Open Report a light.</span></button>}
        <p className="pt-kicker">CITIZEN APP · SEE</p>
        <h2>Where the danger is tonight</h2>
        <p className="pt-hint">Drag the time slider past midnight to see lights that fail late at night. Tap a road on the map to see its Danger Index.</p>
        <div className="pt-counts"><div className="pt-count pt-count-red"><b>{counts.red}</b><span>Dark + potholes</span></div><div className="pt-count pt-count-orange"><b>{counts.orange}</b><span>Dark or risky</span></div><div className="pt-count pt-count-green"><b>{counts.green}</b><span>Lower risk</span></div></div>
        <label className="pt-field" htmlFor="pt-seg">Road segment
          <select id="pt-seg" value={sel} onChange={(e) => setSel(Number(e.target.value))}>{segs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        </label>
        <div className="pt-segcard">
          <h3>{seg.name}</h3>
          <p className="pt-sub">{NODES[seg.a].name} to {NODES[seg.b].name} · {seg.area} · {metres(seg.len)} m</p>
          <div className="pt-row"><Chip zone={z}>{zoneLabel[z]}</Chip><Chip>{lightCat(lightAt(seg, hour))} at {hourLabel(hour)}</Chip><Chip>{seg.potholes} pothole{seg.potholes === 1 ? "" : "s"}</Chip>{seg.fault === "power" && <Chip zone="orange">Power outage</Chip>}{seg.fault === "bulb" && <Chip zone="red">Bulb failure</Chip>}{seg.status === "verified" && <Chip zone="green">Repair verified</Chip>}{seg.measured != null && <Chip zone="ink">Measured by Sensor check</Chip>}</div>
          <div className="pt-score"><b>{Math.round(d * 100)}</b><Chip zone={lv.zone}>{lv.label} danger</Chip></div>
          <div className="pt-bars">{bar(`Darkness × ${WEIGHTS.dark.toFixed(2)}`, p.dark, "pt-fill-dark")}{bar(`Potholes × ${WEIGHTS.pot.toFixed(2)}`, p.pot, "pt-fill-road")}{bar(`Vulnerable × ${WEIGHTS.vuln.toFixed(2)}`, p.vuln, "pt-fill-context")}</div>
          <p className="pt-mini-title"><Clock3 size={13} /> Dark Hours timeline</p>
          <div className="pt-hours">{[20, 21, 22, 23, 24, 25, 26].map((h) => <div key={h}><i className={`pt-hz-${zoneOf(seg, h)}`} />{h % 24 % 12 || 12}{h % 24 < 12 ? "a" : "p"}</div>)}</div>
          <div className="pt-kv"><span>Nearest Safe Spot</span><span>{near.spot.name}, {near.metres} m</span></div>
          <div className="pt-kv"><span>Independent trips reporting</span><span>{seg.reports || "None"}</span></div>
          <div className="pt-kv"><span>Dark for</span><span>{seg.persist ? `${seg.persist} days` : "Not dark"}</span></div>
          <button type="button" className="pt-btn pt-btn-sm" style={{ marginTop: 10 }} onClick={() => { setRSeg(seg.id); setRDone(null); setTab("report"); }}><Lightbulb size={14} /> Report a broken light here</button>
        </div>
      </>
    );
  }

  function routePanel() {
    const card = (kind: "fast" | "safe", r: Route) => {
      const st = routeStats(r, hour), lv = level(st.danger), same = routes!.fast.nodes.join() === routes!.safe.nodes.join();
      return (
        <div className={`pt-route ${kind === "safe" ? "pt-route-safe" : ""}`}>
          <span className="pt-route-t"><i className={kind === "safe" ? "pt-sw-safe" : "pt-sw-fast"} />{kind === "fast" ? "Fastest route" : "Safer route"}</span>
          <div className="pt-route-min">{st.min}<small>min · {st.km} km</small></div>
          <ul><li>{st.dark} dark stretch{st.dark === 1 ? "" : "es"}</li><li>{st.pot} pothole{st.pot === 1 ? "" : "s"}</li></ul>
          <Chip zone={lv.zone}>{lv.label} danger</Chip>
          <button type="button" className={`pt-btn pt-btn-sm ${kind === "safe" ? "pt-btn-primary" : ""}`} disabled={same && kind === "fast"} onClick={() => startRide(r)}>{same && kind === "fast" ? "Same as safer" : "Ride this route"}</button>
        </div>
      );
    };
    return (
      <>
        <p className="pt-kicker">CITIZEN APP · AVOID</p>
        <h2>SafeRoute: fastest or safer?</h2>
        <p className="pt-hint">NightWing penalises roads with a high Danger Index. Ride the fastest route to hear the voice alerts a rider would get.</p>
        <div className="pt-grid2">
          <label className="pt-field" htmlFor="pt-from">From<select id="pt-from" value={from} onChange={(e) => { stopRide(); setFrom(e.target.value as NodeId); }}>{LANDMARKS.map((k) => <option key={k} value={k}>{NODES[k].name}</option>)}</select></label>
          <label className="pt-field" htmlFor="pt-to">To<select id="pt-to" value={to} onChange={(e) => { stopRide(); setTo(e.target.value as NodeId); }}>{LANDMARKS.map((k) => <option key={k} value={k}>{NODES[k].name}</option>)}</select></label>
        </div>
        {routes ? <div className="pt-routes">{card("fast", routes.fast)}{card("safe", routes.safe)}</div> : <p className="pt-hint">Choose two different places.</p>}
        <div className="pt-row" style={{ marginTop: 12 }}>
          <label className="pt-check" htmlFor="pt-voice"><input id="pt-voice" type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> <Volume2 size={14} /> Voice alerts</label>
          {langPicker("pt-lang-r")}
          <button type="button" className="pt-btn pt-btn-sm" disabled={!riding} onClick={() => { stopRide(); addRide("Ride stopped."); }}>Stop ride</button>
        </div>
        <p className="pt-mini-title">Ride alerts</p>
        <Log items={rideLog} empty="Alerts appear here during a ride." />
      </>
    );
  }

  function testVoice() {
    if (!("speechSynthesis" in window)) { setVoiceNote("This browser can't speak. Alerts still appear on screen."); return; }
    const voices = window.speechSynthesis.getVoices();
    const hasTa = voices.some((x) => x.lang.toLowerCase().startsWith("ta"));
    if (lang === "ta" && !hasTa) setVoiceNote("No Tamil voice is installed on this device, so voice alerts speak English. Tamil text messages still work.");
    else setVoiceNote(lang === "ta" ? "Tamil voice found." : "Playing a test alert.");
    const was = voiceRef.current; voiceRef.current = true;
    say("Dark stretch ahead in 200 metres, pothole reported.", "இன்னும் 200 மீட்டரில் இருண்ட சாலை, பள்ளம் உள்ளது.");
    voiceRef.current = was;
  }
  function langPicker(id: string) {
    return <span className="pt-langwrap"><label className="pt-field pt-field-inline pt-lang" htmlFor={id}><Languages size={14} /><span className="pt-sr">Language for voice and alerts</span>
      <select id={id} value={lang} onChange={(e) => { setLang(e.target.value as Lang); setVoiceNote(""); }}><option value="en">English</option><option value="ta">தமிழ் (Tamil)</option></select></label>
      <button type="button" className="pt-btn pt-btn-sm" onClick={testVoice}><Volume2 size={14} /> Test voice</button>{voiceNote && <span className="pt-fine pt-voicenote" role="status">{voiceNote}</span>}</span>;
  }
  function sendPanel(kind: "ride" | "checkin", road: string) {
    const message = alertMessage(kind, road);
    const list = contacts.filter((c) => c.name || c.phone);
    return (
      <div className="pt-send">
        {list.length === 0 && <p className="pt-fine">Add trusted contacts above to send this alert.</p>}
        {list.map((c, i) => {
          const d = c.phone ? phoneDigits(c.phone) : "";
          if (d.length < 11) return <div className="pt-who" key={i}><b>{c.name || c.phone}</b><span className="pt-fine">Add a number above to message {c.name || "this contact"}.</span></div>;
          return (
            <div className="pt-who" key={i}><b>{c.name || c.phone}</b>
              <a className="pt-btn pt-btn-sm pt-btn-wa" href={`https://wa.me/${d}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Send on WhatsApp</a>
              <a className="pt-btn pt-btn-sm" href={`sms:+${d}?&body=${encodeURIComponent(message)}`}><Phone size={14} /> SMS</a>
            </div>
          );
        })}
        <label className="pt-field" htmlFor="pt-msg">Alert message<textarea id="pt-msg" readOnly value={message} /></label>
        <div className="pt-row"><button type="button" className="pt-btn pt-btn-sm" onClick={(e) => copyText(message, e.currentTarget)}><Copy size={14} /> Copy message</button><span className="pt-fine">WhatsApp opens with the message ready; tap send there.</span></div>
        <div className="pt-escalate"><Landmark size={16} /><span><b>Civic Bridge: police escalation.</b> Ready to share with the police control room: dark-zone location ({road}){veh.trim() ? `, vehicle ${veh.trim()}` : ""} and the expected route. Call <b>112</b> or use the Kavalan SOS app.</span></div>
      </div>
    );
  }

  function womenPanel() {
    if (!womanVerified) return (
      <>
        <p className="pt-kicker">CITIZEN APP · WOMEN'S SAFETY MODE</p>
        <h2>Verify once to unlock Women's Safety</h2>
        <p className="pt-hint">Ride Watch and Smart Check-In are for verified women, so the feature can't be misused to track someone. Everything else in NightWing already works for you.</p>
        <div className="pt-verify">
          <p><strong>How verification works.</strong> You confirm your identity once through DigiLocker. NightWing stores only a "verified" flag, never your documents or Aadhaar number.</p>
          <div className="pt-row"><button type="button" className="pt-btn pt-btn-primary pt-btn-demo" onClick={verifyInApp}><BadgeCheck size={14} /> Verify with DigiLocker (demo)</button><span className="pt-chip">Not verified</span></div>
          {verifyDeclined && <p className="pt-fine">You declined the DigiLocker request, so Women's Safety Mode stays locked. You can try again any time.</p>}
          <p className="pt-fine">Demo: this step is simulated. A real build uses the DigiLocker partner API on the server.</p>
        </div>
        <div className="pt-sos"><div><b>112</b><small>In an emergency, call 112 or use Tamil Nadu Police's Kavalan SOS app. You don't need to verify for that.</small></div><button type="button" className="pt-btn pt-btn-sm" onClick={(e) => copyText("112", e.currentTarget)}>Copy number</button></div>
      </>
    );
    return (
      <>
        <p className="pt-kicker">CITIZEN APP · WOMEN'S SAFETY MODE · VERIFIED</p>
        <h2>Ride Watch and Smart Check-In</h2>
        <p className="pt-hint">Share your destination before an auto or cab ride. If the vehicle leaves the expected route and enters a dark zone, your trusted contacts are alerted.</p>
        <p className="pt-mini-title">Trusted contacts</p>
        <div className="pt-contacts">
          {contacts.map((c, i) => (
            <div className="pt-grid2" key={i}>
              <label className="pt-field" htmlFor={`pt-cn${i}`}>Name<input id={`pt-cn${i}`} value={c.name} placeholder={i === 2 ? "Optional" : ""} onChange={(e) => setContacts((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} autoComplete="off" /></label>
              <label className="pt-field" htmlFor={`pt-cp${i}`}>WhatsApp / mobile<input id={`pt-cp${i}`} type="tel" inputMode="tel" value={c.phone} placeholder={i === 2 ? "Optional" : "+91 98765 43210"} onChange={(e) => setContacts((cs) => cs.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} autoComplete="off" /></label>
            </div>
          ))}
        </div>
        <p className="pt-fine">Numbers stay in this browser only.</p>
        <p className="pt-mini-title">Trip details</p>
        <div className="pt-grid2">
          <label className="pt-field" htmlFor="pt-veh">Vehicle number<input id="pt-veh" value={veh} onChange={(e) => setVeh(e.target.value)} placeholder="e.g. TN 09 AB 1234" autoComplete="off" /></label>
          <label className="pt-field" htmlFor="pt-drv">Driver name<input id="pt-drv" value={drv} onChange={(e) => setDrv(e.target.value)} placeholder="Optional" autoComplete="off" /></label>
        </div>
        <div className="pt-row" style={{ marginTop: 8 }}><button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={importTrip}><Car size={14} /> Import trip from ride app (demo)</button>{langPicker("pt-lang-w")}</div>
        <div className="pt-grid2" style={{ marginTop: 12 }}>
          <label className="pt-field" htmlFor="pt-pick">Pickup<select id="pt-pick" value={pick} onChange={(e) => setPick(e.target.value as NodeId)}>{LANDMARKS.map((k) => <option key={k} value={k}>{NODES[k].name}</option>)}</select></label>
          <label className="pt-field" htmlFor="pt-dest">Destination<select id="pt-dest" value={dest} onChange={(e) => setDest(e.target.value as NodeId)}>{LANDMARKS.map((k) => <option key={k} value={k}>{NODES[k].name}</option>)}</select></label>
        </div>
        <label className="pt-check" htmlFor="pt-ci" style={{ marginTop: 10 }}><input id="pt-ci" type="checkbox" checked={checkinOn} onChange={(e) => setCheckinOn(e.target.checked)} /> Smart Check-In in dark zones</label>
        <label className="pt-check" htmlFor="pt-gps"><input id="pt-gps" type="checkbox" checked={shareGps} onChange={(e) => setShareGps(e.target.checked)} /> <MapPin size={14} /> Add my live GPS location to alerts</label>
        {gpsNote && <p className="pt-fine">{gpsNote}</p>}
        <div className="pt-row" style={{ marginTop: 10 }}>
          <button type="button" className="pt-btn pt-btn-primary" onClick={startCab}>Start auto ride</button>
          <button type="button" className="pt-btn pt-btn-demo" disabled={cabState !== "running" || wrongUsed} onClick={wrongTurn}>Simulate wrong turn</button>
          {cabState === "paused" ? <button type="button" className="pt-btn" onClick={resumeCab}>Resume ride</button> : <button type="button" className="pt-btn pt-btn-demo" disabled={cabState !== "running"} onClick={stopCab}>Simulate unexpected stop</button>}
        </div>
        <label className="pt-check" htmlFor="pt-fast"><input id="pt-fast" type="checkbox" checked={fastDemo} onChange={(e) => setFastDemo(e.target.checked)} /> Presenter speed (quick alert after the wrong turn, 5-second check-in)</label>
        <p className="pt-fine">Dashed buttons are demo controls that stand in for real events, such as a driver's wrong turn.</p>
        {wsAlert && wsAlert.kind === "same" && <div className="pt-alert pt-alert-amber"><strong>Pick a different destination</strong><p>Pickup and destination are the same place.</p></div>}
        {wsAlert && wsAlert.kind === "off" && <div className="pt-alert pt-alert-amber"><strong>Off the expected route</strong><p>The road is lit, so no alert yet. NightWing keeps watching.</p></div>}
        {wsAlert && wsAlert.kind === "ride" && <div className="pt-alert"><strong><AlertTriangle size={15} /> Ride Watch alert: vehicle off route in a dark zone</strong><p>The vehicle entered <b>{wsAlert.road}</b>. Alert <b>{contactNames()}</b> now. Call 112 if you are in danger.</p>{sendPanel("ride", wsAlert.road)}</div>}
        {wsAlert && wsAlert.kind === "checkin" && <div className="pt-alert"><strong><AlertTriangle size={15} /> Smart Check-In: no reply</strong><p>No reply within the time limit on <b>{wsAlert.road}</b>. Alert <b>{contactNames()}</b> now.</p>{sendPanel("checkin", wsAlert.road)}</div>}
        <div className="pt-sos"><div><b>112</b><small>Emergency number. NightWing also links to Tamil Nadu Police's Kavalan SOS app.</small></div><button type="button" className="pt-btn pt-btn-sm" onClick={(e) => copyText("112", e.currentTarget)}>Copy number</button></div>
        <p className="pt-mini-title">Ride Watch log</p>
        <Log items={cabLog} empty="Start an auto ride to begin monitoring." />
      </>
    );
  }

  function repairsPanel() {
    const list = priorityList(segs, hour);
    const dark = segs.filter((e) => lightAt(e, hour) < 0.3).length, pots = segs.reduce((s, e) => s + e.potholes, 0);
    const outage = segs.some((e) => e.fault === "power"), ver = segs.filter((e) => e.status === "verified").length;
    return (
      <>
        <p className="pt-kicker">CITY AUTHORITY · FIX</p>
        <h2>Repair dashboard</h2>
        <p className="pt-hint">Smart Outage Diagnosis and a ranked repair list for ward teams. The office marks a repair done; only residents can confirm it and close the ticket.</p>
        <div className="pt-tiles"><div><b>{segs.length}</b><span>Road segments mapped</span></div><div><b className="pt-red">{dark}</b><span>Dark at {hourLabel(hour)}</span></div><div><b>{pots}</b><span>Potholes confirmed</span></div><div><b>{outage ? 1 : ver}</b><span>{outage ? "Active power outage" : "Repairs verified"}</span></div></div>
        <p className="pt-mini-title"><Zap size={13} /> Smart Outage Diagnosis</p>
        <div className="pt-row"><button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={simBulb}><Lightbulb size={14} /> Simulate bulb failure</button><button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={simPower}><Zap size={14} /> Simulate area power cut</button><button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={restore}><RefreshCw size={14} /> Restore all</button></div>
        <div className="pt-diag">
          {!diag && <p>Simulate a fault. NightWing compares neighbouring roads at the same moment to decide who should get the report.</p>}
          {diag?.type === "bulb" && <><Chip zone="orange">1 segment dark, neighbours lit</Chip><strong>Probable bulb failure</strong><p><b>{diag.road}</b> went dark while nearby roads stayed lit. Report sent to the <b>City Corporation</b> streetlight team.</p></>}
          {diag?.type === "power" && <><Chip zone="ink">{diag.count} segments dark at once</Chip><strong>Probable power outage</strong><p>The whole <b>{diag.area}</b> area went dark at the same moment. Report sent to the <b>Electricity Board</b>; these roads stay off the streetlight repair list.</p></>}
        </div>
        <p className="pt-mini-title">Top dark spots by priority</p>
        <ol className="pt-prio">
          {list.map((e, i) => {
            const verified = e.status === "verified";
            return (
              <li key={e.id}>
                <span className="pt-rk">{verified ? <Check size={16} /> : i + 1}</span>
                <div><div className="pt-nm">{e.name}</div><div className="pt-row pt-meta"><Chip zone={verified ? "green" : zoneOf(e, hour)}>{lightCat(lightAt(e, hour))}</Chip><Chip>{e.potholes} pothole{e.potholes === 1 ? "" : "s"}</Chip><Chip>{e.fault === "bulb" ? "new fault" : `${e.persist} days`}</Chip><Chip>{e.area}</Chip></div></div>
                <div className="pt-ps">{verified ? "–" : priority(e, hour)}<small>PRIORITY</small></div>
                <div className="pt-acts">
                  {verified && <Chip zone="green">Verified lit by residents</Chip>}
                  {e.status === "pending" && <Chip zone="orange">Awaiting residents' confirmation in the citizen app</Chip>}
                  {(e.status === "open" || e.status === "reopened") && <>{e.status === "reopened" && <Chip zone="red">Reopened: residents say still dark</Chip>}<button type="button" className="pt-btn pt-btn-sm" onClick={() => markRepaired(e)}>Mark repaired</button></>}
                </div>
              </li>
            );
          })}
        </ol>
        <details className="pt-weights">
          <summary><SlidersHorizontal size={14} /> Danger Index weights (for city engineers)</summary>
          <p className="pt-fine">Starting values are 0.50 darkness, 0.35 potholes, 0.15 vulnerable places. Tune them with pilot data; they always add up to 1, and the map, routes and priorities update at once.</p>
          {([["dark", "Darkness"], ["pot", "Potholes"], ["vuln", "Vulnerable places"]] as const).map(([k, lab]) => (
            <label key={k} className="pt-wrow" htmlFor={`pt-w-${k}`}><span>{lab}</span><input id={`pt-w-${k}`} type="range" min={0.05} max={0.9} step={0.05} value={w[k]} onChange={(e) => changeWeight(k, Number(e.target.value))} /><output>{w[k].toFixed(2)}</output></label>
          ))}
          <button type="button" className="pt-btn pt-btn-sm" onClick={resetWeights}>Reset to 0.50 / 0.35 / 0.15</button>
        </details>
        <div className="pt-row" style={{ marginTop: 12 }}><button type="button" className="pt-btn pt-btn-primary" onClick={makeReport}><FileText size={14} /> Generate ward report</button>{report && <button type="button" className="pt-btn pt-btn-sm" onClick={(e) => copyText(report, e.currentTarget)}><Copy size={14} /> Copy report</button>}</div>
        {report && <pre className="pt-report">{report}</pre>}
      </>
    );
  }

  function steps(r: StreetReport) {
    return <ol className="pt-steps">{r.steps.map((st, i) => <li key={i} className={`pt-step-${st.status}`}><b>{st.at}</b>{st.text}</li>)}</ol>;
  }
  function evidence(r: StreetReport) {
    if (!r.photoData && r.lat == null) return null;
    return (
      <div className="pt-evidence">
        {r.photoData && <img src={r.photoData} alt={`Photo of the light on ${r.road}`} />}
        {r.lat != null && r.lng != null && <a className="pt-btn pt-btn-sm" href={mapLink(r.lat, r.lng)} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> GPS pin (±{Math.round(r.acc || 0)} m)</a>}
      </div>
    );
  }
  const people = (r: StreetReport) => 1 + r.supporters.length;
  function dueChip(r: StreetReport) {
    if (r.status !== "submitted" && r.status !== "inspection") return null;
    const ms = r.dueAt - now;
    if (ms < 0) return <Chip zone="red">Overdue by {Math.max(1, Math.round(-ms / 3600000))} h</Chip>;
    const h = Math.max(1, Math.ceil(ms / 3600000));
    return <Chip zone={h <= 12 ? "orange" : undefined}>Inspect within {h} h</Chip>;
  }
  function reportPanel() {
    const mine = reports.filter(involves);
    const openMine = reports.filter((r) => r.reporterId === reporterId && OPEN.includes(r.status)).length;
    return (
      <>
        <p className="pt-kicker">CITIZEN APP · REPORT</p>
        <h2>Report a streetlight</h2>
        {updates.length > 0 && showUpdates && (
          <div className="pt-notice" role="status"><Bell size={16} /><div><b>Updates on your reports since you last signed in</b>
            <ul>{updates.map((r) => <li key={r.id}><b>{r.id}</b> ({r.road}): {CITIZEN_STATUS[r.status].label.toLowerCase()}.</li>)}</ul></div>
            <button type="button" className="pt-icon-btn" aria-label="Dismiss updates" onClick={() => setShowUpdates(false)}><X size={15} /></button></div>
        )}
        {toConfirm.length > 0 && (
          <div className="pt-confirm">
            <p className="pt-mini-title" style={{ marginTop: 0 }}><Wrench size={13} /> Confirm repairs near you</p>
            <p className="pt-fine">The repair crew says these lights are fixed. Only residents can confirm a repair and close the ticket. Next time you pass, tell us what you see.</p>
            {toConfirm.map((e) => (
              <div className="pt-who" key={e.id}><b>{e.name}</b>
                <button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={() => residentConfirm(e, true)}><ThumbsUp size={14} /> Yes, it's lit now</button>
                <button type="button" className="pt-btn pt-btn-sm" onClick={() => residentConfirm(e, false)}><ThumbsDown size={14} /> Still dark</button>
              </div>
            ))}
          </div>
        )}
        <p className="pt-hint">You don't need to keep checking whether lights work. If you notice a broken light, report it here. A city official sends an inspection team within {DUE_HOURS} hours, and confirmed faults go to the repair crew. If someone already reported it, your report is added to theirs.</p>
        <form className="pt-form" onSubmit={submitReport} noValidate>
          <div className="pt-row"><button type="button" className="pt-btn pt-btn-sm" onClick={pinLocation}><MapPin size={14} /> Use my location</button>{rGps && <a className="pt-fine" href={mapLink(rGps.lat, rGps.lng)} target="_blank" rel="noopener noreferrer">View pin</a>}</div>
          {rGpsMsg && <p className="pt-fine" role="status">{rGpsMsg}</p>}
          <label className="pt-field" htmlFor="pt-rseg">Road
            <select id="pt-rseg" value={rSeg} onChange={(e) => { setRSeg(Number(e.target.value)); setRDone(null); }}>{segs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.area})</option>)}</select>
          </label>
          <label className="pt-field" htmlFor="pt-rissue">What's wrong?
            <select id="pt-rissue" value={rIssue} onChange={(e) => setRIssue(e.target.value)}>{ISSUES.map((i) => <option key={i}>{i}</option>)}</select>
          </label>
          <label className="pt-field" htmlFor="pt-rnote">Details (optional)<textarea id="pt-rnote" value={rNote} maxLength={300} onChange={(e) => setRNote(e.target.value)} placeholder="e.g. Pole near the bus stop, dark since Monday" /></label>
          <label className="pt-field" htmlFor="pt-rphoto">Photo (optional)<input id="pt-rphoto" type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0])} /></label>
          {rPhoto?.data && <div className="pt-evidence"><img src={rPhoto.data} alt="Selected photo preview" /><button type="button" className="pt-btn pt-btn-sm" onClick={() => setRPhoto(null)}><X size={14} /> Remove photo</button></div>}
          <button className="pt-btn pt-btn-primary" type="submit"><Send size={14} /> Send report to city officials</button>
          <p className="pt-fine">{openMine}/{MAX_OPEN_PER_PERSON} open reports. Each person can have up to {MAX_OPEN_PER_PERSON} open at a time.</p>
          {rDone && <p className={rDone.tone === "ok" ? "pt-ok" : "pt-err"} role="status">{rDone.tone === "ok" ? <Check size={14} /> : <Info size={14} />} {rDone.text}</p>}
        </form>
        <p className="pt-mini-title"><ClipboardList size={13} /> My reports</p>
        {mine.length === 0 ? <p className="pt-empty">No reports yet. Reports you send appear here with their status.</p> : (
          <div className="pt-reports">{mine.map((r) => (
            <div className="pt-rcard" key={r.id}>
              <div className="pt-rhead"><b>{r.id}</b><Chip zone={CITIZEN_STATUS[r.status].zone}>{CITIZEN_STATUS[r.status].label}</Chip></div>
              <div className="pt-rroad">{r.road} · {r.issue}{people(r) > 1 && <> · <Users size={12} /> {people(r)} residents</>}</div>
              {evidence(r)}
              {steps(r)}
            </div>
          ))}</div>
        )}
      </>
    );
  }
  function requestsPanel() {
    const n = (st: ReportStatus[]) => reports.filter((r) => st.includes(r.status)).length;
    const rank = (r: StreetReport) => (OPEN.includes(r.status) ? 0 : 1) * 1e15 + (r.status === "submitted" || r.status === "inspection" ? r.dueAt : 9e14) - people(r) * 1e9;
    const sorted = reports.slice().sort((x, y) => rank(x) - rank(y));
    return (
      <>
        <p className="pt-kicker">CITY AUTHORITY · CITIZEN REPORTS</p>
        <h2>Citizen streetlight reports</h2>
        <p className="pt-hint">Residents report lights they notice are broken. Reports for the same road are merged, so one card can carry several residents. Inspect within {DUE_HOURS} hours; overdue reports rise to the top.</p>
        <div className="pt-tiles"><div><b>{n(["submitted"])}</b><span>New reports</span></div><div><b className="pt-orange">{n(["inspection"])}</b><span>With inspection team</span></div><div><b className="pt-red">{overdue}</b><span>Overdue (over {DUE_HOURS} h)</span></div><div><b className="pt-green">{n(["working", "fixed"])}</b><span>Closed</span></div></div>
        <div className="pt-row" style={{ marginTop: 10 }}>
          <button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={() => setClockShift((c) => c + 24 * 3600000)}><Clock3 size={14} /> Demo: skip ahead one day</button>
          {clockShift > 0 && <span className="pt-fine" style={{ margin: 0 }}>Demo clock is {Math.round(clockShift / 3600000)} h ahead. <button type="button" className="pt-link" onClick={() => setClockShift(0)}>Reset</button></span>}
        </div>
        {reports.length === 0 ? <p className="pt-empty" style={{ marginTop: 14 }}>No citizen reports yet. Sign in as a citizen and use "Report a light" to send one.</p> : (
          <div className="pt-reports" style={{ marginTop: 14 }}>{sorted.map((r) => (
            <div className={`pt-rcard ${(r.status === "submitted" || r.status === "inspection") && now > r.dueAt ? "pt-rcard-overdue" : ""}`} key={r.id}>
              <div className="pt-rhead"><b>{r.id}</b><span className="pt-row" style={{ gap: 6 }}>{dueChip(r)}<Chip zone={CITIZEN_STATUS[r.status].zone}>{r.status === "submitted" ? "New" : CITIZEN_STATUS[r.status].label}</Chip></span></div>
              <div className="pt-rroad">{r.road} · {r.area}</div>
              <p className="pt-fine" style={{ marginTop: 2 }}><b>{r.issue}</b> · reported by {r.reporter}{r.supporters.length ? ` and ${r.supporters.length} more resident${r.supporters.length === 1 ? "" : "s"}` : ""}{r.note ? ` · "${r.note}"` : ""}{r.photo && !r.photoData ? ` · photo: ${r.photo}` : ""}</p>
              {evidence(r)}
              {steps(r)}
              <div className="pt-row pt-ractions">
                {r.status === "submitted" && <>
                  <label className="pt-field pt-field-inline" htmlFor={`pt-team-${r.id}`}><span className="pt-sr">Inspection team</span>
                    <select id={`pt-team-${r.id}`} value={teamPick[r.id] || TEAMS[0]} onChange={(e) => setTeamPick((t) => ({ ...t, [r.id]: e.target.value }))}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
                  </label>
                  <button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={() => sendTeam(r)}><Truck size={14} /> Send inspection team</button>
                  <label className="pt-field pt-field-inline" htmlFor={`pt-inv-${r.id}`}><span className="pt-sr">Reason</span>
                    <select id={`pt-inv-${r.id}`} value={invalidWhy[r.id] || INVALID_REASONS[0]} onChange={(e) => setInvalidWhy((t) => ({ ...t, [r.id]: e.target.value }))}>{INVALID_REASONS.map((t) => <option key={t}>{t}</option>)}</select>
                  </label>
                  <button type="button" className="pt-btn pt-btn-sm" onClick={() => markInvalid(r)}><X size={14} /> Mark not valid</button>
                </>}
                {r.status === "inspection" && <><span className="pt-fine" style={{ margin: 0 }}>Team result:</span><button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={() => confirmFault(r)}><AlertTriangle size={14} /> Confirmed: not working</button><button type="button" className="pt-btn pt-btn-sm" onClick={() => notConfirmed(r)}><Check size={14} /> Light is working</button></>}
                {r.status === "repair" && <button type="button" className="pt-btn pt-btn-sm" onClick={() => crewFixed(r)}><Wrench size={14} /> Repair crew: mark fixed</button>}
                {r.status === "awaiting" && <span className="pt-fine" style={{ margin: 0 }}>Waiting for residents to confirm in the citizen app. Officials can't close their own repairs.</span>}
              </div>
            </div>
          ))}</div>
        )}
      </>
    );
  }

  function sensorPanel() {
    const lf = lightFrom(cam.lux, cam.luma);
    return (
      <>
        <p className="pt-kicker">CITIZEN APP · SENSOR CHECK · REAL SENSORS</p>
        <h2>Test your phone's sensors</h2>
        <p className="pt-hint">This tab uses your phone's real sensors, not simulated data. It shows how NightWing would measure a road: light level, pothole bumps and position. Readings stay on this device until you export them.</p>
        <div className="pt-sensors">
          <div className="pt-sensor">
            <h4><Camera size={15} /> Light level</h4>
            <video ref={videoRef} className="pt-cam" muted playsInline aria-hidden={!cam.on} style={{ display: cam.on ? "block" : "none" }} />
            <div className="pt-reading"><b>{lf.v ?? "–"}</b><span>{lf.src}</span></div>
            <Chip zone={lf.label === "lit" ? "green" : lf.label === "dim" ? "orange" : lf.label === "dark" ? "red" : undefined}>{lf.label}</Chip>
            <div className="pt-row" style={{ marginTop: 8 }}>{cam.on ? <button type="button" className="pt-btn pt-btn-sm" onClick={stopCamera}>Stop</button> : <button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={startCamera}>Start light meter</button>}</div>
            {cam.msg && <p className="pt-fine">{cam.msg}</p>}
          </div>
          <div className="pt-sensor">
            <h4><Gauge size={15} /> Bumps (accelerometer)</h4>
            <div className="pt-reading"><b>{motion.on ? motion.jolt : "–"}</b><span>m/s² jolt · peak {motion.peak}</span></div>
            <Chip zone={motion.bumps ? "orange" : undefined}>{motion.bumps} bump{motion.bumps === 1 ? "" : "s"} detected</Chip>
            <div className="pt-row" style={{ marginTop: 8 }}>{motion.on ? <button type="button" className="pt-btn pt-btn-sm" onClick={stopMotion}>Stop</button> : <button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={startMotion}>Start bump detector</button>}</div>
            {motion.msg && <p className="pt-fine">{motion.msg}</p>}
          </div>
          <div className="pt-sensor">
            <h4><MapPin size={15} /> Position (GPS)</h4>
            <div className="pt-reading"><b>{geo.lat != null ? `${geo.lat.toFixed(5)}, ${geo.lng!.toFixed(5)}` : "–"}</b><span>{geo.acc != null ? `±${geo.acc} m${geo.speed != null ? ` · ${geo.speed} km/h` : ""}` : "No fix yet"}</span></div>
            <div className="pt-row" style={{ marginTop: 8 }}>{geo.on ? <button type="button" className="pt-btn pt-btn-sm" onClick={stopGeo}>Stop</button> : <button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={startGeo}>Start GPS</button>}{geo.lat != null && <a className="pt-btn pt-btn-sm" href={mapLink(geo.lat, geo.lng!)} target="_blank" rel="noopener noreferrer">Open map</a>}</div>
            {geo.msg && <p className="pt-fine">{geo.msg}</p>}
          </div>
        </div>
        <div className="pt-tomap">
          <p className="pt-mini-title" style={{ marginTop: 0 }}><MapPin size={13} /> Add this reading to the Danger map</p>
          <p className="pt-fine">Your light level (and any bump) updates the road's Danger Index, so the map shows what your phone measured.{geo.lat != null ? " The nearest road is picked from your GPS when you are in the pilot area." : ""}</p>
          <div className="pt-row">
            <label className="pt-field pt-field-inline" htmlFor="pt-sroad"><span className="pt-sr">Road</span>
              <select id="pt-sroad" value={sRoad} onChange={(e) => { setSRoad(Number(e.target.value)); setSMsg(null); }}>{segs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </label>
            <button type="button" className="pt-btn pt-btn-sm pt-btn-primary" onClick={sendToMap}><Send size={14} /> Send to map</button>
            <button type="button" className="pt-btn pt-btn-sm pt-btn-demo" onClick={simulateBump}><Gauge size={14} /> Simulate a bump (demo)</button>
          </div>
          {sMsg && <p className={sMsg.tone === "ok" ? "pt-ok" : "pt-err"} role="status" style={{ marginTop: 8 }}>{sMsg.tone === "ok" ? <Check size={14} /> : <Info size={14} />} {sMsg.text}{sMsg.tone === "ok" && <> <button type="button" className="pt-link" onClick={() => setTab("map")}>Open map</button></>}</p>}
        </div>
        <div className="pt-row" style={{ marginTop: 12 }}>
          <button type="button" className="pt-btn pt-btn-primary" onClick={() => record("Manual reading")}><Check size={14} /> Save a reading here</button>
          <button type="button" className="pt-btn pt-btn-sm" disabled={!fieldLog.length} onClick={(e) => copyText(csv(), e.currentTarget)}><Copy size={14} /> Copy as CSV</button>
          {window.self === window.top && <button type="button" className="pt-btn pt-btn-sm" disabled={!fieldLog.length} onClick={downloadCsv}><Download size={14} /> Download CSV</button>}
          <button type="button" className="pt-btn pt-btn-sm" disabled={!fieldLog.length} onClick={() => setFieldLog([])}>Clear</button>
        </div>
        <p className="pt-mini-title">Field log ({fieldLog.length})</p>
        {fieldLog.length === 0 ? <p className="pt-empty">Start the sensors, walk or ride a street at night, and save readings. Bumps are saved automatically.</p> : (
          <div className="pt-ledger-wrap"><table className="pt-ledger" aria-label="Field log">
            <thead><tr><th scope="col">Time</th><th scope="col">Light</th><th scope="col">Jolt</th><th scope="col">Position</th><th scope="col">Note</th></tr></thead>
            <tbody>{fieldLog.slice(0, 50).map((r, i) => <tr key={i}><td><small>{r.time}</small></td><td>{r.light ?? "–"}<br /><small>{r.lightLabel}</small></td><td>{r.jolt || "–"}{r.bump && <><br /><small>bump</small></>}</td><td>{r.lat != null ? <a href={mapLink(r.lat, r.lng!)} target="_blank" rel="noopener noreferrer"><small>{r.lat.toFixed(5)}, {r.lng!.toFixed(5)}</small></a> : <small>no GPS</small>}</td><td><small>{r.note}</small></td></tr>)}</tbody>
          </table></div>
        )}
        <p className="pt-fine">Camera, motion and GPS need a phone browser over https (the GitHub Pages link works). Preview windows often block them. Thresholds are first guesses to be calibrated in the pilot.</p>
      </>
    );
  }

  function bridgePanel() {
    const list = priorityList(segs, hour);
    const status = (e: Segment) => {
      if (e.status === "verified") return <><b className="pt-green">Closed</b><br />Verified lit by residents</>;
      if (e.status === "pending") return <><b className="pt-orange">Repair reported</b><br />Awaiting resident check</>;
      if (e.status === "reopened") return <><b className="pt-red">Reopened</b><br />Residents say still dark</>;
      return e.ticket ? <><b>Open</b><br />With City Corporation</> : <><b>Not raised</b><br />Run a partner sync</>;
    };
    return (
      <>
        <p className="pt-kicker">CITY AUTHORITY · PUBLIC + PRIVATE FUSION</p>
        <h2>Civic Bridge</h2>
        <p className="pt-hint">Private apps already travel every road at night. Government teams fix the roads and answer emergencies. NightWing connects the two in both directions.</p>
        <div className="pt-flow">
          <div className="pt-lane"><h4><Truck size={14} /> Private partners send in</h4><ul><li><b>Delivery fleets:</b> light and pothole readings from riders' phones</li><li><b>Ride-hailing apps:</b> trip details for Ride Watch</li><li><b>Navigation apps:</b> receive the Danger Index</li></ul></div>
          <div className="pt-arrow">verified data in · repair status back</div>
          <div className="pt-lane pt-lane-core"><h4>NightWing</h4><p>Checks readings across many trips, scores danger, diagnoses faults and tracks every case until residents confirm it is fixed.</p></div>
          <div className="pt-arrow">tickets and escalations out · fixes and responses back</div>
          <div className="pt-lane"><h4><Landmark size={14} /> Government services receive</h4><ul><li><b>City Corporation:</b> ranked streetlight and pothole tickets</li><li><b>Electricity Board:</b> area outage reports</li><li><b>Police control room (112 / Kavalan SOS):</b> Ride Watch escalations</li></ul></div>
        </div>
        <button type="button" className="pt-btn pt-btn-primary pt-btn-demo" onClick={partnerSync}><RefreshCw size={14} /> Run tonight's partner sync (demo)</button>
        <p className="pt-mini-title">Joint Safety Ledger</p>
        <p className="pt-fine">One shared record of who found each problem, who owns the fix, and who confirmed it.</p>
        <div className="pt-ledger-wrap">
          <table className="pt-ledger" aria-label="Joint Safety Ledger">
            <thead><tr><th scope="col">Road</th><th scope="col">Found by</th><th scope="col">Government ticket</th><th scope="col">Status</th></tr></thead>
            <tbody>{list.map((e) => (
              <tr key={e.id}><td><b>{e.name}</b><br /><small>{e.area}</small></td><td>{e.foundBy || (e.fault === "bulb" ? "NightWing outage check" : "Citizen trips")}<br /><small>{e.reports} reading{e.reports === 1 ? "" : "s"}</small></td><td>{e.ticket ? <><b>{e.ticket}</b><br /><small>City Corporation</small></> : <small>Not raised yet</small>}</td><td>{status(e)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="pt-mini-title">Bridge activity</p>
        <Log items={bridgeLog} empty="Run a partner sync to see data flow between partners and departments." />
        <p className="pt-fine">Partner apps and departments are simulated. These integrations are planned, not live.</p>
      </>
    );
  }

  const who = session.role === "citizen"
    ? `${session.name} · Citizen${womanVerified ? " · Verified woman" : ""}`
    : `${session.officerId} · Ward officer`;

  return (
    <div className="pt-app">
      <header className="pt-bar">
        <div className="pt-bar-in">
          <a className="brand" href="/" aria-label="NightWing home">
            <span className="brand-symbol" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none"><path d="M7 23.5C13.4 21.1 19.8 15.8 23 8c4.8 6.5 7.3 13.9 7.1 21.8-7.3-1.6-14.9-3.7-23.1-6.3Z" fill="currentColor" opacity=".17" /><path d="M8 23.5C15.4 20.9 20.6 16 23.3 8.5M8 23.5c6.1 2.1 12.1 4 21.8 6.1M14.5 20.2c2.6 3.4 5.3 5.6 9.2 7.2M17.8 16.9c2.3 3.4 4.1 5.3 6.9 6.9" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /><circle cx="30.8" cy="9.3" r="3.2" fill="#F3A26E" /></svg>
            </span>
            <span className="brand-name">NightWing<span className="brand-period">.</span></span>
          </a>
          <span className="pt-app-name">{citizen ? "Citizen app" : "City Authority console"}</span>
          <div className="pt-user"><span className={`pt-chip pt-sync pt-sync-${sync.mode}`} title={sync.detail}>{sync.mode === "live" ? <Cloud size={13} /> : <CloudOff size={13} />} {sync.mode === "live" ? "Live sync" : sync.mode === "error" ? "Sync error" : "Synced in this browser"}</span><span className="pt-chip pt-chip-ink">{who}</span><button type="button" className="pt-btn pt-btn-sm" onClick={onSignOut}><LogOut size={14} /> Sign out</button></div>
        </div>
        <nav className="pt-tabs" role="tablist" aria-label="Views">
          {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.icon}{t.label}</button>)}
        </nav>
      </header>

      <main className="pt-main">
        <section className="pt-mapcard" aria-label="Danger Index map">
          <div className="pt-toolbar">
            <div className="pt-time"><label htmlFor="pt-hour">TIME OF NIGHT</label><input id="pt-hour" type="range" min={20} max={26} step={1} value={hour} onChange={(e) => setHour(Number(e.target.value))} /><output htmlFor="pt-hour">{hourLabel(hour)}</output></div>
            <div className="legend-row pt-legend"><span><i className="legend-dot legend-red" /> Dark + pothole</span><span><i className="legend-dot legend-orange" /> Dark</span><span><i className="legend-dot legend-green" /> Lower risk</span><span><i className="pt-legend-route" /> Safer route</span></div>
          </div>
          <div className="pt-mapwrap">{map}</div>
          <p className="pt-note"><MapPin size={13} /> Simulated pilot neighbourhood, not live data. White rings are confirmed potholes, warm halos are working streetlights, and squares are Safe Spots (+ pharmacy, P police, F petrol).</p>
        </section>
        <aside className="pt-panel">
          {tab === "map" && seePanel()}
          {tab === "route" && routePanel()}
          {tab === "report" && reportPanel()}
          {tab === "sensor" && sensorPanel()}
          {tab === "requests" && requestsPanel()}
          {tab === "women" && isWoman && womenPanel()}
          {tab === "repairs" && repairsPanel()}
          {tab === "bridge" && bridgePanel()}
        </aside>
      </main>

      {verifying && <DigiConsent onAllow={verifyAllowed} onDeny={() => { setVerifying(false); setVerifyDeclined(true); }} />}
      {checkin && (
        <div className="pt-modal" role="dialog" aria-modal="true" aria-labelledby="pt-ci-title">
          <div className="pt-modal-box">
            <p className="pt-kicker">SMART CHECK-IN</p>
            <h3 id="pt-ci-title">Are you okay?</h3>
            <p>Your ride stopped unexpectedly on a dark stretch. If you don't reply, your trusted contacts are alerted.</p>
            <div className="pt-ring">{checkin.count}</div>
            <p className="pt-fine">Prototype timer: {fastDemo ? 5 : 10} seconds. The real app would wait 60.</p>
            <button type="button" className="pt-btn pt-btn-primary" autoFocus onClick={() => { clearCheckin(); addCab("Rider confirmed she is safe. No alert sent.", "ok"); }}>I'm safe</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page + optional live sync                                           */
/* ------------------------------------------------------------------ */
type SyncState = { mode: "local" | "live" | "error"; detail: string };
type SegState = Pick<Segment, "status" | "fault" | "ticket" | "foundBy" | "reports" | "persist" | "potholes"> & { measured?: number | null };
interface SharedState { reports: StreetReport[]; segs: Record<number, SegState>; weights?: typeof WEIGHTS; updatedAt: number; by: string }

/** Realtime Database URL from docs/nightwing-config.js (window.NIGHTWING_CONFIG). Empty = this device only. */
function syncUrl(): string {
  const c = (window as unknown as { NIGHTWING_CONFIG?: { databaseURL?: string } }).NIGHTWING_CONFIG;
  const u = (c?.databaseURL || "").trim().replace(/\/+$/, "");
  return u ? `${u}/nightwing/state.json` : "";
}

function normalise(r: Partial<StreetReport> & { id: string }): StreetReport {
  const createdAt = r.createdAt || Date.now();
  return {
    segId: 0, road: "", area: "", issue: "", note: "", photo: "", reporter: "", status: "submitted", steps: [],
    ...r, reporterId: r.reporterId || r.reporter || "", supporters: r.supporters || [], createdAt, dueAt: r.dueAt || createdAt + DUE_HOURS * 3600000,
  } as StreetReport;
}
function loadReports(): StreetReport[] {
  try { const r = JSON.parse(localStorage.getItem("nw_reports") || "[]"); return Array.isArray(r) ? r.map(normalise) : []; } catch { return []; }
}
function applyReportsToSegs(s: Segment[], reports: StreetReport[]) {
  reports.forEach((r) => {
    const e = s[r.segId]; if (!e) return;
    if (r.status === "repair") { e.fault = e.fault || "bulb"; e.foundBy = "Citizen report"; e.ticket = e.ticket || `NW-${1040 + e.id}`; }
    if (r.status === "awaiting") { e.fault = e.fault || "bulb"; e.status = "pending"; e.ticket = e.ticket || `NW-${1040 + e.id}`; }
    if (r.status === "fixed") { e.status = "verified"; e.fault = null; }
  });
}

function applySegs(s: Segment[], st: Record<number, SegState> | undefined) {
  Object.entries(st || {}).forEach(([id, v]) => {
    const e = s[Number(id)]; if (!e) return;
    Object.assign(e, { ...v, ticket: v.ticket || undefined, foundBy: v.foundBy || undefined, measured: v.measured ?? undefined });
    if (v.potholes == null) e.potholes = createSegments()[e.id].potholes;
  });
}
function loadLocalState(): SharedState | null {
  try { const st = JSON.parse(localStorage.getItem("nw_state") || "null"); return st && st.updatedAt ? st : null; } catch { return null; }
}

export default function Prototype() {
  const [session, setSession] = useState<Session | null>(null);
  const [reports, setReportsState] = useState<StreetReport[]>(loadReports);
  // One shared neighbourhood for every sign-in, so citizen reports and official actions meet.
  const segsRef = useRef<Segment[] | null>(null);
  if (!segsRef.current) {
    const s = createSegments(); applyReportsToSegs(s, reports);
    const st = loadLocalState(); if (st) { applySegs(s, st.segs); if (st.weights) setWeights(st.weights); }
    segsRef.current = s;
  }
  const setReports = useCallback((f: (r: StreetReport[]) => StreetReport[]) => { dirty.current = true; setReportsState((r) => f(r)); }, []);
  useEffect(() => { try { localStorage.setItem("nw_reports", JSON.stringify(reports)); } catch { /* storage unavailable */ } }, [reports]);
  useEffect(() => { document.title = "NightWing — Working prototype"; }, []);

  /* ----- live sync (Firebase Realtime Database REST, or any server with the same GET/PUT JSON API) ----- */
  const url = useMemo(syncUrl, []);
  const [sync, setSync] = useState<SyncState>(url ? { mode: "local", detail: "Connecting…" } : { mode: "local", detail: "Windows of this browser stay in sync. Add a databaseURL to nightwing-config.js to share reports across devices." });
  const [extVer, setExtVer] = useState(0);
  const [segVer, setSegVer] = useState(0);
  const dirty = useRef(false);
  const lastApplied = useRef(0);
  const me = useRef(Math.random().toString(36).slice(2, 8));
  const onSegsChanged = useCallback(() => { dirty.current = true; setSegVer((v) => v + 1); }, []);
  const snapshot = (): SharedState => {
    const segs: Record<number, SegState> = {};
    segsRef.current!.forEach((e) => { segs[e.id] = { status: e.status, fault: e.fault, ticket: e.ticket ?? "", foundBy: e.foundBy ?? "", reports: e.reports, persist: e.persist, potholes: e.potholes, measured: e.measured ?? null }; });
    return { reports, segs, weights: { ...WEIGHTS }, updatedAt: Date.now(), by: me.current };
  };
  // push local changes: to other windows of this browser (localStorage) and, if configured, to the shared database
  useEffect(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const body = snapshot(); lastApplied.current = body.updatedAt;
    try { localStorage.setItem("nw_state", JSON.stringify(body)); } catch { /* storage full or blocked */ }
    if (!url) return;
    fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); setSync({ mode: "live", detail: `Saved to the shared database at ${new Date().toLocaleTimeString()}` }); })
      .catch((e) => setSync({ mode: "error", detail: `Could not save to the shared database (${e.message || e}). Changes are kept on this device.` }));
  }, [reports, segVer]); // eslint-disable-line react-hooks/exhaustive-deps
  // pull remote changes
  useEffect(() => {
    if (!url) return;
    let stop = false;
    const pull = () => fetch(url, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((st: SharedState | null) => {
      if (stop) return;
      setSync({ mode: "live", detail: `Connected to the shared database. Checked ${new Date().toLocaleTimeString()}` });
      if (!st || !st.updatedAt || st.updatedAt <= lastApplied.current || st.by === me.current) return;
      lastApplied.current = st.updatedAt;
      applySegs(segsRef.current!, st.segs);
      if (st.weights) setWeights(st.weights);
      setReportsState((st.reports || []).map(normalise));
      setExtVer((v) => v + 1);
    }).catch((e) => { if (!stop) setSync({ mode: "error", detail: `Shared database not reachable (${e.message || e}). Working on this device only.` }); });
    pull(); const t = window.setInterval(pull, 4000);
    return () => { stop = true; window.clearInterval(t); };
  }, [url]);

  // other windows of this browser: pick up their changes at once (two-window presenting without any server)
  useEffect(() => {
    const on = (ev: StorageEvent) => {
      if (ev.key !== "nw_state") return;
      if (!ev.newValue) { // reset from another window
        segsRef.current = createSegments(); setWeights(DEFAULT_WEIGHTS); setReportsState([]); setExtVer((v) => v + 1); return;
      }
      try {
        const st = JSON.parse(ev.newValue) as SharedState;
        if (!st || st.by === me.current || st.updatedAt <= lastApplied.current) return;
        lastApplied.current = st.updatedAt;
        applySegs(segsRef.current!, st.segs); if (st.weights) setWeights(st.weights);
        setReportsState((st.reports || []).map(normalise)); setExtVer((v) => v + 1);
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);

  function resetDemo() {
    try { Object.keys(localStorage).filter((k) => k.startsWith("nw_") && k !== "nw_lang").forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    segsRef.current = createSegments(); setWeights(DEFAULT_WEIGHTS);
    setReportsState([]); setExtVer((v) => v + 1);
    if (url) { dirty.current = true; setSegVer((v) => v + 1); }
  }

  return session
    ? <Workspace key={JSON.stringify(session)} session={session} onSignOut={() => setSession(null)} segs={segsRef.current} reports={reports} setReports={setReports} extVer={extVer} onSegsChanged={onSegsChanged} sync={sync} />
    : <SignIn onEnter={setSession} onReset={resetDemo} />;
}
