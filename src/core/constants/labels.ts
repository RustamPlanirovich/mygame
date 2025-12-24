import type { Enemy, ResourceType, TradeResourceType } from '../gameTypes';

export const RESOURCE_LABEL: Record<ResourceType, string> = {
  energy: 'Энергия',
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  steel: 'Сталь',
  dark_matter: 'Тёмная Материя',
};

export const RESOURCE_SHORT: Record<ResourceType, string> = {
  energy: '⚡',
  ore: 'РУД',
  ice: 'ЛЁД',
  carbon: 'УГЛ',
  steel: 'СТ',
  dark_matter: 'ТМ',
};

export const TRADE_LABEL: Record<TradeResourceType, string> = {
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  steel: 'Сталь',
};

export const ENEMY_LABEL: Record<Enemy['type'], string> = {
  scout: 'Глитч: Разведчик',
  swarmer: 'Глитч: Рой',
  brute: 'Глитч: Брут',
};
