import * as THREE from 'three';
import { FiberRenderer } from './fiber-renderer.js';
import { getLayerColor } from './layer-colors.js';

/**
 * Viewer3D — High-fidelity Three.js 3D visualization for composite filament winding.
 * Features:
 * - Multi-layer visual stacking with true physical radial buildup
 * - Per-layer color coding with semi-gloss composite resin finish
 * - Smooth helical ribbon geometry mapped to the cylinder surface
 * - Per-layer visibility toggles (hide/isolate plies)
 * - Layer-by-layer progressive winding animation scrubber
 */
export class Viewer3D {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mandrelMesh = null;
        this.mandrelWireframe = null;
        this.fiberGroup = null;
        this.fiberRenderer = new FiberRenderer();
        
        this.layerMeshes = [];
        this.totalVertices = 0;
        this._animId = null;
        this._pendingMandrel = null;
        this._pendingRender = null;

        this.ready = this._init();
    }

    async _init() {
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e1721); // Deep slate technical dark

        const w = this.container.clientWidth || 800;
        const h = this.container.clientHeight || 600;

        this.camera = new THREE.PerspectiveCamera(40, w / h, 1, 10000);
        this.camera.position.set(220, 140, 260);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Studio lighting for composite sheen
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(150, 250, 180);
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x88bbff, 0.6);
        fillLight.position.set(-150, -100, -150);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(0, 200, -200);
        this.scene.add(rimLight);

        // Group container for fibers
        this.fiberGroup = new THREE.Group();
        this.scene.add(this.fiberGroup);

        // Default or pending mandrel
        const initD = this._pendingMandrel ? this._pendingMandrel.diameter : 22.63;
        const initL = this._pendingMandrel ? this._pendingMandrel.length : 150;
        this._pendingMandrel = null;
        this.updateMandrel(initD, initL);

        if (this._pendingRender) {
            const { layerPlans, mandrelDiam, materialThickness, visStates } = this._pendingRender;
            this._pendingRender = null;
            this.renderLayers(layerPlans, mandrelDiam, materialThickness, visStates);
        }

        // Resize observer
        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(this.container);

        this._animate();
    }

    _animate() {
        this._animId = requestAnimationFrame(() => this._animate());
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    _onResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    /**
     * Update the mandrel cylinder mesh with realistic metallic workshop look.
     */
    updateMandrel(diameter, length) {
        if (!this.scene) {
            this._pendingMandrel = { diameter, length };
            return;
        }
        if (this.mandrelMesh) {
            this.scene.remove(this.mandrelMesh);
            this.mandrelMesh.geometry.dispose();
            this.mandrelMesh.material.dispose();
        }
        if (this.mandrelWireframe) {
            this.scene.remove(this.mandrelWireframe);
            this.mandrelWireframe.geometry.dispose();
            this.mandrelWireframe.material.dispose();
        }

        const radius = diameter / 2;
        const g = new THREE.CylinderGeometry(radius, radius, length, 64, 1, false);
        g.rotateZ(Math.PI / 2);
        g.translate(length / 2, 0, 0);

        // High-end brushed sintered steel / CAD aluminum aesthetic
        this.mandrelMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            color: 0x22313f,
            roughness: 0.4,
            metalness: 0.8,
            side: THREE.DoubleSide
        }));
        this.scene.add(this.mandrelMesh);

        // Subtle lathe chuck center reference line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-15, 0, 0),
            new THREE.Vector3(length + 15, 0, 0)
        ]);
        this.mandrelWireframe = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
            color: 0x4a6572,
            transparent: true,
            opacity: 0.4
        }));
        this.scene.add(this.mandrelWireframe);

        // Center camera controls target on mandrel midpoint
        if (this.controls) {
            this.controls.target.set(length / 2, 0, 0);
        }
    }

    /**
     * Clear all current fiber ribbons from the scene.
     */
    clearFibers() {
        if (!this.scene || !this.fiberGroup) return;

        for (const item of this.layerMeshes) {
            if (item.mesh) {
                this.fiberGroup.remove(item.mesh);
                item.geometry.dispose();
                item.material.dispose();
            }
        }
        this.layerMeshes = [];
        this.totalVertices = 0;
    }

    /**
     * Render multi-layer composite winding with radial laminate stacking.
     * 
     * @param {Array} layerPlans - Array of layer plan objects from PathPlanner
     * @param {number} mandrelDiam - Base mandrel diameter (mm)
     * @param {number} materialThickness - Cured thickness per ply (mm)
     * @param {Array<boolean>} [visibilityStates] - Optional visibility flags per layer
     */
    renderLayers(layerPlans, mandrelDiam, materialThickness = 0.125, visibilityStates = []) {
        if (!this.scene || !this.fiberGroup) {
            this._pendingRender = { layerPlans, mandrelDiam, materialThickness, visStates: visibilityStates };
            return;
        }
        this.clearFibers();

        if (!layerPlans || layerPlans.length === 0) return;

        const baseRadius = mandrelDiam / 2;
        let cumulativeThickness = 0;
        let totalVerts = 0;

        for (let i = 0; i < layerPlans.length; i++) {
            const plan = layerPlans[i];
            const layerColor = getLayerColor(i);
            const isVisible = visibilityStates[i] !== undefined ? visibilityStates[i] : true;

            // Physical laminate buildup: each ply sits on top of previous layers
            // Baseline 0.12mm clearance prevents Z-fighting against mandrel metal
            const effectiveRadius = baseRadius + 0.12 + cumulativeThickness;
            const fiberWidth = plan.fiberWidth || 3.3;

            // Generate surface points and ribbon BufferGeometry
            const points = this.fiberRenderer.segmentsToPoints(plan.segments, effectiveRadius, 8);
            const geometry = this.fiberRenderer.createRibbonGeometry(points, fiberWidth);

            // Realistic composite resin / carbon fiber sheen
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(layerColor),
                roughness: 0.32,
                metalness: 0.18,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = isVisible;
            this.fiberGroup.add(mesh);

            const vertCount = geometry.attributes.position ? geometry.attributes.position.count : 0;
            const startIndex = totalVerts;
            const endIndex = startIndex + vertCount;
            totalVerts += vertCount;

            this.layerMeshes.push({
                layerIndex: i,
                type: plan.type,
                mesh,
                geometry,
                material,
                color: layerColor,
                vertexCount: vertCount,
                startIndex,
                endIndex,
                visible: isVisible
            });

            // Increment for next layer's radial placement
            cumulativeThickness += materialThickness;
        }

        this.totalVertices = totalVerts;
    }

    /**
     * Fallback for raw G-code lines (single-mesh mode).
     */
    renderFibers(gcodeLines, mandrelDiam, fiberWidth) {
        this.clearFibers();

        const r = (mandrelDiam / 2) + 0.15;
        const pts = this.fiberRenderer.gcodeToPoints(gcodeLines, r, 8);

        if (pts.length > 1) {
            const geometry = this.fiberRenderer.createRibbonGeometry(pts, fiberWidth);
            const material = new THREE.MeshStandardMaterial({
                color: 0x00d2ff,
                roughness: 0.32,
                metalness: 0.18,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            this.fiberGroup.add(mesh);

            const vertCount = geometry.attributes.position.count;
            this.layerMeshes.push({
                layerIndex: 0,
                type: 'composite',
                mesh,
                geometry,
                material,
                color: '#00d2ff',
                vertexCount: vertCount,
                startIndex: 0,
                endIndex: vertCount,
                visible: true
            });
            this.totalVertices = vertCount;
        }
    }

    /**
     * Toggle visibility of an individual layer.
     * @param {number} layerIndex - 0-based index
     * @param {boolean} isVisible
     */
    setLayerVisibility(layerIndex, isVisible) {
        if (!this.fiberGroup) return;
        const item = this.layerMeshes.find(m => m.layerIndex === layerIndex);
        if (item) {
            item.visible = isVisible;
            item.mesh.visible = isVisible;
        }
    }

    /**
     * Set the global winding simulation progress (0 to 100%).
     * Progresses through each composite layer sequentially.
     * 
     * @param {number} percent - 0 to 100
     * @returns {{activeLayerIndex: number, layerType: string, layerPercent: number}}
     */
    setProgress(percent) {
        const clampedPct = Math.max(0, Math.min(100, percent));
        const currentTargetVert = Math.floor(this.totalVertices * (clampedPct / 100));

        let activeLayerIndex = 0;
        let activeLayerType = 'helical';
        let layerPercent = 100;

        for (let i = 0; i < this.layerMeshes.length; i++) {
            const layer = this.layerMeshes[i];

            if (currentTargetVert <= layer.startIndex) {
                // Layer hasn't started winding yet
                layer.geometry.setDrawRange(0, 0);
            } else if (currentTargetVert >= layer.endIndex) {
                // Layer is 100% wound
                layer.geometry.setDrawRange(0, layer.vertexCount);
            } else {
                // Layer is actively being wound
                const countInLayer = currentTargetVert - layer.startIndex;
                layer.geometry.setDrawRange(0, countInLayer);
                activeLayerIndex = layer.layerIndex;
                activeLayerType = layer.type;
                layerPercent = Math.round((countInLayer / (layer.vertexCount || 1)) * 100);
            }
        }

        if (clampedPct === 100 && this.layerMeshes.length > 0) {
            const last = this.layerMeshes[this.layerMeshes.length - 1];
            activeLayerIndex = last.layerIndex;
            activeLayerType = last.type;
            layerPercent = 100;
        }

        return { activeLayerIndex, layerType: activeLayerType, layerPercent };
    }

    dispose() {
        if (this._animId) cancelAnimationFrame(this._animId);
        if (this._resizeObserver) this._resizeObserver.disconnect();
        this.clearFibers();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }
}
