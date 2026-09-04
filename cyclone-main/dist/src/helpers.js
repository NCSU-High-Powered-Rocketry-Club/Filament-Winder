"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = isObject;
exports.degToRad = degToRad;
exports.radToDeg = radToDeg;
exports.stripPrecision = stripPrecision;
function isObject(value) {
    return typeof value === 'object' && !Array.isArray(value) && value !== null;
}
function degToRad(degrees) {
    return degrees / 180 * Math.PI;
}
function radToDeg(radians) {
    return radians * 180 / Math.PI;
}
// Takes in a floating point number from a calculation and strips extra precision so it can be passed to marlin
function stripPrecision(rawNumber, digits = 6) {
    return Number.parseFloat(rawNumber.toFixed(digits));
}
//# sourceMappingURL=helpers.js.map