import type { Request, Response } from 'express';
import {registerSchema} from '../../schema/auth.t'
import {db} from '../../prisma/db'
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';


export const register = async (req: Request, res: Response) => {
    try {
        
        const schema = registerSchema.safeParse(req.body);

        if (!schema.success) {
            return res.status(400).json({
                error: 'Invalid request data',
            });
        }

        const { email, password } = schema.data;

        // Check existing user
        const existingUser = await db.orm.users
            .where({ email })
            .first();

        if (existingUser) {
            return res.status(409).json({
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const newUser = await db.orm.users.create({
            email,
            password: hashedPassword
        });

        // Check JWT secrets
        const accessSecret = process.env.ACCESS_TOKEN_SECRET;
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

        if (!accessSecret || !refreshSecret) {
            throw new Error('JWT secrets are not configured');
        }

        // Generate refresh token
        const refreshToken = jsonwebtoken.sign(
            {
                id: newUser.id,
                email: newUser.email,
                type: 'refresh'
            },
            refreshSecret,
            { expiresIn: '7d' }
        );

        // Hash refresh token
        const hashedRefreshToken = crypto
            .createHash('sha256')
            .update(refreshToken)
            .digest('hex');

        // Store refresh token in database
        await db.orm.refresh_tokens.create({
            userId: newUser.id,
            token: hashedRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
        });

        // Generate access token
        const accessToken = jsonwebtoken.sign(
            {
                id: newUser.id,
                email: newUser.email,
                type: 'access'
            },
            accessSecret,
            { expiresIn: '15m' }
        );

        // Remove password from response
        const { password: _, ...safeUser } = newUser;

        // Send response
        return res.status(201).json({
            message: 'User registered successfully',
            user: safeUser,
            tokens: {
                accessToken,
                refreshToken
            }
        });

    } catch (err: any) {
        console.error('Registration error:', err);

        return res.status(500).json({
            error: 'Registration failed'
        });
    }
};
