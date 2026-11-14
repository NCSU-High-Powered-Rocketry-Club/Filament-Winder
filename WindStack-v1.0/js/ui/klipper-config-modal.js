/**
 * KlipperConfigModal — Generates production-ready Klipper `printer.cfg` snippets
 * and macros tailored to the user's active machine profile.
 */
export class KlipperConfigModal {
    constructor() {
        this.element = null;
        this.activeMachine = null;
        this._createDOM();
    }

    _createDOM() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'klipper-config-modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-card modal-lg">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-terminal" style="color:#00d2ff; font-size:1.2em;"></i>
                        <h3>Klipper Configuration & Macro Generator</h3>
                    </div>
                    <button class="modal-close-btn" id="klipper-modal-close"><i class="fas fa-times"></i></button>
                </div>

                <div class="modal-toolbar">
                    <div style="display:flex; align-items:center; gap:12px; flex:1;">
                        <label style="font-size:0.85em; color:#aaa; font-weight:600;">Spindle Pulley Reduction Ratio:</label>
                        <select id="klipper-gear-ratio" style="max-width:140px; padding:4px 8px;">
                            <option value="1:1">1:1 Direct Drive</option>
                            <option value="2:1">2:1 Reduction</option>
                            <option value="3:1">3:1 Reduction</option>
                            <option value="4:1" selected>4:1 (80T : 20T)</option>
                            <option value="5:1">5:1 Reduction</option>
                            <option value="6:1">6:1 Reduction</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-primary" id="klipper-copy-btn"><i class="fas fa-copy"></i> Copy Configuration</button>
                        <button class="btn btn-sm btn-success" id="klipper-download-btn"><i class="fas fa-download"></i> Download .cfg</button>
                    </div>
                </div>

                <div class="modal-body">
                    <p style="font-size:0.85em; color:#bdc3c7; margin-bottom:10px;">
                        Add these sections into your Raspberry Pi Klipper <code>printer.cfg</code> (or include as <code>[include winder.cfg]</code>).
                        Configured for continuous rotary accumulation on the mandrel spindle:
                    </p>
                    <textarea id="klipper-cfg-text" rows="18" style="width:100%; font-family:'Courier New', monospace; font-size:0.85em; background:#080e14; color:#a6f0ff; border:1px solid #233446; border-radius:6px; padding:10px; white-space:pre;" readonly></textarea>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-sm" id="klipper-close-btn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.element = modal;

        this._bindEvents();
    }

    _bindEvents() {
        const modal = this.element;

        modal.querySelector('#klipper-modal-close').addEventListener('click', () => this.hide());
        modal.querySelector('#klipper-close-btn').addEventListener('click', () => this.hide());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        // Gear ratio selector change
        modal.querySelector('#klipper-gear-ratio').addEventListener('change', () => {
            this._generateConfig();
        });

        // Copy button
        modal.querySelector('#klipper-copy-btn').addEventListener('click', () => {
            const text = modal.querySelector('#klipper-cfg-text').value;
            navigator.clipboard.writeText(text).then(() => {
                const btn = modal.querySelector('#klipper-copy-btn');
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy Configuration'; }, 1500);
            });
        });

        // Download button
        modal.querySelector('#klipper-download-btn').addEventListener('click', () => {
            const text = modal.querySelector('#klipper-cfg-text').value;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'winder_klipper.cfg';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    show(activeMachine) {
        this.activeMachine = activeMachine;
        this._generateConfig();
        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }

    _generateConfig() {
        const m = this.activeMachine;
        const gearRatio = this.element.querySelector('#klipper-gear-ratio').value;
        const carriage = m?.getCarriageAxis();
        const mandrel = m?.getMandrelAxis();
        const tilt = m?.getPayoutAxis();

        const xMax = carriage?.range?.max || 300;
        const xSpeed = carriage?.maxSpeed ? Math.round(carriage.maxSpeed / 60) : 150;

        let cfg = `# =========================================================================
# WindStack Filament Winder Klipper Configuration
# Machine: ${m?.name || 'Workshop Winder'}
# Generated: ${new Date().toISOString()}
# =========================================================================

# Enable RESPOND MSG console & Mainsail/Fluidd feedback
[respond]

# -------------------------------------------------------------------------
# X AXIS: CARRIAGE LINEAR TRAVEL
# -------------------------------------------------------------------------
[stepper_x]
step_pin: gpio11        # Adjust to your control board pins
dir_pin: !gpio10
enable_pin: !gpio12
microsteps: 16
rotation_distance: 40    # Standard GT2 20-tooth pulley (40mm per rev)
endstop_pin: ^gpio4
position_endstop: 0
position_min: 0
position_max: ${xMax}
homing_speed: 50
homing_retract_dist: 5

# -------------------------------------------------------------------------
# Y AXIS: MANDREL CONTINUOUS ROTARY SPINDLE
# In Klipper, rotation_distance is set to 360 for 1:1 degree positioning.
# -------------------------------------------------------------------------
[stepper_y]
step_pin: gpio6
dir_pin: gpio5
enable_pin: !gpio7
microsteps: 16
rotation_distance: 360  # 360 degrees per revolution of output spindle
gear_ratio: ${gearRatio}      # Pulley reduction
full_steps_per_rotation: 200
endstop_pin: ^gpio3
position_endstop: 0
position_min: -999999999 # Allows continuous multi-circuit winding accumulation
position_max: 999999999
homing_speed: 60
homing_retract_dist: 0
`;

        if (tilt) {
            cfg += `
# -------------------------------------------------------------------------
# ${tilt.id} AXIS: PAYOUT DELIVERY EYE TILT
# -------------------------------------------------------------------------
[stepper_${tilt.id.toLowerCase()}]
step_pin: gpio19
dir_pin: gpio28
enable_pin: !gpio2
microsteps: 16
rotation_distance: 360  # Degrees
full_steps_per_rotation: 200
endstop_pin: ^gpio25
position_endstop: 0
position_min: ${tilt.range?.min ?? -90}
position_max: ${tilt.range?.max ?? 90}
homing_speed: 40
`;
        }

        cfg += `
# -------------------------------------------------------------------------
# VELOCITY & ACCELERATION LIMITS
# -------------------------------------------------------------------------
[printer]
kinematics: cartesian
max_velocity: ${xSpeed}
max_accel: 3000
max_z_velocity: 50
max_z_accel: 500

# -------------------------------------------------------------------------
# WINDSTACK HELPER MACROS
# -------------------------------------------------------------------------
[gcode_macro WIND_START]
description: Initialize winder and reset spindle coordinates
gcode:
    G90
    G28 X               # Home carriage to reference zero
    G92 Y0              # Zero accumulated spindle degrees
    ${tilt ? `G92 ${tilt.id}0            # Zero payout tilt angle` : ''}
    RESPOND MSG="WindStack: Winder Ready. Starting Program."

[gcode_macro WIND_COMPLETE]
description: Finish winding job and safely park
gcode:
    M400                # Wait for all buffer moves to complete
    G90
    G1 X0 F3000         # Return carriage home
    ${tilt ? `G1 ${tilt.id}0 F2000        # Center payout tilt` : ''}
    M84                 # Disable stepper idle hold
    RESPOND MSG="WindStack: Winding Complete!"

[gcode_macro RESET_MANDREL]
description: Reset accumulated rotary degrees without physical homing
gcode:
    G92 Y0
    RESPOND MSG="Spindle degrees reset to 0."
`;

        this.element.querySelector('#klipper-cfg-text').value = cfg;
    }
}
