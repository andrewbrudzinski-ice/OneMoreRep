import { describe, expect, it } from 'vitest';
import { mapUsdaFood, mapOffProduct } from './foodSearch';

describe('foodSearch mappers', () => {
  describe('mapUsdaFood', () => {
    it('maps per-100g nutrients by nutrientNumber', () => {
      const r = mapUsdaFood({
        fdcId: 123,
        description: 'Chicken breast, cooked',
        foodNutrients: [
          { nutrientNumber: '208', value: 165 },
          { nutrientNumber: '203', value: 31 },
          { nutrientNumber: '204', value: 3.6 },
          { nutrientNumber: '205', value: 0 },
          { nutrientNumber: '291', value: 0 },
        ],
      });
      expect(r).not.toBeNull();
      expect(r!.source).toBe('usda');
      expect(r!.name).toBe('Chicken breast, cooked');
      expect(r!.food).toMatchObject({
        serving_size: 100,
        serving_unit: 'g',
        calories: 165,
        protein: 31,
        fat: 3.6,
        carbs: 0,
      });
    });

    it('folds the brand into the saved food name', () => {
      const r = mapUsdaFood({
        fdcId: 9,
        description: 'Protein Bar',
        brandName: 'Acme',
        foodNutrients: [{ nutrientNumber: '208', value: 200 }],
      });
      expect(r!.brand).toBe('Acme');
      expect(r!.food.name).toBe('Protein Bar (Acme)');
    });

    it('skips items with no name or no macros', () => {
      expect(mapUsdaFood({ fdcId: 1, description: '', foodNutrients: [] })).toBeNull();
      expect(mapUsdaFood({ fdcId: 2, description: 'Water', foodNutrients: [] })).toBeNull();
    });
  });

  describe('mapOffProduct', () => {
    it('maps per-100g nutriments and captures the barcode', () => {
      const r = mapOffProduct({
        code: '0123456789',
        product_name: 'Greek Yogurt',
        brands: 'Fage, Total',
        nutriments: {
          'energy-kcal_100g': 59,
          proteins_100g: 10,
          carbohydrates_100g: 3.6,
          fat_100g: 0.4,
          fiber_100g: 0,
        },
      });
      expect(r!.source).toBe('off');
      expect(r!.barcode).toBe('0123456789');
      expect(r!.brand).toBe('Fage'); // first brand only
      expect(r!.food).toMatchObject({ calories: 59, protein: 10, carbs: 3.6, fat: 0.4 });
    });

    it('falls back to kJ energy when kcal is missing', () => {
      const r = mapOffProduct({
        code: '1',
        product_name: 'Mystery',
        nutriments: { energy_100g: 418.4, proteins_100g: 5 },
      });
      expect(r!.food.calories).toBe(100); // 418.4 kJ / 4.184
    });

    it('skips products with no name or no macros', () => {
      expect(mapOffProduct({ code: '1', product_name: '' })).toBeNull();
      expect(mapOffProduct({ code: '2', product_name: 'Empty', nutriments: {} })).toBeNull();
    });
  });
});
