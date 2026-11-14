import { getLayerColorDef } from './layer-colors.js';
import { CoverageAnalyzer } from '../core/coverage-analyzer.js';

/**
 * Coverage2D — High-resolution 2D unwrapped surface coverage map.
 * Supports dual visualization modes:
 * 1. "traces" — Vector-accurate ribbon tow laydown and multi-layer interleaving.
 * 2. "heatmap" — Thermal density analysis showing void gaps and ply thickness hotspots.
 */
export class Coverage2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyzer = new CoverageAnalyzer();
        this.viewMode = 'traces'; // 'traces' | 'heatmap'

        // Cache for last drawn parameters to allow instantaneous mode switching
        this._lastParams = null;
    }

    /**
     * Switch view mode between 'traces' and 'heatmap' and redraw.
     * @param {'traces'|'heatmap'} mode 
     */
    setViewMode(mode) {
        this.viewMode = mode;
        if (this._lastParams) {
            const { layerPlans, mandrelDiam, partLength, progress, visibilityStates } = this._lastParams;
            this.draw(layerPlans, mandrelDiam, partLength, progress, visibilityStates);
        }
    }

    /**
     * Draw multi-layer composite coverage on the unwrapped mandrel plane.
     * 
     * @param {Array} layerPlans - Array of layer plans with segments & parameters
     * @param {number} mandrelDiam - Mandrel diameter (mm)
     * @param {number} partLength - Mandrel winding length (mm)
     * @param {number} progress - 0 to 100 percentage
     * @param {Array<boolean>} [visibilityStates] - Array of boolean visibility flags
     */
    draw(layerPlans, mandrelDiam, partLength, progress = 100, visibilityStates = []) {
        this._lastParams = { layerPlans, mandrelDiam, partLength, progress, visibilityStates };

        if (!layerPlans || layerPlans.length === 0) {
            this.clear();
            return;
        }

        const ctx = this.ctx;
        const circ = Math.PI * mandrelDiam;
        const scale = 4; // 4 pixels per mm

        const maxX = Math.max(partLength, 50);
        const mapWidth = (maxX + 20) * scale;
        const mapHeight = circ * scale;

        this.canvas.width = mapWidth;
        this.canvas.height = mapHeight;

        if (this.viewMode === 'heatmap') {
            this._drawHeatmap(layerPlans, mandrelDiam, partLength, visibilityStates, mapWidth, mapHeight, scale, circ);
        } else {
            this._drawTraces(layerPlans, mandrelDiam, partLength, progress, visibilityStates, mapWidth, mapHeight, scale, circ);
        }

        // Draw common CAD blueprint grid overlay and axis rulers
        this._drawCADGrid(ctx, mapWidth, mapHeight, partLength, scale);

        // Update the 2D overlay legend
        this._updateLegendDOM(layerPlans, visibilityStates);
    }

    /**
     * Draw individual ribbon tow traces across layers.
     */
    _drawTraces(layerPlans, mandrelDiam, partLength, progress, visibilityStates, mapWidth, mapHeight, scale, circ) {
        const ctx = this.ctx;

        // Mandrel Background
        ctx.fillStyle = '#141e28';
        ctx.fillRect(0, 0, mapWidth, mapHeight);

        let totalSegments = 0;
        for (const lp of layerPlans) {
            totalSegments += (lp.segments ? lp.segments.length : 1);
        }

        const targetSegmentCount = Math.floor(totalSegments * (progress / 100));
        let processedSegments = 0;

        for (let i = 0; i < layerPlans.length; i++) {
            const plan = layerPlans[i];
            const isVisible = visibilityStates[i] !== undefined ? visibilityStates[i] : true;
            const segCount = plan.segments ? plan.segments.length : 0;

            if (processedSegments >= targetSegmentCount) break;

            const allowedInLayer = Math.min(segCount, targetSegmentCount - processedSegments);
            processedSegments += segCount;

            if (!isVisible) continue;

            const colorDef = getLayerColorDef(i);
            const fiberWidth = plan.fiberWidth || 3.3;
            const scaledWidth = Math.max(2, fiberWidth * scale);

            this._drawLayerSegments(ctx, plan.segments, allowedInLayer, scale, circ, scaledWidth, colorDef);
        }
    }

    /**
     * Draw 2D density accumulation heatmap.
     */
    _drawHeatmap(layerPlans, mandrelDiam, partLength, visibilityStates, mapWidth, mapHeight, scale, circ) {
        const ctx = this.ctx;
        const analysis = this.analyzer.generateDensityMap(layerPlans, mandrelDiam, partLength, visibilityStates, 160, 90);
        this._lastAnalysis = analysis;

        const nx = analysis.nx;
        const ny = analysis.ny;
        const grid = analysis.grid;

        // Base canvas background
        ctx.fillStyle = '#0a1016';
        ctx.fillRect(0, 0, mapWidth, mapHeight);

        const partEndPx = partLength * scale;
        const cellW = partEndPx / nx;
        const cellH = mapHeight / ny;

        for (let x = 0; x < nx; x++) {
            const px = x * cellW;
            for (let y = 0; y < ny; y++) {
                const py = y * cellH;
                const density = grid[x][y];

                ctx.fillStyle = this._getHeatmapColor(density);
                ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
            }
        }
    }

    /**
     * Convert laminate pass density to a rich composite thermal color.
     * @param {number} d - Continuous density (plies count)
     * @returns {string} CSS RGB color
     */
    _getHeatmapColor(d) {
        if (d < 0.2) return '#0d1622'; // 0 plies: Void / Uncovered
        if (d < 1.0) {
            // 0.2 - 1.0: Transition from dark blue to cyan
            const t = (d - 0.2) / 0.8;
            return `rgb(${Math.round(0 + t * 0)}, ${Math.round(119 + t * 61)}, ${Math.round(182 + t * 34)})`; // #0077b6 -> #00b4d8
        }
        if (d < 2.0) {
            // 1.0 - 2.0: Cyan to Bright Green (target ply)
            const t = d - 1.0;
            return `rgb(${Math.round(0 + t * 46)}, ${Math.round(180 + t * 24)}, ${Math.round(216 - t * 103)})`; // #00b4d8 -> #2ecc71
        }
        if (d < 3.5) {
            // 2.0 - 3.5: Green to Amber Gold
            const t = (d - 2.0) / 1.5;
            return `rgb(${Math.round(46 + t * 195)}, ${Math.round(204 - t * 8)}, ${Math.round(113 - t * 98)})`; // #2ecc71 -> #f1c40f
        }
        // 3.5+: Amber to Coral / Hotspot
        const t = Math.min(1, (d - 3.5) / 2.5);
        return `rgb(${Math.round(241 - t * 10)}, ${Math.round(196 - t * 120)}, ${Math.round(15 + t * 45)})`; // #f1c40f -> #e74c3c
    }

    /**
     * Draw technical grid and dimension tick labels.
     */
    _drawCADGrid(ctx, mapWidth, mapHeight, partLength, scale) {
        ctx.strokeStyle = 'rgba(74, 101, 114, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Circumferential markers (every 45 degrees)
        for (let i = 0; i <= 8; i++) {
            const y = (mapHeight / 8) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(mapWidth, y);
            ctx.stroke();

            ctx.fillStyle = 'rgba(149, 165, 166, 0.65)';
            ctx.font = '10px monospace';
            const deg = i * 45;
            if (i < 8) ctx.fillText(`${deg}°`, 6, y + 12);
        }

        // Longitudinal distance markers (every 25 mm)
        const stepX = 25 * scale;
        for (let x = 0; x <= mapWidth; x += stepX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, mapHeight);
            ctx.stroke();

            const mm = Math.round(x / scale);
            ctx.fillStyle = 'rgba(149, 165, 166, 0.65)';
            ctx.font = '10px monospace';
            ctx.fillText(`${mm}mm`, x + 4, mapHeight - 6);
        }
        ctx.setLineDash([]);

        // Part length boundary marker
        const partEndPx = partLength * scale;
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(partEndPx, 0);
        ctx.lineTo(partEndPx, mapHeight);
        ctx.stroke();
    }

    _drawLayerSegments(ctx, segments, limitCount, scale, circ, scaledWidth, colorDef) {
        if (!segments || segments.length === 0) return;

        let lastX = 0;
        let lastY = 0;
        let initialized = false;

        const maxIndex = Math.min(segments.length, limitCount);

        for (let j = 0; j < maxIndex; j++) {
            const seg = segments[j];
            if (seg.carriage === null && seg.rotation === null) continue;

            const nextX = seg.carriage !== null ? seg.carriage : lastX;
            const nextY = seg.rotation !== null ? seg.rotation : lastY;

            if (!initialized) {
                initialized = true;
                // Fall through to draw from (0,0) to first target
            }

            if (Math.abs(nextX - lastX) > 1e-4 || Math.abs(nextY - lastY) > 1e-4) {
                this._drawWrappedLine(ctx, lastX, lastY, nextX, nextY, scale, circ, scaledWidth, colorDef);
                lastX = nextX;
                lastY = nextY;
            }
        }
    }

    _drawWrappedLine(ctx, x1, y1Deg, x2, y2Deg, scale, circ, lineWidth, colorDef) {
        const dx = x2 - x1;
        const dyDeg = y2Deg - y1Deg;
        const steps = Math.ceil(Math.abs(dyDeg) / 5) + 2;

        let cx = x1;
        let cyDeg = y1Deg;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const nx = x1 + dx * t;
            const nyDeg = y1Deg + dyDeg * t;

            const cyMod = ((cyDeg % 360) + 360) % 360;
            const nyMod = ((nyDeg % 360) + 360) % 360;

            const py1 = (cyMod / 360) * circ * scale;
            const py2 = (nyMod / 360) * circ * scale;
            const px1 = cx * scale;
            const px2 = nx * scale;

            if (Math.abs(nyMod - cyMod) <= 180) {
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = colorDef.hex;
                ctx.globalAlpha = 0.75;
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.stroke();

                ctx.lineWidth = Math.max(1, lineWidth * 0.35);
                ctx.strokeStyle = colorDef.core;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.stroke();
            }

            cx = nx;
            cyDeg = nyDeg;
        }
        ctx.globalAlpha = 1.0;
    }

    _updateLegendDOM(layerPlans, visibilityStates) {
        const legendEl = document.querySelector('.legend-2d');
        if (!legendEl) return;

        const isHeatmap = this.viewMode === 'heatmap';

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334; padding-bottom:5px; margin-bottom:6px;">
                <span style="font-weight:bold; color:#ecf0f1; font-size:0.9em;">2D Coverage Map</span>
                <div style="display:flex; gap:4px;">
                    <button id="btn-mode-traces" class="btn btn-sm ${!isHeatmap ? 'btn-primary' : ''}" style="padding:2px 6px; font-size:0.75em; background:${!isHeatmap ? '#00d2ff' : 'rgba(255,255,255,0.1)'}; color:${!isHeatmap ? '#000' : '#fff'};">Traces</button>
                    <button id="btn-mode-heatmap" class="btn btn-sm ${isHeatmap ? 'btn-primary' : ''}" style="padding:2px 6px; font-size:0.75em; background:${isHeatmap ? '#00d2ff' : 'rgba(255,255,255,0.1)'}; color:${isHeatmap ? '#000' : '#fff'};">Heatmap</button>
                </div>
            </div>
        `;

        if (isHeatmap && this._lastAnalysis) {
            const an = this._lastAnalysis;
            html += `
                <div style="font-size:0.82em; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#aaa;">Overall Coverage:</span>
                        <span style="color:#2ecc71; font-weight:bold;">${an.coveragePct}%</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#aaa;">Uncovered / Voids:</span>
                        <span style="color:${an.voidPct > 2 ? '#e74c3c' : '#2ecc71'}; font-weight:bold;">${an.voidPct}%</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#aaa;">Max Concentration:</span>
                        <span style="color:#f1c40f; font-weight:bold;">${an.maxDensity} plies</span>
                    </div>
                    <!-- Thermal gradient bar -->
                    <div style="margin-top:6px;">
                        <div style="height:8px; border-radius:3px; background:linear-gradient(to right, #0d1622, #0077b6, #2ecc71, #f1c40f, #e74c3c);"></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.7em; color:#888; margin-top:2px;">
                            <span>0 plies</span>
                            <span>1 ply</span>
                            <span>2 plies</span>
                            <span>4+ plies</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            for (let i = 0; i < layerPlans.length; i++) {
                const plan = layerPlans[i];
                const colorDef = getLayerColorDef(i);
                const isVisible = visibilityStates[i] !== undefined ? visibilityStates[i] : true;
                const op = isVisible ? '1' : '0.4';
                const desc = plan.type === 'helical' 
                    ? `${plan.params?.angle || 45}° Helical (${plan.circuits || '—'} c)` 
                    : `Hoop (${plan.params?.overlapPercent || 5}% ovlp)`;

                html += `
                    <div style="display:flex; align-items:center; gap:6px; margin-top:3px; opacity:${op}; font-size:0.82em;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:${colorDef.hex}; flex-shrink:0;"></span>
                        <span style="color:#fff; font-weight:600;">#${i + 1}</span>
                        <span style="color:#bdc3c7;">${desc}</span>
                        ${!isVisible ? '<span style="color:#e74c3c; font-size:0.8em;">(Hidden)</span>' : ''}
                    </div>
                `;
            }
        }

        legendEl.innerHTML = html;

        // Bind mode buttons inside legend
        const btnTraces = legendEl.querySelector('#btn-mode-traces');
        const btnHeatmap = legendEl.querySelector('#btn-mode-heatmap');
        if (btnTraces) btnTraces.addEventListener('click', () => this.setViewMode('traces'));
        if (btnHeatmap) btnHeatmap.addEventListener('click', () => this.setViewMode('heatmap'));
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
