// math-utils: calculations handled via PathPlanner instance
import { PathPlanner } from '../core/path-planner.js';
import { getLayerColor } from '../viz/layer-colors.js';

/**
 * LayerEditor — Creates and manages an individual layer card in the UI.
 * Features:
 * - Dynamic color swatch coordinated with 3D/2D views
 * - Per-layer visibility toggle (eye icon)
 * - Move Up / Move Down reordering controls
 * - HTML5 drag-and-drop reordering handle
 */
export class LayerEditor {
    /**
     * @param {'helical'|'hoop'} type
     * @param {number} index - Display index (1-based)
     * @param {Object} callbacks
     * @param {Function} callbacks.onUpdate - Called when any input changes
     * @param {Function} callbacks.onRemove - Called when delete is clicked
     * @param {Function} callbacks.onVisibilityToggle - Called when eye icon is clicked
     * @param {Function} callbacks.onMove - Called when move up/down is clicked (editor, 'up'|'down')
     * @param {Function} [callbacks.onClone] - Called when duplicate button is clicked
     * @param {Object} [defaults] - Default values for inputs
     */
    constructor(type, index, { onUpdate, onRemove, onVisibilityToggle, onMove, onClone }, defaults = {}) {
        this.type = type;
        this.index = index;
        this.color = getLayerColor(index - 1);
        this.isVisible = true;
        this.onUpdate = onUpdate;
        this.onRemove = onRemove;
        this.onVisibilityToggle = onVisibilityToggle || (() => {});
        this.onMove = onMove || (() => {});
        this.onClone = onClone || (() => {});
        this.defaults = defaults;
        this.element = null;
        this._pathPlanner = new PathPlanner();
    }

    /**
     * Render the layer card and return the DOM element.
     */
    render() {
        const div = document.createElement('div');
        div.className = `layer-item ${this.type}`;
        div.style.borderLeftColor = this.color;
        div.dataset.type = this.type;
        div.dataset.index = this.index;
        div.draggable = true;

        let controlsHTML = '';

        if (this.type === 'helical') {
            controlsHTML = `
                <div class="mini-input">
                    <label>Angle (°)</label>
                    <input type="number" class="l-angle" value="${this.defaults.angle ?? 45}" step="1">
                </div>
                <div class="mini-input">
                    <label>Fiber Width (mm)</label>
                    <input type="number" class="l-width" value="${this.defaults.fiberWidth ?? 3.3}" step="0.1">
                </div>
                <div class="mini-input">
                    <label>Skip Index</label>
                    <input type="number" class="l-skip" value="${this.defaults.skipIndex ?? 5}" step="1" min="1">
                </div>
                <div class="mini-input extra-input">
                    <label>Extra Passes</label>
                    <input type="number" class="l-extra" value="${this.defaults.extraPasses ?? 0}" step="1" min="0">
                </div>
                <div class="mini-input">
                    <label>Lock Deg</label>
                    <input type="number" class="l-lock" value="${this.defaults.lockDegrees ?? 360}" step="1">
                </div>
                <div class="calc-badge">Auto: — Circuits</div>
            `;
        } else {
            controlsHTML = `
                <div class="mini-input">
                    <label>Fiber Width (mm)</label>
                    <input type="number" class="l-width" value="${this.defaults.fiberWidth ?? 3.3}" step="0.1">
                </div>
                <div class="mini-input">
                    <label>Overlap %</label>
                    <input type="number" class="l-overlap" value="${this.defaults.overlapPercent ?? 5}" step="1">
                </div>
                <div class="mini-input">
                    <label>Lock Deg</label>
                    <input type="number" class="l-lock" value="${this.defaults.lockDegrees ?? 360}" step="1">
                </div>
            `;
        }

        div.innerHTML = `
            <div class="layer-header">
                <div class="layer-title-group">
                    <span class="layer-drag-handle" title="Drag to reorder ply sequence"><i class="fas fa-grip-vertical"></i></span>
                    <span class="layer-color-dot" style="background-color: ${this.color};" title="Layer color"></span>
                    <span class="layer-title">#${this.index} ${this.type.toUpperCase()} LAYER</span>
                </div>
                <div class="layer-actions">
                    <button class="btn btn-icon layer-clone-btn" title="Duplicate Layer"><i class="fas fa-clone"></i></button>
                    <button class="btn btn-icon layer-move-btn" data-dir="up" title="Move Layer Up"><i class="fas fa-chevron-up"></i></button>
                    <button class="btn btn-icon layer-move-btn" data-dir="down" title="Move Layer Down"><i class="fas fa-chevron-down"></i></button>
                    <button class="btn btn-icon layer-vis-btn" title="Toggle Layer Visibility">
                        <i class="fas ${this.isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                    <button class="btn btn-danger btn-sm layer-delete" title="Delete Layer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="layer-controls">
                ${controlsHTML}
            </div>
        `;

        // Clone button
        div.querySelector('.layer-clone-btn')?.addEventListener('click', () => this.onClone(this));

        // Visibility Toggle
        const visBtn = div.querySelector('.layer-vis-btn');
        visBtn.addEventListener('click', () => {
            this.isVisible = !this.isVisible;
            visBtn.querySelector('i').className = `fas ${this.isVisible ? 'fa-eye' : 'fa-eye-slash'}`;
            div.classList.toggle('dimmed', !this.isVisible);
            this.onVisibilityToggle(this, this.isVisible);
        });

        // Move Up / Move Down buttons
        div.querySelectorAll('.layer-move-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                this.onMove(this, dir);
            });
        });

        // Delete button
        div.querySelector('.layer-delete').addEventListener('click', () => this.onRemove(this));

        // Input listeners
        div.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.onUpdate(this));
        });

        // Drag and drop event handlers
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', (this.index - 1).toString());
            div.classList.add('dragging');
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
        });

        this.element = div;
        return div;
    }

    /**
     * Get current values from the layer card inputs.
     */
    getValues() {
        if (!this.element) return null;

        const el = this.element;
        const width = parseFloat(el.querySelector('.l-width')?.value);
        const lock = parseFloat(el.querySelector('.l-lock')?.value);

        if (this.type === 'helical') {
            return {
                angle: parseFloat(el.querySelector('.l-angle').value),
                fiberWidth: width,
                skipIndex: parseInt(el.querySelector('.l-skip').value),
                extraPasses: parseInt(el.querySelector('.l-extra').value) || 0,
                lockDegrees: lock
            };
        } else {
            return {
                fiberWidth: width,
                overlapPercent: parseFloat(el.querySelector('.l-overlap').value),
                lockDegrees: lock
            };
        }
    }

    /**
     * Update the auto-calc circuit badge (helical layers only).
     */
    updateCalcBadge(mandrelDiam) {
        if (this.type !== 'helical' || !this.element) return null;

        const values = this.getValues();
        if (!values || [mandrelDiam, values.fiberWidth, values.angle, values.skipIndex].some(isNaN)) return null;

        const angleRad = values.angle * (Math.PI / 180);
        const circuits = this._pathPlanner.calculateCircuits(mandrelDiam, values.fiberWidth, angleRad, values.skipIndex);

        const badge = this.element.querySelector('.calc-badge');
        if (badge) {
            badge.textContent = `Auto-Calc: ${circuits} Circuits`;
        }
        return circuits;
    }

    /**
     * Update the fiber width input value and recalculate circuits.
     * @param {number} width - New fiber width in mm
     * @param {number} [mandrelDiam] - Optional mandrel diameter for circuit badge update
     */
    setFiberWidth(width, mandrelDiam) {
        if (!this.element) return;
        const widthInput = this.element.querySelector('.l-width');
        if (widthInput) {
            widthInput.value = width;
            if (mandrelDiam) {
                this.updateCalcBadge(mandrelDiam);
            }
        }
    }

    /**
     * Update the display index number and refresh color binding.
     */
    setIndex(newIndex) {
        this.index = newIndex;
        this.color = getLayerColor(newIndex - 1);

        if (this.element) {
            this.element.dataset.index = newIndex;
            this.element.style.borderLeftColor = this.color;
            const dot = this.element.querySelector('.layer-color-dot');
            if (dot) dot.style.backgroundColor = this.color;

            const title = this.element.querySelector('.layer-title');
            if (title) {
                title.textContent = `#${newIndex} ${this.type.toUpperCase()} LAYER`;
            }
        }
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}
