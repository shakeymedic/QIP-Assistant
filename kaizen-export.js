// kaizen-export.js

export function exportToKaizen() {
    const data = window.projectData || {};
    const checklist = data.checklist || {};
    const pdsa = data.pdsa || [];
    const team = data.teamMembers || [];
    const meta = data.meta || {};

    const printWindow = window.open('', '_blank');
    
    const teamString = team.map(m => m.name + ' (' + m.role + ')').join(', ');
    
    const pdsaString = pdsa.map((p, i) => 
        '<strong>Cycle ' + (i + 1) + ': ' + p.title + '</strong><br>' +
        'Plan: ' + p.plan + '<br>' +
        'Do: ' + p.do + '<br>' +
        'Study: ' + p.study + '<br>' +
        'Act: ' + p.act
    ).join('<br><br>');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kaizen QIAT Export</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #2d2e83; padding-bottom: 20px; margin-bottom: 30px; position: relative; }
                .logo { position: absolute; top: 0; right: 0; width: 100px; }
                h1 { color: #2d2e83; font-size: 24px; }
                h2 { color: #2d2e83; font-size: 18px; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                h3 { font-size: 14px; color: #555; }
                .section { margin-bottom: 25px; }
                .content-box { background: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 4px; min-height: 50px; }
                .btn-print { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #2d2e83; color: white; text-align: center; text-decoration: none; border-radius: 5px; cursor: pointer; }
                @media print { .btn-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="https://iili.io/KGQOvkl.md.png" alt="WMEBEM Logo" class="logo">
                <h1>Quality Improvement Assessment Tool (QIAT)</h1>
                <p><strong>Project Title:</strong> ${meta.title || 'Not specified'}</p>
                <p><strong>Date Exported:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <button class="btn-print" onclick="window.print()">Print to PDF</button>

            <div class="section">
                <h2>1. The Project</h2>
                
                <h3>1.1 Analysis of problem</h3>
                <div class="content-box">
                    ${checklist.problem_desc || 'No problem description provided.'}
                </div>

                <h3>1.2 Use of QI methods</h3>
                <div class="content-box">
                    We utilised the Model for Improvement, incorporating driver diagrams for system analysis and multiple Plan, Do, Study, Act cycles to test change ideas iteratively.
                </div>

                <h3>1.3 What was the aim of the project?</h3>
                <div class="content-box">
                    ${checklist.aim || 'No SMART aim defined.'}
                </div>

                <h3>1.4 Measurement of outcomes</h3>
                <div class="content-box">
                    <p>Continuous data collection was used and visualised via run charts to identify shifts and trends over time.</p>
                    <p><strong>Results Analysis:</strong> ${checklist.results_analysis || 'No results analysis documented.'}</p>
                </div>

                <h3>1.5 Evaluation of change</h3>
                <div class="content-box">
                    ${pdsa.length > 0 ? pdsaString : 'No Plan, Do, Study, Act cycles recorded.'}
                </div>
            </div>

            <div class="section">
                <h2>2. Working with Others</h2>
                
                <h3>2.1 Team working</h3>
                <div class="content-box">
                    <p><strong>Team Members:</strong> ${teamString || 'No team members listed.'}</p>
                    <p>I engaged with the multidisciplinary team to ensure broad perspective and sustainable implementation of changes.</p>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
