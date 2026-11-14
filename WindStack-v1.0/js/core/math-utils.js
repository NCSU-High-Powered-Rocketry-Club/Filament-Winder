// ES Module — pure math utilities, no side effects

/**
 * Greatest common divisor (recursive Euclidean)
 */
export function gcd(a, b) {
    if (b === 0) return a;
    return gcd(b, a % b);
}

export function degToRad(deg) {
    return deg * (Math.PI / 180);
}

export function radToDeg(rad) {
    return rad * (180 / Math.PI);
}

/**
 * Circumference = π × d
 */
export function circumference(diameter) {
    return Math.PI * diameter;
}

/**
 * projectedWidth = width / cos(angle)
 */
export function projectedWidth(width, angleRad) {
    return width / Math.cos(angleRad);
}

/**
 * Fixed decimal rounding
 */
export function roundTo(value, places) {
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Normalize angle to [0, 360)
 */
export function normalizeAngle(deg) {
    let normalized = deg % 360;
    if (normalized < 0) normalized += 360;
    return normalized;
}
