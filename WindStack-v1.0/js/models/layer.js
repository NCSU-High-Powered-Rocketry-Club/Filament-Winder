export class Layer {
    /**
     * @param {'helical' | 'hoop'} type 
     * @param {Object} params 
     */
    constructor(type, params = {}) {
        this._type = type;
        if (type === 'helical') {
            this._angle = params.angle !== undefined ? params.angle : 45;
            this._fiberWidth = params.fiberWidth !== undefined ? params.fiberWidth : 3.3;
            this._skipIndex = params.skipIndex !== undefined ? params.skipIndex : 5;
            this._extraPasses = params.extraPasses !== undefined ? params.extraPasses : 0;
            this._lockDegrees = params.lockDegrees !== undefined ? params.lockDegrees : 360;
        } else if (type === 'hoop') {
            this._fiberWidth = params.fiberWidth !== undefined ? params.fiberWidth : 3.3;
            this._overlapPercent = params.overlapPercent !== undefined ? params.overlapPercent : 5;
            this._lockDegrees = params.lockDegrees !== undefined ? params.lockDegrees : 360;
        } else {
            throw new Error(`Unknown layer type: ${type}`);
        }
    }

    get type() { return this._type; }

    /** Returns params object matching what PathPlanner expects */
    get params() {
        if (this._type === 'helical') {
            return {
                angle: this._angle,
                fiberWidth: this._fiberWidth,
                skipIndex: this._skipIndex,
                extraPasses: this._extraPasses,
                lockDegrees: this._lockDegrees
            };
        } else {
            return {
                fiberWidth: this._fiberWidth,
                overlapPercent: this._overlapPercent,
                lockDegrees: this._lockDegrees
            };
        }
    }

    get angle() { return this._angle; }
    set angle(val) { this._angle = val; }

    get fiberWidth() { return this._fiberWidth; }
    set fiberWidth(val) { this._fiberWidth = val; }

    get skipIndex() { return this._skipIndex; }
    set skipIndex(val) { this._skipIndex = val; }

    get extraPasses() { return this._extraPasses; }
    set extraPasses(val) { this._extraPasses = val; }

    get lockDegrees() { return this._lockDegrees; }
    set lockDegrees(val) { this._lockDegrees = val; }

    get overlapPercent() { return this._overlapPercent; }
    set overlapPercent(val) { this._overlapPercent = val; }

    toJSON() {
        const data = { type: this.type };
        if (this.type === 'helical') {
            data.angle = this.angle;
            data.fiberWidth = this.fiberWidth;
            data.skipIndex = this.skipIndex;
            data.extraPasses = this.extraPasses;
            data.lockDegrees = this.lockDegrees;
        } else if (this.type === 'hoop') {
            data.fiberWidth = this.fiberWidth;
            data.overlapPercent = this.overlapPercent;
            data.lockDegrees = this.lockDegrees;
        }
        return data;
    }

    static fromJSON(json) {
        return new Layer(json.type, json);
    }
}
