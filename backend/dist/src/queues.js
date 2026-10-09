"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryQueue = exports.broadcastQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_js_1 = require("./redis.js");
exports.broadcastQueue = new bullmq_1.Queue('broadcast', { connection: redis_js_1.redis });
exports.deliveryQueue = new bullmq_1.Queue('delivery', { connection: redis_js_1.redis });
