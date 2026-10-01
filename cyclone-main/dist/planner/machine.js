"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WinderMachine = void 0;
var types_1 = require("./types");
var helpers_1 = require("../helpers");
var helpers_2 = require("./helpers");
// Abstracts generating GCode while performing boundary checking, etc
var WinderMachine = /** @class */ (function () {
    function WinderMachine(mandrelDiameter, verboseOutput) {
        var _a;
        if (verboseOutput === void 0) { verboseOutput = false; }
        this.gcode = [];
        // Profiler state
        this.feedRateMMpM = 0;
        this.totalTimeS = 0;
        this.totalTowLengthMM = 0;
        this.lastPosition = (_a = {}, _a["carriage" /* ECoordinateAxes.CARRIAGE */] = 0, _a["mandrel" /* ECoordinateAxes.MANDREL */] = 0, _a["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0, _a);
        this.mandrelDiameter = mandrelDiameter;
        this.verboseOutput = verboseOutput;
    }
    WinderMachine.prototype.getGCode = function () {
        return this.gcode;
    };
    WinderMachine.prototype.addRawGCode = function (command) {
        this.gcode.push(command);
    };
    WinderMachine.prototype.setFeedRate = function (feedRateMMpM) {
        this.feedRateMMpM = feedRateMMpM;
        this.gcode.push("G0 F".concat((0, helpers_1.stripPrecision)(feedRateMMpM)));
    };
    WinderMachine.prototype.move = function (position) {
        // Construct a fully-specified destination coordinate
        // Start with the old position, and replace any values specified in the new one
        var completeEndPosition = __assign(__assign({}, this.lastPosition), position);
        var doSegmentMove = this.lastPosition["carriage" /* ECoordinateAxes.CARRIAGE */] !== completeEndPosition["carriage" /* ECoordinateAxes.CARRIAGE */];
        // If we don't need to divide the move into multiple segments, run it as just one.
        if (!doSegmentMove) {
            if (this.verboseOutput) {
                this.insertComment("Move from ".concat((0, helpers_2.serializeCoordinate)(this.lastPosition), " to ").concat((0, helpers_2.serializeCoordinate)(completeEndPosition), " as a simple move"));
            }
            return this.moveSegment(position);
        }
        // For segmented moves, divide the total move so each piece has ~1mm of carriage movement
        var numSegments = Math.round(Math.abs(this.lastPosition["carriage" /* ECoordinateAxes.CARRIAGE */] - completeEndPosition["carriage" /* ECoordinateAxes.CARRIAGE */])) + 1;
        if (this.verboseOutput) {
            this.insertComment("Move from ".concat((0, helpers_2.serializeCoordinate)(this.lastPosition), " to ").concat((0, helpers_2.serializeCoordinate)(completeEndPosition), " in ").concat(numSegments, " segments"));
        }
        for (var _i = 0, _a = (0, helpers_2.interpolateCoordinates)(this.lastPosition, completeEndPosition, numSegments); _i < _a.length; _i++) {
            var intermediatePosition = _a[_i];
            this.moveSegment(intermediatePosition);
        }
    };
    WinderMachine.prototype.setPosition = function (position) {
        var _a;
        var command = 'G92';
        for (var _i = 0, _b = Object.keys(position); _i < _b.length; _i++) {
            var axis = _b[_i];
            var coordAxis = axis;
            if (coordAxis == null || position[coordAxis] == null || this.lastPosition[coordAxis] == null)
                continue;
            var rawAxis = types_1.AxisLookup[axis];
            command += " ".concat(rawAxis).concat((0, helpers_1.stripPrecision)((_a = position[axis]) !== null && _a !== void 0 ? _a : 0));
            this.lastPosition[coordAxis] = position[axis];
        }
        this.gcode.push(command);
    };
    // Moves carriage and delivery head to 0, advances the mandrel to the next 0 position and zeros all axes
    WinderMachine.prototype.zeroAxes = function (currentAngleDegrees) {
        var _a, _b, _c;
        this.setPosition((_a = {},
            _a["carriage" /* ECoordinateAxes.CARRIAGE */] = 0,
            _a["mandrel" /* ECoordinateAxes.MANDREL */] = currentAngleDegrees % 360,
            _a["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
            _a));
        this.move((_b = {},
            _b["mandrel" /* ECoordinateAxes.MANDREL */] = 360,
            _b));
        this.setPosition((_c = {},
            _c["mandrel" /* ECoordinateAxes.MANDREL */] = 0,
            _c));
    };
    WinderMachine.prototype.insertComment = function (text) {
        this.gcode.push("; ".concat(text));
    };
    WinderMachine.prototype.getGCodeTimeS = function () {
        return this.totalTimeS;
    };
    WinderMachine.prototype.getTowLengthM = function () {
        return this.totalTowLengthMM / 1000;
    };
    // Update the mandrel diameter to a new value, useful for incrementing it to account for previous layers
    WinderMachine.prototype.setMandrelDiameter = function (mandrelDiameter) {
        this.mandrelDiameter = mandrelDiameter;
    };
    // We have to split up moves into many tiny chunks, because marlin only allows pausing after a command completes
    WinderMachine.prototype.moveSegment = function (position) {
        var _a;
        // Distance of the move in "Marlin Units", used for time profiling
        //  Treats mandrel degrees as MM and accounts for delivery head movements, because that's what marlin does
        var totalDistanceMarlinUnitsSq = 0;
        // Total distance of the move in actual MM, taking into account mandrel diameter and ignoring delivery head
        var towLengthMMSq = 0;
        var command = 'G0';
        for (var axis in position) {
            var rawAxis = types_1.AxisLookup[axis];
            var axisValue = (_a = position[axis]) !== null && _a !== void 0 ? _a : 0;
            command += " ".concat(rawAxis).concat((0, helpers_1.stripPrecision)(axisValue));
            // Everything in this loop below here is just for the profiler
            // Get the amount this axis moved
            var moveComponent = axisValue - this.lastPosition[axis];
            // Add this onto the tally of "marlin units" that we will use to estimate time
            totalDistanceMarlinUnitsSq += Math.pow(moveComponent, 2);
            // Handles incrementing tow length
            switch (axis) {
                case "mandrel" /* ECoordinateAxes.MANDREL */: {
                    // Mandrel units are actually degrees, so convert them to arc length
                    var arcLengthMM = moveComponent / 360 * this.mandrelDiameter * Math.PI;
                    towLengthMMSq += Math.pow(arcLengthMM, 2);
                    break;
                }
                case "carriage" /* ECoordinateAxes.CARRIAGE */: {
                    // Carriage units are just MM
                    towLengthMMSq += Math.pow(moveComponent, 2);
                    break;
                }
                case "deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */:
                default: {
                    // Do not add delivery head movement onto the tow length because moving it doesn't unspool more
                    break;
                }
            }
            this.lastPosition[axis] = axisValue;
        }
        // Assumes instantaneous acceleration
        this.totalTimeS += Math.pow(totalDistanceMarlinUnitsSq, 0.5) / this.feedRateMMpM * 60;
        this.totalTowLengthMM += Math.pow(towLengthMMSq, 0.5);
        this.gcode.push(command);
    };
    return WinderMachine;
}());
exports.WinderMachine = WinderMachine;
//# sourceMappingURL=machine.js.map