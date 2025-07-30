// Modern Face Registration Component
// Uses the new ModernFaceRegistration component with enhanced UI/UX

import React from 'react';
import ModernFaceRegistrationDialog from './ModernFaceRegistrationDialog';

interface FaceRegistrationProps {
  isOpen?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  mode?: 'register' | 'verify';
}

const FaceRegistration: React.FC<FaceRegistrationProps> = ({
  isOpen = false,
  onSuccess,
  onCancel,
  mode = 'register'
}) => {
  return (
    <ModernFaceRegistrationDialog
      isOpen={isOpen}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onClose={onCancel}
      mode={mode}
    />
  );
};

export default FaceRegistration;
