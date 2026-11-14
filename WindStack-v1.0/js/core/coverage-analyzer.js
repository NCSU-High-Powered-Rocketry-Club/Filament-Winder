import { circumference, projectedWidth } from './math-utils.js';

/**
 * CoverageAnalyzer — Analyzes fiber tow distribution, gap/overlap percentages,
 * and generates high-resolution 2D discrete density heatmaps across the unwrapped mandrel.
 */
export class CoverageAnalyzer {
    /**
     * Compute analytical coverage metrics for a single layer.
     */
    analyze(layerPlan, mandrelDiam, fiberWidth, angle) {
        if (layerPlan.type === 'helical') {
            const circ = circumference(mandrelDiam);
            const angleRad = angle * (Math.PI / 180);
            const projWidth = projectedWidth(fiberWidth, angleRad);
            const circuits = layerPlan.circuits || 1;
            const totalCoverage = (circuits * projWidth) / circ * 100;
            const gapPercent = totalCoverage < 100 ? 100 - totalCoverage : 0;
            const overlapPercent = totalCoverage > 100 ? totalCoverage - 100 : 0;
            let qualityScore = 100;
            if (totalCoverage < 95) qualityScore -= (95 - totalCoverage) * 2;
            if (totalCoverage > 105) qualityScore -= (totalCoverage - 105) * 2;
            qualityScore = Math.max(0, Math.min(100, qualityScore));
            return { totalCoverage, gapPercent, overlapPercent, qualityScore };
        } else if (layerPlan.type === 'hoop') {
            const overlapPercent = layerPlan.params?.overlapPercent || 0;
            const totalCoverage = 100 + overlapPercent;
            const gapPercent = 0;
            const qualityScore = 100;
            return { totalCoverage, gapPercent, overlapPercent, qualityScore };
        }
        return { totalCoverage: 0, gapPercent: 100, overlapPercent: 0, qualityScore: 0 };
    }

    /**
     * Generate a 2D discrete cell accumulation grid for multi-layer density heatmap analysis.
     * 
     * @param {Array} layerPlans - Planned layers with motion segments
     * @param {number} mandrelDiam - Mandrel diameter (mm)
     * @param {number} partLength - Part length (mm)
     * @param {Array<boolean>} [visibilityStates] - Layer visibility flags
     * @param {number} [nx=150] - Longitudinal grid divisions
     * @param {number} [ny=90] - Circumferential grid divisions (4 degrees per cell)
     * @returns {{coveragePct: number, voidPct: number, minDensity: number, maxDensity: number, meanDensity: number, grid: number[][], nx: number, ny: number}}
     */
    generateDensityMap(layerPlans, mandrelDiam, partLength, visibilityStates = [], nx = 150, ny = 90) {
        // Initialize empty density grid [nx][ny]
        const grid = Array.from({ length: nx }, () => new Float32Array(ny));

        if (!layerPlans || layerPlans.length === 0 || partLength <= 0 || mandrelDiam <= 0) {
            return {
                coveragePct: 0,
                voidPct: 100,
                minDensity: 0,
                maxDensity: 0,
                meanDensity: 0,
                grid,
                nx,
                ny
            };
        }

        const circ = Math.PI * mandrelDiam;

        // Process each visible layer
        for (let l = 0; l < layerPlans.length; l++) {
            const plan = layerPlans[l];
            const isVis = visibilityStates[l] !== undefined ? visibilityStates[l] : true;
            if (!isVis || !plan.segments || plan.segments.length === 0) continue;

            const fiberWidth = plan.fiberWidth || 3.3;
            const cellWidthX = partLength / nx;
            const cellWidthY = circ / ny;

            // Half-bandwidth footprint in grid cell units
            const halfCellsX = Math.max(1, Math.round((fiberWidth / cellWidthX) * 0.5));
            const halfCellsY = Math.max(1, Math.round((fiberWidth / cellWidthY) * 0.5));

            let curX = 0;
            let curY = 0;
            let init = false;

            for (const seg of plan.segments) {
                if (seg.carriage === null && seg.rotation === null) continue;

                const targetX = seg.carriage !== null ? seg.carriage : curX;
                const targetY = seg.rotation !== null ? seg.rotation : curY;

                if (!init) {
                    init = true;
                    // Fall through to interpolate from (0,0) to first target
                }

                const dx = targetX - curX;
                const dy = targetY - curY;

                // Subdivide the move into small samples
                const distLinear = Math.abs(dx);
                const distRotary = (Math.abs(dy) / 360) * circ;
                const distTotal = Math.sqrt(distLinear * distLinear + distRotary * distRotary);
                const steps = Math.max(2, Math.ceil(distTotal / Math.min(cellWidthX, cellWidthY)));

                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const sampleX = curX + dx * t;
                    const sampleY = curY + dy * t;

                    // Map to grid coordinates
                    const ix = Math.floor((sampleX / partLength) * nx);
                    if (ix < 0 || ix >= nx) continue;

                    // Modulo 360 degrees for circumferential coordinate
                    const degMod = ((sampleY % 360) + 360) % 360;
                    const iy = Math.floor((degMod / 360) * ny);

                    // Splat fiber footprint into surrounding cells
                    for (let ox = -halfCellsX; ox <= halfCellsX; ox++) {
                        const targetIx = ix + ox;
                        if (targetIx < 0 || targetIx >= nx) continue;

                        for (let oy = -halfCellsY; oy <= halfCellsY; oy++) {
                            const targetIy = (iy + oy + ny) % ny;
                            // Add fraction proportional to coverage
                            grid[targetIx][targetIy] += (1 / (steps * 0.5 + 1));
                        }
                    }
                }

                curX = targetX;
                curY = targetY;
            }
        }

        // Calculate coverage and density statistics
        let coveredCount = 0;
        let totalCells = nx * ny;
        let maxDensity = 0;
        let minDensity = Infinity;
        let sumDensity = 0;

        for (let x = 0; x < nx; x++) {
            for (let y = 0; y < ny; y++) {
                const val = grid[x][y];
                if (val >= 0.5) {
                    coveredCount++;
                }
                if (val > maxDensity) maxDensity = val;
                if (val < minDensity) minDensity = val;
                sumDensity += val;
            }
        }

        if (minDensity === Infinity) minDensity = 0;

        const coveragePct = Math.round((coveredCount / totalCells) * 1000) / 10;
        const voidPct = Math.round((100 - coveragePct) * 10) / 10;
        const meanDensity = Math.round((sumDensity / totalCells) * 10) / 10;

        return {
            coveragePct,
            voidPct,
            minDensity: Math.round(minDensity * 10) / 10,
            maxDensity: Math.round(maxDensity * 10) / 10,
            meanDensity,
            grid,
            nx,
            ny
        };
    }
}
