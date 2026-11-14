export class Mandrel {
    /**
     * @param {number} diameter - Mandrel diameter in mm
     * @param {number} length - Mandrel length in mm
     */
    constructor(diameter, length) {
        this._diameter = diameter;
        this._length = length;
    }

    get diameter() { return this._diameter; }
    get length() { return this._length; }

    circumference() {
        return Math.PI * this.diameter;
    }

    surfaceArea() {
        return Math.PI * this.diameter * this.length;
    }

    validate(machine) {
        const errors = [];
        if (machine && machine.physicalLimits) {
            const limits = machine.physicalLimits;
            if (limits.maxMandrelDiameter !== null && this.diameter > limits.maxMandrelDiameter) {
                errors.push(`Diameter ${this.diameter} exceeds machine maximum of ${limits.maxMandrelDiameter}`);
            }
            if (limits.maxPartLength !== null && this.length > limits.maxPartLength) {
                errors.push(`Length ${this.length} exceeds machine maximum of ${limits.maxPartLength}`);
            }
        }
        return { valid: errors.length === 0, errors };
    }

    toJSON() {
        return {
            diameter: this.diameter,
            length: this.length
        };
    }

    static fromJSON(json) {
        return new Mandrel(json.diameter, json.length);
    }
}
