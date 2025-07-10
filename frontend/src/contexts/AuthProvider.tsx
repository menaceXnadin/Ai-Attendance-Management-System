import React, { useState, useEffect } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';
import { api } from '@/integrations/api/client';
import { User } from '@/integrations/api/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated on initial load
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        // Check if we have a token stored
        const token = localStorage.getItem('authToken');
        if (token) {
          try {
            // Attempt to get the current user with the stored token
            const userData = await api.auth.getUser();
            setUser(userData);
          } catch (error) {
            // If the token is invalid, clear it
            console.error('Error retrieving user:', error);
            localStorage.removeItem('authToken');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth status check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Authentication methods using only our backend API
  const signIn = async (email: string, password: string) => {
    try {
      // Authenticate with our backend
      const authResponse = await api.auth.login(email, password);
      localStorage.setItem('authToken', authResponse.token);
      setUser(authResponse.user);
      return { error: null };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      // Register with our backend
      const authResponse = await api.auth.register({ 
        email, 
        password, 
        name: `${firstName} ${lastName}`
      });
      
      localStorage.setItem('authToken', authResponse.token);
      setUser(authResponse.user);
      return { error: null };
    } catch (error) {
      console.error('Error signing up:', error);
      return { error };
    }
  };

  const signOutUser = async () => {
    // Sign out from our backend
    await api.auth.logout();
    localStorage.removeItem('authToken');
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
