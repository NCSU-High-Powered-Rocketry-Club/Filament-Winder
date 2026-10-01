"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCoordinate = serializeCoordinate;
exports.interpolateCoordinates = interpolateCoordinates;
// Turn a coordinate into a nicely formatted string
function serializeCoordinate(coordinate) {
    return "{".concat(coordinate["carriage" /* ECoordinateAxes.CARRIAGE */], " ").concat(coordinate["mandrel" /* ECoordinateAxes.MANDREL */], " ").concat(coordinate["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */], "}");
}
// Create an array of evenly-spaced coordinates between two coordinates
function interpolateCoordinates(start, end, steps) {
    var _a;
    if (steps <= 0) {
        throw new Error('Steps cannot be less than 1');
    }
    if (steps === 1) {
        return [end];
    }
    var coordinates = [];
    var carriageStep = (end["carriage" /* ECoordinateAxes.CARRIAGE */] - start["carriage" /* ECoordinateAxes.CARRIAGE */]) / (steps - 1);
    var mandrelStep = (end["mandrel" /* ECoordinateAxes.MANDREL */] - start["mandrel" /* ECoordinateAxes.MANDREL */]) / (steps - 1);
    var deliveryHeadStep = (end["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] - start["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */]) / (steps - 1);
    for (var step = 0; step < steps; step++) {
        coordinates.push((_a = {},
            _a["carriage" /* ECoordinateAxes.CARRIAGE */] = start["carriage" /* ECoordinateAxes.CARRIAGE */] + step * carriageStep,
            _a["mandrel" /* ECoordinateAxes.MANDREL */] = start["mandrel" /* ECoordinateAxes.MANDREL */] + step * mandrelStep,
            _a["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] = start["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] + step * deliveryHeadStep,
            _a));
    }
    return coordinates;
}
//# sourceMappingURL=helpers.js.map