import { Layer } from '../models/layer.js';
import { LayerStack } from '../models/layer-stack.js';
import { LayerEditor } from './layer-editor.js';

/**
 * LayerStackUI — Manages the layer stack container and its layer editor cards.
 * Coordinates layer creation, re-indexing, parameters extraction, visibility states,
 * and drag-and-drop / button-based layer reordering.
 */
export class LayerStackUI {
    /**
     * @param {HTMLElement} container - The #layer-stack div
     * @param {Object} callbacks
     * @param {Function} callbacks.onLayerChange - Called whenever layers are added/removed/modified/reordered
     * @param {Function} [callbacks.onVisibilityChange] - Called when a layer's visibility is toggled
     */
    constructor(container, { onLayerChange, onVisibilityChange }) {
        this.container = container;
        this.onLayerChange = onLayerChange;
        this.onVisibilityChange = onVisibilityChange || (() => {});
        /** @type {LayerEditor[]} */
        this.editors = [];

        this._bindDragContainer();
    }

    _bindDragContainer() {
        const container = this.container;

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingEl = container.querySelector('.layer-item.dragging');
            if (!draggingEl) return;

            const afterElement = this._getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(draggingEl);
            } else {
                container.insertBefore(draggingEl, afterElement);
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            this._reorderFromDOM();
        });
    }

    _getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.layer-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    _reorderFromDOM() {
        const domElements = [...this.container.querySelectorAll('.layer-item')];
        const newEditors = [];

        for (const el of domElements) {
            const ed = this.editors.find(e => e.element === el);
            if (ed) newEditors.push(ed);
        }

        this.editors = newEditors;
        this.editors.forEach((ed, i) => ed.setIndex(i + 1));
        this.onLayerChange();
    }

    /**
     * Add a new layer to the stack.
     * @param {'helical'|'hoop'} type
     * @param {Object} [defaults] - Optional default values
     * @returns {LayerEditor}
     */
    addLayer(type, defaults = {}) {
        const index = this.editors.length + 1;

        const editor = new LayerEditor(type, index, {
            onUpdate: () => this.onLayerChange(),
            onRemove: (ed) => this.removeEditor(ed),
            onVisibilityToggle: (ed, isVisible) => {
                const idx = this.editors.indexOf(ed);
                if (idx !== -1) {
                    this.onVisibilityChange(idx, isVisible);
                }
            },
            onMove: (ed, dir) => this.moveEditor(ed, dir),
            onClone: (ed) => this.cloneEditor(ed)
        }, defaults);

        const el = editor.render();
        this.container.appendChild(el);
        this.editors.push(editor);

        this.onLayerChange();
        return editor;
    }

    /**
     * Duplicate an existing layer editor directly after itself.
     * @param {LayerEditor} editor
     */
    cloneEditor(editor) {
        const fromIdx = this.editors.indexOf(editor);
        if (fromIdx === -1) return;

        const values = editor.getValues();
        const newEditor = new LayerEditor(editor.type, fromIdx + 2, {
            onUpdate: () => this.onLayerChange(),
            onRemove: (ed) => this.removeEditor(ed),
            onVisibilityToggle: (ed, isVisible) => {
                const idx = this.editors.indexOf(ed);
                if (idx !== -1) {
                    this.onVisibilityChange(idx, isVisible);
                }
            },
            onMove: (ed, dir) => this.moveEditor(ed, dir),
            onClone: (ed) => this.cloneEditor(ed)
        }, values);

        const el = newEditor.render();
        this.editors.splice(fromIdx + 1, 0, newEditor);

        if (editor.element.nextSibling) {
            this.container.insertBefore(el, editor.element.nextSibling);
        } else {
            this.container.appendChild(el);
        }

        // Re-index remaining editors and refresh colors
        this.editors.forEach((ed, i) => ed.setIndex(i + 1));
        this.onLayerChange();
        return newEditor;
    }

    /**
     * Move a layer editor up or down in the stack.
     * @param {LayerEditor} editor
     * @param {'up'|'down'} direction
     */
    moveEditor(editor, direction) {
        const fromIdx = this.editors.indexOf(editor);
        if (fromIdx === -1) return;

        const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
        if (toIdx < 0 || toIdx >= this.editors.length) return;

        // Swap in editors array
        const [moved] = this.editors.splice(fromIdx, 1);
        this.editors.splice(toIdx, 0, moved);

        // Update DOM position
        if (toIdx === this.editors.length - 1) {
            this.container.appendChild(editor.element);
        } else {
            const refEditor = this.editors[toIdx + 1];
            this.container.insertBefore(editor.element, refEditor.element);
        }

        // Re-index remaining editors and refresh colors
        this.editors.forEach((ed, i) => ed.setIndex(i + 1));
        this.onLayerChange();
    }

    /**
     * Remove a layer editor from the stack.
     */
    removeEditor(editor) {
        const idx = this.editors.indexOf(editor);
        if (idx === -1) return;

        editor.destroy();
        this.editors.splice(idx, 1);

        // Re-index remaining editors and refresh colors
        this.editors.forEach((ed, i) => ed.setIndex(i + 1));
        this.onLayerChange();
    }

    /**
     * Build a LayerStack model from the current UI state.
     */
    getLayerStack() {
        const stack = new LayerStack();
        for (const editor of this.editors) {
            const values = editor.getValues();
            if (!values) continue;
            stack.addLayer(new Layer(editor.type, values));
        }
        return stack;
    }

    /**
     * Get an array of boolean visibility flags for all layers.
     * @returns {boolean[]}
     */
    getVisibilityStates() {
        return this.editors.map(ed => ed.isVisible);
    }

    /**
     * Update all helical layer calc badges when mandrel diameter changes.
     */
    updateAllCalcs(mandrelDiam) {
        for (const editor of this.editors) {
            editor.updateCalcBadge(mandrelDiam);
        }
    }

    /**
     * Update all layers' fiber width to match a selected material and recalculate circuits.
     * @param {number} width - New fiber width (mm)
     * @param {number} [mandrelDiam] - Optional mandrel diameter for badge update
     */
    updateAllFiberWidths(width, mandrelDiam) {
        if (!width || width <= 0) return;
        for (const editor of this.editors) {
            editor.setFiberWidth(width, mandrelDiam);
        }
        this.onLayerChange();
    }

    /**
     * Restore layers from a LayerStack model (e.g., loading a project or auto-save).
     */
    loadFromStack(layerStack) {
        this.clear();
        for (const layer of layerStack.layers) {
            const defaults = layer.toJSON();
            this.addLayer(layer.type, defaults);
        }
    }

    /**
     * Clear all layers from the UI.
     */
    clear() {
        for (const editor of this.editors) {
            editor.destroy();
        }
        this.editors = [];
        this.container.innerHTML = '';
    }

    get count() {
        return this.editors.length;
    }
}
