import type { NewFoodInput } from '../repository/Repository';

/**
 * Food-database search: pure mappers that turn USDA FoodData Central and Open
 * Food Facts API responses into the app's local `NewFoodInput`, normalized to a
 * **100 g serving** (the field both sources report most reliably). The user
 * then scales via the servings control. Network calls live in `foodApi.ts`;
 * these functions are pure so they're unit-tested against real fixtures.
 */

export interface FoodSearchResult {
  source: 'usda' | 'off';
  /** Stable-ish React key. */
  key: string;
  /** Clean display name (brand shown separately). */
  name: string;
  brand: string | null;
  /** Barcode when known (Open Food Facts), for the scanner + dedupe. */
  barcode: string | null;
  /** Ready to hand to `repository.createFood` — per 100 g. */
  food: NewFoodInput;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function per100g(
  name: string,
  brand: string | null,
  m: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
): NewFoodInput {
  return {
    name: brand ? `${name} (${brand})` : name,
    serving_size: 100,
    serving_unit: 'g',
    calories: Math.max(0, Math.round(m.calories)),
    protein: Math.max(0, round1(m.protein)),
    carbs: Math.max(0, round1(m.carbs)),
    fat: Math.max(0, round1(m.fat)),
    fiber: Math.max(0, round1(m.fiber)),
  };
}

/** True when there's enough macro signal to be worth showing. */
function hasMacros(m: { calories: number; protein: number; carbs: number; fat: number }): boolean {
  return m.calories > 0 || m.protein > 0 || m.carbs > 0 || m.fat > 0;
}

// --- USDA FoodData Central -------------------------------------------------
// `foods/search` returns nutrients normalized to per-100 g, keyed by
// `nutrientNumber`: 208 energy (kcal), 203 protein, 204 fat, 205 carbs, 291 fiber.

interface UsdaNutrient {
  nutrientNumber?: string;
  value?: number;
}
export interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  foodNutrients?: UsdaNutrient[];
}

function usdaValue(nutrients: UsdaNutrient[], number: string): number {
  const hit = nutrients.find((n) => n.nutrientNumber === number);
  return typeof hit?.value === 'number' ? hit.value : 0;
}

export function mapUsdaFood(item: UsdaFood): FoodSearchResult | null {
  const name = (item.description ?? '').trim();
  if (!name) return null;
  const ns = item.foodNutrients ?? [];
  const m = {
    calories: usdaValue(ns, '208'),
    protein: usdaValue(ns, '203'),
    carbs: usdaValue(ns, '205'),
    fat: usdaValue(ns, '204'),
    fiber: usdaValue(ns, '291'),
  };
  if (!hasMacros(m)) return null;
  const brand = (item.brandName || item.brandOwner || '').trim() || null;
  return {
    source: 'usda',
    key: `usda-${item.fdcId ?? name}`,
    name,
    brand,
    barcode: null,
    food: per100g(name, brand, m),
  };
}

// --- Open Food Facts -------------------------------------------------------
// Nutriments are per 100 g; energy in kcal preferred, kJ as fallback.

interface OffNutriments {
  'energy-kcal_100g'?: number;
  energy_100g?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
}
export interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
}

function num(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function mapOffProduct(p: OffProduct): FoodSearchResult | null {
  const name = (p.product_name ?? '').trim();
  if (!name) return null;
  const nut = p.nutriments ?? {};
  const kcal = nut['energy-kcal_100g'];
  const calories = typeof kcal === 'number' ? kcal : num(nut.energy_100g) / 4.184;
  const m = {
    calories,
    protein: num(nut.proteins_100g),
    carbs: num(nut.carbohydrates_100g),
    fat: num(nut.fat_100g),
    fiber: num(nut.fiber_100g),
  };
  if (!hasMacros(m)) return null;
  const brand = (p.brands ?? '').split(',')[0]?.trim() || null;
  return {
    source: 'off',
    key: `off-${p.code ?? name}`,
    name,
    brand,
    barcode: p.code ?? null,
    food: per100g(name, brand, m),
  };
}
