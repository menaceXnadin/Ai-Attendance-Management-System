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
      // For demo/development - hardcoded credentials
      // IMPORTANT: Remove in production and replace with proper authentication
      if (email === 'student@example.com' && password === 'student123') {
        // Dummy student user
        const dummyStudentUser = {
          id: 's123',
          email: 'student@example.com',
          name: 'John Smith',
          role: 'student'
        };
        localStorage.setItem('authToken', 'dummy-student-token');
        setUser(dummyStudentUser);
        return { error: null, user: dummyStudentUser };
      } else if (email === 'admin@example.com' && password === 'admin123') {
        // Dummy admin user
        const dummyAdminUser = {
          id: 'a456',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin'
        };
        localStorage.setItem('authToken', 'dummy-admin-token');
        setUser(dummyAdminUser);
        return { error: null, user: dummyAdminUser };
      }
      
      // If not using dummy credentials, proceed with real authentication
      const authResponse = await api.auth.login(email, password);
      localStorage.setItem('authToken', authResponse.token);
      setUser(authResponse.user);
      return { error: null, user: authResponse.user };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    // This function is deprecated - only admins can create student accounts now
    // Kept for backwards compatibility but should not be used in production
    console.warn('signUp function is deprecated. Only admins can create student accounts.');
    return { error: new Error('Registration is not available. Contact your administrator.') };
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
