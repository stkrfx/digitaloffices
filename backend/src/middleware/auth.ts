import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@shared/types';

// Define the Roles allowed in your app
// export type UserRole = 'EXPERT' | 'ORGANIZATION' | 'ADMIN';

/**
 * 1. AUTHENTICATION GUARD
 * strict: true = Throw error if no token (Protected Routes)
 * strict: false = Allow request but user is null if no token (Optional Auth)
 */
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // This attaches the decoded token to request.user
        await request.jwtVerify();
    } catch (err) {
        reply.status(401).send({ message: 'Unauthorized: Invalid or missing token' });
    }
};

/**
 * 2. AUTHORIZATION GUARD (RBAC)
 * Checks if the logged-in user has specific permissions.
 */
export const authorize = (requiredRoles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as {
            id: string;
            roles: { isExpert: boolean; isOrg: boolean; isAdmin: boolean }
        };

        if (!user) {
            return reply.status(401).send({ message: 'Unauthorized: No user found' });
        }

        let hasPermission = false;

        // 2. Map String Roles to Boolean Flags
        if (requiredRoles.includes('USER') && requiredRoles.length === 1) hasPermission = true;
        if (requiredRoles.includes('EXPERT') && user.roles.isExpert) hasPermission = true;
        if (requiredRoles.includes('ORGANIZATION') && user.roles.isOrg) hasPermission = true;
        if (requiredRoles.includes('ADMIN') && user.roles.isAdmin) hasPermission = true;

        if (!hasPermission) {
            return reply.status(403).send({ message: 'Forbidden: Insufficient permissions' });
        }
    };
};