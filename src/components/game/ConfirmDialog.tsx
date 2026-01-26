import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

type DialogType = 'confirm' | 'alert' | 'warning' | 'success';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  showCancel?: boolean;
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  type = 'confirm',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  showCancel = true,
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          borderColor: 'border-yellow-500',
          iconColor: 'text-yellow-500',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-500',
          Icon: AlertTriangle,
        };
      case 'success':
        return {
          borderColor: 'border-green-500',
          iconColor: 'text-green-500',
          buttonColor: 'bg-green-600 hover:bg-green-500',
          Icon: CheckCircle,
        };
      case 'alert':
        return {
          borderColor: 'border-red-500',
          iconColor: 'text-red-500',
          buttonColor: 'bg-red-600 hover:bg-red-500',
          Icon: AlertTriangle,
        };
      default:
        return {
          borderColor: 'border-cyan-500',
          iconColor: 'text-cyan-500',
          buttonColor: 'bg-cyan-600 hover:bg-cyan-500',
          Icon: Info,
        };
    }
  };

  const styles = getTypeStyles();
  const { Icon } = styles;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div 
        className={`bg-gray-900 border-2 ${styles.borderColor} rounded-lg max-w-md w-full shadow-xl animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 p-4 border-b border-gray-700`}>
          <Icon className={`w-6 h-6 ${styles.iconColor}`} />
          <h3 className="text-lg font-bold text-white flex-1">{title}</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-gray-300 whitespace-pre-wrap">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-700 justify-end">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm?.();
              onCancel();
            }}
            className={`px-4 py-2 ${styles.buttonColor} text-white rounded transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook для удобного использования confirm диалога
import { useState, useCallback } from 'react';

interface UseConfirmDialogOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: UseConfirmDialogOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const confirm = useCallback((options: UseConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    dialogState.resolve?.(true);
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialogState.resolve]);

  const handleCancel = useCallback(() => {
    dialogState.resolve?.(false);
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialogState.resolve]);

  const DialogComponent = useCallback(() => (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      title={dialogState.options.title}
      message={dialogState.options.message}
      type={dialogState.options.type}
      confirmText={dialogState.options.confirmText}
      cancelText={dialogState.options.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [dialogState.isOpen, dialogState.options, handleConfirm, handleCancel]);

  return { confirm, DialogComponent };
};

// Простой hook для отображения alert-уведомлений
export const useAlertDialog = () => {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: DialogType;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const showAlert = useCallback((message: string, title = 'Внимание', type: DialogType = 'alert') => {
    setAlertState({
      isOpen: true,
      title,
      message,
      type,
    });
  }, []);

  const showSuccess = useCallback((message: string, title = 'Успешно') => {
    showAlert(message, title, 'success');
  }, [showAlert]);

  const showWarning = useCallback((message: string, title = 'Предупреждение') => {
    showAlert(message, title, 'warning');
  }, [showAlert]);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const AlertComponent = useCallback(() => (
    <ConfirmDialog
      isOpen={alertState.isOpen}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      confirmText="OK"
      onCancel={hideAlert}
      showCancel={false}
    />
  ), [alertState.isOpen, alertState.title, alertState.message, alertState.type, hideAlert]);

  return { showAlert, showSuccess, showWarning, AlertComponent };
};
