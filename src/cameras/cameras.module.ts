import { Module } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CamerasController } from './cameras.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [HttpModule],
  providers: [CamerasService, PrismaService],
  controllers: [CamerasController]
})
export class CamerasModule {}
