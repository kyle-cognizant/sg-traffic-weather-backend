import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CamerasModule } from './cameras/cameras.module';
import { ReportsModule } from './reports/reports.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [CamerasModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
