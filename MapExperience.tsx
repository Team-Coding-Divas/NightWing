import { useState } from "react";
import { ArrowRight, Clock3, MapPin, Navigation, Volume2 } from "lucide-react";

type Layer = "danger" | "light";
type RouteMode = "fastest" | "safer";
const times = ["8 PM", "10 PM", "12 AM"];
const hotspots = [
  { x: 217, y: 127, risk: "red", light: "dark" },
  { x: 322, y: 174, risk: "orange", light: "dim" },
  { x: 457, y: 204, risk: "orange", light: "dark" },
  { x: 552, y: 247, risk: "red", light: "dark" },
  { x: 355, y: 278, risk: "orange", light: "dim" },
  { x: 614, y: 283, risk: "red", light: "dark" },
  { x: 108, y: 278, risk: "orange", light: "dim" },
  { x: 510, y: 118, risk: "red", light: "dark" },
  { x: 267, y: 335, risk: "orange", light: "dim" },
];

export function MapExperience({ compact = false }: { compact?: boolean }) {
  const [layer, setLayer] = useState<Layer>("danger");
  const [time, setTime] = useState(1);
  const [routeMode, setRouteMode] = useState<RouteMode>("safer");
  const darkSpots = [3, 6, 9][time];
  const activeHotspots = hotspots.slice(0, darkSpots);
  const isLight = layer === "light";

  return (
    <div className={`map-experience ${compact ? "map-compact" : ""}`}>
      <div className="map-toolbar">
        <div className="map-toolbar-title"><span className="map-pin-logo"><MapPin size={15} /></span><div><strong>NightWing map</strong><small>Sample neighborhood · concept</small></div></div>
        <span className="map-context-tag"><span className="live-dot" /> SIMULATED</span>
      </div>
      <div className="map-controls-row">
        <div className="map-layer-switch" role="group" aria-label="Map layer">
          <button type="button" className={!isLight ? "selected" : ""} aria-pressed={!isLight} onClick={() => setLayer("danger")}>Danger Index</button>
          <button type="button" className={isLight ? "selected" : ""} aria-pressed={isLight} onClick={() => setLayer("light")}>Light level</button>
        </div>
        {!compact && <span className="map-time-label"><Clock3 size={13} /> After dark</span>}
      </div>
      <div className={`map-canvas ${isLight ? "map-light-layer" : ""}`}>
        <svg className="street-map" viewBox="0 0 760 430" role="img" aria-label="Illustrative map with sample safer route and street segments">
          <title>Illustrative NightWing road-safety map</title>
          <desc>Stylised neighbourhood streets, two route options, and sample dark or hazardous street segments. This is not live data.</desc>
          <defs>
            <pattern id="mapDots" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#bac9c1" opacity=".56" /></pattern>
            <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
          </defs>
          <rect width="760" height="430" fill="#eff3ec" />
          <rect width="760" height="430" fill="url(#mapDots)" />
          <path d="M0 87 151 91l41 56 84 4 39-82 103-3 22 77 89 11 47-52 121 9 63-49v121l-75 32-91-4-44 85-130-4-48 84-151 0-18-74-102-12-25-69L0 212Z" fill="#e2ede5" />
          <path d="M-15 104 136 107l55 57 92 2 39-81 105-4 23 77 100 14 44-55 117 7" fill="none" stroke="#fff" strokeWidth="33" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-15 104 136 107l55 57 92 2 39-81 105-4 23 77 100 14 44-55 117 7" fill="none" stroke="#d6e1db" strokeWidth="2" strokeDasharray="5 10" strokeLinecap="round" />
          <path d="M78 -14 102 64l-12 66 28 72-2 70 25 47-2 122M249 -12l-5 93 37 74-25 96 41 85-6 115M449 -8l-11 89 27 78-6 67 29 57-5 133M629 -10l-16 87 26 66-9 73 24 62-14 120" fill="none" stroke="#fff" strokeWidth="25" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M78 -14 102 64l-12 66 28 72-2 70 25 47-2 122M249 -12l-5 93 37 74-25 96 41 85-6 115M449 -8l-11 89 27 78-6 67 29 57-5 133M629 -10l-16 87 26 66-9 73 24 62-14 120" fill="none" stroke="#d6e1db" strokeWidth="2" strokeDasharray="5 10" strokeLinecap="round" />
          <path d="M-8 333 92 316l94 22 79-43 85-7 77 25 92-13 79 21 171-36" fill="none" stroke="#fff" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-8 333 92 316l94 22 79-43 85-7 77 25 92-13 79 21 171-36" fill="none" stroke="#d6e1db" strokeWidth="2" strokeDasharray="5 10" strokeLinecap="round" />
          <path d="M67 213c57-16 103-6 150 13 48 20 84 38 134 32 45-5 72-49 115-54 55-5 92 22 137 26 40 4 64-9 91-26" fill="none" stroke="#55a887" strokeWidth="8" opacity={routeMode === "safer" ? ".95" : ".22"} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M67 213c57-16 103-6 150 13 48 20 84 38 134 32 45-5 72-49 115-54 55-5 92 22 137 26 40 4 64-9 91-26" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 8" opacity={routeMode === "safer" ? ".9" : ".1"} strokeLinecap="round" />
          <path d="M67 213c28-59 54-92 117-92 37 0 53 28 81 43 33 17 53 9 84 1 35-10 62-11 88 19 28 33 39 73 91 71 64-2 94-45 160-41" fill="none" stroke="#e59a62" strokeWidth="7" opacity={routeMode === "fastest" ? ".96" : ".48"} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M67 213c28-59 54-92 117-92 37 0 53 28 81 43 33 17 53 9 84 1 35-10 62-11 88 19 28 33 39 73 91 71 64-2 94-45 160-41" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 8" opacity=".8" strokeLinecap="round" />
          {activeHotspots.map((spot) => {
            const fill = isLight
              ? spot.light === "dark" ? "#617c70" : "#d99c5d"
              : spot.risk === "red" ? "#d96755" : "#e99d48";
            return <g key={`${spot.x}-${spot.y}`} className="map-hazard"><circle cx={spot.x} cy={spot.y} r="12" fill={fill} opacity=".2" /><circle cx={spot.x} cy={spot.y} r="5" fill={fill} stroke="#fff" strokeWidth="2" /></g>;
          })}
          <g transform="translate(555 78)"><rect x="0" y="0" width="120" height="36" rx="18" fill="#fff" /><circle cx="18" cy="18" r="5" fill="#55a887" /><text x="31" y="22" fontSize="11" fontFamily="sans-serif" fill="#45685a">Safer route</text></g>
          <g transform="translate(59 184)"><circle cx="29" cy="29" r="22" fill="#fff" opacity=".75" /><circle cx="29" cy="29" r="14" fill="#344d55" /><circle cx="29" cy="29" r="6" fill="#fff" /></g>
          <g transform="translate(410 314)"><path d="M0 11a11 11 0 1 1 22 0c0 8-11 18-11 18S0 19 0 11Z" fill="#fff" stroke="#74a78d" strokeWidth="2"/><circle cx="11" cy="10" r="3" fill="#74a78d" /></g>
          <text x="117" y="391" fontSize="10" fontFamily="sans-serif" fill="#82928b" letterSpacing="1.2">CAMPUS EAST</text>
          <text x="493" y="378" fontSize="10" fontFamily="sans-serif" fill="#82928b" letterSpacing="1.2">LAKE VIEW</text>
          <text x="300" y="46" fontSize="10" fontFamily="sans-serif" fill="#82928b" letterSpacing="1.2">NORTH AVENUE</text>
        </svg>
        {!compact && <div className="map-location-chip"><MapPin size={13} /> Sample pilot area <span>Not live</span></div>}
        <div className="map-overlay-label"><span className="map-overlay-dot" />{isLight ? "Relative light levels · dark / dim" : "Combined Danger Index"}</div>
      </div>
      <div className="map-time-controls"><span className="time-label">DARK HOURS</span><div className="time-tabs" role="group" aria-label="Illustrative time of night">{times.map((label, index) => <button key={label} type="button" className={time === index ? "active" : ""} aria-pressed={time === index} onClick={() => setTime(index)}>{label}</button>)}</div><span className="segment-count"><b>{darkSpots}</b> dark segments <span>·</span> sample</span></div>
      <div className="route-choice-row"><div className="route-choice-head"><span>ROUTE OPTIONS</span><span>COMPARE A TRADE-OFF</span></div><div className="route-options">
        <button type="button" className={`route-option ${routeMode === "fastest" ? "route-option-selected" : ""}`} onClick={() => setRouteMode("fastest")} aria-pressed={routeMode === "fastest"}><span className="route-radio" /><span className="route-option-main"><strong>Fastest</strong><small>3 dark stretches · 2 hazards</small></span><span className="route-duration">12 <small>min</small></span></button>
        <button type="button" className={`route-option ${routeMode === "safer" ? "route-option-selected" : ""}`} onClick={() => setRouteMode("safer")} aria-pressed={routeMode === "safer"}><span className="route-radio" /><span className="route-option-main"><strong>Safer <i>Suggested</i></strong><small>Well-lit route · fewer hazards</small></span><span className="route-duration">14 <small>min</small></span></button>
      </div></div>
      {!compact && <div className="map-alert"><span className="alert-speaker"><Volume2 size={15} /></span><span><small>VOICE ALERT EXAMPLE</small><strong>“Dark stretch ahead in 200 metres, pothole reported.”</strong></span><ArrowRight size={15} /></div>}
      {compact && <div className="map-compact-footer"><span><Navigation size={13} /> {routeMode === "safer" ? "Safer route selected" : "Fastest route selected"}</span><span><Clock3 size={13} /> {routeMode === "safer" ? "14" : "12"} min</span><ArrowRight size={14} /></div>}
    </div>
  );
}
