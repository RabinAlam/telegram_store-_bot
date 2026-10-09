"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signAccess = signAccess;
exports.signRefresh = signRefresh;
exports.verifyAccess = verifyAccess;
exports.verifyRefresh = verifyRefresh;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.audit = audit;
exports.verifyTotp = verifyTotp;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const db_js_1 = require("./db.js");
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
async function hashPassword(pw) { return bcryptjs_1.default.hash(pw, 12); }
async function verifyPassword(pw, hash) { return bcryptjs_1.default.compare(pw, hash); }
function signAccess(adminId, role) {
    return jsonwebtoken_1.default.sign({ sub: adminId, role, typ: 'access' }, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}
function signRefresh(adminId) {
    return jsonwebtoken_1.default.sign({ sub: adminId, typ: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}
function verifyAccess(token) {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET);
}
function verifyRefresh(token) {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_REFRESH_SECRET);
}
function requireAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer '))
        return res.status(401).json({ error: 'unauthorized' });
    try {
        const p = verifyAccess(h.slice(7));
        req.adminId = p.sub;
        req.adminRole = p.role;
        next();
    }
    catch {
        return res.status(401).json({ error: 'invalid token' });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.adminRole || !roles.includes(req.adminRole))
            return res.status(403).json({ error: 'forbidden' });
        next();
    };
}
async function audit(adminId, action, entity, entityId, before, after, ip) {
    await db_js_1.prisma.auditLog.create({ data: { adminId, action, entity, entityId, before: (before ?? {}), after: (after ?? {}), ip } });
}
function verifyTotp(secret, token) {
    return otplib_1.authenticator.check(token, secret);
}
