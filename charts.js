import { state } from './state.js';
import { escapeHtml } from './utils.js';

let chartInstance = null;
let fullViewChartInstance = null;

export function renderChart() {
    if(!state.projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = [...state.projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
    
    if (data.length === 0) { 
        document.getElementById('chart-ghost').classList.remove('hidden'); 
        if(chartInstance) chartInstance.destroy(); 
        return; 
    }
    document.getElementById('chart-ghost').classList.add('hidden');

    const values = data.map(d => Number(d.value));
    const labels = data.map(d => d.date);
    
    let baselinePoints = values.slice(0, 12); 
    let sortedBaseline = [...baselinePoints].sort((a,b) => a - b);
    let currentMedian = sortedBaseline.length ? sortedBaseline[Math.floor(sortedBaseline.length/2)] : 0;
    const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83'));

    if (chartInstance) chartInstance.destroy();
    
    const annotations = {
        median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2 }
    };
    
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 6, tension: 0.1 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { annotation: { annotations } },
            onClick: (e, activeEls) => {
                if (state.isReadOnly || activeEls.length === 0) return;
                const i = activeEls[0].index;
                const note = prompt(`Annotate point:`, data[i].note || "");
                if (note !== null) { 
                    // Note: You must handle the save callback in app.js or export a save function in state
                    data[i].note = note; 
                    window.saveData(); // Assuming saveData is global
                    renderChart(); 
                }
            }
        }
    });
    
    // Render History list
    document.getElementById('data-history').innerHTML = data.slice().reverse().map((d, i) => `
        <div class="flex justify-between border-b border-slate-100 py-2 items-center group">
            <span><span class="font-mono text-xs text-slate-400 mr-2">${d.date}</span> <strong>${d.value}</strong>${d.note ? `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">${escapeHtml(d.note)}</span>` : ''}</span>
            ${!state.isReadOnly ? `<button onclick="window.deleteDataPoint(${data.length - 1 - i})" class="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
        </div>`).join('');
    lucide.createIcons();
}

export async function renderTools(toolMode) {
    // ... Move renderTools logic here, accessing state.projectData ...
    // Note: ensure you import mermaid if needed or rely on window.mermaid
}
