import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import LoginPage from './LoginPage.jsx';
import OrderList from './OrderList.jsx';
import AdminPanel from './AdminPanel.jsx';
import App from './App.jsx';
import ImportElevation from './ImportElevation.jsx';

const FONT = "'DM Sans',system-ui,sans-serif";

export default function AppShell() {
  const { user, profile, loading } = useAuth();
  const [currentOrder, setCurrentOrder] = useState(null); // null = order list, '__admin__' = admin, {order} = estimator
  const [view, setView] = useState('list'); // list | estimator | admin | import

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT, color: '#8a8580', background: '#f7f6f3',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cormorant Garamond','Georgia',serif", fontSize: 28, fontWeight: 400, color: '#191919', marginBottom: 8 }}>pronorm</div>
          <div style={{ fontSize: 13 }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user || !profile) {
    return <LoginPage />;
  }

  // Admin panel
  if (view === 'admin') {
    return (
      <AdminPanel
        onOpenOrder={(order) => {
          if (order === '__admin__') return;
          setCurrentOrder(order);
          setView('estimator');
        }}
        onBack={() => setView('list')}
      />
    );
  }

  // Import elevation
  if (view === 'import') {
    return (
      <ImportElevation
        onBack={() => setView('list')}
        onOrderCreated={(order) => {
          setCurrentOrder(order);
          setView('estimator');
        }}
      />
    );
  }

  // Estimator (with an order loaded)
  if (view === 'estimator' && currentOrder) {
    return (
      <App
        order={currentOrder}
        onBack={() => {
          setCurrentOrder(null);
          setView('list');
        }}
      />
    );
  }

  // Order list (default)
  return (
    <OrderList
      onOpenOrder={(order) => {
        if (order === '__admin__') {
          setView('admin');
        } else {
          setCurrentOrder(order);
          setView('estimator');
        }
      }}
      onImportElevation={() => setView('import')}
    />
  );
}
