"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCoordinates = generateCoordinates;
// Turn two machine coordinate endpoints into a set of screen-space line segments
function generateCoordinates(start, end) {
    // Are both endpoints in the same modulo? If so, mod360 and return
    if (Math.floor(start.y / 360) === Math.floor(end.y / 360)) {
        return [[{ x: start.x, y: start.y % 360 }, { x: end.x, y: end.y % 360 }]];
    }
    // If not, calc the intersection point between the ray and the relevant edge
    var slope = (end.y - start.y) / (end.x - start.x);
    var currentSegmentEndY = 0;
    var nextSegmentStartY = 360 * Math.floor(start.y / 360);
    var nextSegmentStartYAdj = -0.001; // TODO: refactor this to not care if the segment ends on 360N
    if (end.y > start.y) {
        currentSegmentEndY = 360;
        nextSegmentStartY = 360 * Math.ceil(start.y / 360);
        nextSegmentStartYAdj = 0.001;
    }
    var currentSegmentEndX = start.x + ((nextSegmentStartY - start.y) * (1 / slope));
    return [[{ x: start.x, y: start.y % 360 }, { x: currentSegmentEndX, y: currentSegmentEndY }]].concat(generateCoordinates({ x: currentSegmentEndX, y: nextSegmentStartY + nextSegmentStartYAdj }, end));
}
//# sourceMappingURL=helpers.js.map