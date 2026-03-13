import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { loadOrders, deleteOrder } from './useAutoSave.js';
import { useAuth } from './AuthContext.jsx';

const FONT = "'DM Sans',system-ui,sans-serif";
const SERIF = "'Cormorant Garamond','Georgia',serif";
const C = {
  bg: '#f7f6f3', card: '#fff', dark: '#191919', gold: '#b08d4c',
  goldMuted: 'rgba(176,141,76,.12)', border: '#e4e1dc', borderLight: '#eceae6',
  textPri: '#191919', textSec: '#8a8580', textTer: '#b5b0aa',
  success: '#3d7a4f', danger: '#c24040', accent: '#4a6fa5',
};

export default function AdminPanel({ onOpenOrder, onBack }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('dealers'); // dealers | orders
  const [dealers, setDealers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // New dealer form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [creating, setCreating] = useState(false);

  const s = {
    input: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: FONT, color: C.textPri, outline: 'none', boxSizing: 'border-box' },
    btn: { border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.card, color: C.textPri },
    btnGold: { border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: C.gold, color: '#fff' },
    tab: (active) => ({ padding: '8px 16px', fontSize: 13, fontWeight: active ? 600 : 400, borderRadius: 6, cursor: 'pointer', background: active ? C.goldMuted : 'transparent', color: active ? C.gold : C.textSec, border: 'none', fontFamily: FONT }),
  };

  const fetchDealers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDealers(data);
    if (error) console.error('Fetch dealers error:', error);
  }, []);

  const fetchOrders = useCallback(async () => {
    const data = await loadOrders(user.id, true);
    setOrders(data);
  }, [user]);

  useEffect(() => {
    Promise.all([fetchDealers(), fetchOrders()]).then(() => setLoading(false));
  }, [fetchDealers, fetchOrders]);

  const handleCreateDealer = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg('');

    try {
      // Use Supabase edge function or admin API to create user
      // For now, we use the signUp flow — admin will need to use the service_role
      // through an edge function. We'll use the client-side approach with a workaround.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: { role: 'dealer', company_name: newCompany },
        },
      });

      if (authError) throw authError;

      // The profile should be created by a database trigger (see SQL setup),
      // but we can also upsert it here as a fallback
      if (authData.user) {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          email: newEmail,
          role: 'dealer',
          company_name: newCompany,
        });
      }

      setCreateMsg(`Dealer account created for ${newEmail}`);
      setNewEmail('');
      setNewPassword('');
      setNewCompany('');
      fetchDealers();
    } catch (err) {
      setCreateMsg(`Error: ${err.message}`);
    }
    setCreating(false);
  };

  const handleDeleteDealer = async (dealerId, dealerEmail) => {
    if (!confirm(`Delete dealer ${dealerEmail}? This will also delete all their orders.`)) return;

    // Delete their orders first
    await supabase.from('orders').delete().eq('user_id', dealerId);
    // Delete profile
    await supabase.from('profiles').delete().eq('id', dealerId);
    // Note: deleting the auth user requires service_role (edge function).
    // For now we just remove the profile, which blocks login via RLS.
    setCreateMsg(`Dealer ${dealerEmail} removed. Auth user may need manual cleanup in Supabase dashboard.`);
    fetchDealers();
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Delete this order?')) return;
    await deleteOrder(orderId);
    fetchOrders();
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: FONT, color: C.textSec }}>
        Loading admin panel...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: FONT, background: C.bg, color: C.textPri }}>
      {/* Header */}
      <div style={{ padding: '16px 32px', borderBottom: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={s.btn} onClick={onBack}>← Back to Estimator</button>
        <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400 }}>pronorm</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: C.danger, padding: '2px 8px', borderRadius: 10 }}>ADMIN</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={s.tab(tab === 'dealers')} onClick={() => setTab('dealers')}>Dealers ({dealers.length})</button>
          <button style={s.tab(tab === 'orders')} onClick={() => setTab('orders')}>All Orders ({orders.length})</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 24px' }}>
        {tab === 'dealers' ? (
          <>
            {/* ── Create Dealer Form ── */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Create Dealer Account</div>
              <form onSubmit={handleCreateDealer} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textSec, display: 'block', marginBottom: 4 }}>Email</label>
                  <input style={{ ...s.input, width: 220 }} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="dealer@company.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textSec, display: 'block', marginBottom: 4 }}>Password</label>
                  <input style={{ ...s.input, width: 160 }} type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="min 6 chars" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textSec, display: 'block', marginBottom: 4 }}>Company Name</label>
                  <input style={{ ...s.input, width: 200 }} type="text" value={newCompany} onChange={e => setNewCompany(e.target.value)} required placeholder="Dealer Kitchen Co." />
                </div>
                <button type="submit" disabled={creating} style={{ ...s.btnGold, opacity: creating ? 0.7 : 1 }}>
                  {creating ? 'Creating...' : '+ Create Dealer'}
                </button>
              </form>
              {createMsg && (
                <div style={{ marginTop: 12, fontSize: 12, color: createMsg.startsWith('Error') ? C.danger : C.success, background: createMsg.startsWith('Error') ? 'rgba(194,64,64,0.06)' : 'rgba(61,122,79,0.06)', padding: '6px 12px', borderRadius: 6 }}>
                  {createMsg}
                </div>
              )}
            </div>

            {/* ── Dealer List ── */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Dealer Accounts</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Company</th>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Created</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dealers.map(d => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '10px 0', fontSize: 13 }}>{d.email}</td>
                      <td style={{ padding: '10px 0', fontSize: 13, color: C.textSec }}>{d.company_name || '—'}</td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                          background: d.role === 'admin' ? 'rgba(194,64,64,0.08)' : C.goldMuted,
                          color: d.role === 'admin' ? C.danger : C.gold,
                        }}>
                          {d.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 12, color: C.textSec }}>{d.created_at ? fmtDate(d.created_at) : '—'}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        {d.role !== 'admin' && (
                          <button
                            style={{ ...s.btn, color: C.danger, borderColor: C.danger, fontSize: 11, padding: '4px 10px' }}
                            onClick={() => handleDeleteDealer(d.id, d.email)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {dealers.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: C.textTer, fontSize: 13 }}>No dealers yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* ── All Orders ── */
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>All Orders</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Project</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Dealer</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Company</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Rooms</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, fontWeight: 600, color: C.textSec }}>Last Updated</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const roomCount = Array.isArray(o.rooms) ? o.rooms.length : 0;
                  const dealerEmail = o.profiles?.email || '—';
                  const company = o.profiles?.company_name || '—';
                  return (
                    <tr key={o.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '10px 0', fontSize: 13, fontWeight: 600 }}>{o.project_name}</td>
                      <td style={{ padding: '10px 0', fontSize: 12, color: C.textSec }}>{dealerEmail}</td>
                      <td style={{ padding: '10px 0', fontSize: 12, color: C.textSec }}>{company}</td>
                      <td style={{ padding: '10px 0', fontSize: 12, textAlign: 'right' }}>{roomCount}</td>
                      <td style={{ padding: '10px 0', fontSize: 12, color: C.textSec }}>{o.updated_at ? fmtDate(o.updated_at) : '—'}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button style={{ ...s.btn, fontSize: 11, padding: '4px 10px' }} onClick={() => onOpenOrder(o)}>Open</button>
                        <button style={{ ...s.btn, color: C.danger, borderColor: C.danger, fontSize: 11, padding: '4px 10px' }} onClick={() => handleDeleteOrder(o.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: C.textTer, fontSize: 13 }}>No orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
