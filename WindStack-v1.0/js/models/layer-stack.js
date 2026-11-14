import { Layer } from './layer.js';

export class LayerStack {
    constructor() {
        /** @type {Layer[]} */
        this._layers = [];
    }

    get layers() {
        return this._layers;
    }

    get count() {
        return this._layers.length;
    }

    addLayer(layer) {
        this._layers.push(layer);
        return this;
    }

    removeLayer(index) {
        if (index >= 0 && index < this.count) {
            this._layers.splice(index, 1);
        }
    }

    moveLayer(fromIdx, toIdx) {
        if (fromIdx >= 0 && fromIdx < this.count && toIdx >= 0 && toIdx < this.count) {
            const [layer] = this._layers.splice(fromIdx, 1);
            this._layers.splice(toIdx, 0, layer);
        }
    }

    getLayer(index) {
        return this._layers[index];
    }

    getEffectiveRadius(upToLayerIndex, mandrelDiameter, materialThickness) {
        let radius = mandrelDiameter / 2;
        const limit = Math.min(upToLayerIndex, this.count);
        for (let i = 0; i < limit; i++) {
            radius += materialThickness; // Simplified: assuming constant material thickness per layer
        }
        return radius;
    }

    clear() {
        this._layers = [];
    }

    toJSON() {
        return {
            layers: this._layers.map(layer => layer.toJSON())
        };
    }

    static fromJSON(json) {
        const stack = new LayerStack();
        if (json && Array.isArray(json.layers)) {
            json.layers.forEach(layerJson => {
                stack.addLayer(Layer.fromJSON(layerJson));
            });
        }
        return stack;
    }
}
