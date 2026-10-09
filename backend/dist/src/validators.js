"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationDto = exports.settingDto = exports.broadcastDto = exports.depositDecisionDto = exports.orderActionDto = exports.adjustDto = exports.stockImportDto = exports.productDto = exports.categoryDto = exports.createAdminDto = exports.loginDto = void 0;
const zod_1 = require("zod");
exports.loginDto = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(1), totp: zod_1.z.string().optional() });
exports.createAdminDto = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(8), role: zod_1.z.enum(['SUPER_ADMIN', 'MANAGER', 'SUPPORT']) });
exports.categoryDto = zod_1.z.object({ name: zod_1.z.string().min(1), emoji: zod_1.z.string().default('📦'), sortOrder: zod_1.z.number().int().default(0), isActive: zod_1.z.boolean().default(true) });
exports.productDto = zod_1.z.object({
    categoryId: zod_1.z.string().min(1), name: zod_1.z.string().min(1), description: zod_1.z.string().default(''),
    priceUsdt: zod_1.z.coerce.number().positive(), isActive: zod_1.z.boolean().default(true),
    deliveryMode: zod_1.z.enum(['AUTO', 'MANUAL']).default('AUTO'), deliveryTemplate: zod_1.z.string().default(''), sortOrder: zod_1.z.number().int().default(0),
});
exports.stockImportDto = zod_1.z.object({ lines: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(2000) });
exports.adjustDto = zod_1.z.object({ delta: zod_1.z.number().refine((n) => n !== 0 && Math.abs(n) < 100000), reason: zod_1.z.string().min(3) });
exports.orderActionDto = zod_1.z.object({ action: zod_1.z.enum(['markPaid', 'refund', 'resend', 'cancel']) });
exports.depositDecisionDto = zod_1.z.object({ approve: zod_1.z.boolean(), note: zod_1.z.string().default('') });
exports.broadcastDto = zod_1.z.object({ title: zod_1.z.string().min(1), text: zod_1.z.string().min(1), targetType: zod_1.z.enum(['ALL', 'SEGMENT']).default('ALL') });
exports.settingDto = zod_1.z.object({ key: zod_1.z.string().min(1), value: zod_1.z.unknown() });
exports.paginationDto = zod_1.z.object({ page: zod_1.z.coerce.number().int().min(1).default(1), pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20) });
