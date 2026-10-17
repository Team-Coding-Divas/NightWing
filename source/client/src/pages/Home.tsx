import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Crosshair,
  Eye,
  Handshake,
  Heart,
  Landmark,
  Lightbulb,
  Lock,
  MapPin,
  MessageCircle,
  Menu,
  Navigation,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import { MapExperience } from "@/components/MapExperience";
import { OutageDemo } from "@/components/OutageDemo";
import "@/landing-additions.css";

const pillars = [
  {
    id: "01",
    title: "See",
    verb: "Notice what’s easy to miss.",
    description:
      "Opt-in light and motion readings reveal where a street is dark, dim, or lit—and where darkness and road hazards overlap.",
    items: ["Darkness heatmap", "Combined Danger Index", "Dark-hours timeline"],
    icon: Eye,
    tone: "mint",
  },
  {
    id: "02",
    title: "Avoid",
    verb: "Choose a better-lit way home.",
    description:
      "Compare the quickest way with a safer alternative, hear a heads-up before a hazard, and find nearby places of refuge.",
    items: ["Fastest vs. safer routes", "Hands-free voice alerts", "Safe Spots nearby"],
    icon: Navigation,
    tone: "blue",
  },
  {
    id: "03",
    title: "Fix",
    verb: "Help the right team act.",
    description:
      "Turn many small observations into a clear repair queue—and let neighbours confirm when a fix really works.",
    items: ["Smart outage diagnosis", "Transparent repair priority", "Community verification"],
    icon: Lightbulb,
    tone: "peach",
  },
];

const team = [
  { name: "Prathika", school: "Amrita School of Computing, Chennai", initials: "P" },
  { name: "Githa Shri", school: "SRM Easwari Engineering College", initials: "G" },
  { name: "Rashika Shri", school: "Rajalakshmi Engineering College", initials: "R" },
];

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <a className={`brand ${light ? "brand-light" : ""}`} href="#top" aria-label="NightWing home">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M7 23.5C13.4 21.1 19.8 15.8 23 8c4.8 6.5 7.3 13.9 7.1 21.8-7.3-1.6-14.9-3.7-23.1-6.3Z" fill="currentColor" opacity=".17" />
          <path d="M8 23.5C15.4 20.9 20.6 16 23.3 8.5M8 23.5c6.1 2.1 12.1 4 21.8 6.1M14.5 20.2c2.6 3.4 5.3 5.6 9.2 7.2M17.8 16.9c2.3 3.4 4.1 5.3 6.9 6.9" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="30.8" cy="9.3" r="3.2" fill="#F3A26E" />
        </svg>
      </span>
      <span className="brand-name">NightWing<span className="brand-period">.</span></span>
    </a>
  );
}

function SectionHeading({ kicker, title, text, align = "left" }: { kicker: string; title: ReactNode; text?: string; align?: "left" | "center" }) {
  return (
    <div className={`section-heading ${align === "center" ? "section-heading-center" : ""}`}>
      <span className="eyebrow"><span className="eyebrow-dot" />{kicker}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    ["How it works", "#how-it-works"],
    ["The map", "#the-map"],
    ["For cities", "#for-cities"],
    ["Civic Bridge", "#civic-bridge"],
    ["Our team", "#team"],
  ];
  return (
    <header className="site-header" id="top">
      <div className="nav-wrap">
        <BrandMark />
        <nav className={open ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
          {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <a className="nav-cta" href="#the-idea" onClick={() => setOpen(false)}>Explore the idea <ArrowUpRight size={15} /></a>
          <a className="nav-try" href="/app" onClick={() => setOpen(false)}>Try the prototype <ArrowRight size={15} /></a>
        </nav>
        <button className="mobile-menu" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <section className="hero-section" id="the-idea">
          <div className="hero-glow hero-glow-a" />
          <div className="hero-glow hero-glow-b" />
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="challenge-tag"><Sparkles size={14} /> HACK-A-THRONE <span /> SUSTAINABILITY &amp; SMART CITIES</div>
              <h1>Safer streets<br />begin with <em>seeing</em><br />in the dark.</h1>
              <p className="hero-lede">NightWing turns the journeys people already take into a clearer picture of dark roads and hidden hazards—so neighbours can choose safer routes and cities can fix what matters first.</p>
              <div className="hero-actions">
                <a className="button button-primary" href="#the-map">Explore the safety map <ArrowRight size={17} /></a>
                <a className="text-link" href="#how-it-works">How NightWing works <ArrowDown size={15} /></a>
                <a className="text-link" href="/app">Try the working prototype <ArrowRight size={15} /></a>
              </div>
              <div className="hero-proof">
                <div className="proof-icon"><ShieldCheck size={19} /></div>
                <div><strong>Privacy first. Built together.</strong><span>Opt-in signals, shared as street-level insight.</span></div>
              </div>
            </div>
            <div className="hero-visual" aria-label="Illustrative NightWing map preview">
              <MapExperience compact />
              <div className="hero-note"><span className="live-dot" /> CONCEPT PREVIEW <span className="note-divider" /> Sample neighborhood data</div>
            </div>
          </div>
          <div className="hero-bottomline"><span>01 / A CITY THAT CAN SEE AFTER DARK</span><span>CHENNAI · PILOT CONCEPT</span></div>
        </section>

        <section className="signal-strip" aria-label="NightWing principles">
          <div className="signal-item"><span className="signal-icon signal-green"><Crosshair size={19} /></span><span><strong>One shared picture</strong><small>Darkness + road hazards</small></span></div>
          <div className="signal-separator" />
          <div className="signal-item"><span className="signal-icon signal-blue"><Zap size={18} /></span><span><strong>No new hardware</strong><small>Phones people already carry</small></span></div>
          <div className="signal-separator" />
          <div className="signal-item"><span className="signal-icon signal-peach"><Heart size={18} /></span><span><strong>People at the centre</strong><small>Opt-in, community-verified</small></span></div>
        </section>

        <section className="problem-section section-pad" id="the-problem">
          <div className="problem-intro">
            <SectionHeading kicker="THE PROBLEM" title={<>A dark road hides<br />more than one risk.</>} />
            <p className="problem-body">A broken light can leave a pothole invisible until it’s too late. Yet dark stretches are easy to miss in scattered reports—and repairs can be hard to prioritise or verify.</p>
            <a href="#how-it-works" className="inline-link">See the bigger picture <ArrowRight size={16} /></a>
          </div>
          <div className="problem-list">
            <article className="problem-row">
              <span className="problem-number">01</span>
              <div className="problem-row-icon"><Eye size={20} /></div>
              <div><h3>Hard to spot, until you’re there.</h3><p>Darkness and potholes compound the risk for walkers, riders, students and night-shift commuters.</p></div>
              <span className="row-arrow"><ChevronRight size={18} /></span>
            </article>
            <article className="problem-row">
              <span className="problem-number">02</span>
              <div className="problem-row-icon"><Activity size={20} /></div>
              <div><h3>Signals scattered across the city.</h3><p>Individual complaints don’t reveal which road segments are repeatedly dark—or what changed through the night.</p></div>
              <span className="row-arrow"><ChevronRight size={18} /></span>
            </article>
            <article className="problem-row">
              <span className="problem-number">03</span>
              <div className="problem-row-icon"><Users size={20} /></div>
              <div><h3>“Fixed” needs a second look.</h3><p>Without resident verification, a closed ticket may not mean the street is lit again.</p></div>
              <span className="row-arrow"><ChevronRight size={18} /></span>
            </article>
          </div>
        </section>

        <section className="pillars-section section-pad" id="how-it-works">
          <div className="pillars-heading-row">
            <SectionHeading kicker="ONE IDEA, THREE MOVES" title={<>See it. Avoid it.<br /><span>Help fix it.</span></>} text="Everything NightWing does fits a simple loop: understand the street, make a safer choice, and help the right team close the gap." />
            <div className="flow-note"><span className="flow-line" /> A clearer night, together <span className="flow-spark">✳</span></div>
          </div>
          <div className="pillar-list">
            {pillars.map(({ id, title, verb, description, items, icon: Icon, tone }) => (
              <article className={`pillar-card pillar-${tone}`} key={id}>
                <div className="pillar-topline"><span className="pillar-id">{id} / THE PILLAR</span><span className="pillar-icon"><Icon size={21} /></span></div>
                <h3>{title}<span className="pillar-comma">.</span></h3>
                <p className="pillar-verb">{verb}</p>
                <p className="pillar-description">{description}</p>
                <ul>{items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="apps-section section-pad" id="two-apps">
          <div className="apps-heading">
            <SectionHeading kicker="TWO APPS, ONE PLATFORM" title={<>The right view<br /><span>for the right person.</span></>} text="Everyone signs in first. Citizens get a calm, personal safety view. City teams get a separate console that citizens can never open." />
            <a className="button button-secondary" href="/app">Sign in to the prototype <ArrowRight size={16} /></a>
          </div>
          <div className="apps-grid">
            <article className="app-card">
              <div className="app-card-top"><span className="safety-symbol"><UserRound size={19} /></span><span className="micro-label">CITIZEN APP</span></div>
              <h3>For people on the road<br />after dark.</h3>
              <p>Sign in with a mobile number and a one-time code. Sharing anonymous road readings is optional.</p>
              <ul>
                <li><Check size={14} /> Danger map with a Dark Hours timeline and Safe Spots</li>
                <li><Check size={14} /> SafeRoute: fastest vs. safer, with hands-free voice alerts</li>
                <li><BadgeCheck size={14} /> Women's Safety Mode for women, after one-time DigiLocker verification: Ride Watch and Smart Check-In</li>
                <li><MessageCircle size={14} /> One-tap WhatsApp or SMS alerts to trusted contacts, with the vehicle number</li>
                <li><Lightbulb size={14} /> Report a broken streetlight with a photo and GPS pin, then confirm the repair yourself</li>
                <li><Check size={14} /> Help map your street: measure a dark street in one tap with your phone's camera, motion sensor and GPS</li>
              </ul>
              <div className="app-access"><ShieldCheck size={15} /><span>Everyone can use the map, routes and reports. Women verify once through DigiLocker to unlock Women's Safety Mode. NightWing keeps only a "verified" flag, never documents.</span></div>
            </article>
            <article className="app-card app-card-authority">
              <div className="app-card-top"><span className="safety-symbol" style={{ background: "#fff0e4", color: "#cb8c5c" }}><Building2 size={19} /></span><span className="micro-label">CITY AUTHORITY CONSOLE</span></div>
              <h3>For the teams who<br />fix the streets.</h3>
              <p>Ward engineers, the electricity board and police sign in with an official officer ID.</p>
              <ul>
                <li><Check size={14} /> Citizen reports: duplicates merged, a 48-hour inspection target, then confirmed faults go to the repair crew</li>
                <li><Check size={14} /> Ranked repair dashboard with transparent priority scores</li>
                <li><Check size={14} /> Smart outage diagnosis: one bulb or the whole block</li>
                <li><Check size={14} /> Only residents can close a repair, plus ward-level repair reports and tunable Danger Index weights</li>
                <li><Handshake size={14} /> Civic Bridge tickets, outage reports and police escalations</li>
              </ul>
              <div className="app-access"><Lock size={15} /><span>Role-based access: citizens cannot open the console, and each department sees only its own tickets.</span></div>
            </article>
          </div>
        </section>

        <section className="map-section section-pad" id="the-map">
          <div className="map-heading">
            <SectionHeading kicker="SEE THE WHOLE STREET" title={<>Two hidden dangers.<br /><span>One clearer signal.</span></>} text="NightWing combines repeated, opt-in observations into a street-level view—so one dark patch doesn’t tell the whole story." />
            <div className="index-badge"><span className="index-ring">NW</span><div><strong>DANGER INDEX</strong><small>A transparent starting score</small></div></div>
          </div>
          <div className="map-demo-layout">
            <div className="map-demo-card"><MapExperience /></div>
            <aside className="index-explainer">
              <div className="index-score-label"><span className="mini-pulse" /> AN ILLUSTRATIVE SCORE</div>
              <div className="score-display"><span>82</span><small>/ 100</small></div>
              <p className="score-caption">A sample high-risk segment. Every score is designed to show its working—not just its colour.</p>
              <div className="score-rule"><span className="rule-color rule-dark" /><div><strong>50%</strong><span>Darkness severity</span></div><small>0.50 ×</small></div>
              <div className="score-rule"><span className="rule-color rule-road" /><div><strong>35%</strong><span>Pothole severity</span></div><small>0.35 ×</small></div>
              <div className="score-rule"><span className="rule-color rule-context" /><div><strong>15%</strong><span>Traffic + vulnerable locations</span></div><small>0.15 ×</small></div>
              <div className="score-footnote"><Sparkles size={14} /><span>Starting weights, to be tuned with pilot data and city engineers.</span></div>
              <div className="legend-row"><span><i className="legend-dot legend-red" /> Dark + pothole</span><span><i className="legend-dot legend-orange" /> Dark</span><span><i className="legend-dot legend-green" /> Lower risk</span></div>
            </aside>
          </div>
        </section>

        <section className="safety-section section-pad" id="safety">
          <div className="safety-heading">
            <SectionHeading kicker="AVOID THE UNKNOWN" title={<>A little more peace<br />of mind, <span>by design.</span></>} text="Useful safety information should meet people where they are—with context, calm and control." />
          </div>
          <div className="safety-grid">
            <article className="safety-card safe-spots-card">
              <div className="safety-card-top"><span className="safety-symbol"><MapPin size={19} /></span><span className="micro-label">ON YOUR WAY</span></div>
              <h3>Safe Spots,<br />close at hand.</h3>
              <p>See nearby well-lit, populated places—like pharmacies, petrol stations, bus stops and police booths—along a dark stretch.</p>
              <div className="safe-spot-chips"><span><span /> 24h pharmacy</span><span><span /> Petrol station</span><span><span /> Bus stop</span></div>
              <div className="safety-card-footer"><span>Illustrative places, via OpenStreetMap</span><ArrowUpRight size={16} /></div>
            </article>
            <article className="safety-card ride-watch-card">
              <div className="safety-card-top"><span className="safety-symbol"><Navigation size={19} /></span><span className="micro-label">RIDE WATCH · CONCEPT</span></div>
              <h3>Your route.<br />Your trusted circle.</h3>
              <p>Share a planned auto or cab route with chosen contacts. A detour into a dark or high-risk area can prompt a thoughtful check-in.</p>
              <div className="journey-line"><span className="journey-node journey-start" /><span className="journey-dash" /><span className="journey-warning">!</span><span className="journey-dash journey-dash-alert" /><span className="journey-node journey-end" /></div>
              <div className="journey-labels"><span>Planned route</span><span>Unexpected detour</span></div>
              <div className="safety-card-footer"><span>Alerts are a proposed feature—not an emergency service</span><ArrowUpRight size={16} /></div>
            </article>
            <article className="safety-card check-in-card">
              <div className="safety-card-top"><span className="safety-symbol"><Heart size={19} /></span><span className="micro-label">SMART CHECK-IN · CONCEPT</span></div>
              <div className="checkin-message"><span className="chat-dot" /> NightWing <small>just now</small><p>“You’ve entered a dark stretch. Are you okay?”</p><div className="checkin-actions"><span>I’m okay</span><span>Contact my circle</span></div></div>
              <h3>Quiet when it’s safe.<br />There when it matters.</h3>
              <p>A contextual check-in is proposed for a dark zone or unexpected stop. Existing emergency services remain the first call in an emergency.</p>
              <div className="safety-card-footer"><span>Designed to support—not replace—existing help</span><ArrowUpRight size={16} /></div>
            </article>
          </div>
          <div className="safety-clarifier"><ShieldCheck size={18} /><p>NightWing is a concept prototype. Its safety features are not a substitute for emergency services; in India, call <strong>112</strong> in an emergency.</p></div>
        </section>

        <section className="city-section section-pad" id="for-cities">
          <div className="city-intro">
            <div>
              <SectionHeading kicker="FIX WHAT MATTERS FIRST" title={<>From a dark spot<br />to a <span>repair that lasts.</span></>} text="A useful city dashboard needs more than pins on a map. It needs to help teams understand the fault, prioritise the work and know when the street is safe again." />
            </div>
            <a className="button button-secondary" href="#repair-loop">See the repair loop <ArrowRight size={16} /></a>
          </div>
          <div className="city-workspace">
            <div className="workspace-head"><div><span className="workspace-mark"><span /> WARD VIEW / CONCEPT</span><h3>Streetlight health</h3></div><div className="workspace-date"><Clock3 size={15} /> Sample evening view</div></div>
            <div className="workspace-content">
              <div className="workspace-summary">
                <div className="workspace-summary-label">PRIORITY QUEUE <span>SIMULATED</span></div>
                <div className="queue-count">Three ways to move<br />from signal to action.</div>
                <div className="queue-note">Ranked using severity, persistence, nearby vulnerable places and independent observations.</div>
                <div className="priority-bars"><span style={{ width: "82%" }} /><span style={{ width: "61%" }} /><span style={{ width: "38%" }} /></div>
                <div className="priority-scale"><span>Higher priority</span><span>Lower</span></div>
              </div>
              <div className="workspace-table">
                <table className="queue-table" aria-label="Illustrative municipal repair queue">
                  <thead><tr className="table-header"><th scope="col">ROAD SEGMENT</th><th scope="col">SIGNAL</th><th scope="col">ROUTED TO</th><th scope="col">STATUS</th></tr></thead>
                  <tbody>
                    <tr className="table-row"><td><i className="table-dot table-red" /> Campus East Rd</td><td>Dark + pothole</td><td>City corporation</td><td><b className="status status-review">Review</b></td></tr>
                    <tr className="table-row"><td><i className="table-dot table-orange" /> Lake View St</td><td>Possible bulb</td><td>City corporation</td><td><b className="status status-repair">Repair</b></td></tr>
                    <tr className="table-row"><td><i className="table-dot table-blue" /> North Avenue</td><td>Area outage</td><td>Electricity board</td><td><b className="status status-routed">Routed</b></td></tr>
                  </tbody>
                </table>
                <div className="table-source"><span><span className="live-dot" /> Example queue · not live municipal data</span><span>Priority logic is explainable and adjustable</span></div>
              </div>
            </div>
          </div>
          <div className="diagnosis-row">
            <div className="diagnosis-copy"><span className="eyebrow"><span className="eyebrow-dot" /> SMART OUTAGE DIAGNOSIS</span><h3>One dark pole—or the whole block?</h3><p>Compare independent observations across neighbouring road segments. A likely bulb fault and an area-wide power cut should not land in the same repair queue.</p></div>
            <OutageDemo />
          </div>
          <div className="repair-loop" id="repair-loop">
            <div className="repair-loop-heading"><span className="eyebrow"><span className="eyebrow-dot" /> CLOSE THE LOOP</span><h3>Marked fixed?<br /><span>Let neighbours confirm.</span></h3></div>
            <div className="repair-steps">
              <div className="repair-step"><span className="repair-step-number">01</span><div className="repair-step-icon"><MapPin size={18} /></div><strong>Spot</strong><p>Repeated signals surface a dark or hazardous segment.</p></div>
              <div className="repair-connector" />
              <div className="repair-step"><span className="repair-step-number">02</span><div className="repair-step-icon"><Lightbulb size={18} /></div><strong>Route</strong><p>The likely issue reaches the right city team.</p></div>
              <div className="repair-connector" />
              <div className="repair-step"><span className="repair-step-number">03</span><div className="repair-step-icon"><Check size={18} /></div><strong>Repair</strong><p>Work status is visible—not buried in a ticket.</p></div>
              <div className="repair-connector" />
              <div className="repair-step"><span className="repair-step-number">04</span><div className="repair-step-icon"><Users size={18} /></div><strong>Verify</strong><p>Residents nearby confirm “Still dark” or “Now lit” in the citizen app. The office can’t close its own repair.</p></div>
            </div>
          </div>
        </section>

        <section className="bridge-section section-pad" id="civic-bridge">
          <SectionHeading kicker="CIVIC BRIDGE · PUBLIC + PRIVATE" title={<>Private apps see the roads.<br /><span>Cities fix them.</span></>} text="Delivery fleets and ride apps travel every street at night. Government teams repair roads and answer emergencies. The Civic Bridge connects the two, in both directions." />
          <div className="bridge-grid">
            <div className="bridge-col">
              <span className="safety-symbol"><Truck size={19} /></span>
              <h3>Private partners send in</h3>
              <ul>
                <li><strong>Delivery fleets</strong>Light and pothole readings from riders' phones fill the map fast.</li>
                <li><strong>Ride-hailing apps</strong>Trip details, such as the vehicle number, for Ride Watch.</li>
                <li><strong>Navigation apps</strong>Receive the Danger Index to steer people around red zones.</li>
              </ul>
            </div>
            <span className="bridge-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            <div className="bridge-col bridge-core">
              <span className="safety-symbol"><Sparkles size={19} /></span>
              <h3>NightWing in the middle</h3>
              <p>Checks readings across many trips, scores danger, diagnoses the fault and tracks every case until residents confirm the street is lit again.</p>
            </div>
            <span className="bridge-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            <div className="bridge-col">
              <span className="safety-symbol" style={{ background: "#fff0e4", color: "#cb8c5c" }}><Landmark size={19} /></span>
              <h3>Government services receive</h3>
              <ul>
                <li><strong>City corporation</strong>Ranked streetlight and pothole tickets.</li>
                <li><strong>Electricity board</strong>Area-wide outage reports, kept out of the streetlight queue.</li>
                <li><strong>Police control room (112 / Kavalan SOS)</strong>Ride Watch escalations with the vehicle number and dark-zone location.</li>
              </ul>
            </div>
          </div>
          <div className="bridge-ledger"><Handshake size={18} color="#6c9979" /><p><strong>Joint Safety Ledger.</strong> One shared record of who found each problem, which department owns the fix, and who confirmed it. Partners and departments only ever receive aggregated road data; ride details are shared only when a rider's alert fires.</p></div>
          <div className="try-band"><p><strong>See it working.</strong> The prototype runs the citizen app, the authority console and the Civic Bridge on simulated pilot data. Partner and government integrations are planned, not live.</p><a className="button button-primary" href="/app">Try the prototype <ArrowRight size={17} /></a></div>
        </section>

        <section className="privacy-section section-pad" id="privacy">
          <div className="privacy-ornament" aria-hidden="true"><span /><span /><span /><span /><span /></div>
          <div className="privacy-copy"><span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> GOOD DATA, GENTLY HELD</span><h2>Street-level insight.<br /><em>Not your route history.</em></h2><p>NightWing is designed around shared patterns, not individual journeys. Participation is opt-in; readings are anonymised, coarse and aggregated across trips before they become a heatmap.</p><a href="#technology" className="privacy-link">The principles behind the prototype <ArrowRight size={16} /></a></div>
          <div className="privacy-principles">
            <div><span>01</span><div><strong>You choose to contribute.</strong><p>Light, motion and location sensing is opt-in, for night-time travel.</p></div></div>
            <div><span>02</span><div><strong>Patterns, not personal traces.</strong><p>Map views show aggregated road segments—not individual routes.</p></div></div>
            <div><span>03</span><div><strong>Confidence before conclusions.</strong><p>Repeated independent readings help filter sensor quirks and passing headlights.</p></div></div>
          </div>
        </section>

        <section className="technology-section section-pad" id="technology">
          <div className="technology-intro"><SectionHeading kicker="A FOCUSED FIRST STEP" title={<>Start local.<br /><span>Learn together.</span></>} text="The proposed MVP begins with a campus or neighbourhood pilot. Real deployment, integrations and impact measures would come after field testing with local partners." /></div>
          <div className="tech-board">
            <div className="tech-board-head"><span>PROPOSED BUILDING BLOCKS</span><span>CONCEPT ARCHITECTURE · NOT YET INTEGRATED</span></div>
            <div className="tech-flow">
              <div className="tech-node"><span className="tech-node-icon"><Activity size={18} /></span><small>01 / SENSE</small><strong>Phone signals</strong><p>Light · motion · coarse GPS</p></div>
              <span className="tech-flow-arrow"><ArrowRight size={16} /></span>
              <div className="tech-node"><span className="tech-node-icon"><Sparkles size={18} /></span><small>02 / INTERPRET</small><strong>Road insight</strong><p>Python · ML · scoring</p></div>
              <span className="tech-flow-arrow"><ArrowRight size={16} /></span>
              <div className="tech-node"><span className="tech-node-icon"><MapPin size={18} /></span><small>03 / LOCATE</small><strong>Street context</strong><p>PostgreSQL · PostGIS · OSM</p></div>
              <span className="tech-flow-arrow"><ArrowRight size={16} /></span>
              <div className="tech-node"><span className="tech-node-icon"><Navigation size={18} /></span><small>04 / SUPPORT</small><strong>Safer decisions</strong><p>React web · React Native / Flutter</p></div>
            </div>
            <div className="tech-board-foot"><span>Routing: OSRM / GraphHopper · first pilot: 10–20 dark spots</span><span>Sample data may be simulated for the prototype</span></div>
          </div>
          <div className="mvp-note"><span className="mvp-star">✳</span><p><strong>Designed to start small.</strong> The first proof is not a citywide promise—it’s whether a focused pilot can confirm dark spots, make a safer route useful, and verify a repair on the ground.</p><a href="#team">Meet the team <ArrowRight size={15} /></a></div>
        </section>

        <section className="team-section section-pad" id="team">
          <div className="team-header"><SectionHeading kicker="CODING DIVAS · CHENNAI" title={<>Built from a simple<br /><span>belief in safer streets.</span></>} text="NightWing is a student-led concept for the Hack-A-Throne Sustainability & Smart Cities challenge." /><div className="team-mark-large" aria-hidden="true"><span>NW</span><i>✳</i></div></div>
          <div className="team-list">
            {team.map((member, index) => <article className="team-member" key={member.name}><div className={`team-avatar avatar-${index}`}><span>{member.initials}</span><i /></div><div className="team-member-info"><h3>{member.name}</h3><p>{member.school}</p></div><span className="team-index">0{index + 1}</span></article>)}
          </div>
        </section>

        <section className="closing-section">
          <div className="closing-orbit closing-orbit-one" /><div className="closing-orbit closing-orbit-two" />
          <div className="closing-content"><span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> THE NIGHT CAN BE CLEARER</span><h2>Small signals.<br /><em>Safer journeys.</em></h2><p>When people, streets and city teams share the right picture, the way forward gets a little brighter.</p><a className="button button-light" href="#top">Back to the beginning <ArrowUpRight size={16} /></a></div>
          <div className="closing-stamp"><span>SEE</span><i>✳</i><span>AVOID</span><i>✳</i><span>FIX</span></div>
        </section>
      </main>
      <footer className="site-footer"><div className="footer-top"><BrandMark /><p>Safer streets begin with seeing in the dark.</p><a href="#top" className="back-top">Back to top <ArrowUpRight size={14} /></a></div><div className="footer-bottom"><span>© 2026 Coding Divas · Hack-A-Throne</span><span className="footer-disclaimer"><span /> Concept website · Simulated data · Not a live safety service</span><a href="#privacy">Privacy principles</a></div></footer>
    </div>
  );
}
