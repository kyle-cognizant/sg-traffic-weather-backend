import { Logger, Controller, Get, HttpException, HttpStatus, Param, Req } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CameraDetails, CameraWithAreaName } from 'src/types';
import { z } from 'zod';
import { Request } from 'express';

@Controller('cameras')
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) { }

  private readonly logger = new Logger(CamerasService.name);

  @Get()
  async getCameras(
    @Req() request: Request
  ) {
    try {
      // TODO: Refactor into validation middleware
      const paramsSchema = z.object({
        timestamp: z.number().min(0) // Change this to the max lookback period
      })

      const validatedParams = paramsSchema.safeParse({
        timestamp: Number(request.query.timestamp),
      })
            
      if (!validatedParams.success) {
        throw new HttpException(validatedParams.error.issues, 400)
      }

      const { timestamp } = validatedParams.data
      this.logger.debug(validatedParams.data)
      
      // TODO: Refactor into caching middleware
      // Fetch from cache first. If no data is available,
      // then run the indexer and refetch from cache.
      let cameras: CameraWithAreaName[]

      try {
        this.logger.debug('Trying to fetch cached data from db.')
        cameras = await this.camerasService.fetchCameras(timestamp)
        this.logger.debug('Found cached data.')
      } catch (error) {
        this.logger.debug(error)
        this.logger.debug('No cached data found for requested timestamp. Indexing fresh data.')
        const freshData = await this.camerasService.fetchAllDataForTimestamp(timestamp)

        // TODO: Move cache writing to a messaging queue so user doesn't wait for DB calls.
        await this.camerasService.cacheAllDataToDb(timestamp, freshData)

        // TODO: Change this to just compute the result on-the-fly from freshData
        cameras = await this.camerasService.fetchCameras(timestamp)
      }

      return cameras
    } catch (error) {
      this.logger.error(error)
      throw new HttpException('INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(':camera_id')
  async getCameraDetails(
    @Param('camera_id') camera_id: string,
    @Req() request: Request,
  ) {
    try {
      // TODO: Refactor into validation middleware
      const paramsSchema = z.object({
        timestamp: z.number().min(0), // Change this to the max lookback period
        cameraId: z.string(),
      })

      const validatedParams = paramsSchema.safeParse({
        timestamp: Number(request.query.timestamp),
        cameraId: camera_id
      })
          
      if (!validatedParams.success) { 
        throw new HttpException(validatedParams.error.issues, 400)
      }

      const { timestamp, cameraId } = validatedParams.data
      this.logger.debug(validatedParams.data)

      // TODO: Refactor into caching middleware
      // Fetch from cache first. If no data is available,
      // then run the indexer and refetch from cache.
      let cameraDetails: CameraDetails

      try {
        this.logger.debug('Trying to fetch cached data from db.')
        cameraDetails = await this.camerasService.fetchCameraDetails(timestamp, cameraId)
        this.logger.debug('Found cached data.')
      } catch (error) {
        this.logger.debug(error)
        this.logger.debug('No cached data found for requested timestamp. Indexing fresh data.')
        const freshData = await this.camerasService.fetchAllDataForTimestamp(timestamp)

        // TODO: Move cache writing to a messaging queue so user doesn't wait for DB calls.
        await this.camerasService.cacheAllDataToDb(timestamp, freshData)

        // TODO: Change this to just compute the result on-the-fly from freshData
        cameraDetails = await this.camerasService.fetchCameraDetails(timestamp, cameraId)
      }

      return cameraDetails
    } catch (error) {
      this.logger.error(error)
      throw new HttpException('INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
