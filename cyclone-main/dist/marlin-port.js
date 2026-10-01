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
exports.MarlinPort = void 0;
var serialport_1 = require("serialport");
var MarlinPort = /** @class */ (function () {
    function MarlinPort(portPath, verbose, baudRate) {
        if (verbose === void 0) { verbose = false; }
        if (baudRate === void 0) { baudRate = 115200; }
        this.portPath = portPath;
        this.verbose = verbose;
        this.baudRate = baudRate;
        this.isInitialized = false;
        this.commandQueue = [];
        this.hasCommandWaiting = false;
        this.pausing = false;
        this.paused = false;
        this.resuming = false;
    }
    MarlinPort.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.isInitialized) {
                    return [2 /*return*/, void 0];
                }
                this.hasCommandWaiting = false;
                this.port = new serialport_1.SerialPort({
                    path: this.portPath,
                    baudRate: this.baudRate,
                    autoOpen: false
                });
                // TODO: .off this in reset
                this.parser = this.port.pipe(new serialport_1.ReadlineParser({ delimiter: '\n' }));
                this.parser.on('data', function (line) {
                    _this.processSerialResponseLine(line);
                });
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        console.log("Opening \"".concat(_this.portPath, "\" at ").concat(_this.baudRate, " baud"));
                        _this.port.open(function (error) {
                            if (error === null || error === void 0 ? void 0 : error.message) {
                                return reject("Error opening port: ".concat(error.message));
                            }
                            console.log('Port opened.\n');
                            _this.isInitialized = true;
                            _this.tryNextCommand();
                            resolve();
                        });
                    })];
            });
        });
    };
    MarlinPort.prototype.reset = function () {
        this.hasCommandWaiting = false;
        this.commandQueue = [];
        this.isInitialized = false;
        return void 0;
    };
    MarlinPort.prototype.queueCommand = function (line) {
        this.commandQueue.push(line);
        this.tryNextCommand();
    };
    MarlinPort.prototype.pause = function () {
        if (this.paused || this.pausing || this.resuming) {
            console.log('Cannot pause when already paused or resuming!');
            return void 0;
        }
        this.pausing = true;
        this.writeCommand('M0');
    };
    MarlinPort.prototype.completePause = function () {
        this.pausing = false;
        this.paused = true;
        console.log('Machine paused.');
    };
    MarlinPort.prototype.isPaused = function () {
        return this.paused || this.pausing;
    };
    MarlinPort.prototype.resume = function () {
        if (!this.paused || this.resuming) {
            console.log('Cannot resume when already resuming or not paused!');
            return void 0;
        }
        this.resuming = true;
        this.writeCommand('M108');
    };
    MarlinPort.prototype.completeResume = function () {
        if (!this.paused || !this.resuming) {
            console.log('Cannot complete resume while not paused or resuming!');
            return void 0;
        }
        this.pausing = false;
        this.paused = false;
        this.resuming = false;
        this.tryNextCommand();
    };
    MarlinPort.prototype.processSerialResponseLine = function (line) {
        if (line === 'ok') {
            this.hasCommandWaiting = false;
            this.tryNextCommand();
            return void 0;
        }
        if (line === 'echo:busy: processing' || line == 'echo:busy: paused for user') {
            return void 0;
        }
        if (line === '//action:notification Click to Resume...') {
            this.completePause();
            return void 0;
        }
        if (line === '//action:notification 3D Printer Ready.') {
            if (!this.resuming) {
                console.log('Saw resume response while not resuming!');
                return void 0;
            }
            this.completeResume();
            return void 0;
        }
        console.log("Got back unexpected response '".concat(line, "'"));
        return void 0;
    };
    MarlinPort.prototype.tryNextCommand = function () {
        if (this.hasCommandWaiting || this.commandQueue.length === 0 || this.paused) {
            return void 0;
        }
        var commandToSend = this.commandQueue.shift();
        if (commandToSend == null)
            return;
        // Check for comments
        if (commandToSend.slice(0, 1) === ';') {
            console.log(commandToSend.slice(1).trim());
            return this.tryNextCommand();
        }
        if (this.verbose) {
            console.log("Sending \"".concat(commandToSend, "\""));
        }
        this.hasCommandWaiting = true;
        this.writeCommand(commandToSend);
    };
    MarlinPort.prototype.writeCommand = function (command) {
        this.port.write("".concat(command, "\n"));
    };
    return MarlinPort;
}());
exports.MarlinPort = MarlinPort;
//# sourceMappingURL=marlin-port.js.map