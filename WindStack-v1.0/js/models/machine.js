/**
 * Machine model class for WindStack.
 * Parses machine specifications, maps axis kinematics, verifies motion bounds,
 * and manages custom machines stored in localStorage.
 */
export class Machine {
    constructor(config) {
        this._config = config;
    }

    static async loadFromFile(path) {
        const response = await fetch(path);
        const config = await response.json();
        return new Machine(config);
    }

    static async loadAll() {
        const builtInFiles = [
            'data/machines/klipper-2axis.json',
            'data/machines/klipper-3axis.json',
            'data/machines/klipper-4axis.json',
            'data/machines/marlin-2axis.json',
            'data/machines/grbl-2axis.json',
            'data/machines/linuxcnc-2axis.json'
        ];
        
        const machines = [];
        for (const file of builtInFiles) {
            try {
                machines.push(await Machine.loadFromFile(file));
            } catch (err) {
                console.warn(`Could not load machine config ${file}:`, err);
            }
        }

        // Merge custom user-created machines from localStorage
        const customMachines = Machine.loadCustomMachines();
        machines.push(...customMachines);

        return machines;
    }

    static loadCustomMachines() {
        try {
            const raw = localStorage.getItem('windstack_custom_machines');
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    return arr.map(cfg => new Machine(cfg));
                }
            }
        } catch (e) {
            console.warn('Failed to load custom machines from storage:', e);
        }
        return [];
    }

    static saveCustomMachine(config) {
        try {
            const raw = localStorage.getItem('windstack_custom_machines');
            let arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) arr = [];
            
            const existingIdx = arr.findIndex(m => m.id === config.id);
            if (existingIdx !== -1) {
                arr[existingIdx] = config;
            } else {
                arr.push(config);
            }
            localStorage.setItem('windstack_custom_machines', JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to save custom machine:', e);
        }
    }

    static deleteCustomMachine(id) {
        try {
            const raw = localStorage.getItem('windstack_custom_machines');
            if (raw) {
                let arr = JSON.parse(raw);
                arr = arr.filter(m => m.id !== id);
                localStorage.setItem('windstack_custom_machines', JSON.stringify(arr));
            }
        } catch (e) {
            console.error('Failed to delete custom machine:', e);
        }
    }

    get id() { return this._config.id; }
    get name() { return this._config.name; }
    get description() { return this._config.description || ''; }
    get controllerType() { return this._config.controller?.type || 'klipper'; }
    
    get axes() { return this._config.axes || []; }

    getAxis(functionName) {
        return this.axes.find(a => a.function === functionName) || null;
    }

    getCarriageAxis() { return this.getAxis('carriage'); }
    getMandrelAxis() { return this.getAxis('mandrel_rotation'); }
    getPayoutAxis() { return this.getAxis('payout_tilt'); }
    getCrossFeedAxis() { return this.getAxis('cross_feed'); }
    
    hasPayoutTilt() {
        return this.getPayoutAxis() !== null;
    }

    get gcodeConfig() { return this._config.gcode || {}; }
    get turnaroundConfig() { return this._config.turnaround || {}; }
    get physicalLimits() { return this._config.physicalLimits || {}; }

    /**
     * Validate this machine profile structure.
     */
    validateProfile() {
        const errors = [];
        if (!this.getCarriageAxis()) errors.push("Machine must have an axis with function 'carriage'.");
        if (!this.getMandrelAxis()) errors.push("Machine must have an axis with function 'mandrel_rotation'.");
        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate winding parameters and mandrel dimensions against machine limits.
     * @param {Object} mandrel - Mandrel instance
     * @param {Object} [globalSettings] - { feedRate, dwellSpeed }
     * @returns {{valid: boolean, errors: string[], warnings: string[]}}
     */
    validateConstraints(mandrel, globalSettings) {
        const errors = [];
        const warnings = [];

        const carriage = this.getCarriageAxis();
        const mandrelAxis = this.getMandrelAxis();

        if (!carriage) errors.push("Machine lacks a carriage axis.");
        if (!mandrelAxis) errors.push("Machine lacks a mandrel rotation axis.");

        if (mandrel) {
            if (carriage && carriage.range && carriage.range.max !== null) {
                if (mandrel.length > carriage.range.max) {
                    warnings.push(`Part length (${mandrel.length}mm) exceeds carriage travel limit (${carriage.range.max}mm).`);
                }
            }
            if (this.physicalLimits && this.physicalLimits.maxPartLength !== null) {
                if (mandrel.length > this.physicalLimits.maxPartLength) {
                    warnings.push(`Part length (${mandrel.length}mm) exceeds machine maximum length (${this.physicalLimits.maxPartLength}mm).`);
                }
            }
            if (this.physicalLimits && this.physicalLimits.maxMandrelDiameter !== null) {
                if (mandrel.diameter > this.physicalLimits.maxMandrelDiameter) {
                    warnings.push(`Mandrel diameter (${mandrel.diameter}mm) exceeds machine maximum diameter (${this.physicalLimits.maxMandrelDiameter}mm).`);
                }
            }
        }

        if (globalSettings) {
            if (carriage && carriage.maxSpeed && globalSettings.feedRate > carriage.maxSpeed) {
                warnings.push(`Feed rate (${globalSettings.feedRate} mm/min) exceeds carriage max speed (${carriage.maxSpeed} mm/min).`);
            }
            if (mandrelAxis && mandrelAxis.maxSpeed && globalSettings.dwellSpeed > mandrelAxis.maxSpeed) {
                warnings.push(`Dwell/turnaround speed (${globalSettings.dwellSpeed} deg/min) exceeds spindle max speed (${mandrelAxis.maxSpeed} deg/min).`);
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    toJSON() {
        return this._config;
    }
}
