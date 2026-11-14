/**
 * ProductionEstimator — Calculates winding cycle duration, fiber tow consumption,
 * composite part weight, and raw material cost based on machine kinematics and material properties.
 */
export class ProductionEstimator {
    /**
     * Estimate complete job metrics for the wound part.
     * 
     * @param {Array} layerPlans - Array of planned layers from PathPlanner
     * @param {number} mandrelDiam - Mandrel diameter (mm)
     * @param {number} partLength - Mandrel winding length (mm)
     * @param {Object} material - Material instance
     * @param {Object} globalSettings - { feedRate, dwellSpeed }
     * @returns {{totalLengthM: number, totalTimeSec: number, formattedTime: string, fiberWeightG: number, totalPartWeightG: number, estimatedCost: number}}
     */
    estimate(layerPlans, mandrelDiam, partLength, material, globalSettings) {
        if (!layerPlans || layerPlans.length === 0) {
            return {
                totalLengthM: 0,
                totalTimeSec: 0,
                formattedTime: '0m 00s',
                fiberWeightG: 0,
                totalPartWeightG: 0,
                estimatedCost: 0
            };
        }

        const feedRate = globalSettings?.feedRate || 8000; // mm/min
        const dwellSpeed = globalSettings?.dwellSpeed || 2000; // deg/min
        const circ = Math.PI * mandrelDiam;

        let totalLengthMm = 0;
        let totalTimeSec = 0;

        for (const plan of layerPlans) {
            const diam = plan.effectiveDiameter || mandrelDiam;
            const layerCirc = Math.PI * diam;

            if (plan.type === 'helical') {
                const angle = plan.params?.angle || 45;
                const angleRad = angle * (Math.PI / 180);
                const circuits = plan.circuits || 10;
                const extra = plan.params?.extraPasses || 0;
                const lockDeg = plan.params?.lockDegrees ?? 360;
                const totalLoops = circuits + extra;
                const passes = totalLoops * 2; // 1 forward + 1 reverse per loop

                // Traverse: fiber path length along cylindrical helix
                const singlePassFiberLen = partLength / Math.cos(angleRad);
                const traverseFiberLen = passes * singlePassFiberLen;

                // Turnaround dwell fiber length
                const dwellDegreesTotal = passes * lockDeg;
                const dwellFiberLen = (dwellDegreesTotal / 360) * layerCirc;

                totalLengthMm += (traverseFiberLen + dwellFiberLen);

                // Time calculation:
                // Carriage travel time (X traverses at feedRate mm/min)
                const traverseTimeSec = ((partLength * passes) / feedRate) * 60;
                // Dwell rotation time (Y rotates at dwellSpeed deg/min)
                const dwellTimeSec = (dwellDegreesTotal / dwellSpeed) * 60;
                // Payout tilt time (head tilts at 2000 deg/min)
                const tiltAngle = (90 - angle) + 35;
                const tiltTimeSec = ((tiltAngle * passes) / 2000) * 60;

                totalTimeSec += (traverseTimeSec + dwellTimeSec + tiltTimeSec);

            } else if (plan.type === 'hoop') {
                const width = plan.params?.fiberWidth || material?.nominalWidth || 3.3;
                const overlap = plan.params?.overlapPercent ?? 5;
                const pitch = width * (1 - (overlap / 100));
                const rots = partLength / (pitch || 1);
                const degs = rots * 360;
                const lockDeg = plan.params?.lockDegrees ?? 360;

                // 2 passes (forward + reverse)
                const hoopFiberLen = 2 * (rots * layerCirc);
                const dwellFiberLen = (2 * lockDeg / 360) * layerCirc;

                totalLengthMm += (hoopFiberLen + dwellFiberLen);

                // Hoop carriage traverses partLength at feedRate
                const traverseTimeSec = ((partLength * 2) / feedRate) * 60;
                const dwellTimeSec = ((lockDeg * 2) / dwellSpeed) * 60;
                const tiltTimeSec = (35 / 2000) * 60;

                totalTimeSec += (traverseTimeSec + dwellTimeSec + tiltTimeSec);
            }
        }

        // Account for machine acceleration/deceleration overhead (+8%)
        totalTimeSec *= 1.08;

        const totalLengthM = Math.round((totalLengthMm / 1000) * 10) / 10;

        // Weight estimation:
        // Volume in cm3 = (Length in cm) * (Width in cm) * (Thickness in cm)
        const density = material?.density || 1.78; // g/cm³ for carbon fiber
        const nomWidthCm = (material?.nominalWidth || 3.0) / 10;
        const thicknessCm = (material?.thicknessPerLayer || 0.125) / 10;
        const lengthCm = totalLengthMm / 10;

        const fiberVolumeCm3 = lengthCm * nomWidthCm * thicknessCm;
        const fiberWeightG = Math.round(fiberVolumeCm3 * density * 10) / 10;

        // Total cured laminate weight including wet resin matrix (assuming Vf ~ 55% fiber fraction)
        const totalPartWeightG = Math.round((fiberWeightG / 0.6) * 10) / 10;

        // Cost estimation based on fiber $/kg
        const costPerKg = material?.costPerKg || 35;
        const estimatedCost = Math.round(((fiberWeightG / 1000) * costPerKg) * 100) / 100;

        return {
            totalLengthM,
            totalTimeSec: Math.round(totalTimeSec),
            formattedTime: this.formatDuration(totalTimeSec),
            fiberWeightG,
            totalPartWeightG,
            estimatedCost
        };
    }

    /**
     * Format seconds into human readable duration (e.g. "14m 22s" or "1h 05m 12s").
     * @param {number} seconds 
     * @returns {string}
     */
    formatDuration(seconds) {
        const sec = Math.round(seconds);
        if (sec < 60) return `${sec}s`;
        const mins = Math.floor(sec / 60);
        const remSec = sec % 60;
        if (mins < 60) {
            return `${mins}m ${remSec < 10 ? '0' : ''}${remSec}s`;
        }
        const hrs = Math.floor(mins / 60);
        const remMin = mins % 60;
        return `${hrs}h ${remMin < 10 ? '0' : ''}${remMin}m ${remSec < 10 ? '0' : ''}${remSec}s`;
    }
}
