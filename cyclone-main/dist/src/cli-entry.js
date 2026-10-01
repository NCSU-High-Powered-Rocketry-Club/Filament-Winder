"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const marlin_port_1 = require("./marlin-port");
const planner_1 = require("./planner");
const plotter_1 = require("./plotter");
const helpers_1 = require("yargs/helpers");
const fs_1 = require("fs");
const readline = __importStar(require("readline"));
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
    async handler(argv) {
        const marlin = new marlin_port_1.MarlinPort(argv.port, argv.verbose);
        const marlinInitialized = marlin.initialize();
        const data = await fs_1.promises.readFile(argv.file);
        console.log(`Sending commands from "${argv.file}"`);
        await marlinInitialized;
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.on('keypress', (chunk, key) => {
            if (key && key.name === 'space') {
                if (marlin.isPaused()) {
                    console.log('Resuming machine...');
                    return marlin.resume();
                }
                console.log('Pausing machine, press "space" again to resume after it stops');
                marlin.pause();
            }
        });
        for (const command of data.toString().trim().split('\n')) {
            marlin.queueCommand(command);
        }
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
    async handler(argv) {
        const fileContents = await fs_1.promises.readFile(argv.file, "binary");
        const windDefinition = JSON.parse(fileContents);
        // Todo: Verify contents
        const windCommands = (0, planner_1.planWind)(windDefinition, argv.verbose);
        await fs_1.promises.writeFile(argv.output, windCommands.join('\n'));
        console.log(`Wrote ${windCommands.length} commands to "${argv.output}"`);
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
    async handler(argv) {
        const fileContents = await fs_1.promises.readFile(argv.file, "binary");
        const stream = (0, plotter_1.plotGCode)(fileContents.split('\n'));
        if (typeof stream === 'undefined') {
            console.log('No image to write');
            return void 0;
        }
        const outputFile = (0, fs_1.createWriteStream)(argv.output);
        stream.pipe(outputFile);
        outputFile.on('finish', () => console.log(`The PNG file was created at ${argv.output}`));
    }
})
    .help()
    .parse((0, helpers_1.hideBin)(process.argv));
//# sourceMappingURL=cli-entry.js.map