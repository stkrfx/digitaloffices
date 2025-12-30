import { FastifyRequest, FastifyReply } from 'fastify';

// Define the Roles allowed in your app
export type UserRole = 'EXPERT' | 'ORGANIZATION' | 'ADMIN';

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
export const authorize = (allowedRoles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;

        if (!user) {
            return reply.status(401).send({ message: 'Unauthorized' });
        }

        // Map your JWT boolean flags to the String Roles
        const userRoles: UserRole[] = [];
        if (user.roles.isExpert) userRoles.push('EXPERT');
        if (user.roles.isOrg) userRoles.push('ORGANIZATION');
        if (user.roles.isAdmin) userRoles.push('ADMIN');

        // Check if user has AT LEAST ONE of the allowed roles
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            return reply.status(403).send({ 
                message: 'Forbidden: You do not have permission to access this resource.' 
            });
        }
    };
};