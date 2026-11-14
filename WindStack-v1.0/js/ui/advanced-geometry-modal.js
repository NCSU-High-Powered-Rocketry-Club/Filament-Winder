import { TaperedPlanner } from '../core/tapered-planner.js';

/**
 * AdvancedGeometryModal — Interactive exploration tool and mathematical simulator
 * for non-cylindrical mandrels, conical transitions, and geodesic friction limits.
 */
export class AdvancedGeometryModal {
    constructor() {
        this.element = null;
        this.planner = new TaperedPlanner();
        this._createDOM();
    }

    _createDOM() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'advanced-geo-modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-card modal-lg" style="max-width:820px;">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-shapes" style="color:#00d2ff; font-size:1.2em;"></i>
                        <h3>Non-Cylindrical Geometry & Conical Transitions</h3>
                    </div>
                    <button class="modal-close-btn" id="geo-modal-close"><i class="fas fa-times"></i></button>
                </div>

                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="geo-cone"><i class="fas fa-drafting-compass"></i> Conical Mandrel Simulator</button>
                    <button class="modal-tab" data-tab="geo-dome"><i class="fas fa-circle-notch"></i> Dome & Vessel Roadmap</button>
                </div>

                <div class="modal-body">
                    <!-- TAB 1: CONICAL CALCULATOR -->
                    <div class="modal-tab-content active" id="tab-geo-cone">
                        <p style="font-size:0.85em; color:#bdc3c7; margin-bottom:12px;">
                            Simulate geodesic and non-geodesic fiber tow trajectories on tapered mandrels.
                            Verifies the <strong>critical friction slippage criterion</strong> to ensure fibers will not slide towards the small end during laydown.
                        </p>

                        <div class="input-grid-3">
                            <div class="input-group">
                                <label>Small End Dia (mm)</label>
                                <input type="number" id="cone-d1" value="30" step="1">
                            </div>
                            <div class="input-group">
                                <label>Large End Dia (mm)</label>
                                <input type="number" id="cone-d2" value="60" step="1">
                            </div>
                            <div class="input-group">
                                <label>Taper Length (mm)</label>
                                <input type="number" id="cone-len" value="200" step="1">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Desired Winding Angle (°)</label>
                                <input type="number" id="cone-angle" value="45" step="1">
                            </div>
                            <div class="input-group">
                                <label>Resin-Fiber Friction Coeff (μ)</label>
                                <input type="number" id="cone-mu" value="0.25" step="0.01" min="0.1" max="0.5">
                            </div>
                        </div>

                        <div style="border-top:1px solid #233446; margin:16px 0 12px 0;"></div>
                        <h4 style="font-size:0.9em; color:#00d2ff; text-transform:uppercase; margin-bottom:8px;">Stability & Kinematic Results</h4>

                        <div id="cone-results" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                            <!-- Filled dynamically -->
                        </div>

                        <div id="cone-warning-box" style="margin-top:12px; padding:10px; border-radius:6px; font-size:0.85em; display:none;"></div>
                    </div>

                    <!-- TAB 2: DOME ROADMAP -->
                    <div class="modal-tab-content" id="tab-geo-dome">
                        <div style="line-height:1.6; font-size:0.88em; color:#ecf0f1;">
                            <h4 style="color:#00d2ff; margin-bottom:6px;">Pressure Vessel Dome Contours & Polar Bosses</h4>
                            <p style="color:#bdc3c7; margin-bottom:12px;">
                                Winding closed-end pressure vessels (e.g. CO2 tanks, hydrogen cylinders, rocket motor cases) requires transition domes on each cylinder end.
                            </p>

                            <div style="background:rgba(0,0,0,0.3); border:1px solid #233446; border-radius:8px; padding:12px; margin-bottom:14px;">
                                <h5 style="color:#2ecc71; margin:0 0 6px 0; font-size:0.95em;">Core Dome Geometries:</h5>
                                <ul style="margin-left:20px; color:#bdc3c7;">
                                    <li><strong>Hemispherical Domes</strong>: Simplest dome geometry with constant radius $R$. Requires high fiber friction at lower polar angles.</li>
                                    <li><strong>Isotensoid Domes</strong>: Mathematically optimum geodesic dome where fiber tension is uniform everywhere in the filament. Features zero transverse shear stress.</li>
                                    <li><strong>Torispherical / Ellipsoidal Domes</strong>: 2:1 ASME standard domes offering balanced volume and polar boss clearance.</li>
                                </ul>
                            </div>

                            <div style="background:rgba(0,0,0,0.3); border:1px solid #233446; border-radius:8px; padding:12px;">
                                <h5 style="color:#f1c40f; margin:0 0 6px 0; font-size:0.95em;">Hardware Requirements for Dome Winding:</h5>
                                <p style="color:#bdc3c7; margin-bottom:8px;">
                                    When transitioning onto convex domes, a 2-axis machine without head tilt will cause fiber bridges or premature slipping across the pole.
                                </p>
                                <ul style="margin-left:20px; color:#bdc3c7;">
                                    <li><strong>Active Payout Tilt (3rd Axis)</strong>: Keeps the fiber delivery eye perpendicular to the local dome tangent plane.</li>
                                    <li><strong>Radial Cross-Feed (4th Axis)</strong>: Moves the payout eye in and out radially to maintain constant clearance ($\approx 10\text{mm}$) to the dome surface.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-sm" id="geo-close-btn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this._bindEvents();
    }

    _bindEvents() {
        const modal = this.element;

        modal.querySelector('#geo-modal-close').addEventListener('click', () => this.hide());
        modal.querySelector('#geo-close-btn').addEventListener('click', () => this.hide());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        // Tabs
        const tabs = modal.querySelectorAll('.modal-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const target = tab.dataset.tab;
                modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
                modal.querySelector(`#tab-${target}`).classList.add('active');
            });
        });

        // Input listeners
        ['cone-d1', 'cone-d2', 'cone-len', 'cone-angle', 'cone-mu'].forEach(id => {
            modal.querySelector(`#${id}`).addEventListener('input', () => this._updateConeCalculation());
        });
    }

    show(mandrel = null) {
        if (mandrel) {
            const d1Input = this.element.querySelector('#cone-d1');
            const d2Input = this.element.querySelector('#cone-d2');
            const lenInput = this.element.querySelector('#cone-len');
            if (d1Input && mandrel.diameter) {
                d1Input.value = mandrel.diameter;
                if (d2Input) d2Input.value = (mandrel.diameter * 1.5).toFixed(1);
            }
            if (lenInput && mandrel.length) lenInput.value = mandrel.length;
        }
        this._updateConeCalculation();
        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }

    _updateConeCalculation() {
        const m = this.element;
        const d1 = parseFloat(m.querySelector('#cone-d1').value) || 30;
        const d2 = parseFloat(m.querySelector('#cone-d2').value) || 60;
        const len = parseFloat(m.querySelector('#cone-len').value) || 200;
        const angle = parseFloat(m.querySelector('#cone-angle').value) || 45;
        const mu = parseFloat(m.querySelector('#cone-mu').value) || 0.25;

        const r1 = d1 / 2;
        const r2 = d2 / 2;
        const drdx = (r2 - r1) / len;
        const taperDeg = (this.planner.taperAngle(r1, r2, len) * 180) / Math.PI;

        const slipCheck = this.planner.checkSlippage(angle, r1, drdx, mu);
        const rot = this.planner.integrateTaperRotation(r1, r2, len, angle, 50);

        const resultsContainer = m.querySelector('#cone-results');
        resultsContainer.innerHTML = `
            <div style="background:rgba(0,0,0,0.3); border:1px solid #233446; padding:8px; border-radius:6px; text-align:center;">
                <span style="font-size:0.72em; color:#8899a6; display:block;">SURFACE TAPER</span>
                <strong style="font-size:1.15em; color:#fff;">${taperDeg.toFixed(2)}°</strong>
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid #233446; padding:8px; border-radius:6px; text-align:center;">
                <span style="font-size:0.72em; color:#8899a6; display:block;">SLIPPAGE FACTOR (λ)</span>
                <strong style="font-size:1.15em; color:${slipCheck.stable ? '#2ecc71' : '#e74c3c'};">${slipCheck.slippageCoefficient}</strong>
                <span style="font-size:0.68em; color:#aaa; display:block;">Max allowed: ${mu}</span>
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid #233446; padding:8px; border-radius:6px; text-align:center;">
                <span style="font-size:0.72em; color:#8899a6; display:block;">ROTATION PER PASS</span>
                <strong style="font-size:1.15em; color:#00d2ff;">${Math.round(rot.totalSpindleDegrees)}°</strong>
                <span style="font-size:0.68em; color:#aaa; display:block;">${(rot.totalSpindleDegrees / 360).toFixed(2)} turns</span>
            </div>
        `;

        const warnBox = m.querySelector('#cone-warning-box');
        if (!slipCheck.stable) {
            warnBox.style.display = 'block';
            warnBox.style.background = 'rgba(231, 76, 60, 0.2)';
            warnBox.style.color = '#ff7675';
            warnBox.style.border = '1px solid #e74c3c';
            warnBox.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> <strong>Slippage Warning:</strong>
                At ${angle}°, the tow tension will pull fibers toward the small end.
                Maximum stable non-slip angle for this taper is <strong>${slipCheck.maxAllowedAngleDeg}°</strong>.
            `;
        } else {
            warnBox.style.display = 'block';
            warnBox.style.background = 'rgba(46, 204, 113, 0.15)';
            warnBox.style.color = '#2ecc71';
            warnBox.style.border = '1px solid #2ecc71';
            warnBox.innerHTML = `
                <i class="fas fa-check-circle"></i> <strong>Stable Tow Trajectory:</strong>
                Friction between wet fiber and mandrel surface is sufficient to prevent slippage.
            `;
        }
    }
}
