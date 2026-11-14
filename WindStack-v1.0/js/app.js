import { Machine } from './models/machine.js';
import { Mandrel } from './models/mandrel.js';
import { Material } from './models/material.js';
import { LayerStack } from './models/layer-stack.js';
import { PathPlanner } from './core/path-planner.js';
import { GCodeEngine } from './core/gcode-engine.js';
import { Viewer3D } from './viz/viewer-3d.js';
import { Coverage2D } from './viz/coverage-2d.js';
import { PlaybackController } from './viz/playback.js';
import { LayerStackUI } from './ui/layer-stack-ui.js';
import { MachineModal } from './ui/machine-modal.js';
import { MaterialModal } from './ui/material-modal.js';
import { ValidationBanner } from './ui/validation-banner.js';
import { ProductionEstimator } from './core/production-estimator.js';
import { KlipperConfigModal } from './ui/klipper-config-modal.js';
import { MoonrakerModal } from './ui/moonraker-modal.js';
import { JobSheetModal } from './ui/job-sheet-modal.js';
import { AdvancedGeometryModal } from './ui/advanced-geometry-modal.js';

/**
 * WindStack Application Controller
 * Orchestrates all modules: machines, materials, path planning, G-code generation,
 * and visualization.
 */
class App {
    constructor() {
        /** @type {Machine[]} */
        this.machines = [];
        /** @type {Material[]} */
        this.materials = [];
        /** @type {Machine} */
        this.currentMachine = null;
        /** @type {Material} */
        this.currentMaterial = null;
        this.mandrel = new Mandrel(22.63, 150);
        this.pathPlanner = new PathPlanner();
        /** @type {GCodeEngine} */
        this.gcodeEngine = null;
        /** @type {Viewer3D} */
        this.viewer3d = null;
        /** @type {Coverage2D} */
        this.coverage2d = null;
        /** @type {PlaybackController} */
        this.playback = null;
        /** @type {LayerStackUI} */
        this.layerStackUI = null;
        /** @type {MachineModal} */
        this.machineModal = null;
        /** @type {MaterialModal} */
        this.materialModal = null;
        /** @type {ValidationBanner} */
        this.validationBanner = null;
        /** @type {ProductionEstimator} */
        this.estimator = new ProductionEstimator();
        /** @type {KlipperConfigModal} */
        this.klipperModal = null;
        /** @type {MoonrakerModal} */
        this.moonrakerModal = null;
        /** @type {JobSheetModal} */
        this.jobSheetModal = null;
        /** @type {AdvancedGeometryModal} */
        this.advGeoModal = null;
        this._autoSaveTimer = null;
        this.gcodeString = '';
        /** @type {Array} */
        this.layerPlans = [];
    }

    async init() {
        try {
            // 1. Load machines and materials
            await this._loadMachines();
            await this._loadMaterials();

            // 2. Set defaults
            this.currentMachine = this.machines[0] || null;
            this.currentMaterial = this.materials[0] || null;

            if (this.currentMachine) {
                this.gcodeEngine = new GCodeEngine(this.currentMachine);
            }

            // 3. Init Validation Banner & Modals
            this.validationBanner = new ValidationBanner(document.getElementById('validation-banner'));
            this._initModals();

            // 4. Init UI
            this._initMachineSelector();
            this._initMaterialSelector();
            this._initMandrelInputs();
            this._initLayerStack();
            this._initGenerateButton();
            this._initGCodeControls();
            this._initToolbar();
            this._initViewTabs();

            // 5. Init visualization
            this.viewer3d = new Viewer3D(document.getElementById('canvas-wrapper'));
            this.coverage2d = new Coverage2D(document.getElementById('canvas2d'));
            this.playback = new PlaybackController(this);

            // 6. Restore from Auto-Save or add default helical layer
            const restored = this._restoreFromAutoSave();
            if (!restored) {
                const width = this.currentMaterial ? this.currentMaterial.nominalWidth : 3.3;
                this.layerStackUI.addLayer('helical', { fiberWidth: width });
            }

            // 7. Update status bar and initial validation check
            this._updateStatusBar();
            this._runValidation();

            console.log('WindStack initialized successfully');
        } catch (err) {
            console.error('WindStack initialization error:', err);
        }
    }

    // ========== MODAL MANAGERS ==========

    _initModals() {
        this.machineModal = new MachineModal({
            onMachineSaved: async (savedMachine) => {
                await this._loadMachines();
                this.currentMachine = this.machines.find(m => m.id === savedMachine.id) || savedMachine;
                this.gcodeEngine = new GCodeEngine(this.currentMachine);
                this._initMachineSelector();
                this._updateStatusBar();
                this._runValidation();
                this._triggerAutoSave();
            },
            onMachineDeleted: async () => {
                await this._loadMachines();
                this.currentMachine = this.machines[0] || null;
                if (this.currentMachine) {
                    this.gcodeEngine = new GCodeEngine(this.currentMachine);
                }
                this._initMachineSelector();
                this._updateStatusBar();
                this._runValidation();
                this._triggerAutoSave();
            }
        });

        this.materialModal = new MaterialModal({
            onMaterialSaved: async (savedMat) => {
                await this._loadMaterials();
                this.currentMaterial = this.materials.find(m => m.id === savedMat.id) || savedMat;
                this._initMaterialSelector();
                this._updateStatusBar();
                this._runValidation();
                this._triggerAutoSave();
            },
            onMaterialDeleted: async () => {
                await this._loadMaterials();
                this.currentMaterial = this.materials[0] || null;
                this._initMaterialSelector();
                this._updateStatusBar();
                this._runValidation();
                this._triggerAutoSave();
            },
            onMaterialSelected: (mat) => {
                this.currentMaterial = mat;
                this._initMaterialSelector();
                if (this.currentMaterial && this.layerStackUI) {
                    const diam = parseFloat(document.getElementById('mandrelDiameter')?.value) || 22.63;
                    this.layerStackUI.updateAllFiberWidths(this.currentMaterial.nominalWidth, diam);
                }
                this._updateStatusBar();
                this._runValidation();
                this._triggerAutoSave();
            }
        });

        this.klipperModal = new KlipperConfigModal();
        this.moonrakerModal = new MoonrakerModal();
        this.jobSheetModal = new JobSheetModal();
        this.advGeoModal = new AdvancedGeometryModal();

        const manageMachinesBtn = document.getElementById('manage-machines-btn');
        if (manageMachinesBtn) {
            manageMachinesBtn.addEventListener('click', () => {
                this.machineModal.show(this.machines, this.currentMachine);
            });
        }

        const manageMaterialsBtn = document.getElementById('manage-materials-btn');
        if (manageMaterialsBtn) {
            manageMaterialsBtn.addEventListener('click', () => {
                this.materialModal.show(this.materials, this.currentMaterial);
            });
        }

        const klipperBtn = document.getElementById('klipper-cfg-btn');
        if (klipperBtn) {
            klipperBtn.addEventListener('click', () => {
                this.klipperModal.show(this.currentMachine);
            });
        }

        const uploadBtn = document.getElementById('upload-winder-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', async () => {
                if (!this.gcodeString) {
                    await this._generate();
                }
                if (this.gcodeString) {
                    const diam = document.getElementById('mandrelDiameter')?.value || '22';
                    const len = document.getElementById('partLength')?.value || '150';
                    const partName = `windstack_${diam}mm_${len}mm.gcode`;
                    this.moonrakerModal.show(this.gcodeString, partName);
                }
            });
        }

        const jobsheetBtn = document.getElementById('jobsheet-btn');
        if (jobsheetBtn) {
            jobsheetBtn.addEventListener('click', async () => {
                if (!this.layerPlans || this.layerPlans.length === 0) {
                    await this._generate();
                }
                const estimates = this.estimator.estimate(
                    this.layerPlans,
                    this.mandrel.diameter,
                    this.mandrel.length,
                    this.currentMaterial,
                    {
                        feedRate: parseFloat(document.getElementById('feedRate')?.value) || 8000,
                        dwellSpeed: parseFloat(document.getElementById('dwellSpeed')?.value) || 2000
                    }
                );
                this.jobSheetModal.show({
                    machine: this.currentMachine,
                    material: this.currentMaterial,
                    mandrel: this.mandrel,
                    layerPlans: this.layerPlans,
                    estimates
                });
            });
        }

        const advGeoBtn = document.getElementById('adv-geo-btn');
        if (advGeoBtn) {
            advGeoBtn.addEventListener('click', () => {
                this.advGeoModal.show(this.mandrel);
            });
        }

        const newProjectBtn = document.getElementById('new-project-btn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                if (confirm('Start a new blank project? Unsaved changes will be cleared.')) {
                    this._resetNewProject();
                }
            });
        }
    }

    _runValidation() {
        if (!this.validationBanner || !this.currentMachine) return;
        const feedRate = parseFloat(document.getElementById('feedRate')?.value) || 8000;
        const dwellSpeed = parseFloat(document.getElementById('dwellSpeed')?.value) || 2000;
        const layers = this.layerStackUI ? this.layerStackUI.getLayerStack().layers : [];
        this.validationBanner.check(this.currentMachine, this.mandrel, { feedRate, dwellSpeed }, layers);
    }

    // ========== DATA LOADING ==========

    async _loadMachines() {
        try {
            this.machines = await Machine.loadAll();
        } catch (err) {
            console.warn('Failed to load machines, using defaults:', err);
            this.machines = [];
        }
    }

    async _loadMaterials() {
        try {
            this.materials = await Material.loadAll();
        } catch (err) {
            console.warn('Failed to load materials, using defaults:', err);
            this.materials = [];
        }
    }

    // ========== MACHINE SELECTOR ==========

    _initMachineSelector() {
        const select = document.getElementById('machine-select');
        select.innerHTML = '';

        for (const machine of this.machines) {
            const opt = document.createElement('option');
            opt.value = machine.id;
            opt.textContent = machine.name;
            if (this.currentMachine && machine.id === this.currentMachine.id) opt.selected = true;
            select.appendChild(opt);
        }

        select.addEventListener('change', (e) => {
            this.currentMachine = this.machines.find(m => m.id === e.target.value) || null;
            if (this.currentMachine) {
                this.gcodeEngine = new GCodeEngine(this.currentMachine);
            }
            this._updateStatusBar();
            this._runValidation();
            this._triggerAutoSave();
        });
    }

    // ========== MATERIAL SELECTOR ==========

    _initMaterialSelector() {
        const select = document.getElementById('material-select');
        const info = document.getElementById('material-info');
        select.innerHTML = '';

        for (const mat of this.materials) {
            const opt = document.createElement('option');
            opt.value = mat.id;
            opt.textContent = `${mat.name} (${mat.towSize})`;
            if (this.currentMaterial && mat.id === this.currentMaterial.id) opt.selected = true;
            select.appendChild(opt);
        }

        const updateInfo = () => {
            if (this.currentMaterial) {
                info.textContent = `Width: ${this.currentMaterial.nominalWidth}mm | Thickness: ${this.currentMaterial.thicknessPerLayer}mm | Type: ${this.currentMaterial.fiberType}`;
            } else {
                info.textContent = '—';
            }
        };

        select.addEventListener('change', (e) => {
            this.currentMaterial = this.materials.find(m => m.id === e.target.value) || null;
            updateInfo();
            if (this.currentMaterial && this.layerStackUI) {
                const diam = parseFloat(document.getElementById('mandrelDiameter')?.value) || 22.63;
                this.layerStackUI.updateAllFiberWidths(this.currentMaterial.nominalWidth, diam);
            }
            this._updateStatusBar();
            this._runValidation();
            this._triggerAutoSave();
        });

        updateInfo();
    }

    // ========== MANDREL & GLOBAL INPUTS ==========

    _initMandrelInputs() {
        const diamInput = document.getElementById('mandrelDiameter');
        const lenInput = document.getElementById('partLength');
        const feedInput = document.getElementById('feedRate');
        const dwellInput = document.getElementById('dwellSpeed');
        const tiltInput = document.getElementById('tiltSpeed');

        const update = () => {
            const d = parseFloat(diamInput.value);
            const l = parseFloat(lenInput.value);
            if (!isNaN(d) && !isNaN(l)) {
                this.mandrel = new Mandrel(d, l);
                if (this.viewer3d) {
                    this.viewer3d.updateMandrel(d, l);
                }
                // Recalculate all helical layer circuits
                if (this.layerStackUI) {
                    this.layerStackUI.updateAllCalcs(d);
                }
            }
            this._runValidation();
            this._triggerAutoSave();
        };

        diamInput.addEventListener('input', update);
        lenInput.addEventListener('input', update);
        if (feedInput) feedInput.addEventListener('input', () => { this._runValidation(); this._triggerAutoSave(); });
        if (dwellInput) dwellInput.addEventListener('input', () => { this._runValidation(); this._triggerAutoSave(); });
    }

    // ========== LAYER STACK ==========

    _initLayerStack() {
        const container = document.getElementById('layer-stack');

        this.layerStackUI = new LayerStackUI(container, {
            onLayerChange: () => {
                // Recalculate helical circuits when any layer changes
                const diam = parseFloat(document.getElementById('mandrelDiameter').value);
                if (!isNaN(diam)) {
                    this.layerStackUI.updateAllCalcs(diam);
                }
                this._runValidation();
                this._triggerAutoSave();
            },
            onVisibilityChange: (layerIndex, isVisible) => {
                if (this.viewer3d) {
                    this.viewer3d.setLayerVisibility(layerIndex, isVisible);
                }
                const view2d = document.getElementById('view-2d');
                if (this.coverage2d && this.layerPlans && this.layerPlans.length > 0 && view2d.classList.contains('active')) {
                    const diam = parseFloat(document.getElementById('mandrelDiameter').value);
                    const len = parseFloat(document.getElementById('partLength').value);
                    const progress = parseFloat(document.getElementById('sim-slider').value);
                    const vis = this.layerStackUI.getVisibilityStates();
                    this.coverage2d.draw(this.layerPlans, diam, len, progress, vis);
                }
            }
        });

        // Add layer buttons
        document.getElementById('add-helical-btn').addEventListener('click', () => {
            const width = this.currentMaterial ? this.currentMaterial.nominalWidth : 3.3;
            this.layerStackUI.addLayer('helical', { fiberWidth: width });
            this._triggerAutoSave();
        });

        document.getElementById('add-hoop-btn').addEventListener('click', () => {
            const width = this.currentMaterial ? this.currentMaterial.nominalWidth : 3.3;
            this.layerStackUI.addLayer('hoop', { fiberWidth: width });
            this._triggerAutoSave();
        });
    }

    // ========== GENERATE ==========

    _initGenerateButton() {
        document.getElementById('generate-btn').addEventListener('click', () => {
            this._generate();
        });
    }

    _generate() {
        const loading = document.getElementById('loading-overlay');
        loading.classList.add('active');

        return new Promise((resolve) => {
            // Use setTimeout to allow the loading overlay to render
            setTimeout(() => {
                try {
                    const diam = parseFloat(document.getElementById('mandrelDiameter').value);
                    const length = parseFloat(document.getElementById('partLength').value);
                    const feedRate = parseFloat(document.getElementById('feedRate').value);
                    const dwellSpeed = parseFloat(document.getElementById('dwellSpeed').value);
                    const tiltSpeed = parseFloat(document.getElementById('tiltSpeed').value);

                    if ([diam, length, feedRate, dwellSpeed, tiltSpeed].some(isNaN)) {
                        alert('Check your global settings — invalid numbers detected.');
                        loading.classList.remove('active');
                        return;
                    }

                    const layerStack = this.layerStackUI.getLayerStack();
                    if (layerStack.count === 0) {
                        alert('Add at least one layer before generating.');
                        loading.classList.remove('active');
                        return;
                    }

                    // Build layer params array for path planner
                    // Layer model has .type and .params getters that match PathPlanner's expected format
                    const layers = layerStack.layers;

                    const globalSettings = { feedRate, dwellSpeed, tiltSpeed };
                    const materialThickness = this.currentMaterial ? this.currentMaterial.thicknessPerLayer : 0.125;

                    // Plan all layers
                    const { allSegments, layerPlans } = this.pathPlanner.planAllLayers(
                        diam, length, layers, globalSettings, materialThickness
                    );
                    this.layerPlans = layerPlans;

                    // Generate G-code
                    if (!this.gcodeEngine) {
                        alert('No machine selected.');
                        loading.classList.remove('active');
                        return;
                    }

                    // Calculate production estimates
                    const estimates = this.estimator.estimate(
                        this.layerPlans,
                        diam,
                        length,
                        this.currentMaterial,
                        globalSettings
                    );

                    // Update UI statistics card
                    const statTime = document.getElementById('stat-time');
                    const statLen = document.getElementById('stat-length');
                    const statWeight = document.getElementById('stat-weight');
                    const statCost = document.getElementById('stat-cost');

                    if (statTime) statTime.textContent = estimates.formattedTime;
                    if (statLen) statLen.textContent = `${estimates.totalLengthM} m`;
                    if (statWeight) statWeight.textContent = `${estimates.totalPartWeightG} g`;
                    if (statCost) statCost.textContent = `$${estimates.estimatedCost.toFixed(2)}`;

                    const metadata = {
                        mandrelDiam: diam,
                        partLength: length,
                        materialName: this.currentMaterial ? this.currentMaterial.name : 'Unknown',
                        layerCount: layerStack.count,
                        date: new Date().toISOString(),
                        estimates
                    };

                    this.gcodeString = this.gcodeEngine.generate(allSegments, metadata);

                    // Display G-code
                    document.getElementById('gcode-output').textContent = this.gcodeString;

                    // Update 3D visualization with multi-layer laminate stacking
                    const visStates = this.layerStackUI.getVisibilityStates();
                    this.viewer3d.renderLayers(this.layerPlans, diam, materialThickness, visStates);

                    // Reset playback to 100%
                    this.playback.updateProgress(100);

                    // If 2D view is active, draw it
                    const view2d = document.getElementById('view-2d');
                    if (view2d.classList.contains('active')) {
                        this.coverage2d.draw(this.layerPlans, diam, length, 100, visStates);
                    }

                    this._updateStatusBar();

                } catch (err) {
                    console.error('Generation error:', err);
                    alert('Error during generation: ' + err.message);
                }

                loading.classList.remove('active');
                resolve();
            }, 50);
        });
    }

    // ========== G-CODE CONTROLS ==========

    _initGCodeControls() {
        document.getElementById('copy-btn').addEventListener('click', () => {
            if (this.gcodeString) {
                navigator.clipboard.writeText(this.gcodeString).then(() => {
                    const btn = document.getElementById('copy-btn');
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 1500);
                });
            }
        });

        document.getElementById('download-btn').addEventListener('click', () => {
            if (this.gcodeString) {
                const blob = new Blob([this.gcodeString], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `windstack_${Date.now()}.gcode`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    }

    // ========== TOOLBAR (SAVE/LOAD) ==========

    _initToolbar() {
        const fileInput = document.getElementById('file-input');

        document.getElementById('save-btn').addEventListener('click', () => {
            this._saveProject();
        });

        document.getElementById('load-btn').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this._loadProject(file);
                fileInput.value = ''; // Reset
            }
        });
    }

    _saveProject() {
        const layerStack = this.layerStackUI.getLayerStack();

        const projectData = {
            version: '1.0',
            name: 'WindStack Project',
            created: new Date().toISOString(),
            machine: this.currentMachine ? this.currentMachine.id : null,
            mandrel: {
                diameter: parseFloat(document.getElementById('mandrelDiameter').value),
                length: parseFloat(document.getElementById('partLength').value)
            },
            material: this.currentMaterial ? this.currentMaterial.id : null,
            globalSettings: {
                feedRate: parseFloat(document.getElementById('feedRate').value),
                dwellSpeed: parseFloat(document.getElementById('dwellSpeed').value),
                tiltSpeed: parseFloat(document.getElementById('tiltSpeed').value)
            },
            layers: layerStack.toJSON()
        };

        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `windstack_project_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    _loadProject(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Restore mandrel
                if (data.mandrel) {
                    document.getElementById('mandrelDiameter').value = data.mandrel.diameter;
                    document.getElementById('partLength').value = data.mandrel.length;
                    this.mandrel = new Mandrel(data.mandrel.diameter, data.mandrel.length);
                    this.viewer3d.updateMandrel(data.mandrel.diameter, data.mandrel.length);
                }

                // Restore global settings
                if (data.globalSettings) {
                    document.getElementById('feedRate').value = data.globalSettings.feedRate;
                    document.getElementById('dwellSpeed').value = data.globalSettings.dwellSpeed;
                    document.getElementById('tiltSpeed').value = data.globalSettings.tiltSpeed;
                }

                // Restore machine selection
                if (data.machine) {
                    const machineSelect = document.getElementById('machine-select');
                    machineSelect.value = data.machine;
                    this.currentMachine = this.machines.find(m => m.id === data.machine) || this.machines[0];
                    if (this.currentMachine) {
                        this.gcodeEngine = new GCodeEngine(this.currentMachine);
                    }
                }

                // Restore material selection
                if (data.material) {
                    const materialSelect = document.getElementById('material-select');
                    materialSelect.value = data.material;
                    this.currentMaterial = this.materials.find(m => m.id === data.material) || this.materials[0];
                }

                // Restore layers
                if (data.layers) {
                    const stack = LayerStack.fromJSON(data.layers);
                    this.layerStackUI.loadFromStack(stack);
                }

                this._updateStatusBar();
                console.log('Project loaded successfully');
            } catch (err) {
                console.error('Failed to load project:', err);
                alert('Failed to load project: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ========== VIEW TABS ==========

    _initViewTabs() {
        const tabs = document.querySelectorAll('.tab');
        const views = document.querySelectorAll('.view-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const viewId = tab.dataset.view;

                // Update tab styling
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show/hide views
                views.forEach(v => v.classList.remove('active'));
                document.getElementById(`view-${viewId}`).classList.add('active');

                // Draw 2D map when switching to 2D view
                if (viewId === '2d' && this.layerPlans && this.layerPlans.length > 0) {
                    const diam = parseFloat(document.getElementById('mandrelDiameter').value);
                    const length = parseFloat(document.getElementById('partLength').value);
                    const progress = parseFloat(document.getElementById('sim-slider').value);
                    const visStates = this.layerStackUI ? this.layerStackUI.getVisibilityStates() : [];
                    this.coverage2d.draw(this.layerPlans, diam, length, progress, visStates);
                }
            });
        });

        // 2D coverage view mode toggle (traces vs heatmap)
        const btnTraces = document.getElementById('btn-mode-traces');
        const btnHeatmap = document.getElementById('btn-mode-heatmap');
        if (btnTraces && btnHeatmap) {
            btnTraces.addEventListener('click', () => {
                this.coverage2d.setViewMode('traces');
                btnTraces.classList.add('btn-primary');
                btnTraces.style.background = '#00d2ff';
                btnTraces.style.color = '#000';
                btnHeatmap.classList.remove('btn-primary');
                btnHeatmap.style.background = 'rgba(255,255,255,0.1)';
                btnHeatmap.style.color = '#fff';
            });
            btnHeatmap.addEventListener('click', () => {
                this.coverage2d.setViewMode('heatmap');
                btnHeatmap.classList.add('btn-primary');
                btnHeatmap.style.background = '#00d2ff';
                btnHeatmap.style.color = '#000';
                btnTraces.classList.remove('btn-primary');
                btnTraces.style.background = 'rgba(255,255,255,0.1)';
                btnTraces.style.color = '#fff';
            });
        }
    }

    // ========== AUTO-SAVE & SESSION RESTORE ==========

    _resetNewProject() {
        document.getElementById('mandrelDiameter').value = 22.63;
        document.getElementById('partLength').value = 150;
        document.getElementById('feedRate').value = 8000;
        document.getElementById('dwellSpeed').value = 2000;
        document.getElementById('tiltSpeed').value = 2000;
        this.mandrel = new Mandrel(22.63, 150);
        if (this.viewer3d) this.viewer3d.updateMandrel(22.63, 150);
        this.layerStackUI.clear();
        const width = this.currentMaterial ? this.currentMaterial.nominalWidth : 3.3;
        this.layerStackUI.addLayer('helical', { fiberWidth: width });
        this.gcodeString = '';
        this.layerPlans = [];
        document.getElementById('gcode-output').textContent = '';
        const statTime = document.getElementById('stat-time');
        const statLen = document.getElementById('stat-length');
        const statWeight = document.getElementById('stat-weight');
        const statCost = document.getElementById('stat-cost');
        if (statTime) statTime.textContent = '—';
        if (statLen) statLen.textContent = '—';
        if (statWeight) statWeight.textContent = '—';
        if (statCost) statCost.textContent = '—';
        if (this.viewer3d) this.viewer3d.clearFibers();
        if (this.coverage2d) this.coverage2d.clear();
        this._updateStatusBar();
        this._runValidation();
        this._triggerAutoSave();
    }

    _triggerAutoSave() {
        const badge = document.getElementById('status-autosave');
        if (badge) badge.innerHTML = '<i class="fas fa-sync fa-spin" style="color:#00d2ff;"></i> Saving...';

        if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = setTimeout(() => {
            this._saveToAutoSave();
            if (badge) badge.innerHTML = '<i class="fas fa-check-circle" style="color:#2ecc71;"></i> Auto-saved';
        }, 500);
    }

    _saveToAutoSave() {
        try {
            const layerStack = this.layerStackUI ? this.layerStackUI.getLayerStack() : null;
            const state = {
                mandrel: {
                    diameter: parseFloat(document.getElementById('mandrelDiameter')?.value) || 22.63,
                    length: parseFloat(document.getElementById('partLength')?.value) || 150
                },
                machineId: this.currentMachine ? this.currentMachine.id : null,
                materialId: this.currentMaterial ? this.currentMaterial.id : null,
                globalSettings: {
                    feedRate: parseFloat(document.getElementById('feedRate')?.value) || 8000,
                    dwellSpeed: parseFloat(document.getElementById('dwellSpeed')?.value) || 2000,
                    tiltSpeed: parseFloat(document.getElementById('tiltSpeed')?.value) || 2000
                },
                layers: layerStack ? layerStack.toJSON() : null,
                timestamp: Date.now()
            };
            localStorage.setItem('windstack_autosave', JSON.stringify(state));
        } catch (e) {
            console.warn('Auto-save failed:', e);
        }
    }

    _restoreFromAutoSave() {
        try {
            const raw = localStorage.getItem('windstack_autosave');
            if (!raw) return false;
            const data = JSON.parse(raw);

            if (data.mandrel) {
                document.getElementById('mandrelDiameter').value = data.mandrel.diameter;
                document.getElementById('partLength').value = data.mandrel.length;
                this.mandrel = new Mandrel(data.mandrel.diameter, data.mandrel.length);
                if (this.viewer3d) this.viewer3d.updateMandrel(data.mandrel.diameter, data.mandrel.length);
            }

            if (data.globalSettings) {
                document.getElementById('feedRate').value = data.globalSettings.feedRate;
                document.getElementById('dwellSpeed').value = data.globalSettings.dwellSpeed;
                document.getElementById('tiltSpeed').value = data.globalSettings.tiltSpeed;
            }

            if (data.machineId) {
                const foundM = this.machines.find(m => m.id === data.machineId);
                if (foundM) {
                    this.currentMachine = foundM;
                    this.gcodeEngine = new GCodeEngine(this.currentMachine);
                    const machineSelect = document.getElementById('machine-select');
                    if (machineSelect) machineSelect.value = foundM.id;
                }
            }

            if (data.materialId) {
                const foundMat = this.materials.find(m => m.id === data.materialId);
                if (foundMat) {
                    this.currentMaterial = foundMat;
                    const materialSelect = document.getElementById('material-select');
                    if (materialSelect) materialSelect.value = foundMat.id;
                    const info = document.getElementById('material-info');
                    if (info) info.textContent = `Width: ${foundMat.nominalWidth}mm | Thickness: ${foundMat.thicknessPerLayer}mm | Type: ${foundMat.fiberType}`;
                }
            }

            if (data.layers) {
                const stack = LayerStack.fromJSON(data.layers);
                if (stack.count > 0) {
                    this.layerStackUI.loadFromStack(stack);
                    return true;
                }
            }
        } catch (e) {
            console.warn('Failed to restore from auto-save:', e);
        }
        return false;
    }

    // ========== STATUS BAR ==========

    _updateStatusBar() {
        document.getElementById('status-machine').textContent =
            `Machine: ${this.currentMachine ? this.currentMachine.name : '—'}`;
        document.getElementById('status-material').textContent =
            `Material: ${this.currentMaterial ? this.currentMaterial.name : '—'}`;
        document.getElementById('status-coverage').textContent =
            `Layers: ${this.layerStackUI ? this.layerStackUI.count : 0}`;
    }
}

// ========== BOOTSTRAP ==========
window.addEventListener('load', () => {
    const app = new App();
    app.init();
    window._windstack = app; // Debug access
});
