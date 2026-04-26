import { describe, it, expect } from 'vitest';
import { calculateTotalPrice, calculateInstallment, formatPrice, CarConfiguration } from './configuratorStore';

describe('configuratorStore pure functions', () => {
  describe('calculateTotalPrice', () => {
    it('should calculate base price with aero wheels and no optionals', () => {
      const config: CarConfiguration = {
        exteriorColor: 'glacier-blue',
        interiorColor: 'carbon-black',
        wheelType: 'aero',
        optionals: []
      };
      expect(calculateTotalPrice(config)).toBe(40000);
    });

    it('should add sport wheels price correctly', () => {
      const config: CarConfiguration = {
        exteriorColor: 'glacier-blue',
        interiorColor: 'carbon-black',
        wheelType: 'sport',
        optionals: []
      };
      expect(calculateTotalPrice(config)).toBe(42000);
    });

    it('should add optionals price correctly', () => {
      const config: CarConfiguration = {
        exteriorColor: 'glacier-blue',
        interiorColor: 'carbon-black',
        wheelType: 'aero',
        optionals: ['precision-park', 'flux-capacitor']
      };
      expect(calculateTotalPrice(config)).toBe(40000 + 5500 + 5000); // Base + Precision Park + Flux Capacitor
    });
  });

  describe('calculateInstallment', () => {
    it('should calculate 12x installment with 2% monthly interest correctly', () => {
      // 40000 total -> 12x at 2% monthly
      const total = 40000;
      const installment = calculateInstallment(total);
      // Math.round(((40000 * 0.02 * Math.pow(1.02, 12)) / (Math.pow(1.02, 12) - 1)) * 100) / 100 => 3782.38
      expect(installment).toBe(3782.38);
    });
  });

  describe('formatPrice', () => {
    it('should format numbers to BRL currency string', () => {
      const formatted = formatPrice(40000);
      // To avoid issues with normal space vs non-breaking space (unicode \u00A0) in Intl.NumberFormat:
      const normalized = formatted.replace(/\u00A0/g, ' ');
      expect(normalized).toContain('R$');
      expect(normalized).toContain('40.000,00');
    });
  });
});
