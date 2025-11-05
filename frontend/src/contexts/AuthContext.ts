import { createContext } from 'react';
import { User } from '@/integrations/api/types';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: unknown | null; user?: User }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: unknown | null; user?: User }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
