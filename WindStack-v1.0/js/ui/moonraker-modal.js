import { MoonrakerClient } from '../core/moonraker-client.js';

/**
 * MoonrakerModal — Interactive modal for configuring Raspberry Pi Klipper network connection
 * and uploading generated G-code programs directly to the winder.
 */
export class MoonrakerModal {
    constructor() {
        this.client = new MoonrakerClient();
        this.element = null;
        this.gcodeString = '';
        this._createDOM();
    }

    _createDOM() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'moonraker-modal';
        modal.style.display = 'none';

        const savedHost = localStorage.getItem('windstack_moonraker_host') || 'http://raspberrypi.local:7125';
        const savedKey = localStorage.getItem('windstack_moonraker_key') || '';

        modal.innerHTML = `
            <div class="modal-card" style="max-width:580px;">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-network-wired" style="color:#00d2ff; font-size:1.2em;"></i>
                        <h3>Upload to Klipper (Moonraker API)</h3>
                    </div>
                    <button class="modal-close-btn" id="mr-modal-close"><i class="fas fa-times"></i></button>
                </div>

                <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
                    <p style="font-size:0.85em; color:#bdc3c7;">
                        Send G-code directly over your local WiFi/LAN network to your Raspberry Pi running Klipper/Moonraker.
                    </p>

                    <div class="input-group">
                        <label>Moonraker URL (Host & Port)</label>
                        <div style="display:flex; gap:6px;">
                            <input type="text" id="mr-host" value="${savedHost}" placeholder="http://192.168.1.100:7125" style="flex:1;">
                            <button class="btn btn-sm btn-primary" id="mr-test-btn" style="white-space:nowrap;"><i class="fas fa-plug"></i> Test Connection</button>
                        </div>
                    </div>

                    <div id="mr-status-pill" style="display:none; padding:8px 12px; border-radius:6px; font-size:0.82em; font-weight:600;"></div>

                    <div class="input-group">
                        <label>Moonraker API Key (optional)</label>
                        <input type="password" id="mr-key" value="${savedKey}" placeholder="Leave blank if trusted LAN">
                    </div>

                    <div class="input-group">
                        <label>Target G-Code Filename</label>
                        <input type="text" id="mr-filename" value="windstack_job.gcode">
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                        <input type="checkbox" id="mr-autostart" style="width:16px; height:16px; cursor:pointer;">
                        <label for="mr-autostart" style="font-size:0.85em; color:#ecf0f1; cursor:pointer;">Start winding program immediately after upload</label>
                    </div>

                    <div id="mr-result-box" style="display:none; padding:10px; border-radius:6px; font-size:0.85em;"></div>
                </div>

                <div class="modal-footer">
                    <a id="mr-web-link" href="#" target="_blank" class="btn btn-sm" style="margin-right:auto; display:none; background:#34495e; color:#fff; text-decoration:none;"><i class="fas fa-external-link-alt"></i> Open Mainsail / Fluidd</a>
                    <button class="btn btn-sm" id="mr-cancel-btn">Cancel</button>
                    <button class="btn btn-success btn-sm" id="mr-upload-btn"><i class="fas fa-cloud-upload-alt"></i> Upload to Winder</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this._bindEvents();
    }

    _bindEvents() {
        const modal = this.element;

        modal.querySelector('#mr-modal-close').addEventListener('click', () => this.hide());
        modal.querySelector('#mr-cancel-btn').addEventListener('click', () => this.hide());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        // Test connection
        modal.querySelector('#mr-test-btn').addEventListener('click', async () => {
            const host = modal.querySelector('#mr-host').value;
            const key = modal.querySelector('#mr-key').value;
            const pill = modal.querySelector('#mr-status-pill');
            const testBtn = modal.querySelector('#mr-test-btn');

            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
            pill.style.display = 'block';
            pill.style.background = 'rgba(255,255,255,0.05)';
            pill.innerHTML = 'Connecting to Moonraker...';

            const res = await this.client.checkConnection(host, key);
            testBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';

            if (res.connected) {
                pill.style.background = 'rgba(46, 204, 113, 0.2)';
                pill.style.color = '#2ecc71';
                pill.style.border = '1px solid #2ecc71';
                pill.innerHTML = `<i class="fas fa-check-circle"></i> Connected to Klipper (${res.state.toUpperCase()}): ${res.message}`;

                // Show Web Interface link
                const cleanHost = this.client.formatHost(host).replace(/:7125$/, '');
                const webLink = modal.querySelector('#mr-web-link');
                webLink.href = cleanHost;
                webLink.style.display = 'inline-flex';
            } else {
                pill.style.background = 'rgba(231, 76, 60, 0.2)';
                pill.style.color = '#ff7675';
                pill.style.border = '1px solid #e74c3c';
                pill.innerHTML = `<i class="fas fa-times-circle"></i> Connection Failed: ${res.message}`;
            }

            this._saveSettings();
        });

        // Upload button
        modal.querySelector('#mr-upload-btn').addEventListener('click', async () => {
            const host = modal.querySelector('#mr-host').value;
            const key = modal.querySelector('#mr-key').value;
            const filename = modal.querySelector('#mr-filename').value.trim() || 'winder.gcode';
            const autoStart = modal.querySelector('#mr-autostart').checked;
            const uploadBtn = modal.querySelector('#mr-upload-btn');
            const resultBox = modal.querySelector('#mr-result-box');

            if (!this.gcodeString) {
                alert('No G-code generated yet! Click "Generate G-Code" first.');
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            resultBox.style.display = 'block';
            resultBox.style.background = 'rgba(255,255,255,0.08)';
            resultBox.style.color = '#bdc3c7';
            resultBox.innerHTML = 'Uploading G-code to Klipper SD card...';

            this._saveSettings();

            const res = await this.client.uploadGCode(host, key, this.gcodeString, filename, autoStart);
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload to Winder';

            if (res.success) {
                resultBox.style.background = 'rgba(46, 204, 113, 0.2)';
                resultBox.style.color = '#2ecc71';
                resultBox.style.border = '1px solid #2ecc71';
                resultBox.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Success!</strong> ${res.message}`;
            } else {
                resultBox.style.background = 'rgba(231, 76, 60, 0.2)';
                resultBox.style.color = '#ff7675';
                resultBox.style.border = '1px solid #e74c3c';
                resultBox.innerHTML = `<i class="fas fa-times-circle"></i> ${res.message}`;
            }
        });
    }

    _saveSettings() {
        const host = this.element.querySelector('#mr-host').value;
        const key = this.element.querySelector('#mr-key').value;
        localStorage.setItem('windstack_moonraker_host', host);
        localStorage.setItem('windstack_moonraker_key', key);
    }

    show(gcodeString, defaultFilename = '') {
        this.gcodeString = gcodeString;
        const nameInput = this.element.querySelector('#mr-filename');
        if (defaultFilename) {
            nameInput.value = defaultFilename;
        } else {
            nameInput.value = `windstack_${Date.now().toString(36)}.gcode`;
        }

        const resBox = this.element.querySelector('#mr-result-box');
        resBox.style.display = 'none';

        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }
}
