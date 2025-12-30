import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/index.js';
import { authenticate, authorize } from '../../middleware/auth.js'; // Use your new guards

export default async function expertRoutes(fastify: FastifyInstance) {

    // GEO-SPATIAL SEARCH ROUTE
    fastify.get<{ Querystring: { lat: number; lng: number; radiusKm?: number } }>('/search', {
        schema: {
            querystring: {
                type: 'object',
                required: ['lat', 'lng'],
                properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                    radiusKm: { type: 'number', default: 10 } // Default 10km radius
                }
            }
        }
    }, async (request, reply) => {
        const { lat, lng, radiusKm = 10 } = request.query;

        // RAW SQL EXPLANATION:
        // 1. ST_MakePoint(longitude, latitude): Creates a point from your DB columns
        // 2. ST_SetSRID(..., 4326): Tells PostGIS this is WGS84 (Standard GPS coords)
        // 3. ST_DistanceSphere: Calculates distance in meters taking Earth's curvature into account
        
        // Note: We multiply radiusKm * 1000 to get meters
        const radiusMeters = radiusKm * 1000;

        const experts = await prisma.$queryRaw`
            SELECT 
                e.id, 
                e.headline, 
                e.bio, 
                e."userId",
                e.latitude,
                e.longitude,
                u.name as "userName",
                u."avatarUrl",
                (ST_DistanceSphere(
                    ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326),
                    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
                ) / 1000) as "distanceKm"
            FROM "ExpertProfile" e
            JOIN "User" u ON e."userId" = u.id
            WHERE 
                e.latitude IS NOT NULL 
                AND e.longitude IS NOT NULL
                AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
                    ${radiusMeters}
                )
            ORDER BY "distanceKm" ASC
            LIMIT 50;
        `;

        return reply.send(experts);
    });

    // 1. GET EXPERT PROFILE (Read-Through Cache)
    fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { id } = request.params;
        const cacheKey = `expert:${id}`;

        // A. Try Cache First
        const cachedProfile = await fastify.redis.get(cacheKey);
        if (cachedProfile) {
            // HIT: Return cached data
            return reply.send(JSON.parse(cachedProfile));
        }

        // B. Cache Miss: Query DB
        const expert = await prisma.expertProfile.findUnique({
            where: { id },
            include: { 
                user: { select: { name: true, avatarUrl: true } }, // Minimal User Data
                services: true 
            }
        });

        if (!expert) {
            return reply.status(404).send({ message: 'Expert not found' });
        }

        // C. Save to Redis (TTL: 1 Hour = 3600 seconds)
        // Gold Standard: Use 'EX' for Expiry to prevent stale data persisting forever
        await fastify.redis.set(cacheKey, JSON.stringify(expert), 'EX', 3600);

        return reply.send(expert);
    });

    // 2. UPDATE PROFILE (Cache Invalidation)
    fastify.put<{ Params: { id: string }, Body: { headline: string, bio: string } }>(
        '/:id',
        {
            // Security: Only the Expert themselves should do this (add ownership check logic in real app)
            onRequest: [authenticate, authorize(['EXPERT'])]
        },
        async (request, reply) => {
            const { id } = request.params;
            const { headline, bio } = request.body;

            // A. Update DB
            const updatedExpert = await prisma.expertProfile.update({
                where: { id },
                data: { headline, bio }
            });

            // B. INVALIDATE CACHE (The Gold Standard)
            // We delete the key so the next Fetch forces a DB refresh
            await fastify.redis.del(`expert:${id}`);

            return reply.send(updatedExpert);
        }
    );
}