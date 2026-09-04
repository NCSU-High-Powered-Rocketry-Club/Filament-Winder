"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var marlin_port_1 = require("./marlin-port");
var planner_1 = require("./planner");
var plotter_1 = require("./plotter");
var fs_1 = require("fs");
var readline = require("readline");
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
var hideBin = require('yargs/helpers').hideBin;
// Looks like using yargs most any other way is kind of broken
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
require('yargs').command({
    command: 'run <file>',
    describe: 'Run a gcode file on the machine',
    builder: {
        port: {
            alias: 'p',
            describe: 'Serial port to connect to',
            demandOption: true,
            type: 'string'
        },
        verbose: {
            alias: 'v',
            describe: 'Log every command?',
            default: false,
            type: 'boolean'
        }
    },
    handler: function (argv) {
        return __awaiter(this, void 0, void 0, function () {
            var marlin, marlinInitialized, data, _i, _a, command;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        marlin = new marlin_port_1.MarlinPort(argv.port, argv.verbose);
                        marlinInitialized = marlin.initialize();
                        return [4 /*yield*/, fs_1.promises.readFile(argv.file)];
                    case 1:
                        data = _b.sent();
                        console.log("Sending commands from \"".concat(argv.file, "\""));
                        return [4 /*yield*/, marlinInitialized];
                    case 2:
                        _b.sent();
                        readline.emitKeypressEvents(process.stdin);
                        if (process.stdin.isTTY) {
                            process.stdin.setRawMode(true);
                        }
                        process.stdin.on('keypress', function (chunk, key) {
                            if (key && key.name === 'space') {
                                if (marlin.isPaused()) {
                                    console.log('Resuming machine...');
                                    return marlin.resume();
                                }
                                console.log('Pausing machine, press "space" again to resume after it stops');
                                marlin.pause();
                            }
                        });
                        for (_i = 0, _a = data.toString().trim().split('\n'); _i < _a.length; _i++) {
                            command = _a[_i];
                            marlin.queueCommand(command);
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
})
    .command({
    command: 'plan <file>',
    describe: 'Generate gcode from a .wind file',
    builder: {
        output: {
            alias: 'o',
            describe: 'File to output to',
            demandOption: false,
            type: 'string'
        },
        verbose: {
            alias: 'v',
            describe: 'Include comments explaining segmented moves?',
            default: false,
            type: 'boolean'
        }
    },
    handler: function (argv) {
        return __awaiter(this, void 0, void 0, function () {
            var fileContents, windDefinition, windCommands;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_1.promises.readFile(argv.file, "binary")];
                    case 1:
                        fileContents = _a.sent();
                        windDefinition = JSON.parse(fileContents);
                        windCommands = (0, planner_1.planWind)(windDefinition, argv.verbose);
                        return [4 /*yield*/, fs_1.promises.writeFile(argv.output, windCommands.join('\n'))];
                    case 2:
                        _a.sent();
                        console.log("Wrote ".concat(windCommands.length, " commands to \"").concat(argv.output, "\""));
                        return [2 /*return*/];
                }
            });
        });
    }
})
    .command({
    command: 'plot <file>',
    describe: 'Visualize the contents of a gcode file',
    builder: {
        output: {
            alias: 'o',
            describe: 'PNG file to output to',
            demandOption: true,
            type: 'string'
        }
    },
    handler: function (argv) {
        return __awaiter(this, void 0, void 0, function () {
            var fileContents, stream, outputFile;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_1.promises.readFile(argv.file, "binary")];
                    case 1:
                        fileContents = _a.sent();
                        stream = (0, plotter_1.plotGCode)(fileContents.split('\n'));
                        if (typeof stream === 'undefined') {
                            console.log('No image to write');
                            return [2 /*return*/, void 0];
                        }
                        outputFile = (0, fs_1.createWriteStream)(argv.output);
                        stream.pipe(outputFile);
                        outputFile.on('finish', function () { return console.log("The PNG file was created at ".concat(argv.output)); });
                        return [2 /*return*/];
                }
            });
        });
    }
})
    .help()
    .parse(hideBin(process.argv));
//# sourceMappingURL=cli-entry.js.map