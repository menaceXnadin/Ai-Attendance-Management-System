import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ModernFaceRegistration from './ModernFaceRegistration';

interface ModernFaceRegistrationDialogProps {
  isOpen?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  onRegistrationComplete?: () => void;
  mode?: 'register' | 'verify';
}

const ModernFaceRegistrationDialog: React.FC<ModernFaceRegistrationDialogProps> = ({
  isOpen = false,
  onSuccess,
  onCancel,
  onClose,
  onRegistrationComplete,
  mode = 'register'
}) => {
  const handleClose = () => {
    onClose?.();
    onCancel?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-0">
        <ModernFaceRegistration
          onRegistrationComplete={onRegistrationComplete || onSuccess}
          onClose={handleClose}
          onSuccess={onSuccess}
          onCancel={onCancel}
          isOpen={isOpen}
          mode={mode}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ModernFaceRegistrationDialog;
