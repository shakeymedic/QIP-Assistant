// data-entry.js — getting data into a chart quickly and fixing it easily.
//
// - "Add a point": one date/value/phase/note at a time; Enter adds it and
//   keeps the date and phase ready for the next one.
// - "Paste / import": paste columns from Excel/Sheets or pick a CSV/TSV file,
//   see exactly what will be added (and what couldn't be read) before adding.
// - Data table: every point, newest first, editable in place.
//
// Works on d.chartData, which measures.js keeps pointing at the active
// measure's array, so every change is made in place (never reassigned).

import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { normaliseDateInput, parseNumericInput, parseTabularData, formatUkDate, withUnit } from "./project-metrics.js";

const STANDARD_PHASES = ['Baseline', 'PDSA 1', 'PDSA 2', 'PDSA 3', 'PDSA 4', 'PDSA 5', 'PDSA 6', 'Sustain'];
const TABLE_PAGE = 12;
let showAllRows = false;
let editingId = null;
let pastePreview = null;

function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function points() {
    const d = state.projectData;
    if (!Array.isArray(d.chartData)) d.chartData = [];
    return d.chartData;
}

// Older data (and some imports) has no ids, which made those points
// impossible to delete. Give every point one.
export function ensurePointIds(list) {
    (list || []).forEach(p => { if (p && !p.id) p.id = newId(); });
}

function activeUnit() {
    const m = window.getActiveMeasure ? window.getActiveMeasure() : null;
    return (m && m.unit) ? m.unit.trim() : '';
}

function commit(message) {
    points().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (window.saveData) window.saveData();
    if (window.renderDataView) window.renderDataView();
    if (message) showToast(message, 'success');
}

function blockedIfReadOnly() {
    if (!state.isReadOnly) return false;
    showToast("You're viewing this project read-only — data can't be changed here.", 'info');
    return true;
}

function flagInvalid(el, bad) {
    if (!el) return;
    el.classList.toggle('ring-2', bad);
    el.classList.toggle('ring-red-400', bad);
    el.classList.toggle('border-red-400', bad);
    if (bad) el.focus();
}

// Phases already used in this measure (in date order), then the standard set.
export function knownPhases() {
    const seen = [];
    [...points()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .forEach(p => { const g = (p.grade || '').trim(); if (g && !seen.includes(g)) seen.push(g); });
    STANDARD_PHASES.forEach(g => { if (!seen.includes(g)) seen.push(g); });
    return seen;
}

function lastUsedPhase() {
    const pts = [...points()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (let i = pts.length - 1; i >= 0; i--) if (pts[i].grade) return pts[i].grade;
    return '';
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function setDataEntryTab(tab) {
    ['single', 'paste'].forEach(t => {
        const panel = document.getElementById(`entry-panel-${t}`);
        const btn = document.getElementById(`entry-tab-${t}`);
        const on = t === tab;
        if (panel) panel.classList.toggle('hidden', !on);
        if (btn) {
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
            btn.classList.toggle('text-rcem-purple', on);
            btn.classList.toggle('border-rcem-purple', on);
            btn.classList.toggle('text-slate-500', !on);
            btn.classList.toggle('border-transparent', !on);
        }
    });
    document.getElementById('data-entry-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Keeps the entry form in step with the active measure.
export function refreshEntryForm() {
    const dateEl = document.getElementById('chart-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    const phaseEl = document.getElementById('chart-grade');
    if (phaseEl && !phaseEl.value) phaseEl.value = lastUsedPhase();
    const list = document.getElementById('phase-options');
    if (list) list.innerHTML = knownPhases().map(g => `<option value="${escapeHtml(g)}"></option>`).join('');
    const unitEl = document.getElementById('chart-value-unit');
    if (unitEl) {
        const u = activeUnit();
        unitEl.textContent = u;
        unitEl.classList.toggle('hidden', !u);
    }
}

// ── Single point ─────────────────────────────────────────────────────────────

export function addDataPoint() {
    if (!state.projectData || blockedIfReadOnly()) return;
    const dateEl = document.getElementById('chart-date');
    const valueEl = document.getElementById('chart-value');
    const phaseEl = document.getElementById('chart-grade');
    const noteEl = document.getElementById('chart-note');

    const date = normaliseDateInput(dateEl ? dateEl.value : '');
    const value = parseNumericInput(valueEl ? valueEl.value : '');
    flagInvalid(dateEl, !date);
    if (!date) { showToast('Please enter a valid date', 'error'); return; }
    flagInvalid(valueEl, isNaN(value));
    if (isNaN(value)) { showToast('Please enter a number for the value', 'error'); return; }

    const point = { id: newId(), date, value, grade: (phaseEl?.value || '').trim(), note: (noteEl?.value || '').trim() };
    points().push(point);

    if (valueEl) valueEl.value = '';
    if (noteEl) noteEl.value = '';
    const n = points().length;
    commit(`Added ${withUnit(value, activeUnit(), 6)} on ${formatUkDate(date)} — ${n} point${n !== 1 ? 's' : ''}`);
    if (date > new Date().toISOString().slice(0, 10)) showToast('Heads up: that date is in the future.', 'warning');
    document.getElementById('chart-value')?.focus();
}

export function onEntryKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); addDataPoint(); }
}

export function deleteDataPoint(id) {
    if (blockedIfReadOnly()) return;
    const pts = points();
    const p = pts.find(x => x.id === id);
    if (!p) return;
    window.showConfirmDialog(`Delete the point for ${formatUkDate(p.date)} (${withUnit(Number(p.value), activeUnit(), 6)})?`, () => {
        const idx = pts.indexOf(p);
        if (idx > -1) pts.splice(idx, 1);
        if (editingId === id) editingId = null;
        commit('Data point deleted');
    }, 'Delete', 'Delete Data Point');
}

// ── Paste / import ───────────────────────────────────────────────────────────

export function downloadCSVTemplate() {
    const csv = 'Date,Value,Phase,Note\n'
        + '06/01/2025,312,Baseline,Example: sim run 1\n'
        + '13/01/2025,285,Baseline,\n'
        + '20/01/2025,240,PDSA 1,New kit bag\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qip_data_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A chosen file goes into the paste box so it gets the same preview and
// checks as pasted data, rather than being added blind.
export function importCSV(input) {
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;
    if (blockedIfReadOnly()) { input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        const box = document.getElementById('paste-data');
        if (!box) return;
        box.value = String(e.target.result || '').replace(/^﻿/, '');
        setDataEntryTab('paste');
        previewPastedData();
        showToast(`Loaded ${file.name} — check the preview, then add the points`, 'info');
    };
    reader.onerror = () => showToast("Couldn't read that file", 'error');
    reader.readAsText(file);
    input.value = '';
}

const COLUMN_NAMES = ['Date', 'Value', 'Phase', 'Note'];

export function previewPastedData() {
    const box = document.getElementById('paste-data');
    const out = document.getElementById('paste-preview');
    const btn = document.getElementById('paste-submit');
    if (!box || !out) return;
    const text = box.value;
    if (!text.trim()) {
        pastePreview = null;
        out.innerHTML = '';
        if (btn) { btn.disabled = true; btn.textContent = 'Add points'; }
        return;
    }
    const res = parseTabularData(text);
    const existing = new Set(points().map(p => `${p.date}|${Number(p.value)}`));
    const seenInPaste = new Set();
    const fresh = [];
    let dupes = 0;
    res.rows.forEach(r => {
        const key = `${r.date}|${r.value}`;
        if (existing.has(key) || seenInPaste.has(key)) { dupes++; return; }
        seenInPaste.add(key);
        fresh.push(r);
    });
    pastePreview = { rows: fresh };

    const unit = activeUnit();
    const cols = res.columns || {};
    const colText = ['date', 'value', 'grade', 'note']
        .map((k, i) => cols[k] >= 0 ? `${COLUMN_NAMES[i]} = column ${cols[k] + 1}` : null).filter(Boolean).join(', ');
    const sorted = [...fresh].sort((a, b) => a.date.localeCompare(b.date));
    const range = sorted.length ? `${formatUkDate(sorted[0].date)} – ${formatUkDate(sorted[sorted.length - 1].date)}` : '';
    const shown = sorted.slice(0, 6);

    out.innerHTML = `
        <div class="mt-3 rounded-lg border ${fresh.length ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'} p-3 text-xs">
            <p class="font-bold ${fresh.length ? 'text-emerald-800' : 'text-slate-600'}">
                ${fresh.length ? `Ready to add ${fresh.length} point${fresh.length !== 1 ? 's' : ''}` : 'Nothing new to add yet'}${range ? ` <span class="font-normal text-slate-500">(${range})</span>` : ''}
            </p>
            ${colText ? `<p class="text-slate-500 mt-0.5">Reading ${escapeHtml(colText)}${res.hasHeader ? ' (header row detected)' : ''}. Dates like 05/10/2025 are read as 5 October.</p>` : ''}
            ${shown.length ? `
            <table class="w-full mt-2 text-left">
                <thead><tr class="text-slate-400"><th class="font-medium pb-1">Date</th><th class="font-medium pb-1">Value</th><th class="font-medium pb-1">Phase</th><th class="font-medium pb-1">Note</th></tr></thead>
                <tbody class="text-slate-700">
                    ${shown.map(r => `<tr class="border-t border-emerald-100"><td class="py-1 pr-2 whitespace-nowrap">${escapeHtml(formatUkDate(r.date))}</td><td class="py-1 pr-2 font-bold">${escapeHtml(withUnit(r.value, unit, 6))}</td><td class="py-1 pr-2">${escapeHtml(r.grade || '—')}</td><td class="py-1 truncate max-w-[8rem]" title="${escapeHtml(r.note || '')}">${escapeHtml(r.note || '')}</td></tr>`).join('')}
                </tbody>
            </table>
            ${sorted.length > shown.length ? `<p class="text-slate-400 mt-1">…and ${sorted.length - shown.length} more</p>` : ''}` : ''}
            ${dupes ? `<p class="text-slate-500 mt-2">${dupes} row${dupes !== 1 ? 's' : ''} skipped — already in your data (same date and value).</p>` : ''}
            ${res.errors.length ? `
            <div class="mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                <p class="font-bold">${res.errors.length} row${res.errors.length !== 1 ? 's' : ''} couldn't be read and will be left out:</p>
                <ul class="list-disc ml-4 mt-1">${res.errors.slice(0, 4).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
                ${res.errors.length > 4 ? `<p class="mt-1">…and ${res.errors.length - 4} more</p>` : ''}
            </div>` : ''}
        </div>`;
    if (btn) {
        btn.disabled = fresh.length === 0;
        btn.textContent = fresh.length ? `Add ${fresh.length} point${fresh.length !== 1 ? 's' : ''}` : 'Add points';
    }
}

export function submitPastedData() {
    if (!state.projectData || blockedIfReadOnly()) return;
    if (!pastePreview) previewPastedData();
    const rows = pastePreview ? pastePreview.rows : [];
    if (!rows.length) { showToast('Nothing to add — check the preview', 'error'); return; }
    const pts = points();
    rows.forEach(r => pts.push({ id: newId(), date: r.date, value: r.value, grade: r.grade || '', note: r.note || '' }));
    clearPastedData();
    commit(`Added ${rows.length} point${rows.length !== 1 ? 's' : ''}`);
}

export function clearPastedData() {
    const box = document.getElementById('paste-data');
    if (box) box.value = '';
    previewPastedData();
}

// ── Data table ───────────────────────────────────────────────────────────────

const inputCls = 'w-full p-1 border border-slate-300 rounded text-xs bg-white';

function rowHtml(p, unit, readOnly) {
    const id = escapeHtml(p.id);
    if (p.id === editingId && !readOnly) {
        return `
            <tr class="bg-indigo-50/70" data-id="${id}">
                <td colspan="4" class="p-2">
                    <div class="grid grid-cols-2 gap-1.5">
                        <label class="text-[10px] font-bold uppercase text-slate-500">Date<input type="date" class="edit-date ${inputCls} mt-0.5" value="${escapeHtml(p.date)}"></label>
                        <label class="text-[10px] font-bold uppercase text-slate-500">Value<input type="text" inputmode="decimal" class="edit-value ${inputCls} mt-0.5" value="${escapeHtml(p.value)}"></label>
                        <label class="text-[10px] font-bold uppercase text-slate-500">Phase<input type="text" list="phase-options" class="edit-grade ${inputCls} mt-0.5" value="${escapeHtml(p.grade || '')}"></label>
                        <label class="text-[10px] font-bold uppercase text-slate-500">Note<input type="text" class="edit-note ${inputCls} mt-0.5" value="${escapeHtml(p.note || '')}"></label>
                    </div>
                    <div class="flex justify-end gap-2 mt-2">
                        <button data-action="cancel" class="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1" aria-label="Cancel editing">Cancel</button>
                        <button data-action="save" class="text-xs font-bold bg-rcem-purple text-white px-3 py-1 rounded hover:bg-indigo-800" aria-label="Save changes">Save</button>
                    </div>
                </td>
            </tr>`;
    }
    return `
        <tr class="border-b border-slate-50 hover:bg-slate-50 group" data-id="${id}">
            <td class="py-2 pr-2">
                <div class="whitespace-nowrap">${escapeHtml(formatUkDate(p.date))}</div>
                ${p.note ? `<div class="text-[11px] text-slate-400 truncate max-w-[9rem]" title="${escapeHtml(p.note)}">${escapeHtml(p.note)}</div>` : ''}
            </td>
            <td class="py-2 pr-2 font-bold text-rcem-purple whitespace-nowrap">${escapeHtml(withUnit(Number(p.value), unit, 6))}</td>
            <td class="py-2 pr-1 text-slate-500 truncate max-w-[5.5rem]" title="${escapeHtml(p.grade || '')}">${escapeHtml(p.grade || '—')}</td>
            <td class="py-2 text-right whitespace-nowrap">${readOnly ? '' : `
                <button data-action="edit" class="text-slate-300 group-hover:text-slate-500 hover:!text-rcem-purple p-1" title="Edit" aria-label="Edit data point"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                <button data-action="delete" class="text-slate-300 group-hover:text-slate-500 hover:!text-red-500 p-1" title="Delete" aria-label="Delete data point"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`}
            </td>
        </tr>`;
}

export function renderDataTable() {
    const container = document.getElementById('data-history');
    if (!container || !state.projectData) return;
    const pts = points();
    ensurePointIds(pts);
    const countEl = document.getElementById('data-table-count');
    if (countEl) countEl.textContent = pts.length ? `(${pts.length})` : '';

    if (!pts.length) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 text-sm">No data points yet.${state.isReadOnly ? '' : ' Add one above, or paste a column from Excel.'}</div>`;
        return;
    }
    const unit = activeUnit();
    const readOnly = !!state.isReadOnly;
    const sorted = [...pts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const visible = showAllRows ? sorted : sorted.slice(0, TABLE_PAGE);
    if (editingId && !visible.some(p => p.id === editingId)) {
        const p = sorted.find(x => x.id === editingId);
        if (p) visible.push(p); else editingId = null;
    }
    container.innerHTML = `
        <table class="w-full text-left border-collapse text-xs">
            <thead>
                <tr class="text-[11px] uppercase text-slate-400 border-b border-slate-200">
                    <th class="pb-2 font-semibold">Date</th><th class="pb-2 font-semibold">Value</th><th class="pb-2 font-semibold">Phase</th><th class="pb-2"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody class="text-slate-700">${visible.map(p => rowHtml(p, unit, readOnly)).join('')}</tbody>
        </table>
        ${sorted.length > TABLE_PAGE ? `<button data-action="toggle-all" class="mt-2 w-full text-xs font-bold text-rcem-purple hover:underline py-1">${showAllRows ? 'Show fewer' : `Show all ${sorted.length} points`}</button>` : ''}`;

    if (!container.dataset.bound) {
        container.dataset.bound = '1';
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const id = btn.closest('tr')?.dataset.id;
            const action = btn.dataset.action;
            if (action === 'toggle-all') { showAllRows = !showAllRows; renderDataTable(); }
            else if (action === 'edit') editDataPoint(id);
            else if (action === 'delete') deleteDataPoint(id);
            else if (action === 'save') saveDataPointEdit(id);
            else if (action === 'cancel') cancelDataPointEdit();
        });
        container.addEventListener('keydown', (e) => {
            const row = e.target.closest('tr[data-id]');
            if (!row || !e.target.matches('input')) return;
            if (e.key === 'Enter') { e.preventDefault(); saveDataPointEdit(row.dataset.id); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelDataPointEdit(); }
        });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
}

export function editDataPoint(id) {
    if (blockedIfReadOnly()) return;
    editingId = id;
    renderDataTable();
    document.querySelector(`#data-history tr[data-id] .edit-value`)?.focus();
}

export function cancelDataPointEdit() {
    editingId = null;
    renderDataTable();
}

export function saveDataPointEdit(id) {
    if (blockedIfReadOnly()) return;
    const row = [...document.querySelectorAll('#data-history tr[data-id]')].find(r => r.dataset.id === id);
    const p = points().find(x => x.id === id);
    if (!row || !p) { cancelDataPointEdit(); return; }
    const dateEl = row.querySelector('.edit-date'), valueEl = row.querySelector('.edit-value');
    const date = normaliseDateInput(dateEl.value);
    const value = parseNumericInput(valueEl.value);
    flagInvalid(dateEl, !date);
    if (!date) { showToast('Please enter a valid date', 'error'); return; }
    flagInvalid(valueEl, isNaN(value));
    if (isNaN(value)) { showToast('Please enter a number for the value', 'error'); return; }
    p.date = date;
    p.value = value;
    p.grade = row.querySelector('.edit-grade').value.trim();
    p.note = row.querySelector('.edit-note').value.trim();
    editingId = null;
    commit('Data point updated');
}

window.setDataEntryTab = setDataEntryTab;
window.onDataEntryKey = onEntryKey;
window.previewPastedData = previewPastedData;
window.submitPastedData = submitPastedData;
window.clearPastedData = clearPastedData;
window.renderDataTable = renderDataTable;
window.editDataPoint = editDataPoint;
window.cancelDataPointEdit = cancelDataPointEdit;
window.saveDataPointEdit = saveDataPointEdit;
