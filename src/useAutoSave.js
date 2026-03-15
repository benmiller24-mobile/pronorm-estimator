import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

/**
 * Auto-save hook: persists order data to Supabase on every change.
 * Debounces writes by 800ms to avoid hammering the DB on rapid edits.
 */
export function useAutoSave(userId, orderId) {
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [lastSaved, setLastSaved] = useState(null);
  const timerRef = useRef(null);
  const pendingRef = useRef(null);

  const save = useCallback(async (orderData) => {
    if (!userId || !orderId) return;

    // Debounce
    pendingRef.current = orderData;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const payload = {
        id: orderId,
        user_id: userId,
        project_name: orderData.projectName,
        rooms: orderData.rooms,
        pg: orderData.pg,
        cf: orderData.cf,
        show_cost: orderData.showCost,
        notes: orderData.orderNotes || '',
        client_name: orderData.clientName || '',
        client_email: orderData.clientEmail || '',
        client_phone: orderData.clientPhone || '',
        client_address: orderData.clientAddress || '',
        order_ref: orderData.orderRef || '',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('orders')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Auto-save error:', error);
        setSaveStatus('error');
      } else {
        setSaveStatus('saved');
        setLastSaved(new Date());
        // Reset to idle after 2s
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 800);
  }, [userId, orderId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { save, saveStatus, lastSaved };
}

/**
 * Load all orders for a user (dealer sees own, admin sees all).
 */
export async function loadOrders(userId, isAdmin) {
  let query = supabase
    .from('orders')
    .select('*, profiles(email, company_name)')
    .order('updated_at', { ascending: false });

  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Load orders error:', error);
    return [];
  }
  return data || [];
}

/**
 * Load a single order by ID.
 */
export async function loadOrder(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Load order error:', error);
    return null;
  }
  return data;
}

/**
 * Create a new blank order.
 */
export async function createOrder(userId, projectName = 'New Kitchen Project') {
  const newOrder = {
    user_id: userId,
    project_name: projectName,
    rooms: [{ id: Date.now(), name: 'Kitchen', items: [] }],
    pg: 3,
    cf: 35,
    show_cost: false,
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    order_ref: '',
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(newOrder)
    .select()
    .single();

  if (error) {
    console.error('Create order error:', error);
    return null;
  }
  return data;
}

/**
 * Delete an order by ID.
 */
export async function deleteOrder(orderId) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Delete order error:', error);
    return false;
  }
  return true;
}

/**
 * Duplicate an order with new IDs for rooms and items.
 */
export async function duplicateOrder(sourceOrder, userId) {
  if (!sourceOrder || !userId) return null;

  // Deep copy and regenerate IDs for rooms and items
  const newRooms = (sourceOrder.rooms || []).map(room => ({
    ...room,
    id: Date.now() + Math.random(),
    items: (room.items || []).map(item => ({
      ...item,
      id: Date.now() + Math.random(),
      attachedSCs: (item.attachedSCs || []).map(sc => ({
        ...sc,
        id: Date.now() + Math.random(),
      })),
    })),
  }));

  const newOrder = {
    user_id: userId,
    project_name: sourceOrder.project_name + ' (Copy)',
    rooms: newRooms,
    pg: sourceOrder.pg ?? 3,
    cf: sourceOrder.cf ?? 35,
    show_cost: sourceOrder.show_cost ?? false,
    notes: sourceOrder.notes || '',
    client_name: sourceOrder.client_name || '',
    client_email: sourceOrder.client_email || '',
    client_phone: sourceOrder.client_phone || '',
    client_address: sourceOrder.client_address || '',
    order_ref: sourceOrder.order_ref || '',
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(newOrder)
    .select()
    .single();

  if (error) {
    console.error('Duplicate order error:', error);
    return null;
  }
  return data;
}
