// patient-tracker.js

export function renderPatientTracker(projectData, saveDataFunc) {
    const container = document.getElementById('patient-tracker-container');
    if (!container) return;
    
    if (!projectData.patientFeedback) {
        projectData.patientFeedback = [];
    }

    let listHtml = '';
    if (projectData.patientFeedback.length === 0) {
        listHtml = '<p class="text-slate-500 text-sm italic">No patient feedback recorded yet.</p>';
    } else {
        listHtml = projectData.patientFeedback.map((item, index) => `
            <div class="bg-white p-4 rounded border border-slate-200 mb-2">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-rcem-purple bg-purple-50 px-2 py-1 rounded">${item.date}</span>
                    <button onclick="window.deletePatientFeedback(${index})" class="text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>
                </div>
                <p class="text-sm text-slate-800 font-bold mb-1">Feedback: <span class="font-normal">${item.feedback}</span></p>
                <p class="text-sm text-slate-800 font-bold mb-1">Action Taken: <span class="font-normal">${item.action}</span></p>
                <p class="text-xs text-slate-500 mt-2">Mapped to PDSA Cycle: ${item.pdsaLink}</p>
            </div>
        `).join('');
    }

    container.innerHTML = `
        <div class="bg-slate-50 p-6 rounded-xl border border-slate-200">
            <h3 class="text-lg font-bold text-slate-800 mb-4">Patient and Public Involvement</h3>
            <div class="mb-6">
                ${listHtml}
            </div>
            <div class="bg-white p-4 rounded border border-slate-200">
                <h4 class="font-bold text-slate-700 mb-3">Log New Feedback</h4>
                <input type="date" id="pf-date" class="w-full border border-slate-300 rounded p-2 mb-2">
                <textarea id="pf-feedback" class="w-full border border-slate-300 rounded p-2 mb-2" placeholder="Enter patient suggestion or complaint..."></textarea>
                <textarea id="pf-action" class="w-full border border-slate-300 rounded p-2 mb-2" placeholder="Enter the action you took..."></textarea>
                <input type="text" id="pf-pdsa" class="w-full border border-slate-300 rounded p-2 mb-3" placeholder="Which PDSA cycle does this map to? (e.g. Cycle 2)">
                <button onclick="window.addPatientFeedback()" class="bg-rcem-purple text-white px-4 py-2 rounded font-bold hover:bg-purple-800">Save Feedback</button>
            </div>
        </div>
    `;

    window.addPatientFeedback = () => {
        const date = document.getElementById('pf-date').value;
        const feedback = document.getElementById('pf-feedback').value;
        const action = document.getElementById('pf-action').value;
        const pdsaLink = document.getElementById('pf-pdsa').value;

        if (!date || !feedback) {
            alert("Date and feedback are required.");
            return;
        }

        projectData.patientFeedback.push({ date, feedback, action, pdsaLink });
        saveDataFunc();
        renderPatientTracker(projectData, saveDataFunc);
    };

    window.deletePatientFeedback = (index) => {
        if (confirm("Remove this feedback log?")) {
            projectData.patientFeedback.splice(index, 1);
            saveDataFunc();
            renderPatientTracker(projectData, saveDataFunc);
        }
    };
}
