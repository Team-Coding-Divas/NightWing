/*
 * NightWing live sync (optional).
 *
 * Leave databaseURL empty and the prototype keeps everything on this device (localStorage).
 * Set it to a Firebase Realtime Database URL and every phone and laptop that opens the site
 * shares the same citizen reports, repair status and ledger, so a citizen's report shows up
 * on the official's console in a few seconds.
 *
 *   window.NIGHTWING_CONFIG = { databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app" };
 *
 * See the README section "Live sync across devices" for the 5-minute setup.
 * Demo only: the database rules in the README are open for the hackathon demo. A real
 * deployment needs sign-in and per-role rules on a server.
 */
window.NIGHTWING_CONFIG = window.NIGHTWING_CONFIG || { databaseURL: "" };
