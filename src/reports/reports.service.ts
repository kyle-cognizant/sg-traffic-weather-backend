import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService
  ) { }

  private readonly logger = new Logger(ReportsService.name);

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
