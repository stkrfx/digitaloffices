import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../db/index.js';
import { generateUniqueUsername } from '../../utils/username.js';
import { RegisterRequest, LoginRequest, AuthResponse, UserRole, VerifyEmailRequest } from '@shared/types';
import { sendVerificationEmail } from '../../utils/mailer.js';
import { validateEmailStrict } from '../../utils/emailValidator.js';
import { OAuth2Client } from 'google-auth-library';
import { authenticate } from '../../middleware/auth.js';


const registerSchema = {
    body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 }, // Enforce complexity here
            name: { type: 'string', minLength: 2 },
            promotionalEmails: { type: 'boolean' },
            initialRole: { type: 'string', enum: ['USER', 'EXPERT', 'ORGANIZATION'] }
        }
    }
};

const loginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
        }
    }
};

export default async function authRoutes(fastify: FastifyInstance) {

    // Initialize the Google Client (outside the function)
    const googleClient = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID // Ensure this is in your .env
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = isProduction ? '.digitaloffices.com.au' : undefined;

    // REGISTER ROUTE
    fastify.post<{ Body: RegisterRequest }>('/register', { schema: registerSchema }, async (request, reply) => {
        const { email, password, name, promotionalEmails, initialRole } = request.body;

        // --- NEW SECURITY CHECK ---
        const emailCheck = await validateEmailStrict(email);
        if (!emailCheck.isValid) {
            return reply.status(400).send({
                message: emailCheck.reason,
                error: "Email Validation Failed"
            });
        }
        // --------------------------

        // 1. Check if Email Exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.status(409).send({ message: 'Email already exists' });
        }

        // 2. Hash Password (if provided)
        const passwordHash = password ? await bcrypt.hash(password, 10) : null;

        // 3. Generate Username
        const username = await generateUniqueUsername();

        // Generate Email Verification Token
        const emailToken = crypto.randomBytes(32).toString('hex');

        // 4. Create User (Transaction to handle Profile creation)
        await prisma.$transaction(async (tx) => {
            // A. Create Core User
            const user = await tx.user.create({
                data: {
                    email,
                    name,
                    username,
                    passwordHash,
                    promotionalEmailsEnabled: promotionalEmails || false,
                    emailVerificationToken: emailToken,
                    // ADD THIS (24 hour expiry):
                    emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    // If they selected EXPERT, we can create an empty profile stub
                    // or handle it in a separate onboarding step. 
                    // For now, we just create the User identity.
                }
            });

            // B. Create Role Profile if requested
            if (initialRole === 'EXPERT') {
                await tx.expertProfile.create({
                    data: {
                        userId: user.id,
                        headline: 'New Expert', // Placeholder
                        specialties: []
                    }
                });
            } else if (initialRole === 'ORGANIZATION') {
                await tx.organizationProfile.create({
                    data: { userId: user.id, companyName: `${name}'s Company` }
                });
            }

            return user;
        });

        try {
            await sendVerificationEmail(email, emailToken);
        } catch (error) {
            request.log.error(error);
        }

        return reply.status(201).send({
            message: 'Account created. Please check your email to verify.',
        });
    });

    // LOGIN ROUTE
    fastify.post<{ Body: LoginRequest }>('/login', { schema: loginSchema }, async (request, reply) => {
        const { email, password } = request.body;

        // 1. Find User & Fetch Roles
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                expertProfile: true,
                organizationProfile: true,
                adminProfile: true
            }
        });

        if (!user || !user.passwordHash) {
            // Security: Generic error message to prevent email enumeration
            return reply.status(401).send({ message: 'Invalid credentials' });
        }

        // [>>> INSERT THIS BLOCK <<<]
        // CHECK 1: Is account deleted? (Soft Delete)
        if (user.deletedAt) {
            return reply.status(403).send({ message: 'Account is disabled or deleted.' });
        }

        if (!user.emailVerifiedAt) {
            return reply.status(403).send({
                message: 'Email not verified. Please check your inbox.',
                isUnverified: true
            });
        }

        // 2. Verify Password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return reply.status(401).send({ message: 'Invalid credentials' });
        }

        // 3. Generate Access Token (JWT) - Short Lived (15m)
        // Payload: Minimal info for the UI to render correctly
        const accessToken = fastify.jwt.sign({
            id: user.id,
            roles: {
                isExpert: !!user.expertProfile,
                isOrg: !!user.organizationProfile,
                isAdmin: !!user.adminProfile
            }
        }, { expiresIn: '15m' });

        // 4. Generate Refresh Token - Long Lived (7d)
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        // 5. Save Session to DB
        await prisma.refreshSession.create({
            data: {
                userId: user.id,
                tokenHash: refreshTokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || 'unknown'
            }
        });

        // 6. Set Cookies (The Gold Standard)

        // Cookie A: Access Token (Strict security)

        reply.setCookie('accessToken', accessToken, {
            path: '/',
            domain: cookieDomain,
            httpOnly: true, // JavaScript cannot read this (Anti-XSS)
            secure: isProduction,  // Set to TRUE in production (HTTPS)
            sameSite: 'lax',
            maxAge: 15 * 60 // 15 minutes
        });

        // Cookie B: Refresh Token (Only sent to refresh endpoint)
        reply.setCookie('refreshToken', refreshToken, {
            path: '/api/auth/refresh', // Security: Only send this to the refresh route!
            domain: cookieDomain,
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 // 7 days
        });

        // 7. Return User DTO (No tokens in body!)
        const userDto = {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
            roles: {
                isExpert: !!user.expertProfile,
                isOrganization: !!user.organizationProfile,
                isAdmin: !!user.adminProfile
            },
            preferences: {
                theme: user.themePreference,
                notifications: user.emailNotificationsEnabled
            }
        };

        return reply.status(200).send({
            message: 'Login successful',
            user: userDto
        } as AuthResponse);
    });

    // GOOGLE IDENTITY SWAP (Gold Standard)
    // GOOGLE IDENTITY SWAP ROUTE
    fastify.post<{ Body: { idToken: string } }>('/google', async (request, reply) => {
        const { idToken } = request.body;

        // 1. Verify the Google Token
        let ticket;
        try {
            ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
        } catch (err) {
            return reply.status(401).send({ message: 'Invalid Google Token' });
        }

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return reply.status(400).send({ message: 'Incomplete Google Profile' });
        }

        const { email, sub: googleId, name, picture } = payload;

        // 2. Find or Create User
        let user = await prisma.user.findUnique({
            where: { googleId },
            include: { expertProfile: true, organizationProfile: true, adminProfile: true }
        });

        if (!user) {
            // Account Linking: Check if email exists
            const existingEmailUser = await prisma.user.findUnique({
                where: { email },
                include: { expertProfile: true, organizationProfile: true, adminProfile: true }
            });

            if (existingEmailUser) {
                // Link Google to existing account
                user = await prisma.user.update({
                    where: { id: existingEmailUser.id },
                    data: {
                        googleId,
                        avatarUrl: existingEmailUser.avatarUrl || picture,
                        emailVerifiedAt: new Date() // Trust Google verification
                    },
                    include: { expertProfile: true, organizationProfile: true, adminProfile: true }
                });
            } else {
                // Create New User
                const username = await generateUniqueUsername();
                user = await prisma.user.create({
                    data: {
                        email,
                        name: name || 'Google User',
                        username,
                        googleId,
                        avatarUrl: picture,
                        emailVerifiedAt: new Date(),
                        promotionalEmailsEnabled: false
                    },
                    include: { expertProfile: true, organizationProfile: true, adminProfile: true }
                });
            }
        }

        // 3. Security Check
        if (user.deletedAt) {
            return reply.status(403).send({ message: 'Account is disabled.' });
        }

        // 4. Generate Tokens
        const accessToken = fastify.jwt.sign({
            id: user.id,
            roles: {
                isExpert: !!user.expertProfile,
                isOrg: !!user.organizationProfile,
                isAdmin: !!user.adminProfile
            }
        }, { expiresIn: '15m' });

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        await prisma.refreshSession.create({
            data: {
                userId: user.id,
                tokenHash: refreshTokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || 'unknown'
            }
        });

        // 5. Set Cookies (Production Ready)
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieDomain = isProduction ? '.digitaloffices.com.au' : undefined;

        reply.setCookie('accessToken', accessToken, {
            path: '/',
            domain: cookieDomain, // Allows subdomains
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 15 * 60
        });

        reply.setCookie('refreshToken', refreshToken, {
            path: '/api/auth/refresh',
            domain: cookieDomain,
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60
        });

        return reply.status(200).send({
            message: 'Google Login Successful',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
                roles: {
                    isExpert: !!user.expertProfile,
                    isOrganization: !!user.organizationProfile,
                    isAdmin: !!user.adminProfile
                },
                preferences: {
                    theme: user.themePreference,
                    notifications: user.emailNotificationsEnabled
                }
            }
        });
    });

    fastify.post<{ Body: VerifyEmailRequest }>('/verify-email', async (request, reply) => {
        const { token } = request.body;

        const user = await prisma.user.findUnique({
            where: { emailVerificationToken: token }
        });

        if (!user) {
            return reply.status(400).send({ message: 'Invalid or expired token' });
        }

        // Check 2: Token expired?
        if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
            return reply.status(400).send({
                message: 'Token expired. Please request a new one.',
                code: 'TOKEN_EXPIRED' // Frontend can use this to show "Resend" button
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerifiedAt: new Date(),
                emailVerificationToken: null,
                emailVerificationExpiresAt: null // Clear the expiry
            }
        });

        return reply.status(200).send({
            message: 'Email verified successfully. You may now login.'
        });
    });

    // REFRESH ROUTE (The Gold Standard Rotation Logic)
    fastify.post('/refresh', async (request, reply) => {
        const refreshToken = request.cookies.refreshToken;
        if (!refreshToken) return reply.status(401).send({ message: 'No refresh token' });

        // 1. Hash the token to find it in DB
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const session = await prisma.refreshSession.findUnique({
            where: { tokenHash },
            include: { user: { include: { expertProfile: true, organizationProfile: true, adminProfile: true } } }
        });

        // 2. Security: If session invalid or expired
        if (!session || session.expiresAt < new Date()) {
            // Optional: Delete expired session if found
            if (session) await prisma.refreshSession.delete({ where: { id: session.id } });

            reply.clearCookie('accessToken');
            reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
            return reply.status(401).send({ message: 'Session expired' });
        }

        // 3. Detect Reuse / Rotation (Optional but Recommended)
        // If you implement strict rotation, you delete the old session and create a new one here.
        // For now, we will just issue a new Access Token.

        await prisma.refreshSession.delete({ where: { id: session.id } });

        // B. Generate NEW Refresh Token (Rotate)
        const { user } = session;
        const newRefreshToken = crypto.randomBytes(40).toString('hex');
        const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

        // C. Create NEW Session
        await prisma.refreshSession.create({
            data: {
                userId: user.id,
                tokenHash: newRefreshTokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || 'unknown'
            }
        });


        // 4. Generate New Access Token
        const newAccessToken = fastify.jwt.sign({
            id: user.id,
            roles: {
                isExpert: !!user.expertProfile,
                isOrg: !!user.organizationProfile,
                isAdmin: !!user.adminProfile
            }
        }, { expiresIn: '15m' });


        // C. Store New Session
        await prisma.refreshSession.create({
            data: {
                userId: user.id,
                tokenHash: newRefreshTokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || 'unknown'
            }
        });

        // D. Set New Refresh Cookie
        reply.setCookie('refreshToken', newRefreshToken, {
            path: '/api/auth/refresh',
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60
        });

        // E. Set New Access Cookie
        reply.setCookie('accessToken', newAccessToken, {
            path: '/',
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 15 * 60
        });

        return reply.status(200).send({ message: 'Token refreshed' });
    });

    // LOGOUT ROUTE
    fastify.post('/logout', async (request, reply) => {
        const refreshToken = request.cookies.refreshToken;

        // 1. Remove from DB if exists
        if (refreshToken) {
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            // Use deleteMany to avoid error if it doesn't exist
            await prisma.refreshSession.deleteMany({ where: { tokenHash } });
        }

        // 2. Clear Cookies
        reply.clearCookie('accessToken', { path: '/' });
        reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });

        return reply.status(200).send({ message: 'Lxogged out successfully' });
    });

    fastify.post<{ Body: { email: string } }>('/resend-verification', {
        // GOLD STANDARD: Strict Rate Limiting for Email Triggers
        config: {
            rateLimit: {
                max: 3,             // Only 3 attempts...
                timeWindow: '1 hour' // ...per hour per IP
            }
        }
    }, async (request, reply) => {
        const { email } = request.body;

        const user = await prisma.user.findUnique({ where: { email } });

        // Security: Always return 200 OK even if email not found (prevents enumeration)
        // Only proceed if user exists AND is not verified
        if (user && !user.emailVerifiedAt) {

            // 1. Generate NEW Token
            const newToken = crypto.randomBytes(32).toString('hex');
            const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

            // 2. Update DB
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    emailVerificationToken: newToken,
                    emailVerificationExpiresAt: newExpiry
                }
            });

            // 3. Send Email
            try {
                await sendVerificationEmail(user.email, newToken);
            } catch (error) {
                request.log.error(error, 'Failed to send verification email');
                // Ideally, don't crash request, just log it.
            }
        }

        return reply.status(200).send({
            message: 'If an unverified account exists with this email, a new link has been sent.'
        });
    });

    // DELETE ACCOUNT (GDPR Compliant Soft Delete)
    fastify.delete('/me',{
        onRequest: [authenticate] // Cleaner and consistent
    }, async (request, reply) => {
        // 1. Authenticate
        try {
            await request.jwtVerify();
        } catch (err) {
            return reply.status(401).send({ message: 'Unauthorized' });
        }

        const user = request.user as { id: string };

        // 2. Perform Anonymization Transaction
        await prisma.$transaction(async (tx) => {
            // Check if already deleted
            const existing = await tx.user.findUnique({ where: { id: user.id } });
            if (!existing || existing.deletedAt) {
                // Should technically be 404, but 200 is safer for idempotency
                return;
            }

            // Anonymize PII (Gold Standard Pattern)
            // We append a timestamp/UUID to ensure the "deleted" values are also unique
            const anonymizedSuffix = `deleted_${crypto.randomBytes(8).toString('hex')}`;

            await tx.user.update({
                where: { id: user.id },
                data: {
                    // SCRAMBLE UNIQUE PII
                    name: 'Deleted User',
                    email: `${anonymizedSuffix}@deleted.local`, // Frees up real email
                    username: anonymizedSuffix,                 // Frees up real username

                    // CLEAR OPTIONAL UNIQUE/SENSITIVE FIELDS
                    avatarUrl: null,
                    googleId: null,             // Crucial: allows re-linking Google later
                    passwordHash: null,         // Security: cannot login even if restored

                    // CLEAR TOKENS
                    emailVerificationToken: null,
                    passwordResetToken: null,
                    refreshSessions: { deleteMany: {} }, // Kill all active sessions

                    // MARK DELETED
                    deletedAt: new Date(),
                }
            });

            // OPTIONAL: Cancel future bookings or other cleanup logic here
        });

        // 3. Clear Cookies
        reply.clearCookie('accessToken');
        reply.clearCookie('refreshToken');

        return reply.status(200).send({
            message: 'Account deleted successfully. Your data has been anonymized.'
        });
    });

}