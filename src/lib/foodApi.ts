import { mapOffProduct, mapUsdaFood, type FoodSearchResult } from './foodSearch';

/**
 * Network layer for food-database search. Runs entirely in the user's browser
 * against public APIs — the only part of the app that talks to a third party,
 * and only for search. Picking a result snapshots its macros into the local
 * library exactly like a hand-typed food, so your log stays local + offline.
 *
 * - Open Food Facts: no key, CORS-enabled, also powers barcode lookup.
 * - USDA FoodData Central: optional, enabled by a free VITE_USDA_API_KEY.
 */

// USDA needs a key, but data.gov's shared DEMO_KEY works out of the box (low
// rate limits: ~30/hour). Ship it as the default so whole-food search ("chicken
// breast", "oats") works immediately; VITE_USDA_API_KEY overrides it with a
// free personal key for higher limits.
const USDA_KEY = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
const USING_REAL_USDA_KEY = !!import.meta.env.VITE_USDA_API_KEY;
const OFF_FIELDS = 'code,product_name,brands,nutriments';

/** True when a personal USDA key is configured (vs. the shared DEMO_KEY). */
export function usdaKeyConfigured(): boolean {
  return USING_REAL_USDA_KEY;
}

function keep(results: (FoodSearchResult | null)[]): FoodSearchResult[] {
  return results.filter((r): r is FoodSearchResult => r !== null);
}

async function searchUsda(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}` +
    `&query=${encodeURIComponent(query)}&pageSize=25` +
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const json = (await res.json()) as { foods?: unknown[] };
  return keep((json.foods ?? []).map((f) => mapUsdaFood(f as never)));
}

async function searchOff(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  // sort_by=unique_scans_n surfaces widely-scanned products, which tend to have
  // complete nutriments (so fewer get dropped for missing macros).
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=25&sort_by=unique_scans_n&fields=${OFF_FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OFF ${res.status}`);
  const json = (await res.json()) as { products?: unknown[] };
  return keep((json.products ?? []).map((p) => mapOffProduct(p as never)));
}

/**
 * Search both sources in parallel and merge. If one source fails the other's
 * results still come back; only a total failure throws.
 */
export async function searchFoods(
  query: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [usda, off] = await Promise.allSettled([searchUsda(q, signal), searchOff(q, signal)]);
  if (usda.status === 'rejected' && off.status === 'rejected') {
    throw new Error('Food search is unavailable — check your connection and try again.');
  }
  // USDA first — it's authoritative for whole foods, which is what generic
  // queries ("chicken", "rice") usually mean; Open Food Facts adds packaged items.
  const merged: FoodSearchResult[] = [];
  if (usda.status === 'fulfilled') merged.push(...usda.value);
  if (off.status === 'fulfilled') merged.push(...off.value);
  return merged;
}

/** Look up a single product by barcode via Open Food Facts (for the scanner). */
export async function lookupBarcode(
  code: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OFF ${res.status}`);
  const json = (await res.json()) as { status?: number; product?: unknown };
  if (!json.product) return null;
  return mapOffProduct(json.product as never);
}
