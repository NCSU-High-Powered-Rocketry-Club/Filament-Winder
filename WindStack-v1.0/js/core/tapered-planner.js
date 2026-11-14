/**
 * TaperedPlanner — Kinematic and mathematical framework for non-cylindrical mandrels
 * (cones, tapered tubes, and dome transitions).
 * 
 * Implements Clairaut's geodesic law, non-geodesic friction slippage constraints,
 * and variable-radius spindle coordinate integration.
 */
export class TaperedPlanner {
    /**
     * Calculate radius at axial position x on a linear tapered cone.
     * @param {number} x - Axial position (mm)
     * @param {number} rStart - Radius at x = 0 (mm)
     * @param {number} rEnd - Radius at x = length (mm)
     * @param {number} length - Total length (mm)
     * @returns {number}
     */
    radiusAt(x, rStart, rEnd, length) {
        if (length <= 0) return rStart;
        const clampedX = Math.max(0, Math.min(length, x));
        return rStart + ((rEnd - rStart) / length) * clampedX;
    }

    /**
     * Calculate surface taper angle (beta).
     * @param {number} rStart 
     * @param {number} rEnd 
     * @param {number} length 
     * @returns {number} Angle in radians
     */
    taperAngle(rStart, rEnd, length) {
        return Math.atan((rEnd - rStart) / length);
    }

    /**
     * Compute geodesic winding angle along a surface of revolution using Clairaut's Law:
     * r(x) * sin(alpha(x)) = Constant = r_turnaround * sin(90°) = r_turnaround.
     * 
     * @param {number} rx - Radius at current position
     * @param {number} rTurnaround - Minimum turnaround radius (waist/pole)
     * @returns {number|null} Winding angle in degrees, or null if beyond turnaround point
     */
    geodesicAngle(rx, rTurnaround) {
        if (rx < rTurnaround) return null; // Fiber cannot cross beyond turnaround radius without slipping
        const sinAlpha = rTurnaround / rx;
        const alphaRad = Math.asin(Math.min(1.0, Math.max(-1.0, sinAlpha)));
        return alphaRad * (180 / Math.PI);
    }

    /**
     * Check if a desired winding angle exceeds the critical friction slippage coefficient:
     * lambda = | (tan(alpha) / r) * (dr/dx) | <= mu_friction
     * 
     * @param {number} alphaDeg - Winding angle in degrees
     * @param {number} rx - Current radius (mm)
     * @param {number} drdx - Surface slope (dr/dx)
     * @param {number} [mu=0.25] - Wet composite friction coefficient (typically 0.20 - 0.35)
     * @returns {{stable: boolean, slippageCoefficient: number, maxAllowedAngleDeg: number}}
     */
    checkSlippage(alphaDeg, rx, drdx, mu = 0.25) {
        const alphaRad = alphaDeg * (Math.PI / 180);
        const tanAlpha = Math.tan(alphaRad);
        const lambda = Math.abs((tanAlpha / rx) * drdx);

        const stable = lambda <= mu;
        const maxTan = Math.abs((mu * rx) / (drdx || 1e-6));
        const maxAllowedAngleDeg = Math.atan(maxTan) * (180 / Math.PI);

        return {
            stable,
            slippageCoefficient: Math.round(lambda * 1000) / 1000,
            maxAllowedAngleDeg: Math.round(maxAllowedAngleDeg * 10) / 10
        };
    }

    /**
     * Numerical integration of mandrel rotation Y(x) along a tapered path:
     * Y(x) = integral_0^x (tan(alpha(u)) / (r(u) * cos(beta))) du
     */
    integrateTaperRotation(rStart, rEnd, length, angleDeg, steps = 100) {
        const dx = length / steps;
        const beta = this.taperAngle(rStart, rEnd, length);
        const alphaRad = angleDeg * (Math.PI / 180);
        const tanAlpha = Math.tan(alphaRad);
        const cosBeta = Math.cos(beta);

        let totalYRad = 0;
        const profile = [];

        for (let i = 0; i <= steps; i++) {
            const x = i * dx;
            const rx = this.radiusAt(x, rStart, rEnd, length);

            if (i > 0) {
                const rxPrev = this.radiusAt(x - dx, rStart, rEnd, length);
                const rxMid = (rx + rxPrev) / 2;
                const dYRad = (tanAlpha / (rxMid * cosBeta)) * dx;
                totalYRad += dYRad;
            }

            const yDeg = totalYRad * (180 / Math.PI);
            profile.push({ x, radius: rx, yDegrees: yDeg });
        }

        return {
            totalSpindleDegrees: totalYRad * (180 / Math.PI),
            profile
        };
    }
}
