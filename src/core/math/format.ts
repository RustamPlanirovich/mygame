import Decimal from 'break_eternity.js';

export const formatNumber = (num: any): string => {
  const n = new Decimal(num);
  
  if (n.lt(1000)) {
    return n.toFixed(1);
  }
  
  const exponent = n.e;
  const mantissa = n.mantissa;
  
  if (exponent < 6) return n.toFixed(0);
  if (exponent < 9) return n.div(1e6).toFixed(2) + "M";
  if (exponent < 12) return n.div(1e9).toFixed(2) + "B";
  if (exponent < 15) return n.div(1e12).toFixed(2) + "T";
  
  return `${mantissa.toFixed(2)}e${exponent}`;
};

export const D = (n: number | string | any) => new Decimal(n);
