"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCoordinate = serializeCoordinate;
exports.interpolateCoordinates = interpolateCoordinates;
// Turn a coordinate into a nicely formatted string
function serializeCoordinate(coordinate) {
    return `{${coordinate["carriage" /* ECoordinateAxes.CARRIAGE */]} ${coordinate["mandrel" /* ECoordinateAxes.MANDREL */]} ${coordinate["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */]}}`;
}
// Create an array of evenly-spaced coordinates between two coordinates
function interpolateCoordinates(start, end, steps) {
    if (steps <= 0) {
        throw new Error('Steps cannot be less than 1');
    }
    if (steps === 1) {
        return [end];
    }
    const coordinates = [];
    const carriageStep = (end["carriage" /* ECoordinateAxes.CARRIAGE */] - start["carriage" /* ECoordinateAxes.CARRIAGE */]) / (steps - 1);
    const mandrelStep = (end["mandrel" /* ECoordinateAxes.MANDREL */] - start["mandrel" /* ECoordinateAxes.MANDREL */]) / (steps - 1);
    const deliveryHeadStep = (end["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] - start["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */]) / (steps - 1);
    for (let step = 0; step < steps; step++) {
        coordinates.push({
            ["carriage" /* ECoordinateAxes.CARRIAGE */]: start["carriage" /* ECoordinateAxes.CARRIAGE */] + step * carriageStep,
            ["mandrel" /* ECoordinateAxes.MANDREL */]: start["mandrel" /* ECoordinateAxes.MANDREL */] + step * mandrelStep,
            ["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */]: start["deliveryHead" /* ECoordinateAxes.DELIVERY_HEAD */] + step * deliveryHeadStep
        });
    }
    return coordinates;
}
//# sourceMappingURL=helpers.js.map