import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './AuthContext.jsx'
import AppShell from './AppShell.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>,
)
