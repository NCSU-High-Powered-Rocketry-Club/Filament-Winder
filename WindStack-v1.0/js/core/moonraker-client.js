/**
 * MoonrakerClient — HTTP client for interfacing directly with Klipper via Moonraker API
 * on Raspberry Pi controllers. Supports 1-click G-code network upload and winding execution.
 */
export class MoonrakerClient {
    /**
     * Clean and format host URL (ensures http:// and removes trailing slash).
     * @param {string} host 
     * @returns {string}
     */
    formatHost(host) {
        let clean = (host || '').trim();
        if (!clean) return 'http://localhost:7125';
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = 'http://' + clean;
        }
        return clean.replace(/\/+$/, '');
    }

    /**
     * Test connection and retrieve Klipper state from Moonraker.
     * @param {string} host - Moonraker URL (e.g. http://192.168.1.100:7125)
     * @param {string} [apiKey] - Optional Moonraker API key
     * @returns {Promise<{connected: boolean, state: string, message: string, hostname?: string}>}
     */
    async checkConnection(host, apiKey = '') {
        const url = `${this.formatHost(host)}/printer/info`;
        const headers = {};
        if (apiKey) headers['X-Api-Key'] = apiKey;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(url, { headers, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                return { connected: false, state: 'error', message: `HTTP ${res.status}: ${res.statusText}` };
            }

            const data = await res.json();
            const result = data.result || {};
            return {
                connected: true,
                state: result.state || 'ready',
                message: result.state_message || 'Klipper Connected',
                hostname: result.hostname || host
            };
        } catch (err) {
            return {
                connected: false,
                state: 'offline',
                message: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Cannot reach host')
            };
        }
    }

    /**
     * Upload generated G-code file directly to Klipper's virtual SD card via Moonraker.
     * 
     * @param {string} host - Moonraker URL
     * @param {string} apiKey - Optional API key
     * @param {string} gcodeString - Generated G-code content
     * @param {string} filename - Filename (e.g. "part_45deg.gcode")
     * @param {boolean} [startPrint=false] - Auto-start winding immediately
     * @returns {Promise<{success: boolean, message: string, filename?: string}>}
     */
    async uploadGCode(host, apiKey = '', gcodeString, filename, startPrint = false) {
        const url = `${this.formatHost(host)}/server/files/upload`;
        const headers = {};
        if (apiKey) headers['X-Api-Key'] = apiKey;

        const formData = new FormData();
        const blob = new Blob([gcodeString], { type: 'text/plain' });
        formData.append('file', blob, filename);
        if (startPrint) {
            formData.append('print', 'true');
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                return { success: false, message: `Upload failed: ${res.status} ${text}` };
            }

            const data = await res.json();
            return {
                success: true,
                message: startPrint ? 'Uploaded and winding started!' : 'Uploaded successfully to Klipper SD card!',
                filename: data.result || filename
            };
        } catch (err) {
            return { success: false, message: `Network error: ${err.message}` };
        }
    }

    /**
     * Start execution of an existing uploaded G-code file on the winder.
     */
    async startPrint(host, apiKey = '', filename) {
        const url = `${this.formatHost(host)}/printer/print/start?filename=${encodeURIComponent(filename)}`;
        const headers = {};
        if (apiKey) headers['X-Api-Key'] = apiKey;

        try {
            const res = await fetch(url, { method: 'POST', headers });
            const data = await res.json();
            return { success: res.ok, message: data.result || 'Started' };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    /**
     * Send emergency stop command (M112) to Klipper.
     */
    async emergencyStop(host, apiKey = '') {
        const url = `${this.formatHost(host)}/printer/emergency_stop`;
        const headers = {};
        if (apiKey) headers['X-Api-Key'] = apiKey;

        try {
            const res = await fetch(url, { method: 'POST', headers });
            return { success: res.ok };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }
}
