# NightWing website — implementation outcomes

## [x] 1. Project story and three-pillar product narrative
- The website introduces NightWing as a privacy-first, crowdsourced dark-street and road-hazard mapping concept from Coding Divas for the Hack-A-Throne Sustainability & Smart Cities challenge.
- It explains the night-safety problem, the proposed solution, and the three pillars See, Avoid, Fix: See covers darkness detection, Danger Index, heatmap and dark-hours insight; Avoid covers safer routing, voice alerts, Safe Spots and women's-safety journeys; Fix covers outage diagnosis, repair prioritisation, evidence reporting and community verification.
- It introduces the citizen-facing and municipal-facing workflows and accurately describes NightWing as a concept/prototype, not a deployed or proven service.

## [x] 2. Illustrative safety and map experience
- The website illustrates the combined Danger Index for darkness and potholes, its red/orange/green road-segment states, and the published starting formula: 0.50 × darkness severity + 0.35 × pothole severity + 0.15 × traffic and vulnerable-location score.
- It demonstrates a fastest-versus-safer route comparison, with time and hazard trade-offs, and an example hands-free voice alert.
- It labels any map, route, metric and incident data as illustrative/simulated rather than live. The time controls change the displayed sample hotspot count and plotted markers; map-layer and route controls update their visual state.

## [x] 3. Personal safety and municipal repair workflows
- It explains Safe Spots and the women's Ride Watch and Smart Check-In journeys, including that alerts are intended to be triggered contextually by dark or risky conditions, and references existing emergency services rather than claiming to replace them.
- It explains smart outage diagnosis: an isolated dark segment suggests an individual bulb/fixture issue, while simultaneous nearby drops suggest an area-wide power cut routed to the electricity board.
- It shows transparent repair prioritisation, municipal progress visibility, and opt-in community verification after a repair is reported.

## [x] 4. Privacy, technology, MVP scope, and team
- It describes opt-in, anonymised/coarse light, motion and location observations; relative dark/dim/lit categories; aggregation across independent trips; and privacy-preserving heatmaps rather than publishing individual routes.
- It presents the proposed technology direction (React Native or Flutter and React web, phone light sensor/accelerometer/GPS, Python ML, PostgreSQL + PostGIS, OpenStreetMap and OSRM/GraphHopper routing) without claiming components are already integrated.
- It describes a focused campus/neighbourhood MVP and makes clear that prototype features or sample data may be simulated.
- It lists Prathika (Amrita School of Computing, Chennai), Githa Shri (SRM Easwari Engineering College), and Rashika Shri (Rajalakshmi Engineering College) as the Coding Divas team.

## [x] 5. Responsive, accessible light visual system
- The website uses a lighter, calm, accessible palette while retaining NightWing's night-safety identity, with responsive layouts and clear navigation across the product story. Interactive controls have visible keyboard focus, stronger contrast and accessible labels; the municipal queue uses semantic table markup.

## [x] 6. Working prototype at `/app` (Coding Divas additions)
- New route `/app` (`client/src/pages/Prototype.tsx`, engine in `client/src/prototype/engine.ts`, styles in `client/src/prototype/prototype.css`) using the site's existing palette and fonts.
- Sign-in gate: citizens use name, mobile number and a one-time code (shown on screen as a demo SMS); officials use officer ID and PIN (demo account GCC-W12 / 4821) with a 3-attempt lockout. Prototype checks run in the browser; production would verify both on the server.
- Citizen app: Danger map with a working Danger Index (0.50 darkness + 0.35 potholes + 0.15 vulnerable places), Dark Hours slider (8 PM to 2 AM), Safe Spots and per-road details; SafeRoute computes fastest vs. safer routes and plays voice alerts during a simulated ride.
- Women must verify through a simulated DigiLocker step before they can sign in at all; verification also unlocks Women's Safety Mode: trusted contacts, ride-app trip import, Ride Watch (route deviation into a dark zone) and Smart Check-In, with one-tap WhatsApp/SMS alert links and a police escalation card (112 / Kavalan SOS).
- City Authority console (officials only): repair dashboard with Smart Outage Diagnosis (bulb vs. area power cut), priority-ranked list, resident verification and ward report; Civic Bridge with partner sync and a Joint Safety Ledger.
- All data, partners and departments are simulated and labelled as such.

## [x] 7. Landing-page additions
- "Try the prototype" links in the navigation and hero; new "Two apps, one platform" and "Civic Bridge" sections (`client/src/landing-additions.css`). Existing sections, copy and colours are unchanged.

## [x] 8. Citizen streetlight reports
- Citizen app tab "Report a light" (and a shortcut on each road): road, problem, optional note and photo; "My reports" shows a status timeline.
- City Authority tab "Citizen reports": send an inspection team, record the result (confirmed → repair crew ticket and map update; working → closed), and mark the repair done. Reports are shared between sign-ins and kept in the browser (localStorage) for the demo.

## [x] 9. Fixes from the judge review
- Access: women can use the map, routes and reports without verifying; Women's Safety Mode stays locked until DigiLocker verification, which can now also be done inside the app. Demo officer login is shown on the form as a labelled test account with a "Fill demo login" button; the OTP screen says no SMS is sent.
- Real sensors: new "Help map your street" tab with a camera light meter (or AmbientLightSensor), accelerometer bump detection and GPS; readings saved to a field log with CSV copy/download.
- Reports: GPS pin, real photo thumbnail, duplicate merging with supporters, limit of 3 open reports per person, "Mark not valid" with a reason, a 48-hour inspection target with overdue flags (and a demo clock), update notifications on sign-in. Repairs move to "residents to confirm"; only residents can close them from the citizen app (officials no longer have "Now lit / Still dark").
- Alerts: Ride Watch / Check-In messages include a Google Maps link to the rider's GPS (or the simulated position), and voice alerts and messages can be in Tamil.
- Danger Index weights can be tuned by city engineers in the Repair dashboard.
- Map roads are keyboard and screen-reader accessible (Tab + Enter).
- Optional live sync through a Firebase Realtime Database URL in `nightwing-config.js`; header shows "This device only" / "Live sync".
- GitHub Actions workflow `.github/workflows/check.yml` runs `pnpm check` and `pnpm build`.

## [x] 10. Presenter fixes
- Reset demo data button on the sign-in screen; windows of the same browser stay in sync (two-window presenting without a server).
- Help map your street readings can be sent to a road and change its Danger Index on the map.
- Presenter speed for Ride Watch and Smart Check-In; Test voice with an English fallback when no Tamil voice is installed.
- Dashed borders mark demo controls; DigiLocker is a consent screen that can be allowed or denied.
- Phone layout: scrollable tabs, stacked cards, no sideways scrolling; system font fallback when Google Fonts can't load.

## [ ] 11. Still to do outside the code
- Collect real night readings on 3–5 streets with the "Help map your street" tab and replace the simulated values.
- Calibrate the light and bump thresholds and the Danger Index weights with the pilot data and a ward engineer.
- Get a letter of interest from the ward office or a resident welfare association.
