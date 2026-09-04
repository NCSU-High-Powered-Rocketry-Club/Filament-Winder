"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plotGCode = plotGCode;
var canvas_1 = require("canvas");
var helpers_1 = require("./helpers");
function plotGCode(gcode) {
    // Look for a header and abort early if we don't find one in the first line
    var headerLineParts = gcode[0].split(' ');
    if (!(headerLineParts[0] === ';' && headerLineParts[1] === 'Parameters')) {
        console.log('Did not find header comment in first line');
        return void 0;
    }
    // TODO: validate these
    var windingParameters = JSON.parse(headerLineParts.slice(2).join(' '));
    var canvas = (0, canvas_1.createCanvas)(windingParameters.mandrel.windLength, 360);
    var ctx = canvas.getContext('2d');
    var xCoord = 0;
    var yCoord = 0;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var _i = 0, gcode_1 = gcode; _i < gcode_1.length; _i++) {
        var line = gcode_1[_i];
        var lineParts = line.split(' ');
        if (lineParts[0] === ';') {
            // Comment, nothing to do
            continue;
        }
        if (lineParts[0] !== 'G0') {
            console.log("Unknown gcode line: '".concat(line, "', skipping"));
            continue;
        }
        var nextXCoord = xCoord;
        var nextYCoord = yCoord;
        for (var _a = 0, _b = lineParts.slice(1); _a < _b.length; _a++) {
            var coordinate = _b[_a];
            if (coordinate[0] === 'X') {
                nextXCoord = Number.parseFloat(coordinate.slice(1));
            }
            if (coordinate[0] === 'Y') {
                nextYCoord = Number.parseFloat(coordinate.slice(1));
            }
        }
        for (var _c = 0, _d = (0, helpers_1.generateCoordinates)({ x: xCoord, y: yCoord }, { x: nextXCoord, y: nextYCoord }); _c < _d.length; _c++) {
            var segment = _d[_c];
            ctx.strokeStyle = 'rgb(73, 0, 168)';
            ctx.lineWidth = windingParameters.tow.width;
            ctx.beginPath();
            for (var _e = 0, segment_1 = segment; _e < segment_1.length; _e++) {
                var point = segment_1[_e];
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
            ctx.strokeStyle = 'rgb(252, 211, 3)';
            ctx.lineWidth = windingParameters.tow.width * 0.75;
            ctx.beginPath();
            for (var _f = 0, segment_2 = segment; _f < segment_2.length; _f++) {
                var point = segment_2[_f];
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
        }
        xCoord = nextXCoord;
        yCoord = nextYCoord;
    }
    return canvas.createPNGStream();
}
//# sourceMappingURL=plot.js.map