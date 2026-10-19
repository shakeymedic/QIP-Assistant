// ==========================================
// FIRST-VISIT PAGE BANNERS
// ==========================================
// The first time a page is opened, a one-paragraph banner says what the page
// is for and what to do first. Dismissed per page, per browser.

import { safeStorage } from "./state.js";
import { QI } from "./qi-constants.js";

const BANNERS = {
    checklist: { icon: 'clipboard-check', title: 'Define & Measure is the foundation', text: `Work top to bottom: the problem, a draft aim, three measures with an operational definition, the data collection plan, then registration. Everything else in the app reads from here. If a section feels hard, open "See example" next to its heading.` },
    tools: { icon: 'git-branch', title: 'Diagnosis tools: start with the driver diagram', text: 'The driver diagram is the one assessors look for; the fishbone, process map and 5 whys feed it. Build it with the team, not alone, and keep it to the drivers you can act on.' },
    data: { icon: 'bar-chart-2', title: 'One point a week, before any change', text: `Add a point each week with the phase set to "Baseline" until you have ${QI.BASELINE_MIN} to ${QI.BASELINE_TARGET}. Then tag later points with the PDSA cycle they belong to, so the chart marks where each change started. Read the signals panel under the chart; it explains any shift or trend in words.` },
    pdsa: { icon: 'refresh-cw', title: 'Small tests, each with a prediction', text: 'A change idea holds its PDSA cycles. Test small (one shift, one desk), write a number-and-reason prediction before you start, compare the result with it in Study, and decide adopt, adapt or abandon. An adopted change gets a bigger test next.' },
    team: { icon: 'users', title: 'The team is the project', text: 'Add your consultant sponsor, the nurse or practitioner who does the work, and anyone who gives you data. Log leadership moments here as they happen; they are hard to remember at ARCP.' },
    gantt: { icon: 'calendar', title: 'Work back from the rotation end', text: `Put registration, the baseline (${QI.BASELINE_MIN} to ${QI.BASELINE_TARGET} weeks), each PDSA cycle and the handover on the timeline. If it does not fit before you leave, narrow the project now rather than later.` },
    supervisor: { icon: 'check-square', title: 'The EM QIAT is annual, before ARCP', text: 'This page holds the form your supervisor signs. It asks what you did, what you learned and where it sits on the QI Journey; leading a project every year is not required. Fill the project pages first and most of it writes itself.' },
    results: { icon: 'clipboard-pen-line', title: 'What the measures show, side by side', text: 'Each tracked measure with its before-and-after figures. Use the Data & SPC page to write the interpretation; this page summarises it for reports.' }
};

function key(view) { return 'qip_banner_seen_' + view; }

export function showPageBanner(view) {
    const spec = BANNERS[view];
    const section = document.getElementById('view-' + view);
    if (!spec || !section) return;
    const existing = section.querySelector('.first-visit-banner');
    if (existing) existing.remove();
    if (safeStorage.get(key(view))) return;
    const el = document.createElement('div');
    el.className = 'first-visit-banner bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-start gap-3 max-w-6xl mx-auto';
    el.setAttribute('role', 'note');
    el.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0"><i data-lucide="${spec.icon}" class="w-4 h-4 text-rcem-purple"></i></div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-indigo-900">${spec.title}</p>
            <p class="text-xs text-indigo-900/80 mt-0.5 leading-relaxed">${spec.text}</p>
            <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" data-dismiss="1" class="text-[11px] font-bold text-white bg-rcem-purple px-2.5 py-1 rounded hover:bg-indigo-800">Got it</button>
                <button type="button" onclick="window.router('intro')" class="text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2.5 py-1 rounded hover:bg-indigo-100">Read the eight steps</button>
            </div>
        </div>
        <button type="button" data-dismiss="1" aria-label="Dismiss" class="text-indigo-400 hover:text-indigo-700 p-1"><i data-lucide="x" class="w-4 h-4"></i></button>`;
    el.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => { safeStorage.set(key(view), '1'); el.remove(); }));
    section.insertBefore(el, section.firstChild);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.showPageBanner = showPageBanner;
window.resetPageBanners = function () { Object.keys(BANNERS).forEach(v => safeStorage.remove && safeStorage.remove(key(v))); };
