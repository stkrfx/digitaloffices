import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../db/index.js';
import { generateUniqueUsername } from '../../utils/username.js';
import { RegisterRequest, LoginRequest, AuthResponse, UserRole, VerifyEmailRequest } from '@shared/types';
import { sendVerificationEmail } from '../../utils/mailer.js';
import { validateEmailStrict } from '../../utils/emailValidator.js';

export default async function authRoutes(fastify: FastifyInstance) {

    // REGISTER ROUTE
    fastify.post<{ Body: RegisterRequest }>('/register', async (request, reply) => {
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
                    emailVerifiedAt: null, // does putting this null thing here should be done as per the gold standard or no??????
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
    fastify.post<{ Body: LoginRequest }>('/login', async (request, reply) => {
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
            httpOnly: true, // JavaScript cannot read this (Anti-XSS)
            secure: false,  // Set to TRUE in production (HTTPS)
            sameSite: 'lax',
            maxAge: 15 * 60 // 15 minutes
        });

        // Cookie B: Refresh Token (Only sent to refresh endpoint)
        reply.setCookie('refreshToken', refreshToken, {
            path: '/api/auth/refresh', // Security: Only send this to the refresh route!
            httpOnly: true,
            secure: false,
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

    fastify.post<{ Body: VerifyEmailRequest }>('/verify-email', async (request, reply) => {
        const { token } = request.body;

        const user = await prisma.user.findUnique({
            where: { emailVerificationToken: token }
        });

        if (!user) {
            return reply.status(400).send({ message: 'Invalid or expired token' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerifiedAt: new Date(),
                emailVerificationToken: null
            }
        });

        return reply.status(200).send({
            message: 'Email verified successfully. You may now login.'
        });
    });

}