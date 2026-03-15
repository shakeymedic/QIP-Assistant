// green-calculator.js

export function renderGreenCalculator() {
    const container = document.getElementById('green-calculator-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-emerald-50 p-6 rounded-xl border border-emerald-200 mt-6">
            <h3 class="text-lg font-bold text-emerald-800 mb-4">NHS Net Zero Carbon Calculator</h3>
            <p class="text-sm text-emerald-700 mb-4">Track your project carbon equivalent savings. The NHS must reach net zero for direct emissions by 2040.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Medication Waste Reduced (kg per year)</label>
                    <input type="number" id="med-waste-input" class="w-full border border-slate-300 rounded p-2" placeholder="e.g. 26">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Disposable Plastics Reduced (kg per year)</label>
                    <input type="number" id="plastic-waste-input" class="w-full border border-slate-300 rounded p-2" placeholder="e.g. 50">
                </div>
            </div>
            
            <button onclick="window.calculateCarbonSavings()" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700">Calculate Savings</button>
            
            <div id="carbon-results" class="mt-4 hidden bg-white p-4 rounded border border-emerald-100">
                <h4 class="font-bold text-slate-800 mb-2">Estimated Annual Carbon Savings</h4>
                <p class="text-3xl font-black text-emerald-600" id="co2e-total">0</p>
                <p class="text-sm text-slate-500">kilograms of CO2e</p>
                <p class="text-xs text-slate-400 mt-2">Conversion factors: Medication waste = 2.5 kg CO2e/kg. Plastic waste = 3.1 kg CO2e/kg.</p>
            </div>
        </div>
    `;
}

export function calculateCarbonSavings() {
    const medWaste = parseFloat(document.getElementById('med-waste-input').value) || 0;
    const plasticWaste = parseFloat(document.getElementById('plastic-waste-input').value) || 0;
    
    const medCarbon = medWaste * 2.5;
    const plasticCarbon = plasticWaste * 3.1;
    const totalCarbon = (medCarbon + plasticCarbon).toFixed(1);
    
    const resultsDiv = document.getElementById('carbon-results');
    const totalDisplay = document.getElementById('co2e-total');
    
    totalDisplay.textContent = totalCarbon;
    resultsDiv.classList.remove('hidden');
}

window.calculateCarbonSavings = calculateCarbonSavings;
