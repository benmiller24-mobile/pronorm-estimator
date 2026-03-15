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
  const elevInputRef = useRef(null);
  const floorInputRef = useRef(null);

  // States
  const BUILT_IN_KEY = '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';
  const [apiKey] = useState(BUILT_IN_KEY);
  const [elevFile, setElevFile] = useState(null);
  const [elevPreview, setElevPreview] = useState(null);
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

  // Build uploadedImages array from the two slots (used by analyze)
  const getUploadedImages = () => {
    const imgs = [];
    if (elevFile && elevPreview) imgs.push({ file: elevFile, preview: elevPreview, label: 'Elevation' });
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

      // Build X-line reference for the prompt
      const xLineRef = parsedCatalog ? buildXLineReference(parsedCatalog) : '';

      setAnalysisLog('Sending to Claude Vision API...');

      const hasMultiple = uploadedImages.length > 1;
      const imageDescription = hasMultiple
        ? `${uploadedImages.length} kitchen drawings (${uploadedImages.map(i => i.label).join(' + ')})`
        : `a kitchen drawing (${uploadedImages[0].label})`;

      const prompt = `You are a Pronorm kitchen cabinet expert. You are analyzing ${imageDescription} of a kitchen design.

${hasMultiple ? `IMPORTANT: You have MULTIPLE views of the same kitchen. Cross-reference all images:
- Elevation views show door styles, handle positions, and vertical dimensions
- Floorplan views show cabinet depths, spatial layout, and how cabinets relate to each other
- Use ALL views together to accurately identify each cabinet` : ''}

## YOUR TASK
Identify every cabinet, unit, panel, filler, and component. For each one, suggest the most likely PRONORM SKU code.

## PRONORM SKU NAMING CONVENTION
Pronorm X-line base units follow this pattern: UX [width]-[height]-[variant]
- UX = standard base unit (X-line)
- UVX = base larder/bottle pull-out unit (X-line) - tall narrow pull-out storage
- PUX = filler panel (X-line)
- WS 16 = worktop panel / side panel
- SB 11 = plinth (kick board)

### Width codes (first number after prefix):
Width in cm directly encoded: 30, 40, 45, 50, 60, 80, 90, 100, 120

### Height codes (second number):
- 38 = low (drawer height ~38cm)
- 76 = standard base height (~76cm carcase)
- 83 = extended height (~83cm)

### Common variant suffixes (third number):
- 01 = standard with shelves (hinged door)
- 10 = standard with glass door
- 20 = open unit (no door)
- 30 = with 1 inner drawer
- 32 = with 2 inner drawers
- 37 = with 1 pull-out + 1 inner drawer (popular for 60cm wide)
- 38 = full internal pull-out drawers (most popular for 90cm wide)
- 41 = bottle pull-out / narrow pull-out storage
- 44 = with top drawer and door below
- 45 = with waste bin pull-out
- 74 = similar to 37 variant

### ACTUAL AVAILABLE X-LINE BASE SKUs in our catalog:
${xLineRef}

## CONVERSION: Inches to Metric
If dimensions are in inches (marked with " or shown as fractions like 35 7/16"):
- Multiply inches by 25.4 to get mm, then divide by 10 for cm
- Round to nearest standard Pronorm width: 20, 30, 40, 45, 50, 60, 80, 90, 100, 120 cm
- Common conversions: 24" ≈ 60cm, 35 7/16" ≈ 90cm, 23 5/8" ≈ 60cm, 11 13/16" ≈ 30cm, 7 7/8" ≈ 20cm

## IMPORTANT IDENTIFICATION TIPS
1. A wine cooler, fridge, or oven housing is typically 60cm wide - look for the appliance outline
2. Adjacent 90cm units with horizontal handle bars are typically pull-out units (variant -38)
3. Narrow 30cm units next to wider ones are often bottle pull-outs (UX 30-76-41) or larder pull-outs (UVX 30-76-41)
4. Very narrow pieces (≤20cm) at the end of a run are filler panels (PUX 20-76)
5. Don't forget: side panels (WS 16-00-02), plinths (SB 11), and filler panels are critical order items
6. If a position shows a tall narrow unit with internal pull-out mechanism, it's likely UVX (larder variant)
7. Base units at standard height are -76- (76cm carcase height)

## OUTPUT FORMAT
Return a JSON array. For EACH item detected:
{
  "position": "1",
  "description": "Pull-out base unit 90cm with internal drawers",
  "width_mm": 900,
  "width_cm": 90,
  "height_description": "standard base (76cm)",
  "type": "base",
  "suggested_sku": "UX 90-76-38",
  "variant_hint": "pull-out drawers visible, horizontal handle bar",
  "confidence": "high",
  "notes": "Two horizontal handle bars visible indicating full pull-out internal system"
}

Type must be one of: "base", "sink", "hob", "corner", "wall", "tall", "housing", "larder", "panel", "filler", "plinth", "drawer", "worktop_panel"

CRITICAL RULES:
- Include ALL items: panels, plinths, fillers — these are easy to miss but essential
- Use the ACTUAL SKU codes from the catalog reference above
- Every base unit at standard counter height should use -76- height code
- If you see pull-out handles/bars, use -38 or -37 variants
- Suggest quantity if you see the same unit repeated
- Return ONLY the JSON array, no other text`;

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
          max_tokens: 4096,
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
              if (t === 'base' || t === 'sink' || t === 'hob' || t === 'drawer') return cat.cat.startsWith('Base-');
              if (t === 'wall') return cat.cat.startsWith('Wall');
              if (t === 'tall' || t === 'housing') return cat.cat.startsWith('Tall');
              if (t === 'larder') return cat.cat === 'Base-Larder' || cat.cat === 'Base-Std' || cat.cat === 'Tall-Larder';
              if (t === 'corner') return cat.cat.includes('Corner');
              if (t === 'panel' || t === 'worktop_panel') return cat.cat === 'Panel' || cat.cat === 'Worktop';
              if (t === 'filler') return cat.cat === 'Filler' || cat.cat === 'Base-Std';
              if (t === 'plinth') return cat.cat === 'Plinth';
              return true;
            })
            .sort((a, b) => {
              // Prefer exact width matches, then X-line SKUs
              const aDiff = Math.abs((a.width || 0) - (item.width_cm || 0));
              const bDiff = Math.abs((b.width || 0) - (item.width_cm || 0));
              if (aDiff !== bDiff) return aDiff - bDiff;
              const aX = /^(UX|UVX|PUX|PHX)\s/.test(a.sku) ? 0 : 1;
              const bX = /^(UX|UVX|PUX|PHX)\s/.test(b.sku) ? 0 : 1;
              return aX - bX;
            })
            .slice(0, 40)
        };
      });

      setDetectedItems(enrichedItems);
      setAnalysisLog(`Analysis complete. ${enrichedItems.length} items detected and matched.`);

      // Initialize selections with suggested SKUs
      const selections = {};
      enrichedItems.forEach((item, idx) => {
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

  const hasImages = !!(elevFile || floorFile);

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
            Upload an elevation and/or floorplan image. Providing both gives the most accurate detection — the elevation shows cabinet fronts and heights while the floorplan reveals spatial layout and depth.
          </p>
        </div>

        {error && (
          <div style={{ ...s.section, background: '#fff3f3', borderColor: C.danger, color: C.danger, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Two separate image upload zones */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* Elevation zone */}
          <div style={{ ...s.section, flex: '1 1 300px', marginBottom: 0 }}>
            <label style={s.label}>Elevation Image (front view)</label>
            <input
              ref={elevInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) pickFile(e.target.files[0], setElevFile, setElevPreview);
                e.target.value = '';
              }}
            />
            {!elevPreview ? (
              <div
                style={s.dropZone}
                onClick={() => elevInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0], setElevFile, setElevPreview); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div style={{ fontSize: 14, fontWeight: 500 }}>Click to upload elevation</div>
                <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Front view showing cabinets & heights</div>
              </div>
            ) : (
              <div>
                <img src={elevPreview} style={s.preview} alt="Elevation" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: C.textSec, flex: 1 }}>{elevFile?.name}</span>
                  <button
                    style={{ ...s.button, padding: '2px 10px', fontSize: 11, color: C.danger }}
                    onClick={() => { setElevFile(null); setElevPreview(null); }}
                  >Remove</button>
                </div>
              </div>
            )}
          </div>

          {/* Floorplan zone */}
          <div style={{ ...s.section, flex: '1 1 300px', marginBottom: 0 }}>
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
                style={s.dropZone}
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
            {loading ? <span style={s.spinner} /> : `Analyze ${elevFile && floorFile ? '2 Images' : 'Image'}`}
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
