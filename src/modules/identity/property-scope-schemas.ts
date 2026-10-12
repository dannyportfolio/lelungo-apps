import { z } from 'zod';

import { PROPERTY_ACCESS_MODES } from './property-scope-contracts';

export const propertyScopePageSchema = z
  .object({
    pageSize: z.number().int().min(1).max(100),
    cursor: z.string().min(1).max(1024).nullable().optional(),
  })
  .strict();

const scopeMutationBase = {
  targetMembershipId: z.string().uuid(),
  expectedVersion: z.number().int().positive().safe(),
} as const;

export const replacePropertyAccessModeSchema = z
  .object({
    ...scopeMutationBase,
    propertyAccessMode: z.enum(PROPERTY_ACCESS_MODES),
    selectedPropertyIds: z.preprocess(
      (value) => (Array.isArray(value) ? [...new Set(value)] : value),
      z.array(z.string().uuid()).max(100),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.propertyAccessMode === 'ALL_PROPERTIES' && value.selectedPropertyIds.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedPropertyIds'],
        message: 'Organization-wide access cannot retain selected Property grants.',
      });
    }
  });

export const propertyGrantMutationSchema = z
  .object({
    ...scopeMutationBase,
    propertyId: z.string().uuid(),
  })
  .strict();

export type ReplacePropertyAccessModeInput = z.output<typeof replacePropertyAccessModeSchema>;
export type PropertyGrantMutationInput = z.output<typeof propertyGrantMutationSchema>;
