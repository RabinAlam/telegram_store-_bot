import { z } from 'zod';

export const loginDto = z.object({ email: z.string().email(), password: z.string().min(1) });
export const createAdminDto = z.object({ email: z.string().email(), password: z.string().min(8), role: z.enum(['SUPER_ADMIN', 'MANAGER', 'SUPPORT']) });
export const categoryDto = z.object({ name: z.string().min(1), emoji: z.string().default('📦'), sortOrder: z.number().int().default(0), isActive: z.boolean().default(true) });
export const productDto = z.object({
  categoryId: z.string().min(1), name: z.string().min(1), description: z.string().default(''),
  priceUsdt: z.coerce.number().positive(), isActive: z.boolean().default(true),
  deliveryMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'), deliveryTemplate: z.string().default(''), sortOrder: z.number().int().default(0),
});
export const stockImportDto = z.object({ lines: z.array(z.string().min(1)).min(1).max(2000) });
export const adjustDto = z.object({ delta: z.number().refine((n) => n !== 0 && Math.abs(n) < 100000), reason: z.string().min(3) });
export const orderActionDto = z.object({ action: z.enum(['markPaid', 'refund', 'resend', 'cancel']) });
export const depositDecisionDto = z.object({ approve: z.boolean(), note: z.string().default('') });
export const broadcastDto = z.object({ title: z.string().min(1), text: z.string().min(1), targetType: z.enum(['ALL', 'SEGMENT']).default('ALL') });
export const settingDto = z.object({ key: z.string().min(1), value: z.unknown() });
export const paginationDto = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
