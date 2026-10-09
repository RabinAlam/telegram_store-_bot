"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
exports.auditRouter = (0, express_1.Router)();
exports.auditRouter.get('/', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const q = req.query;
    const where = {};
    if (q.action)
        where.action = { contains: String(q.action) };
    if (q.entity)
        where.entity = String(q.entity);
    const [total, items] = await Promise.all([
        db_js_1.prisma.auditLog.count({ where }),
        db_js_1.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize, include: { admin: { select: { email: true } } } }),
    ]);
    res.json({ total, items });
});
