import { useNavigate } from 'react-router-dom';
import { clearAuthToken } from '@/lib/authToken';

// Hook for handling API errors in functional components
export const useApiErrorHandler = () => {
  const navigate = useNavigate();

  const handleError = (error: Error) => {
    console.error('API Error:', error);

    const isAuthError = error.message.includes('authenticated') || 
                       error.message.includes('expired') ||
                       error.message.includes('401');

    if (isAuthError) {
      clearAuthToken();
      navigate('/login');
      return;
    }

    // Let the error bubble up to be caught by error boundary
    throw error;
  };

  return { handleError };
};
