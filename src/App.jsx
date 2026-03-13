import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RAW_DATA, SPECIAL_CONSTRUCTIONS_RAW, CATEGORIES, CATEGORY_LABELS,
  CATEGORY_GROUPS, LINES, PG_NAMES, PG_MULTIPLIERS,
  parseData, parseSpecialConstructions,
} from './data.js';

/* ── Theme ── */
const C = {
  bg: '#f7f6f3', card: '#fff', dark: '#191919', gold: '#b08d4c',
  goldMuted: 'rgba(176,141,76,.12)', border: '#e4e1dc', borderLight: '#eceae6',
  textPri: '#191919', textSec: '#8a8580', textTer: '#b5b0aa',
  success: '#3d7a4f', danger: '#c24040', accent: '#4a6fa5',
};
const FONT = "'DM Sans',system-ui,sans-serif";
const SERIF = "'Cormorant Garamond','Georgia',serif";

/* ── Per-m² panel SKUs (priced per square metre — need W×H input) ── */
const PER_SQM_SKUS = new Set([
  'ST 10-00-02','ST 16-00-02','ST 25-00-02','ST 50-00-02',
  'WS 10-00-02','WS 16-00-02','WS 25-00-02','WS 50-00-02',
  'WN 16-00-02','WN 25-00-02','WN 50-00-02',
  'WW 16-00-02','WW 25-00-02','WW 50-00-02',
]);

/* ── Dimension-based special construction codes ── */
const DIMENSION_SC = {
  'X-01-H':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 620' },
  'X-01-O':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 620' },
  'X-01-U':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 520' },
  'X-01-HFX':{ dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 620' },
  'X-06-H':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 370' },
  'X-06-O':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 370' },
  'X-06-U':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 270' },
  'X-02-H':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 620' },
  'X-02-O':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 620' },
  'X-02-U':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 520' },
  'X-07-H':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 370' },
  'X-07-U':  { dim: 'depth', label: 'Depth (mm)', placeholder: 'e.g. 270' },
  'X-03-H':  { dim: 'width', label: 'Width (mm)', placeholder: 'e.g. 450' },
  'X-03-O':  { dim: 'width', label: 'Width (mm)', placeholder: 'e.g. 450' },
  'X-03-U':  { dim: 'width', label: 'Width (mm)', placeholder: 'e.g. 350' },
  'X-15-U':  { dim: 'width', label: 'Width (mm)', placeholder: 'e.g. 350' },
  'X-04-H':  { dim: 'height', label: 'Height (mm)', placeholder: 'e.g. 780' },
  'X-04-O':  { dim: 'height', label: 'Height (mm)', placeholder: 'e.g. 780' },
  'X-04-U':  { dim: 'height', label: 'Height (mm)', placeholder: 'e.g. 680' },
  'X-35-FV': { dim: 'front', label: 'Front size (mm)', placeholder: 'e.g. 600' },
  'X-35-FV2204':{ dim: 'front', label: 'Front size (mm)', placeholder: 'e.g. 600' },
  'X-35-FVO':{ dim: 'front', label: 'Front size (mm)', placeholder: 'e.g. 600' },
  'X-35-FWV':{ dim: 'front', label: 'Front size (mm)', placeholder: 'e.g. 600' },
  'X-35-F':  { dim: 'front', label: 'Front size (mm)', placeholder: 'e.g. 600' },
  'X-13-O':  { dim: 'side', label: 'Side dim (mm)', placeholder: 'e.g. 400' },
  'X-12-O':  { dim: 'front', label: 'Front dim (mm)', placeholder: 'e.g. 400' },
};

/* ── Format helpers ── */
const fmtPts = n => n.toLocaleString() + ' pts';
const fmtCost = (pts, cf) => '$' + (pts * cf).toFixed(2);

/* ── Main App ── */
export default function App() {
  const [items, setItems] = useState([]);
  const [specialItems, setSpecialItems] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [lineFilter, setLineFilter] = useState('all');
  const [pg, setPg] = useState(3); // PG 3 = base
  const [cfInput, setCfInput] = useState('');
  const [cf, setCf] = useState(35);
  const [projectName, setProjectName] = useState('New Kitchen Project');
  const [rooms, setRooms] = useState([{ id: 1, name: 'Kitchen', items: [], specialItems: [] }]);
  const [activeRoom, setActiveRoom] = useState(1);
  const [showCost, setShowCost] = useState(false);
  const [showSpecial, setShowSpecial] = useState(false);
  const [scSearch, setScSearch] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    setItems(parseData(RAW_DATA));
    setSpecialItems(parseSpecialConstructions(SPECIAL_CONSTRUCTIONS_RAW));
  }, []);

  /* ── Filtered catalog ── */
  const filtered = useMemo(() => {
    let h = items;
    if (catFilter !== 'all') h = h.filter(i => i.cat === catFilter);
    if (lineFilter !== 'all') h = h.filter(i => i.line === lineFilter);
    if (search.trim()) {
      const words = search.toLowerCase().split(/\s+/);
      h = h.filter(i => {
        const haystack = (i.sku + ' ' + i.catLabel + ' ' + i.line + ' ' + (i.width ? i.width + 'cm' : '')).toLowerCase();
        return words.every(w => haystack.includes(w));
      });
    }
    return h.slice(0, 200);
  }, [items, search, catFilter, lineFilter]);

  /* ── Filtered special constructions ── */
  const filteredSC = useMemo(() => {
    if (!scSearch.trim()) return specialItems;
    const words = scSearch.toLowerCase().split(/\s+/);
    return specialItems.filter(sc => {
      const haystack = (sc.code + ' ' + sc.description + ' ' + sc.section + ' ' + sc.notes).toLowerCase();
      return words.every(w => haystack.includes(w));
    });
  }, [specialItems, scSearch]);

  /* ── Category counts ── */
  const catCounts = useMemo(() => {
    const counts = {};
    let total = 0;
    items.forEach(i => {
      counts[i.cat] = (counts[i.cat] || 0) + 1;
      total++;
    });
    counts._total = total;
    return counts;
  }, [items]);

  /* ── Room operations ── */
  const room = rooms.find(r => r.id === activeRoom) || rooms[0];

  const addToRoom = useCallback((item) => {
    const isSqm = PER_SQM_SKUS.has(item.sku);
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      // Per-m² panels always get a new row (each panel may have different dimensions)
      if (isSqm) {
        return { ...r, items: [...r.items, { ...item, qty: 1, id: Date.now() + Math.random(), isSqm: true, panelW: '', panelH: '' }] };
      }
      const existing = r.items.find(x => x.sku === item.sku);
      if (existing) {
        return { ...r, items: r.items.map(x => x.sku === item.sku ? { ...x, qty: x.qty + 1 } : x) };
      }
      return { ...r, items: [...r.items, { ...item, qty: 1, id: Date.now() + Math.random() }] };
    }));
  }, [activeRoom]);

  const addSCToRoom = useCallback((sc) => {
    const isDimensionBased = !!DIMENSION_SC[sc.code];
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      // Dimension-based SCs always get a new row (each may have different custom size)
      if (isDimensionBased) {
        return { ...r, specialItems: [...(r.specialItems || []), { ...sc, qty: 1, customSize: '', id: Date.now() + Math.random() }] };
      }
      const existing = (r.specialItems || []).find(x => x.code === sc.code);
      if (existing) {
        return { ...r, specialItems: (r.specialItems || []).map(x => x.code === sc.code ? { ...x, qty: x.qty + 1 } : x) };
      }
      return { ...r, specialItems: [...(r.specialItems || []), { ...sc, qty: 1, id: Date.now() + Math.random() }] };
    }));
  }, [activeRoom]);

  const updateQty = (itemId, qty, isSqmItem = false) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      if (isSqmItem) {
        return qty <= 0
          ? { ...r, items: r.items.filter(x => x.id !== itemId) }
          : { ...r, items: r.items.map(x => x.id === itemId ? { ...x, qty } : x) };
      }
      return qty <= 0
        ? { ...r, items: r.items.filter(x => x.sku !== itemId) }
        : { ...r, items: r.items.map(x => x.sku === itemId ? { ...x, qty } : x) };
    }));
  };

  const updatePanelDims = (itemId, field, value) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return { ...r, items: r.items.map(x => x.id === itemId ? { ...x, [field]: value } : x) };
    }));
  };

  const updateSCQty = (itemId, qty) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return qty <= 0
        ? { ...r, specialItems: (r.specialItems || []).filter(x => x.id !== itemId) }
        : { ...r, specialItems: (r.specialItems || []).map(x => x.id === itemId ? { ...x, qty } : x) };
    }));
  };

  const updateSCCustomSize = (itemId, customSize) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return { ...r, specialItems: (r.specialItems || []).map(x => x.id === itemId ? { ...x, customSize } : x) };
    }));
  };

  const addRoom = () => {
    const id = Date.now();
    setRooms(rs => [...rs, { id, name: `Room ${rs.length + 1}`, items: [], specialItems: [] }]);
    setActiveRoom(id);
  };

  const removeRoom = (id) => {
    if (rooms.length <= 1) return;
    setRooms(rs => rs.filter(r => r.id !== id));
    if (activeRoom === id) setActiveRoom(rooms.find(r => r.id !== id)?.id);
  };

  const renameRoom = (id, name) => {
    setRooms(rs => rs.map(r => r.id === id ? { ...r, name } : r));
  };

  /* ── Helpers for per-m² items ── */
  const calcSqm = (item) => {
    const w = parseFloat(item.panelW) || 0;
    const h = parseFloat(item.panelH) || 0;
    return (w * h) / 1000000; // mm × mm → m²
  };
  const itemTotal = (item) => {
    if (item.isSqm) {
      const sqm = calcSqm(item);
      return Math.round(item.prices[pg] * sqm * item.qty);
    }
    return item.prices[pg] * item.qty;
  };

  /* ── Totals ── */
  const roomTotal = (r) => {
    const itemsTotal = (r.items || []).reduce((s, i) => s + itemTotal(i), 0);
    const scTotal = (r.specialItems || []).reduce((s, i) => s + i.points * i.qty, 0);
    return itemsTotal + scTotal;
  };
  const roomItemCount = (r) => {
    const itemsCount = (r.items || []).reduce((s, i) => s + i.qty, 0);
    const scCount = (r.specialItems || []).reduce((s, i) => s + i.qty, 0);
    return itemsCount + scCount;
  };
  const grandTotal = rooms.reduce((s, r) => s + roomTotal(r), 0);
  const grandCount = rooms.reduce((s, r) => s + roomItemCount(r), 0);

  /* ── PDF export ── */
  const exportPDF = () => {
    const w = window.open('', '_blank');
    const html = `<!DOCTYPE html><html><head><title>${projectName} - Order</title>
    <style>body{font-family:${FONT};margin:40px;color:#191919}
    h1{font-family:${SERIF};font-weight:400;font-size:28px;margin-bottom:4px}
    h2{font-size:16px;margin-top:24px;border-bottom:1px solid #e4e1dc;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eceae6;font-size:13px}
    th{background:#f7f6f3;font-weight:600}
    .r{text-align:right}.footer{margin-top:30px;font-size:11px;color:#8a8580}
    .total{font-weight:700;font-size:15px;border-top:2px solid #191919}</style></head><body>
    <h1>${projectName}</h1>
    <div style="font-size:12px;color:#8a8580">PG: ${PG_NAMES[pg]} · ${new Date().toLocaleDateString()}</div>
    ${rooms.map(r => `
      <h2>${r.name}</h2>
      <table><tr><th>SKU</th><th>Type</th><th>Line</th><th class="r">Qty</th><th class="r">Unit Pts</th><th class="r">Total Pts</th>${showCost ? '<th class="r">Cost</th>' : ''}</tr>
      ${(r.items || []).map(i => {
        const tot = i.isSqm ? Math.round(i.prices[pg] * ((parseFloat(i.panelW)||0)*(parseFloat(i.panelH)||0)/1000000) * i.qty) : i.prices[pg] * i.qty;
        const sqmNote = i.isSqm ? ` <span style="color:#4a6fa5;font-size:11px">[${((parseFloat(i.panelW)||0)*(parseFloat(i.panelH)||0)/1000000).toFixed(4)} m²]</span>` : '';
        const unitLabel = i.isSqm ? `${fmtPts(i.prices[pg])}/m²` : fmtPts(i.prices[pg]);
        return `<tr><td>${i.sku}${sqmNote}</td><td>${i.catLabel}</td><td>${i.line}</td><td class="r">${i.qty}</td><td class="r">${unitLabel}</td><td class="r">${fmtPts(tot)}</td>${showCost ? `<td class="r">${fmtCost(tot, cf / 100)}</td>` : ''}</tr>`;
      }).join('')}
      ${(r.specialItems || []).map(i => `<tr><td>${i.code}${i.customSize ? ` <span style="color:#4a6fa5;font-size:11px">[${i.customSize}mm]</span>` : ''}</td><td>Special Construction</td><td>${i.section || '—'}</td><td class="r">${i.qty}</td><td class="r">${fmtPts(i.points)}</td><td class="r">${fmtPts(i.points * i.qty)}</td>${showCost ? `<td class="r">${fmtCost(i.points * i.qty, cf / 100)}</td>` : ''}</tr>`).join('')}
      <tr class="total"><td colspan="5">Room Total</td><td class="r">${fmtPts(roomTotal(r))}</td>${showCost ? `<td class="r">${fmtCost(roomTotal(r), cf / 100)}</td>` : ''}</tr>
      </table>
    `).join('')}
    <div style="margin-top:20px;padding-top:12px;border-top:2px solid #191919;font-size:16px;font-weight:700">
      Grand Total: ${fmtPts(grandTotal)}${showCost ? ` · ${fmtCost(grandTotal, cf / 100)}` : ''}
    </div>
    <div class="footer">Pronorm Dealer Estimator · Price Book 09/2025 · ${grandCount} items · ${rooms.length} room(s)</div>
    <script>window.print()</script></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  /* ── Styles ── */
  const s = {
    app: { display: 'flex', minHeight: '100vh', fontFamily: FONT, background: C.bg, color: C.textPri },
    sidebar: { width: 420, minWidth: 420, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.card },
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', gap: 12 },
    logo: { fontFamily: SERIF, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', color: C.dark },
    badge: { fontSize: 11, fontWeight: 600, color: C.gold, background: C.goldMuted, padding: '2px 8px', borderRadius: 10 },
    select: { appearance: 'none', WebkitAppearance: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 28px 7px 10px', fontSize: 13, fontFamily: FONT, background: `${C.card} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238a8580'/%3E%3C/svg%3E") right 10px center/10px no-repeat`, cursor: 'pointer', color: C.textPri },
    input: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: FONT, color: C.textPri, outline: 'none' },
    btn: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.card, color: C.textPri },
    btnGold: { border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.gold, color: '#fff' },
    searchWrap: { padding: '12px 16px', borderBottom: `1px solid ${C.border}` },
    searchInput: { width: '100%', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: FONT, color: C.textPri, outline: 'none', boxSizing: 'border-box' },
    catalogList: { flex: 1, overflow: 'auto', padding: 0 },
    row: { display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer', transition: 'background .15s' },
    roomPanel: { flex: 1, overflow: 'auto', padding: '16px 24px' },
    roomCard: { background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 },
    tab: (active) => ({ padding: '6px 14px', fontSize: 12, fontWeight: active ? 600 : 400, borderRadius: 6, cursor: 'pointer', background: active ? C.goldMuted : 'transparent', color: active ? C.gold : C.textSec, border: 'none', fontFamily: FONT }),
    toggleBtn: (active) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : C.card, color: active ? '#fff' : C.textSec, fontFamily: FONT }),
  };

  return (
    <div style={s.app}>
      {/* ── Left Sidebar: Catalog ── */}
      <div style={s.sidebar}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={s.logo}>pronorm</span>
            <span style={s.badge}>{catCounts._total || 0} SKUs</span>
          </div>
          {/* PG selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {PG_NAMES.map((name, idx) => (
              <button key={idx} style={s.tab(pg === idx)} onClick={() => setPg(idx)}>
                {name} (×{(PG_MULTIPLIERS[idx] / 100).toFixed(2)})
              </button>
            ))}
          </div>
          {/* CF + Cost + PDF */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input style={{ ...s.input, width: 60 }} placeholder="CF $" value={cfInput}
              onChange={e => { setCfInput(e.target.value); const n = parseFloat(e.target.value); if (n > 0) setCf(n); }} />
            <button style={s.toggleBtn(showCost)} onClick={() => setShowCost(!showCost)}>COST</button>
            <button style={s.btn} onClick={exportPDF}>PDF ORDER</button>
          </div>
        </div>

        {/* Line + Category filters */}
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}` }}>
          <select style={{ ...s.select, flex: 1 }} value={lineFilter} onChange={e => setLineFilter(e.target.value)}>
            <option value="all">All Lines</option>
            {LINES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select style={{ ...s.select, flex: 1 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All Types ({catCounts._total || 0})</option>
            {CATEGORY_GROUPS.map(g => (
              <React.Fragment key={g.label}>
                <option disabled>── {g.label} ──</option>
                {g.cats.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]} ({catCounts[c] || 0})</option>
                ))}
              </React.Fragment>
            ))}
          </select>
        </div>

        {/* Toggle: Catalog / Special Constructions */}
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}` }}>
          <button style={s.toggleBtn(!showSpecial)} onClick={() => setShowSpecial(false)}>Catalog</button>
          <button style={s.toggleBtn(showSpecial)} onClick={() => setShowSpecial(true)}>
            Special Constructions ({specialItems.length})
          </button>
        </div>

        {/* Search */}
        <div style={s.searchWrap}>
          {showSpecial ? (
            <input style={s.searchInput} placeholder="Search special construction code or description..."
              value={scSearch} onChange={e => setScSearch(e.target.value)} />
          ) : (
            <input style={s.searchInput} placeholder="Search SKU, type, or keyword..."
              value={search} onChange={e => setSearch(e.target.value)} />
          )}
        </div>

        {/* Catalog / Special Constructions List */}
        <div style={s.catalogList} ref={listRef}>
          {showSpecial ? (
            filteredSC.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.textTer, fontSize: 13 }}>No special constructions found</div>
            ) : filteredSC.map((sc, idx) => (
              <div key={sc.code + idx} style={s.row}
                onMouseEnter={e => e.currentTarget.style.background = C.goldMuted}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => addSCToRoom(sc)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sc.code}</div>
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                    {sc.description} · <span style={{ color: C.accent }}>{sc.section}</span>
                  </div>
                  {sc.notes && <div style={{ fontSize: 10, color: C.textTer, marginTop: 1 }}>{sc.notes.substring(0, 80)}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.gold, minWidth: 60 }}>
                  {fmtPts(sc.points)}
                </div>
              </div>
            ))
          ) : (
            filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.textTer, fontSize: 13 }}>No items match your search</div>
            ) : (
              <>
                {filtered.map(item => (
                  <div key={item.sku} style={s.row}
                    onMouseEnter={e => e.currentTarget.style.background = C.goldMuted}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => addToRoom(item)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.sku}</div>
                      <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                        {item.catLabel} · {item.line}{item.width ? ` · ${item.width}cm` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>
                        {fmtPts(item.prices[pg])}{PER_SQM_SKUS.has(item.sku) ? '/m²' : ''}
                      </div>
                      {showCost && (
                        <div style={{ fontSize: 11, color: C.success, marginTop: 2 }}>
                          {fmtCost(item.prices[pg], cf / 100)}{PER_SQM_SKUS.has(item.sku) ? '/m²' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length >= 200 && (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: C.textTer }}>
                    Showing 200 of many — refine your search
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* ── Right Side: Room Builder ── */}
      <div style={s.main}>
        {/* Top bar */}
        <div style={s.header}>
          <input style={{ ...s.input, fontFamily: SERIF, fontSize: 18, fontWeight: 400, border: 'none', padding: '4px 0', flex: 1 }}
            value={projectName} onChange={e => setProjectName(e.target.value)} />
          <div style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>
            {fmtPts(grandTotal)}
            {showCost && <span style={{ color: C.success, marginLeft: 8 }}>{fmtCost(grandTotal, cf / 100)}</span>}
          </div>
        </div>

        {/* Room tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 24px', borderBottom: `1px solid ${C.border}`, background: C.card, flexWrap: 'wrap' }}>
          {rooms.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button style={s.tab(activeRoom === r.id)} onClick={() => setActiveRoom(r.id)}>
                {r.name} ({roomItemCount(r)})
              </button>
              {rooms.length > 1 && (
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textTer, padding: '2px 4px' }}
                  onClick={() => removeRoom(r.id)}>×</button>
              )}
            </div>
          ))}
          <button style={{ ...s.btn, fontSize: 11, padding: '4px 10px' }} onClick={addRoom}>+ Room</button>
        </div>

        {/* Room content */}
        <div style={s.roomPanel}>
          {/* Room name edit */}
          <div style={{ marginBottom: 12 }}>
            <input style={{ ...s.input, fontWeight: 600, fontSize: 14, width: 200 }}
              value={room.name} onChange={e => renameRoom(room.id, e.target.value)} />
          </div>

          {/* Items */}
          {(room.items.length === 0 && (!room.specialItems || room.specialItems.length === 0)) ? (
            <div style={{ textAlign: 'center', padding: 48, color: C.textTer }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>Empty Room</div>
              <div style={{ fontSize: 12 }}>Click items in the catalog to add them here</div>
            </div>
          ) : (
            <div style={s.roomCard}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Item</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Type</th>
                    <th style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 80 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 90 }}>Unit</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 90 }}>Total</th>
                    {showCost && <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 90 }}>Cost</th>}
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(room.items || []).map(item => {
                    const key = item.isSqm ? item.id : item.sku;
                    const qtyId = item.isSqm ? item.id : item.sku;
                    const sqm = item.isSqm ? calcSqm(item) : 0;
                    const total = itemTotal(item);
                    return (
                    <React.Fragment key={key}>
                    <tr style={{ borderBottom: item.isSqm ? 'none' : `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 600 }}>{item.sku}</td>
                      <td style={{ padding: '8px 0', fontSize: 12, color: C.textSec }}>
                        {item.catLabel} · {item.line}
                        {item.isSqm && <span style={{ color: C.accent, fontWeight: 600 }}> · per m²</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button style={{ ...s.btn, padding: '2px 8px', fontSize: 11 }} onClick={() => updateQty(qtyId, item.qty - 1, item.isSqm)}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                          <button style={{ ...s.btn, padding: '2px 8px', fontSize: 11 }} onClick={() => updateQty(qtyId, item.qty + 1, item.isSqm)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13 }}>
                        {item.isSqm ? `${fmtPts(item.prices[pg])}/m²` : fmtPts(item.prices[pg])}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, fontWeight: 600 }}>{fmtPts(total)}</td>
                      {showCost && <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, color: C.success }}>{fmtCost(total, cf / 100)}</td>}
                      <td>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 14 }}
                          onClick={() => updateQty(qtyId, 0, item.isSqm)}>×</button>
                      </td>
                    </tr>
                    {item.isSqm && (
                      <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <td colSpan={showCost ? 7 : 6} style={{ padding: '0 0 8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Dimensions:</span>
                            <input
                              style={{ ...s.input, width: 80, fontSize: 12, padding: '4px 8px', borderColor: item.panelW ? C.accent : C.border }}
                              placeholder="Width mm"
                              value={item.panelW || ''}
                              onChange={e => updatePanelDims(item.id, 'panelW', e.target.value)}
                            />
                            <span style={{ fontSize: 12, color: C.textSec }}>×</span>
                            <input
                              style={{ ...s.input, width: 80, fontSize: 12, padding: '4px 8px', borderColor: item.panelH ? C.accent : C.border }}
                              placeholder="Height mm"
                              value={item.panelH || ''}
                              onChange={e => updatePanelDims(item.id, 'panelH', e.target.value)}
                            />
                            {sqm > 0 ? (
                              <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>{sqm.toFixed(4)} m²</span>
                            ) : (
                              <span style={{ fontSize: 10, color: C.danger }}>Enter panel dimensions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                  {(room.specialItems || []).map(item => {
                    const dimInfo = DIMENSION_SC[item.code];
                    return (
                    <React.Fragment key={item.id}>
                    <tr style={{ borderBottom: dimInfo ? 'none' : `1px solid ${C.borderLight}`, background: 'rgba(74,111,165,0.04)' }}>
                      <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 600, color: C.accent }}>{item.code}</td>
                      <td style={{ padding: '8px 0', fontSize: 12, color: C.textSec }}>Special · {item.section}</td>
                      <td style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button style={{ ...s.btn, padding: '2px 8px', fontSize: 11 }} onClick={() => updateSCQty(item.id, item.qty - 1)}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                          <button style={{ ...s.btn, padding: '2px 8px', fontSize: 11 }} onClick={() => updateSCQty(item.id, item.qty + 1)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13 }}>{fmtPts(item.points)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, fontWeight: 600 }}>{fmtPts(item.points * item.qty)}</td>
                      {showCost && <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, color: C.success }}>{fmtCost(item.points * item.qty, cf / 100)}</td>}
                      <td>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 14 }}
                          onClick={() => updateSCQty(item.id, 0)}>×</button>
                      </td>
                    </tr>
                    {dimInfo && (
                      <tr style={{ borderBottom: `1px solid ${C.borderLight}`, background: 'rgba(74,111,165,0.04)' }}>
                        <td colSpan={showCost ? 7 : 6} style={{ padding: '0 0 8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                            <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{dimInfo.label}:</span>
                            <input
                              style={{ ...s.input, width: 100, fontSize: 12, padding: '4px 8px', borderColor: item.customSize ? C.accent : C.border }}
                              placeholder={dimInfo.placeholder}
                              value={item.customSize || ''}
                              onChange={e => updateSCCustomSize(item.id, e.target.value)}
                            />
                            {!item.customSize && <span style={{ fontSize: 10, color: C.danger }}>Enter custom size</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Room total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `2px solid ${C.dark}` }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Room Total</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{fmtPts(roomTotal(room))}</div>
                {showCost && <div style={{ fontSize: 14, fontWeight: 700, color: C.success }}>{fmtCost(roomTotal(room), cf / 100)}</div>}
              </div>
            </div>
          )}

          {/* Grand total */}
          {rooms.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: '12px 0', borderTop: `2px solid ${C.gold}` }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Grand Total</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>
                {fmtPts(grandTotal)}
              </div>
              {showCost && <div style={{ fontSize: 16, fontWeight: 700, color: C.success }}>{fmtCost(grandTotal, cf / 100)}</div>}
              <div style={{ fontSize: 12, color: C.textSec, alignSelf: 'center' }}>
                {grandCount} items · {rooms.length} rooms
              </div>
            </div>
          )}

          {/* Summary */}
          <div style={{ fontSize: 11, color: C.textTer, marginTop: 12 }}>
            {grandCount} items · {rooms.length} room{rooms.length > 1 ? 's' : ''} · Price Book 09/2025 · Classic line excluded
          </div>
        </div>
      </div>
    </div>
  );
}
