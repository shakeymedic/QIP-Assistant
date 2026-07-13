// export-center.js — Unified "Export Everything" hub.
// Wires up existing export functions (PDF report, PPTX, QIAT portfolio,
// project JSON backup) plus a new all-measures CSV export into a single
// modal so the user has one place to export in any format they need.

import { state } from "./state.js";
import { showToast } from "./utils.js";

function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

// Exports every data point from every measure (not just the active one)
// into a single CSV file, with a Measure column so data stays separable
// in Excel/Sheets — e.g. "Time to Kit" and "Knowledge Assessment" rows
// side by side in one file.
export function exportAllDataCSV() {
    const d = state.projectData;
    if (!d) { showToast('No project open', 'error'); return; }

    const measures = (Array.isArray(d.measures) && d.measures.length > 0)
        ? d.measures
        : [{ name: 'Primary Outcome Measure', unit: '', chartData: d.chartData || [] }];

    const rows = [['Measure', 'Unit', 'Date', 'Value', 'Phase/Grade', 'Note']];
    measures.forEach(m => {
        const pts = Array.isArray(m.chartData) ? m.chartData : [];
        pts.forEach(pt => {
            rows.push([m.name, m.unit || '', pt.date || '', pt.value ?? '', pt.grade || '', pt.note || '']);
        });
    });

    if (rows.length === 1) { showToast('No data points to export yet', 'error'); return; }

    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    // Prefix with a UTF-8 BOM so Excel on Windows renders £, \u2265/\u2264, and en/em dashes correctly instead of mangling them.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanTitle = (d.meta?.title || 'QIP').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `qip_data_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Data exported as CSV', 'success');
}

export function openExportCenter() {
    const d = state.projectData;
    if (!d) { showToast('Open a project first', 'error'); return; }
    const modal = document.getElementById('export-center-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function closeExportCenter() {
    const modal = document.getElementById('export-center-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.exportAllDataCSV = exportAllDataCSV;
window.openExportCenter = openExportCenter;
window.closeExportCenter = closeExportCenter;
