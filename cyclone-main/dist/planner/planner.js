"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planWind = planWind;
exports.planHoopLayer = planHoopLayer;
exports.planHelicalLayer = planHelicalLayer;
exports.planSkipLayer = planSkipLayer;
var machine_1 = require("./machine");
var helpers_1 = require("../helpers");
function planWind(windingParameters, verboseOutput) {
    if (verboseOutput === void 0) { verboseOutput = false; }
    var machine = new machine_1.WinderMachine(windingParameters.mandrelParameters.diameter, verboseOutput);
    var headerParameters = {
        mandrel: windingParameters.mandrelParameters,
        tow: windingParameters.towParameters
    };
    machine.insertComment("Parameters ".concat(JSON.stringify(headerParameters)));
    machine.addRawGCode('G0 X0 Y0 Z0');
    machine.setFeedRate(windingParameters.defaultFeedRate);
    // TODO: Run other setup stuff
    var encounteredTerminalLayer = false;
    var layerIndex = 0;
    var cumulativeTimeS = 0;
    var cumulativeTowUseM = 0;
    for (var _i = 0, _a = windingParameters.layers; _i < _a.length; _i++) {
        var layer = _a[_i];
        if (encounteredTerminalLayer) {
            console.warn('WARNING: Attempting to plan a layer after a terminal layer, aborting...');
            break;
        }
        var layerComment = "Layer ".concat(layerIndex + 1, " of ").concat(windingParameters.layers.length, ": ").concat(layer.windType);
        console.log(layerComment);
        machine.insertComment(layerComment);
        switch (layer.windType) {
            case "hoop" /* ELayerType.HOOP */:
                planHoopLayer(machine, {
                    parameters: layer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                encounteredTerminalLayer = encounteredTerminalLayer || layer.terminal;
                break;
            case "helical" /* ELayerType.HELICAL */:
                planHelicalLayer(machine, {
                    parameters: layer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                break;
            case "skip" /* ELayerType.SKIP */:
                planSkipLayer(machine, {
                    parameters: layer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
        }
        // Increment mandrel diameter, etc
        layerIndex += 1;
        console.log("Layer time estimate: ".concat(machine.getGCodeTimeS() - cumulativeTimeS, " seconds"));
        console.log("Layer tow required: ".concat(machine.getTowLengthM() - cumulativeTowUseM, " meters"));
        cumulativeTimeS = machine.getGCodeTimeS();
        cumulativeTowUseM = machine.getTowLengthM();
        console.log('-'.repeat(80));
    }
    // TODO: Run cleanup stuff
    console.log("\nTotal time estimate: ".concat(cumulativeTimeS, " seconds"));
    console.log("Total tow required: ".concat(cumulativeTowUseM, " meters\n"));
    return machine.getGCode();
}
// A layer planning function is responsible for a there-and-back and resetting the coordinates to (0, 0, 0) when done
// They are allowed to just perform a "there" pass if marked as terminal, but an error will be thrown if layers follow
function planHoopLayer(machine, layerParameters) {
    // For now, assume overlap factor of 1.0
    var _a, _b, _c, _d, _e, _f, _g;
    var lockDegrees = 180;
    // Used for the delivery head angle
    var windAngle = 90 - (0, helpers_1.radToDeg)(Math.atan(layerParameters.mandrelParameters.diameter / layerParameters.towParameters.width));
    var mandrelRotatations = layerParameters.mandrelParameters.windLength / layerParameters.towParameters.width;
    var farMandrelPositionDegrees = lockDegrees + (mandrelRotatations * 360);
    var farLockPositionDegrees = farMandrelPositionDegrees + lockDegrees;
    var nearMandrelPositionDegrees = farLockPositionDegrees + (mandrelRotatations * 360);
    var nearLockPositionDegrees = nearMandrelPositionDegrees + lockDegrees;
    // Do a small near lock
    machine.move((_a = {},
        _a["carriage" /* ECoordinateAxes.CARRIAGE */] = 0,
        _a["mandrel" /* ECoordinateAxes.MANDREL */] = lockDegrees,
        _a["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
        _a));
    // Tilt delivery head
    machine.move((_b = {},
        _b["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = -windAngle,
        _b));
    // Wind to the far end of the mandrel
    machine.move((_c = {},
        _c["carriage" /* ECoordinateAxes.CARRIAGE */] = layerParameters.mandrelParameters.windLength,
        _c["mandrel" /* ECoordinateAxes.MANDREL */] = farMandrelPositionDegrees,
        _c));
    // Do a small far lock
    machine.move((_d = {},
        _d["mandrel" /* ECoordinateAxes.MANDREL */] = farLockPositionDegrees,
        _d["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
        _d));
    // If this is a terminal layer, we want to leave the carriage at that end of the machine
    if (layerParameters.parameters.terminal) {
        return void 0;
    }
    // Tilt delivery head
    machine.move((_e = {},
        _e["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = windAngle,
        _e));
    // Wind to the near end of the mandrel
    machine.move((_f = {},
        _f["carriage" /* ECoordinateAxes.CARRIAGE */] = 0,
        _f["mandrel" /* ECoordinateAxes.MANDREL */] = nearMandrelPositionDegrees,
        _f));
    // Do a small near lock
    machine.move((_g = {},
        _g["mandrel" /* ECoordinateAxes.MANDREL */] = nearLockPositionDegrees,
        _g["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
        _g));
    machine.zeroAxes(nearLockPositionDegrees);
}
function planHelicalLayer(machine, layerParameters) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // TODO: move to config values or remove?
    var deliveryHeadPassStartAngle = -10;
    // The portion of each lock that the delivery head rotates back to level during
    var leadOutDegrees = layerParameters.parameters.leadOutDegrees;
    // The portion of the pass on each end during which the delivery head rotates into place
    var windLeadInMM = layerParameters.parameters.leadInMM;
    // The number of degrees that the mandrel rotates through at the ends of each circuit
    var lockDegrees = layerParameters.parameters.lockDegrees;
    // The angle that the delivery head is commanded to during a "there" pass
    var deliveryHeadAngleDegrees = -1 * (90 - layerParameters.parameters.windAngle);
    // Self explanatory
    var mandrelCircumference = Math.PI * layerParameters.mandrelParameters.diameter;
    // Given the tow width and wind angle, what width will one pass of tow occupy when wrapped onto the mandrel
    var towArcLength = layerParameters.towParameters.width / Math.cos((0, helpers_1.degToRad)(layerParameters.parameters.windAngle));
    // Divide the circumference by the tow arc length to get the number of circuits to cover the surface
    // Note that each circuit includes a "there" and a "back" portion, and including both this number of circuits will
    // cover the mandrel twice
    var numCircuits = Math.ceil(mandrelCircumference / towArcLength);
    // After each pattern (<pattern number> cycles evenly spaced around the mandrel) how much to rotate the mandrel
    var patternStepDegrees = 360 * (1 / numCircuits);
    // How many MM the surface of the mandrel should move per pass based on the length and wind angle
    var passRotationMM = layerParameters.mandrelParameters.windLength * Math.tan((0, helpers_1.degToRad)(layerParameters.parameters.windAngle));
    // How many degrees the mandrel should rotate in a pass
    var passRotationDegrees = 360 * (passRotationMM / mandrelCircumference);
    // The number of degrees of mandrel rotation per MM of carriage movement during winding
    var passDegreesPerMM = passRotationDegrees / layerParameters.mandrelParameters.windLength;
    // The number of "start positions", evenly spaced around the mandrel
    var patternNumber = layerParameters.parameters.patternNumber;
    // The number of patterns that will be completed to cover the mandrel
    var numberOfPatterns = numCircuits / layerParameters.parameters.patternNumber;
    // The number of degrees to rotate the mandrel during the lead in
    var leadInDegrees = passDegreesPerMM * windLeadInMM;
    // The number of degrees to rotate the mandrel during the middle (non-leadin) part of a pass
    var mainPassDegrees = passDegreesPerMM * (layerParameters.mandrelParameters.windLength - windLeadInMM);
    // Compute parameters specific to each pass direction
    var passParameters = [
        {
            deliveryHeadSign: 1,
            leadInEndMM: windLeadInMM,
            fullPassEndMM: layerParameters.mandrelParameters.windLength,
        },
        {
            deliveryHeadSign: -1,
            leadInEndMM: layerParameters.mandrelParameters.windLength - windLeadInMM,
            fullPassEndMM: 0,
        }
    ];
    console.log("Doing helical wind, ".concat(numCircuits, " circuits"));
    // TODO: move validation/adjustment to a function
    if (numCircuits % layerParameters.parameters.patternNumber !== 0) {
        console.warn("Circuit number of ".concat(numCircuits, " not divisible by pattern number of ").concat(layerParameters.parameters.patternNumber));
        return void 0;
    }
    if (typeof layerParameters.parameters.skipInitialNearLock === 'undefined' || !layerParameters.parameters.skipInitialNearLock) {
        machine.move((_a = {},
            _a["carriage" /* ECoordinateAxes.CARRIAGE */] = 0,
            _a["mandrel" /* ECoordinateAxes.MANDREL */] = lockDegrees,
            _a["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
            _a));
        machine.setPosition((_b = {},
            _b["mandrel" /* ECoordinateAxes.MANDREL */] = 0,
            _b));
    }
    var mandrelPositionDegrees = 0;
    // The outer loop tracks the number of times we complete the pattern on the mandrel
    for (var patternIndex = 0; patternIndex < numberOfPatterns; patternIndex++) {
        // The inner loop tracks the <pattern number> evenly-spaced start positions around the mandrel in each pattern
        for (var inPatternIndex = 0; inPatternIndex < patternNumber; inPatternIndex++) {
            machine.insertComment("\tPattern: ".concat(patternIndex + 1, "/").concat(numberOfPatterns, " Circuit: ").concat(inPatternIndex + 1, "/").concat(patternNumber));
            for (var _i = 0, passParameters_1 = passParameters; _i < passParameters_1.length; _i++) {
                var passParams = passParameters_1[_i];
                // Wind to the start point for this pass, while tilting the delivery head to clean up from last pass
                machine.move((_c = {},
                    _c["mandrel" /* ECoordinateAxes.MANDREL */] = mandrelPositionDegrees,
                    _c["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
                    _c));
                // Tilt delivery head to the start position for the pass
                machine.move((_d = {},
                    _d["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = passParams.deliveryHeadSign * deliveryHeadPassStartAngle,
                    _d));
                // Wind through the pass lead in, tilting the delivery head into final position
                mandrelPositionDegrees += leadInDegrees;
                machine.move((_e = {},
                    _e["carriage" /* ECoordinateAxes.CARRIAGE */] = passParams.leadInEndMM,
                    _e["mandrel" /* ECoordinateAxes.MANDREL */] = mandrelPositionDegrees,
                    _e["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = passParams.deliveryHeadSign * deliveryHeadAngleDegrees,
                    _e));
                // Wind to the end of the pass
                mandrelPositionDegrees += mainPassDegrees;
                machine.move((_f = {},
                    _f["carriage" /* ECoordinateAxes.CARRIAGE */] = passParams.fullPassEndMM,
                    _f["mandrel" /* ECoordinateAxes.MANDREL */] = mandrelPositionDegrees,
                    _f));
                // Wind through the pass lead in, tilting the delivery head into final position
                mandrelPositionDegrees += leadOutDegrees;
                machine.move((_g = {},
                    _g["mandrel" /* ECoordinateAxes.MANDREL */] = mandrelPositionDegrees,
                    _g["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = passParams.deliveryHeadSign * deliveryHeadPassStartAngle,
                    _g));
                mandrelPositionDegrees += lockDegrees - leadOutDegrees - (passRotationDegrees % 360);
            }
            // Move to the next start position in this pattern
            mandrelPositionDegrees += patternStepDegrees * numCircuits / layerParameters.parameters.patternNumber;
        }
        // Move to the next pattern start position
        mandrelPositionDegrees += patternStepDegrees;
    }
    mandrelPositionDegrees += lockDegrees;
    machine.move((_h = {},
        _h["mandrel" /* ECoordinateAxes.MANDREL */] = mandrelPositionDegrees,
        _h["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
        _h));
    machine.zeroAxes(mandrelPositionDegrees);
}
function planSkipLayer(machine, layerParameters) {
    var _a, _b;
    // Advance the mandrel by the specified number of degrees
    machine.move((_a = {},
        _a["carriage" /* ECoordinateAxes.CARRIAGE */] = 0,
        _a["mandrel" /* ECoordinateAxes.MANDREL */] = layerParameters.parameters.mandrelRotation,
        _a["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = 0,
        _a));
    machine.setPosition((_b = {},
        _b["mandrel" /* ECoordinateAxes.MANDREL */] = 0,
        _b));
}
//# sourceMappingURL=planner.js.map