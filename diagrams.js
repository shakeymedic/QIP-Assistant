// diagrams.js — drawing helpers shared by the interactive tools and the
// Whole Project View, so both show the same diagram from the same data.

import { escapeHtml } from "./utils.js";
import { formatUkDate } from "./project-metrics.js";

// ── Stakeholder matrix ───────────────────────────────────────────────────────
// A stakeholder's quadrant comes only from its saved position (x = interest,
// y = power, 0–100, 50 is the midline). Display nudging never changes it.

export const QUADRANTS = {
    manage: { label: 'Manage Closely', dot: '#dc2626', chip: 'bg-red-100 text-red-700', card: 'bg-red-600' },
    satisfy: { label: 'Keep Satisfied', dot: '#d97706', chip: 'bg-amber-100 text-amber-700', card: 'bg-amber-600' },
    inform: { label: 'Keep Informed', dot: '#2563eb', chip: 'bg-blue-100 text-blue-700', card: 'bg-blue-600' },
    monitor: { label: 'Monitor', dot: '#64748b', chip: 'bg-slate-100 text-slate-600', card: 'bg-slate-500' }
};

function coord(v) {
    const n = Number(v);
    return isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
}

export function stakeholderQuadrant(s) {
    const highPower = coord(s?.y) >= 50;
    const highInterest = coord(s?.x) >= 50;
    const key = highPower ? (highInterest ? 'manage' : 'satisfy') : (highInterest ? 'inform' : 'monitor');
    return { key, ...QUADRANTS[key] };
}

// Display positions that keep cards/dots apart without ever moving one into
// a different quadrant. Each item is treated as a w×h box (in % of the
// matrix), kept wholly inside its own quadrant (never across a midline or
// off the edge), and pushed apart from any box it overlaps.
export function layoutStakeholders(stakes, { w = 15, h = 6, pad = 1, band = 0 } = {}) {
    const hw = w / 2 + pad, hh = h / 2 + pad;
    const boxes = stakes.map(s => {
        const q = stakeholderQuadrant(s).key;
        const right = q === 'manage' || q === 'inform';
        const top = q === 'manage' || q === 'satisfy';
        return {
            x0: right ? 50 + hw : hw, x1: right ? 100 - hw : 50 - hw,
            // `band` keeps the outer edge strip (where quadrant labels sit) clear.
            y0: top ? 50 + hh : hh + band, y1: top ? 100 - hh - band : 50 - hh
        };
    });
    const clampTo = (p, b) => ({ x: Math.max(b.x0, Math.min(b.x1, p.x)), y: Math.max(b.y0, Math.min(b.y1, p.y)) });
    const pos = stakes.map((s, i) => clampTo({ x: coord(s.x), y: coord(s.y) }, boxes[i]));
    for (let iter = 0; iter < 200; iter++) {
        let moved = false;
        for (let i = 0; i < pos.length; i++) {
            for (let j = i + 1; j < pos.length; j++) {
                const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
                const ox = w + pad - Math.abs(dx), oy = h + pad - Math.abs(dy);
                if (ox <= 0 || oy <= 0) continue;
                // Separate along whichever axis needs the smaller move.
                if (oy / h <= ox / w) {
                    const dir = dy === 0 ? (i < j ? 1 : -1) : Math.sign(dy);
                    pos[i] = clampTo({ x: pos[i].x, y: pos[i].y + dir * oy / 2 }, boxes[i]);
                    pos[j] = clampTo({ x: pos[j].x, y: pos[j].y - dir * oy / 2 }, boxes[j]);
                } else {
                    const dir = dx === 0 ? (i < j ? 1 : -1) : Math.sign(dx);
                    pos[i] = clampTo({ x: pos[i].x + dir * ox / 2, y: pos[i].y }, boxes[i]);
                    pos[j] = clampTo({ x: pos[j].x - dir * ox / 2, y: pos[j].y }, boxes[j]);
                }
                moved = true;
            }
        }
        if (!moved) break;
    }
    return pos;
}

// ── Fishbone ─────────────────────────────────────────────────────────────────
// A proper fishbone: a spine to the problem ("effect") box, one bone per
// category alternating above and below, and each cause written along its
// bone. Returns SVG markup; `interactive` adds data attributes for clicks.

function truncate(t, n) {
    t = String(t || '').trim().replace(/\s+/g, ' ');
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

function wrapWords(t, perLine, maxLines) {
    const wordsArr = String(t || '').trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of wordsArr) {
        if ((cur + ' ' + w).trim().length > perLine) {
            if (cur) lines.push(cur);
            cur = w;
            if (lines.length === maxLines) break;
        } else cur = (cur + ' ' + w).trim();
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && wordsArr.join(' ').length > lines.join(' ').length) {
        lines[maxLines - 1] = truncate(lines[maxLines - 1] + ' …', perLine);
    }
    return lines.slice(0, maxLines);
}

export function fishboneSVG(fishbone, problemText, { interactive = false, maxCauses = 6, full = false, fontSize = 12 } = {}) {
    // Keep each category's original index so clicks edit the right one.
    const cats = ((fishbone && fishbone.categories) || [])
        .map((c, idx) => c && { ...c, _idx: idx })
        .filter(c => c && (c.text || (c.causes || []).length));
    const n = Math.max(cats.length, 1);
    const cols = Math.ceil(n / 2);
    const W = 1200, headW = 190, spineL = 30, spineR = W - headW - 20;
    const slant = 70;
    const colW = (spineR - spineL) / cols;
    const fs = fontSize, k = fs / 12;                  // `fontSize` enlarges every label for print
    const maxChars = Math.max(18, Math.floor((colW - slant - 24) / (5.9 * k)));
    const causesOf = (cat) => (cat.causes || []).map((c, k) => ({ text: typeof c === 'string' ? c : (c && c.text) || '', k })).filter(c => c.text);

    // `full` (used by the image exports) shows every cause in full, wrapped
    // over as many lines as it needs, and makes the bones long enough to fit
    // them. Otherwise causes are cut to one line so the on-screen view stays
    // compact.
    const lineH = Math.round(14 * k), gap = Math.round(8 * k);
    const blocks = cats.map(cat => causesOf(cat).map(c => {
        const lines = full ? wrapWords(c.text, maxChars, 99) : [truncate(c.text, maxChars)];
        return { ...c, lines, h: lines.length * lineH + gap };
    }));
    const tallest = full ? Math.max(0, ...blocks.map(b => b.reduce((s, x) => s + x.h, 0))) : 0;
    const boneLen = full ? Math.max(170, tallest + 40) : 170;
    const probLines = wrapWords(problemText || 'Problem', Math.floor(22 / k), full ? 99 : 4);
    const probH = Math.round(16 * k);
    const boxH = 34 * k + probLines.length * probH;
    const H = Math.max(2 * (boneLen + 60), full ? boxH + 40 : 0);
    const spineY = H / 2;
    let out = '';

    cats.forEach((cat, i) => {
        const col = Math.floor(i / 2);
        const above = i % 2 === 0;
        const jx = spineL + (col + 1) * colW - 8;          // where the bone meets the spine
        const ex = jx - slant;                              // outer end of the bone
        const ey = above ? spineY - boneLen : spineY + boneLen;
        out += `<line x1="${jx}" y1="${spineY}" x2="${ex}" y2="${ey}" stroke="#4338ca" stroke-width="3" stroke-linecap="round"/>`;

        const causes = blocks[i];
        const shown = full ? causes : causes.slice(0, maxCauses);
        let used = 18;                                      // distance from the spine already taken
        shown.forEach(({ text, k: ci, lines, h }, j) => {
            let t;
            if (full) { t = (used + h / 2) / boneLen; used += h; }
            else t = (j + 1) / (shown.length + 1);
            const bx = jx + (ex - jx) * t;
            const by = spineY + (ey - spineY) * t;
            const x2 = bx - 16;
            const y0 = by + 4 * k - (lines.length - 1) * lineH / 2;
            out += `<line x1="${bx}" y1="${by}" x2="${x2}" y2="${by}" stroke="#a5b4fc" stroke-width="1.5"/>`;
            out += `<text x="${x2 - 4}" y="${y0}" text-anchor="end" font-size="${fs}" fill="#1e293b"${interactive ? ` class="fb-cause" data-cat="${cat._idx}" data-cause="${ci}" style="cursor:pointer"` : ''}><title>${escapeHtml(text)}</title>${lines.length === 1 ? escapeHtml(lines[0]) : lines.map((l, m) => `<tspan x="${x2 - 4}" ${m ? `dy="${lineH}"` : `y="${y0}"`}>${escapeHtml(l)}</tspan>`).join('')}</text>`;
        });
        if (causes.length > shown.length) {
            const by = above ? ey + 14 : ey - 6;
            out += `<text x="${ex - 6}" y="${by}" text-anchor="end" font-size="11" fill="#64748b" font-style="italic">+${causes.length - shown.length} more</text>`;
        }

        const label = full ? String(cat.text || 'Category').trim() : truncate(cat.text || 'Category', 22);
        const pw = Math.max(70, label.length * 7.6 * k + 24);
        const ph = Math.round(26 * k);
        const py = above ? ey - ph - 6 : ey + 8;
        out += `<g${interactive ? ` class="fb-cat" data-cat="${cat._idx}" style="cursor:pointer"` : ''}><rect x="${ex - pw / 2}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="#312e81"/><text x="${ex}" y="${py + ph * 0.65}" text-anchor="middle" font-size="${12.5 * k}" font-weight="700" fill="#fff">${escapeHtml(label)}</text></g>`;
        if (interactive) {
            const ax = ex + pw / 2 + 14, ay = py + ph / 2;
            out += `<g class="fb-add" data-cat="${cat._idx}" style="cursor:pointer"><circle cx="${ax}" cy="${ay}" r="10" fill="#eef2ff" stroke="#6366f1"/><text x="${ax}" y="${ay + 4.5}" text-anchor="middle" font-size="14" font-weight="700" fill="#4338ca">+</text><title>Add a cause to ${escapeHtml(cat.text || 'this category')}</title></g>`;
        }
    });

    const hx = spineR + 14;
    out = `
        <rect x="0" y="0" width="${W}" height="${H}" fill="#f8fafc" rx="10"/>
        <line x1="${spineL}" y1="${spineY}" x2="${spineR}" y2="${spineY}" stroke="#1e1b4b" stroke-width="4" stroke-linecap="round"/>
        <polygon points="${spineR + 12},${spineY} ${spineR - 6},${spineY - 9} ${spineR - 6},${spineY + 9}" fill="#1e1b4b"/>
        ${out}
        <rect x="${hx}" y="${spineY - boxH / 2}" width="${headW}" height="${boxH}" rx="10" fill="#dc2626"/>
        <text x="${hx + headW / 2}" y="${spineY - boxH / 2 + 18 * k}" text-anchor="middle" font-size="${10 * k}" font-weight="700" fill="#fecaca" letter-spacing="1">EFFECT / PROBLEM</text>
        ${probLines.map((l, m) => `<text x="${hx + headW / 2}" y="${spineY - boxH / 2 + 38 * k + m * probH}" text-anchor="middle" font-size="${13 * k}" font-weight="700" fill="#fff">${escapeHtml(l)}</text>`).join('')}`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif" role="img" aria-label="Fishbone diagram">${out}</svg>`;
}

// The shortest sensible label for the fishbone's effect box.
export function fishboneProblem(data, { full = false } = {}) {
    const p = data?.fishbone?.problem || data?.fivewhys?.problem || data?.checklist?.problem_desc || '';
    const first = String(p).split(/(?<=[.!?])\s/)[0];
    return (full ? first.trim().replace(/\s+/g, ' ') : truncate(first, 90)) || 'Problem';
}

// ── Gantt summary (Whole Project View) ───────────────────────────────────────

const GANTT_COLOURS = { plan: '#3b82f6', study: '#a855f7', do: '#f59e0b', pdsa: '#f59e0b', act: '#059669', sustain: '#059669', data: '#10b981' };

export function ganttSummaryHTML(gantt) {
    const tasks = (gantt || []).map(g => ({
        name: g.name || g.task || g.title || 'Task',
        start: g.start || g.startDate,
        end: g.end || g.endDate || g.start || g.startDate,
        type: g.type || 'plan',
        owner: g.owner || g.responsible || '',
        milestone: !!g.milestone
    })).filter(t => t.start && !isNaN(new Date(t.start)));
    if (!tasks.length) return '';
    const t0 = Math.min(...tasks.map(t => new Date(t.start).getTime()));
    const t1 = Math.max(...tasks.map(t => new Date(t.end).getTime()));
    const span = Math.max(t1 - t0, 86400000);
    const pct = (d) => ((new Date(d).getTime() - t0) / span) * 100;
    // Month ticks
    const ticks = [];
    const d = new Date(t0); d.setDate(1);
    while (d.getTime() <= t1) {
        const p = pct(d);
        if (p >= 0) ticks.push({ p, label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) });
        d.setMonth(d.getMonth() + 1);
    }
    const every = Math.ceil(ticks.length / 12);
    return `
        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div class="grid" style="grid-template-columns: minmax(140px, 32%) 1fr">
                <div class="bg-slate-50 border-b border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Task</div>
                <div class="bg-slate-50 border-b border-slate-200 relative h-8">
                    ${ticks.filter((_, i) => i % every === 0).map(t => `<span class="absolute top-2 text-[10px] text-slate-500 -translate-x-1/2 whitespace-nowrap" style="left:${Math.min(96, Math.max(3, t.p))}%">${t.label}</span>`).join('')}
                </div>
                ${tasks.map(t => {
                    const l = pct(t.start), w = Math.max(pct(t.end) - l, 0.8);
                    const c = GANTT_COLOURS[t.type] || '#6366f1';
                    return `
                    <div class="px-3 py-1.5 border-b border-slate-100 text-xs text-slate-700 truncate" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}${t.owner ? ` <span class="text-slate-400">· ${escapeHtml(t.owner)}</span>` : ''}</div>
                    <div class="border-b border-slate-100 relative" title="${escapeHtml(`${t.name}: ${formatUkDate(t.start)} – ${formatUkDate(t.end)}`)}">
                        ${ticks.map(tk => `<span class="absolute inset-y-0 border-l border-slate-100" style="left:${tk.p}%"></span>`).join('')}
                        ${t.milestone
                            ? `<span class="absolute top-1/2 w-3 h-3 rotate-45 -translate-y-1/2 -translate-x-1/2" style="left:${l}%;background:${c}"></span>`
                            : `<span class="absolute top-1/2 -translate-y-1/2 h-3.5 rounded" style="left:${l}%;width:${w}%;background:${c}"></span>`}
                    </div>`;
                }).join('')}
            </div>
            <div class="flex flex-wrap gap-3 px-3 py-2 text-[10px] text-slate-500 bg-slate-50">
                <span>${escapeHtml(formatUkDate(new Date(t0).toISOString().slice(0, 10)))} – ${escapeHtml(formatUkDate(new Date(t1).toISOString().slice(0, 10)))}</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded" style="background:#3b82f6"></span>Planning</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded" style="background:#f59e0b"></span>PDSA / Do</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded" style="background:#a855f7"></span>Study</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded" style="background:#059669"></span>Act / Sustain</span>
            </div>
        </div>`;
}

// ── Process map summary (Whole Project View) ─────────────────────────────────

export function processFlowHTML(steps) {
    const s = (steps || []).filter(Boolean);
    if (s.length < 2) return '';
    return `<div class="flex flex-wrap items-center gap-2">${s.map((step, i) => `
        <div class="px-3 py-2 rounded-lg text-xs font-semibold ${i === 0 || i === s.length - 1 ? 'bg-slate-800 text-white' : 'bg-white border-2 border-slate-700 text-slate-800'} max-w-[14rem]">${escapeHtml(step)}</div>
        ${i < s.length - 1 ? '<span class="text-slate-400 text-lg">→</span>' : ''}`).join('')}</div>`;
}
