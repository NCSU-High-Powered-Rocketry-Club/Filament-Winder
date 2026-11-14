/**
 * Material model class for WindStack.
 * Defines carbon fiber tows, glass rovings, aramid, and custom fibers.
 * Calculates effective tow bandwidth and ply thickness, and manages custom
 * materials in localStorage.
 */
export class Material {
    constructor(config) {
        this._config = config;
    }

    static async loadFromFile(path) {
        const response = await fetch(path);
        const config = await response.json();
        return new Material(config);
    }

    static async loadAll() {
        const materialFiles = [
            'data/materials/carbon-1k.json',
            'data/materials/carbon-3k.json',
            'data/materials/carbon-6k.json',
            'data/materials/carbon-12k.json',
            'data/materials/carbon-24k.json',
            'data/materials/carbon-50k.json',
            'data/materials/glass-e-2400tex.json',
            'data/materials/aramid-kevlar49.json'
        ];
        
        const materials = [];
        for (const file of materialFiles) {
            try {
                materials.push(await Material.loadFromFile(file));
            } catch (err) {
                console.warn(`Could not load material ${file}:`, err);
            }
        }

        // Merge custom user-created materials from localStorage
        const customMaterials = Material.loadCustomMaterials();
        materials.push(...customMaterials);

        return materials;
    }

    static loadCustomMaterials() {
        try {
            const raw = localStorage.getItem('windstack_custom_materials');
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    return arr.map(cfg => new Material(cfg));
                }
            }
        } catch (e) {
            console.warn('Failed to load custom materials from storage:', e);
        }
        return [];
    }

    static saveCustomMaterial(config) {
        try {
            const raw = localStorage.getItem('windstack_custom_materials');
            let arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) arr = [];

            const existingIdx = arr.findIndex(m => m.id === config.id);
            if (existingIdx !== -1) {
                arr[existingIdx] = config;
            } else {
                arr.push(config);
            }
            localStorage.setItem('windstack_custom_materials', JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to save custom material:', e);
        }
    }

    static deleteCustomMaterial(id) {
        try {
            const raw = localStorage.getItem('windstack_custom_materials');
            if (raw) {
                let arr = JSON.parse(raw);
                arr = arr.filter(m => m.id !== id);
                localStorage.setItem('windstack_custom_materials', JSON.stringify(arr));
            }
        } catch (e) {
            console.error('Failed to delete custom material:', e);
        }
    }

    get id() { return this._config.id; }
    get name() { return this._config.name; }
    get fiberType() { return this._config.fiberType || 'carbon'; }
    get towSize() { return this._config.towSize || ''; }
    get filamentCount() { return this._config.filamentCount || null; }
    
    get nominalWidth() { return this._config.nominalWidth || 3.0; }
    get spreadWidthRange() { return this._config.spreadWidthRange || { min: this.nominalWidth, max: this.nominalWidth }; }
    get thicknessPerLayer() { return this._config.thicknessPerLayer || 0.125; }
    get density() { return this._config.density || null; }
    get tensileStrength() { return this._config.tensileStrength || null; }
    get tensileModulus() { return this._config.tensileModulus || null; }
    get costPerKg() { return this._config.costPerKg || null; }

    effectiveWidth(spreadFactor = 0.5) {
        const min = this.spreadWidthRange.min;
        const max = this.spreadWidthRange.max;
        return min + (max - min) * Math.max(0, Math.min(1, spreadFactor));
    }

    toJSON() {
        return this._config;
    }
}
