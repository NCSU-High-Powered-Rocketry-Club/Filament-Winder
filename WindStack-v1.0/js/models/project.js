import { Mandrel } from './mandrel.js';
import { LayerStack } from './layer-stack.js';

export class Project {
    constructor({ name = "Untitled Project", machineId = null, mandrel = null, materialId = null, globalSettings = {}, layerStack = null } = {}) {
        this.name = name;
        this.machineId = machineId;
        this.mandrel = mandrel instanceof Mandrel ? mandrel : (mandrel ? Mandrel.fromJSON(mandrel) : new Mandrel(50, 200));
        this.materialId = materialId;
        this.globalSettings = {
            feedRate: 8000,
            dwellSpeed: 2000,
            ...globalSettings
        };
        this.layerStack = layerStack instanceof LayerStack ? layerStack : (layerStack ? LayerStack.fromJSON(layerStack) : new LayerStack());
    }

    save() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.toJSON(), null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", this.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    static async load(file) {
        const text = await file.text();
        const json = JSON.parse(text);
        return Project.fromJSON(json);
    }

    saveToStorage() {
        localStorage.setItem('windstack_project', JSON.stringify(this.toJSON()));
    }

    static loadFromStorage() {
        const data = localStorage.getItem('windstack_project');
        if (data) {
            try {
                return Project.fromJSON(JSON.parse(data));
            } catch(e) {
                console.error("Failed to load project from storage", e);
                return null;
            }
        }
        return null;
    }

    exportGCode(gcodeString, filename = null) {
        const finalName = filename || this.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".gcode";
        const blob = new Blob([gcodeString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", finalName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        URL.revokeObjectURL(url);
    }

    toJSON() {
        return {
            name: this.name,
            machineId: this.machineId,
            mandrel: this.mandrel ? this.mandrel.toJSON() : null,
            materialId: this.materialId,
            globalSettings: this.globalSettings,
            layerStack: this.layerStack.toJSON()
        };
    }

    static fromJSON(json) {
        return new Project({
            name: json.name,
            machineId: json.machineId,
            mandrel: json.mandrel,
            materialId: json.materialId,
            globalSettings: json.globalSettings,
            layerStack: json.layerStack
        });
    }
}
