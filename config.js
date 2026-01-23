// Theme Toggle
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Mode Toggle
function setMode(mode) {
    document.body.classList.toggle('presentation-mode', mode === 'presentation');
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    localStorage.setItem('mode', mode);
    
    // Reset to top of slide or page
    if (mode === 'presentation') {
        const firstSlide = document.getElementById('pres-1');
        if (firstSlide) firstSlide.scrollIntoView();
    } else {
        window.scrollTo(0,0);
    }
}

// Scenario Tabs
function showScenario(id) {
    document.querySelectorAll('.scenario-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.scenario-panel').forEach(panel => panel.classList.remove('active'));
    
    // Find button with specific onclick handler (simplified selector)
    const btn = Array.from(document.querySelectorAll('.scenario-tab')).find(b => b.getAttribute('onclick').includes(id));
    if(btn) btn.classList.add('active');
    
    const panel = document.getElementById('scenario-' + id);
    if(panel) panel.classList.add('active');
}

// Prompt Category Tabs
function showPromptCategory(id) {
    document.querySelectorAll('.prompt-cat-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.prompt-category').forEach(cat => cat.classList.remove('active'));
    
    const btn = Array.from(document.querySelectorAll('.prompt-cat-tab')).find(b => b.getAttribute('onclick').includes(id));
    if(btn) btn.classList.add('active');

    const cat = document.getElementById('prompts-' + id);
    if(cat) cat.classList.add('active');
}

// Progress Bar
function updateProgressBar() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    const bar = document.getElementById('progressBar');
    if(bar) bar.style.width = progress + '%';
}
window.addEventListener('scroll', updateProgressBar);

// Keyboard Navigation & Interaction
document.addEventListener('keydown', function(e) {
    // Escape closes modal
    if (e.key === 'Escape') closeModal();

    const mode = localStorage.getItem('mode') || 'website';
    
    if (mode === 'presentation') {
        handlePresentationNav(e);
    } else {
        handleWebsiteNav(e);
    }
});

function handlePresentationNav(e) {
    const slides = Array.from(document.querySelectorAll('.pres-slide'));
    // Find current visible slide based on scroll position
    let currentIndex = 0;
    
    // Simple heuristic: find slide closest to top of screen
    let minDiff = Infinity;
    slides.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const diff = Math.abs(rect.top);
        if(diff < minDiff) {
            minDiff = diff;
            currentIndex = index;
        }
    });

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < slides.length - 1) {
            slides[currentIndex + 1].scrollIntoView({ behavior: 'smooth' });
        }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
            slides[currentIndex - 1].scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function handleWebsiteNav(e) {
    // Define main sections in order
    const sectionIds = ['hero', 'stats', 'limitations', 'start-here', 'use-today', 'agentic', 'applications', 'implementations', 'platforms', 'scenarios', 'resources'];
    
    // Find current section
    let currentIdIndex = -1;
    let minDiff = Infinity;
    
    sectionIds.forEach((id, index) => {
        const el = document.getElementById(id);
        if(el) {
            const rect = el.getBoundingClientRect();
            // We want the section currently taking up most of the top of the viewport
            // Or the one we just scrolled past
            if (Math.abs(rect.top) < minDiff) {
                minDiff = Math.abs(rect.top);
                currentIdIndex = index;
            }
        }
    });

    if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIdIndex < sectionIds.length - 1) {
            document.getElementById(sectionIds[currentIdIndex + 1]).scrollIntoView({ behavior: 'smooth' });
        }
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIdIndex > 0) {
            document.getElementById(sectionIds[currentIdIndex - 1]).scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Fade In Observer
const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

// Modal Data
const modalData = {
    fracture: {
        title: 'AI Fracture Detection',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI-assisted detection of fractures on X-rays, particularly subtle injuries like scaphoid fractures, rib fractures, and hip fractures that are commonly missed.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>NICE HTG739 meta-analysis shows <strong>9.5% average sensitivity improvement</strong> (95% CI: 6.8–12.1%). Four technologies recommended: Annalise CXR, BoneView, RBfracture, Milvue.</p></div>
            <div class="modal-section"><h4>UK Deployments</h4><p>50+ NHS Trusts using AI fracture detection. Common implementations in A&E, urgent care, and virtual fracture clinics.</p></div>
            <div class="modal-warning"><p><strong>⚠️ Warning:</strong> AI augments but doesn't replace clinical judgment. You remain accountable for all diagnostic decisions (GMC GMP 2024).</p></div>
        `
    },
    stroke: {
        title: 'Stroke Imaging AI',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI analysis of CT/MRI for stroke, identifying large vessel occlusions, measuring penumbra, and accelerating treatment decisions.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>Lancet Digital Health study: thrombectomy rates <strong>doubled from 2.3% to 4.6%</strong> at AI-implementing hospitals. Time to treatment significantly reduced.</p></div>
            <div class="modal-section"><h4>UK Deployments</h4><p><strong>107 stroke units</strong> using Brainomix 360 Stroke (NHS England 2025). West Midlands: UHB using RapidAI across Birmingham, Sandwell, Dudley.</p></div>
        `
    },
    scribes: {
        title: 'AI Clinical Scribes',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Ambient AI that listens to consultations and generates clinical documentation, reducing documentation burden.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>St George's TORTUS trial: <strong>47 minutes saved per shift, 13.4% more patients seen</strong>. Nationally: potential 9,259 extra consultations daily if scaled to 11,055 A&E clinicians.</p></div>
            <div class="modal-section"><h4>Available Platforms</h4><p>TORTUS AI (NHS AI Exemplar), Heidi Health (DCB0129, Walsall pilot), Dragon Copilot (MHRA Class I, Guy's & St Thomas').</p></div>
            <div class="modal-warning"><p><strong>⚠️ Warning:</strong> Requires Trust approval, DPIA, Caldicott sign-off. Always review and verify AI-generated documentation before signing.</p></div>
        `
    },
    demand: {
        title: 'A&E Demand Forecasting',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Machine learning predicts ED attendance up to 72 hours ahead, enabling better staffing and resource allocation.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>NHS AI Lab tool deployed in 50+ trusts. Helps predict surges, plan staffing, and manage bed capacity.</p></div>
            <div class="modal-section"><h4>Implementation</h4><p>Typically integrates with Trust operational systems. Predictions inform daily operational meetings and longer-term planning.</p></div>
        `
    },
    sepsis: {
        title: 'Sepsis Digital Alerts',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>NEWS2-triggered AI screening for sepsis, integrated with EPR systems to alert clinicians to at-risk patients.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p><strong>70% reduction in sepsis progression</strong> when alerts are acted upon. Nationally mandated screening.</p></div>
            <div class="modal-section"><h4>Implementation</h4><p>NHS-wide standard. Integrated with EPR systems. Triggers based on NEWS2 scores plus additional clinical parameters.</p></div>
        `
    },
    triage: {
        title: 'AI Triage Support',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI-assisted triage using Manchester Triage System integration, helping predict acuity and appropriate care pathways.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>BMC Emergency Medicine review: <strong>80.5-99.1% accuracy</strong>. AUC >0.80 for acuity prediction. Still largely in research/pilot phase.</p></div>
            <div class="modal-warning"><p><strong>⚠️ Warning:</strong> AI triage should augment, not replace, experienced triage nurses. Human oversight essential.</p></div>
        `
    },
    hiu: {
        title: 'High Intensity Use AI',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI identifies patients at risk of frequent ED attendance, enabling proactive intervention and care coordination.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p><strong>58% visit reduction</strong> when targeted interventions are applied. 125+ EDs using high intensity user identification tools.</p></div>
            <div class="modal-section"><h4>Implementation</h4><p>Typically flags patients for multidisciplinary review and community-based support services.</p></div>
        `
    },
    rapidai: {
        title: 'RapidAI Stroke Imaging',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>CT perfusion analysis for stroke, identifying large vessel occlusions and penumbra to guide thrombectomy decisions.</p></div>
            <div class="modal-section"><h4>West Midlands Deployment</h4><p>UHB deployment across <strong>Birmingham, Sandwell, and Dudley</strong>. Integrated into stroke pathway.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>FDA-cleared, MHRA registered. Rapid processing of CT perfusion images to support time-critical treatment decisions.</p></div>
        `
    },
    meetings: {
        title: 'Meeting Summarisation',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>NHS Copilot transcribes and summarises Teams meetings, capturing action items and key decisions.</p></div>
            <div class="modal-section"><h4>Evidence</h4><p>NHS trial: <strong>43 minutes saved per staff member per day</strong> across 30,000+ workers in 90 organisations.</p></div>
            <div class="modal-section"><h4>How to Access</h4><p>Available free to NHS.net users with Connect Enhanced. Log in at NHS.net to access.</p></div>
        `
    },
    businesscase: {
        title: 'Business Case Drafting',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI helps structure NHS business cases following the HM Treasury Green Book Five Case Model.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Prompt AI with your proposed change and ask for Five Case Model structure: Strategic, Economic, Commercial, Financial, Management cases.</p></div>
            <div class="modal-warning"><p><strong>⚠️ Warning:</strong> Never input confidential or patient data. AI provides structure; you provide specifics and verify all claims.</p></div>
        `
    },
    psirf: {
        title: 'PSIRF/RCA Analysis',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI identifies themes across multiple patient safety incidents for PSIRF (Patient Safety Incident Response Framework) analysis.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Upload thoroughly anonymised incident descriptions. AI identifies recurring themes, contributing factors, and system issues.</p></div>
            <div class="modal-warning"><p><strong>⚠️ Critical:</strong> Remove ALL identifiable information before using AI. Replace names, dates, MRNs with generic placeholders. LFPSE integration coming.</p></div>
        `
    },
    qip: {
        title: 'QIP Development',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI assists with structuring Quality Improvement Projects for RCEM training requirements.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Describe your improvement idea. AI helps structure the project using PDSA cycles, generate audit tools, and write up findings.</p></div>
            <div class="modal-section"><h4>Tools</h4><p>ChatGPT, Claude, or Copilot all work well. Consider NotebookLM if you want to upload RCEM QIP guidance first.</p></div>
        `
    },
    sops: {
        title: 'SOPs & Clinical Guidelines',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can generate complete Standard Operating Procedures and clinical guidelines, or help update existing ones to current evidence.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Generate structure with: Purpose, Scope, Responsibilities, Step-by-step procedures, Safety considerations, Documentation requirements, References to NICE/RCEM guidance.</p></div>
            <div class="modal-section"><h4>Best Practice</h4><p>Upload current NICE/RCEM guidelines to NotebookLM for grounded, evidence-based content. Always have clinical review before implementation.</p></div>
            <div class="modal-section"><h4>Example Prompt</h4><p><em>"Write a Standard Operating Procedure for procedural sedation in an NHS Emergency Department. Include equipment checklist, consent process, monitoring requirements, and discharge criteria. Reference RCEM procedural sedation guidelines."</em></p></div>
        `
    },
    auditanalysis: {
        title: 'Audit Data Analysis',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can analyse anonymised audit data to identify trends, calculate compliance rates, and generate structured reports.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Calculate summary statistics, compare against standards, identify patterns, suggest improvement actions, generate charts and tables, write formal audit reports.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Export anonymised data (aggregated numbers, no patient identifiers). Paste into AI with the audit standards for comparison. Ask for specific analysis.</p></div>
            <div class="modal-warning"><p><strong>⚠️ Critical:</strong> Only use fully anonymised, aggregated data. Never include patient identifiers, free-text clinical notes, or anything that could identify individuals.</p></div>
        `
    },
    jobdesc: {
        title: 'Job Descriptions',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can generate complete job descriptions aligned to NHS Agenda for Change bands and Royal College standards.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Generate: Job title and grade, Reporting structure, Key responsibilities, Person specification (essential/desirable), Working patterns. Align to relevant professional standards.</p></div>
            <div class="modal-section"><h4>Example Prompt</h4><p><em>"Write a job description for an Advanced Nurse Practitioner in an NHS Emergency Department. Band 8a. Include clinical, leadership, and educational responsibilities. Align to HEE ANP framework."</em></p></div>
        `
    },
    riskregister: {
        title: 'Risk Register Entries',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can help structure risks in standard NHS format for corporate risk registers.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Structure risks using cause-event-consequence format. Apply 5x5 risk matrix scoring. Suggest current and additional controls. Link to strategic objectives.</p></div>
            <div class="modal-section"><h4>Example Prompt</h4><p><em>"Write a risk register entry for ED consultant staffing shortfall. Use NHS standard format with current controls, risk scoring, and mitigation actions."</em></p></div>
        `
    },
    workforce: {
        title: 'Workforce Planning',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can help build comprehensive workforce planning papers to support staffing business cases.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Structure papers with: Current establishment, Activity analysis, Gap analysis against RCEM standards, Options appraisal, Financial implications, Recommendations.</p></div>
            <div class="modal-section"><h4>Reference Standards</h4><p>RCEM Workforce Recommendations, GIRFT Emergency Medicine report, relevant Royal College guidance.</p></div>
        `
    },
    complaints: {
        title: 'Complaint Response Structure',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can help structure empathetic, professional complaint responses following NHS best practice.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Structure responses with: Acknowledgement, Explanation of review process, Findings (without admitting/denying), Learning and changes, Next steps (PALS, Ombudsman).</p></div>
            <div class="modal-warning"><p><strong>⚠️ Critical:</strong> Never include patient-identifiable information. Describe the complaint topic in general terms only. Use AI for structure and tone guidance, not specific content.</p></div>
        `
    },
    patientinfo: {
        title: 'Patient Information Leaflets',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can create accessible patient-facing materials in plain English (reading age 11).</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Generate leaflets with: Condition explanation, Warning signs to return, Self-care advice, When to seek help, Contact information. Format for easy printing.</p></div>
            <div class="modal-section"><h4>Best Practice</h4><p>Keep under 500 words. Use short sentences. Avoid medical jargon. Include clear action points. Have clinical and patient review before use.</p></div>
        `
    },
    rotaanalysis: {
        title: 'Rota Analysis',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI can analyse staffing patterns to identify gaps, check Working Time Regulations compliance, and suggest improvements.</p></div>
            <div class="modal-section"><h4>What AI Can Do</h4><p>Identify coverage gaps by time/day. Check WTR compliance (rest periods, max hours). Analyse skill mix. Compare staffing to activity patterns. Suggest optimisations.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Describe your rota pattern (shifts, staff numbers, grade mix) or paste a simplified rota structure. Include your department's attendance patterns if available.</p></div>
        `
    },
    agenticbrowsers: {
        title: 'Agentic Browser Automation',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Agentic browsers are AI tools that can actually control your browser — navigating websites, filling forms, and completing multi-step workflows on your behalf.</p></div>
            <div class="modal-section"><h4>Portfolio Use Case</h4><p>Record a FEG meeting with Copilot → Get summary → Use Comet browser to log into Kaizen, navigate to the trainee, and populate the FEG form fields with the meeting content.</p></div>
            <div class="modal-section"><h4>Key Tools</h4><p><strong>Comet Browser:</strong> Purpose-built agentic browser for professionals. <strong>Claude Computer Use:</strong> Anthropic's screen control feature. <strong>OpenAI Operator:</strong> Web task automation agent.</p></div>
            <div class="modal-section"><h4>Best For</h4><p>Portfolio documentation (Kaizen, Horus), study leave applications, expense claims, CPD logging, course registrations — any repetitive form-filling that doesn't involve patient data.</p></div>
            <div class="modal-warning"><p><strong>⚠️ Important:</strong> Never use with patient data. Always review before submitting. Check your Trust's policy on automation tools. These are consumer tools without NHS governance compliance.</p></div>
        `
    },
    simulation: {
        title: 'Simulation Scenarios',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI generates realistic clinical scenarios for simulation training with customisable difficulty and learning objectives.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Specify: patient demographics, presenting complaint, difficulty level, learning objectives. AI generates scenario, vitals, investigations, expected progression.</p></div>
            <div class="modal-section"><h4>Tools</h4><p>Claude and ChatGPT work well. WMEBEM has 42+ AI-powered simulation tools available.</p></div>
        `
    },
    teaching: {
        title: 'Teaching Materials',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI generates presentations, handouts, MCQs, and other educational materials from clinical guidelines.</p></div>
            <div class="modal-section"><h4>How to Use</h4><p>Upload guideline to NotebookLM for grounded content, or describe topic to ChatGPT/Claude for broader coverage. Always verify accuracy.</p></div>
            <div class="modal-section"><h4>Tools</h4><p>NotebookLM (grounded), Claude (detailed), ChatGPT (versatile). Can generate slides, handouts, MCQs, OSCEs.</p></div>
        `
    },
    frcem: {
        title: 'FRCEM Revision',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>AI-assisted exam preparation for FRCEM Primary, Intermediate, and Final.</p></div>
            <div class="modal-section"><h4>Recommended Approach</h4><p>Upload RCEM curriculum and key guidelines to NotebookLM. Get grounded answers only from your sources—no hallucinated content.</p></div>
            <div class="modal-section"><h4>Tools</h4><p>NotebookLM (best for grounded revision), Perplexity Academic (for evidence searches), ChatGPT/Claude (for explanations and practice questions).</p></div>
        `
    },
    gmp: {
        title: 'GMC Good Medical Practice 2024',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Updated GMC guidance effective 30 January 2024 explicitly includes AI in clinical practice.</p></div>
            <div class="modal-section"><h4>Key Points</h4><p>You remain <strong>personally accountable</strong> for clinical decisions made using AI tools. AI technologies are explicitly included under medical device adverse incident reporting requirements (Yellow Card).</p></div>
            <div class="modal-section"><h4>Source</h4><p><a href="https://www.gmc-uk.org/professional-standards/good-medical-practice-2024" target="_blank">GMC Good Medical Practice 2024 →</a></p></div>
                `
    },
    dtac: {
        title: 'DTAC/DCB Standards',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Digital Technology Assessment Criteria (DTAC) and Data Connection standards for NHS technology deployment.</p></div>
            <div class="modal-section"><h4>Key Standards</h4><p><strong>DCB0129:</strong> Clinical risk management for manufacturers. <strong>DCB0160:</strong> Clinical risk management for NHS organisations deploying technology. DTAC mandatory for NHS deployment.</p></div>
            <div class="modal-section"><h4>Compliance Gap</h4><p>JMIR 2025: 75% of digital tools lack DCB0129/0160 compliance across 14,747 deployments in 178 NHS organisations.</p></div>
            <div class="modal-section"><h4>Check Compliance</h4><p><a href="https://transform.england.nhs.uk/key-tools-and-info/digital-technology-assessment-criteria-dtac/" target="_blank">NHS DTAC Portal →</a></p></div>
        `
    },
    mhra: {
        title: 'MHRA Classification',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>MHRA regulates AI as medical devices under UK MDR 2002.</p></div>
            <div class="modal-section"><h4>Current Status</h4><p>Most current AI is <strong>Class I</strong> (self-certification). New rules will upclassify most AI to <strong>Class IIa minimum</strong> by June 2028/2030.</p></div>
            <div class="modal-section"><h4>Implications</h4><p>Class IIa+ requires notified body assessment, more rigorous clinical evidence, and ongoing post-market surveillance.</p></div>
            <div class="modal-section"><h4>Source</h4><p><a href="https://www.gov.uk/government/publications/software-and-artificial-intelligence-ai-as-a-medical-device" target="_blank">MHRA AI Guidance →</a></p></div>
        `
    },
    indemnity: {
        title: 'MDU/MPS Indemnity',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Medical defence organisations provide guidance on AI-assisted clinical decisions.</p></div>
            <div class="modal-section"><h4>Key Guidance</h4><p>Both MDU and MPS confirm: <strong>you remain liable for AI-assisted decisions</strong>. Coverage depends on human review and clinical judgment being applied.</p></div>
            <div class="modal-section"><h4>Recommendations</h4><p>Always verify AI output. Document your clinical reasoning. Don't rely solely on AI recommendations. Contact your MDO if uncertain about specific use cases.</p></div>
            <div class="modal-section"><h4>Source</h4><p><a href="https://www.themdu.com/guidance-and-advice/guides/using-ai-in-primary-care" target="_blank">MDU AI Guidance →</a></p></div>
        `
    },
    rcem: {
        title: 'RCEM Position Statement',
        content: `
            <div class="modal-section"><h4>Overview</h4><p>Royal College of Emergency Medicine position statement on artificial intelligence (December 2022).</p></div>
            <div class="modal-section"><h4>Key Points</h4><p>RCEM supports responsible AI development and deployment in emergency medicine. Emphasises need for robust evidence, appropriate governance, and maintained clinical oversight.</p></div>
            <div class="modal-section"><h4>Source</h4><p><a href="https://rcem.ac.uk/position-statement/rcem-position-statement-artificial-intelligence/" target="_blank">RCEM AI Position Statement →</a></p></div>
        `
    }
};

// Modal Functions
function openModal(id) {
    const data = modalData[id];
    if (data) {
        document.getElementById('modalTitle').textContent = data.title;
        document.getElementById('modalBody').innerHTML = data.content;
        document.getElementById('modalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(event) {
    if (!event || event.target === document.getElementById('modalOverlay')) {
        document.getElementById('modalOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize
(function init() {
    // Theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Mode
    const savedMode = localStorage.getItem('mode');
    if (savedMode === 'presentation') {
        setMode('presentation');
    }
})();
