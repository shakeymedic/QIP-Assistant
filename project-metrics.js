// project-metrics.js
//
// Pure, DOM-free calculations shared by the trainee dashboard, the QIP Lead /
// Supervisor overviews and the charts, so every screen reports the same
// readiness %, the same baseline median and parses dates the same way.

// Primary/first measure's data points — what readiness scoring and reports
// assess, regardless of which measure tab is open in the Data view.
export function primaryChartData(d) {
    if (!d) return [];
    if (Array.isArray(d.measures) && d.measures[0] && Array.isArray(d.measures[0].chartData)) {
        return d.measures[0].chartData;
    }
    return Array.isArray(d.chartData) ? d.chartData : [];
}

export function computeReadiness(d) {
    d = d || {};
    const c = d.checklist || {};
    const pdsa = Array.isArray(d.pdsa) ? d.pdsa : [];
    const isHigher = d.meta?.trainingStage === 'higher';
    const criteria = [
        { label: 'Clear Problem Statement', met: !!c.problem_desc },
        { label: 'SMART Aim', met: !!c.aim },
        { label: 'Measures Defined', met: !!(c.outcome_measure || c.process_measure) },
        { label: 'Driver Diagram', met: (d.drivers?.primary?.length > 0) },
        { label: isHigher ? '3+ PDSA Cycles' : '1+ PDSA Cycle', met: isHigher ? pdsa.length >= 3 : pdsa.length >= 1 },
        { label: 'Data Chart with Analysis', met: (primaryChartData(d).length >= 5 && !!c.results_analysis) },
        { label: 'Learning Reflections', met: !!c.learning_points },
        { label: 'Sustainability Plan', met: !!c.sustainability },
        { label: 'QI Team Defined', met: (d.teamMembers?.length >= 1) },
        { label: 'Stakeholder Map Completed', met: (d.stakeholders?.length >= 1) },
        { label: 'Project Timeline Populated', met: (d.gantt?.length >= 1 || d.timeline?.length >= 1) },
        { label: 'Supervisor Signed Off', met: !!(d.assessment?.signedOffBy) }
    ];
    const metCount = criteria.filter(cr => cr.met).length;
    return { criteria, metCount, total: criteria.length, percent: Math.round((metCount / criteria.length) * 100), isHigher };
}

// Every data point across every measure, for "how much data does this project have".
export function allMeasurePoints(d) {
    if (!d) return [];
    if (Array.isArray(d.measures) && d.measures.length) {
        return d.measures.reduce((acc, m) => acc.concat(Array.isArray(m.chartData) ? m.chartData : []), []);
    }
    return Array.isArray(d.chartData) ? d.chartData : [];
}

// Most recent sign of activity: last save, else newest data point / PDSA / log, else creation.
export function lastActivityDate(d) {
    if (!d) return null;
    const candidates = [d.meta?.updated];
    allMeasurePoints(d).forEach(p => candidates.push(p && p.date));
    (d.pdsa || []).forEach(p => candidates.push(p && (p.startDate || p.start)));
    (d.leadershipLogs || []).forEach(l => candidates.push(l && l.date));
    candidates.push(d.meta?.created);
    let best = null;
    candidates.forEach(v => {
        const t = v ? new Date(v).getTime() : NaN;
        if (!isNaN(t) && t <= Date.now() + 86400000 && (best === null || t > best)) best = t;
    });
    return best === null ? null : new Date(best);
}

export function median(values) {
    const v = (values || []).map(Number).filter(x => !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Chooses the run-chart baseline, in order of preference:
//  1. points tagged with the earliest Phase (e.g. "Baseline") when phases are used,
//  2. points dated before the first PDSA cycle started,
//  3. the classic convention of the first 12 points.
// `points` must already be sorted chronologically. Returns { values, count, source }.
export function chooseBaseline(points, pdsa) {
    const pts = (points || []).filter(p => p && p.value !== null && p.value !== undefined && !isNaN(Number(p.value)));
    if (!pts.length) return { values: [], count: 0, source: 'none' };

    if (pts.some(p => p.grade)) {
        const earliest = {};
        pts.forEach(p => {
            const g = p.grade || 'Ungraded';
            const t = new Date(p.date).getTime() || 0;
            if (!(g in earliest) || t < earliest[g]) earliest[g] = t;
        });
        const first = Object.keys(earliest).sort((a, b) => earliest[a] - earliest[b])[0];
        const values = pts.filter(p => (p.grade || 'Ungraded') === first).map(p => Number(p.value));
        return { values, count: values.length, source: 'phase', phase: first };
    }

    const starts = (pdsa || []).map(p => p && (p.startDate || p.start)).filter(Boolean).sort();
    if (starts.length) {
        const before = pts.filter(p => String(p.date) < starts[0]).map(p => Number(p.value));
        if (before.length >= 2) return { values: before, count: before.length, source: 'pre-pdsa' };
    }

    const values = pts.slice(0, Math.min(12, pts.length)).map(p => Number(p.value));
    return { values, count: values.length, source: 'first-points' };
}

export function baselineMedian(points, pdsa) {
    return median(chooseBaseline(points, pdsa).values);
}

// Parses the date formats clinicians actually paste in from Excel/EPR exports
// and returns an ISO yyyy-mm-dd string, or null. Slash/dot dates are read as
// UK day-first (dd/mm/yyyy) unless the first number can only be a month.
export function normaliseDateInput(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim().replace(/^"|"$/g, '');
    if (!s) return null;
    const pad = n => String(n).padStart(2, '0');
    const valid = (y, m, d) => {
        const dt = new Date(Date.UTC(y, m - 1, d));
        return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    };
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
    if (m) {
        const y = +m[1], mo = +m[2], d = +m[3];
        return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/);
    if (m) {
        let a = +m[1], b = +m[2], y = +m[3];
        if (y < 100) y += 2000;
        let day = a, mo = b;
        if (a <= 12 && b > 12) { day = b; mo = a; }
        return valid(y, mo, day) ? `${y}-${pad(mo)}-${pad(day)}` : null;
    }
    // Excel serial date number (days since 1899-12-30)
    if (/^\d{5}(\.\d+)?$/.test(s)) {
        const n = Math.floor(parseFloat(s));
        if (n > 20000 && n < 80000) {
            const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
            return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
        }
    }
    // Written dates such as "5 Oct 2025", "5-Oct-25" or "Oct 5, 2025"
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const monthNum = (name) => months[String(name).slice(0, 3).toLowerCase()] || null;
    const fullYear = (y) => (+y < 100 ? +y + 2000 : +y);
    m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{2,4})$/);
    if (m && monthNum(m[2])) {
        const y = fullYear(m[3]), mo = monthNum(m[2]), d = +m[1];
        return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/);
    if (m && monthNum(m[1])) {
        const y = fullYear(m[3]), mo = monthNum(m[1]), d = +m[2];
        return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
    return null;
}

// Parses a number the way people type it in the UK: tolerates "85%", "1,234",
// "12.5s" and surrounding whitespace. Returns NaN when there is no number.
export function parseNumericInput(raw) {
    if (raw === null || raw === undefined) return NaN;
    const s = String(raw).trim().replace(/^"|"$/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
    // A number optionally followed by a unit ("85%", "12.5s", "7/10"). Anything
    // else after it (e.g. the decimal comma in "1,05") makes it unreadable
    // rather than silently taking the first part.
    const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(%|[a-z]+\.?|\/\s*\d+)?\s*$/i);
    return m ? parseFloat(m[1]) : NaN;
}

// Splits one CSV/TSV line, honouring quoted fields ("a, b" stays one cell).
export function splitDelimitedLine(line, delim) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
        } else if (ch === delim && !q) { out.push(cur); cur = ''; }
        else cur += ch;
    }
    out.push(cur);
    return out.map(c => c.trim());
}

// Turns pasted spreadsheet text or a CSV file into data points. Detects the
// delimiter (tab/comma/semicolon), an optional header row, and which columns
// hold the date, value, phase and note. Returns { rows, errors, columns }.
export function parseTabularData(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return { rows: [], errors: [], columns: null };
    const first = lines[0];
    const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    const table = lines.map(l => splitDelimitedLine(l, delim));

    const head = table[0].map(h => h.toLowerCase());
    const looksLikeHeader = normaliseDateInput(table[0][0]) === null && isNaN(parseNumericInput(table[0][1]));
    const find = (re) => head.findIndex(h => re.test(h));
    let cols = { date: 0, value: 1, grade: 2, note: 3 };
    if (looksLikeHeader) {
        const dateIdx = find(/date|time|day|week|month|arrival/);
        const valueIdx = find(/value|result|score|count|%|percent|minutes|seconds|duration|rate|number|measure/);
        const gradeIdx = find(/phase|cycle|grade|stage|context|period|pdsa/);
        const noteIdx = find(/note|comment|context|detail|id|label|description/);
        cols = {
            date: dateIdx >= 0 ? dateIdx : 0,
            value: valueIdx >= 0 ? valueIdx : (dateIdx === 1 ? 0 : 1),
            grade: gradeIdx,
            note: noteIdx >= 0 && noteIdx !== gradeIdx ? noteIdx : -1
        };
        if (cols.grade < 0 && !head.some(h => /note|comment/.test(h)) && table[0].length >= 3) cols.grade = 2;
    }
    const rows = [], errors = [];
    table.slice(looksLikeHeader ? 1 : 0).forEach((cells, i) => {
        const lineNo = i + (looksLikeHeader ? 2 : 1);
        const date = normaliseDateInput(cells[cols.date]);
        const value = parseNumericInput(cells[cols.value]);
        if (!date && isNaN(value)) return;
        if (!date) { errors.push(`Line ${lineNo}: couldn't read the date "${cells[cols.date] || ''}"`); return; }
        if (isNaN(value)) { errors.push(`Line ${lineNo}: couldn't read the value "${cells[cols.value] || ''}"`); return; }
        rows.push({
            date, value,
            grade: cols.grade >= 0 ? (cells[cols.grade] || '') : '',
            note: cols.note >= 0 ? (cells[cols.note] || '') : ''
        });
    });
    return { rows, errors, columns: cols, hasHeader: looksLikeHeader, delimiter: delim };
}

// ── Chart helpers ────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2025-10-05" → "5 Oct 2025" (or "5 Oct 25" with short=true). Anything that
// isn't an ISO date is returned unchanged so nothing is ever hidden.
export function formatUkDate(iso, short = false) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso || '');
    const y = short ? m[1].slice(2) : m[1];
    return `${+m[3]} ${MONTHS_SHORT[+m[2] - 1]} ${y}`;
}

// Tidy number for labels: at most `dp` decimals, no trailing zeros.
export function formatValue(v, dp = 1) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    return String(Number(Number(v).toFixed(dp)));
}

// Appends a unit to a value for labels: 90 + "%" → "90%", 245 + "seconds" → "245 seconds".
export function withUnit(v, unit, dp = 1) {
    const s = typeof v === 'number' ? formatValue(v, dp) : String(v);
    if (!unit) return s;
    return unit === '%' ? s + '%' : `${s} ${unit}`;
}

// Where a date falls on a category (one-slot-per-point) x-axis, as a
// fractional index: exactly on a point → that index; between two points →
// proportionally between them. Returns null outside the plotted date range,
// so an annotation is never drawn at a made-up position.
export function dateToAxisPosition(sortedDates, date) {
    const t = new Date(date).getTime();
    if (!sortedDates.length || isNaN(t)) return null;
    const ts = sortedDates.map(d => new Date(d).getTime());
    if (t < ts[0] || t > ts[ts.length - 1]) return null;
    for (let i = 0; i < ts.length; i++) {
        if (t === ts[i]) return i;
        if (i < ts.length - 1 && t > ts[i] && t < ts[i + 1]) {
            return i + (t - ts[i]) / (ts[i + 1] - ts[i]);
        }
    }
    return ts.length - 1;
}

// Run chart rules as taught by IHI / NHS England "Making Data Count":
//  - shift: 6+ consecutive points all above or all below the median
//    (points exactly on the median neither count nor break the run);
//  - trend: 5+ consecutive points all going up or all going down
//    (a repeated value neither counts nor breaks the trend);
//  - astronomical: an obviously different value. This is a judgement call;
//    we flag values beyond 3 × IQR from the quartiles as a prompt to look.
// Returns per-point flags plus which rules fired.
export function runChartSignals(values, med) {
    const n = values.length;
    const flags = values.map(() => new Set());

    if (n >= 4) {
        const sorted = [...values].sort((a, b) => a - b);
        const q = (p) => {
            const pos = (sorted.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
            return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
        };
        const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
        if (iqr > 0) values.forEach((v, i) => { if (v < q1 - 3 * iqr || v > q3 + 3 * iqr) flags[i].add('astronomical'); });
    }

    if (med !== null && med !== undefined) {
        let side = 0, run = [];
        const closeRun = () => { if (run.length >= 6) run.forEach(i => flags[i].add('shift')); };
        values.forEach((v, i) => {
            const s = v > med ? 1 : v < med ? -1 : 0;
            if (s === 0) return;
            if (s === side) run.push(i);
            else { closeRun(); side = s; run = [i]; }
        });
        closeRun();
    }

    // Trend: a repeated value neither counts nor breaks it, so count the
    // distinct steps in one direction.
    let start = 0, dir = 0, distinct = 1;
    const closeTrend = (end) => { if (distinct >= 5) for (let k = start; k <= end; k++) flags[k].add('trend'); };
    for (let i = 1; i < n; i++) {
        const d = Math.sign(values[i] - values[i - 1]);
        if (d === 0) continue;
        if (dir === 0 || d === dir) { dir = d; distinct++; continue; }
        closeTrend(i - 1);
        let s = i - 1;
        while (s > 0 && values[s - 1] === values[s]) s--;
        start = s; dir = d; distinct = 2;
    }
    closeTrend(n - 1);

    const out = flags.map(s => [...s]);
    return {
        flags: out,
        shift: out.some(f => f.includes('shift')),
        trend: out.some(f => f.includes('trend')),
        astronomical: out.some(f => f.includes('astronomical'))
    };
}

// XmR (individuals) chart limits and the four special-cause tests the app
// shows. Limits come from all the points supplied.
export function spcCalc(values, opts = {}) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const mrs = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    const avgMR = mrs.length ? mrs.reduce((a, b) => a + b, 0) / mrs.length : 0;
    let ucl = mean + 2.66 * avgMR;
    let lcl = mean - 2.66 * avgMR;
    if (opts.floor !== undefined && opts.floor !== null) lcl = Math.max(opts.floor, lcl);
    if (opts.ceiling !== undefined && opts.ceiling !== null) ucl = Math.min(opts.ceiling, ucl);
    const sigma = avgMR / 1.128;
    const flags = values.map(() => []);
    const add = (i, f) => { if (!flags[i].includes(f)) flags[i].push(f); };

    values.forEach((v, i) => { if (avgMR > 0 && (v > ucl || v < lcl)) add(i, 'ooc'); });

    let side = 0, run = [];
    const closeRun = () => { if (run.length >= 8) run.forEach(i => add(i, 'run')); };
    values.forEach((v, i) => {
        const s = v > mean ? 1 : v < mean ? -1 : 0;
        if (s === 0) { closeRun(); side = 0; run = []; return; }
        if (s === side) run.push(i);
        else { closeRun(); side = s; run = [i]; }
    });
    closeRun();

    if (sigma > 0) {
        for (let i = 0; i + 2 < n; i++) {
            const w = [i, i + 1, i + 2];
            const up = w.filter(k => values[k] > mean + 2 * sigma);
            const down = w.filter(k => values[k] < mean - 2 * sigma);
            if (up.length >= 2) up.forEach(k => add(k, 'twoOfThree'));
            if (down.length >= 2) down.forEach(k => add(k, 'twoOfThree'));
        }
    }

    const mrLimit = 3.27 * avgMR;
    const movingRanges = [null, ...mrs];
    movingRanges.forEach((r, i) => { if (r !== null && avgMR > 0 && r > mrLimit) add(i, 'movingRange'); });

    return { mean, avgMR, ucl, lcl, sigma, flags, movingRanges, mrLimit };
}

// Histogram bins with tidy edges. Returns [{ low, high, count }].
export function histogramBins(values, binCount) {
    const v = values.filter(x => !isNaN(x));
    if (!v.length) return [];
    const min = Math.min(...v), max = Math.max(...v);
    const k = binCount || Math.max(3, Math.min(10, Math.ceil(Math.log2(v.length) + 1)));
    if (min === max) return [{ low: min, high: max, count: v.length }];
    const step = (max - min) / k;
    const bins = Array.from({ length: k }, (_, i) => ({ low: min + i * step, high: min + (i + 1) * step, count: 0 }));
    v.forEach(x => {
        let i = Math.floor((x - min) / step);
        if (i >= k) i = k - 1;
        bins[i].count++;
    });
    return bins;
}

// Pareto: one bar per category, largest first, with cumulative %.
// Category comes from the point's category or note; the value is the count
// for that row (blank/invalid values count as 1).
export function paretoData(points) {
    const totals = {};
    (points || []).forEach(p => {
        const cat = String(p.category || p.note || '').trim();
        if (!cat) return;
        const v = Number(p.value);
        totals[cat] = (totals[cat] || 0) + (isNaN(v) ? 1 : v);
    });
    const cats = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
    const values = cats.map(c => totals[c]);
    const total = values.reduce((a, b) => a + b, 0);
    let cum = 0;
    const cumulative = values.map(v => { cum += v; return total ? (cum / total) * 100 : 0; });
    return { categories: cats, values, cumulative, total };
}
