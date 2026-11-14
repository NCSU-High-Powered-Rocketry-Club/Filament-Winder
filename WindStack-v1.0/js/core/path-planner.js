import { gcd, degToRad, circumference, projectedWidth } from './math-utils.js';

// MotionSegment types
export const SegmentType = {
    TRAVERSE: 'traverse',     // Linear move with rotation
    DWELL: 'dwell',           // Rotation-only at turnaround
    TILT: 'tilt',             // Payout eye angle change
    COMMENT: 'comment',       // Annotation
    LAYER_CHANGE: 'layer_change'
};

export class MotionSegment {
    constructor(type, { carriage, rotation, payoutTilt, feedRate, comment }) {
        this.type = type;
        this.carriage = carriage ?? null;      // Target X position (mm)
        this.rotation = rotation ?? null;      // Target Y rotation (degrees, accumulated)
        this.payoutTilt = payoutTilt ?? null;  // Target Z tilt angle
        this.feedRate = feedRate ?? null;      // mm/min
        this.comment = comment ?? null;
    }
}

export class PathPlanner {
    calculateCircuits(mandrelDiam, fiberWidth, angleRad, skipIndex) {
        // Port V40 algorithm EXACTLY
        const circ = circumference(mandrelDiam);
        const projWidth = projectedWidth(fiberWidth, angleRad);
        const bandsNeeded = (circ / (projWidth * 0.95));
        let circuits = Math.ceil(bandsNeeded);
        if (skipIndex <= 0) return circuits;
        while (gcd(circuits, skipIndex) > 1) circuits++;
        return circuits;
    }

    planHelicalLayer(mandrelDiam, partLength, layerParams, globalSettings, currentY = 0) {
        const { angle, fiberWidth, skipIndex: skip, extraPasses: extra, lockDegrees: lockDeg } = layerParams;
        const { feedRate, dwellSpeed, tiltSpeed } = globalSettings;
        
        const angleRad = angle * (Math.PI / 180);
        const circ = circumference(mandrelDiam);
        const circuits = this.calculateCircuits(mandrelDiam, fiberWidth, angleRad, skip);
        
        const rotationsForLength = (partLength * Math.tan(angleRad) / circ) * 360;
        const skipStep = (360 / circuits) * skip;
        const fwdZ = (90 - angle) + 35;
        const revZ = -((90 - angle) + 35);
        const totalLoops = circuits + extra;

        const segments = [];
        let y = currentY;

        for (let i = 0; i < totalLoops; i++) {
            // Forward pass
            segments.push(new MotionSegment(SegmentType.TILT, { payoutTilt: fwdZ, feedRate: tiltSpeed }));
            y += rotationsForLength;
            segments.push(new MotionSegment(SegmentType.TRAVERSE, { carriage: partLength, rotation: y, feedRate: feedRate }));
            y += lockDeg;
            segments.push(new MotionSegment(SegmentType.DWELL, { rotation: y, payoutTilt: 0, feedRate: dwellSpeed }));
            
            // Reverse pass
            segments.push(new MotionSegment(SegmentType.TILT, { payoutTilt: revZ, feedRate: tiltSpeed }));
            y += rotationsForLength;
            segments.push(new MotionSegment(SegmentType.TRAVERSE, { carriage: 0, rotation: y, feedRate: feedRate }));
            
            // Drift correction for skip pattern
            const natural = (rotationsForLength * 2) + (lockDeg * 2);
            const drift = natural % 360;
            let correction = skipStep - drift;
            while(correction < 0) correction += 360;
            while(correction >= 360) correction -= 360;
            if (Math.abs(correction) < 0.01) correction = 0;
            
            y += lockDeg + correction;
            segments.push(new MotionSegment(SegmentType.DWELL, { rotation: y, payoutTilt: 0, feedRate: dwellSpeed }));
        }

        return { circuits, segments, newY: y };
    }

    planHoopLayer(mandrelDiam, partLength, layerParams, globalSettings, currentY = 0) {
        const { fiberWidth: width, overlapPercent: overlap, lockDegrees: lockDeg } = layerParams;
        const { feedRate, dwellSpeed, tiltSpeed } = globalSettings;
        
        const pitch = width * (1 - (overlap / 100));
        const rots = partLength / pitch;
        const degs = rots * 360;

        const segments = [];
        let y = currentY;

        segments.push(new MotionSegment(SegmentType.TILT, { payoutTilt: 35, feedRate: tiltSpeed }));
        
        y += degs;
        segments.push(new MotionSegment(SegmentType.TRAVERSE, { carriage: partLength, rotation: y, feedRate: feedRate }));
        
        y += lockDeg;
        segments.push(new MotionSegment(SegmentType.DWELL, { rotation: y, feedRate: dwellSpeed }));
        
        y += degs;
        segments.push(new MotionSegment(SegmentType.TRAVERSE, { carriage: 0, rotation: y, feedRate: feedRate }));
        
        y += lockDeg;
        segments.push(new MotionSegment(SegmentType.DWELL, { rotation: y, feedRate: dwellSpeed }));

        return { segments, newY: y };
    }

    planAllLayers(mandrelDiam, partLength, layers, globalSettings, materialThickness) {
        const allSegments = [];
        const layerPlans = [];
        
        let currentY = 0;
        let currentDiam = mandrelDiam;

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            
            allSegments.push(new MotionSegment(SegmentType.LAYER_CHANGE, { comment: `Layer ${i + 1} - ${layer.type}` }));

            let planResult;
            if (layer.type === 'helical') {
                planResult = this.planHelicalLayer(currentDiam, partLength, layer.params, globalSettings, currentY);
            } else if (layer.type === 'hoop') {
                planResult = this.planHoopLayer(currentDiam, partLength, layer.params, globalSettings, currentY);
            }

            if (planResult && planResult.segments) {
                allSegments.push(...planResult.segments);
                currentY = planResult.newY;
                
                const layerFiberWidth = layer.fiberWidth || layer.params?.fiberWidth || 3.3;
                layerPlans.push({
                    layerIndex: i,
                    type: layer.type,
                    fiberWidth: layerFiberWidth,
                    effectiveDiameter: currentDiam,
                    effectiveRadius: (currentDiam / 2),
                    circuits: planResult.circuits || null,
                    segments: planResult.segments,
                    params: layer.params
                });
            }

            // Update effective diameter for next layer
            currentDiam += (materialThickness * 2);
        }

        return { allSegments, layerPlans, finalY: currentY };
    }
}
