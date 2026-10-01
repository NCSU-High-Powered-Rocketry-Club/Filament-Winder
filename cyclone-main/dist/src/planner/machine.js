"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WinderMachine = void 0;
const types_1 = require("./types");
const helpers_1 = require("../helpers");
const helpers_2 = require("./helpers");
// Abstracts generating GCode while performing boundary checking, etc
class WinderMachine {
    verboseOutput;
    gcode = [];
    // Profiler state
    feedRateMMpM = 0;
    totalTimeS = 0;
    totalTowLengthMM = 0;
    lastPosition;
    mandrelDiameter;
    constructor(mandrelDiameter, verboseOutput = false) {
        this.lastPosition = { ["carriage" /* ECoordinateAxes.CARRIAGE */]: 0, ["mandrel" /* ECoordinateAxes.MANDREL */]: 0, ["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */]: 0 };
        this.mandrelDiameter = mandrelDiameter;
        this.verboseOutput = verboseOutput;
    }
    getGCode() {
        return this.gcode;
    }
    addRawGCode(command) {
        this.gcode.push(command);
    }
    setFeedRate(feedRateMMpM) {
        this.feedRateMMpM = feedRateMMpM;
        this.gcode.push(`G0 F${(0, helpers_1.stripPrecision)(feedRateMMpM)}`);
    }
    move(position) {
        // Construct a fully-specified destination coordinate
        // Start with the old position, and replace any values specified in the new one
        const completeEndPosition = { ...this.lastPosition, ...position };
        const doSegmentMove = this.lastPosition["carriage" /* ECoordinateAxes.CARRIAGE */] !== completeEndPosition["carriage" /* ECoordinateAxes.CARRIAGE */];
        // If we don't need to divide the move into multiple segments, run it as just one.
        if (!doSegmentMove) {
            if (this.verboseOutput) {
                this.insertComment(`Move from ${(0, helpers_2.serializeCoordinate)(this.lastPosition)} to ${(0, helpers_2.serializeCoordinate)(completeEndPosition)} as a simple move`);
            }
            return this.moveSegment(position);
        }
        // For segmented moves, divide the total move so each piece has ~1mm of carriage movement
        const numSegments = Math.round(Math.abs(this.lastPosition["carriage" /* ECoordinateAxes.CARRIAGE */] - completeEndPosition["carriage" /* ECoordinateAxes.CARRIAGE */])) + 1;
        if (this.verboseOutput) {
            this.insertComment(`Move from ${(0, helpers_2.serializeCoordinate)(this.lastPosition)} to ${(0, helpers_2.serializeCoordinate)(completeEndPosition)} in ${numSegments} segments`);
        }
        for (let intermediatePosition of (0, helpers_2.interpolateCoordinates)(this.lastPosition, completeEndPosition, numSegments)) {
            this.moveSegment(intermediatePosition);
        }
    }
    setPosition(position) {
        let command = 'G92';
        for (const axis of Object.keys(position)) {
            const rawAxis = types_1.AxisLookup[axis];
            command += ` ${rawAxis}${(0, helpers_1.stripPrecision)(position[axis])}`;
            this.lastPosition[axis] = position[axis];
        }
        this.gcode.push(command);
    }
    // Moves carriage and delivery head to 0, advances the mandrel to the next 0 position and zeros all axes
    zeroAxes(currentAngleDegrees) {
        this.setPosition({
            ["carriage" /* ECoordinateAxes.CARRIAGE */]: 0,
            ["mandrel" /* ECoordinateAxes.MANDREL */]: currentAngleDegrees % 360,
            ["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */]: 0
        });
        this.move({
            ["mandrel" /* ECoordinateAxes.MANDREL */]: 360
        });
        this.setPosition({
            ["mandrel" /* ECoordinateAxes.MANDREL */]: 0,
        });
    }
    insertComment(text) {
        this.gcode.push(`; ${text}`);
    }
    getGCodeTimeS() {
        return this.totalTimeS;
    }
    getTowLengthM() {
        return this.totalTowLengthMM / 1000;
    }
    // Update the mandrel diameter to a new value, useful for incrementing it to account for previous layers
    setMandrelDiameter(mandrelDiameter) {
        this.mandrelDiameter = mandrelDiameter;
    }
    // We have to split up moves into many tiny chunks, because marlin only allows pausing after a command completes
    moveSegment(position) {
        // Distance of the move in "Marlin Units", used for time profiling
        //  Treats mandrel degrees as MM and accounts for delivery head movements, because that's what marlin does
        let totalDistanceMarlinUnitsSq = 0;
        // Total distance of the move in actual MM, taking into account mandrel diameter and ignoring delivery head
        let towLengthMMSq = 0;
        let command = 'G0';
        for (const axis in position) {
            const rawAxis = types_1.AxisLookup[axis];
            command += ` ${rawAxis}${(0, helpers_1.stripPrecision)(position[axis])}`;
            // Everything in this loop below here is just for the profiler
            // Get the amount this axis moved
            const moveComponent = position[axis] - this.lastPosition[axis];
            // Add this onto the tally of "marlin units" that we will use to estimate time
            totalDistanceMarlinUnitsSq += moveComponent ** 2;
            // Handles incrementing tow length
            switch (axis) {
                case "mandrel" /* ECoordinateAxes.MANDREL */: {
                    // Mandrel units are actually degrees, so convert them to arc length
                    const arcLengthMM = moveComponent / 360 * this.mandrelDiameter * Math.PI;
                    towLengthMMSq += arcLengthMM ** 2;
                    break;
                }
                case "carriage" /* ECoordinateAxes.CARRIAGE */: {
                    // Carriage units are just MM
                    towLengthMMSq += moveComponent ** 2;
                    break;
                }
                case "deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */:
                default: {
                    // Do not add delivery head movement onto the tow length because moving it doesn't unspool more
                    break;
                }
            }
            this.lastPosition[axis] = position[axis];
        }
        // Assumes instantaneous acceleration
        this.totalTimeS += totalDistanceMarlinUnitsSq ** 0.5 / this.feedRateMMpM * 60;
        this.totalTowLengthMM += towLengthMMSq ** 0.5;
        this.gcode.push(command);
    }
}
exports.WinderMachine = WinderMachine;
//# sourceMappingURL=machine.js.map