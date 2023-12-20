import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService
  ) { }

  private readonly logger = new Logger(ReportsService.name);

  public async fetchRecentCameraLookups({
    take = 10
  } : {
    take: number
  }) {
    this.logger.debug(`Fetching recent camera lookups`)
    const recentTransactions = await this.prisma.transaction.findMany({
      take,
      where: {
        path: {
          startsWith: '/cameras/'
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return recentTransactions
  }

  public async fetchTopQueriesWithinTimeRange({
    take = 10,
    start,
    end,
  } : {
    take: number
    start: Date
    end: Date
  }) {
    // TODO
  }

  public async fetchTopPeriodWithinTimeRange({
    periodMs = 1_000 * 60 * 60, // 1 hour
    start,
    end,
  } : {
    periodMs: number
    start: Date
    end: Date
  }) {
    // TODO
  }

  public async createTransaction(transaction: Prisma.TransactionCreateInput) {
    this.logger.debug('Creating transaction')

    const newTransaction = await this.prisma.transaction.create({
      data: {
        ...transaction,
        path: transaction.path.replace(/\/+$/, ''), // remove trailing slash
      }
    })

    return newTransaction
  }
}
