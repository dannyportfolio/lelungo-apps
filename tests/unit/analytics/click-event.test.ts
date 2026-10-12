import { describe, expect, it } from 'vitest';
import { clickEventSchema } from '@/modules/analytics/click-event';

describe('clickEventSchema', () => {
  it('accepts a bounded click event', () => {
    expect(
      clickEventSchema.parse({
        product_type: 'hotel',
        destination: 'Yogyakarta',
        deal_id: 'weekend-stay',
        price: 750_000,
      }),
    ).toEqual({
      product_type: 'hotel',
      destination: 'Yogyakarta',
      deal_id: 'weekend-stay',
      price: 750_000,
    });
  });

  it('rejects unexpected product types and unbounded prices', () => {
    expect(
      clickEventSchema.safeParse({
        product_type: 'payment',
        destination: 'Yogyakarta',
        deal_id: 'invalid-event',
        price: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
  });
});
