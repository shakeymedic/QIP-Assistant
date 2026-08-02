// measures.js — Multi-measure management
// Lets a project track several independent measures (e.g. "Time to Kit"
// AND "Knowledge Assessment Score"), each with its own data points, chart
// mode, and settings. d.chartData / d.chartSettings are kept as live
// references to whichever measure is currently active, so all existing
// chart-rendering, QIAT-scoring, and export code keeps working unmodified.

import { state } from "./state.js";
import { showToast, showInputModal, showConfirmDialog } from "./utils.js";

function genMeasureId() {
    return 'measure_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// Measure-type options drive smarter default chart modes and let the SPC
// proportion caveat be surfaced proactively instead of only living inside
// the (easily-missed) chart guidance panel. Measure-role options link a
// tracked data series back to the checklist's narrative Outcome/Process/
// Balancing measure definitions so the app can flag when a defined role
// has no data behind it yet.
export const MEASURE_TYPE_OPTIONS = [
    { value: '', label: 'Not set / not sure' },
    { value: 'proportion', label: 'Proportion / percentage (e.g. % compliance)' },
    { value: 'continuous', label: 'Continuous / time-based (e.g. minutes, seconds)' },
    { value: 'count', label: 'Count (e.g. number of errors, incidents)' },
    { value: 'score', label: 'Score (e.g. knowledge assessment /10)' },
    { value: 'categorical', label: 'Categorical / nominal (e.g. tool type used)' }
];
export const MEASURE_ROLE_OPTIONS = [
    { value: '', label: 'Not linked to a role' },
    { value: 'outcome', label: 'Outcome measure' },
    { value: 'process', label: 'Process measure' },
    { value: 'balance', label: 'Balancing measure' }
];
function defaultChartModeForType(type) {
    return type === 'categorical' ? 'pareto' : 'run';
}

// Re-point d.chartData / d.chartSettings at whichever measure is active.
export function syncActiveMeasureRefs() {
    const d = state.projectData;
    if (!d || !Array.isArray(d.measures) || d.measures.length === 0) return;
    const active = d.measures.find(m => m.id === d.activeMeasureId) || d.measures[0];
    d.activeMeasureId = active.id;
    if (!Array.isArray(active.chartData)) active.chartData = [];
    if (!active.chartSettings || typeof active.chartSettings !== 'object') {
        active.chartSettings = { mode: 'run', showMedian: true, showMean: false, ucl: null, lcl: null, title: '', yAxisLabel: '', showAnnotations: true };
    }
    d.chartData = active.chartData;
    d.chartSettings = active.chartSettings;
}

export function getActiveMeasure() {
    const d = state.projectData;
    if (!d || !Array.isArray(d.measures)) return null;
    return d.measures.find(m => m.id === d.activeMeasureId) || d.measures[0] || null;
}

function refreshUI() {
    if (window.saveData) window.saveData();
    if (window.R && window.R.renderDataView) window.R.renderDataView();
    else if (window.renderDataView) window.renderDataView();
    if (window.renderChart) window.renderChart();
    if (window.renderMeasureTabs) window.renderMeasureTabs();
}

export function switchMeasure(measureId) {
    const d = state.projectData;
    if (!d || !Array.isArray(d.measures)) return;
    const m = d.measures.find(x => x.id === measureId);
    if (!m) return;
    d.activeMeasureId = m.id;
    syncActiveMeasureRefs();
    refreshUI();
}

export function addMeasure() {
    const d = state.projectData;
    if (!d) return;
    if (state.isReadOnly) { showToast('Read-only view: cannot add measures', 'error'); return; }
    if (!Array.isArray(d.measures)) d.measures = [];
    window.showInputModal('Add New Measure', [
        { id: 'name', label: 'Measure Name', placeholder: 'e.g. Knowledge Assessment Score', required: true },
        { id: 'unit', label: 'Unit (optional)', placeholder: 'e.g. %, seconds, score/10' },
        { id: 'measureType', label: 'What kind of data is this?', type: 'select', options: MEASURE_TYPE_OPTIONS, hint: 'Helps pick a sensible default chart and surface the right statistical caveats.' },
        { id: 'role', label: 'Which family-of-measures role is this?', type: 'select', options: MEASURE_ROLE_OPTIONS, hint: 'Links this tracked data back to your Outcome/Process/Balancing definitions on the Checklist page.' }
    ], (values) => {
        if (!values.name || !values.name.trim()) { showToast('Measure name is required', 'error'); return; }
        const mode = defaultChartModeForType(values.measureType);
        const newMeasure = {
            id: genMeasureId(),
            name: values.name.trim(),
            unit: (values.unit || '').trim(),
            measureType: values.measureType || '',
            role: values.role || '',
            chartData: [],
            chartSettings: {
                mode, showMedian: true, showMean: false, ucl: null, lcl: null,
                title: values.name.trim(), yAxisLabel: values.unit || '', showAnnotations: true
            }
        };
        d.measures.push(newMeasure);
        d.activeMeasureId = newMeasure.id;
        syncActiveMeasureRefs();
        refreshUI();
        showToast('Measure added: ' + newMeasure.name, 'success');
        if (values.measureType === 'proportion') {
            showToast('Proportion/% measures need a p-chart for exact SPC maths — see the SPC guidance panel on the Data page for the caveat.', 'info');
        }
    }, 'Add Measure');
}

export function renameMeasure(measureId) {
    const d = state.projectData;
    if (state.isReadOnly) { showToast('Read-only view: cannot rename measures', 'error'); return; }
    const m = d && Array.isArray(d.measures) ? d.measures.find(x => x.id === measureId) : null;
    if (!m) return;
    window.showInputModal('Rename Measure', [
        { id: 'name', label: 'Measure Name', value: m.name, required: true },
        { id: 'unit', label: 'Unit (optional)', value: m.unit || '' },
        { id: 'measureType', label: 'What kind of data is this?', type: 'select', options: MEASURE_TYPE_OPTIONS, value: m.measureType || '' },
        { id: 'role', label: 'Which family-of-measures role is this?', type: 'select', options: MEASURE_ROLE_OPTIONS, value: m.role || '' }
    ], (values) => {
        if (!values.name || !values.name.trim()) { showToast('Measure name is required', 'error'); return; }
        m.name = values.name.trim();
        m.unit = (values.unit || '').trim();
        m.measureType = values.measureType || '';
        m.role = values.role || '';
        refreshUI();
        showToast('Measure updated', 'success');
        if (values.measureType === 'proportion') {
            showToast('Reminder: proportion/% measures need a p-chart for exact SPC maths — see the SPC guidance panel.', 'info');
        }
    }, 'Save');
}

export function deleteMeasure(measureId) {
    const d = state.projectData;
    if (state.isReadOnly) { showToast('Read-only view: cannot delete measures', 'error'); return; }
    if (!d || !Array.isArray(d.measures) || d.measures.length <= 1) {
        showToast('You must keep at least one measure', 'error');
        return;
    }
    const m = d.measures.find(x => x.id === measureId);
    if (!m) return;
    const count = Array.isArray(m.chartData) ? m.chartData.length : 0;
    window.showConfirmDialog(
        `Delete measure "${m.name}"? This will permanently remove ${count} data point(s). This cannot be undone.`,
        () => {
            d.measures = d.measures.filter(x => x.id !== measureId);
            if (d.activeMeasureId === measureId) {
                d.activeMeasureId = d.measures[0].id;
            }
            syncActiveMeasureRefs();
            refreshUI();
            showToast('Measure deleted', 'success');
        },
        'Delete Measure',
        'Delete Measure'
    );
}

window.addMeasure = addMeasure;
window.switchMeasure = switchMeasure;
window.renameMeasure = renameMeasure;
window.deleteMeasure = deleteMeasure;
window.getActiveMeasure = getActiveMeasure;
window.syncActiveMeasureRefs = syncActiveMeasureRefs;
window.MEASURE_TYPE_OPTIONS = MEASURE_TYPE_OPTIONS;
window.MEASURE_ROLE_OPTIONS = MEASURE_ROLE_OPTIONS;

// Returns, for each family-of-measures role, whether at least one tracked
// measure is linked to it and whether that measure has any data points yet.
// Used to nudge users on the Checklist page when a narrative Outcome/
// Process/Balancing definition has no tracked data behind it.
export function getMeasureRoleCoverage() {
    const d = state.projectData;
    const measures = (d && Array.isArray(d.measures)) ? d.measures : [];
    const roles = ['outcome', 'process', 'balance'];
    const coverage = {};
    roles.forEach(role => {
        const linked = measures.filter(m => m.role === role);
        const withData = linked.filter(m => Array.isArray(m.chartData) && m.chartData.length > 0);
        coverage[role] = {
            linkedCount: linked.length,
            hasData: withData.length > 0,
            names: linked.map(m => m.name)
        };
    });
    return coverage;
}
window.getMeasureRoleCoverage = getMeasureRoleCoverage;
