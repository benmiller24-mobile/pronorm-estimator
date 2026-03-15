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
  preview: { width: '100%', maxWidth: 400, height: 'auto', borderRadius: 6, marginTop: 12, marginBottom: 12 },
  button: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.card, color: C.textPri },
  buttonPrimary: { border: 'none', borderRadius: 6, padding: '12px 24px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.gold, color: '#fff' },
  buttonDisabled: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 24px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'not-allowed', background: C.borderLight, color: C.textTer },
  spinner: { display: 'inline-block', width: 20, height: 20, border: `2px solid ${C.borderLight}`, borderTop: `2px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 600, background: C.bg, borderBottom: `1px solid ${C.border}` },
  td: { padding: '12px 8px', fontSize: 13, borderBottom: `1px solid ${C.borderLight}` },
  note: { fontSize: 12, color: C.textSec, marginTop: 8, padding: 12, background: C.bg, borderRadius: 6 },
};

export default function ImportElevation({ onBack, onOrderCreated }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // States
  const BUILT_IN_KEY = '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';
  const [apiKey] = useState(BUILT_IN_KEY);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [selectedPG, setSelectedPG] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [itemSelections, setItemSelections] = useState({});
  const [parsedCatalog, setParsedCatalog] = useState(null);

  // Parse catalog once for SKU matching
  React.useEffect(() => {
    if (!parsedCatalog) {
      setParsedCatalog(parseData(RAW_DATA));
    }
  }, [parsedCatalog]);

  // Handle image upload
  const handleImageDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files || e.target?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (evt) => setImagePreview(evt.target.result);
        reader.readAsDataURL(file);
        setError(null);
      } else {
        setError('Please upload a PNG, JPG, or WEBP image');
      }
    }
  };

  // Match detected items to SKU catalog
  const matchSKU = (detectedItem) => {
    if (!parsedCatalog || !parsedCatalog.length) return null;

    const { type, width_cm, description, notes } = detectedItem;
    const desc = ((description || '') + ' ' + (notes || '')).toLowerCase();

    // Category mapping: type → category filter
    const categoryPatterns = {
      'base': (cat) => cat.startsWith('Base-') && cat !== 'Base-Sink' && cat !== 'Base-Hob',
      'sink': (cat) => cat === 'Base-Sink',
      'hob': (cat) => cat === 'Base-Hob' || cat === 'Base-Hob-Ext',
      'corner': (cat) => cat.includes('Corner'),
      'wall': (cat) => cat.startsWith('Wall') && !cat.includes('Corner'),
      'tall': (cat) => cat.startsWith('Tall'),
      'housing': (cat) => cat === 'Tall-Housing' || cat.startsWith('Tall'),
      'panel': (cat) => cat === 'Panel',
      'filler': (cat) => cat === 'Filler',
      'plinth': (cat) => cat === 'Plinth',
      'drawer': (cat) => cat.startsWith('Base-'),
    };

    const matcher = categoryPatterns[type] || (() => true);
    const candidates = parsedCatalog.filter((item) => {
      if (!matcher(item.cat)) return false;
      return true;
    });

    // Score each candidate: closer width = better, X-line SKUs preferred
    const scored = candidates.map(item => {
      let score = 0;
      // Width match (lower distance = better)
      if (width_cm && item.width) {
        const widthDiff = Math.abs(item.width - width_cm);
        score -= widthDiff * 10; // Penalize width mismatch
        if (widthDiff === 0) score += 100; // Bonus for exact width
      }
      // Prefer X-line SKUs (UX, OX, etc.) as they're the most common range
      if (/^[A-Z]+X\s?\d/.test(item.sku) || item.sku.startsWith('UX') || item.sku.startsWith('OX') || item.sku.startsWith('UVX') || item.sku.startsWith('USX') || item.sku.startsWith('PUX') || item.sku.startsWith('PHX')) {
        score += 50;
      }
      // Prefer standard variants (-01, -38, -41) for base units
      if (type === 'base') {
        if (desc.includes('pull-out') || desc.includes('drawer')) {
          if (item.sku.includes('-38') || item.sku.includes('-37')) score += 30;
        } else if (desc.includes('bottle')) {
          if (item.sku.includes('-41')) score += 30;
        } else {
          if (item.sku.includes('-01')) score += 20;
        }
      }
      // Larder/bottle unit matching
      if (desc.includes('larder') && item.cat === 'Base-Larder') score += 40;
      if (desc.includes('bottle') && item.sku.includes('V')) score += 30;
      // Filler panel
      if (type === 'filler' && item.sku.startsWith('PU')) score += 30;
      // Panel matching
      if (type === 'panel' && (item.sku.startsWith('WS') || item.sku.startsWith('ST'))) score += 30;
      // Plinth
      if (type === 'plinth' && item.sku.startsWith('SB')) score += 30;

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.item || null;
  };

  // Analyze image with Claude Vision API
  const handleAnalyze = async () => {
    if (!imageFile) {
      setError('Please upload an image first');
      return;
    }
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    setLoading(true);
    setError(null);
    setDetectedItems([]);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];
        const imageType = imageFile.type;

        const prompt = `You are a Pronorm kitchen cabinet expert analyzing kitchen elevation drawings and floor plans.

Analyze this image carefully. Identify EVERY cabinet, unit, panel, filler, and component visible. Pay close attention to:
- Numbered positions (1, 2, 3, etc.) in the drawing
- Dimension lines and measurements (may be in inches — convert to cm by multiplying by 2.54)
- Different cabinet types visible: base units (below countertop), wall units (above countertop), tall/larder units (floor to ceiling), appliance housings (wine cooler, oven, fridge), corner units, drawer units, pull-out units, bottle units
- Side panels (tall narrow panels on sides of runs), filler panels (narrow gap fillers), plinths (kick boards at bottom)

For EACH item, return a JSON object with these fields:
- position: the number label visible in the drawing (e.g., "1", "2"), or null if no number
- description: detailed type description (e.g., "Pull-out base unit 90cm", "Bottle unit 30cm", "Side panel", "Appliance housing for wine cooler", "Filler panel 20cm")
- width_mm: width in millimeters. If dimensions are in inches, multiply by 25.4 to get mm. Round to nearest standard Pronorm width: 200, 300, 400, 450, 500, 600, 800, 900, 1000, 1100, 1200 mm
- width_cm: width in centimeters (width_mm / 10)
- height_description: "standard base" (~76cm carcase), "wall" (~51-89cm), "tall" (~200-227cm), "mid-height" (~144cm), or "panel"
- type: one of exactly: "base", "sink", "hob", "corner", "wall", "tall", "housing", "panel", "filler", "plinth", "drawer"
  - Use "housing" for appliance housings (wine cooler, oven, dishwasher)
  - Use "panel" for side panels/stiles
  - Use "filler" for narrow filler panels
  - Use "base" for standard base units, pull-out units, bottle units
  - Use "drawer" for drawer-only units
- confidence: "high" if position number and dimensions are clearly visible, "medium" if estimated, "low" if guessing
- notes: any additional detail (e.g., "has internal drawers", "wine cooler housing", "with bottle holder")

IMPORTANT: Also identify any panels (side panels at ends of runs), plinth boards, and filler pieces — these are often overlooked but are critical parts of a kitchen order.

If dimensions are shown in inches (with " symbol or fractions like 35 7/16"), convert to metric.

Return ONLY a valid JSON array, no other text.`;

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
              content: [
                { type: 'image', source: { type: 'base64', media_type: imageType, data: base64Data } },
                { type: 'text', text: prompt }
              ]
            }]
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || 'Claude API error');
        }

        const data = await response.json();
        const content = data.content?.[0]?.text;
        if (!content) throw new Error('No response from Claude');

        // Parse JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('Could not parse Claude response as JSON');

        const items = JSON.parse(jsonMatch[0]);

        // Match each item to SKU and add matched SKU info
        const enrichedItems = items.map((item) => {
          const match = matchSKU(item);
          return {
            ...item,
            suggestedSku: match?.sku || null,
            suggestedCat: match?.cat || null,
            alternatives: parsedCatalog
              .filter((cat) => {
                const t = item.type;
                if (t === 'base' || t === 'sink' || t === 'hob' || t === 'drawer') return cat.cat.startsWith('Base-');
                if (t === 'wall') return cat.cat.startsWith('Wall');
                if (t === 'tall' || t === 'housing') return cat.cat.startsWith('Tall');
                if (t === 'corner') return cat.cat.includes('Corner');
                if (t === 'panel') return cat.cat === 'Panel';
                if (t === 'filler') return cat.cat === 'Filler';
                if (t === 'plinth') return cat.cat === 'Plinth';
                return true;
              })
              .sort((a, b) => {
                // Prefer exact width matches, then X-line SKUs
                const aDiff = Math.abs((a.width || 0) - (item.width_cm || 0));
                const bDiff = Math.abs((b.width || 0) - (item.width_cm || 0));
                if (aDiff !== bDiff) return aDiff - bDiff;
                const aX = /^[A-Z]*X[\s]?\d/.test(a.sku) ? 0 : 1;
                const bX = /^[A-Z]*X[\s]?\d/.test(b.sku) ? 0 : 1;
                return aX - bX;
              })
              .slice(0, 30)
          };
        });

        setDetectedItems(enrichedItems);

        // Initialize selections with suggested SKUs
        const selections = {};
        enrichedItems.forEach((item, idx) => {
          selections[idx] = { sku: item.suggestedSku, included: true };
        });
        setItemSelections(selections);
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      setError(err.message);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
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
        orderItems.push({
          ...catalogItem,
          qty: 1,
          id: Date.now() + Math.random() + idx,
          attachedSCs: [],
          hinge: '',
          finEnd: '',
          finEndSSEH: '',
          finEndSSED: '',
          finEndMat: 0,
          pgOverride: '',
          customPts: '',
        });
      });

      // Create order via Supabase with items pre-populated
      const order = await createOrder(user.id, projectName);
      if (!order) {
        setError('Failed to create order');
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
          <p style={{ fontSize: 14, color: C.textSec }}>Upload an image of a kitchen elevation or floor plan and Claude will detect cabinets and units.</p>
        </div>

        {error && (
          <div style={{ ...s.section, background: '#fff3f3', borderColor: C.danger, color: C.danger, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Image Upload */}
        <div style={s.section}>
          <label style={s.label}>Kitchen Image</label>
          <div
            style={{
              ...s.dropZone,
              ...(imageFile ? s.dropZoneActive : {})
            }}
            onDrop={handleImageDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleImageDrop(e)}
            />
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {imageFile ? imageFile.name : 'Drag and drop or click to select'}
            </div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 8 }}>
              PNG, JPG, or WEBP (max 20MB recommended)
            </div>
          </div>
          {imagePreview && <img src={imagePreview} style={s.preview} alt="Preview" />}
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
        <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
          <button
            style={imageFile && projectName ? s.buttonPrimary : s.buttonDisabled}
            onClick={handleAnalyze}
            disabled={loading || !imageFile || !projectName}
          >
            {loading ? <span style={s.spinner} /> : 'Analyze Image'}
          </button>
        </div>

        {/* Results Table */}
        {detectedItems.length > 0 && (
          <div style={s.section}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Detected Items</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Include</th>
                    <th style={s.th}>Position</th>
                    <th style={s.th}>Description</th>
                    <th style={s.th}>Width (cm)</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Confidence</th>
                    <th style={s.th}>Suggested SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedItems.map((item, idx) => (
                    <tr key={idx}>
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
                      <td style={s.td}>{item.description}</td>
                      <td style={s.td}>{item.width_cm || '—'}</td>
                      <td style={s.td}>{item.type}</td>
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
                            border: `1px solid ${C.border}`,
                            borderRadius: 4,
                            background: C.card
                          }}
                          value={itemSelections[idx]?.sku || ''}
                          onChange={(e) => setItemSelections({
                            ...itemSelections,
                            [idx]: { ...itemSelections[idx], sku: e.target.value }
                          })}
                        >
                          <option value="">—</option>
                          {item.suggestedSku && !item.alternatives?.find(a => a.sku === item.suggestedSku) && (
                            <option value={item.suggestedSku}>{item.suggestedSku} (suggested)</option>
                          )}
                          {item.alternatives?.map((alt) => (
                            <option key={alt.sku} value={alt.sku}>
                              {alt.sku} · {alt.catLabel} · {alt.width}cm
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button style={s.buttonPrimary} onClick={handleCreateOrder} disabled={loading}>
                {loading ? <span style={s.spinner} /> : 'Create Order'}
              </button>
              <button style={s.button} onClick={() => { setDetectedItems([]); setItemSelections({}); }}>
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
