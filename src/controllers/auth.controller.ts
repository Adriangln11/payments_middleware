import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import prisma from '../config/database';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      logger.info('Login attempt', { email });


      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        logger.warn('Login failed: User not found', { email });
        return res.status(401).json({ error: 'Invalid credentials' });
      }


      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('Login failed: Invalid password', { email });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      logger.info('Login successful', {
        userId: user.id,
        email: user.email,
      });

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });

    } catch (error) {
      logger.error('Error during login', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async verifyToken(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const decoded = jwt.verify(token, jwtSecret) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      return res.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });

    } catch (error) {
      logger.warn('Token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}