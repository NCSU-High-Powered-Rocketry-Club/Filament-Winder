import { Machine } from '../models/machine.js';

/**
 * MachineModal — Interactive modal editor for managing, creating, duplicating,
 * and configuring filament winding machines and axis kinematics.
 */
export class MachineModal {
    /**
     * @param {Object} options
     * @param {Function} options.onMachineSaved - Called when a machine is created/saved/updated
     * @param {Function} options.onMachineDeleted - Called when a machine is deleted
     */
    constructor({ onMachineSaved, onMachineDeleted }) {
        this.onMachineSaved = onMachineSaved;
        this.onMachineDeleted = onMachineDeleted;
        this.currentMachine = null;
        this.allMachines = [];
        this.element = null;

        this._createDOM();
    }

    _createDOM() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'machine-modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-card modal-lg">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-microchip" style="color:#00d2ff; font-size:1.2em;"></i>
                        <h3>Machine Configuration Manager</h3>
                    </div>
                    <button class="modal-close-btn" id="machine-modal-close"><i class="fas fa-times"></i></button>
                </div>
                
                <div class="modal-toolbar">
                    <div style="display:flex; align-items:center; gap:8px; flex:1;">
                        <label style="font-size:0.85em; color:#aaa; font-weight:600;">Load Machine:</label>
                        <select id="modal-machine-select" style="max-width:240px; padding:4px 8px;"></select>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-primary" id="modal-machine-new" title="New Machine from Template"><i class="fas fa-plus"></i> New Machine</button>
                        <button class="btn btn-sm btn-warning" id="modal-machine-export" title="Export Machine JSON"><i class="fas fa-download"></i> Export</button>
                        <button class="btn btn-sm btn-success" id="modal-machine-import" title="Import Machine JSON"><i class="fas fa-upload"></i> Import</button>
                        <input type="file" id="modal-machine-file" accept=".json" style="display:none;">
                    </div>
                </div>

                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="general"><i class="fas fa-info-circle"></i> General & Limits</button>
                    <button class="modal-tab" data-tab="axes"><i class="fas fa-arrows-alt"></i> Axis Kinematics</button>
                    <button class="modal-tab" data-tab="gcode"><i class="fas fa-code"></i> G-Code & Macros</button>
                    <button class="modal-tab" data-tab="json"><i class="fas fa-file-code"></i> Raw JSON</button>
                </div>

                <div class="modal-body">
                    <!-- TAB 1: GENERAL & LIMITS -->
                    <div class="modal-tab-content active" id="tab-general">
                        <div class="input-grid-2">
                            <div class="input-group">
                                <label>Machine Name</label>
                                <input type="text" id="m-name" placeholder="e.g. Workshop 3-Axis Winder">
                            </div>
                            <div class="input-group">
                                <label>Machine ID (unique key)</label>
                                <input type="text" id="m-id" placeholder="e.g. my-custom-winder">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Controller Firmware</label>
                                <select id="m-controller-type">
                                    <option value="klipper">Klipper (Raspberry Pi + MCU)</option>
                                    <option value="marlin">Marlin / RepRap</option>
                                    <option value="linuxcnc">LinuxCNC</option>
                                    <option value="grbl">GRBL</option>
                                    <option value="mach3">Mach3 / Mach4</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Description</label>
                                <input type="text" id="m-description" placeholder="Brief machine description">
                            </div>
                        </div>

                        <div style="border-top:1px solid #334; margin:15px 0 10px 0;"></div>
                        <h4 style="font-size:0.9em; color:#00d2ff; text-transform:uppercase; margin-bottom:8px;">Physical Envelope Limits</h4>
                        <div class="input-grid-3">
                            <div class="input-group">
                                <label>Max Part Length (mm)</label>
                                <input type="number" id="m-limit-length" placeholder="Unlimited">
                            </div>
                            <div class="input-group">
                                <label>Max Mandrel Diameter (mm)</label>
                                <input type="number" id="m-limit-diam" placeholder="Unlimited">
                            </div>
                            <div class="input-group">
                                <label>Max Mandrel Weight (kg)</label>
                                <input type="number" id="m-limit-weight" placeholder="Unlimited">
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: AXIS KINEMATICS -->
                    <div class="modal-tab-content" id="tab-axes">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-size:0.85em; color:#aaa;">Configure machine axes, functions, speed limits, and travel envelopes:</span>
                            <button class="btn btn-sm btn-primary" id="m-add-axis-btn"><i class="fas fa-plus"></i> Add Axis</button>
                        </div>
                        <div id="m-axes-list" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;"></div>
                    </div>

                    <!-- TAB 3: G-CODE & MACROS -->
                    <div class="modal-tab-content" id="tab-gcode">
                        <div class="input-grid-2">
                            <div class="input-group">
                                <label>Coordinate Mode</label>
                                <select id="m-coord-mode">
                                    <option value="absolute">Absolute (G90)</option>
                                    <option value="incremental">Incremental (G91)</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Decimal Precision</label>
                                <input type="number" id="m-decimals" value="4" min="1" max="6">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Turnaround Dwell Speed (deg/min)</label>
                                <input type="number" id="m-turnaround-dwell-speed" value="2000">
                            </div>
                            <div class="input-group">
                                <label>Turnaround Dwell Degrees</label>
                                <input type="number" id="m-turnaround-dwell-deg" value="360">
                            </div>
                        </div>

                        <div class="input-grid-2" style="margin-top:10px;">
                            <div class="input-group">
                                <label>Custom Header Commands (one per line)</label>
                                <textarea id="m-header-lines" rows="4" style="font-family:monospace; font-size:0.85em; background:rgba(0,0,0,0.3); color:#fff; border:1px solid #334; border-radius:6px; padding:6px;"></textarea>
                            </div>
                            <div class="input-group">
                                <label>Custom Footer Commands (one per line)</label>
                                <textarea id="m-footer-lines" rows="4" style="font-family:monospace; font-size:0.85em; background:rgba(0,0,0,0.3); color:#fff; border:1px solid #334; border-radius:6px; padding:6px;"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 4: RAW JSON -->
                    <div class="modal-tab-content" id="tab-json">
                        <p style="font-size:0.8em; color:#aaa; margin-bottom:6px;">View or directly modify the raw machine profile JSON definition:</p>
                        <textarea id="m-raw-json" rows="14" style="width:100%; font-family:monospace; font-size:0.85em; background:#0b1118; color:#00d2ff; border:1px solid #334; border-radius:6px; padding:8px;"></textarea>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-danger btn-sm" id="m-delete-btn" style="margin-right:auto; display:none;"><i class="fas fa-trash"></i> Delete Profile</button>
                    <button class="btn btn-sm" id="m-cancel-btn">Cancel</button>
                    <button class="btn btn-success btn-sm" id="m-save-btn"><i class="fas fa-check"></i> Save & Apply Machine</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this._bindEvents();
    }

    _bindEvents() {
        const modal = this.element;

        // Close handlers
        modal.querySelector('#machine-modal-close').addEventListener('click', () => this.hide());
        modal.querySelector('#m-cancel-btn').addEventListener('click', () => this.hide());
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

                // If opening Raw JSON, sync form state to JSON
                if (target === 'json') {
                    this._syncFormToJson();
                }
            });
        });

        // Machine Dropdown
        const select = modal.querySelector('#modal-machine-select');
        select.addEventListener('change', (e) => {
            const found = this.allMachines.find(m => m.id === e.target.value);
            if (found) {
                this.loadMachine(found);
            }
        });

        // New Machine Button
        modal.querySelector('#modal-machine-new').addEventListener('click', () => {
            this._createNewMachineTemplate();
        });

        // Add Axis Button
        modal.querySelector('#m-add-axis-btn').addEventListener('click', () => {
            this._addAxisRow({
                id: 'Z',
                function: 'payout_tilt',
                type: 'rotary',
                unit: 'degrees',
                range: { min: -90, max: 90 },
                maxSpeed: 12000,
                maxAccel: 5000,
                homePosition: 0
            });
        });

        // Export JSON
        modal.querySelector('#modal-machine-export').addEventListener('click', () => {
            const cfg = this._collectFormData();
            const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `machine_${cfg.id || 'config'}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Import JSON
        const fileInput = modal.querySelector('#modal-machine-file');
        modal.querySelector('#modal-machine-import').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    const machine = new Machine(parsed);
                    this.loadMachine(machine);
                    alert(`Imported machine "${machine.name}" successfully! Click "Save & Apply" to keep it.`);
                } catch (err) {
                    alert('Invalid machine JSON: ' + err.message);
                }
            };
            reader.readAsText(file);
            fileInput.value = '';
        });

        // Delete Button
        modal.querySelector('#m-delete-btn').addEventListener('click', () => {
            if (!this.currentMachine) return;
            if (confirm(`Are you sure you want to delete custom machine "${this.currentMachine.name}"?`)) {
                Machine.deleteCustomMachine(this.currentMachine.id);
                if (this.onMachineDeleted) this.onMachineDeleted(this.currentMachine.id);
                this.hide();
            }
        });

        // Save Button
        modal.querySelector('#m-save-btn').addEventListener('click', () => {
            const config = this._collectFormData();
            const machine = new Machine(config);
            const val = machine.validateProfile();

            if (!val.valid) {
                alert('Cannot save machine: ' + val.errors.join(' '));
                return;
            }

            Machine.saveCustomMachine(config);
            if (this.onMachineSaved) {
                this.onMachineSaved(machine);
            }
            this.hide();
        });
    }

    /**
     * Show modal loaded with machines list and active machine.
     * @param {Array<Machine>} machines
     * @param {Machine} activeMachine
     */
    show(machines, activeMachine) {
        this.allMachines = machines;
        const select = this.element.querySelector('#modal-machine-select');
        select.innerHTML = '';

        for (const m of machines) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            if (activeMachine && m.id === activeMachine.id) opt.selected = true;
            select.appendChild(opt);
        }

        this.loadMachine(activeMachine || machines[0]);
        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }

    loadMachine(machine) {
        this.currentMachine = machine;
        const m = this.element;
        const cfg = machine.toJSON();

        m.querySelector('#m-name').value = cfg.name || '';
        m.querySelector('#m-id').value = cfg.id || '';
        m.querySelector('#m-controller-type').value = cfg.controller?.type || 'klipper';
        m.querySelector('#m-description').value = cfg.description || '';

        m.querySelector('#m-limit-length').value = cfg.physicalLimits?.maxPartLength ?? '';
        m.querySelector('#m-limit-diam').value = cfg.physicalLimits?.maxMandrelDiameter ?? '';
        m.querySelector('#m-limit-weight').value = cfg.physicalLimits?.maxMandrelWeight ?? '';

        m.querySelector('#m-coord-mode').value = cfg.gcode?.coordinateMode || 'absolute';
        m.querySelector('#m-decimals').value = cfg.gcode?.decimalPlaces ?? 4;
        m.querySelector('#m-turnaround-dwell-speed').value = cfg.turnaround?.dwellSpeed ?? 2000;
        m.querySelector('#m-turnaround-dwell-deg').value = cfg.turnaround?.dwellDegrees ?? 360;

        m.querySelector('#m-header-lines').value = (cfg.gcode?.header || []).join('\n');
        m.querySelector('#m-footer-lines').value = (cfg.gcode?.footer || []).join('\n');

        // Render Axes
        const axesList = m.querySelector('#m-axes-list');
        axesList.innerHTML = '';
        const axes = cfg.axes || [];
        for (const ax of axes) {
            this._addAxisRow(ax);
        }

        // Show/hide Delete button (only allow delete on custom machines)
        const customMachines = Machine.loadCustomMachines();
        const isCustom = customMachines.some(cm => cm.id === cfg.id);
        m.querySelector('#m-delete-btn').style.display = isCustom ? 'block' : 'none';

        this._syncFormToJson();
    }

    _createNewMachineTemplate() {
        const id = 'custom-winder-' + Date.now().toString(36);
        const newCfg = {
            id: id,
            name: 'New Custom Winder',
            description: 'Custom filament winder configuration',
            controller: { type: 'klipper', version: '0.12+' },
            axes: [
                { id: 'X', function: 'carriage', type: 'linear', unit: 'mm', range: { min: 0, max: 500 }, maxSpeed: 10000, maxAccel: 5000, homePosition: 0 },
                { id: 'Y', function: 'mandrel_rotation', type: 'rotary', unit: 'degrees', range: { min: null, max: null }, maxSpeed: 36000, maxAccel: 10000, homePosition: 0 }
            ],
            gcode: {
                header: ['; Generated by WindStack', '; Machine: New Custom Winder', 'G90', 'G92 X0 Y0'],
                footer: ['M400', 'G1 X0 F3000', 'M84'],
                coordinateMode: 'absolute',
                decimalPlaces: 4
            },
            turnaround: { method: 'dwell-rotate', dwellDegrees: 360, dwellSpeed: 2000, payoutTiltAngle: null },
            physicalLimits: { maxMandrelDiameter: 150, maxPartLength: 450, maxMandrelWeight: null }
        };

        this.loadMachine(new Machine(newCfg));
    }

    _addAxisRow(axisData) {
        const list = this.element.querySelector('#m-axes-list');
        const row = document.createElement('div');
        row.className = 'axis-row';
        row.style.background = 'rgba(0,0,0,0.25)';
        row.style.padding = '8px';
        row.style.borderRadius = '6px';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '50px 140px 90px 100px 1fr 30px';
        row.style.gap = '8px';
        row.style.alignItems = 'center';

        row.innerHTML = `
            <div>
                <label style="font-size:0.7em; color:#aaa; display:block;">Axis</label>
                <input type="text" class="ax-id" value="${axisData.id || 'X'}" style="width:100%; text-transform:uppercase; font-weight:bold; text-align:center;">
            </div>
            <div>
                <label style="font-size:0.7em; color:#aaa; display:block;">Function</label>
                <select class="ax-fn" style="width:100%; font-size:0.85em;">
                    <option value="carriage" ${axisData.function === 'carriage' ? 'selected' : ''}>Carriage</option>
                    <option value="mandrel_rotation" ${axisData.function === 'mandrel_rotation' ? 'selected' : ''}>Mandrel Rotation</option>
                    <option value="payout_tilt" ${axisData.function === 'payout_tilt' ? 'selected' : ''}>Payout Tilt (Head)</option>
                    <option value="cross_feed" ${axisData.function === 'cross_feed' ? 'selected' : ''}>Radial Crossfeed</option>
                </select>
            </div>
            <div>
                <label style="font-size:0.7em; color:#aaa; display:block;">Type</label>
                <select class="ax-type" style="width:100%; font-size:0.85em;">
                    <option value="linear" ${axisData.type === 'linear' ? 'selected' : ''}>Linear (mm)</option>
                    <option value="rotary" ${axisData.type === 'rotary' ? 'selected' : ''}>Rotary (deg)</option>
                </select>
            </div>
            <div>
                <label style="font-size:0.7em; color:#aaa; display:block;">Max Speed</label>
                <input type="number" class="ax-speed" value="${axisData.maxSpeed ?? 10000}" style="width:100%;">
            </div>
            <div>
                <label style="font-size:0.7em; color:#aaa; display:block;">Max Travel (null=unlimited)</label>
                <input type="number" class="ax-max" value="${axisData.range?.max ?? ''}" placeholder="Unlimited" style="width:100%;">
            </div>
            <div>
                <button class="btn btn-danger btn-sm ax-del-btn" style="padding:4px 6px; margin-top:12px;" title="Remove Axis"><i class="fas fa-trash"></i></button>
            </div>
        `;

        row.querySelector('.ax-del-btn').addEventListener('click', () => row.remove());
        list.appendChild(row);
    }

    _collectFormData() {
        const m = this.element;
        const axes = [];
        const rows = m.querySelectorAll('.axis-row');

        rows.forEach(r => {
            const id = r.querySelector('.ax-id').value.trim().toUpperCase() || 'X';
            const fn = r.querySelector('.ax-fn').value;
            const type = r.querySelector('.ax-type').value;
            const maxSpeed = parseFloat(r.querySelector('.ax-speed').value) || 10000;
            const maxTravelVal = r.querySelector('.ax-max').value;
            const maxTravel = maxTravelVal === '' ? null : parseFloat(maxTravelVal);

            axes.push({
                id,
                function: fn,
                type,
                unit: type === 'linear' ? 'mm' : 'degrees',
                range: { min: 0, max: maxTravel },
                maxSpeed,
                maxAccel: 5000,
                homePosition: 0
            });
        });

        const headerLines = m.querySelector('#m-header-lines').value.split('\n').filter(l => l.trim() !== '');
        const footerLines = m.querySelector('#m-footer-lines').value.split('\n').filter(l => l.trim() !== '');

        const maxL = m.querySelector('#m-limit-length').value;
        const maxD = m.querySelector('#m-limit-diam').value;
        const maxW = m.querySelector('#m-limit-weight').value;

        return {
            id: m.querySelector('#m-id').value.trim() || 'custom-winder',
            name: m.querySelector('#m-name').value.trim() || 'Custom Winder',
            description: m.querySelector('#m-description').value.trim(),
            controller: {
                type: m.querySelector('#m-controller-type').value,
                version: '0.12+'
            },
            axes,
            gcode: {
                header: headerLines,
                footer: footerLines,
                coordinateMode: m.querySelector('#m-coord-mode').value,
                lineNumbers: false,
                checksums: false,
                decimalPlaces: parseInt(m.querySelector('#m-decimals').value) || 4,
                macros: {
                    windStart: 'WIND_START',
                    windComplete: 'WIND_COMPLETE',
                    turnaroundCW: null,
                    turnaroundCCW: null,
                    layerChange: null,
                    pause: 'PAUSE'
                }
            },
            turnaround: {
                method: axes.some(a => a.function === 'payout_tilt') ? 'payout-tilt' : 'dwell-rotate',
                dwellDegrees: parseFloat(m.querySelector('#m-turnaround-dwell-deg').value) || 360,
                dwellSpeed: parseFloat(m.querySelector('#m-turnaround-dwell-speed').value) || 2000,
                payoutTiltAngle: 35
            },
            physicalLimits: {
                maxPartLength: maxL === '' ? null : parseFloat(maxL),
                maxMandrelDiameter: maxD === '' ? null : parseFloat(maxD),
                maxMandrelWeight: maxW === '' ? null : parseFloat(maxW)
            }
        };
    }

    _syncFormToJson() {
        const cfg = this._collectFormData();
        this.element.querySelector('#m-raw-json').value = JSON.stringify(cfg, null, 2);
    }
}
