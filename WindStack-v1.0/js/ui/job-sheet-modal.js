/**
 * JobSheetModal — Generates a formal, printable composite manufacturing traveler
 * and technical specification sheet for the workshop floor.
 */
export class JobSheetModal {
    constructor() {
        this.element = null;
        this._createDOM();
    }

    _createDOM() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'job-sheet-modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-card modal-lg" style="max-width:900px;">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-clipboard-list" style="color:#00d2ff; font-size:1.2em;"></i>
                        <h3>Composite Job Traveler & Shop Spec Sheet</h3>
                    </div>
                    <button class="modal-close-btn" id="jobsheet-modal-close"><i class="fas fa-times"></i></button>
                </div>

                <div class="modal-body" id="jobsheet-print-area" style="background:#fff; color:#111; padding:24px; border-radius:6px; font-family:'Segoe UI', Arial, sans-serif;">
                    <!-- Will be dynamically populated -->
                </div>

                <div class="modal-footer">
                    <button class="btn btn-sm" id="jobsheet-close-btn">Close</button>
                    <button class="btn btn-primary btn-sm" id="jobsheet-print-btn"><i class="fas fa-print"></i> Print Job Traveler (PDF)</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this._bindEvents();
    }

    _bindEvents() {
        const modal = this.element;

        modal.querySelector('#jobsheet-modal-close').addEventListener('click', () => this.hide());
        modal.querySelector('#jobsheet-close-btn').addEventListener('click', () => this.hide());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        // Print handler
        modal.querySelector('#jobsheet-print-btn').addEventListener('click', () => {
            const printContent = modal.querySelector('#jobsheet-print-area').innerHTML;
            const printWindow = window.open('', '', 'width=900,height=750');
            printWindow.document.write(`
                <html>
                <head>
                    <title>WindStack Manufacturing Traveler</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 30px; line-height: 1.4; }
                        h1, h2, h3, h4 { margin-top: 0; color: #1a252f; }
                        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
                        th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; }
                        th { background: #f2f4f6; font-weight: bold; }
                        .header-box { border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; }
                        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
                        .spec-card { border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: #fafbfc; }
                        .checklist { margin: 15px 0; }
                        .check-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
                        .sign-box { border-top: 1px solid #888; width: 140px; margin-top: 30px; font-size: 11px; text-align: center; }
                        @media print {
                            body { margin: 0; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 300);
        });
    }

    show(projectData) {
        const { machine, material, mandrel, layerPlans, estimates } = projectData;
        const printArea = this.element.querySelector('#jobsheet-print-area');

        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const jobId = 'WS-' + now.getFullYear() + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + Math.floor(Math.random() * 9000 + 1000);

        const plyCount = layerPlans ? layerPlans.length : 0;
        const totalThickMm = layerPlans ? layerPlans.reduce((acc, p) => acc + (material?.thicknessPerLayer || 0.125), 0) : 0;
        const finalOD = (mandrel?.diameter || 22.63) + (totalThickMm * 2);

        let tableRows = '';
        if (layerPlans && layerPlans.length > 0) {
            let runningDiam = mandrel?.diameter || 22.63;
            layerPlans.forEach((plan, i) => {
                const angle = plan.type === 'helical' ? `${plan.params?.angle || 45}°` : '90° (Hoop)';
                const circ = plan.circuits ? `${plan.circuits} c` : '—';
                const passes = plan.type === 'helical' ? (plan.circuits * 2) : 2;
                const width = plan.fiberWidth || material?.nominalWidth || 3.3;
                const plyThick = material?.thicknessPerLayer || 0.125;
                runningDiam += (plyThick * 2);

                tableRows += `
                    <tr>
                        <td style="font-weight:bold; text-align:center;">#${i + 1}</td>
                        <td style="text-transform:uppercase; font-weight:600;">${plan.type}</td>
                        <td>${angle}</td>
                        <td>${circ}</td>
                        <td>${passes} passes</td>
                        <td>${width} mm</td>
                        <td>${plyThick.toFixed(3)} mm</td>
                        <td style="font-weight:bold;">${runningDiam.toFixed(2)} mm</td>
                    </tr>
                `;
            });
        }

        printArea.innerHTML = `
            <div style="border-bottom: 2px solid #2c3e50; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h2 style="margin:0; font-size:1.4em; color:#2c3e50; text-transform:uppercase; letter-spacing:0.5px;">WINDSTACK COMPOSITE JOB TRAVELER</h2>
                    <span style="font-size:0.85em; color:#7f8c8d;">Part Specification & CNC Production Routing</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.1em; font-weight:bold; color:#e74c3c;">JOB ID: ${jobId}</div>
                    <div style="font-size:0.8em; color:#7f8c8d;">Date: ${dateStr}</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">
                <div style="border:1px solid #ddd; border-radius:4px; padding:10px; background:#fafbfc;">
                    <h4 style="margin:0 0 6px 0; color:#34495e; font-size:0.9em; border-bottom:1px solid #e1e8ed; padding-bottom:3px;">1. MANDREL & GEOMETRY SPECIFICATION</h4>
                    <table style="margin:0; font-size:11px;">
                        <tr><td style="width:45%; color:#666;">Mandrel Outer Diameter:</td><td><strong>${mandrel?.diameter || 22.63} mm</strong></td></tr>
                        <tr><td style="color:#666;">Winding Length:</td><td><strong>${mandrel?.length || 150} mm</strong></td></tr>
                        <tr><td style="color:#666;">Laminate Wall Thickness:</td><td><strong>${totalThickMm.toFixed(3)} mm</strong> (${plyCount} plies)</td></tr>
                        <tr><td style="color:#666;">Estimated Finished OD:</td><td><strong>${finalOD.toFixed(2)} mm</strong></td></tr>
                    </table>
                </div>

                <div style="border:1px solid #ddd; border-radius:4px; padding:10px; background:#fafbfc;">
                    <h4 style="margin:0 0 6px 0; color:#34495e; font-size:0.9em; border-bottom:1px solid #e1e8ed; padding-bottom:3px;">2. MATERIAL & TOW PROPERTIES</h4>
                    <table style="margin:0; font-size:11px;">
                        <tr><td style="width:45%; color:#666;">Fiber Material:</td><td><strong>${material?.name || 'Carbon 3K'} (${material?.towSize || '3K'})</strong></td></tr>
                        <tr><td style="color:#666;">Fiber Classification:</td><td><strong style="text-transform:capitalize;">${material?.fiberType || 'carbon'}</strong></td></tr>
                        <tr><td style="color:#666;">Nominal Tow Width:</td><td><strong>${material?.nominalWidth || 3.3} mm</strong></td></tr>
                        <tr><td style="color:#666;">Single-Ply Thickness:</td><td><strong>${material?.thicknessPerLayer || 0.125} mm</strong></td></tr>
                    </table>
                </div>
            </div>

            <div style="border:1px solid #ddd; border-radius:4px; padding:10px; background:#fafbfc; margin-bottom:14px;">
                <h4 style="margin:0 0 6px 0; color:#34495e; font-size:0.9em; border-bottom:1px solid #e1e8ed; padding-bottom:3px;">3. PRODUCTION ESTIMATES & RUNTIME METRICS</h4>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; text-align:center; padding:4px 0;">
                    <div style="background:#fff; border:1px solid #e1e8ed; padding:6px; border-radius:4px;">
                        <span style="font-size:0.75em; color:#7f8c8d; display:block;">EST. CYCLE TIME</span>
                        <strong style="font-size:1.1em; color:#2c3e50;">${estimates?.formattedTime || '—'}</strong>
                    </div>
                    <div style="background:#fff; border:1px solid #e1e8ed; padding:6px; border-radius:4px;">
                        <span style="font-size:0.75em; color:#7f8c8d; display:block;">FIBER LENGTH</span>
                        <strong style="font-size:1.1em; color:#2c3e50;">${estimates?.totalLengthM || '0'} m</strong>
                    </div>
                    <div style="background:#fff; border:1px solid #e1e8ed; padding:6px; border-radius:4px;">
                        <span style="font-size:0.75em; color:#7f8c8d; display:block;">EST. PART WEIGHT</span>
                        <strong style="font-size:1.1em; color:#2c3e50;">${estimates?.totalPartWeightG || '0'} g</strong>
                    </div>
                    <div style="background:#fff; border:1px solid #e1e8ed; padding:6px; border-radius:4px;">
                        <span style="font-size:0.75em; color:#7f8c8d; display:block;">EST. FIBER COST</span>
                        <strong style="font-size:1.1em; color:#27ae60;">$${estimates?.estimatedCost ? estimates.estimatedCost.toFixed(2) : '0.00'}</strong>
                    </div>
                </div>
            </div>

            <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 4px 0; color:#34495e; font-size:0.9em;">4. PLY SCHEDULE & LAMINATE ARCHITECTURE</h4>
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                    <thead>
                        <tr style="background:#f2f4f6;">
                            <th style="border:1px solid #bbb; padding:5px; text-align:center;">Ply</th>
                            <th style="border:1px solid #bbb; padding:5px;">Type</th>
                            <th style="border:1px solid #bbb; padding:5px;">Angle</th>
                            <th style="border:1px solid #bbb; padding:5px;">Circuits</th>
                            <th style="border:1px solid #bbb; padding:5px;">Passes</th>
                            <th style="border:1px solid #bbb; padding:5px;">Bandwidth</th>
                            <th style="border:1px solid #bbb; padding:5px;">Thickness</th>
                            <th style="border:1px solid #bbb; padding:5px;">Cumul. OD</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="8" style="text-align:center; padding:10px;">No layers configured.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="border:1px solid #ddd; border-radius:4px; padding:10px; background:#fafbfc; margin-bottom:14px;">
                <h4 style="margin:0 0 6px 0; color:#34495e; font-size:0.9em; border-bottom:1px solid #e1e8ed; padding-bottom:3px;">5. QUALITY CONTROL & OPERATOR ROUTING CHECKLIST</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:11px;">
                    <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; border:1px solid #777;"></span> Mandrel surface cleaned & release agent applied (3 coats)</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; border:1px solid #777;"></span> Carriage limit zero & spindle alignment confirmed</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; border:1px solid #777;"></span> Tow spool mounted & creel tension calibrated (300 - 500 cN)</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; border:1px solid #777;"></span> Resin impregnated bath viscosity checked (400 - 800 mPa·s)</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; border:1px solid #777;"></span> In-process fiber crossovers and gap inspection verified</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:12px; height:12px; border:1px solid #777;"></span> Post-wind B-stage tack / oven cure profile initiated</div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:24px; padding-top:10px; border-top:1px solid #ccc; font-size:11px;">
                <div>
                    <div>Machine: <strong>${machine?.name || 'Workshop Winder'}</strong> (${machine?.controllerType || 'klipper'})</div>
                    <div>Software: WindStack Composite Suite v1.5</div>
                </div>
                <div style="display:flex; gap:30px;">
                    <div style="border-top:1px solid #555; width:130px; text-align:center; padding-top:4px;">Operator Signature</div>
                    <div style="border-top:1px solid #555; width:130px; text-align:center; padding-top:4px;">QC Acceptance</div>
                </div>
            </div>
        `;

        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }
}
