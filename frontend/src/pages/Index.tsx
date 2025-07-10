
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the main landing page
    navigate('/');
  }, [navigate]);

  return null; // This component will immediately redirect to the landing page
};

export default Index;
