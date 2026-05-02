// green-calculator.js
// NHS Net Zero Carbon Calculator — enhanced with cost savings & summary card

export function renderGreenCalculator() {
    const container = document.getElementById('green-calculator-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-emerald-50 p-6 rounded-xl border border-emerald-200 mt-6">
            <h3 class="text-lg font-bold text-emerald-800 mb-1 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/></svg>
                NHS Net Zero Carbon Calculator
            </h3>
            <p class="text-sm text-emerald-700 mb-5">Estimate the environmental and financial savings from your QI project. The NHS must reach net zero for direct emissions by 2040.</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Medication Waste Reduced <span class="text-slate-400 font-normal text-xs">(kg/year)</span></label>
                    <input type="number" id="med-waste-input" min="0" step="0.1" class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none" placeholder="e.g. 26">
                    <p class="text-xs text-slate-400 mt-1">Factor: 2.5 kg CO₂e / kg · £18 / kg NHS cost</p>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Disposable Plastics Reduced <span class="text-slate-400 font-normal text-xs">(kg/year)</span></label>
                    <input type="number" id="plastic-waste-input" min="0" step="0.1" class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none" placeholder="e.g. 50">
                    <p class="text-xs text-slate-400 mt-1">Factor: 3.1 kg CO₂e / kg · £4 / kg NHS cost</p>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Staff Travel Saved <span class="text-slate-400 font-normal text-xs">(km/year, car)</span></label>
                    <input type="number" id="travel-input" min="0" step="1" class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none" placeholder="e.g. 500">
                    <p class="text-xs text-slate-400 mt-1">Factor: 0.168 kg CO₂e / km · £0.45 / km (HMRC)</p>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Energy Saved <span class="text-slate-400 font-normal text-xs">(kWh/year)</span></label>
                    <input type="number" id="energy-input" min="0" step="1" class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none" placeholder="e.g. 200">
                    <p class="text-xs text-slate-400 mt-1">Factor: 0.233 kg CO₂e / kWh · £0.28 / kWh</p>
                </div>
            </div>

            <button onclick="window.calculateCarbonSavings()" class="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="11" y2="14"/></svg>
                Calculate Savings
            </button>

            <div id="carbon-results" class="hidden mt-6">
                <!-- Summary result card rendered by JS -->
            </div>
        </div>
    `;
}

export function calculateCarbonSavings() {
    const medWaste   = parseFloat(document.getElementById('med-waste-input')?.value)   || 0;
    const plastic    = parseFloat(document.getElementById('plastic-waste-input')?.value) || 0;
    const travel     = parseFloat(document.getElementById('travel-input')?.value)       || 0;
    const energy     = parseFloat(document.getElementById('energy-input')?.value)       || 0;

    // CO₂e savings (kg/year)
    const medCO2     = medWaste  * 2.5;
    const plasticCO2 = plastic   * 3.1;
    const travelCO2  = travel    * 0.168;
    const energyCO2  = energy    * 0.233;
    const totalCO2   = medCO2 + plasticCO2 + travelCO2 + energyCO2;

    // Cost savings (£/year)
    const medCost     = medWaste  * 18;
    const plasticCost = plastic   * 4;
    const travelCost  = travel    * 0.45;
    const energyCost  = energy    * 0.28;
    const totalCost   = medCost + plasticCost + travelCost + energyCost;

    // Equivalence: trees absorb ~21 kg CO₂/year
    const treesEq = Math.round(totalCO2 / 21);

    const resultsDiv = document.getElementById('carbon-results');
    if (!resultsDiv) return;

    const rows = [
        { label: 'Medication Waste',    co2: medCO2,     cost: medCost,     show: medWaste > 0 },
        { label: 'Disposable Plastics', co2: plasticCO2,  cost: plasticCost, show: plastic > 0 },
        { label: 'Staff Travel',        co2: travelCO2,   cost: travelCost,  show: travel > 0 },
        { label: 'Energy',              co2: energyCO2,   cost: energyCost,  show: energy > 0 }
    ].filter(r => r.show);

    resultsDiv.innerHTML = `
        <div class="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
            <div class="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white">
                <div class="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Estimated Annual Savings</div>
                <div class="flex items-end gap-6">
                    <div>
                        <div class="text-4xl font-black tracking-tight">${totalCO2.toFixed(1)}</div>
                        <div class="text-sm opacity-90 mt-0.5">kg CO₂e saved per year</div>
                    </div>
                    <div class="pb-1">
                        <div class="text-3xl font-bold">£${totalCost.toFixed(0)}</div>
                        <div class="text-sm opacity-90">estimated NHS cost saving</div>
                    </div>
                </div>
                ${treesEq > 0 ? `<div class="mt-3 text-sm opacity-80 flex items-center gap-1">
                    🌳 Equivalent to planting <strong>${treesEq}</strong> tree${treesEq !== 1 ? 's' : ''} per year
                </div>` : ''}
            </div>
            ${rows.length > 0 ? `
            <div class="p-4">
                <h5 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Breakdown</h5>
                <div class="space-y-2">
                    ${rows.map(r => `
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-slate-600">${r.label}</span>
                            <div class="flex items-center gap-4">
                                <span class="text-emerald-700 font-bold">${r.co2.toFixed(1)} kg CO₂e</span>
                                <span class="text-slate-500">£${r.cost.toFixed(0)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <p class="text-xs text-slate-400 mt-4">Conversion factors: DESNZ 2024 (energy), DEFRA 2024 (travel), NHS Supply Chain estimates (medication/plastic).</p>
            </div>
            ` : '<div class="p-4 text-sm text-slate-400">Enter values above to see the breakdown.</div>'}
        </div>
    `;
    resultsDiv.classList.remove('hidden');
}

window.calculateCarbonSavings = calculateCarbonSavings;
