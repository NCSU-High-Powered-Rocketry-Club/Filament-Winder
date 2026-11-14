/**
 * PlaybackController — Animation and scrubbing controller for the filament winding simulation.
 * Coordinates 3D visual layer winding and 2D coverage laydown with synchronized progress.
 */
export class PlaybackController {
    /**
     * @param {Object} app - The main App instance
     */
    constructor(app) {
        this.app = app;
        this.isPlaying = false;
        this._animId = null;

        this._slider = document.getElementById('sim-slider');
        this._slider2 = document.getElementById('sim-slider-2');
        this._progress = document.getElementById('sim-progress');
        this._progress2 = document.getElementById('sim-progress-2');
        this._playBtn = document.getElementById('play-btn');
        this._playBtn2 = document.getElementById('play-btn-2');

        this._bindEvents();
    }

    _bindEvents() {
        // Slider input events
        this._slider.addEventListener('input', (e) => this.updateProgress(parseFloat(e.target.value)));
        this._slider2.addEventListener('input', (e) => this.updateProgress(parseFloat(e.target.value)));

        // Play button events
        this._playBtn.addEventListener('click', () => this.togglePlay());
        this._playBtn2.addEventListener('click', () => this.togglePlay());
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const icon = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        this._playBtn.innerHTML = icon;
        this._playBtn2.innerHTML = icon;

        if (this.isPlaying) {
            if (parseFloat(this._slider.value) >= 100) {
                this.updateProgress(0);
            }
            this._playLoop();
        }
    }

    _playLoop() {
        if (!this.isPlaying) return;

        let val = parseFloat(this._slider.value);
        val += 0.35; // Smooth progression rate

        if (val >= 100) {
            val = 100;
            this.isPlaying = false;
            this._playBtn.innerHTML = '<i class="fas fa-play"></i>';
            this._playBtn2.innerHTML = '<i class="fas fa-play"></i>';
        }

        this.updateProgress(val);
        if (this.isPlaying) {
            this._animId = requestAnimationFrame(() => this._playLoop());
        }
    }

    /**
     * Update all synced UI elements, 3D layer progression, and 2D canvas map.
     * @param {number} val - 0 to 100 percentage
     */
    updateProgress(val) {
        const clamped = Math.max(0, Math.min(100, val));
        this._slider.value = clamped;
        this._slider2.value = clamped;

        let statusText = `${Math.round(clamped)}%`;

        // Update 3D view
        if (this.app.viewer3d) {
            const stepInfo = this.app.viewer3d.setProgress(clamped);
            if (stepInfo && this.app.layerPlans && this.app.layerPlans.length > 0) {
                statusText = `${Math.round(clamped)}% • L${stepInfo.activeLayerIndex + 1} (${stepInfo.layerType.toUpperCase()})`;
            }
        }

        this._progress.textContent = statusText;
        this._progress2.textContent = statusText;

        // Update 2D view if visible and plans exist
        const view2d = document.getElementById('view-2d');
        if (this.app.coverage2d && this.app.layerPlans && this.app.layerPlans.length > 0 && view2d.classList.contains('active')) {
            const diam = parseFloat(document.getElementById('mandrelDiameter').value);
            const len = parseFloat(document.getElementById('partLength').value);
            const vis = this.app.layerStackUI ? this.app.layerStackUI.getVisibilityStates() : [];
            this.app.coverage2d.draw(this.app.layerPlans, diam, len, clamped, vis);
        }
    }

    stop() {
        this.isPlaying = false;
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
        this._playBtn.innerHTML = '<i class="fas fa-play"></i>';
        this._playBtn2.innerHTML = '<i class="fas fa-play"></i>';
    }
}
