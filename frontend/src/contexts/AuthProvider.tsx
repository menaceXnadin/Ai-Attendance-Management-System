import React, { useState, useEffect } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';
import { api } from '@/integrations/api/client';
import { User } from '@/integrations/api/types';
import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/authToken';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated on initial load
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        // Check both localStorage and sessionStorage for auth token
        const token = getAuthToken();
        if (token) {
          // Check if token is expired
          const parts = token.split('.');
          let isExpired = false;
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(atob(parts[1]));
              const now = Math.floor(Date.now() / 1000);
              if (payload.exp && payload.exp < now) {
                isExpired = true;
              }
            } catch (e) {
              isExpired = true;
            }
          } else {
            isExpired = true;
          }

          if (isExpired) {
            // Try to refresh token
            try {
              const refreshResult = await api.auth.refreshToken();
              setUser(refreshResult.user);
              setAuthToken(refreshResult.token);
              setLoading(false);
              return;
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              clearAuthToken();
              setUser(null);
              setLoading(false);
              return;
            }
          }

          // Token is valid, get user info
          try {
            const userData = await api.auth.getUser();
            setUser(userData);
          } catch (error) {
            // Only log out if error is 401 (unauthorized), otherwise keep user and show error
            if (error?.response?.status === 401) {
              clearAuthToken();
              setUser(null);
            } else {
              console.error('Network or server error retrieving user:', error);
              // Keep user, don't log out for temporary issues
            }
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth status check error:', error);
        // Don't log out for temporary errors
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  // Authentication methods using only our backend API
  const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      // Authenticate with backend API
      const authResponse = await api.auth.login(email, password);
      
      // Store token based on remember me preference (clear any stale copy first)
      clearAuthToken();
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('authToken', authResponse.token);
      
      setUser(authResponse.user);
      return { error: null, user: authResponse.user };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    // Student registration is handled through admin panel only
    console.warn('Self-registration is disabled. Students must be registered by administrators.');
    return { error: new Error('Self-registration is not available. Please contact your administrator to create an account.') };
  };

  const signOutUser = async () => {
    // Sign out from our backend
    await api.auth.logout();
    // Clear tokens from both storages
    clearAuthToken();
    setUser(null);
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut: signOutUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
