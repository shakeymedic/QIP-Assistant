// firestore.rules in the real Firestore emulator.
// Run `npm install` then `npm test` in this folder (needs Java 21 for the emulator).
// RULES_FILE=<path> tests another rules file (e.g. a copy of what is live in the console).
// Each test is either something the app really does (so a rule change can't silently
// break it) or an attack from the Firebase security-rules auditor checklist.
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, collectionGroup, getDocs, serverTimestamp } from 'firebase/firestore';

const RULES = fs.readFileSync(process.env.RULES_FILE || new URL('../../firestore.rules', import.meta.url), 'utf8');
const ADMIN = 'emevidence999@gmail.com';
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-qipassist', firestore: { rules: RULES, host: '127.0.0.1', port: 8080 } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid, email) => env.authenticatedContext(uid, { email }).firestore();
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

test('the department-wide view needs the admin or an approved QIP Lead', async () => {
  await seed(PROJECT, project);
  await seed('qipUsers/lead', { email: 'lead@nhs.net', roles: ['qip_lead'] });
  await assertSucceeds(getDocs(collectionGroup(admin(), 'projects')));
  // Claiming the role is not enough...
  await assertFails(getDocs(collectionGroup(lead(), 'projects')));
  // ...approval is.
  await seed('deptQIPLeads/lead', { email: 'lead@nhs.net', approvedAt: '2026-10-29' });
  await assertSucceeds(getDocs(collectionGroup(lead(), 'projects')));
  await assertSucceeds(getDoc(doc(lead(), 'qipUsers/trainee')));
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
