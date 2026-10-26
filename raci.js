// raci.js
// ─── RACI chart: who does what ───────────────────────────────────────────────
// A grid of project tasks (rows) against people (columns). Each cell is one of
// R (Responsible: does the work), A (Accountable: owns it and signs it off),
// C (Consulted: asked before, two-way) or I (Informed: told after, one-way).
//
// Definitions and checks follow the NHS Education for Scotland QI Zone RACI
// page: every task has at least one R and exactly one A; keep C and I
// proportionate; agree it as a team; review it as a living document.
//
// Data: d.raci = { people: [{ id, name, role, memberId? }],
//                  tasks:  [{ id, phase, task, cells: { [personId]: 'R'|'A'|'C'|'I' } }],
//                  agreed: 'YYYY-MM-DD' }
// A person added from the QI team keeps memberId, so a renamed member shows
// their current name here too.

import { state } from "./state.js";
import { showToast, escapeHtml } from "./utils.js";

export const RACI_LETTERS = ['R', 'A', 'C', 'I'];

export const RACI_META = {
    R: { word: 'Responsible', short: 'Does the work', cls: 'bg-indigo-600 text-white border-indigo-600' },
    A: { word: 'Accountable', short: 'Owns it and signs it off (one per task)', cls: 'bg-rose-600 text-white border-rose-600' },
    C: { word: 'Consulted', short: 'Asked for advice before (two-way)', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
    I: { word: 'Informed', short: 'Kept up to date after (one-way)', cls: 'bg-slate-100 text-slate-700 border-slate-300' }
};

export const RACI_PHASES = ['Set up', 'Diagnose', 'Test changes', 'Sustain & share'];

// More than this many Consulted on one task gets a gentle prompt. NES only
// says "use C proportionately"; the number is this app's rule of thumb.
const MAX_CONSULTED = 3;

// ─── Starter tasks ───────────────────────────────────────────────────────────
// The usual steps of a trainee ED QIP. `suggest` maps a role group (see
// roleGroup) to a suggested letter for "Suggest a first draft". These are a
// starting point for the team conversation, not a rule.
const STARTER_TASKS = [
    { phase: 'Set up', task: 'Agree the aim and scope', suggest: { lead: 'R', sponsor: 'A', nurse: 'C', pharm: 'C', patient: 'C', qi: 'I' } },
    { phase: 'Set up', task: 'Register the project with the Trust audit / QI team', suggest: { lead: 'R', sponsor: 'A', qi: 'C' } },
    { phase: 'Set up', task: 'Agree the data plan and collect baseline data', suggest: { lead: 'A', data: 'R', trainee: 'R', nurse: 'C', qi: 'C' } },
    { phase: 'Diagnose', task: 'Run the process mapping / fishbone session', suggest: { lead: 'A', nurse: 'R', trainee: 'R', pharm: 'C', patient: 'C', sponsor: 'I' } },
    { phase: 'Diagnose', task: 'Choose the change ideas to test', suggest: { lead: 'R', sponsor: 'A', nurse: 'C', pharm: 'C', patient: 'C', trainee: 'C' } },
    { phase: 'Test changes', task: 'Plan and run the PDSA cycles', suggest: { lead: 'A', nurse: 'R', trainee: 'R', data: 'C', sponsor: 'I' } },
    { phase: 'Test changes', task: 'Collect and chart the data every week', suggest: { lead: 'A', data: 'R', trainee: 'R', sponsor: 'I', nurse: 'I' } },
    { phase: 'Test changes', task: 'Approve changes to department practice (guideline, PGD, EPR)', suggest: { sponsor: 'A', lead: 'R', pharm: 'C', nurse: 'C', qi: 'I' } },
    { phase: 'Test changes', task: 'Keep the department updated (huddles, newsletter)', suggest: { lead: 'A', nurse: 'R', trainee: 'R', sponsor: 'I' } },
    { phase: 'Sustain & share', task: 'Present the results at ED governance', suggest: { lead: 'R', sponsor: 'A', nurse: 'C', qi: 'I', patient: 'I' } },
    { phase: 'Sustain & share', task: 'Hand over: named owner and sustainability plan', suggest: { lead: 'R', sponsor: 'A', nurse: 'C', trainee: 'C', qi: 'I' } },
    { phase: 'Sustain & share', task: 'Share the project (poster, regional QI day)', suggest: { lead: 'R', sponsor: 'A', trainee: 'R', nurse: 'C', qi: 'I' } }
];

// Sort a person into one rough role group from their role and grade text.
// Order matters: "PGD lead, ED pharmacist" is pharmacy, not the project lead.
export function roleGroup(text) {
    const t = String(text || '').toLowerCase();
    if (/patient|carer|public|lay /.test(t)) return 'patient';
    if (/pharm|pgd/.test(t)) return 'pharm';
    if (/nurs|sister|matron|charge nurse|champion|band \d|\bhca\b|healthcare assistant/.test(t)) return 'nurse';
    if (/data|epr|informatic|analyst|\bit\b/.test(t)) return 'data';
    if (/\bqi\b|improvement team|audit/.test(t)) return 'qi';
    if (/sponsor|consultant|supervisor|clinical lead|clinical director/.test(t)) return 'sponsor';
    if (/project lead|\blead\b|\(you\)/.test(t)) return 'lead';
    if (/trainee|registrar|\bst\d|\bct\d|\bfy\d|accs|doctor|acp|clinical fellow/.test(t)) return 'trainee';
    return '';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix) { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

export function ensureRaci(d) {
    if (!d) return null;
    if (!d.raci || typeof d.raci !== 'object') d.raci = {};
    if (!Array.isArray(d.raci.people)) d.raci.people = [];
    if (!Array.isArray(d.raci.tasks)) d.raci.tasks = [];
    d.raci.tasks.forEach(t => { if (!t.cells || typeof t.cells !== 'object') t.cells = {}; });
    if (typeof d.raci.agreed !== 'string') d.raci.agreed = '';
    return d.raci;
}

// Current display name and role, following the linked team member if any.
export function raciPerson(d, p) {
    const m = p.memberId ? (d.teamMembers || []).find(x => x && String(x.id) === String(p.memberId)) : null;
    return {
        name: (m && m.name) || p.name || 'Unnamed',
        role: (m && [m.role, m.grade].filter(Boolean).join(', ')) || p.role || ''
    };
}

function initials(name) {
    const w = String(name || '').replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return (w.map(x => x[0]).join('').slice(0, 3) || '?').toUpperCase();
}

// Checks from the NES guidance. Returns { rows: {taskId: [msg]}, people: {personId: [msg]}, list: [{level,msg}] }.
export function raciChecks(d) {
    const r = ensureRaci(d);
    const out = { rows: {}, people: {}, list: [] };
    if (!r.tasks.length || !r.people.length) return out;
    const ids = new Set(r.people.map(p => p.id));
    r.tasks.forEach(t => {
        const letters = Object.entries(t.cells).filter(([pid]) => ids.has(pid)).map(([, v]) => v);
        const n = l => letters.filter(x => x === l).length;
        const msgs = [];
        if (n('A') === 0) msgs.push('No one is Accountable');
        if (n('A') > 1) msgs.push(`${n('A')} people are Accountable; keep it to one`);
        if (n('R') === 0) msgs.push('No one is Responsible');
        if (n('C') > MAX_CONSULTED) msgs.push(`${n('C')} people to consult may slow decisions`);
        if (msgs.length) {
            out.rows[t.id] = msgs;
            msgs.forEach(m => out.list.push({ level: /Consult/.test(m) ? 'info' : 'warn', msg: `${t.task || 'Untitled task'}: ${m}` }));
        }
    });
    r.people.forEach(p => {
        const name = raciPerson(d, p).name;
        const mine = r.tasks.map(t => t.cells[p.id]).filter(Boolean);
        if (!mine.length) {
            out.people[p.id] = ['No letters yet'];
            out.list.push({ level: 'info', msg: `${name} has no part in any task yet. Add one, or remove them from the chart.` });
        }
        const rCount = mine.filter(x => x === 'R').length;
        if (r.tasks.length >= 4 && rCount / r.tasks.length > 0.75) {
            out.people[p.id] = (out.people[p.id] || []).concat('Responsible for most tasks');
            out.list.push({ level: 'info', msg: `${name} is Responsible for ${rCount} of ${r.tasks.length} tasks. If they rotate or are off, the project stops; share the doing.` });
        }
    });
    return out;
}

function save(rerender = true) {
    if (window.saveData) window.saveData();
    if (rerender) renderRaci();
}

function canEdit() { return !!state.projectData && !state.isReadOnly; }

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderRaci() {
    const box = document.getElementById('raci-chart');
    const d = state.projectData;
    if (!box || !d) return;
    const r = ensureRaci(d);
    const edit = canEdit();
    const checks = raciChecks(d);
    const team = Array.isArray(d.teamMembers) ? d.teamMembers : [];
    const missing = team.filter(m => m && m.name && !r.people.some(p => p.memberId && String(p.memberId) === String(m.id)));

    const legend = `
        <div class="flex flex-wrap gap-2 text-xs mb-4" aria-label="Key">
            ${RACI_LETTERS.map(l => `
                <span class="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-2.5 py-0.5">
                    <span class="w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center ${RACI_META[l].cls}">${l}</span>
                    <span class="font-semibold text-slate-700">${RACI_META[l].word}</span>
                    <span class="text-slate-500 hidden sm:inline">${RACI_META[l].short}</span>
                </span>`).join('')}
        </div>`;

    const header = `
        <header class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div>
                <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i data-lucide="grid-3x3" class="text-indigo-500"></i> Who does what (RACI chart)
                </h2>
                <p class="text-slate-500 text-sm max-w-2xl">For each task, who does it (R), who owns it and signs it off (A), who you ask first (C) and who you tell (I). Tap a square to change it. Build it with your team: the conversation is where most of the value is.</p>
            </div>
            ${edit ? `
            <div class="flex flex-wrap gap-2 flex-shrink-0">
                ${!r.tasks.length ? `<button onclick="window.raciAddStarterTasks()" class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded text-sm flex items-center gap-1"><i data-lucide="wand-2" class="w-4 h-4"></i> Usual QIP tasks</button>` : ''}
                <button onclick="window.raciAddTask()" class="bg-rcem-purple text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"><i data-lucide="plus" class="w-4 h-4"></i> Task</button>
                <button onclick="window.raciAddPerson()" class="bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-sm flex items-center gap-1"><i data-lucide="user-plus" class="w-4 h-4"></i> Person</button>
            </div>` : ''}
        </header>`;

    const prompts = [];
    if (edit && missing.length) {
        prompts.push(`<button onclick="window.raciAddTeam()" class="text-left w-full sm:w-auto bg-pink-50 border border-pink-200 text-pink-800 rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i data-lucide="users-2" class="w-4 h-4 flex-shrink-0"></i> Add ${missing.length === team.length ? 'your QI team' : `${missing.length} more team member${missing.length > 1 ? 's' : ''}`} as columns</button>`);
    }
    if (edit && r.tasks.length && r.people.length) {
        prompts.push(`<button onclick="window.raciSuggest()" class="text-left w-full sm:w-auto bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-3 py-2 text-sm flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4 flex-shrink-0"></i> Suggest a first draft for empty squares</button>`);
    }

    let body;
    if (!r.tasks.length && !r.people.length) {
        body = `
            <div class="bg-slate-50 rounded-xl p-6 text-center">
                <i data-lucide="grid-3x3" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                <p class="text-slate-500 text-sm">No RACI chart yet.${edit ? ' Start with the usual QIP tasks and your QI team, then change anything that does not fit.' : ''}</p>
                ${edit ? `<button onclick="window.raciQuickStart()" class="mt-3 bg-rcem-purple text-white px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"><i data-lucide="wand-2" class="w-4 h-4"></i> Start my RACI chart</button>` : ''}
            </div>`;
    } else {
        body = raciTableHTML(d, { edit, checks });
    }

    const checkList = checks.list.length ? `
        <div class="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div class="font-bold text-amber-900 text-sm mb-2 flex items-center gap-2"><i data-lucide="list-checks" class="w-4 h-4"></i> Checks</div>
            <ul class="space-y-1 text-xs text-amber-900">
                ${checks.list.map(c => `<li class="flex gap-2"><span aria-hidden="true">${c.level === 'warn' ? '⚠' : 'ℹ'}</span><span>${escapeHtml(c.msg)}</span></li>`).join('')}
            </ul>
        </div>` : (r.tasks.length && r.people.length ? `
        <div class="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2"><i data-lucide="check-circle-2" class="w-4 h-4"></i> Every task has one Accountable and at least one Responsible.</div>` : '');

    const agreed = (r.tasks.length && r.people.length) ? `
        <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
            <label for="raci-agreed" class="text-slate-600 font-medium">Last agreed with the team</label>
            <input id="raci-agreed" type="date" value="${escapeHtml(r.agreed)}" ${edit ? '' : 'disabled'} onchange="window.raciSetAgreed(this.value)" class="border border-slate-300 rounded-lg px-2 py-1 text-sm w-full sm:w-auto">
            <span class="text-xs text-slate-500">Look at it again when someone joins or leaves, or the scope changes.</span>
        </div>` : '';

    box.innerHTML = `
        <div class="mt-10">
            ${header}
            ${legend}
            ${prompts.length ? `<div class="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">${prompts.join('')}</div>` : ''}
            ${body}
            ${checkList}
            ${agreed}
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// The grid itself; also used read-only by the Whole Project View.
export function raciTableHTML(d, { edit = false, checks = null, compact = false } = {}) {
    const r = ensureRaci(d);
    checks = checks || raciChecks(d);
    if (!r.tasks.length || !r.people.length) {
        return `<p class="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">${!r.people.length ? 'Add the people involved as columns.' : 'Add the tasks as rows.'}</p>`;
    }
    const people = r.people.map(p => ({ ...p, ...raciPerson(d, p) }));
    const taskW = compact ? 'w-40 sm:w-56' : 'w-36 sm:w-60';
    const cellSize = compact ? 'w-7 h-7 text-[11px]' : 'w-10 h-10 text-sm';
    const phases = RACI_PHASES.concat(r.tasks.map(t => t.phase).filter(p => p && !RACI_PHASES.includes(p)));
    const groups = [...new Set(phases)].map(ph => ({ ph, tasks: r.tasks.filter(t => (t.phase || 'Set up') === ph || (!t.phase && ph === 'Set up')) })).filter(g => g.tasks.length);

    const head = `
        <tr>
            <th scope="col" class="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase"><div class="${taskW}">Task</div></th>
            ${people.map((p, i) => `
                <th scope="col" class="px-1 py-2 text-center align-bottom"><div class="w-14 sm:w-20 mx-auto">
                    ${edit ? `<button onclick="window.raciEditPerson(${i})" class="group w-full" title="Edit or remove ${escapeHtml(p.name)}" aria-label="Edit or remove ${escapeHtml(p.name)}">` : '<div>'}
                        <div class="mx-auto w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white flex items-center justify-center font-bold text-[11px] ${checks.people[p.id] ? 'ring-2 ring-amber-400' : ''}">${escapeHtml(initials(p.name))}</div>
                        <div class="text-[11px] font-semibold text-slate-700 leading-tight mt-1 break-words ${edit ? 'group-hover:text-rcem-purple' : ''}">${escapeHtml(p.name)}</div>
                        ${p.role && !compact ? `<div class="text-[10px] text-slate-400 leading-tight break-words">${escapeHtml(p.role)}</div>` : ''}
                    ${edit ? '</button>' : '</div>'}
                </div></th>`).join('')}
        </tr>`;

    const rows = groups.map(g => `
        <tr><th colspan="${people.length + 1}" scope="colgroup" class="sticky left-0 bg-indigo-50 text-indigo-800 text-[11px] font-bold uppercase tracking-wide text-left px-3 py-1">${escapeHtml(g.ph)}</th></tr>
        ${g.tasks.map(t => {
            const ti = r.tasks.indexOf(t);
            const warn = checks.rows[t.id];
            return `
            <tr class="${warn && warn.some(m => !/Consult/.test(m)) ? 'bg-amber-50/60' : ''}">
                <th scope="row" class="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal align-middle border-r border-slate-100">
                    <div class="flex items-start gap-1.5 ${taskW}">
                        <div class="flex-1 min-w-0">
                            <div class="text-sm text-slate-800 leading-snug">${escapeHtml(t.task || 'Untitled task')}</div>
                            ${warn ? `<div class="text-[11px] text-amber-700 leading-snug mt-0.5">${warn.map(escapeHtml).join(' · ')}</div>` : ''}
                        </div>
                        ${edit ? `<button onclick="window.raciEditTask(${ti})" class="text-slate-300 hover:text-indigo-500 flex-shrink-0 p-1" title="Edit or remove task" aria-label="Edit or remove task: ${escapeHtml(t.task || '')}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>` : ''}
                    </div>
                </th>
                ${people.map(p => {
                    const v = t.cells[p.id] || '';
                    const meta = RACI_META[v];
                    const label = `${t.task || 'Task'}, ${p.name}: ${meta ? meta.word : 'no role'}`;
                    const cls = `${cellSize} rounded-lg border font-bold flex items-center justify-center mx-auto ${meta ? meta.cls : 'bg-white border-dashed border-slate-200 text-slate-300'}`;
                    return `<td class="px-1 py-1.5 text-center">${edit
                        ? `<button onclick="window.raciCycle(${ti}, '${escapeHtml(p.id)}')" data-raci-cell="${ti}:${escapeHtml(p.id)}" class="${cls} hover:ring-2 hover:ring-indigo-300" aria-label="${escapeHtml(label)}. Tap to change." title="${escapeHtml(label)}">${v || '·'}</button>`
                        : `<span class="${cls}" title="${escapeHtml(label)}">${v ? v : '<span class="sr-only">none</span>'}</span>`}</td>`;
                }).join('')}
            </tr>`;
        }).join('')}
    `).join('');

    return `
        <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white">
            <table class="w-full border-collapse min-w-max">
                <caption class="sr-only">RACI chart: tasks against people. R Responsible, A Accountable, C Consulted, I Informed.</caption>
                <thead class="bg-slate-50 border-b border-slate-200">${head}</thead>
                <tbody class="divide-y divide-slate-100">${rows}</tbody>
            </table>
        </div>`;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

window.raciCycle = function(ti, pid) {
    if (!canEdit()) return;
    const r = ensureRaci(state.projectData);
    const t = r.tasks[ti];
    if (!t) return;
    const order = ['', ...RACI_LETTERS];
    const next = order[(order.indexOf(t.cells[pid] || '') + 1) % order.length];
    if (next) t.cells[pid] = next; else delete t.cells[pid];
    save();
    // Keep keyboard focus on the same square after the re-render
    const btn = document.querySelector(`#raci-chart button[data-raci-cell="${ti}:${pid}"]`);
    if (btn) btn.focus();
};

function addTeamMembers(d, r) {
    let n = 0;
    (d.teamMembers || []).forEach(m => {
        if (!m || !m.name) return;
        if (r.people.some(p => p.memberId && String(p.memberId) === String(m.id))) return;
        r.people.push({ id: uid('rp'), memberId: String(m.id), name: m.name, role: [m.role, m.grade].filter(Boolean).join(', ') });
        n++;
    });
    return n;
}

function addStarterTasks(r) {
    const have = new Set(r.tasks.map(t => (t.task || '').trim().toLowerCase()));
    let n = 0;
    STARTER_TASKS.forEach(s => {
        if (have.has(s.task.toLowerCase())) return;
        r.tasks.push({ id: uid('rt'), phase: s.phase, task: s.task, cells: {} });
        n++;
    });
    return n;
}

window.raciAddTeam = function() {
    if (!canEdit()) return;
    const d = state.projectData, r = ensureRaci(d);
    const n = addTeamMembers(d, r);
    if (!n) { showToast(d.teamMembers?.length ? 'Your QI team is already on the chart' : 'Add your QI team above first', 'info'); return; }
    save();
    showToast(`${n} team member${n > 1 ? 's' : ''} added as columns`, 'success');
};

window.raciAddStarterTasks = function() {
    if (!canEdit()) return;
    const r = ensureRaci(state.projectData);
    const n = addStarterTasks(r);
    if (!n) { showToast('The usual QIP tasks are already on the chart', 'info'); return; }
    save();
    showToast(`${n} usual QIP tasks added; rename or delete any that do not fit`, 'success');
};

window.raciQuickStart = function() {
    if (!canEdit()) return;
    const d = state.projectData, r = ensureRaci(d);
    const tasks = addStarterTasks(r);
    const people = addTeamMembers(d, r);
    save();
    showToast(people
        ? `${tasks} tasks and ${people} people added. Try "Suggest a first draft", then go through it with your team.`
        : `${tasks} tasks added. Add your QI team above (or tap Person) to fill in the columns.`, 'success');
};

// Fills empty squares only, from each person's role. One A per task at most.
window.raciSuggest = function() {
    if (!canEdit()) return;
    const d = state.projectData, r = ensureRaci(d);
    const people = r.people.map(p => ({ id: p.id, group: roleGroup(raciPerson(d, p).role + ' ' + raciPerson(d, p).name) }));
    if (!people.some(p => p.group)) {
        showToast('Could not tell anyone\'s role from the team list. Add roles such as "Project lead" or "Consultant sponsor" on the team cards, or fill the squares by hand.', 'info');
        return;
    }
    let filled = 0;
    r.tasks.forEach(t => {
        const starter = STARTER_TASKS.find(s => s.task.toLowerCase() === (t.task || '').trim().toLowerCase());
        if (!starter) return;
        let hasA = Object.values(t.cells).includes('A');
        people.forEach(p => {
            if (t.cells[p.id] || !p.group) return;
            const l = starter.suggest[p.group];
            if (!l) return;
            if (l === 'A') { if (hasA) return; hasA = true; }
            t.cells[p.id] = l;
            filled++;
        });
    });
    if (!filled) { showToast('Nothing to suggest: the draft only covers the usual QIP tasks and only fills empty squares', 'info'); return; }
    save();
    showToast(`${filled} squares filled from people's roles. This is a draft: check every row with your team.`, 'success');
};

window.raciAddTask = function() {
    if (!canEdit()) return;
    window.showInputModal('Add task', [
        { id: 'task', label: 'Task, decision or milestone', type: 'text', placeholder: 'e.g. Update the sepsis trolley checklist', required: true },
        { id: 'phase', label: 'Stage', type: 'select', value: 'Test changes', options: RACI_PHASES.map(p => ({ value: p, label: p })) }
    ], (data) => {
        const r = ensureRaci(state.projectData);
        r.tasks.push({ id: uid('rt'), phase: data.phase || 'Set up', task: (data.task || '').trim(), cells: {} });
        save();
    }, 'Add task');
};

window.raciEditTask = function(ti) {
    if (!canEdit()) return;
    const r = ensureRaci(state.projectData);
    const t = r.tasks[ti];
    if (!t) return;
    window.showInputModal('Edit task', [
        { id: 'task', label: 'Task, decision or milestone', type: 'text', value: t.task || '', required: true },
        { id: 'phase', label: 'Stage', type: 'select', value: t.phase || 'Set up', options: RACI_PHASES.map(p => ({ value: p, label: p })) },
        { id: 'remove', label: 'Remove this task?', type: 'select', value: 'no', options: [{ value: 'no', label: 'No, keep it' }, { value: 'yes', label: 'Yes, remove it from the chart' }] }
    ], (data) => {
        if (data.remove === 'yes') r.tasks.splice(ti, 1);
        else { t.task = (data.task || '').trim(); t.phase = data.phase || t.phase; }
        save();
    }, 'Save');
};

window.raciAddPerson = function() {
    if (!canEdit()) return;
    const d = state.projectData, r = ensureRaci(d);
    const team = (d.teamMembers || []).filter(m => m && m.name && !r.people.some(p => p.memberId && String(p.memberId) === String(m.id)));
    const stakes = (d.stakeholders || []).filter(s => s && s.name && !r.people.some(p => !p.memberId && (p.name || '').toLowerCase() === s.name.toLowerCase()));
    const options = [{ value: '', label: 'Someone else (type below)' }]
        .concat(team.map(m => ({ value: 'm:' + m.id, label: `QI team: ${m.name}${m.role ? ' (' + m.role + ')' : ''}` })))
        .concat(stakes.map((s, i) => ({ value: 's:' + i, label: `Stakeholder: ${s.name}` })));
    window.showInputModal('Add a person or group', [
        { id: 'pick', label: 'Choose', type: 'select', value: options[1] ? options[1].value : '', options },
        { id: 'name', label: 'Or type a name, role or group', type: 'text', placeholder: 'e.g. ED clinical lead, Medicines committee' },
        { id: 'role', label: 'Role (optional)', type: 'text', placeholder: 'e.g. Approves changes in the department' }
    ], (data) => {
        const typed = (data.name || '').trim();
        if (typed) {
            r.people.push({ id: uid('rp'), name: typed, role: (data.role || '').trim() });
        } else if ((data.pick || '').startsWith('m:')) {
            const m = team.find(x => String(x.id) === data.pick.slice(2));
            if (m) r.people.push({ id: uid('rp'), memberId: String(m.id), name: m.name, role: [m.role, m.grade].filter(Boolean).join(', ') });
        } else if ((data.pick || '').startsWith('s:')) {
            const s = stakes[+data.pick.slice(2)];
            if (s) r.people.push({ id: uid('rp'), name: s.name, role: (data.role || '').trim() || s.role || '' });
        } else {
            showToast('Type a name or choose someone', 'info');
            return;
        }
        save();
    }, 'Add');
};

window.raciEditPerson = function(i) {
    if (!canEdit()) return;
    const d = state.projectData, r = ensureRaci(d);
    const p = r.people[i];
    if (!p) return;
    const shown = raciPerson(d, p);
    const fields = p.memberId ? [] : [
        { id: 'name', label: 'Name, role or group', type: 'text', value: p.name || '', required: true },
        { id: 'role', label: 'Role (optional)', type: 'text', value: p.role || '' }
    ];
    fields.push({ id: 'remove', label: p.memberId ? `${shown.name} is linked to your QI team; edit their name and role on the team card above.` : 'Remove this column?', type: 'select', value: 'no', options: [{ value: 'no', label: 'Keep on the chart' }, { value: 'yes', label: 'Remove from the chart (their letters go too)' }] });
    window.showInputModal(`Edit ${shown.name}`, fields, (data) => {
        if (data.remove === 'yes') {
            r.people.splice(i, 1);
            r.tasks.forEach(t => { delete t.cells[p.id]; });
        } else if (!p.memberId) {
            p.name = (data.name || '').trim() || p.name;
            p.role = (data.role || '').trim();
        }
        save();
    }, 'Save');
};

window.raciSetAgreed = function(v) {
    if (!canEdit()) return;
    ensureRaci(state.projectData).agreed = /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
    save(false);
};

window.renderRaci = renderRaci;
