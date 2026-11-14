import { PostProcessor } from './post-processor.js';
import { SegmentType } from './path-planner.js';

export class GCodeEngine {
    constructor(machineProfile) {
        this.machine = machineProfile;
        this.postProcessor = new PostProcessor(machineProfile);
    }

    generate(segments, metadata) {
        let lines = [];
        
        for (const segment of segments) {
            if (segment.type === SegmentType.COMMENT) {
                lines.push(this.postProcessor.formatComment(segment.comment));
            } else if (segment.type === SegmentType.LAYER_CHANGE) {
                lines.push(this.postProcessor.formatLayerChange(segment.comment));
            } else if (segment.type === SegmentType.TILT) {
                lines.push(this.postProcessor.formatTilt(segment.payoutTilt, segment.feedRate));
            } else if (segment.type === SegmentType.TRAVERSE) {
                lines.push(this.postProcessor.formatMove(segment, this.machine));
            } else if (segment.type === SegmentType.DWELL) {
                lines.push(this.postProcessor.formatDwell(segment, this.machine));
                // Add a blank line to separate passes (match V40 \n\n)
                if (segment.carriage === null && segment.payoutTilt === 0) { 
                    lines.push('');
                }
            }
        }
        
        return this.postProcessor.wrapProgram(lines, metadata);
    }
}
