/**
 * ValidationBanner — Displays real-time kinematic and physical constraint warnings.
 * Verifies that part length, mandrel diameter, feed rates, and multi-axis moves
 * stay within the active machine's physical envelope.
 */
export class ValidationBanner {
    /**
     * @param {HTMLElement} container - The banner element (#validation-banner)
     */
    constructor(container) {
        this.container = container;
    }

    /**
     * Check constraints and update banner visibility and messages.
     * @param {Object} machine - Active Machine instance
     * @param {Object} mandrel - Mandrel instance
     * @param {Object} globalSettings - { feedRate, dwellSpeed }
     * @param {Array} layers - Array of layer objects
     * @returns {{hasErrors: boolean, hasWarnings: boolean}}
     */
    check(machine, mandrel, globalSettings, layers = []) {
        if (!this.container || !machine) {
            return { hasErrors: false, hasWarnings: false };
        }

        const { errors, warnings } = machine.validateConstraints(mandrel, globalSettings);

        // Check if any helical layers require payout tilt on a machine that has no tilt axis
        if (layers && layers.length > 0 && !machine.hasPayoutTilt()) {
            const hasHelical = layers.some(l => l.type === 'helical');
            if (hasHelical) {
                warnings.push(`Active machine lacks a payout tilt axis. Helical turnaround head tilt will default to Z or dwell.`);
            }
        }

        if (errors.length === 0 && warnings.length === 0) {
            this.container.style.display = 'none';
            this.container.innerHTML = '';
            return { hasErrors: false, hasWarnings: false };
        }

        let html = '';
        if (errors.length > 0) {
            html += `
                <div class="val-alert val-error">
                    <div class="val-title"><i class="fas fa-times-circle"></i> Machine Configuration Error</div>
                    <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>
                </div>
            `;
        }

        if (warnings.length > 0) {
            html += `
                <div class="val-alert val-warning">
                    <div class="val-title"><i class="fas fa-exclamation-triangle"></i> Physical Limits Warning</div>
                    <ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>
                </div>
            `;
        }

        this.container.innerHTML = html;
        this.container.style.display = 'block';

        return { hasErrors: errors.length > 0, hasWarnings: warnings.length > 0 };
    }

    clear() {
        if (this.container) {
            this.container.style.display = 'none';
            this.container.innerHTML = '';
        }
    }
}
