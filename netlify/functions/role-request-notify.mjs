// Emails the administrator when someone asks for the Clinical Supervisor or
// QIP Lead role (called by role-requests.js straight after the request is saved).
//
// The browser sends only its Firebase sign-in token and the role. This
// function checks the token with Firebase, then reads that person's saved
// request from Firestore using their own token (so the database rules apply),
// and emails what is saved. Nobody can use it to send anything else, and it
// only ever emails the address in ROLE_REQUEST_NOTIFY_TO.
//
// Set up on Netlify (Site configuration -> Environment variables):
//   LOOPS_API_KEY                 Loops API key (Loops -> Settings -> API)
//   LOOPS_ROLE_REQUEST_EMAIL_ID   ID of the published Loops transactional email
//   ROLE_REQUEST_NOTIFY_TO        the address that receives the emails
// Until all three are set it does nothing and says so; the request is still
// in the Admin audit page either way.

// Public Firebase web settings (the same values as config.js).
const FIREBASE_WEB_API_KEY = 'AIzaSyBdu73Xb8xf4tJU4RLhJ82ANhLMI9eu0gI';
const FIREBASE_PROJECT = 'rcem-qip-app';
const ROLE_NAMES = { supervisor: 'Clinical Supervisor', qip_lead: 'Departmental QIP Lead' };
// A request is only emailed when it was saved in the last few minutes, so an
// old request can't be re-sent over and over.
const FRESH_MS = 10 * 60 * 1000;

const reply = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

// Firestore REST documents wrap each value by type: { stringValue: '...' }.
function plainFields(docJson) {
    const out = {};
    for (const [k, v] of Object.entries(docJson.fields || {})) {
        out[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? '';
    }
    return out;
}

export default async (req) => {
    if (req.method !== 'POST') return reply(405, { error: 'POST only' });

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    let role = '';
    try { role = (await req.json()).role; } catch { /* handled below */ }
    if (!token || !ROLE_NAMES[role]) return reply(400, { error: 'Missing sign-in token or role' });

    const { LOOPS_API_KEY, LOOPS_ROLE_REQUEST_EMAIL_ID, ROLE_REQUEST_NOTIFY_TO } = process.env;
    if (!LOOPS_API_KEY || !LOOPS_ROLE_REQUEST_EMAIL_ID || !ROLE_REQUEST_NOTIFY_TO) {
        return reply(200, { sent: false, reason: 'Email to the administrator is not set up yet' });
    }

    // Who is asking: Firebase checks the token and returns the account.
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
    });
    if (!lookup.ok) return reply(401, { error: 'Sign-in token not accepted' });
    const account = ((await lookup.json()).users || [])[0];
    if (!account || !account.localId) return reply(401, { error: 'Sign-in token not accepted' });

    // What they asked for: their saved request, read as them.
    const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/roleRequests/${encodeURIComponent(account.localId + '_' + role)}`;
    const saved = await fetch(docUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!saved.ok) return reply(404, { error: 'No saved request found' });
    const r = plainFields(await saved.json());
    const savedAt = Date.parse(r.updatedAtIso || r.createdAtIso || '');
    if (r.status !== 'pending' || !savedAt || Date.now() - savedAt > FRESH_MS) {
        return reply(200, { sent: false, reason: 'Not a new request' });
    }

    const v = s => (s && String(s).trim()) || '-';
    const send = await fetch('https://app.loops.so/api/v1/transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOOPS_API_KEY}` },
        body: JSON.stringify({
            transactionalId: LOOPS_ROLE_REQUEST_EMAIL_ID,
            email: ROLE_REQUEST_NOTIFY_TO,
            dataVariables: {
                roleName: ROLE_NAMES[role],
                fullName: v(r.fullName),
                jobTitle: v(r.jobTitle),
                hospital: v(r.hospital),
                organisation: v(r.organisation),
                department: v(r.department),
                regNumber: v(r.regNumber),
                accountEmail: v(account.email || r.email),
                workEmail: v(r.workEmail),
                phone: v(r.phone),
                reason: v(r.reason),
                submittedAt: new Date(savedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' }),
                accountId: account.localId
            }
        })
    });
    if (!send.ok) {
        console.warn('Loops send failed', send.status, (await send.text()).slice(0, 300));
        return reply(502, { sent: false, reason: 'The email service refused the message' });
    }
    return reply(200, { sent: true });
};
