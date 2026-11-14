export class PostProcessor {
    constructor(machineProfile) {
        this.machine = machineProfile;
        this.config = machineProfile.gcodeConfig || {};
        this.decimals = this.config.decimalPlaces || 4;
    }

    formatMove(segment, machine) {
        let parts = ['G1'];
        if (segment.carriage !== null) {
            const axisId = machine.getCarriageAxis().id;
            parts.push(`${axisId}${this.formatNumber(segment.carriage)}`);
        }
        if (segment.rotation !== null) {
            const axisId = machine.getMandrelAxis().id;
            parts.push(`${axisId}${this.formatNumber(segment.rotation)}`);
        }
        if (segment.feedRate !== null) {
            parts.push(`F${segment.feedRate}`);
        }
        return parts.join(' ');
    }

    formatTilt(tiltAngle, feedRate) {
        const payoutAxis = this.machine.getPayoutAxis ? this.machine.getPayoutAxis() : null;
        const axisId = payoutAxis ? payoutAxis.id : 'Z';
        return `G1 ${axisId}${tiltAngle.toFixed(2)} F${feedRate}`;
    }

    formatDwell(segment, machine) {
        let parts = ['G1'];
        if (segment.rotation !== null) {
            const axisId = machine.getMandrelAxis().id;
            parts.push(`${axisId}${this.formatNumber(segment.rotation)}`);
        }
        if (segment.payoutTilt !== null) {
            const payoutAxis = machine.getPayoutAxis ? machine.getPayoutAxis() : null;
            const axisId = payoutAxis ? payoutAxis.id : 'Z';
            if (segment.payoutTilt === 0) {
                parts.push(`${axisId}0`);
            } else {
                parts.push(`${axisId}${segment.payoutTilt.toFixed(2)}`);
            }
        }
        if (segment.feedRate !== null) {
            parts.push(`F${segment.feedRate}`);
        }
        return parts.join(' ');
    }

    formatComment(text) {
        return `; ${text}`;
    }

    formatLayerChange(text) {
        let lines = [`\n; ${text}`];
        const type = (this.machine.controllerType || 'klipper').toLowerCase();
        if (type === 'klipper') {
            lines.push(`RESPOND MSG="${text}"`);
        } else if (type === 'marlin') {
            lines.push(`M117 ${text}`);
        } else if (type === 'reprap' || type === 'duet') {
            lines.push(`M118 P0 S"${text}"`);
        } else if (type === 'linuxcnc' || type === 'mach3' || type === 'mach4') {
            lines.push(`(MSG, ${text})`);
        }
        return lines.join('\n');
    }

    formatNumber(value) {
        return value.toFixed(this.decimals);
    }

    getHeader(metadata) {
        let lines = [];
        lines.push(`; --- WindStack Winding Program ---`);
        if (metadata) {
            lines.push(`; Date: ${metadata.date || new Date().toISOString()}`);
            lines.push(`; Machine: ${this.machine.name}`);
            if (metadata.mandrelDiam) lines.push(`; Mandrel: ${metadata.mandrelDiam}mm x ${metadata.partLength}mm`);
            if (metadata.materialName) lines.push(`; Material: ${metadata.materialName}`);
            if (metadata.layerCount) lines.push(`; Layers: ${metadata.layerCount}`);
            if (metadata.estimates) {
                lines.push(`; Est. Cycle Time: ${metadata.estimates.formattedTime}`);
                lines.push(`; Fiber Consumption: ${metadata.estimates.totalLengthM} m`);
                lines.push(`; Est. Part Weight: ${metadata.estimates.totalPartWeightG} g`);
                lines.push(`; Est. Fiber Cost: $${(metadata.estimates.estimatedCost ?? 0).toFixed(2)}`);
            }
        }
        const machineHeader = this.config.header || [];
        lines.push(...machineHeader);
        lines.push('');
        return lines.join('\n');
    }

    getFooter() {
        const machineFooter = this.config.footer || [];
        let lines = [''];
        lines.push(...machineFooter);
        return lines.join('\n');
    }

    wrapProgram(bodyLines, metadata) {
        return this.getHeader(metadata) + '\n' + bodyLines.join('\n') + '\n' + this.getFooter();
    }
}
