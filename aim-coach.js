// ==========================================
// AIM COACH
// ==========================================
// Plain-language checks on a SMART aim, shared by the onboarding wizard, the
// Define & Measure page and the SMART aim builder, so every screen gives the
// same advice. Returns a list of { level: 'warn' | 'tip' | 'ok', text }.

import { QI } from "./qi-constants.js";

const PLACEHOLDER = /\[(to be measured|baseline|measure|target|timeframe|date|setting)\]/i;
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i;

function parseLocalDate(s) {
    if (!s) return null;
    const [y, m, d] = String(s).split('-').map(Number);
    const dt = (y && m && d) ? new Date(y, m - 1, d) : new Date(s);
    return isNaN(dt) ? null : dt;
}

// Pulls a month/year or a full date out of free text, if there is one.
function dateInAim(aim) {
    const iso = aim.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
    if (iso) return parseLocalDate(iso[0]);
    const dmy = aim.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d\d)\b/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    const my = aim.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(20\d\d)\b/i);
    if (my) {
        const idx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(my[1].slice(0,3).toLowerCase());
        // "by June 2027" means the end of that month
        return new Date(Number(my[2]), idx + 1, 0);
    }
    return null;
}

export function coachAim(aimText, ctx = {}) {
    const aim = String(aimText || '').trim();
    const out = [];
    if (!aim) return out;
    const low = aim.toLowerCase();
    const baselineCount = Number(ctx.baselineCount || 0);

    // Draft mode: placeholders are fine early on
    if (PLACEHOLDER.test(aim)) {
        if (baselineCount >= QI.BASELINE_MIN) {
            out.push({ level: 'warn', text: `You now have ${baselineCount} baseline points. Replace the placeholder with your baseline median (shown on Data & SPC) and set a target you can defend.` });
        } else {
            out.push({ level: 'tip', text: `Draft aim: the placeholder in square brackets is fine for now. Finalise the numbers once you have about ${QI.BASELINE_MIN} baseline points (you have ${baselineCount}).` });
        }
    }

    const hasNumber = /\d/.test(aim.replace(PLACEHOLDER, ''));
    if (!hasNumber && !PLACEHOLDER.test(aim)) out.push({ level: 'warn', text: 'No numbers. A SMART aim says from what, to what: "from 45% to 90%", "from a median of 70 minutes to under 30".' });

    const hasDirection = /\b(increase|decrease|reduce|improve|raise|lower|cut|shorten)\b/.test(low);
    if (!hasDirection) out.push({ level: 'warn', text: 'Say which way you want the measure to move: increase, reduce or improve.' });

    // 100% targets are rarely credible
    if (/\b100\s?%/.test(aim) || /\bto 100\b/.test(low) || /\b(all|every) patients?\b/.test(low)) {
        out.push({ level: 'warn', text: 'A target of 100% (or "all patients") is rarely achievable and makes a real improvement look like a failure. 90% or 95% is usual; agree it with your supervisor.' });
    }

    // Direction against the kind of measure
    const timeLike = /\b(time to|minutes|hours|delay|wait(ing)?( time)?|length of stay|door[- ]to)\b/.test(low);
    const complianceLike = /\b(percentage|proportion|%|compliance|rate of (completion|documentation)|documented|recorded|screened)\b/.test(low);
    if (/\b(increase|raise)\b/.test(low) && timeLike && !complianceLike) out.push({ level: 'warn', text: 'You say "increase" but the measure reads like a time or a delay. Did you mean reduce?' });
    if (/\b(decrease|reduce|lower|cut)\b/.test(low) && complianceLike && !timeLike && !/\b(inappropriate|unnecessary|missed|incomplete|errors?|incidents?|contaminat|re-?attendance|complaints?)\b/.test(low)) {
        out.push({ level: 'tip', text: 'You say "reduce" but the measure reads like a compliance rate. Check the direction is what you mean (reduce "missed" or "inappropriate" things, increase "completed" ones).' });
    }

    // Time-bound
    const dt = dateInAim(aim);
    const mentionsTime = !!dt || MONTHS.test(aim) || /\b(by|within|in)\s+\d+\s+(weeks?|months?)\b/.test(low) || /\[(timeframe|date)\]/i.test(aim);
    if (!mentionsTime) out.push({ level: 'warn', text: 'No date. Add "by [month year]"; choose a date before your rotation ends so you can finish and hand over.' });
    const rotEnd = parseLocalDate(ctx.rotationEnd);
    if (dt && rotEnd && dt > rotEnd) out.push({ level: 'warn', text: `Your aim date is after your rotation ends (${rotEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}). Either bring the date forward or plan a handover now.` });
    const arcp = parseLocalDate(ctx.arcpDate);
    if (dt && arcp && dt > arcp && !(rotEnd && dt > rotEnd)) out.push({ level: 'tip', text: 'Your aim date is after your ARCP date, so the EM QIAT will be written while the project is still running. That is allowed, but say so in the form.' });
    if (dt && dt < new Date()) out.push({ level: 'warn', text: 'The date in your aim has already passed. Update it, or write up what happened.' });

    // Length and jargon
    const words = aim.split(/\s+/).filter(Boolean).length;
    if (words > 60) out.push({ level: 'tip', text: 'Long for an aim (over 60 words). One sentence is ideal; put the background in the problem statement instead.' });
    if (/\b(optimise|optimize|enhance|streamline|promote|raise awareness)\b/.test(low)) out.push({ level: 'tip', text: 'Words like "optimise", "enhance" or "raise awareness" cannot be measured. Name the thing that will be counted.' });
    if (!/\b(in|at|on|across)\s+(the\s+|our\s+|my\s+)?(emergency department|ed\b|a&e|resus|majors|minors|cdu|paediatric|paeds|department|ward|unit|clinic|hospital|trust)/.test(low) && !/\[setting\]/i.test(aim)) {
        out.push({ level: 'tip', text: 'Say where: "in the Emergency Department", "in majors", "on CDU".' });
    }

    if (!out.some(o => o.level === 'warn')) out.unshift({ level: 'ok', text: PLACEHOLDER.test(aim) ? 'Good draft. Fill the placeholder in once the baseline is measured.' : 'This reads as a SMART aim: a direction, numbers, a date and a place.' });
    return out;
}

export function coachHtml(items, escapeHtml) {
    if (!items || !items.length) return '';
    const style = { warn: 'text-amber-800 bg-amber-50 border-amber-200', tip: 'text-indigo-800 bg-indigo-50 border-indigo-100', ok: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
    const icon = { warn: '!', tip: 'i', ok: '✓' };
    return `<ul class="space-y-1 mt-2">${items.map(it => `<li class="text-xs px-2.5 py-1.5 rounded border flex gap-2 ${style[it.level] || style.tip}"><span class="font-bold w-3 flex-shrink-0">${icon[it.level] || 'i'}</span><span>${escapeHtml(it.text)}</span></li>`).join('')}</ul>`;
}
