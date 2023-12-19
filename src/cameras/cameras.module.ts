import { Module } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CamerasController } from './cameras.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportsService } from 'src/reports/reports.service';

@Module({
  imports: [HttpModule],
  providers: [CamerasService,  PrismaService, ReportsService],
  controllers: [CamerasController]
})
export class CamerasModule {}
