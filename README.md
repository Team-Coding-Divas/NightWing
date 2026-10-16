# NightWing 🌙

**Crowdsourced dark-street and pothole mapping for safer night travel.**

NightWing turns the night journeys people already take into a live picture of dark roads and hidden hazards, so people can choose safer routes and cities can fix the right problems first.

Built by **Team Coding Divas** for **Hack-A-Throne 2026** · Domain: **Sustainability & Smart Cities**

> ⚠️ **Prototype notice:** NightWing is a student concept and working prototype. All map data, partners and government departments are **simulated**. It is not a live safety service. In an emergency in India, call **112**.

![NightWing landing page](docs/screenshots/landing.png)

---

## The problem

Broken and missing streetlights make roads unsafe at night, especially for women, students, night-shift workers and two-wheeler riders. Cities mostly learn about dark streets through one-by-one complaints, so:

- many dark stretches are **never reported**,
- repairs have **no clear priority**, and
- lights are marked "fixed" **without anyone checking**.

Darkness also hides potholes, a **double hazard** for riders that existing tools map separately or not at all.

## The idea

With consent, a phone's **light sensor, accelerometer and GPS** record conditions during night travel. NightWing combines many anonymous readings into one **Danger Index** per road segment:

```
Danger Index = 0.50 × darkness severity + 0.35 × pothole severity + 0.15 × traffic and vulnerable-location score
```

The weights are transparent starting values, to be tuned with pilot data and city engineers.

Every feature fits one of three pillars:

| See | Avoid | Fix |
|---|---|---|
| Danger Index map | SafeRoute (fastest vs. safer) | Smart Outage Diagnosis |
| Dark Hours timeline | Hands-free voice alerts | DarkSpot priority score |
| Darkness heatmap | Safe Spots nearby | Resident repair verification |
| | Women's Safety Mode | Ward repair reports |

---

## Two apps, one platform

Everyone signs in first, and each person sees only what they need.

### 👤 Citizen app
Sign in with a name, mobile number and one-time code. Sharing road readings is optional.

- **Danger map:** roads coloured red (dark + potholes), orange (dark or risky) and green (lower risk), with a Dark Hours slider from 8 PM to 2 AM.
- **SafeRoute:** compares the fastest route with a safer one and plays voice alerts such as *"Dark stretch ahead in 200 metres, pothole reported."*
- **Women's Safety Mode** (visible only to women verified through a DigiLocker step):
  - **Ride Watch:** alerts trusted contacts if an auto or cab leaves the expected route and enters a dark zone.
  - **Smart Check-In:** asks *"Are you okay?"* after an unexpected stop on a dark stretch.
  - One-tap **WhatsApp / SMS** alerts with the road and vehicle number, plus a police escalation card (112 / Kavalan SOS).

| Sign-in | Danger map |
|---|---|
| ![Sign-in](docs/screenshots/sign-in.png) | ![Danger map](docs/screenshots/danger-map.png) |

| SafeRoute | Ride Watch alert |
|---|---|
| ![SafeRoute](docs/screenshots/saferoute.png) | ![Ride Watch alert](docs/screenshots/ride-watch-alert.png) |

### 🏛️ City Authority console
For ward engineers, the electricity board and police. **Citizens cannot open it.**

- **Smart Outage Diagnosis:** one dark segment → probable bulb failure → city corporation. A whole area dark at once → probable power cut → electricity board.
- **Priority-ranked repair list**, resident "Now lit / Still dark" verification, and a ward report.
- **Civic Bridge:** connects private apps with government services.
  - Delivery fleets send road readings; ride apps share trip details; navigation apps receive the Danger Index.
  - Tickets go to the city corporation, outages to the electricity board, and Ride Watch escalations to the police control room.
  - A **Joint Safety Ledger** records who found each problem, who owns the fix and who confirmed it.

| Repair dashboard | Civic Bridge |
|---|---|
| ![Repair dashboard](docs/screenshots/repair-dashboard.png) | ![Civic Bridge](docs/screenshots/civic-bridge.png) |

---

## Try the demo

Run the project (see below) and open **`/app`**, or click **Try the prototype** on the landing page.

| Role | How to sign in |
|---|---|
| Citizen | Any name and 10-digit mobile number → **Send code** → enter the code shown on screen. Choose **Woman** and tap **Verify with DigiLocker (demo)** to unlock Women's Safety Mode. |
| City official | Officer ID **`GCC-W12`**, PIN **`4821`** |

**Suggested demo flow**
1. Danger map: drag the time slider past midnight and watch lights fail.
2. SafeRoute: ride the **fastest** route from Tech Park to Girls' Hostel to hear voice alerts.
3. Women's Safety: add your number as a trusted contact, **Import trip**, **Start auto ride**, then **Simulate wrong turn**. Send the alert on WhatsApp.
4. Sign out and sign in as an official: simulate a **power cut** and a **bulb failure**, mark a repair, confirm it, and generate the ward report.
5. Civic Bridge: **Run tonight's partner sync** and watch the Joint Safety Ledger fill in.

---

## Tech stack

**This prototype**
- React 19 + TypeScript, Vite, Tailwind CSS
- Express + tRPC server scaffold (Manus web template), Drizzle ORM
- Routing and Danger Index logic in `client/src/prototype/engine.ts` (Dijkstra over a simulated road graph)
- Browser Speech Synthesis for voice alerts; WhatsApp / SMS deep links for alerts

**Planned production stack**
- React Native or Flutter app; React web console
- Phone light sensor, accelerometer, gyroscope and GPS
- Python (Pandas, Scikit-learn, TensorFlow Lite) for filtering, calibration and pothole classification
- PostgreSQL + PostGIS, OpenStreetMap, OSRM / GraphHopper, Overpass API for Safe Spots
- Officer accounts with role-based access, an SMS gateway and partner APIs for the Civic Bridge

## Project structure

```
client/
  src/
    pages/Home.tsx            Landing page (story, map preview, two apps, Civic Bridge)
    pages/Prototype.tsx       Working prototype: sign-in, citizen app, authority console
    prototype/engine.ts       Simulated road network, Danger Index, routing, diagnosis
    prototype/prototype.css   Prototype styles (site palette)
    landing-additions.css     Styles for the new landing sections
    components/               Map preview, outage demo, UI components
server/                       Express + tRPC scaffold
docs/screenshots/             Images used in this README
```

## Getting started

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev          # development server on PORT (default 3000)
```

Then open `http://localhost:3000` (landing page) and `http://localhost:3000/app` (prototype).

Other scripts:

| Command | What it does |
|---|---|
| `pnpm build` / `pnpm start` | Build and serve `dist/index.js` and `dist/public/` |
| `pnpm build:static` | Build the front end only |
| `pnpm check` | Type-check |
| `pnpm test` | Run tests |
| `pnpm db:migrate` / `pnpm db:push` | Apply or generate database migrations |

## Privacy and responsible design

- Sensing is **opt-in** and off by default.
- Only **coarse, aggregated** road-segment data is stored; individual routes are never shown.
- Women's verification keeps only a "verified" flag, never documents.
- Location and ride details reach trusted contacts or police **only when the rider's alert fires**.
- Scores describe lighting and road hazards; they are **not a guarantee of personal safety**.

### Prototype limitations
- Codes, DigiLocker verification and officer login are checked in the browser for demonstration. A production app would send real SMS codes and verify accounts on a server.
- Alerts open WhatsApp or SMS with the message ready; the user taps send.
- Partner apps and government departments are simulated; these integrations are planned, not live.

## Team Coding Divas

| Member | College |
|---|---|
| Prathika | Amrita School of Computing, Chennai |
| Githa Shri | SRM Easwari Engineering College |
| Rashika Shri | Rajalakshmi Engineering College |

Supports UN SDG 11 (sustainable cities) and SDG 5 (gender equality).

## License

MIT
