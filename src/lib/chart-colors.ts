/**
 * Brand-aligned chart colors for Recharts and other charting libraries.
 * Maps to Oversikt brand tokens. Use these instead of hardcoded hex values.
 */

export const BRAND_COLORS = {
  fjord: '#1B3A4B',
  pine: '#2D5F3E',
  midnight: '#0F1F28',
  snow: '#F7F9F8',
  frost: '#E8F0ED',
  mist: '#C8D5CE',
  stone: '#8B9A8E',
  ember: '#C4704B',
  birch: '#D4C5A9',
  lichen: '#A3B8A0',
} as const

export const CHART_COLORS = {
  income: BRAND_COLORS.pine,
  expense: BRAND_COLORS.ember,
  transfer: BRAND_COLORS.birch,
  savings: BRAND_COLORS.lichen,
  debt: BRAND_COLORS.fjord,
  currentPeriodStroke: BRAND_COLORS.pine,
  currentPeriodStrokeDark: '#1e4a2d',
  expenseStroke: '#a35a3a',
} as const

export const CATEGORY_COLORS = [
  BRAND_COLORS.fjord,
  BRAND_COLORS.pine,
  BRAND_COLORS.ember,
  '#5B8A72',
  '#7B6B8D',
  '#C49A6C',
  '#4A7B8C',
  '#8B6B5D',
  '#6B8E7B',
  '#9B7B6B',
  BRAND_COLORS.birch,
  BRAND_COLORS.stone,
] as const

export const GOAL_COLORS = {
  contributing: '#2D5F3E',    // pine — spending/behavior that advances the goal
  neutral: '#8B9A8E',         // stone — no goal impact
  threatening: '#C4704B',     // ember — spending/behavior that works against the goal
  target: '#1B3A4B',          // fjord — goal reference line/marker
  onTrack: '#2D5F3E',         // pine — pace is good
  behind: '#C4704B',          // ember — pace is behind
  ahead: '#A3B8A0',           // lichen — ahead of pace
} as const
