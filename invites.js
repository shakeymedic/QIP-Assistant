// invites.js — how a trainee's project reaches its supervisors and QIP leads.
//
// Each invite is its own document:
//   supervisorInvites/{email}/invites/{ownerUid}_{projectId}
//   qipLeadInvites/{email}/invites/{ownerUid}_{projectId}
// The database rules let only the project's owner create or delete one (the
// ID must start with their own account ID), and only the invited email read
// them. The supervisor sign-off rule checks that the supervisor's invite
// exists, so nobody can sign off a project they weren't invited to.
//
// Older invites were one shared list per email ({kind}/{email}.projects),
// which any signed-in account could overwrite. Those lists are still read,
// so existing invites keep working, but nothing writes to them any more;
// an entry from either place only counts while the project itself still
// lists that person (see stillListed).

import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const SUPERVISOR_INVITES = 'supervisorInvites';
export const LEAD_INVITES = 'qipLeadInvites';

const norm = (email) => String(email || '').trim().toLowerCase();
export const inviteId = (ownerUid, projectId) => `${ownerUid}_${projectId}`;

export async function writeInvite(db, kind, email, entry) {
    const e = norm(email);
    await setDoc(doc(db, kind, e, 'invites', inviteId(entry.ownerUid, entry.projectId)), {
        email: e,
        ownerUid: entry.ownerUid,
        projectId: entry.projectId,
        projectTitle: entry.projectTitle || 'Untitled QIP',
        traineeName: entry.traineeName || '',
        traineeEmail: entry.traineeEmail || '',
        addedAt: entry.addedAt || new Date().toISOString()
    }, { merge: true });
}

// Best-effort: a missing invite (e.g. one only in the old list) is not an error.
export async function deleteInvite(db, kind, email, ownerUid, projectId) {
    try {
        await deleteDoc(doc(db, kind, norm(email), 'invites', inviteId(ownerUid, projectId)));
    } catch (e) {
        console.warn(`[Invites] could not remove ${kind} invite:`, e);
    }
}

// Every invite for this email: the per-project documents plus any older list.
export async function readInvites(db, kind, email) {
    const e = norm(email);
    if (!db || !e) return [];
    const out = [];
    try {
        const snap = await getDocs(collection(db, kind, e, 'invites'));
        snap.forEach(d => out.push(d.data()));
    } catch (err) {
        console.warn(`[Invites] could not read ${kind}:`, err);
    }
    try {
        const legacy = await getDoc(doc(db, kind, e));
        if (legacy.exists()) (legacy.data().projects || []).forEach(p => out.push(p));
    } catch (err) { /* older list unreadable — the per-project documents still count */ }
    const seen = new Set();
    return out.filter(p => {
        if (!p || !p.ownerUid || !p.projectId) return false;
        const k = p.ownerUid + '/' + p.projectId;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

// Is this email still on the project's supervisor / QIP lead list?
export function stillListed(projectData, kind, email) {
    const list = (projectData && (kind === SUPERVISOR_INVITES ? projectData.supervisors : projectData.qipLeads)) || [];
    const e = norm(email);
    return list.some(x => norm(x && typeof x === 'object' ? x.email : x) === e);
}

// Owner only: make sure every listed supervisor and QIP lead has a
// per-project invite (moves invites made before this change across, and
// mends any that failed to write). Runs once per project per session.
const synced = new Set();
export async function syncProjectInvites(db, user, projectId, data) {
    if (!db || !user || !projectId || !data) return;
    const key = user.uid + '/' + projectId;
    if (synced.has(key)) return;
    synced.add(key);
    const base = {
        ownerUid: user.uid,
        projectId,
        projectTitle: data.meta?.title || 'Untitled QIP',
        traineeName: user.displayName || user.email || '',
        traineeEmail: user.email || ''
    };
    const jobs = [];
    (data.supervisors || []).forEach(s => {
        const email = norm(s && typeof s === 'object' ? s.email : s);
        if (email) jobs.push(writeInvite(db, SUPERVISOR_INVITES, email, { ...base, addedAt: s.addedAt }));
    });
    (data.qipLeads || []).forEach(l => {
        const email = norm(l && typeof l === 'object' ? l.email : l);
        if (email) jobs.push(writeInvite(db, LEAD_INVITES, email, { ...base, addedAt: l.addedAt }));
    });
    const results = await Promise.allSettled(jobs);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
        synced.delete(key); // try again next time the project is opened
        console.warn('[Invites] some invites could not be written:', failed.map(f => f.reason && f.reason.code));
    }
}
