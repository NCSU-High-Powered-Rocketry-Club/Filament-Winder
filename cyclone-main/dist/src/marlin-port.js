"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarlinPort = void 0;
const serialport_1 = require("serialport");
const helpers_1 = require("./helpers");
class MarlinPort {
    portPath;
    verbose;
    baudRate;
    isInitialized = false;
    port;
    parser;
    commandQueue = [];
    hasCommandWaiting = false;
    pausing = false;
    paused = false;
    resuming = false;
    constructor(portPath, verbose = false, baudRate = 115200) {
        this.portPath = portPath;
        this.verbose = verbose;
        this.baudRate = baudRate;
    }
    async initialize() {
        if (this.isInitialized) {
            return void 0;
        }
        this.hasCommandWaiting = false;
        this.port = new serialport_1.SerialPort({
            path: this.portPath,
            baudRate: this.baudRate,
            autoOpen: false
        });
        // TODO: .off this in reset
        this.parser = this.port.pipe(new serialport_1.ReadlineParser({ delimiter: '\n' }));
        this.parser.on('data', (line) => {
            this.processSerialResponseLine(line);
        });
        return new Promise((resolve, reject) => {
            console.log(`Opening "${this.portPath}" at ${this.baudRate} baud`);
            this.port.open((error) => {
                if ((0, helpers_1.isObject)(error)) {
                    return reject(`Error opening port: ${error.message}`);
                }
                console.log('Port opened.\n');
                this.isInitialized = true;
                this.tryNextCommand();
                resolve();
            });
        });
    }
    reset() {
        this.hasCommandWaiting = false;
        this.commandQueue = [];
        this.isInitialized = false;
        return void 0;
    }
    queueCommand(line) {
        this.commandQueue.push(line);
        this.tryNextCommand();
    }
    pause() {
        if (this.paused || this.pausing || this.resuming) {
            console.log('Cannot pause when already paused or resuming!');
            return void 0;
        }
        this.pausing = true;
        this.writeCommand('M0');
    }
    completePause() {
        this.pausing = false;
        this.paused = true;
        console.log('Machine paused.');
    }
    isPaused() {
        return this.paused || this.pausing;
    }
    resume() {
        if (!this.paused || this.resuming) {
            console.log('Cannot resume when already resuming or not paused!');
            return void 0;
        }
        this.resuming = true;
        this.writeCommand('M108');
    }
    completeResume() {
        if (!this.paused || !this.resuming) {
            console.log('Cannot complete resume while not paused or resuming!');
            return void 0;
        }
        this.pausing = false;
        this.paused = false;
        this.resuming = false;
        this.tryNextCommand();
    }
    processSerialResponseLine(line) {
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
        console.log(`Got back unexpected response '${line}'`);
        return void 0;
    }
    tryNextCommand() {
        if (this.hasCommandWaiting || this.commandQueue.length === 0 || this.paused) {
            return void 0;
        }
        const commandToSend = this.commandQueue.shift();
        // Check for comments
        if (commandToSend.slice(0, 1) === ';') {
            console.log(commandToSend.slice(1).trim());
            return this.tryNextCommand();
        }
        if (this.verbose) {
            console.log(`Sending "${commandToSend}"`);
        }
        this.hasCommandWaiting = true;
        this.writeCommand(commandToSend);
    }
    writeCommand(command) {
        this.port.write(`${command}\n`);
    }
}
exports.MarlinPort = MarlinPort;
//# sourceMappingURL=marlin-port.js.map