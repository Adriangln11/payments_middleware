import { Request, Response } from 'express';
import logger from '../config/logger';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AdminController {
  static async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      logger.info('Getting dashboard stats', { userId: req.user?.id });


      const [totalTransactions, completedTransactions, pendingTransactions, failedTransactions] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: 'completed' } }),
        prisma.order.count({ where: { status: { in: ['pending', 'processing'] } } }),
        prisma.order.count({ where: { status: { in: ['failed', 'cancelled'] } } }),
      ]);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const transactionsByDay = await prisma.order.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          id: true,
        },
      });

      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const count = await prisma.order.count({
          where: {
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        });

        chartData.push({
          date: dayStart.toISOString().split('T')[0],
          count,
        });
      }

      const recentTransactions = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          jumpsellerReference: true,
          shopName: true,
          originalAmount: true,
          originalCurrency: true,
          status: true,
          paymentGateway: true,
          createdAt: true,
        },
      });

      return res.json({
        stats: {
          totalTransactions,
          completedTransactions,
          pendingTransactions,
          failedTransactions,
        },
        chartData,
        recentTransactions,
      });

    } catch (error) {
      logger.error('Error getting dashboard stats', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        gateway,
        reference,
        startDate,
        endDate,
      } = req.query as Record<string, string>;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      logger.info('Getting transactions', {
        userId: req.user?.id,
        page: pageNum,
        limit: limitNum,
        filters: { status, gateway, reference, startDate, endDate },
      });


      const where: any = {};

      if (status && status !== 'all') {
        where.status = status;
      }

      if (gateway && gateway !== 'all') {
        where.paymentGateway = {
          contains: gateway,
        };
      }

      if (reference) {
        where.jumpsellerReference = {
          contains: reference,
          mode: 'insensitive',
        };
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }


      const [transactions, totalCount] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum,
          select: {
            id: true,
            jumpsellerReference: true,
            shopName: true,
            originalAmount: true,
            originalCurrency: true,
            convertedAmount: true,
            convertedCurrency: true,
            status: true,
            paymentGateway: true,
            gatewayTransactionId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.order.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      return res.json({
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      });

    } catch (error) {
      logger.error('Error getting transactions', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTransactionDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { transactionId } = req.params;

      logger.info('Getting transaction details', {
        userId: req.user?.id,
        transactionId,
      });

      const transaction = await prisma.order.findUnique({
        where: { id: transactionId },
        include: {
          logs: {
            orderBy: { createdAt: 'desc' },
          },
          callbacks: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      return res.json(transaction);

    } catch (error) {
      logger.error('Error getting transaction details', {
        userId: req.user?.id,
        transactionId: req.params.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getGatewayConfigs(req: AuthenticatedRequest, res: Response) {
    try {
      logger.info('Getting gateway configurations', { userId: req.user?.id });

      const configs = await prisma.gatewayConfig.findMany({
        orderBy: [
          { shopName: 'asc' },
          { gatewayType: 'asc' },
          { countryCode: 'asc' },
        ],
        select: {
          id: true,
          shopName: true,
          gatewayType: true,
          countryCode: true,
          currency: true,
          isActive: true,
          createdAt: true,
        },
      });

      return res.json({ configs });

    } catch (error) {
      logger.error('Error getting gateway configurations', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateGatewayConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const { configId } = req.params;
      const { isActive } = req.body;

      logger.info('Updating gateway configuration', {
        userId: req.user?.id,
        configId,
        isActive,
      });

      const updatedConfig = await prisma.gatewayConfig.update({
        where: { id: configId },
        data: { isActive },
        select: {
          id: true,
          shopName: true,
          gatewayType: true,
          countryCode: true,
          currency: true,
          isActive: true,
          createdAt: true,
        },
      });

      return res.json({ config: updatedConfig });

    } catch (error) {
      logger.error('Error updating gateway configuration', {
        userId: req.user?.id,
        configId: req.params.configId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}