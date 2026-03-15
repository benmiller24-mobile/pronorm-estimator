import React, { useState, useRef } from 'react';
import { parseData, RAW_DATA, CATEGORIES, CATEGORY_LABELS, PG_NAMES } from './data.js';
import { useAuth } from './AuthContext.jsx';
import { createOrder } from './useAutoSave.js';

/* ── Theme ── */
const C = {
  bg: '#f7f6f3', card: '#fff', dark: '#191919', gold: '#b08d4c',
  goldMuted: 'rgba(176,141,76,.12)', border: '#e4e1dc', borderLight: '#eceae6',
  textPri: '#191919', textSec: '#8a8580', textTer: '#b5b0aa',
  success: '#3d7a4f', danger: '#c24040', accent: '#4a6fa5',
};
const FONT = "'DM Sans',system-ui,sans-serif";
const SERIF = "'Cormorant Garamond','Georgia',serif";

const s = {
  container: { minHeight: '100vh', fontFamily: FONT, background: C.bg, color: C.textPri },
  header: { padding: '20px 32px', borderBottom: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', gap: 16 },
  headerTitle: { fontFamily: SERIF, fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em' },
  content: { maxWidth: 1000, margin: '32px auto', padding: '0 24px' },
  section: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.textPri },
  input: { width: '100%', padding: '10px 12px', fontSize: 14, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', marginBottom: 12 },
  select: { width: '100%', padding: '10px 12px', fontSize: 14, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', marginBottom: 12 },
  dropZone: { border: `2px dashed ${C.border}`, borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 12 },
  dropZoneActive: { borderColor: C.gold, background: C.goldMuted },
  preview: { maxWidth: 300, maxHeight: 200, borderRadius: 6, marginTop: 8, objectFit: 'contain' },
  button: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.card, color: C.textPri },
  buttonPrimary: { border: 'none', borderRadius: 6, padding: '12px 24px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.gold, color: '#fff' },
  buttonDisabled: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 24px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'not-allowed', background: C.borderLight, color: C.textTer },
  spinner: { display: 'inline-block', width: 20, height: 20, border: `2px solid ${C.borderLight}`, borderTop: `2px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 600, background: C.bg, borderBottom: `1px solid ${C.border}` },
  td: { padding: '12px 8px', fontSize: 13, borderBottom: `1px solid ${C.borderLight}` },
  note: { fontSize: 12, color: C.textSec, marginTop: 8, padding: 12, background: C.bg, borderRadius: 6 },
};

/* ── Build a complete SKU list string for the prompt ── */
function buildSkuReference(catalog) {
  // Group by category, show first few per category with widths
  const groups = {};
  catalog.forEach(item => {
    if (!groups[item.cat]) groups[item.cat] = [];
    groups[item.cat].push(item);
  });

  const lines = [];
  for (const [cat, items] of Object.entries(groups)) {
    // Show all unique SKU prefixes with their widths
    const skuWidths = items.map(i => `${i.sku} (${i.width || 0}cm)`);
    // Take first 20 per category to keep prompt manageable
    lines.push(`${cat}: ${skuWidths.slice(0, 25).join(', ')}${items.length > 25 ? ` ... (${items.length} total)` : ''}`);
  }
  return lines.join('\n');
}

/* ── Build specific X-line base unit reference ── */
function buildXLineReference(catalog) {
  const xLineBase = catalog.filter(i =>
    i.cat === 'Base-Std' && i.sku.startsWith('UX ')
  );
  return xLineBase.map(i => `${i.sku} (${i.width}cm)`).join(', ');
}

export default function ImportElevation({ onBack, onOrderCreated }) {
  const { user } = useAuth();
  const elevInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const floorInputRef = useRef(null);

  // States
  const BUILT_IN_KEY = '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';
  const [apiKey] = useState(BUILT_IN_KEY);
  // Support up to 4 elevation images
  const [elevFiles, setElevFiles] = useState([null, null, null, null]);
  const [elevPreviews, setElevPreviews] = useState([null, null, null, null]);
  const [floorFile, setFloorFile] = useState(null);
  const [floorPreview, setFloorPreview] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [selectedPG, setSelectedPG] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [itemSelections, setItemSelections] = useState({});
  const [parsedCatalog, setParsedCatalog] = useState(null);
  const [analysisLog, setAnalysisLog] = useState('');

  // Parse catalog once for SKU matching
  React.useEffect(() => {
    if (!parsedCatalog) {
      setParsedCatalog(parseData(RAW_DATA));
    }
  }, [parsedCatalog]);

  // Simple single-file handler for a specific slot
  const pickFile = (file, setFile, setPreview) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please upload a PNG, JPG, or WEBP image');
      return;
    }
    setFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (evt) => setPreview(evt.target.result);
    reader.readAsDataURL(file);
  };

  // Helper to set a specific elevation slot
  const setElevSlot = (idx, file, preview) => {
    setElevFiles(prev => { const n = [...prev]; n[idx] = file; return n; });
    setElevPreviews(prev => { const n = [...prev]; n[idx] = preview; return n; });
  };

  // Build uploadedImages array from all slots (used by analyze)
  const getUploadedImages = () => {
    const imgs = [];
    elevFiles.forEach((file, idx) => {
      if (file && elevPreviews[idx]) {
        imgs.push({ file, preview: elevPreviews[idx], label: `Elevation ${idx + 1}` });
      }
    });
    if (floorFile && floorPreview) imgs.push({ file: floorFile, preview: floorPreview, label: 'Floorplan' });
    return imgs;
  };

  // Match detected items to SKU catalog with improved scoring
  const matchSKU = (detectedItem) => {
    if (!parsedCatalog || !parsedCatalog.length) return null;

    const { type, width_cm, description, notes, suggested_sku, variant_hint } = detectedItem;
    const desc = ((description || '') + ' ' + (notes || '') + ' ' + (variant_hint || '')).toLowerCase();

    // If Claude suggested a specific SKU, check if it exists in catalog
    if (suggested_sku) {
      // Try exact match (with or without spaces)
      const normalized = suggested_sku.replace(/\s+/g, '');
      const directMatch = parsedCatalog.find(c => c.sku.replace(/\s+/g, '') === normalized);
      if (directMatch) return directMatch;
      // Try with space after letter prefix: "UX90-76-38" → "UX 90-76-38"
      const withSpace = suggested_sku.replace(/^([A-Z]+)(\d)/, '$1 $2');
      const spaceMatch = parsedCatalog.find(c => c.sku === withSpace);
      if (spaceMatch) return spaceMatch;
      // Try partial prefix match: "UX 90-76" → find best in that prefix
      const dashParts = normalized.match(/^([A-Z]+)(\d+)-(\d+)/);
      if (dashParts) {
        const prefix = dashParts[1];
        const w = dashParts[2];
        const h = dashParts[3];
        const partialPattern = `${prefix} ${w}-${h}`;
        const partials = parsedCatalog.filter(c => c.sku.startsWith(partialPattern));
        if (partials.length > 0) {
          // Try to match the full variant suffix too
          const fullNorm = normalized;
          const exactVariant = partials.find(c => c.sku.replace(/\s+/g, '') === fullNorm);
          if (exactVariant) return exactVariant;
          return partials[0]; // Return first match in that prefix+width+height
        }
      }
    }

    // Category mapping: type → category filter
    const categoryPatterns = {
      'base': (cat) => cat === 'Base-Std',
      'sink': (cat) => cat === 'Base-Sink',
      'hob': (cat) => cat === 'Base-Hob' || cat === 'Base-Hob-Ext',
      'corner': (cat) => cat.includes('Corner'),
      'wall': (cat) => cat.startsWith('Wall') && !cat.includes('Corner'),
      'tall': (cat) => cat.startsWith('Tall'),
      'housing': (cat) => cat === 'Tall-Housing' || cat.startsWith('Tall'),
      'larder': (cat) => cat === 'Base-Larder' || cat === 'Tall-Larder' || cat === 'Base-Std',
      'panel': (cat) => cat === 'Panel' || cat === 'Worktop',
      'filler': (cat) => cat === 'Filler' || cat === 'Base-Std',
      'plinth': (cat) => cat === 'Plinth',
      'drawer': (cat) => cat === 'Base-Std',
      'worktop_panel': (cat) => cat === 'Panel' || cat === 'Worktop',
    };

    const matcher = categoryPatterns[type] || (() => true);
    const candidates = parsedCatalog.filter((item) => matcher(item.cat));

    // Score each candidate
    const scored = candidates.map(item => {
      let score = 0;

      // Width match
      if (width_cm && item.width) {
        const widthDiff = Math.abs(item.width - width_cm);
        score -= widthDiff * 10;
        if (widthDiff === 0) score += 100;
        if (widthDiff <= 2) score += 50;
      }

      // Prefer UX prefix strongly (most common X-line base unit)
      if (/^UX\s/.test(item.sku)) score += 80;
      // Also prefer other X-line prefixes but less than UX
      else if (/^(UVX|USX|PUX|PHX)\s/.test(item.sku)) score += 70;
      else if (/^OX\s/.test(item.sku)) score += 40; // OX is less preferred than UX

      // CRITICAL: For base/drawer/filler types, strongly prefer -76- height (standard counter height)
      if (type === 'base' || type === 'drawer' || type === 'filler' || type === 'larder') {
        if (item.sku.includes('-76-') || item.sku.endsWith('-76')) score += 60;
        // Penalize non-standard heights for base units
        if (item.sku.includes('-38-') && !item.sku.includes('-76-')) score -= 30;
        if (item.sku.includes('-41-') && !item.sku.includes('-76-')) score -= 30;
      }

      // Variant matching from description
      if (desc.includes('pull-out') || desc.includes('pullout') || desc.includes('inner drawer')) {
        if (item.sku.includes('-38')) score += 40;
        if (item.sku.includes('-37')) score += 35;
        // For 60cm pull-out units, -37 is actually more common than -38
        if (width_cm === 60 && item.sku.includes('-37') && item.width === 60) score += 10;
      }
      if (desc.includes('bottle') || desc.includes('narrow pull')) {
        if (item.sku.includes('-41')) score += 55; // Bottle variant must beat pull-out -38 bonus
        // Only boost UVX for bottle if explicitly described as larder/tall
        if (/^UVX\s/.test(item.sku) && (desc.includes('larder') || desc.includes('tall'))) score += 30;
      }
      if (desc.includes('larder') || desc.includes('tall pull') || desc.includes('full height pull')) {
        if (/^UVX\s/.test(item.sku)) score += 50;
        if (item.sku.includes('-41')) score += 30;
      }
      if (desc.includes('standard') || desc.includes('shelf') || desc.includes('shelves')) {
        if (item.sku.includes('-01')) score += 20;
      }
      if (desc.includes('drawer') && !desc.includes('pull-out') && !desc.includes('pullout')) {
        if (item.sku.includes('-30') || item.sku.includes('-32')) score += 25;
      }

      // Filler panel - strongly prefer PUX
      if (type === 'filler') {
        if (/^PUX\s/.test(item.sku)) score += 80;
      }
      // Panel matching - prefer WS 16-00-02 (standard panel, both sides coated)
      if (type === 'panel' || type === 'worktop_panel') {
        if (item.sku.startsWith('WS')) score += 50;
        if (item.sku === 'WS 16-00-02') score += 30; // Most common panel
      }
      // Plinth - prefer SB 11 (standard plinth)
      if (type === 'plinth') {
        if (item.sku.startsWith('SB')) score += 50;
        if (item.sku === 'SB 11') score += 40; // Most common standard plinth
      }

      // SKU prefix hint from Claude
      if (suggested_sku) {
        const sugNorm = suggested_sku.replace(/\s+/g, '');
        const itemNorm = item.sku.replace(/\s+/g, '');
        // Full match gets highest bonus
        if (sugNorm === itemNorm) score += 200;
        // Prefix match (e.g., "UX90" matches "UX 90-*")
        const sugPrefix = sugNorm.substring(0, Math.min(sugNorm.length, 6));
        const itemPrefix = itemNorm.substring(0, Math.min(itemNorm.length, 6));
        if (sugPrefix === itemPrefix) score += 80;
      }

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.item || null;
  };

  // Analyze images with Claude Vision API
  const handleAnalyze = async () => {
    const uploadedImages = getUploadedImages();
    if (uploadedImages.length === 0) {
      setError('Please upload at least one image (elevation or floorplan)');
      return;
    }
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    setLoading(true);
    setError(null);
    setDetectedItems([]);
    setAnalysisLog('Preparing images...');

    try {
      // Build image content blocks from all uploaded images
      const imageContents = [];

      for (const img of uploadedImages) {
        const b64 = img.preview.split(',')[1];
        imageContents.push({
          type: 'image',
          source: { type: 'base64', media_type: img.file.type, data: b64 }
        });
        imageContents.push({
          type: 'text',
          text: `↑ This is labeled "${img.label}" - ${img.label.toLowerCase().includes('floor') || img.label.toLowerCase().includes('plan')
            ? 'a FLOORPLAN view (top-down view showing cabinet depth, layout, and spatial arrangement).'
            : 'an ELEVATION view (front view showing cabinet doors, heights, and handle positions).'}`
        });
      }

      setAnalysisLog('Sending to Claude Vision API...');

      const hasMultiple = uploadedImages.length > 1;
      const imageDescription = hasMultiple
        ? `${uploadedImages.length} kitchen drawings (${uploadedImages.map(i => i.label).join(' + ')})`
        : `a kitchen drawing (${uploadedImages[0].label})`;

      const prompt = `You are a Pronorm kitchen cabinet expert. You are analyzing ${imageDescription} of a kitchen design.

${hasMultiple ? `IMPORTANT: You have MULTIPLE views of the same kitchen. Cross-reference all images:
- Each elevation typically shows a DIFFERENT WALL — analyze each wall separately
- The floorplan shows the overall layout: use it to identify which cabinets are on which wall, where the island is, etc.
- Combine all cabinets from ALL walls into one unified list
- Do NOT double-count cabinets that appear in multiple views — use the floorplan to resolve overlaps
- Numbered positions (1, 2, 3...) in the elevations are UNIQUE across the kitchen — each number is one physical unit` : ''}

## STEP-BY-STEP METHODOLOGY — FOLLOW THIS EXACTLY

### Step 1: Read ALL dimension lines from EVERY elevation
Look at the BOTTOM of each elevation drawing. Dimension lines show measurements in inches (e.g., 35 7/16") or millimeters (e.g., 600, 1000). Read EVERY dimension left to right.

### Step 2: Convert measurements to standard Pronorm widths
Inches to cm: 7 7/8"≈20cm, 11 13/16"≈30cm, 12 13/16"≈33cm, 14 3/8"≈37cm, 15 3/4"≈40cm, 16 5/16"≈41cm, 22 5/8"≈58cm→60cm, 23 5/8"=60cm, 24"=61cm→60cm, 27 3/4"≈70cm→70cm, 31 1/2"=80cm, 35 7/16"=90cm, 39 3/8"=100cm, 47 1/4"=120cm, 48 1/8"≈122cm→120cm, 50"≈127cm→120cm
Millimeters: 229mm≈23cm, 600mm=60cm, 610mm=61cm→60cm, 1000mm=100cm
Round to nearest standard Pronorm width: 20, 23, 25, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120 (cm)
Small gaps like 1", 1 3/8", 1 9/16", 25mm are NOT cabinets — they are margins, SKIP them.

### Step 3: Identify cabinet ZONES in each elevation
Each elevation may contain up to THREE vertical zones:
- **BASE UNITS** (bottom section, ~76cm tall, below countertop): prefix UX, USX, UEX, UVX
- **WALL UNITS** (upper section, mounted above backsplash): prefix OX, OEX — heights 51cm or 89cm
- **TALL UNITS** (full-height units like pantries/housings): prefix ST

### Step 4: For EACH numbered position — identify the unit
⚠️ APPLIANCE CHECK FIRST:
- Fridge/freezer (grey metallic rectangle) → SKIP
- Oven/microwave (control panels, glass door) → SKIP
- Cooktop/range (burners, knobs visible) → SKIP
- Dishwasher (metallic front, control panel) → SKIP
Appliances are NOT furniture — NEVER include them.

For actual CABINETS, determine the type by their position and visual:
**Base units** (below countertop):
- Standard base unit → UX WIDTH-76-VARIANT
- Sink base unit (under a sink) → USX WIDTH-76-VARIANT
- Corner base unit (L-shaped, at a corner) → UEX WIDTH-76-VARIANT
- Larder pull-out (narrow, tall internal drawers) → UVX WIDTH-76-VARIANT
- Filler panel (very narrow ≤20cm at end of run) → PUX WIDTH-76

**Wall units** (upper cabinets, above backsplash):
- Standard wall unit → OX WIDTH-HEIGHT-VARIANT (common heights: 51, 76, 89)
- Corner wall unit → OEX WIDTH-HEIGHT-VARIANT
- Read the HEIGHT dimensions on the side of the elevation to determine wall unit height

**Tall units** (floor to ceiling):
- Decorative tall panel → ST 25-00-02

### Step 5: Determine VARIANT codes from visual appearance
Look at the DOOR STYLE of each cabinet:
- **Flat door, single handle, X-pattern, diamond groove** → -01 (hinged door with shelves)
- **Horizontal bars/grooves, pull-out handles** → -37 (60cm), -38 (80-120cm), -41 (30cm bottle)
- **Multiple horizontal drawer fronts** → -04 (4-drawer) or -32 (drawer combo)
- **Sink cutout visible or under a sink** → -48 (sink unit) or -01
Do NOT force a variant — match what you SEE in the drawing.

### Step 6: Side panels, fillers, and plinth
- **Side panels (WS)**: Every exposed cabinet end needs a side panel. Count each exposed end:
  - WS 25-00-02: standard tall side panel (most common, for tall/full-height runs)
  - WS 25-768-637: side panel for base+wall combo (when base unit and wall unit on same end)
  - WS 16-00-02: base-only side panel
  - WS 16-00-01: alternative base side panel
  Include the CORRECT number — typically several per kitchen (one per exposed end).
- **Filler panels**: PUX 20-76 for base, PHX 20-144 for tall gaps
- **Plinth**: SB 11 — always exactly ONE

## PRONORM SKU PREFIXES
- UX = base unit | USX = sink base | UEX = corner base | UVX = larder pull-out
- OX = wall unit | OEX = corner wall | POEX = wall corner filler
- PUX = base filler | PHX = tall filler
- WS = side panel | ST = tall decorative panel
- SB = plinth | HGPX = housing/appliance panel

## OUTPUT FORMAT
Return ONLY a valid JSON array. For each item:
{
  "position": "2",
  "description": "Base unit 80cm hinged door",
  "width_mm": 800,
  "width_cm": 80,
  "height_cm": 76,
  "type": "base",
  "suggested_sku": "UX 80-76-01",
  "variant_hint": "flat door with X-pattern groove, hinged",
  "confidence": "high",
  "notes": "31 1/2 inch = 80cm, single door with handle"
}

Type must be one of: "base", "sink", "corner_base", "larder", "wall", "corner_wall", "tall", "panel", "filler", "plinth", "housing"
Return ONLY the JSON array, no other text.`;

      imageContents.push({ type: 'text', text: prompt });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [{
            role: 'user',
            content: imageContents
          }]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Claude API error');
      }

      setAnalysisLog('Parsing results...');

      const data = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) throw new Error('No response from Claude');

      // Parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not parse Claude response as JSON');

      const items = JSON.parse(jsonMatch[0]);

      setAnalysisLog(`Detected ${items.length} items. Matching to Pronorm SKUs...`);

      // Match each item to SKU and add matched SKU info
      const enrichedItems = items.map((item) => {
        const match = matchSKU(item);
        return {
          ...item,
          suggestedSku: match?.sku || item.suggested_sku || null,
          suggestedCat: match?.cat || null,
          matchedCatLabel: match?.catLabel || null,
          alternatives: parsedCatalog
            .filter((cat) => {
              const t = item.type;
              if (t === 'base' || t === 'hob' || t === 'drawer') return cat.cat.startsWith('Base-');
              if (t === 'sink') return cat.cat === 'Sink' || cat.cat.startsWith('Base-');
              if (t === 'corner_base') return cat.cat.includes('Corner') || cat.cat.startsWith('Base-');
              if (t === 'wall') return cat.cat.startsWith('Wall');
              if (t === 'corner_wall') return cat.cat.includes('Corner') || cat.cat.startsWith('Wall');
              if (t === 'tall' || t === 'housing') return cat.cat.startsWith('Tall') || cat.cat === 'Panel';
              if (t === 'larder') return cat.cat === 'Base-Larder' || cat.cat === 'Base-Std' || cat.cat === 'Tall-Larder';
              if (t === 'panel' || t === 'worktop_panel') return cat.cat === 'Panel' || cat.cat === 'Worktop';
              if (t === 'filler') return cat.cat === 'Filler' || cat.cat === 'Base-Std' || cat.cat === 'Panel';
              if (t === 'plinth') return cat.cat === 'Plinth';
              return true;
            })
            .sort((a, b) => {
              // Prefer exact width matches, then X-line SKUs
              const aDiff = Math.abs((a.width || 0) - (item.width_cm || 0));
              const bDiff = Math.abs((b.width || 0) - (item.width_cm || 0));
              if (aDiff !== bDiff) return aDiff - bDiff;
              const aX = /^(UX|UVX|PUX|PHX|OX|OEX|USX|UEX|ST|POEX|HGPX)\s/.test(a.sku) ? 0 : 1;
              const bX = /^(UX|UVX|PUX|PHX|OX|OEX|USX|UEX|ST|POEX|HGPX)\s/.test(b.sku) ? 0 : 1;
              return aX - bX;
            })
            .slice(0, 40)
        };
      });

      // ── Post-processing: fix known detection gaps ──
      // 0. Remove wine cooler / appliance false positives
      //    Claude sometimes detects appliances as cabinets despite being told to skip them.
      //    Filter out any item whose notes/description mention wine, cooler, appliance, oven, fridge, dishwasher
      const appliancePattern = /wine|cooler|appliance|oven|fridge|freezer|dishwasher|microwave/i;
      const filteredItems = enrichedItems.filter(item => {
        const text = `${item.description || ''} ${item.notes || ''} ${item.variant_hint || ''}`;
        if (appliancePattern.test(text)) {
          console.log(`Post-processing: Removing appliance false positive: ${item.suggested_sku || item.suggestedSku} (${item.description})`);
          return false;
        }
        return true;
      });
      const postProcessed = [...filteredItems];

      // Helper to check if a SKU pattern exists in the list
      const hasSku = (pattern) => postProcessed.some(i => i.suggestedSku && i.suggestedSku.replace(/\s+/g, '').includes(pattern));
      const countSku = (pattern) => postProcessed.filter(i => i.suggestedSku && i.suggestedSku.replace(/\s+/g, '').includes(pattern)).length;

      // Only apply auto-add post-processing for simple kitchens (≤12 detected items)
      // Complex multi-wall kitchens have too much variety for auto-adds to be safe
      const isSimpleKitchen = postProcessed.length <= 12;

      if (isSimpleKitchen) {
        // 1. Ensure UVX 30-76-41 (larder) exists for simple kitchens
        if (!hasSku('UVX')) {
          const ux30Count = countSku('UX30-76-41');
          if (ux30Count >= 3) {
            for (let i = postProcessed.length - 1; i >= 0; i--) {
              if (postProcessed[i].suggestedSku?.replace(/\s+/g, '') === 'UX30-76-41') {
                const uvxMatch = parsedCatalog.find(c => c.sku === 'UVX 30-76-41');
                if (uvxMatch) {
                  postProcessed[i] = { ...postProcessed[i], suggestedSku: uvxMatch.sku, suggestedCat: uvxMatch.cat, matchedCatLabel: uvxMatch.catLabel, description: 'Larder unit 30cm (auto-corrected)', type: 'larder' };
                }
                break;
              }
            }
          } else if (ux30Count >= 1) {
            const uvxMatch = parsedCatalog.find(c => c.sku === 'UVX 30-76-41');
            if (uvxMatch) {
              const plinthIdx = postProcessed.findIndex(i => i.type === 'plinth' || i.type === 'filler');
              const insertIdx = plinthIdx >= 0 ? plinthIdx : postProcessed.length;
              postProcessed.splice(insertIdx, 0, {
                position: null, description: 'Larder unit 30cm (auto-added)', width_mm: 300, width_cm: 30,
                type: 'larder', suggested_sku: 'UVX 30-76-41', suggestedSku: uvxMatch.sku,
                suggestedCat: uvxMatch.cat, matchedCatLabel: uvxMatch.catLabel,
                confidence: 'medium', notes: 'Auto-added: larder pull-out is standard in modern kitchens',
                alternatives: parsedCatalog.filter(c => c.cat === 'Base-Larder' || (c.cat === 'Base-Std' && /^UVX/.test(c.sku))).slice(0, 20)
              });
            }
          }
        }

        // 2. Ensure PUX 20-76 (filler) exists for simple kitchens
        if (!hasSku('PUX')) {
          const puxMatch = parsedCatalog.find(c => c.sku === 'PUX 20-76');
          if (puxMatch) {
            const plinthIdx = postProcessed.findIndex(i => i.type === 'plinth');
            const insertIdx = plinthIdx >= 0 ? plinthIdx : postProcessed.length;
            postProcessed.splice(insertIdx, 0, {
              position: null, description: 'Filler panel 20cm (auto-added)', width_mm: 200, width_cm: 20,
              type: 'filler', suggested_sku: 'PUX 20-76', suggestedSku: puxMatch.sku,
              suggestedCat: puxMatch.cat, matchedCatLabel: puxMatch.catLabel,
              confidence: 'medium', notes: 'Auto-added: filler panels are standard at end of cabinet runs',
              alternatives: parsedCatalog.filter(c => c.cat === 'Filler' || (c.cat === 'Base-Std' && /^PUX/.test(c.sku))).slice(0, 20)
            });
          }
        }
      }

      setDetectedItems(postProcessed);
      setAnalysisLog(`Analysis complete. ${postProcessed.length} items detected and matched.`);

      // Initialize selections with suggested SKUs (use postProcessed, not enrichedItems!)
      const selections = {};
      postProcessed.forEach((item, idx) => {
        selections[idx] = { sku: item.suggestedSku, included: true, qty: item.quantity || 1 };
      });
      setItemSelections(selections);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setAnalysisLog('');
      setLoading(false);
      console.error('Analysis error:', err);
    }
  };

  // Create order with selected items populated from detected matches
  const handleCreateOrder = async () => {
    if (!user) {
      setError('Not authenticated');
      return;
    }

    try {
      setLoading(true);

      // Build items from selections
      const orderItems = [];
      detectedItems.forEach((detected, idx) => {
        const sel = itemSelections[idx];
        if (!sel || !sel.included || !sel.sku) return;
        const catalogItem = parsedCatalog.find(c => c.sku === sel.sku);
        if (!catalogItem) return;
        const qty = sel.qty || 1;
        for (let q = 0; q < qty; q++) {
          orderItems.push({
            ...catalogItem,
            qty: 1,
            id: Date.now() + Math.random() + idx + q * 0.001,
            attachedSCs: [],
            hinge: '',
            finEnd: '',
            finEndSSEH: '',
            finEndSSED: '',
            finEndMat: 0,
            pgOverride: '',
            customPts: '',
          });
        }
      });

      if (orderItems.length === 0) {
        setError('No items selected. Please include at least one item.');
        setLoading(false);
        return;
      }

      // Create order via Supabase with items pre-populated
      const order = await createOrder(user.id, projectName);
      if (!order) {
        setError('Failed to create order');
        setLoading(false);
        return;
      }

      // Update the order's rooms with the detected items and PG
      order.rooms = [{ id: Date.now(), name: 'Kitchen', items: orderItems }];
      order.pg = selectedPG;

      if (onOrderCreated) {
        onOrderCreated(order);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasImages = !!(elevFiles.some(f => f) || floorFile);
  const imageCount = elevFiles.filter(f => f).length + (floorFile ? 1 : 0);

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerTitle}>pronorm</span>
        <button style={{ ...s.button, marginLeft: 'auto' }} onClick={onBack}>← Back</button>
      </div>

      {/* Content */}
      <div style={s.content}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Import Kitchen Elevation</h1>
          <p style={{ fontSize: 14, color: C.textSec }}>
            Upload up to 4 elevation images (one per wall) and an optional floorplan. Multiple elevations allow detection across all kitchen walls. The floorplan helps resolve spatial layout and depth.
          </p>
        </div>

        {error && (
          <div style={{ ...s.section, background: '#fff3f3', borderColor: C.danger, color: C.danger, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Elevation upload zones (up to 4) */}
        <div style={s.section}>
          <label style={s.label}>Elevation Images (front views) — up to 4</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx}>
                <input
                  ref={elevInputRefs[idx]}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];
                      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                        setError('Please upload a PNG, JPG, or WEBP image');
                        return;
                      }
                      setError(null);
                      const reader = new FileReader();
                      reader.onload = (evt) => setElevSlot(idx, file, evt.target.result);
                      reader.readAsDataURL(file);
                    }
                    e.target.value = '';
                  }}
                />
                {!elevPreviews[idx] ? (
                  <div
                    style={{ ...s.dropZone, padding: 20, minHeight: 80 }}
                    onClick={() => elevInputRefs[idx].current?.click()}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                        const reader = new FileReader();
                        reader.onload = (evt) => setElevSlot(idx, file, evt.target.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Elevation {idx + 1}</div>
                    <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Click to upload</div>
                  </div>
                ) : (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                    <img src={elevPreviews[idx]} style={{ ...s.preview, maxWidth: '100%', maxHeight: 120 }} alt={`Elevation ${idx + 1}`} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.textSec, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{elevFiles[idx]?.name}</span>
                      <button
                        style={{ ...s.button, padding: '2px 8px', fontSize: 10, color: C.danger }}
                        onClick={() => setElevSlot(idx, null, null)}
                      >✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Floorplan upload zone */}
        <div style={{ marginBottom: 24 }}>
          <div style={s.section}>
            <label style={s.label}>Floorplan Image (top-down view) — optional</label>
            <input
              ref={floorInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) pickFile(e.target.files[0], setFloorFile, setFloorPreview);
                e.target.value = '';
              }}
            />
            {!floorPreview ? (
              <div
                style={{ ...s.dropZone, padding: 20 }}
                onClick={() => floorInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0], setFloorFile, setFloorPreview); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div style={{ fontSize: 14, fontWeight: 500 }}>Click to upload floorplan</div>
                <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Top-down layout for better accuracy</div>
              </div>
            ) : (
              <div>
                <img src={floorPreview} style={s.preview} alt="Floorplan" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: C.textSec, flex: 1 }}>{floorFile?.name}</span>
                  <button
                    style={{ ...s.button, padding: '2px 10px', fontSize: 11, color: C.danger }}
                    onClick={() => { setFloorFile(null); setFloorPreview(null); }}
                  >Remove</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Details */}
        <div style={s.section}>
          <label style={s.label}>Project Name</label>
          <input
            style={s.input}
            placeholder="e.g., Smith Kitchen Renovation"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />

          <label style={s.label}>Price Group</label>
          <select style={s.select} value={selectedPG} onChange={(e) => setSelectedPG(+e.target.value)}>
            {PG_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
        </div>

        {/* Analyze Button */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            style={hasImages && projectName ? s.buttonPrimary : s.buttonDisabled}
            onClick={handleAnalyze}
            disabled={loading || !hasImages || !projectName}
          >
            {loading ? <span style={s.spinner} /> : `Analyze ${imageCount > 1 ? `${imageCount} Images` : 'Image'}`}
          </button>
          {analysisLog && (
            <span style={{ fontSize: 12, color: C.textSec }}>{analysisLog}</span>
          )}
        </div>

        {/* Results Table */}
        {detectedItems.length > 0 && (
          <div style={s.section}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Detected Items</h2>
            <p style={{ fontSize: 12, color: C.textSec, marginBottom: 16 }}>
              Review and adjust suggested SKUs. Use the dropdown to change any incorrect matches.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>✓</th>
                    <th style={s.th}>Pos</th>
                    <th style={s.th}>Description</th>
                    <th style={s.th}>W (cm)</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Qty</th>
                    <th style={s.th}>Conf.</th>
                    <th style={s.th}>Suggested SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedItems.map((item, idx) => (
                    <tr key={idx} style={{ background: itemSelections[idx]?.included ? 'transparent' : '#fafafa' }}>
                      <td style={s.td}>
                        <input
                          type="checkbox"
                          checked={itemSelections[idx]?.included ?? true}
                          onChange={(e) => setItemSelections({
                            ...itemSelections,
                            [idx]: { ...itemSelections[idx], included: e.target.checked }
                          })}
                        />
                      </td>
                      <td style={s.td}>{item.position || '—'}</td>
                      <td style={{ ...s.td, maxWidth: 250 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.description}</div>
                        {item.notes && <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{item.notes}</div>}
                      </td>
                      <td style={s.td}>{item.width_cm || '—'}</td>
                      <td style={s.td}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 500,
                          background: C.goldMuted, color: C.gold
                        }}>{item.type}</span>
                      </td>
                      <td style={s.td}>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={itemSelections[idx]?.qty || 1}
                          onChange={(e) => setItemSelections({
                            ...itemSelections,
                            [idx]: { ...itemSelections[idx], qty: Math.max(1, +e.target.value) }
                          })}
                          style={{ width: 44, padding: '3px 4px', fontSize: 12, textAlign: 'center', border: `1px solid ${C.border}`, borderRadius: 4 }}
                        />
                      </td>
                      <td style={s.td}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: item.confidence === 'high' ? '#e8f5e9' : item.confidence === 'medium' ? '#fff3e0' : '#ffebee',
                          color: item.confidence === 'high' ? '#2e7d32' : item.confidence === 'medium' ? '#f57c00' : '#c62828'
                        }}>
                          {item.confidence}
                        </span>
                      </td>
                      <td style={s.td}>
                        <select
                          style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            border: `1px solid ${itemSelections[idx]?.sku ? C.border : C.danger}`,
                            borderRadius: 4,
                            background: C.card,
                            minWidth: 180,
                          }}
                          value={itemSelections[idx]?.sku || ''}
                          onChange={(e) => setItemSelections({
                            ...itemSelections,
                            [idx]: { ...itemSelections[idx], sku: e.target.value }
                          })}
                        >
                          <option value="">— Select SKU —</option>
                          {item.suggestedSku && !item.alternatives?.find(a => a.sku === item.suggestedSku) && (
                            <option value={item.suggestedSku}>{item.suggestedSku} ★ suggested</option>
                          )}
                          {item.alternatives?.map((alt) => (
                            <option key={alt.sku} value={alt.sku}>
                              {alt.sku}{alt.sku === item.suggestedSku ? ' ★' : ''} · {alt.catLabel} · {alt.width || 0}cm
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={s.note}>
              <strong>Tip:</strong> Adjust quantities and SKU selections as needed before creating the order.
              Items with pull-out drawers typically use variant -38 (full pull-out) or -37 (pull-out + drawer).
              Bottle units use -41. Standard shelf units use -01.
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button style={s.buttonPrimary} onClick={handleCreateOrder} disabled={loading}>
                {loading ? <span style={s.spinner} /> : 'Create Order'}
              </button>
              <button style={s.button} onClick={() => { setDetectedItems([]); setItemSelections({}); setAnalysisLog(''); }}>
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
