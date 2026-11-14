import * as THREE from 'three';

/**
 * FiberRenderer — Converts MotionSegments or G-code to 3D surface points
 * and builds smooth helical ribbon geometry for composite plies.
 */
export class FiberRenderer {
    /**
     * Convert an array of MotionSegments into a continuous series of 3D points
     * spiraling smoothly around the cylindrical mandrel surface.
     * 
     * @param {Array} segments - Array of MotionSegment objects
     * @param {number} radius - Effective mandrel radius (mm)
     * @param {number} [stepAngle=8] - Angular step in degrees for helical interpolation
     * @returns {THREE.Vector3[]}
     */
    segmentsToPoints(segments, radius, stepAngle = 8) {
        const pts = [];
        let curX = 0;
        let curY = 0;
        let initialized = false;

        for (const seg of segments) {
            if (seg.carriage === null && seg.rotation === null) {
                continue;
            }

            const targetX = seg.carriage !== null ? seg.carriage : curX;
            const targetY = seg.rotation !== null ? seg.rotation : curY;

            if (!initialized) {
                // Push starting point at origin (0,0)
                const startAng = -(curY * Math.PI / 180);
                pts.push(new THREE.Vector3(curX, radius * Math.cos(startAng), radius * Math.sin(startAng)));
                initialized = true;
                // Fall through to interpolate from (0,0) to first target
            }

            const dx = targetX - curX;
            const dy = targetY - curY;

            if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
                continue;
            }

            // Subdivide rotation so helical passes follow the curved cylinder surface
            const numSteps = Math.max(1, Math.ceil(Math.abs(dy) / stepAngle));

            for (let s = 1; s <= numSteps; s++) {
                const t = s / numSteps;
                const interpX = curX + dx * t;
                const interpY = curY + dy * t;
                const ang = -(interpY * Math.PI / 180);
                pts.push(new THREE.Vector3(interpX, radius * Math.cos(ang), radius * Math.sin(ang)));
            }

            curX = targetX;
            curY = targetY;
        }

        return pts;
    }

    /**
     * Parse G-code lines into 3D points on the mandrel surface with smooth interpolation.
     * @param {string[]} lines - G-code lines
     * @param {number} radius - Mandrel radius + offset
     * @param {number} [stepAngle=8] - Degrees per step
     * @returns {THREE.Vector3[]}
     */
    gcodeToPoints(lines, radius, stepAngle = 8) {
        const pts = [];
        let lx = 0, ly = 0;
        let started = false;

        for (const l of lines) {
            if (l.startsWith('G1')) {
                const xm = l.match(/X([\d\.\-]+)/);
                const ym = l.match(/Y([\d\.\-]+)/);

                if (xm || ym) {
                    const nextX = xm ? parseFloat(xm[1]) : lx;
                    const nextY = ym ? parseFloat(ym[1]) : ly;

                    if (!started) {
                        lx = nextX;
                        ly = nextY;
                        const ang = -(ly * Math.PI / 180);
                        pts.push(new THREE.Vector3(lx, radius * Math.cos(ang), radius * Math.sin(ang)));
                        started = true;
                        continue;
                    }

                    const dx = nextX - lx;
                    const dy = nextY - ly;

                    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) continue;

                    const steps = Math.max(1, Math.ceil(Math.abs(dy) / stepAngle));
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        const interpX = lx + dx * t;
                        const interpY = ly + dy * t;
                        const ang = -(interpY * Math.PI / 180);
                        pts.push(new THREE.Vector3(interpX, radius * Math.cos(ang), radius * Math.sin(ang)));
                    }

                    lx = nextX;
                    ly = nextY;
                }
            }
        }
        return pts;
    }

    /**
     * Create ribbon BufferGeometry from an array of 3D points.
     * Generates a flat ribbon that conforms to the cylinder tangent plane at every point.
     * 
     * @param {THREE.Vector3[]} points - Path centerline points
     * @param {number} width - Ribbon width in mm
     * @returns {THREE.BufferGeometry}
     */
    createRibbonGeometry(points, width) {
        if (!points || points.length < 2) {
            return new THREE.BufferGeometry();
        }

        const positions = [];
        const uvs = [];
        const halfW = width / 2;
        let totalLen = 0;

        // Precompute cumulative lengths for UV texture mapping
        const dists = [0];
        for (let i = 0; i < points.length - 1; i++) {
            totalLen += points[i].distanceTo(points[i + 1]);
            dists.push(totalLen);
        }

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const dir = new THREE.Vector3().subVectors(p2, p1);
            if (dir.lengthSq() < 1e-7) {
                continue;
            }
            dir.normalize();

            // Cylinder axis is X (centerline is at y=0, z=0)
            // Surface normal points radially outward from X axis
            const norm1 = new THREE.Vector3(0, p1.y, p1.z);
            if (norm1.lengthSq() > 1e-7) norm1.normalize(); else norm1.set(0, 1, 0);

            const norm2 = new THREE.Vector3(0, p2.y, p2.z);
            if (norm2.lengthSq() > 1e-7) norm2.normalize(); else norm2.set(0, 1, 0);

            // Binormal is perpendicular to both motion direction and surface normal
            const binorm1 = new THREE.Vector3().crossVectors(dir, norm1).normalize().multiplyScalar(halfW);
            const binorm2 = new THREE.Vector3().crossVectors(dir, norm2).normalize().multiplyScalar(halfW);

            const v1 = new THREE.Vector3().copy(p1).add(binorm1);
            const v2 = new THREE.Vector3().copy(p1).sub(binorm1);
            const v3 = new THREE.Vector3().copy(p2).add(binorm2);
            const v4 = new THREE.Vector3().copy(p2).sub(binorm2);

            // Triangle 1: v1, v2, v3
            positions.push(v1.x, v1.y, v1.z);
            positions.push(v2.x, v2.y, v2.z);
            positions.push(v3.x, v3.y, v3.z);

            // Triangle 2: v2, v4, v3
            positions.push(v2.x, v2.y, v2.z);
            positions.push(v4.x, v4.y, v4.z);
            positions.push(v3.x, v3.y, v3.z);

            const u1 = dists[i];
            const u2 = dists[i + 1];
            uvs.push(0, u1, 1, u1, 0, u2);
            uvs.push(1, u1, 1, u2, 0, u2);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.computeVertexNormals();
        return geometry;
    }
}
