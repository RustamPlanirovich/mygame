import { useState, useEffect } from 'react';
import { 
  getGameSlots, 
  createGameSlot, 
  deleteGameSlot, 
  switchGameSlot,
  updateGameSlot,
  type GameSlot 
} from '../../utils/settingsApi';
import { 
  Plus, 
  Trash2, 
  Play, 
  X, 
  Gamepad2,
  Clock,
  Calendar,
  Edit3,
  Check,
} from 'lucide-react';
import { Alert, EmptyState, Modal, SkeletonRows } from '../ui';
import { useConfirmDialog } from './ConfirmDialog';

interface GameSlotsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSlotSwitch?: () => void;
}

export const GameSlotsManager = ({ isOpen, onClose, onSlotSwitch }: GameSlotsManagerProps) => {
  const [slots, setSlots] = useState<GameSlot[]>([]);
  const [currentSlotId, setCurrentSlotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewSlotDialog, setShowNewSlotDialog] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');
  const [newSlotDescription, setNewSlotDescription] = useState('');
  const [error, setError] = useState('');
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Подавляем предупреждение о неиспользуемых пропсах
  void onSlotSwitch;
  
  const {
    confirm: showConfirm,
    DialogComponent: ConfirmDialogComponent,
    isConfirmOpen,
  } = useConfirmDialog();

  useEffect(() => {
    if (isOpen) {
      loadSlots();
    }
  }, [isOpen]);

  // Escape внутри окна: сначала закрывается переименование слота, затем форма
  // «Новая игра», и только потом само окно (этим уже занимается Modal).
  // Перехват на window в фазе capture не даёт нажатию дойти до слушателя Modal
  // на document — тот же приём, что в components/admin/AdminPlayerDetail.tsx.
  // Пока открыт диалог подтверждения, Escape принадлежит ему.
  useEffect(() => {
    if (!isOpen || isConfirmOpen) return;
    if (editingSlotId === null && !showNewSlotDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (editingSlotId !== null) {
        setEditingSlotId(null);
        return;
      }
      setShowNewSlotDialog(false);
      setNewSlotName('');
      setNewSlotDescription('');
      setError('');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, isConfirmOpen, editingSlotId, showNewSlotDialog]);

  const loadSlots = async () => {
    setLoading(true);
    setError('');
    const result = await getGameSlots();
    if (result.ok && result.slots) {
      setSlots(result.slots);
      setCurrentSlotId(result.currentSlotId ?? null);
    } else {
      setError(result.error || 'Ошибка загрузки');
    }
    setLoading(false);
  };

  const handleCreateSlot = async () => {
    if (!newSlotName.trim()) {
      setError('Введите название игры');
      return;
    }

    setLoading(true);
    setError('');
    
    const result = await createGameSlot(newSlotName.trim(), newSlotDescription.trim() || undefined);
    
    if (result.ok && result.slot) {
      // Очищаем localStorage чтобы не загружалось старое сохранение
      localStorage.removeItem('gameState');
      localStorage.removeItem('currentSaveId');
      
      // Перезагружаем страницу для полной инициализации нового состояния
      window.location.reload();
    } else {
      if (result.error === 'SLOT_NAME_EXISTS') {
        setError('Игра с таким названием уже существует');
      } else {
        setError(result.error || 'Ошибка создания игры');
      }
    }
    setLoading(false);
  };

  const handleDeleteSlot = async (slotId: number, slotName: string) => {
    const confirmed = await showConfirm({
      title: 'Удаление игры',
      message: `Вы уверены, что хотите удалить игру "${slotName}"?\n\nВсе сохранения этой игры будут безвозвратно удалены!`,
      type: 'alert',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });
    
    if (!confirmed) return;

    setLoading(true);
    setError('');
    
    const result = await deleteGameSlot(slotId);
    
    if (result.ok) {
      await loadSlots();
      
      // Если удалили текущий слот, нужно выбрать другой или показать выбор
      if (slotId === currentSlotId) {
        setCurrentSlotId(null);
      }
    } else {
      setError(result.error || 'Ошибка удаления игры');
    }
    setLoading(false);
  };

  const handleSwitchSlot = async (slotId: number) => {
    if (slotId === currentSlotId) return;
    
    const slot = slots.find(s => s.id === slotId);
    const confirmed = await showConfirm({
      title: 'Переключение игры',
      message: `Переключиться на игру "${slot?.name}"?\n\nТекущий несохранённый прогресс будет потерян.`,
      type: 'warning',
      confirmText: 'Переключиться',
      cancelText: 'Отмена',
    });
    
    if (!confirmed) return;

    setLoading(true);
    setError('');
    
    const result = await switchGameSlot(slotId);
    
    if (result.ok) {
      // Очищаем localStorage и перезагружаем для полной инициализации
      localStorage.removeItem('gameState');
      localStorage.removeItem('currentSaveId');
      window.location.reload();
    } else {
      setError(result.error || 'Ошибка переключения игры');
      setLoading(false);
    }
  };

  const handleStartEditName = (slot: GameSlot) => {
    setEditingSlotId(slot.id);
    setEditingName(slot.name);
  };

  const handleSaveEditName = async (slotId: number) => {
    if (!editingName.trim()) {
      setError('Название не может быть пустым');
      return;
    }
    
    setLoading(true);
    const result = await updateGameSlot(slotId, editingName.trim());
    
    if (result.ok) {
      setEditingSlotId(null);
      await loadSlots();
    } else {
      if (result.error === 'SLOT_NAME_EXISTS') {
        setError('Игра с таким названием уже существует');
      } else {
        setError(result.error || 'Ошибка переименования');
      }
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPlayTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}ч ${mins}м`;
  };

  if (!isOpen) return null;

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title="Мои игры"
      icon={<Gamepad2 className="w-5 h-5" />}
      size="lg"
      footer={
        <p className="text-xs text-gray-500 text-center">
          Каждая игра — это отдельный прогресс со своими сохранениями.
          Создавайте новые игры для тестирования стратегий!
        </p>
      }
    >
        {/* Content */}
        <div className="p-4 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {/* New Game Button */}
          <button
            onClick={() => {
              setShowNewSlotDialog(true);
              setError('');
            }}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Создать новую игру
          </button>

          {/* New Slot Dialog */}
          {showNewSlotDialog && (
            <div className="bg-gray-800 border border-cyan-500/30 rounded p-4 space-y-3">
              <h3 className="text-cyan-400 font-bold">Новая игра</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Название *</label>
                <input
                  type="text"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  placeholder="Моя новая игра"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Описание (необязательно)</label>
                <input
                  type="text"
                  value={newSlotDescription}
                  onChange={(e) => setNewSlotDescription(e.target.value)}
                  placeholder="Тестирую новую стратегию..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSlot}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Создать
                </button>
                <button
                  onClick={() => {
                    setShowNewSlotDialog(false);
                    setNewSlotName('');
                    setNewSlotDescription('');
                    setError('');
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Slots List */}
          {slots.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-400">Ваши игры</h3>
              {slots.map(slot => (
                <div
                  key={slot.id}
                  className={`bg-gray-800 border rounded p-4 transition-colors ${
                    slot.id === currentSlotId 
                      ? 'border-green-500 bg-green-900/20' 
                      : 'border-gray-700 hover:border-cyan-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Название */}
                      {editingSlotId === slot.id ? (
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 bg-gray-900 border border-cyan-500 rounded px-2 py-1 text-white focus:outline-none"
                            autoFocus
                            aria-label={`Новое название игры «${slot.name}»`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditName(slot.id);
                            }}
                          />
                          <button
                            onClick={() => handleSaveEditName(slot.id)}
                            className="text-green-400 hover:text-green-300"
                            title="Сохранить название"
                            aria-label="Сохранить название"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setEditingSlotId(null)}
                            className="text-gray-400 hover:text-gray-300"
                            title="Отменить переименование"
                            aria-label="Отменить переименование"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white truncate">{slot.name}</span>
                          {slot.id === currentSlotId && (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                              Текущая
                            </span>
                          )}
                          <button
                            onClick={() => handleStartEditName(slot)}
                            className="text-gray-500 hover:text-gray-300"
                            title="Переименовать"
                            aria-label={`Переименовать игру «${slot.name}»`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      {/* Описание */}
                      {slot.description && (
                        <p className="text-sm text-gray-400 mb-2 truncate">{slot.description}</p>
                      )}
                      
                      {/* Метаданные */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Создано: {formatDate(slot.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Последняя игра: {formatDate(slot.last_played_at)}
                        </span>
                        {slot.play_time_seconds > 0 && (
                          <span className="flex items-center gap-1">
                            <Gamepad2 className="w-3 h-3" />
                            Наиграно: {formatPlayTime(slot.play_time_seconds)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Кнопки действий */}
                    <div className="flex gap-2 shrink-0">
                      {slot.id !== currentSlotId && (
                        <button
                          onClick={() => handleSwitchSlot(slot.id)}
                          disabled={loading}
                          className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white p-2 rounded transition-colors"
                          title="Играть"
                          aria-label={`Играть в «${slot.name}»`}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSlot(slot.id, slot.name)}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white p-2 rounded transition-colors"
                        title="Удалить"
                        aria-label={`Удалить игру «${slot.name}»`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <EmptyState
              icon={<Gamepad2 className="w-6 h-6" />}
              title="У вас пока нет игр"
              hint="Создайте первую игру, чтобы начать!"
            />
          )}

          {loading && <SkeletonRows rows={3} />}
        </div>
    </Modal>
    {/* После <Modal>: подтверждение — вложенное окно, его слой в стеке Modal назначается
        по порядку монтирования, порядок в JSX держим тем же. */}
    <ConfirmDialogComponent />
    </>
  );
};
