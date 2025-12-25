import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

/**
 * Хук для определения типа устройства и его характеристик
 */
export const useDevice = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => 
    getDeviceInfo()
  );

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    const handleOrientationChange = () => {
      // Даем время на изменение размеров экрана
      setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
};

function getDeviceInfo(): DeviceInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Определяем тип устройства по ширине экрана
  let type: DeviceType = 'desktop';
  if (width < 768) {
    type = 'mobile';
  } else if (width < 1024) {
    type = 'tablet';
  }

  // Проверяем поддержку touch
  const isTouchDevice = 
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // Определяем ориентацию
  const orientation = width > height ? 'landscape' : 'portrait';

  return {
    type,
    isMobile: type === 'mobile',
    isTablet: type === 'tablet',
    isDesktop: type === 'desktop',
    isTouchDevice,
    screenWidth: width,
    screenHeight: height,
    orientation,
  };
}

/**
 * Хук для определения, находимся ли мы в mobile viewport
 */
export const useIsMobile = (): boolean => {
  const device = useDevice();
  return device.isMobile;
};

/**
 * Хук для определения, является ли устройство touch-enabled
 */
export const useIsTouchDevice = (): boolean => {
  const device = useDevice();
  return device.isTouchDevice;
};

/**
 * Хук для получения рекомендуемых настроек производительности
 */
export const useRecommendedSettings = () => {
  const device = useDevice();

  return {
    targetFPS: device.isMobile ? 30 : 60,
    quality: device.isMobile ? 'low' : device.isTablet ? 'medium' : 'high',
    showAnimations: !device.isMobile,
    particleEffects: device.isDesktop,
    showGrid: !device.isMobile,
    compactMode: device.isMobile || device.isTablet,
  } as const;
};
