import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RAW_DATA, SPECIAL_CONSTRUCTIONS_RAW, CATEGORIES, CATEGORY_LABELS,
  CATEGORY_GROUPS, LINES, PG_NAMES, PG_MULTIPLIERS,
  parseData, parseSpecialConstructions,
  SSE_DATA, SSE_HEIGHTS,
} from './data.js';
import { useAuth } from './AuthContext.jsx';
import { useAutoSave } from './useAutoSave.js';

/* ── Theme ── */
const C = {
  bg: '#f7f6f3', card: '#fff', dark: '#191919', gold: '#b08d4c',
  goldMuted: 'rgba(176,141,76,.12)', border: '#e4e1dc', borderLight: '#eceae6',
  textPri: '#191919', textSec: '#8a8580', textTer: '#b5b0aa',
  success: '#3d7a4f', danger: '#c24040', accent: '#4a6fa5',
};
const FONT = "'DM Sans',system-ui,sans-serif";
const SERIF = "'Cormorant Garamond','Georgia',serif";

/* ── Panel material finishes (columns in price book, NOT price groups) ── */
const PANEL_MATERIALS = [
  { idx: 0, code: 'N',     label: 'N – Laminate' },
  { idx: 1, code: 'K',     label: 'K – Acrylic' },
  { idx: 2, code: 'KS',    label: 'KS – Acrylic Special' },
  { idx: 3, code: 'LU/F1', label: 'LU/F1 – Lacquer/Foil' },
  { idx: 4, code: 'L',     label: 'L – Lacquer' },
  { idx: 5, code: 'H',     label: 'H – High Gloss' },
  { idx: 6, code: 'H1',    label: 'H1 – High Gloss 1' },
  { idx: 7, code: 'H2/B',  label: 'H2/B – High Gloss 2' },
  { idx: 8, code: 'F',     label: 'F – Veneer' },
  { idx: 9, code: 'FE',    label: 'FE – Real Wood' },
];

/* ── Per-m² panel SKUs (priced per square metre — need W×H input + material) ── */
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

/* ── Finished End (SSE) helpers ── */
const HINGE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];
const FE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
  { value: 'LR', label: 'Both' },
];

// Build SSE lookup: { heightCode: { depthCode: [code, prices] } }
const SSE_LOOKUP = {};
SSE_DATA.forEach(([code, h, d, prices]) => {
  if (!SSE_LOOKUP[h]) SSE_LOOKUP[h] = {};
  if (!SSE_LOOKUP[h][d]) SSE_LOOKUP[h][d] = [code, prices];
});

// Get unique SSE height codes with available depths
const SSE_HEIGHT_OPTIONS = SSE_HEIGHTS.filter(h => SSE_LOOKUP[h.code]);

// Get available depths for a height code
function getSSEDepths(heightCode) {
  const hData = SSE_LOOKUP[heightCode];
  if (!hData) return [];
  return Object.keys(hData).map(Number).sort((a, b) => a - b);
}

// Get SSE price for a specific height, depth, material
function getSSEPrice(heightCode, depthCode, materialIdx) {
  const hData = SSE_LOOKUP[heightCode];
  if (!hData) return 0;
  const entry = hData[depthCode];
  if (!entry) return 0;
  return entry[1][materialIdx] || 0;
}

// Get SSE code for height+depth
function getSSECode(heightCode, depthCode) {
  const hData = SSE_LOOKUP[heightCode];
  if (!hData) return '';
  const entry = hData[depthCode];
  return entry ? entry[0] : '';
}

// Depth code labels
const SSE_DEPTH_LABELS = { 10:'100mm', 35:'351mm', 46:'465mm', 47:'475mm', 56:'565mm', 57:'575mm', 71:'715mm', 120:'1200mm' };

/* ── Format helpers ── */
const fmtPts = n => n.toLocaleString() + ' pts';
const fmtCost = (pts, cf) => '$' + (pts * cf).toFixed(2);

/* ── Main App ── */
export default function App({ order, onBack }) {
  const { user, profile, signOut } = useAuth();
  const orderId = order?.id;

  // Initialize state from saved order data or defaults
  const initRooms = order?.rooms && Array.isArray(order.rooms) && order.rooms.length > 0
    ? order.rooms
    : [{ id: Date.now(), name: 'Kitchen', items: [] }];

  const [items, setItems] = useState([]);
  const [specialItems, setSpecialItems] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [lineFilter, setLineFilter] = useState('all');
  const [pg, setPg] = useState(order?.pg ?? 3);
  const [cfInput, setCfInput] = useState(order?.cf ? String(order.cf) : '');
  const [cf, setCf] = useState(order?.cf ?? 35);
  const [projectName, setProjectName] = useState(order?.project_name || 'New Kitchen Project');
  const [rooms, setRooms] = useState(initRooms);
  const [activeRoom, setActiveRoom] = useState(initRooms[0]?.id || 1);
  const [showCost, setShowCost] = useState(order?.show_cost ?? false);
  const [showSpecial, setShowSpecial] = useState(false);
  const [scSearch, setScSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const listRef = useRef(null);

  // Auto-save hook
  const { save, saveStatus, lastSaved } = useAutoSave(user?.id, orderId);

  // Trigger auto-save whenever order-relevant state changes
  const saveVersion = useRef(0);
  useEffect(() => {
    // Skip initial mount
    if (saveVersion.current === 0) { saveVersion.current = 1; return; }
    save({ projectName, rooms, pg, cf, showCost });
  }, [projectName, rooms, pg, cf, showCost, save]);

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
      if (isSqm) {
        const defaultMat = item.prices.findIndex(p => p > 0);
        const newItem = { ...item, qty: 1, id: Date.now() + Math.random(), isSqm: true, panelW: '', panelH: '', panelMaterial: defaultMat >= 0 ? defaultMat : 0, attachedSCs: [] };
        return { ...r, items: [...r.items, newItem] };
      }
      const existing = r.items.find(x => x.sku === item.sku && !x.isSqm);
      if (existing) {
        return { ...r, items: r.items.map(x => x.sku === item.sku && !x.isSqm ? { ...x, qty: x.qty + 1 } : x) };
      }
      const newItem = { ...item, qty: 1, id: Date.now() + Math.random(), attachedSCs: [], hinge: '', finEnd: '', finEndSSEH: '', finEndSSED: '', finEndMat: 0 };
      setSelectedItemId(newItem.id);
      return { ...r, items: [...r.items, newItem] };
    }));
  }, [activeRoom]);

  /* ── Attach SC to selected cabinet item ── */
  const addSCToRoom = useCallback((sc) => {
    if (!selectedItemId) return; // no item selected
    const isDimensionBased = !!DIMENSION_SC[sc.code];
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return {
        ...r,
        items: r.items.map(item => {
          if (item.id !== selectedItemId) return item;
          const scs = item.attachedSCs || [];
          // Dimension-based SCs always get a new row
          if (isDimensionBased) {
            return { ...item, attachedSCs: [...scs, { ...sc, qty: 1, customSize: '', id: Date.now() + Math.random() }] };
          }
          // Otherwise increment qty if already attached
          const existing = scs.find(x => x.code === sc.code);
          if (existing) {
            return { ...item, attachedSCs: scs.map(x => x.code === sc.code ? { ...x, qty: x.qty + 1 } : x) };
          }
          return { ...item, attachedSCs: [...scs, { ...sc, qty: 1, id: Date.now() + Math.random() }] };
        }),
      };
    }));
  }, [activeRoom, selectedItemId]);

  const updateQty = (itemId, qty, isSqmItem = false) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      if (isSqmItem) {
        if (qty <= 0) {
          if (selectedItemId === itemId) setSelectedItemId(null);
          return { ...r, items: r.items.filter(x => x.id !== itemId) };
        }
        return { ...r, items: r.items.map(x => x.id === itemId ? { ...x, qty } : x) };
      }
      if (qty <= 0) {
        const removing = r.items.find(x => x.id === itemId || x.sku === itemId);
        if (removing && selectedItemId === removing.id) setSelectedItemId(null);
        return { ...r, items: r.items.filter(x => x.id !== itemId && x.sku !== itemId) };
      }
      return { ...r, items: r.items.map(x => (x.id === itemId || x.sku === itemId) ? { ...x, qty } : x) };
    }));
  };

  const updatePanelDims = (itemId, field, value) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return { ...r, items: r.items.map(x => x.id === itemId ? { ...x, [field]: value } : x) };
    }));
  };

  /* ── Update item property (hinge, finished end, etc.) ── */
  const updateItemProp = (itemId, field, value) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return { ...r, items: r.items.map(x => {
        if (x.id !== itemId) return x;
        const updated = { ...x, [field]: value };
        // When changing finished end to 'none', clear SSE settings
        if (field === 'finEnd' && !value) {
          updated.finEndSSEH = '';
          updated.finEndSSED = '';
          updated.finEndMat = 0;
        }
        // When changing height code, auto-select first available depth + material
        if (field === 'finEndSSEH' && value) {
          const depths = getSSEDepths(Number(value));
          const firstDepth = depths.length > 0 ? depths[0] : '';
          updated.finEndSSED = firstDepth ? String(firstDepth) : '';
          // Auto-select first material with non-zero price
          if (firstDepth) {
            const firstMat = PANEL_MATERIALS.findIndex(m => getSSEPrice(Number(value), firstDepth, m.idx) > 0);
            updated.finEndMat = firstMat >= 0 ? firstMat : 0;
          }
        }
        // When changing depth, auto-select first available material
        if (field === 'finEndSSED' && value && updated.finEndSSEH) {
          const curPrice = getSSEPrice(Number(updated.finEndSSEH), Number(value), updated.finEndMat || 0);
          if (curPrice === 0) {
            const firstMat = PANEL_MATERIALS.findIndex(m => getSSEPrice(Number(updated.finEndSSEH), Number(value), m.idx) > 0);
            updated.finEndMat = firstMat >= 0 ? firstMat : 0;
          }
        }
        return updated;
      }) };
    }));
  };

  /* ── SC quantity and custom size on attached SCs ── */
  const updateAttachedSCQty = (parentItemId, scId, qty) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return {
        ...r,
        items: r.items.map(item => {
          if (item.id !== parentItemId) return item;
          if (qty <= 0) {
            return { ...item, attachedSCs: (item.attachedSCs || []).filter(x => x.id !== scId) };
          }
          return { ...item, attachedSCs: (item.attachedSCs || []).map(x => x.id === scId ? { ...x, qty } : x) };
        }),
      };
    }));
  };

  const updateAttachedSCCustomSize = (parentItemId, scId, customSize) => {
    setRooms(rs => rs.map(r => {
      if (r.id !== activeRoom) return r;
      return {
        ...r,
        items: r.items.map(item => {
          if (item.id !== parentItemId) return item;
          return { ...item, attachedSCs: (item.attachedSCs || []).map(x => x.id === scId ? { ...x, customSize } : x) };
        }),
      };
    }));
  };

  const addRoom = () => {
    const id = Date.now();
    setRooms(rs => [...rs, { id, name: `Room ${rs.length + 1}`, items: [] }]);
    setActiveRoom(id);
    setSelectedItemId(null);
  };

  const removeRoom = (id) => {
    if (rooms.length <= 1) return;
    setRooms(rs => rs.filter(r => r.id !== id));
    if (activeRoom === id) {
      setActiveRoom(rooms.find(r => r.id !== id)?.id);
      setSelectedItemId(null);
    }
  };

  const renameRoom = (id, name) => {
    setRooms(rs => rs.map(r => r.id === id ? { ...r, name } : r));
  };

  /* ── Helpers for per-m² items ── */
  const calcSqm = (item) => {
    const w = parseFloat(item.panelW) || 0;
    const h = parseFloat(item.panelH) || 0;
    return (w * h) / 1000000;
  };
  const itemBaseTotal = (item) => {
    if (item.isSqm) {
      const sqm = calcSqm(item);
      const matIdx = item.panelMaterial ?? 0;
      const pricePerSqm = item.prices[matIdx] || 0;
      return Math.round(pricePerSqm * sqm * item.qty);
    }
    return item.prices[pg] * item.qty;
  };
  const itemSCTotal = (item) => {
    return (item.attachedSCs || []).reduce((s, sc) => s + sc.points * sc.qty, 0);
  };
  const itemFinEndTotal = (item) => {
    if (!item.finEnd || !item.finEndSSEH || !item.finEndSSED) return 0;
    const price = getSSEPrice(Number(item.finEndSSEH), Number(item.finEndSSED), item.finEndMat || 0);
    const sides = item.finEnd === 'LR' ? 2 : 1;
    return price * sides * item.qty;
  };
  const itemFullTotal = (item) => itemBaseTotal(item) + itemSCTotal(item) + itemFinEndTotal(item);

  /* ── Totals ── */
  const roomTotal = (r) => (r.items || []).reduce((s, i) => s + itemFullTotal(i), 0);
  const roomItemCount = (r) => {
    let count = 0;
    (r.items || []).forEach(i => {
      count += i.qty;
      (i.attachedSCs || []).forEach(sc => { count += sc.qty; });
    });
    return count;
  };
  const grandTotal = rooms.reduce((s, r) => s + roomTotal(r), 0);
  const grandCount = rooms.reduce((s, r) => s + roomItemCount(r), 0);

  /* ── Get selected item info for SC panel ── */
  const selectedItem = room.items.find(i => i.id === selectedItemId);

  /* ── PDF export ── */
  const exportPDF = () => {
    const pWin = window.open('', '_blank');
    const costTh = showCost ? '<th class="r">Cost</th>' : '';
    const costTd = (pts) => showCost ? '<td class="r">' + fmtCost(pts, cf / 100) + '</td>' : '';

    function buildItemRows(i) {
      const matIdx = i.panelMaterial ?? 0;
      const matPr = i.isSqm ? (i.prices[matIdx] || 0) : 0;
      const sqmVal = i.isSqm ? ((parseFloat(i.panelW)||0)*(parseFloat(i.panelH)||0)/1000000) : 0;
      const matName = i.isSqm ? (PANEL_MATERIALS.find(m=>m.idx===matIdx)||{}).code||'' : '';
      const sqmNote = i.isSqm ? ' <span style="color:#4a6fa5;font-size:11px">[' + matName + ' · ' + sqmVal.toFixed(4) + ' m²]</span>' : '';
      const unitLabel = i.isSqm ? fmtPts(matPr) + '/m²' : fmtPts(i.prices[pg]);
      const hingeLabel = i.hinge === 'L' ? 'Left' : i.hinge === 'R' ? 'Right' : '—';
      const feLabel = i.finEnd === 'L' ? 'Left' : i.finEnd === 'R' ? 'Right' : i.finEnd === 'LR' ? 'Both' : '—';
      const feCode = (i.finEnd && i.finEndSSEH && i.finEndSSED) ? getSSECode(Number(i.finEndSSEH), Number(i.finEndSSED)) : '';
      const fePrice = itemFinEndTotal(i);
      const total = itemFullTotal(i);
      let html = '<tr><td>' + i.sku + sqmNote + '</td><td>' + i.catLabel + '</td><td>' + hingeLabel + '</td><td>' + feLabel + (feCode ? ' (' + feCode + ')' : '') + '</td><td class="r">' + i.qty + '</td><td class="r">' + unitLabel + '</td><td class="r">' + fmtPts(total) + '</td>' + costTd(total) + '</tr>';
      if (feCode && fePrice > 0) {
        const feMat = (PANEL_MATERIALS.find(m=>m.idx===(i.finEndMat||0))||{}).code||'';
        const feUnit = getSSEPrice(Number(i.finEndSSEH), Number(i.finEndSSED), i.finEndMat || 0);
        html += '<tr class="sc"><td style="padding-left:24px">&nbsp;&nbsp;↳ ' + feCode + '</td><td>Finished End · ' + feMat + '</td><td></td><td></td><td class="r">' + (i.finEnd==='LR'?2:1) + '</td><td class="r">' + fmtPts(feUnit) + '</td><td class="r">' + fmtPts(fePrice) + '</td>' + costTd(fePrice) + '</tr>';
      }
      (i.attachedSCs || []).forEach(sc => {
        const sizeNote = sc.customSize ? ' [' + sc.customSize + 'mm]' : '';
        html += '<tr class="sc"><td style="padding-left:24px">&nbsp;&nbsp;↳ ' + sc.code + sizeNote + '</td><td>Special · ' + (sc.section||'—') + '</td><td></td><td></td><td class="r">' + sc.qty + '</td><td class="r">' + fmtPts(sc.points) + '</td><td class="r">' + fmtPts(sc.points * sc.qty) + '</td>' + costTd(sc.points * sc.qty) + '</tr>';
      });
      return html;
    }

    const roomsHtml = rooms.map(r => {
      const rTotal = roomTotal(r);
      return '<h2>' + r.name + '</h2><table><tr><th>SKU</th><th>Type</th><th>Hinge</th><th>Fin End</th><th class="r">Qty</th><th class="r">Unit Pts</th><th class="r">Total Pts</th>' + costTh + '</tr>' +
        (r.items || []).map(buildItemRows).join('') +
        '<tr class="total"><td colspan="6">Room Total</td><td class="r">' + fmtPts(rTotal) + '</td>' + costTd(rTotal) + '</tr></table>';
    }).join('');

    const html = '<!DOCTYPE html><html><head><title>' + projectName + ' - Order</title>' +
      '<style>body{font-family:' + FONT + ';margin:40px;color:#191919}' +
      'h1{font-family:' + SERIF + ';font-weight:400;font-size:28px;margin-bottom:4px}' +
      'h2{font-size:16px;margin-top:24px;border-bottom:1px solid #e4e1dc;padding-bottom:6px}' +
      'table{width:100%;border-collapse:collapse;margin:12px 0}' +
      'th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eceae6;font-size:13px}' +
      'th{background:#f7f6f3;font-weight:600}' +
      '.r{text-align:right}.footer{margin-top:30px;font-size:11px;color:#8a8580}' +
      '.sc{color:#4a6fa5;font-size:12px}' +
      '.total{font-weight:700;font-size:15px;border-top:2px solid #191919}</style></head><body>' +
      '<h1>' + projectName + '</h1>' +
      '<div style="font-size:12px;color:#8a8580">PG: ' + PG_NAMES[pg] + ' · ' + new Date().toLocaleDateString() + '</div>' +
      roomsHtml +
      '<div style="margin-top:20px;padding-top:12px;border-top:2px solid #191919;font-size:16px;font-weight:700">' +
      'Grand Total: ' + fmtPts(grandTotal) + (showCost ? ' · ' + fmtCost(grandTotal, cf / 100) : '') +
      '</div>' +
      '<div class="footer">Pronorm Dealer Estimator · Price Book 09/2025 · ' + grandCount + ' items · ' + rooms.length + ' room(s)</div>' +
      '<script>window.print()</' + 'script></body></html>';
    pWin.document.write(html);
    pWin.document.close();
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

        {/* SC attachment target indicator */}
        {showSpecial && (
          <div style={{ padding: '6px 16px', background: selectedItem ? 'rgba(74,111,165,0.08)' : 'rgba(194,64,64,0.06)', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            {selectedItem ? (
              <span><span style={{ fontWeight: 600, color: C.accent }}>Attaching to:</span> {selectedItem.sku} <span style={{ color: C.textSec }}>({selectedItem.catLabel})</span></span>
            ) : (
              <span style={{ color: C.danger, fontWeight: 600 }}>Select a cabinet in the room first</span>
            )}
          </div>
        )}

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
              <div key={sc.code + idx} style={{ ...s.row, opacity: selectedItem ? 1 : 0.4 }}
                onMouseEnter={e => { if (selectedItem) e.currentTarget.style.background = C.goldMuted; }}
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
                      {PER_SQM_SKUS.has(item.sku) ? (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.gold }}>per m²</div>
                          <div style={{ fontSize: 10, color: C.textSec, marginTop: 1 }}>
                            {PANEL_MATERIALS.filter(m => item.prices[m.idx] > 0).map(m => `${m.code}: ${item.prices[m.idx]}`).join(' · ')}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>{fmtPts(item.prices[pg])}</div>
                          {showCost && (
                            <div style={{ fontSize: 11, color: C.success, marginTop: 2 }}>
                              {fmtCost(item.prices[pg], cf / 100)}
                            </div>
                          )}
                        </>
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
          {onBack && (
            <button style={{ ...s.btn, marginRight: 4 }} onClick={onBack}>← Orders</button>
          )}
          <input style={{ ...s.input, fontFamily: SERIF, fontSize: 18, fontWeight: 400, border: 'none', padding: '4px 0', flex: 1 }}
            value={projectName} onChange={e => setProjectName(e.target.value)} />
          {/* Save status indicator */}
          <div style={{ fontSize: 11, color: saveStatus === 'error' ? C.danger : saveStatus === 'saving' ? C.accent : saveStatus === 'saved' ? C.success : C.textTer, marginRight: 8 }}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save error' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>
            {fmtPts(grandTotal)}
            {showCost && <span style={{ color: C.success, marginLeft: 8 }}>{fmtCost(grandTotal, cf / 100)}</span>}
          </div>
          {/* User info + sign out */}
          <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.textSec }}>{profile?.company_name || profile?.email}</span>
            <button style={{ ...s.btn, fontSize: 10, padding: '4px 8px' }} onClick={signOut}>Sign Out</button>
          </div>
        </div>

        {/* Room tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 24px', borderBottom: `1px solid ${C.border}`, background: C.card, flexWrap: 'wrap' }}>
          {rooms.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button style={s.tab(activeRoom === r.id)} onClick={() => { setActiveRoom(r.id); setSelectedItemId(null); }}>
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
          {room.items.length === 0 ? (
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
                    <th style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 50 }}>Hinge</th>
                    <th style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 60 }}>Fin End</th>
                    <th style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 80 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 90 }}>Unit</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 90 }}>Total</th>
                    {showCost && <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, fontWeight: 600, color: C.textSec, width: 90 }}>Cost</th>}
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(room.items || []).map(item => {
                    const isSelected = item.id === selectedItemId;
                    const sqm = item.isSqm ? calcSqm(item) : 0;
                    const baseTotal = itemBaseTotal(item);
                    const scTotal = itemSCTotal(item);
                    const feTotal = itemFinEndTotal(item);
                    const fullTotal = baseTotal + scTotal + feTotal;
                    const matIdx = item.panelMaterial ?? 0;
                    const matPrice = item.isSqm ? (item.prices[matIdx] || 0) : 0;
                    const availMats = item.isSqm ? PANEL_MATERIALS.filter(m => item.prices[m.idx] > 0) : [];
                    const attachedSCs = item.attachedSCs || [];
                    const selBorder = isSelected ? `2px solid ${C.accent}` : 'none';

                    return (
                    <React.Fragment key={item.id}>
                    {/* ── Cabinet row (clickable to select) ── */}
                    <tr
                      style={{
                        borderBottom: (item.isSqm || item.finEnd || attachedSCs.length > 0) ? 'none' : `1px solid ${C.borderLight}`,
                        background: isSelected ? 'rgba(74,111,165,0.06)' : 'transparent',
                        cursor: 'pointer',
                        borderLeft: selBorder,
                      }}
                      onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                    >
                      <td style={{ padding: '8px 0 8px 4px', fontSize: 13, fontWeight: 600 }}>
                        {item.sku}
                        {isSelected && <span style={{ fontSize: 10, color: C.accent, marginLeft: 6 }}>SELECTED</span>}
                      </td>
                      <td style={{ padding: '8px 0', fontSize: 12, color: C.textSec }}>
                        {item.catLabel} · {item.line}
                        {item.isSqm && <span style={{ color: C.accent, fontWeight: 600 }}> · per m²</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 0' }} onClick={e => e.stopPropagation()}>
                        {!item.isSqm && (
                          <select style={{ ...s.select, fontSize: 10, padding: '2px 18px 2px 4px', width: 48 }}
                            value={item.hinge || ''} onChange={e => updateItemProp(item.id, 'hinge', e.target.value)}>
                            {HINGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 0' }} onClick={e => e.stopPropagation()}>
                        {!item.isSqm && (
                          <select style={{ ...s.select, fontSize: 10, padding: '2px 18px 2px 4px', width: 58, borderColor: item.finEnd ? C.gold : C.border }}
                            value={item.finEnd || ''} onChange={e => updateItemProp(item.id, 'finEnd', e.target.value)}>
                            {FE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 0' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button style={{ ...s.btn, padding: '2px 8px', fontSize: 11 }} onClick={() => updateQty(item.id, item.qty - 1, item.isSqm)}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                          <button style={{ ...s.btn, padding: '2px 8px', fontSize: 11 }} onClick={() => updateQty(item.id, item.qty + 1, item.isSqm)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13 }}>
                        {item.isSqm ? `${fmtPts(matPrice)}/m²` : fmtPts(item.prices[pg])}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, fontWeight: 600 }}>{fmtPts(fullTotal)}</td>
                      {showCost && <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, color: C.success }}>{fmtCost(fullTotal, cf / 100)}</td>}
                      <td onClick={e => e.stopPropagation()}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 14 }}
                          onClick={() => updateQty(item.id, 0, item.isSqm)}>×</button>
                      </td>
                    </tr>

                    {/* ── Per-m² dimension inputs ── */}
                    {item.isSqm && (
                      <tr style={{ borderBottom: (item.finEnd || attachedSCs.length > 0) ? 'none' : `1px solid ${C.borderLight}`, background: isSelected ? 'rgba(74,111,165,0.06)' : 'transparent', borderLeft: selBorder }}>
                        <td colSpan={showCost ? 9 : 8} style={{ padding: '2px 0 8px 4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Material:</span>
                            <select
                              style={{ ...s.select, fontSize: 11, padding: '3px 24px 3px 6px', minWidth: 150 }}
                              value={matIdx}
                              onChange={e => updatePanelDims(item.id, 'panelMaterial', parseInt(e.target.value))}
                            >
                              {availMats.map(m => (
                                <option key={m.idx} value={m.idx}>{m.label} ({fmtPts(item.prices[m.idx])}/m²)</option>
                              ))}
                            </select>
                            <span style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginLeft: 4 }}>Size:</span>
                            <input
                              style={{ ...s.input, width: 72, fontSize: 12, padding: '3px 6px', borderColor: item.panelW ? C.accent : C.border }}
                              placeholder="W mm"
                              value={item.panelW || ''}
                              onChange={e => updatePanelDims(item.id, 'panelW', e.target.value)}
                            />
                            <span style={{ fontSize: 12, color: C.textSec }}>×</span>
                            <input
                              style={{ ...s.input, width: 72, fontSize: 12, padding: '3px 6px', borderColor: item.panelH ? C.accent : C.border }}
                              placeholder="H mm"
                              value={item.panelH || ''}
                              onChange={e => updatePanelDims(item.id, 'panelH', e.target.value)}
                            />
                            {sqm > 0 ? (
                              <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>{sqm.toFixed(4)} m²</span>
                            ) : (
                              <span style={{ fontSize: 10, color: C.danger }}>Enter dimensions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ── Finished End SSE config row ── */}
                    {item.finEnd && !item.isSqm && (() => {
                      const feH = item.finEndSSEH ? Number(item.finEndSSEH) : '';
                      const feD = item.finEndSSED ? Number(item.finEndSSED) : '';
                      const feMat = item.finEndMat || 0;
                      const availDepths = feH ? getSSEDepths(feH) : [];
                      const sseCode = (feH && feD) ? getSSECode(feH, feD) : '';
                      const ssePrice = (feH && feD) ? getSSEPrice(feH, feD, feMat) : 0;
                      const sides = item.finEnd === 'LR' ? 2 : 1;
                      const feSideLabel = item.finEnd === 'L' ? 'Left' : item.finEnd === 'R' ? 'Right' : 'Both (×2)';
                      const availFEMats = PANEL_MATERIALS.filter(m => {
                        if (!feH || !feD) return false;
                        return getSSEPrice(feH, feD, m.idx) > 0;
                      });
                      return (
                        <tr style={{
                          borderBottom: attachedSCs.length > 0 ? 'none' : `1px solid ${C.borderLight}`,
                          background: isSelected ? 'rgba(176,141,76,0.06)' : 'rgba(176,141,76,0.03)',
                          borderLeft: selBorder,
                        }}>
                          <td colSpan={showCost ? 9 : 8} style={{ padding: '4px 0 6px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.gold }}>↳ Finished End ({feSideLabel}):</span>
                              <select style={{ ...s.select, fontSize: 10, padding: '2px 20px 2px 4px', minWidth: 120 }}
                                value={item.finEndSSEH || ''} onChange={e => updateItemProp(item.id, 'finEndSSEH', e.target.value)}>
                                <option value="">Select height...</option>
                                {SSE_HEIGHT_OPTIONS.map(h => (
                                  <option key={h.code} value={h.code}>{h.label}</option>
                                ))}
                              </select>
                              {feH && (
                                <select style={{ ...s.select, fontSize: 10, padding: '2px 20px 2px 4px', minWidth: 90 }}
                                  value={item.finEndSSED || ''} onChange={e => updateItemProp(item.id, 'finEndSSED', e.target.value)}>
                                  <option value="">Depth...</option>
                                  {availDepths.map(d => (
                                    <option key={d} value={d}>{SSE_DEPTH_LABELS[d] || d + '0mm'}</option>
                                  ))}
                                </select>
                              )}
                              {feH && feD && availFEMats.length > 0 && (
                                <select style={{ ...s.select, fontSize: 10, padding: '2px 20px 2px 4px', minWidth: 130 }}
                                  value={feMat} onChange={e => updateItemProp(item.id, 'finEndMat', parseInt(e.target.value))}>
                                  {availFEMats.map(m => (
                                    <option key={m.idx} value={m.idx}>{m.code} ({fmtPts(getSSEPrice(feH, feD, m.idx))})</option>
                                  ))}
                                </select>
                              )}
                              {sseCode && ssePrice > 0 && (
                                <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>
                                  {sseCode} · {fmtPts(ssePrice)}{sides > 1 ? ` ×${sides} = ${fmtPts(ssePrice * sides)}` : ''}/ea
                                </span>
                              )}
                              {feH && !feD && <span style={{ fontSize: 10, color: C.danger }}>Select depth</span>}
                              {!feH && <span style={{ fontSize: 10, color: C.danger }}>Select carcase height</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })()}

                    {/* ── Attached Special Constructions ── */}
                    {attachedSCs.map((sc, scIdx) => {
                      const dimInfo = DIMENSION_SC[sc.code];
                      const isLast = scIdx === attachedSCs.length - 1;
                      return (
                      <React.Fragment key={sc.id}>
                      <tr style={{
                        borderBottom: (dimInfo || !isLast) ? 'none' : `1px solid ${C.borderLight}`,
                        background: isSelected ? 'rgba(74,111,165,0.08)' : 'rgba(74,111,165,0.03)',
                        borderLeft: selBorder,
                      }}>
                        <td style={{ padding: '4px 0 4px 16px', fontSize: 12, fontWeight: 600, color: C.accent }}>
                          ↳ {sc.code}
                        </td>
                        <td style={{ padding: '4px 0', fontSize: 11, color: C.textSec }}>Special · {sc.section}</td>
                        <td></td><td></td>
                        <td style={{ textAlign: 'center', padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <button style={{ ...s.btn, padding: '1px 6px', fontSize: 10 }} onClick={() => updateAttachedSCQty(item.id, sc.id, sc.qty - 1)}>−</button>
                            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{sc.qty}</span>
                            <button style={{ ...s.btn, padding: '1px 6px', fontSize: 10 }} onClick={() => updateAttachedSCQty(item.id, sc.id, sc.qty + 1)}>+</button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontSize: 12 }}>{fmtPts(sc.points)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontSize: 12, fontWeight: 600, color: C.accent }}>{fmtPts(sc.points * sc.qty)}</td>
                        {showCost && <td style={{ textAlign: 'right', padding: '4px 0', fontSize: 12, color: C.success }}>{fmtCost(sc.points * sc.qty, cf / 100)}</td>}
                        <td>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 12 }}
                            onClick={() => updateAttachedSCQty(item.id, sc.id, 0)}>×</button>
                        </td>
                      </tr>
                      {dimInfo && (
                        <tr style={{
                          borderBottom: isLast ? `1px solid ${C.borderLight}` : 'none',
                          background: isSelected ? 'rgba(74,111,165,0.08)' : 'rgba(74,111,165,0.03)',
                          borderLeft: selBorder,
                        }}>
                          <td colSpan={showCost ? 9 : 8} style={{ padding: '0 0 6px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{dimInfo.label}:</span>
                              <input
                                style={{ ...s.input, width: 100, fontSize: 12, padding: '3px 6px', borderColor: sc.customSize ? C.accent : C.border }}
                                placeholder={dimInfo.placeholder}
                                value={sc.customSize || ''}
                                onChange={e => updateAttachedSCCustomSize(item.id, sc.id, e.target.value)}
                              />
                              {!sc.customSize && <span style={{ fontSize: 10, color: C.danger }}>Enter custom size</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      );
                    })}
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
