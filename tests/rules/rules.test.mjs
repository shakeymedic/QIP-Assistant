// firestore.rules in the real Firestore emulator.
// Run `npm install` then `npm test` in this folder (needs Java 21 for the emulator).
// RULES_FILE=<path> tests another rules file (e.g. a copy of what is live in the console).
// Each test is either something the app really does (so a rule change can't silently
// break it) or an attack from the Firebase security-rules auditor checklist.
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, collectionGroup, getDocs, serverTimestamp, query, where } from 'firebase/firestore';

const RULES = fs.readFileSync(process.env.RULES_FILE || new URL('../../firestore.rules', import.meta.url), 'utf8');
const ADMIN = 'emevidence999@gmail.com';
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-qipassist', firestore: { rules: RULES, host: '127.0.0.1', port: 8080 } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const trainee = () => as('trainee', 'trainee@nhs.net');
const sup = () => as('sup', 'sup@nhs.net');
const lead = () => as('lead', 'lead@nhs.net');
const stranger = () => as('stranger', 'stranger@nhs.net');
const admin = () => as('admin', ADMIN);
const nobody = () => env.unauthenticatedContext().firestore();
const seed = (path, value) => env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), value));

const PROJECT = 'users/trainee/projects/p1';
const project = { meta: { title: 'Sepsis QIP' }, supervisors: [{ email: 'sup@nhs.net' }], assessment: { traineeSeenAt: '2026-10-01' } };
const invite = (email) => ({ email, ownerUid: 'trainee', projectId: 'p1', projectTitle: 'Sepsis QIP', traineeName: 'Dr T', traineeEmail: 'trainee@nhs.net', addedAt: '2026-10-29' });

// ---- projects ----------------------------------------------------------------------------------
test('a trainee creates, edits, lists and deletes their own projects', async () => {
  await assertSucceeds(setDoc(doc(trainee(), PROJECT), project));
  await assertSucceeds(setDoc(doc(trainee(), PROJECT), { meta: { title: 'Renamed' } }, { merge: true }));
  await assertSucceeds(getDocs(collection(trainee(), 'users/trainee/projects')));
  await assertSucceeds(deleteDoc(doc(trainee(), PROJECT)));
});

test('a share link opens one project without signing in, but nobody can list them', async () => {
  await seed(PROJECT, project);
  await assertSucceeds(getDoc(doc(nobody(), PROJECT)));
  await assertFails(getDocs(collection(nobody(), 'users/trainee/projects')));
  await assertFails(getDocs(collection(stranger(), 'users/trainee/projects')));
});

test('nobody else can edit or delete a project', async () => {
  await seed(PROJECT, project);
  await assertFails(setDoc(doc(stranger(), PROJECT), { meta: { title: 'x' } }, { merge: true }));
  await assertFails(deleteDoc(doc(stranger(), PROJECT)));
  await assertFails(setDoc(doc(nobody(), PROJECT), { meta: { title: 'x' } }, { merge: true }));
});

// The query the QIP Lead view runs (fetchAllProjectsEnriched in app.js).
const deptQuery = (db, dept) => query(collectionGroup(db, 'projects'), where('department', '==', dept), where('visibility.hideFromDeptQIPLead', '==', false));
const inDept = (dept, hidden = false) => ({ ...project, department: dept, departmentName: 'ED ' + dept, visibility: { hideFromDeptQIPLead: hidden } });

test('the department view needs the admin or an approved QIP Lead with that department', async () => {
  await seed(PROJECT, inDept('qeh'));
  await seed('qipUsers/lead', { email: 'lead@nhs.net', roles: ['qip_lead'] });
  await assertSucceeds(getDocs(collectionGroup(admin(), 'projects')));
  // Claiming the role is not enough...
  await assertFails(getDocs(deptQuery(lead(), 'qeh')));
  // ...nor is approval without a department...
  await seed('deptQIPLeads/lead', { email: 'lead@nhs.net', approvedAt: '2026-10-29' });
  await assertFails(getDocs(deptQuery(lead(), 'qeh')));
  // ...approval with the department is.
  await seed('deptQIPLeads/lead', { email: 'lead@nhs.net', approvedAt: '2026-10-29', department: 'qeh', departmentName: 'QEH ED' });
  await assertSucceeds(getDocs(deptQuery(lead(), 'qeh')));
  await assertSucceeds(getDoc(doc(lead(), 'qipUsers/trainee')));
});

test('a QIP Lead sees only their own department, and never a hidden project', async () => {
  await seed('deptQIPLeads/lead', { email: 'lead@nhs.net', approvedAt: '2026-10-29', department: 'qeh', departmentName: 'QEH ED' });
  await seed(PROJECT, inDept('qeh'));
  await seed('users/other/projects/p2', inDept('bhh'));
  await seed('users/hider/projects/p3', inDept('qeh', true));
  await seed('users/old/projects/p4', project); // made before departments: no department
  // The whole collection, another department, or including hidden ones: refused.
  await assertFails(getDocs(collectionGroup(lead(), 'projects')));
  await assertFails(getDocs(deptQuery(lead(), 'bhh')));
  await assertFails(getDocs(query(collectionGroup(lead(), 'projects'), where('department', '==', 'qeh'))));
  // The app's own query returns just the one visible project in their department.
  const snap = await assertSucceeds(getDocs(deptQuery(lead(), 'qeh')));
  if (snap.size !== 1 || snap.docs[0].ref.path !== PROJECT) throw new Error('expected only ' + PROJECT + ', got ' + snap.docs.map(d => d.ref.path));
  // Opening one directly (with the share link off, so only the rules for leads apply):
  // their department yes, others no.
  await seed(PROJECT, { ...inDept('qeh'), sharing: { linkOff: true } });
  await assertSucceeds(getDoc(doc(lead(), PROJECT)));
  await seed('users/other/projects/p2', { ...inDept('bhh'), sharing: { linkOff: true } });
  await seed('users/hider/projects/p3', { ...inDept('qeh', true), sharing: { linkOff: true } });
  await assertFails(getDoc(doc(lead(), 'users/other/projects/p2')));
  await assertFails(getDoc(doc(lead(), 'users/hider/projects/p3')));
  // A lead the trainee invited by email still sees a hidden project.
  await seed('qipLeadInvites/lead@nhs.net/invites/hider_p3', { ...invite('lead@nhs.net'), ownerUid: 'hider', projectId: 'p3' });
  await assertSucceeds(getDoc(doc(lead(), 'users/hider/projects/p3')));
});

test('only the admin adds departments and sets a lead\'s department; anyone signed in can list them', async () => {
  await assertSucceeds(setDoc(doc(admin(), 'departments/qeh'), { name: 'QEH ED', createdAtIso: '2026-11-08T10:00:00Z' }));
  await assertFails(setDoc(doc(trainee(), 'departments/fake'), { name: 'Fake ED' }));
  await assertFails(setDoc(doc(admin(), 'departments/bad'), { name: 'Bad', extra: 1 }));
  await assertFails(setDoc(doc(admin(), 'departments/empty'), { name: '' }));
  await assertSucceeds(getDocs(collection(trainee(), 'departments')));
  await assertFails(getDocs(collection(nobody(), 'departments')));
  await assertSucceeds(setDoc(doc(admin(), 'deptQIPLeads/lead'), { email: 'lead@nhs.net', displayName: 'Dr L', approvedAt: '2026-11-08', department: 'qeh', departmentName: 'QEH ED' }));
  await assertFails(setDoc(doc(lead(), 'deptQIPLeads/lead'), { email: 'lead@nhs.net', approvedAt: '2026-11-08', department: 'bhh' }));
  await assertFails(deleteDoc(doc(trainee(), 'departments/qeh')));
  await assertSucceeds(deleteDoc(doc(admin(), 'departments/qeh')));
});

// ---- share link on / off and logging -----------------------------------------------------------
test('switching the share link off stops it working; invitees, the admin and the lead keep access', async () => {
  await seed('deptQIPLeads/lead', { email: 'lead@nhs.net', approvedAt: '2026-10-29', department: 'qeh' });
  await seed(PROJECT, { ...inDept('qeh'), sharing: { linkOff: false } });
  await assertSucceeds(getDoc(doc(nobody(), PROJECT)));
  await assertSucceeds(getDoc(doc(stranger(), PROJECT)));
  // The owner switches it off (a normal save).
  await assertSucceeds(setDoc(doc(trainee(), PROJECT), { sharing: { linkOff: true } }, { merge: true }));
  await assertFails(getDoc(doc(nobody(), PROJECT)));
  await assertFails(getDoc(doc(stranger(), PROJECT)));
  await assertSucceeds(getDoc(doc(trainee(), PROJECT)));
  await assertSucceeds(getDoc(doc(admin(), PROJECT)));
  await assertSucceeds(getDoc(doc(lead(), PROJECT)));
  await seed('supervisorInvites/sup@nhs.net/invites/trainee_p1', invite('sup@nhs.net'));
  await assertSucceeds(getDoc(doc(sup(), PROJECT)));
  // An unverified address cannot claim the invite.
  await assertFails(getDoc(doc(as('sup', 'sup@nhs.net', false), PROJECT)));
  // Nobody else can switch it back on.
  await assertFails(setDoc(doc(stranger(), PROJECT), { sharing: { linkOff: false } }, { merge: true }));
});

const shareView = (over = {}) => ({ viewerUid: '(unauthenticated)', viewerEmail: '(unauthenticated)', viaRole: 'share_link', ownerUid: 'trainee', projectId: 'p1', projectTitle: 'Sepsis QIP', action: 'viewed', createdAtIso: '2026-11-08T10:00:00Z', createdAt: serverTimestamp(), ...over });

test('a share-link view by someone not signed in is logged, and the owner can read their own log', async () => {
  await seed(PROJECT, project);
  await assertSucceeds(addDoc(collection(nobody(), 'projectAccessLog'), shareView()));
  // Not signed in: cannot pretend to be someone, use another route, or log a project with no live link.
  await assertFails(addDoc(collection(nobody(), 'projectAccessLog'), shareView({ viewerUid: 'sup' })));
  await assertFails(addDoc(collection(nobody(), 'projectAccessLog'), shareView({ viaRole: 'supervisor' })));
  await assertFails(addDoc(collection(nobody(), 'projectAccessLog'), shareView({ projectId: 'nope' })));
  await seed('users/trainee/projects/p9', { ...project, sharing: { linkOff: true } });
  await assertFails(addDoc(collection(nobody(), 'projectAccessLog'), shareView({ projectId: 'p9' })));
  await assertFails(addDoc(collection(nobody(), 'projectAccessLog'), shareView({ extra: 'x' })));
  // The owner reads the views of their project with the query the app uses...
  const q = db => query(collection(db, 'projectAccessLog'), where('ownerUid', '==', 'trainee'), where('projectId', '==', 'p1'));
  const snap = await assertSucceeds(getDocs(q(trainee())));
  if (snap.size !== 1) throw new Error('expected 1 view, got ' + snap.size);
  // ...nobody else can, and the owner cannot read other people's.
  await assertFails(getDocs(q(stranger())));
  await assertFails(getDocs(q(nobody())));
  await assertFails(getDocs(collection(trainee(), 'projectAccessLog')));
  await assertSucceeds(getDocs(collection(admin(), 'projectAccessLog')));
});

// ---- role-request email limit (netlify/functions/role-request-notify.mjs) ----------------------
test('the administrator is emailed about a request at most once an hour', async () => {
  const id = 'roleRequestEmails/lead_qip_lead';
  await assertSucceeds(setDoc(doc(lead(), id), { sentAt: serverTimestamp() }));
  // Again straight away: refused, so the function sends nothing.
  await assertFails(setDoc(doc(lead(), id), { sentAt: serverTimestamp() }));
  // A made-up time, extra fields, someone else's ID, or deleting it to reset: refused.
  await assertFails(setDoc(doc(lead(), 'roleRequestEmails/lead_supervisor'), { sentAt: new Date('2020-01-01') }));
  await assertFails(setDoc(doc(lead(), 'roleRequestEmails/lead_supervisor'), { sentAt: serverTimestamp(), x: 1 }));
  await assertFails(setDoc(doc(stranger(), 'roleRequestEmails/lead_supervisor'), { sentAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(lead(), id)));
  await assertSucceeds(getDoc(doc(lead(), id)));
  await assertFails(getDoc(doc(stranger(), id)));
  // Over an hour later it is allowed again.
  await seed(id, { sentAt: new Date(Date.now() - 61 * 60 * 1000) });
  await assertSucceeds(setDoc(doc(lead(), id), { sentAt: serverTimestamp() }));
});

// ---- supervisor sign-off -----------------------------------------------------------------------
test('an invited supervisor can save comments and sign off, as saveSupervisorAssessment does', async () => {
  await seed(PROJECT, project);
  await seed('supervisorInvites/sup@nhs.net/invites/trainee_p1', invite('sup@nhs.net'));
  await assertSucceeds(setDoc(doc(sup(), PROJECT), {
    assessment: { supervisorComments: 'Good work', signedOff: true, signedOffBy: 'Dr S', signedOffByUid: 'sup', signedOffByEmail: 'sup@nhs.net', signedOffGmc: '1234567', signedOffDate: '2026-10-29', lastSupervisorActivityAt: '2026-10-29T10:00:00Z' }
  }, { merge: true }));
});

test('a supervisor cannot touch anything outside the sign-off fields', async () => {
  await seed(PROJECT, project);
  await seed('supervisorInvites/sup@nhs.net/invites/trainee_p1', invite('sup@nhs.net'));
  await assertFails(setDoc(doc(sup(), PROJECT), { meta: { title: 'Hijacked' } }, { merge: true }));
  await assertFails(setDoc(doc(sup(), PROJECT), { assessment: { traineeSeenAt: '2030-01-01' } }, { merge: true }));
  await assertFails(setDoc(doc(sup(), PROJECT), { assessment: { supervisorComments: 'x'.repeat(20001) } }, { merge: true }));
  await assertFails(deleteDoc(doc(sup(), PROJECT)));
});

test('nobody can sign off a project they were not invited to', async () => {
  await seed(PROJECT, project);
  await assertFails(setDoc(doc(stranger(), PROJECT), { assessment: { signedOff: true } }, { merge: true }));
  // An invite the stranger wrote for themselves is refused, so they can't fake one.
  await assertFails(setDoc(doc(stranger(), 'supervisorInvites/stranger@nhs.net/invites/trainee_p1'), invite('stranger@nhs.net')));
});

// ---- invites -----------------------------------------------------------------------------------
test('the owner creates and removes per-project invites; the invitee reads theirs', async () => {
  await assertSucceeds(setDoc(doc(trainee(), 'supervisorInvites/sup@nhs.net/invites/trainee_p1'), invite('sup@nhs.net'), { merge: true }));
  await assertSucceeds(setDoc(doc(trainee(), 'qipLeadInvites/lead@nhs.net/invites/trainee_p1'), invite('lead@nhs.net'), { merge: true }));
  await assertSucceeds(getDocs(collection(sup(), 'supervisorInvites/sup@nhs.net/invites')));
  await assertSucceeds(getDocs(collection(lead(), 'qipLeadInvites/lead@nhs.net/invites')));
  await assertFails(getDocs(collection(stranger(), 'supervisorInvites/sup@nhs.net/invites')));
  await assertSucceeds(deleteDoc(doc(trainee(), 'supervisorInvites/sup@nhs.net/invites/trainee_p1')));
  // Removing an invite that is already gone is allowed (deleteInvite is best-effort).
  await assertSucceeds(deleteDoc(doc(trainee(), 'supervisorInvites/sup@nhs.net/invites/trainee_p9')));
});

test('invites cannot be forged, mis-addressed or deleted by someone else', async () => {
  await seed('supervisorInvites/sup@nhs.net/invites/trainee_p1', invite('sup@nhs.net'));
  await assertFails(deleteDoc(doc(stranger(), 'supervisorInvites/sup@nhs.net/invites/trainee_p1')));
  await assertFails(setDoc(doc(trainee(), 'supervisorInvites/sup@nhs.net/invites/trainee_p2'), invite('sup@nhs.net')));      // ID doesn't match
  await assertFails(setDoc(doc(trainee(), 'supervisorInvites/other@nhs.net/invites/trainee_p1'), invite('sup@nhs.net')));    // email doesn't match
  await assertFails(setDoc(doc(trainee(), 'supervisorInvites/sup@nhs.net/invites/trainee_p1'), { ...invite('sup@nhs.net'), extra: 1 }));
  await assertFails(setDoc(doc(trainee(), 'otherInvites/sup@nhs.net/invites/trainee_p1'), invite('sup@nhs.net')));
});

test('the old shared invite lists can still be read by the invitee but no longer written', async () => {
  await seed('supervisorInvites/sup@nhs.net', { projects: [{ ownerUid: 'trainee', projectId: 'p1' }] });
  await assertSucceeds(getDoc(doc(sup(), 'supervisorInvites/sup@nhs.net')));
  await assertFails(getDoc(doc(stranger(), 'supervisorInvites/sup@nhs.net')));
  await assertFails(setDoc(doc(stranger(), 'supervisorInvites/sup@nhs.net'), { projects: [] }));
});

// ---- profiles and approvals --------------------------------------------------------------------
test('a user keeps their own profile and roles; others cannot read it', async () => {
  await assertSucceeds(setDoc(doc(lead(), 'qipUsers/lead'), { email: 'lead@nhs.net', displayName: 'Dr L', roles: ['qip_lead'], createdAt: '2026-10-29T10:00:00Z' }, { merge: true }));
  await assertSucceeds(setDoc(doc(lead(), 'qipUsers/lead'), { email: 'lead@nhs.net', lastLogin: '2026-10-29T11:00:00Z' }, { merge: true }));
  await assertFails(getDoc(doc(stranger(), 'qipUsers/lead')));
  await assertFails(setDoc(doc(stranger(), 'qipUsers/lead'), { roles: [] }, { merge: true }));
  await assertFails(setDoc(doc(lead(), 'qipUsers/lead'), { displayName: 'x'.repeat(201) }, { merge: true }));
  // Quick Guide "Don't show on startup", saved on the account (app.js saveHowtoDismissed)
  await assertSucceeds(setDoc(doc(lead(), 'qipUsers/lead'), { howtoDismissed: true }, { merge: true }));
  await assertFails(setDoc(doc(stranger(), 'qipUsers/lead'), { howtoDismissed: false }, { merge: true }));
  await assertSucceeds(getDoc(doc(admin(), 'qipUsers/lead')));
});

test('only the admin can approve or revoke a QIP Lead; nobody approves themselves', async () => {
  await assertFails(setDoc(doc(lead(), 'deptQIPLeads/lead'), { email: 'lead@nhs.net', approvedAt: '2026-10-29' }));
  await assertSucceeds(setDoc(doc(admin(), 'deptQIPLeads/lead'), { email: 'lead@nhs.net', displayName: 'Dr L', approvedAt: '2026-10-29' }));
  await assertSucceeds(getDocs(collection(admin(), 'deptQIPLeads')));
  await assertSucceeds(getDoc(doc(lead(), 'deptQIPLeads/lead')));
  await assertFails(getDocs(collection(lead(), 'deptQIPLeads')));
  await assertFails(deleteDoc(doc(lead(), 'deptQIPLeads/lead')));
  await assertSucceeds(deleteDoc(doc(admin(), 'deptQIPLeads/lead')));
});

// ---- audit trail -------------------------------------------------------------------------------
test('the audit trail can be written by the person it is about and read only by the admin', async () => {
  await assertSucceeds(addDoc(collection(lead(), 'roleAuditLog'), { uid: 'lead', email: 'lead@nhs.net', displayName: 'Dr L', role: 'qip_lead', action: 'added', source: 'settings', createdAtIso: '2026-10-29T10:00:00Z', createdAt: serverTimestamp() }));
  await assertSucceeds(addDoc(collection(sup(), 'projectAccessLog'), { viewerUid: 'sup', viewerEmail: 'sup@nhs.net', viaRole: 'supervisor', ownerUid: 'trainee', projectId: 'p1', projectTitle: 'Sepsis QIP', action: 'viewed', createdAtIso: '2026-10-29T10:00:00Z', createdAt: serverTimestamp() }));
  await assertSucceeds(addDoc(collection(admin(), 'roleAuditLog'), { uid: 'lead', email: 'lead@nhs.net', displayName: 'Dr L', role: 'qip_lead', action: 'approved', source: 'admin', createdAtIso: '2026-10-29T10:00:00Z', createdAt: serverTimestamp() }));
  await assertFails(addDoc(collection(stranger(), 'roleAuditLog'), { uid: 'lead', role: 'qip_lead', action: 'removed', createdAtIso: '2026-10-29T10:00:00Z' }));
  await assertFails(getDocs(collection(lead(), 'roleAuditLog')));
  await assertSucceeds(getDocs(collection(admin(), 'roleAuditLog')));
  await assertSucceeds(getDocs(collection(admin(), 'projectAccessLog')));
});

test('both admin accounts get the admin view; a look-alike email does not', async () => {
  await seed(PROJECT, project);
  await assertSucceeds(getDocs(collectionGroup(as('admin2', 'jaketurner2503@gmail.com'), 'projects')));
  await assertSucceeds(setDoc(doc(as('admin2', 'jaketurner2503@gmail.com'), 'deptQIPLeads/lead'), { email: 'lead@nhs.net', approvedAt: '2026-10-29' }));
  await assertFails(getDocs(collectionGroup(as('fake', 'jaketurner2503@gmail.com.evil.com'), 'projects')));
});

test('collections from other apps are closed', async () => {
  for (const path of ['sessions/s1', 'stationAggregates/a1', 'stationReports/r1', 'paired_sessions/ABC234', 'ai_markings/m1', 'users/trainee', 'users/trainee/notes/n1']) {
    await assertFails(setDoc(doc(trainee(), path), { x: 1 }), path);
  }
  await assertFails(getDocs(collection(nobody(), 'stationReports')));
});

// ---- role requests (Supervisor / QIP Lead details) ---------------------------------------------
const details = (uid, role, extra = {}) => ({
  uid, role, email: `${uid}@nhs.net`, status: 'pending', fullName: 'Dr L', jobTitle: 'EM Consultant', hospital: 'QEHB',
  organisation: 'UHB', department: 'ED', regNumber: '1234567', workEmail: '', phone: '', reason: '',
  createdAtIso: '2026-10-30T08:00:00Z', updatedAtIso: '2026-10-30T08:00:00Z', ...extra
});

test('someone asking for a role saves, reads, updates and withdraws their own request', async () => {
  await assertSucceeds(setDoc(doc(lead(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead')));
  await assertSucceeds(setDoc(doc(sup(), 'roleRequests/sup_supervisor'), details('sup', 'supervisor')));
  await assertSucceeds(getDoc(doc(lead(), 'roleRequests/lead_qip_lead')));
  await assertSucceeds(setDoc(doc(lead(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { hospital: 'Heartlands' })));
  await assertSucceeds(deleteDoc(doc(lead(), 'roleRequests/lead_qip_lead')));
});

test('a request cannot approve itself, skip the details, use someone else\'s ID or carry extra fields', async () => {
  await assertFails(setDoc(doc(lead(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { status: 'approved' })));
  await assertFails(setDoc(doc(lead(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { hospital: '' })));
  await assertFails(setDoc(doc(lead(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { email: 'someone@else.net' })));
  await assertFails(setDoc(doc(lead(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { decidedAtIso: '2026-10-30' })));
  await assertFails(setDoc(doc(lead(), 'roleRequests/lead_trainee'), details('lead', 'trainee')));
  await assertFails(setDoc(doc(stranger(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead')));
  await assertFails(setDoc(doc(lead(), 'roleRequests/lead_supervisor'), details('lead', 'qip_lead')));
});

test('only the admin lists, approves and rejects requests; others cannot read them', async () => {
  await seed('roleRequests/lead_qip_lead', details('lead', 'qip_lead'));
  await assertFails(getDocs(collection(lead(), 'roleRequests')));
  await assertFails(getDoc(doc(stranger(), 'roleRequests/lead_qip_lead')));
  await assertSucceeds(getDocs(collection(admin(), 'roleRequests')));
  await assertSucceeds(setDoc(doc(admin(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { status: 'rejected', decidedAtIso: '2026-10-30T09:00:00Z', decidedByEmail: ADMIN })));
  await assertSucceeds(setDoc(doc(admin(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { status: 'approved', decidedAtIso: '2026-10-30T09:00:00Z', decidedByEmail: ADMIN })));
  // An old claim with no details can still be rejected.
  await assertSucceeds(setDoc(doc(admin(), 'roleRequests/old_qip_lead'), { uid: 'old', role: 'qip_lead', email: 'old@nhs.net', fullName: '', status: 'rejected', decidedAtIso: '2026-10-30T09:00:00Z', decidedByEmail: ADMIN }));
  await assertFails(setDoc(doc(admin(), 'roleRequests/old_qip_lead'), { uid: 'old', role: 'qip_lead', status: 'deleted' }));
  await assertFails(setDoc(doc(stranger(), 'roleRequests/lead_qip_lead'), details('lead', 'qip_lead', { status: 'rejected' })));
  await assertSucceeds(addDoc(collection(admin(), 'roleAuditLog'), { uid: 'lead', email: 'lead@nhs.net', displayName: 'Dr L', role: 'qip_lead', action: 'rejected', source: 'admin', createdAtIso: '2026-10-30T09:00:00Z', createdAt: serverTimestamp() }));
});

// ---- stress test 6 Nov 2026 ---------------------------------------------------------------------
test('an unproved (email + password, not yet verified) address is not the admin or a supervisor', async () => {
  await seed(PROJECT, project);
  await seed('supervisorInvites/sup@nhs.net/invites/trainee_p1', invite('sup@nhs.net'));
  const fakeAdmin = as('attacker', ADMIN, false);
  await assertFails(getDocs(collectionGroup(fakeAdmin, 'projects')));
  await assertFails(setDoc(doc(fakeAdmin, 'deptQIPLeads/attacker'), { email: 'a@a.net', approvedAt: '2026-11-06' }));
  const fakeSup = as('attacker2', 'sup@nhs.net', false);
  await assertFails(getDocs(collection(fakeSup, 'supervisorInvites/sup@nhs.net/invites')));
  await assertFails(setDoc(doc(fakeSup, PROJECT), { assessment: { signedOff: true, signedOffBy: 'Dr Fake' } }, { merge: true }));
  // Once proved, the same address works.
  await assertSucceeds(getDocs(collection(sup(), 'supervisorInvites/sup@nhs.net/invites')));
});

test('a trainee cannot sign off (or un-sign) their own project, but still saves everything else', async () => {
  await seed(PROJECT, { ...project, assessment: { traineeSeenAt: '2026-10-01', signedOff: false, signedOffBy: '', supervisorComments: '' } });
  await assertFails(setDoc(doc(trainee(), PROJECT), { assessment: { signedOff: true, signedOffBy: 'Dr Real Consultant' } }, { merge: true }));
  await assertFails(setDoc(doc(trainee(), PROJECT), { assessment: { supervisorComments: 'Excellent' } }, { merge: true }));
  await assertSucceeds(setDoc(doc(trainee(), PROJECT), { meta: { title: 'Renamed' }, assessment: { traineeSeenAt: '2026-11-06' } }, { merge: true }));
  // A full rewrite (restore from backup) must carry the sign-off over unchanged.
  await assertSucceeds(setDoc(doc(trainee(), PROJECT), { meta: { title: 'Restored' }, assessment: { traineeSeenAt: 'x', signedOff: false, signedOffBy: '', supervisorComments: '' } }));
  await assertFails(setDoc(doc(trainee(), PROJECT), { meta: { title: 'Restored' } }));
  // Signed off by the supervisor: the trainee can't undo it either.
  await seed('supervisorInvites/sup@nhs.net/invites/trainee_p1', invite('sup@nhs.net'));
  await assertSucceeds(setDoc(doc(sup(), PROJECT), { assessment: { signedOff: true, signedOffBy: 'Dr S' } }, { merge: true }));
  await assertFails(setDoc(doc(trainee(), PROJECT), { assessment: { signedOff: false } }, { merge: true }));
  // New projects can't start signed off; a normal new project can.
  await assertFails(setDoc(doc(trainee(), 'users/trainee/projects/p2'), { meta: { title: 'x' }, assessment: { signedOff: true } }));
  await assertSucceeds(setDoc(doc(trainee(), 'users/trainee/projects/p3'), { meta: { title: 'x' }, assessment: { signedOff: false, signedOffBy: '', supervisorComments: '' } }));
  await assertSucceeds(deleteDoc(doc(trainee(), 'users/trainee/projects/p3')));
});

test('a trainee who invites their own address as supervisor still cannot sign off', async () => {
  await seed(PROJECT, project);
  await seed('supervisorInvites/trainee@nhs.net/invites/trainee_p1', invite('trainee@nhs.net'));
  await assertFails(setDoc(doc(trainee(), PROJECT), { assessment: { signedOff: true } }, { merge: true }));
});

test('only the admin can write approval entries in the role audit log', async () => {
  await assertFails(addDoc(collection(stranger(), 'roleAuditLog'), { uid: 'stranger', role: 'qip_lead', action: 'approved', source: 'admin' }));
  await assertFails(addDoc(collection(stranger(), 'roleAuditLog'), { uid: 'stranger', role: 'qip_lead', action: 'added', source: 'admin' }));
  await assertSucceeds(addDoc(collection(stranger(), 'roleAuditLog'), { uid: 'stranger', role: 'qip_lead', action: 'added', source: 'settings' }));
  await assertSucceeds(addDoc(collection(admin(), 'roleAuditLog'), { uid: 'lead', role: 'qip_lead', action: 'approved', source: 'admin' }));
});
