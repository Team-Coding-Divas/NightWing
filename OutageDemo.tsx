import { useState } from "react";
import { ArrowRight, Lightbulb, Zap } from "lucide-react";

export function OutageDemo() {
  const [scenario, setScenario] = useState<"single" | "area">("single");
  const area = scenario === "area";
  return (
    <div className="outage-demo">
      <div className="outage-tabs" role="group" aria-label="Choose a sample outage scenario">
        <button type="button" className={!area ? "active" : ""} aria-pressed={!area} onClick={() => setScenario("single")}><Lightbulb size={15} /> One segment</button>
        <button type="button" className={area ? "active" : ""} aria-pressed={area} onClick={() => setScenario("area")}><Zap size={15} /> Whole area</button>
      </div>
      <div className={`outage-visual ${area ? "area-outage" : "single-outage"}`} aria-label={area ? "Illustrative area-wide outage across several neighboring street segments" : "Illustrative single streetlight failure, neighboring streets remain lit"}>
        <div className="outage-street"><span /><span /><span /><span /><span /></div>
        <div className="outage-street outage-street-two"><span /><span /><span /><span /><span /></div>
        <div className="outage-neighbor-label"><i className="status-light" /> Neighbouring segments {area ? "also dim" : "still lit"}</div>
        <span className="outage-sample">SIMULATED SIGNAL</span>
      </div>
      <div className="outage-result"><div className="outage-result-icon">{area ? <Zap size={17} /> : <Lightbulb size={17} />}</div><div><small>{area ? "LIKELY AREA-WIDE POWER CUT" : "LIKELY SINGLE BULB / FIXTURE"}</small><strong>{area ? "Route to the electricity board" : "Route to the city corporation"}</strong></div><ArrowRight size={16} /></div>
      <p className="outage-note">A proposed diagnosis based on neighbouring, time-aligned observations—not a confirmed fault report.</p>
    </div>
  );
}
