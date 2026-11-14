# WindStack — Filament Winder Controller

Multi-machine G-code generator for CNC filament winding. Designed for Klipper + Raspberry Pi controllers.

## Quick Start

### Windows
Double-click **`WindStack.bat`** — it opens in your browser automatically.

### Any OS (macOS / Linux / Windows)
```bash
python launch.py
```

## Requirements

- **Python 3.6+** (for the local web server — no packages needed)
- A modern web browser (Chrome, Firefox, Edge)

## Features

- **Multi-machine support** — 2, 3, and 4-axis Klipper/Marlin configs
- **8 fiber materials** — Carbon (1K–50K), Aramid, E-Glass
- **Helical & hoop winding** with skip-index patterns
- **3D visualization** — Three.js fiber ribbon rendering
- **2D coverage map** — Trace and heatmap density analysis
- **Klipper printer.cfg generator**
- **Moonraker network upload** — 1-click to Raspberry Pi
- **Production estimator** — Time, weight, cost, fiber length
- **Job traveler sheets** — Printable ply schedule with QC checklist
- **Project save/load** — JSON files for reproducible layups

## Sharing This Project

Just zip the entire folder and send it. No build step, no npm install, no dependencies.
The recipient only needs Python installed to run it.
