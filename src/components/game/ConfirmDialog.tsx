import { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Modal } from '../ui';

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
  // Это окно почти всегда всплывает поверх другого модального окна (менеджер
  // сохранений, список игр). Modal слушает Escape на document, поэтому одно
  // нажатие закрыло бы и подтверждение, и окно под ним. Здесь Escape
  // перехватывается на window в фазе capture — до document он уже не доходит,
  // и закрывается только верхний диалог. Тот же приём, что в
  // components/admin/AdminPlayerDetail.tsx.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          iconColor: 'text-yellow-500',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-500',
          Icon: AlertTriangle,
        };
      case 'success':
        return {
          iconColor: 'text-green-500',
          buttonColor: 'bg-green-600 hover:bg-green-500',
          Icon: CheckCircle,
        };
      case 'alert':
        return {
          iconColor: 'text-red-500',
          buttonColor: 'bg-red-600 hover:bg-red-500',
          Icon: AlertTriangle,
        };
      default:
        return {
          iconColor: 'text-cyan-500',
          buttonColor: 'bg-cyan-600 hover:bg-cyan-500',
          Icon: Info,
        };
    }
  };

  const styles = getTypeStyles();
  const { Icon } = styles;

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      size="sm"
      icon={<Icon className={`w-5 h-5 ${styles.iconColor}`} />}
      footer={
        <div className="flex gap-3 justify-end">
          {showCancel && (
            <button
              onClick={onCancel}
              data-autofocus
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
            data-autofocus={showCancel ? undefined : true}
            className={`px-4 py-2 ${styles.buttonColor} text-white rounded transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="p-4">
        <p className="text-gray-300 whitespace-pre-wrap">{message}</p>
      </div>
    </Modal>
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

  /**
   * Открыто ли подтверждение. Нужно окнам, которые сами перехватывают Escape
   * для своих вложенных форм: пока висит подтверждение, Escape принадлежит ему.
   */
  return { confirm, DialogComponent, isConfirmOpen: dialogState.isOpen };
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
