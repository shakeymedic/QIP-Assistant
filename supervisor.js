// supervisor.js
import { showToast } from "./utils.js";

export function renderSupervisorDashboard() {
    const container = document.getElementById('view-supervisor');
    if (!container) return;
    
    const projectData = window.projectData || {};
    if (!projectData.assessment) {
        projectData.assessment = {
            traineeLevel: 'core',
            capabilitiesMet: [],
            supervisorComments: '',
            signedOff: false,
            signedOffBy: '',
            signedOffDate: ''
        };
    }

    const assessment = projectData.assessment;

    const coreChecked = assessment.traineeLevel === 'core' ? 'checked' : '';
    const intChecked = assessment.traineeLevel === 'intermediate' ? 'checked' : '';
    const higherChecked = assessment.traineeLevel === 'higher' ? 'checked' : '';

    const cap1Checked = assessment.capabilitiesMet.includes('cap1') ? 'checked' : '';
    const cap2Checked = assessment.capabilitiesMet.includes('cap2') ? 'checked' : '';
    const cap3Checked = assessment.capabilitiesMet.includes('cap3') ? 'checked' : '';

    container.innerHTML = `
        <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <h2 class="text-xl md:text-2xl font-bold text-slate-800 mb-4">SLO 11 Mapping and Supervisor Sign-off</h2>
            <p class="text-slate-600 mb-6 text-sm md:text-base">Use this dashboard to map your project to the RCEM Key Capabilities. Your Educational or Clinical Supervisor must review and sign off on this section before your ARCP.</p>
            
            <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded">
                <h3 class="font-bold text-slate-800 mb-3">1. Current Trainee Level</h3>
                <div class="flex flex-col md:flex-row gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="t_level" value="core" ${coreChecked} onchange="window.updateAssesmentLevel('core')"> 
                        <span>Core (ACCS)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="t_level" value="intermediate" ${intChecked} onchange="window.updateAssesmentLevel('intermediate')"> 
                        <span>Intermediate</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="t_level" value="higher" ${higherChecked} onchange="window.updateAssesmentLevel('higher')"> 
                        <span>Higher (HST)</span>
                    </label>
                </div>
            </div>

            <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded">
                <h3 class="font-bold text-slate-800 mb-3">2. Key Capabilities Demonstrated</h3>
                <label class="flex items-start gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" class="mt-1" value="cap1" ${cap1Checked} onchange="window.toggleCapability('cap1', this.checked)"> 
                    <span class="text-sm md:text-base">Contribute effectively to a departmental quality improvement project (Core Requirement).</span>
                </label>
                <label class="flex items-start gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" class="mt-1" value="cap2" ${cap2Checked} onchange="window.toggleCapability('cap2', this.checked)"> 
                    <span class="text-sm md:text-base">Describe involvement, show an understanding of QI methods, and reflect on the project (Intermediate Requirement).</span>
                </label>
                <label class="flex items-start gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" class="mt-1" value="cap3" ${cap3Checked} onchange="window.toggleCapability('cap3', this.checked)"> 
                    <span class="text-sm md:text-base">Provide clinical leadership on effective QI work and support a culture of safety (Higher Requirement).</span>
                </label>
            </div>

            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 class="font-bold text-blue-800 mb-3">3. Supervisor Review</h3>
                <textarea id="sup-comments" class="w-full border border-slate-300 rounded p-3 mb-3 text-sm md:text-base" rows="4" placeholder="Supervisor comments regarding progress against the 2025 curriculum requirements...">${assessment.supervisorComments}</textarea>
                <button onclick="window.saveSupervisorComments()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 w-full md:w-auto mb-6">Save Comments</button>
                
                <div class="border-t border-blue-200 pt-6">
                    ${assessment.signedOff ? 
                        `<div class="bg-emerald-100 text-emerald-800 p-4 rounded flex flex-col md:flex-row items-start md:items-center gap-3 font-bold">
                            <i data-lucide="check-circle" class="w-6 h-6 shrink-0"></i> 
                            <span>Signed off by ${assessment.signedOffBy} on ${assessment.signedOffDate}</span>
                            <button onclick="window.revokeSignOff()" class="mt-2 md:mt-0 md:ml-auto text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 w-full md:w-auto">Revoke Sign-off</button>
                        </div>` : 
                        `<div class="flex flex-col md:flex-row gap-2">
                             <input type="text" id="sup-name" class="w-full md:w-2/3 border border-slate-300 rounded p-2 text-sm md:text-base" placeholder="Supervisor Name and GMC Number">
                             <button onclick="window.signOffProject()" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700 w-full md:w-1/3">Sign Off for ARCP</button>
                         </div>`
                    }
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.updateAssesmentLevel = (level) => {
    window.projectData.assessment.traineeLevel = level;
    window.saveData();
};

window.toggleCapability = (cap, isChecked) => {
    const assessment = window.projectData.assessment;
    if (isChecked && !assessment.capabilitiesMet.includes(cap)) {
        assessment.capabilitiesMet.push(cap);
    } else if (!isChecked) {
        assessment.capabilitiesMet = assessment.capabilitiesMet.filter(c => c !== cap);
    }
    window.saveData();
};

window.saveSupervisorComments = () => {
    const comments = document.getElementById('sup-comments').value;
    window.projectData.assessment.supervisorComments = comments;
    window.saveData();
    showToast('Supervisor comments saved successfully.', 'success');
};

window.signOffProject = () => {
    const name = document.getElementById('sup-name').value.trim();
    if (!name) { 
        showToast('Please enter your name and GMC number before signing off.', 'error'); 
        return; 
    }
    window.showConfirmDialog(
        `Confirm sign-off as "${name}"? This formally certifies this QIP meets the RCEM Key Capabilities. It can be revoked but creates a permanent audit trail.`,
        () => {
            window.projectData.assessment.signedOff = true;
            window.projectData.assessment.signedOffBy = name;
            window.projectData.assessment.signedOffDate = new Date().toLocaleDateString('en-GB');
            window.saveData();
            renderSupervisorDashboard();
            showToast('Project signed off for ARCP.', 'success');
        },
        'Confirm Sign-off',
        'Sign Off for ARCP'
    );
};

window.revokeSignOff = () => {
    window.showConfirmDialog(
        'Revoke this supervisor sign-off? The project will return to unsigned status.',
        () => {
            window.projectData.assessment.signedOff = false;
            window.projectData.assessment.signedOffBy = '';
            window.projectData.assessment.signedOffDate = '';
            window.saveData();
            renderSupervisorDashboard();
            showToast('Sign-off revoked.', 'info');
        },
        'Revoke',
        'Revoke Sign-off'
    );
};
