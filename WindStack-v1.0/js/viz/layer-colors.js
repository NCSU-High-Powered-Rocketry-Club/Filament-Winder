/**
 * layer-colors.js — Curated composite color palette for WindStack.
 * Provides high-contrast, professional technical colors for composite plies.
 */

export const LAYER_PALETTE = [
    { hex: '#00d2ff', name: 'Cyan Blue', dark: '#0084a8', core: '#a6f0ff' },       // Layer 1
    { hex: '#f1c40f', name: 'Amber Gold', dark: '#b7950b', core: '#fef9e7' },      // Layer 2
    { hex: '#2ecc71', name: 'Emerald Green', dark: '#1e8449', core: '#d4efdf' },   // Layer 3
    { hex: '#e056fd', name: 'Violet Neon', dark: '#8c14a8', core: '#f5d6ff' },     // Layer 4
    { hex: '#ff7675', name: 'Coral Red', dark: '#b71540', core: '#ffd4d4' },       // Layer 5
    { hex: '#fd9644', name: 'Sunset Orange', dark: '#c0392b', core: '#ffeaa7' },   // Layer 6
    { hex: '#1dd1a1', name: 'Mint Turquoise', dark: '#10ac84', core: '#c8f7dc' },  // Layer 7
    { hex: '#e84393', name: 'Prussian Rose', dark: '#ad1457', core: '#f8bbd0' },   // Layer 8
    { hex: '#54a0ff', name: 'Cobalt Blue', dark: '#2e86de', core: '#c7ecee' },     // Layer 9
    { hex: '#feca57', name: 'Sun Yellow', dark: '#e67e22', core: '#fff3cd' }       // Layer 10
];

/**
 * Get color definition for a layer index.
 * @param {number} layerIndex - 0-based layer index
 * @returns {{hex: string, name: string, dark: string, core: string}}
 */
export function getLayerColorDef(layerIndex) {
    return LAYER_PALETTE[Math.abs(layerIndex) % LAYER_PALETTE.length];
}

/**
 * Get primary hex color for a layer index.
 * @param {number} layerIndex - 0-based layer index
 * @returns {string} Hex color
 */
export function getLayerColor(layerIndex) {
    return getLayerColorDef(layerIndex).hex;
}
