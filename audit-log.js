// audit-log.js — lightweight, write-only audit trail.
//
// Two event types are logged:
//   1. Role claims  ("roleAuditLog")   — whenever an account adds/removes the
//      'supervisor' or 'qip_lead' role (self-service, no verification today —
//      see Settings > Roles and the registration screen). Jake asked for this
//      specifically so he can audit who has claimed the Supervisor function.
//   2. Project access ("projectAccessLog") — whenever a Departmental QIP Lead
//      or Clinical Supervisor opens someone else's project via the blanket
//      qip_lead role or a per-project supervisor invite, since that role can
//      see other people's clinical-training data.
//
// Logging is best-effort and MUST NEVER block the action it's attached to —
// every write is wrapped so a permission-denied or offline error only warns
// in the console, it never surfaces to the user or aborts the role/view action.
//
// Firestore security rules needed (add via the Firebase console — this repo
// has no rules file to edit programmatically):
//   match /roleAuditLog/{id}    { allow create: if request.auth != null; allow read: if <isMasterAdmin>; }
//   match /projectAccessLog/{id}{ allow create: if request.auth != null; allow read: if <isMasterAdmin>; }
// (no update/delete for either — it's an append-only audit trail)

export async function logRoleAuditEvent(db, entry) {
    if (!db) return;
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await addDoc(collection(db, 'roleAuditLog'), {
            uid: entry.uid || '',
            email: entry.email || '',
            displayName: entry.displayName || '',
            role: entry.role || '',
            action: entry.action || 'added', // 'added' | 'removed'
            source: entry.source || 'unknown', // 'registration' | 'settings'
            createdAtIso: new Date().toISOString(),
            createdAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn('[Audit] Failed to log role event (check Firestore rules for roleAuditLog):', e);
    }
}

export async function logProjectAccessEvent(db, entry) {
    if (!db) return;
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        await addDoc(collection(db, 'projectAccessLog'), {
            viewerUid: entry.viewerUid || '',
            viewerEmail: entry.viewerEmail || '',
            viaRole: entry.viaRole || '', // 'qip_lead' | 'supervisor'
            ownerUid: entry.ownerUid || '',
            projectId: entry.projectId || '',
            projectTitle: entry.projectTitle || '',
            action: entry.action || 'viewed', // 'viewed' | 'reviewed'
            createdAtIso: new Date().toISOString(),
            createdAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn('[Audit] Failed to log project access event:', e);
    }
}
