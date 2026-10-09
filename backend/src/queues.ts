import { Queue } from 'bullmq';
import { redis } from './redis.js';
export const broadcastQueue = new Queue('broadcast', { connection: redis });
export const deliveryQueue = new Queue('delivery', { connection: redis });
