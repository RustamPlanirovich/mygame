/**
 * Save Compressor - Фаза 8
 * Сжатие и распаковка сохранений с использованием LZ-string (браузерная альтернатива LZ4)
 */

import LZString from 'lz-string';

// Уровень сжатия
export type CompressionLevel = 1 | 2 | 3;

// Результат сжатия
export interface CompressionResult {
  data: string;              // Base64 encoded data
  originalSize: number;      // Размер до сжатия
  compressedSize: number;    // Размер после сжатия
  compressionRatio: number;  // Коэффициент сжатия (0-1)
  algorithm: string;         // Используемый алгоритм
  checksum: string;          // SHA-256 хеш оригинальных данных
}

// Результат распаковки
export interface DecompressionResult {
  data: string;
  checksum: string;
  size: number;
  valid: boolean;            // Совпала ли контрольная сумма
}

/**
 * Вычисление SHA-256 хеша строки
 */
export async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Быстрое вычисление хеша (для сравнения, не криптографическое)
 */
export function fastHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Сжать данные сохранения
 */
export async function compressSave(
  data: string,
  level: CompressionLevel = 2
): Promise<CompressionResult> {
  const originalSize = new TextEncoder().encode(data).length;
  const checksum = await computeChecksum(data);
  
  let compressed: string;
  let algorithm: string;
  
  switch (level) {
    case 1:
      // Быстрое сжатие - Base64 UTF-16
      compressed = LZString.compressToBase64(data);
      algorithm = 'lz-string-base64';
      break;
    case 2:
      // Среднее сжатие - URI safe
      compressed = LZString.compressToEncodedURIComponent(data);
      algorithm = 'lz-string-uri';
      break;
    case 3:
      // Максимальное сжатие - UTF-16 string
      compressed = LZString.compress(data);
      // Конвертируем в base64 для передачи
      compressed = btoa(unescape(encodeURIComponent(compressed)));
      algorithm = 'lz-string-utf16';
      break;
    default:
      compressed = LZString.compressToBase64(data);
      algorithm = 'lz-string-base64';
  }
  
  const compressedSize = new TextEncoder().encode(compressed).length;
  const compressionRatio = 1 - (compressedSize / originalSize);
  
  return {
    data: compressed,
    originalSize,
    compressedSize,
    compressionRatio,
    algorithm,
    checksum,
  };
}

/**
 * Распаковать данные сохранения
 */
export async function decompressSave(
  compressedData: string,
  algorithm: string,
  expectedChecksum?: string
): Promise<DecompressionResult> {
  let decompressed: string | null;
  
  try {
    switch (algorithm) {
      case 'lz-string-base64':
        decompressed = LZString.decompressFromBase64(compressedData);
        break;
      case 'lz-string-uri':
        decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
        break;
      case 'lz-string-utf16':
        // Декодируем base64 обратно в UTF-16
        const utf16 = decodeURIComponent(escape(atob(compressedData)));
        decompressed = LZString.decompress(utf16);
        break;
      default:
        // Пробуем автоопределение
        decompressed = LZString.decompressFromBase64(compressedData);
        if (!decompressed) {
          decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
        }
    }
    
    if (!decompressed) {
      throw new Error('Decompression returned null');
    }
    
    const checksum = await computeChecksum(decompressed);
    const valid = expectedChecksum ? checksum === expectedChecksum : true;
    
    return {
      data: decompressed,
      checksum,
      size: new TextEncoder().encode(decompressed).length,
      valid,
    };
  } catch (error) {
    console.error('Decompression error:', error);
    throw new Error(`Failed to decompress save: ${error}`);
  }
}

/**
 * Проверить, сжаты ли данные
 */
export function isCompressed(data: string): boolean {
  // Проверяем, является ли это валидным JSON
  try {
    JSON.parse(data);
    return false; // Если парсится как JSON - не сжато
  } catch {
    // Не JSON, скорее всего сжато
    return true;
  }
}

/**
 * Автоматически распаковать данные, если они сжаты
 */
export async function autoDecompress(
  data: string,
  expectedChecksum?: string
): Promise<DecompressionResult> {
  if (!isCompressed(data)) {
    // Данные уже распакованы
    const checksum = await computeChecksum(data);
    return {
      data,
      checksum,
      size: new TextEncoder().encode(data).length,
      valid: expectedChecksum ? checksum === expectedChecksum : true,
    };
  }
  
  // Пробуем разные алгоритмы
  const algorithms = ['lz-string-base64', 'lz-string-uri', 'lz-string-utf16'];
  
  for (const algorithm of algorithms) {
    try {
      const result = await decompressSave(data, algorithm, expectedChecksum);
      if (result.data) {
        return result;
      }
    } catch {
      continue;
    }
  }
  
  throw new Error('Could not decompress data with any known algorithm');
}

/**
 * Получить размер данных в человекочитаемом формате
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Оценить размер сохранения без фактического сжатия
 */
export function estimateCompressedSize(data: string, level: CompressionLevel = 2): number {
  const originalSize = new TextEncoder().encode(data).length;
  
  // Примерные коэффициенты сжатия для JSON данных игры
  const ratios: Record<CompressionLevel, number> = {
    1: 0.65, // ~35% сжатие
    2: 0.55, // ~45% сжатие
    3: 0.45, // ~55% сжатие
  };
  
  return Math.round(originalSize * ratios[level]);
}

/**
 * Создать превью сохранения (минимальная информация для отображения)
 */
export interface SavePreview {
  era: number;
  credits: string;
  buildingsCount: number;
  playTime: number;
  lastPlayed: number;
}

export function extractSavePreview(saveData: string): SavePreview | null {
  try {
    const data = JSON.parse(saveData);
    
    return {
      era: data.currentEra || 1,
      credits: data.currencies?.credits || '0',
      buildingsCount: data.buildings?.length || 0,
      playTime: data.playTime || 0,
      lastPlayed: data.lastSaveTime || Date.now(),
    };
  } catch {
    return null;
  }
}
