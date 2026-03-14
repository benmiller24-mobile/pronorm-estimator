import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import { loadOrders, createOrder, deleteOrder, duplicateOrder } from './useAutoSave.js';

const FONT = "'DM Sans',system-ui,sans-serif";
const SERIF = "'Cormorant Garamond','Georgia',serif";

// Inject hover style for order cards (CSS-based so it doesn't break mobile taps)
if (typeof document !== 'undefined' && !document.getElementById('order-card-style')) {
  const style = document.createElement('style');
  style.id = 'order-card-style';
  style.textContent = '@media(hover:hover){.order-card:hover{border-color:#b08d4c !important}}';
  document.head.appendChild(style);
}
const C = {
  bg: '#f7f6f3', card: '#fff', dark: '#191919', gold: '#b08d4c',
  goldMuted: 'rgba(176,141,76,.12)', border: '#e4e1dc', borderLight: '#eceae6',
  textPri: '#191919', textSec: '#8a8580', textTer: '#b5b0aa',
  success: '#3d7a4f', danger: '#c24040', accent: '#4a6fa5',
};

export default function OrderList({ onOpenOrder }) {
  const { user, profile, signOut, isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const s = {
    btn: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.card, color: C.textPri },
    btnGold: { border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.gold, color: '#fff' },
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    const data = await loadOrders(user.id, isAdmin);
    setOrders(data);
    setLoading(false);
  }

  async function handleNew() {
    const order = await createOrder(user.id);
    if (order) onOpenOrder(order);
  }

  async function handleDelete(orderId) {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    await deleteOrder(orderId);
    fetchOrders();
  }

  async function handleDuplicate(order) {
    const newOrder = await duplicateOrder(order, user.id);
    if (newOrder) {
      fetchOrders();
    }
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const countItems = (rooms) => {
    if (!Array.isArray(rooms)) return 0;
    return rooms.reduce((total, r) => {
      return total + (r.items || []).reduce((s, i) => {
        let c = i.qty || 0;
        (i.attachedSCs || []).forEach(sc => { c += sc.qty || 0; });
        return s + c;
      }, 0);
    }, 0);
  };

  // Filter and sort orders
  const filteredOrders = orders.filter(o =>
    o.project_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
      case 'name-asc':
        return (a.project_name || '').localeCompare(b.project_name || '');
      case 'name-desc':
        return (b.project_name || '').localeCompare(a.project_name || '');
      case 'most-items':
        return countItems(b.rooms) - countItems(a.rooms);
      case 'newest':
      default:
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    }
  });

  return (
    <div style={{ minHeight: '100vh', fontFamily: FONT, background: C.bg, color: C.textPri }}>
      {/* Header */}
      <div style={{ padding: '20px 32px', borderBottom: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em' }}>pronorm</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.gold, background: C.goldMuted, padding: '3px 10px', borderRadius: 10 }}>
          Dealer Estimator
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: C.textSec, textAlign: 'right' }}>
          <div style={{ fontWeight: 600, color: C.textPri }}>{profile?.company_name || profile?.email}</div>
          <div>{profile?.email}</div>
        </div>
        {isAdmin && (
          <button style={{ ...s.btn, color: C.danger, borderColor: C.danger }} onClick={() => onOpenOrder('__admin__')}>
            Admin Panel
          </button>
        )}
        <button style={s.btn} onClick={signOut}>Sign Out</button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '32px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>My Orders</div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</div>
          </div>
          <button style={s.btnGold} onClick={handleNew}>+ New Order</button>
        </div>

        {orders.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              style={{ ...s.btn, flex: 1, minWidth: 200, border: `1px solid ${C.border}`, padding: '8px 12px', textAlign: 'left' }}
              placeholder="Search by project name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select
              style={{ ...s.btn, padding: '8px 12px', border: `1px solid ${C.border}` }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="most-items">Most Items</option>
            </select>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.textTer }}>Loading orders...</div>
        ) : orders.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: 48, textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, color: C.textSec, marginBottom: 8 }}>No orders yet</div>
            <div style={{ fontSize: 13, color: C.textTer, marginBottom: 20 }}>Create your first order to get started</div>
            <button style={s.btnGold} onClick={handleNew}>+ New Order</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: 48, textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, color: C.textSec, marginBottom: 8 }}>No orders match your search</div>
            <div style={{ fontSize: 13, color: C.textTer }}>Try adjusting your filters</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedOrders.map(o => {
              const roomCount = Array.isArray(o.rooms) ? o.rooms.length : 0;
              const itemCount = countItems(o.rooms);
              return (
                <div
                  key={o.id}
                  className="order-card"
                  style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
                    cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onClick={() => onOpenOrder(o)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{o.project_name}</div>
                    <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>
                      {roomCount} room{roomCount !== 1 ? 's' : ''} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: C.textSec }}>{o.updated_at ? fmtDate(o.updated_at) : 'Never saved'}</div>
                  </div>
                  <button
                    style={{ ...s.btn, fontSize: 11, padding: '4px 10px', marginRight: 6 }}
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(o); }}
                  >
                    Duplicate
                  </button>
                  <button
                    style={{ ...s.btn, color: C.danger, borderColor: C.danger, fontSize: 11, padding: '4px 10px' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
