import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/index.js';

export default async function serviceRoutes(fastify: FastifyInstance) {

    // 1. GET ALL SERVICES (Cached)
    fastify.get('/', async (request, reply) => {
        const cacheKey = 'services:all'; // You might append query params here like 'services:all:page1'

        // A. Check Redis
        const cachedServices = await fastify.redis.get(cacheKey);
        if (cachedServices) {
            return reply.send(JSON.parse(cachedServices));
        }

        // B. Query DB
        const services = await prisma.service.findMany({
            where: { isActive: true },
            include: {
                expert: {
                    select: {
                        headline: true,
                        user: { select: { name: true, avatarUrl: true } }
                    }
                }
            },
            take: 50 // Always limit "All" queries
        });

        // C. Cache for 1 Hour
        await fastify.redis.set(cacheKey, JSON.stringify(services), 'EX', 3600);

        return reply.send(services);
    });

    // Note: When creating/updating a service, remember to call:
    // await fastify.redis.del('services:all');
}