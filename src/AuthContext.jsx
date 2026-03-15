import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

const AuthContext = createContext(null);

// Detect if we're running inside an iframe from pronormusa.com
function isPortalEmbed() {
  try {
    return window.self !== window.top &&
      (document.referrer.includes('pronormusa.com') ||
       window.location.search.includes('embed=portal'));
  } catch {
    // Cross-origin iframe access throws — that's fine, means we're embedded
    return window.location.search.includes('embed=portal');
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // supabase auth user
  const [profile, setProfile] = useState(null);   // { id, email, role, company_name, created_at }
  const [loading, setLoading] = useState(true);
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    // If embedded in the dealer portal, skip auth entirely
    if (isPortalEmbed()) {
      setIsEmbed(true);
      setUser({ id: 'portal-embed', email: 'portal@pronormusa.com' });
      setProfile({ id: 'portal-embed', email: 'portal@pronormusa.com', role: 'dealer', company_name: 'Portal User' });
      setLoading(false);
      return;
    }

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
    } else if (error) {
      console.error('Profile fetch error:', error);
      // Profile might not exist yet if admin hasn't set it up
      setProfile(null);
    }
    setLoading(false);
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  const isAdmin = profile?.role === 'admin';
  const isDealer = profile?.role === 'dealer';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, isAdmin, isDealer, isEmbed, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
