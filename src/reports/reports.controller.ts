import { Controller, Get, HttpException, HttpStatus, Logger, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) { }

  private readonly logger = new Logger(ReportsService.name);

  @Get('recent')
  async getRecentSearches(
    @Req() request: Request
  ) {
    try {
      const results = await this.reportsService.fetchRecentCameraLookups({ take: 10 })
      return results
    } catch (error) {
      this.logger.error(error)
      throw new HttpException('INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
