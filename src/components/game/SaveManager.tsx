import { useState, useEffect } from 'react';
import { useGameStore } from '../../features/gameStore';
import { Save, Trash2, Download, X, Plus } from 'lucide-react';

interface SaveInfo {
  id: number;
  name: string;
  save_type: 'manual' | 'auto';
  created_at: string;
  updated_at: string;
}

interface SaveManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveManager = ({ isOpen, onClose }: SaveManagerProps) => {
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewSaveDialog, setShowNewSaveDialog] = useState(false);
  const [newSaveName, setNewSaveName] = useState('');
  const [error, setError] = useState('');

  const getSavesList = useGameStore(state => state.getSavesList);
  const loadGameFromSave = useGameStore(state => state.loadGameFromSave);
  const saveGameManual = useGameStore(state => state.saveGameManual);
  const deleteSave = useGameStore(state => state.deleteSave);

  useEffect(() => {
    if (isOpen) {
      loadSaves();
    }
  }, [isOpen]);

  const loadSaves = async () => {
    setLoading(true);
    const result = await getSavesList();
    if (result.ok && result.saves) {
      setSaves(result.saves);
    }
    setLoading(false);
  };

  const handleLoadSave = async (saveId: number) => {
    console.log('🎮 Пользователь выбрал сохранение:', saveId);
    setLoading(true);
    try {
      const result = await loadGameFromSave(saveId);
      if (result.ok) {
        console.log('✅ Сохранение успешно загружено');
        onClose();
        // Не перезагружаем страницу - состояние уже применено через set()
      } else {
        console.error('❌ Ошибка при загрузке:', result.error);
        setError(`Ошибка загрузки сохранения: ${result.error}`);
      }
    } catch (e) {
      console.error('💥 Исключение при загрузке:', e);
      setError(`Ошибка: ${String(e)}`);
    }
    setLoading(false);
  };

  const handleCreateSave = async () => {
    if (!newSaveName.trim()) {
      setError('Введите название сохранения');
      return;
    }

    setLoading(true);
    setError('');
    const result = await saveGameManual(newSaveName);
    if (result.ok) {
      setShowNewSaveDialog(false);
      setNewSaveName('');
      await loadSaves();
    } else {
      if (result.error === 'SAVE_NAME_EXISTS') {
        setError('Сохранение с таким именем уже существует');
      } else {
        setError('Ошибка создания сохранения');
      }
    }
    setLoading(false);
  };

  const handleDeleteSave = async (saveId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это сохранение?')) {
      return;
    }

    setLoading(true);
    const result = await deleteSave(saveId);
    if (result.ok) {
      await loadSaves();
    } else {
      setError('Ошибка удаления сохранения');
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  const manualSaves = saves.filter(s => s.save_type === 'manual');
  const autoSaves = saves.filter(s => s.save_type === 'auto');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/30">
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <Save className="w-5 h-5" />
            Управление сохранениями
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* New Save Button */}
          <button
            onClick={() => setShowNewSaveDialog(true)}
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Создать новое сохранение
          </button>

          {/* New Save Dialog */}
          {showNewSaveDialog && (
            <div className="bg-gray-800 border border-cyan-500/30 rounded p-4 space-y-3">
              <h3 className="text-cyan-400 font-bold">Новое сохранение</h3>
              <input
                type="text"
                value={newSaveName}
                onChange={(e) => setNewSaveName(e.target.value)}
                placeholder="Название сохранения"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSave}
                  disabled={loading}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Создать
                </button>
                <button
                  onClick={() => {
                    setShowNewSaveDialog(false);
                    setNewSaveName('');
                    setError('');
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Manual Saves */}
          {manualSaves.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-400">Ваши сохранения</h3>
              {manualSaves.map(save => (
                <div
                  key={save.id}
                  className="bg-gray-800 border border-gray-700 rounded p-3 flex items-center justify-between hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-bold text-white">{save.name}</div>
                    <div className="text-sm text-gray-400">
                      Создано: {formatDate(save.created_at)}
                      {save.created_at !== save.updated_at && (
                        <> • Изменено: {formatDate(save.updated_at)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadSave(save.id)}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white p-2 rounded transition-colors"
                      title="Загрузить"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSave(save.id)}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white p-2 rounded transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Auto Saves */}
          {autoSaves.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-400">Автосохранения</h3>
              {autoSaves.map(save => (
                <div
                  key={save.id}
                  className="bg-gray-800 border border-gray-700 rounded p-3 flex items-center justify-between hover:border-cyan-500/50 transition-colors opacity-75"
                >
                  <div className="flex-1">
                    <div className="font-bold text-gray-300">{save.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatDate(save.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadSave(save.id)}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white p-2 rounded transition-colors"
                      title="Загрузить"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && saves.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              У вас пока нет сохранений
            </div>
          )}

          {loading && (
            <div className="text-center text-cyan-400 py-8">
              Загрузка...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
