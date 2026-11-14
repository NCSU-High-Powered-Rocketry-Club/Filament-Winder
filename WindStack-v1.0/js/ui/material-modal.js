import { Material } from '../models/material.js';

/**
 * MaterialModal — Interactive modal editor for managing, creating, duplicating,
 * and calibrating fiber tow materials, bandwidths, and cured ply thicknesses.
 */
export class MaterialModal {
    /**
     * @param {Object} options
     * @param {Function} options.onMaterialSaved - Called when a material is saved
     * @param {Function} options.onMaterialDeleted - Called when a material is deleted
     * @param {Function} options.onMaterialSelected - Called when a material is chosen as active
     */
    constructor({ onMaterialSaved, onMaterialDeleted, onMaterialSelected }) {
        this.onMaterialSaved = onMaterialSaved;
        this.onMaterialDeleted = onMaterialDeleted;
        this.onMaterialSelected = onMaterialSelected;
        this.allMaterials = [];
        this.currentMaterial = null;
        this.element = null;

        this._createDOM();
    }

    _createDOM() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'material-modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-card modal-lg">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-layer-group" style="color:#2ecc71; font-size:1.2em;"></i>
                        <h3>Composite Fiber & Tow Library</h3>
                    </div>
                    <button class="modal-close-btn" id="material-modal-close"><i class="fas fa-times"></i></button>
                </div>

                <div class="modal-toolbar">
                    <div style="display:flex; align-items:center; gap:8px; flex:1;">
                        <label style="font-size:0.85em; color:#aaa; font-weight:600;">Fiber Profile:</label>
                        <select id="modal-material-select" style="max-width:240px; padding:4px 8px;"></select>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-primary" id="modal-mat-new"><i class="fas fa-plus"></i> New Material</button>
                        <button class="btn btn-sm btn-warning" id="modal-mat-export"><i class="fas fa-download"></i> Export</button>
                        <button class="btn btn-sm btn-success" id="modal-mat-import"><i class="fas fa-upload"></i> Import</button>
                        <input type="file" id="modal-mat-file" accept=".json" style="display:none;">
                    </div>
                </div>

                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="mat-specs"><i class="fas fa-ruler-combined"></i> Bandwidth & Ply Thickness</button>
                    <button class="modal-tab" data-tab="mat-mech"><i class="fas fa-atom"></i> Mechanical Properties</button>
                    <button class="modal-tab" data-tab="mat-json"><i class="fas fa-file-code"></i> Raw JSON</button>
                </div>

                <div class="modal-body">
                    <!-- TAB 1: SPECS -->
                    <div class="modal-tab-content active" id="tab-mat-specs">
                        <div class="input-grid-2">
                            <div class="input-group">
                                <label>Material Name</label>
                                <input type="text" id="mat-name" placeholder="e.g. Toray T700 12K">
                            </div>
                            <div class="input-group">
                                <label>Material ID (unique slug)</label>
                                <input type="text" id="mat-id" placeholder="e.g. carbon-t700-12k">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Fiber Type</label>
                                <select id="mat-type">
                                    <option value="carbon">Carbon Fiber (Standard / High Modulus)</option>
                                    <option value="glass">Glass Fiber (E-Glass / S-Glass)</option>
                                    <option value="aramid">Aramid / Kevlar</option>
                                    <option value="basalt">Basalt Fiber</option>
                                    <option value="natural">Natural Fiber (Flax / Hemp)</option>
                                    <option value="other">Other / Hybrid</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Tow Size / Yield Designation</label>
                                <input type="text" id="mat-tow" placeholder="e.g. 1K, 3K, 12K, 50K, 2400tex">
                            </div>
                        </div>

                        <div style="border-top:1px solid #334; margin:15px 0 10px 0;"></div>
                        <h4 style="font-size:0.9em; color:#2ecc71; text-transform:uppercase; margin-bottom:8px;">Bandwidth & Buildup Geometry</h4>

                        <div class="input-grid-3">
                            <div class="input-group">
                                <label>Nominal Bandwidth (mm)</label>
                                <input type="number" id="mat-width" step="0.1" value="3.0">
                            </div>
                            <div class="input-group">
                                <label>Min Spread Width (mm)</label>
                                <input type="number" id="mat-width-min" step="0.1" value="2.0">
                            </div>
                            <div class="input-group">
                                <label>Max Spread Width (mm)</label>
                                <input type="number" id="mat-width-max" step="0.1" value="4.5">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Cured Thickness Per Layer (mm)</label>
                                <input type="number" id="mat-thickness" step="0.005" value="0.125">
                            </div>
                            <div class="input-group">
                                <label>Filament Count (optional)</label>
                                <input type="number" id="mat-filaments" placeholder="e.g. 12000">
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: MECHANICAL -->
                    <div class="modal-tab-content" id="tab-mat-mech">
                        <p style="font-size:0.85em; color:#aaa; margin-bottom:10px;">Engineering properties for structural netting analysis & weight estimation:</p>
                        
                        <div class="input-grid-2">
                            <div class="input-group">
                                <label>Tensile Strength (MPa)</label>
                                <input type="number" id="mat-strength" placeholder="e.g. 4900">
                            </div>
                            <div class="input-group">
                                <label>Tensile Modulus (GPa)</label>
                                <input type="number" id="mat-modulus" placeholder="e.g. 230">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Density (g/cm³)</label>
                                <input type="number" id="mat-density" step="0.01" placeholder="e.g. 1.78">
                            </div>
                            <div class="input-group">
                                <label>Approx Cost / kg ($)</label>
                                <input type="number" id="mat-cost" step="0.1" placeholder="e.g. 35">
                            </div>
                        </div>
                    </div>

                    <!-- TAB 3: RAW JSON -->
                    <div class="modal-tab-content" id="tab-mat-json">
                        <textarea id="mat-raw-json" rows="14" style="width:100%; font-family:monospace; font-size:0.85em; background:#0b1118; color:#2ecc71; border:1px solid #334; border-radius:6px; padding:8px;"></textarea>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-danger btn-sm" id="mat-delete-btn" style="margin-right:auto; display:none;"><i class="fas fa-trash"></i> Delete Material</button>
                    <button class="btn btn-sm" id="mat-cancel-btn">Cancel</button>
                    <button class="btn btn-success btn-sm" id="mat-save-btn"><i class="fas fa-check"></i> Save Material</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this._bindEvents();
    }

    _bindEvents() {
        const modal = this.element;

        modal.querySelector('#material-modal-close').addEventListener('click', () => this.hide());
        modal.querySelector('#mat-cancel-btn').addEventListener('click', () => this.hide());
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

                if (target === 'mat-json') {
                    this._syncFormToJson();
                }
            });
        });

        // Dropdown selection
        const select = modal.querySelector('#modal-material-select');
        select.addEventListener('change', (e) => {
            const found = this.allMaterials.find(m => m.id === e.target.value);
            if (found) {
                this.loadMaterial(found);
                if (this.onMaterialSelected) this.onMaterialSelected(found);
            }
        });

        // New Button
        modal.querySelector('#modal-mat-new').addEventListener('click', () => {
            this._createNewMaterialTemplate();
        });

        // Export JSON
        modal.querySelector('#modal-mat-export').addEventListener('click', () => {
            const cfg = this._collectFormData();
            const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `material_${cfg.id || 'fiber'}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Import JSON
        const fileInput = modal.querySelector('#modal-mat-file');
        modal.querySelector('#modal-mat-import').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    const mat = new Material(parsed);
                    this.loadMaterial(mat);
                    alert(`Imported material "${mat.name}" successfully! Click "Save Material" to store.`);
                } catch (err) {
                    alert('Invalid material JSON: ' + err.message);
                }
            };
            reader.readAsText(file);
            fileInput.value = '';
        });

        // Delete Button
        modal.querySelector('#mat-delete-btn').addEventListener('click', () => {
            if (!this.currentMaterial) return;
            if (confirm(`Delete custom material "${this.currentMaterial.name}"?`)) {
                Material.deleteCustomMaterial(this.currentMaterial.id);
                if (this.onMaterialDeleted) this.onMaterialDeleted(this.currentMaterial.id);
                this.hide();
            }
        });

        // Save Button
        modal.querySelector('#mat-save-btn').addEventListener('click', () => {
            const cfg = this._collectFormData();
            if (!cfg.name || !cfg.id) {
                alert('Material name and ID are required.');
                return;
            }
            Material.saveCustomMaterial(cfg);
            const mat = new Material(cfg);
            if (this.onMaterialSaved) {
                this.onMaterialSaved(mat);
            }
            this.hide();
        });
    }

    show(materials, activeMaterial) {
        this.allMaterials = materials;
        const select = this.element.querySelector('#modal-material-select');
        select.innerHTML = '';

        for (const m of materials) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.name} (${m.towSize})`;
            if (activeMaterial && m.id === activeMaterial.id) opt.selected = true;
            select.appendChild(opt);
        }

        this.loadMaterial(activeMaterial || materials[0]);
        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }

    loadMaterial(mat) {
        this.currentMaterial = mat;
        const m = this.element;
        const cfg = mat.toJSON();

        m.querySelector('#mat-name').value = cfg.name || '';
        m.querySelector('#mat-id').value = cfg.id || '';
        m.querySelector('#mat-type').value = cfg.fiberType || 'carbon';
        m.querySelector('#mat-tow').value = cfg.towSize || '';

        m.querySelector('#mat-width').value = cfg.nominalWidth ?? 3.0;
        m.querySelector('#mat-width-min').value = cfg.spreadWidthRange?.min ?? 2.0;
        m.querySelector('#mat-width-max').value = cfg.spreadWidthRange?.max ?? 4.5;
        m.querySelector('#mat-thickness').value = cfg.thicknessPerLayer ?? 0.125;
        m.querySelector('#mat-filaments').value = cfg.filamentCount ?? '';

        m.querySelector('#mat-strength').value = cfg.tensileStrength ?? '';
        m.querySelector('#mat-modulus').value = cfg.tensileModulus ?? '';
        m.querySelector('#mat-density').value = cfg.density ?? '';
        m.querySelector('#mat-cost').value = cfg.costPerKg ?? '';

        const customMats = Material.loadCustomMaterials();
        const isCustom = customMats.some(cm => cm.id === cfg.id);
        m.querySelector('#mat-delete-btn').style.display = isCustom ? 'block' : 'none';

        this._syncFormToJson();
    }

    _createNewMaterialTemplate() {
        const id = 'custom-fiber-' + Date.now().toString(36);
        const newCfg = {
            id,
            name: 'Custom Carbon Fiber',
            fiberType: 'carbon',
            towSize: '12K',
            filamentCount: 12000,
            nominalWidth: 4.5,
            spreadWidthRange: { min: 3.0, max: 7.0 },
            thicknessPerLayer: 0.18,
            density: 1.78,
            tensileStrength: 4500,
            tensileModulus: 235,
            costPerKg: 40
        };
        this.loadMaterial(new Material(newCfg));
    }

    _collectFormData() {
        const m = this.element;
        const width = parseFloat(m.querySelector('#mat-width').value) || 3.0;
        const minW = parseFloat(m.querySelector('#mat-width-min').value) || (width * 0.7);
        const maxW = parseFloat(m.querySelector('#mat-width-max').value) || (width * 1.4);
        const thick = parseFloat(m.querySelector('#mat-thickness').value) || 0.125;

        const fil = m.querySelector('#mat-filaments').value;
        const str = m.querySelector('#mat-strength').value;
        const mod = m.querySelector('#mat-modulus').value;
        const den = m.querySelector('#mat-density').value;
        const cost = m.querySelector('#mat-cost').value;

        return {
            id: m.querySelector('#mat-id').value.trim() || 'custom-fiber',
            name: m.querySelector('#mat-name').value.trim() || 'Custom Fiber',
            fiberType: m.querySelector('#mat-type').value,
            towSize: m.querySelector('#mat-tow').value.trim() || '12K',
            filamentCount: fil ? parseInt(fil) : null,
            nominalWidth: width,
            spreadWidthRange: { min: minW, max: maxW },
            thicknessPerLayer: thick,
            tensileStrength: str ? parseFloat(str) : null,
            tensileModulus: mod ? parseFloat(mod) : null,
            density: den ? parseFloat(den) : null,
            costPerKg: cost ? parseFloat(cost) : null
        };
    }

    _syncFormToJson() {
        const cfg = this._collectFormData();
        this.element.querySelector('#mat-raw-json').value = JSON.stringify(cfg, null, 2);
    }
}
