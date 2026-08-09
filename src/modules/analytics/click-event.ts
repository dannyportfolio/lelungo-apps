import { z } from 'zod';

export const clickEventSchema = z
  .object({
    product_type: z.enum(['flight', 'hotel', 'package']),
    destination: z.string().trim().min(1).max(120),
    deal_id: z.string().trim().min(1).max(120),
    price: z.number().finite().nonnegative().max(1_000_000_000),
  })
  .strict();

export type ClickEvent = z.infer<typeof clickEventSchema>;
