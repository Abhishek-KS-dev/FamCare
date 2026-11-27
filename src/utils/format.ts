import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

import type { ProductSource } from '../services/api.ts';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  CAD: 'CA$',
  AUD: 'A$',
};

export function formatCurrency(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'Unavailable';
  }
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] || `${currency} `;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${sym}${Math.abs(amount).toFixed(2)}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatSourceLabel(source: ProductSource): string {
  switch (source) {
    case 'open_food_facts':
      return 'Open Food Facts';
    case 'ocr_verified':
      return 'OCR Label (User Verified)';
    case 'manual_entry':
      return 'Manual Entry (Unverified)';
    case 'ifct_2017':
      return 'IFCT 2017 (Raw Unpackaged)';
    case 'prepared_dish_db':
      return 'Indian Prepared Dishes';
  }
}
