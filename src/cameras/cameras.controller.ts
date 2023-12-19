import { Controller, Get, HttpException, HttpStatus, Logger, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from 'src/reports/reports.service';
import { CameraDetails, CameraWithAreaName } from 'src/types';
import { z } from 'zod';
import { CamerasService } from './cameras.service';

@Controller('cameras')
export class CamerasController {
  constructor(
    private readonly camerasService: CamerasService,
    private readonly reportsService: ReportsService,
  ) { }

  private readonly logger = new Logger(CamerasService.name);

  @Get()
  async getCameras(
    @Req() request: Request
  ) {
    try {
      // TODO: Use sessions for client fingerprinting.
      // TODO: Move clientId and createTransaction into middleware.
      const clientId = `${request.ip}_${request.headers['user-agent']}`

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
      this.logger.debug(`Requesting data for timestamp: ${timestamp}`)
      
      // TODO: Refactor into caching middleware
      // Fetch from cache first. If no data is available,
      // then run the indexer and refetch from cache.
      let cameras: CameraWithAreaName[]

      try {
        this.logger.debug('Trying to fetch cached data from db.')
        cameras = await this.camerasService.fetchCamerasFromDb(timestamp)
        this.logger.debug('Returning cached data.')
      } catch (error) {
        this.logger.debug(error)
        this.logger.debug('No cached data found for requested timestamp. Indexing fresh data.')
        const freshData = await this.camerasService.fetchDataForTimestamp(timestamp)

        // TODO: Move cache writing to a messaging queue so user doesn't wait for DB calls.
        // TODO: Change this to just compute the result on-the-fly from freshData
        await this.camerasService.cacheAllDataToDb(timestamp, freshData)
        cameras = await this.camerasService.fetchCamerasFromDb(timestamp)

      }

      // TODO: Move to messaging queue
      await this.reportsService.createTransaction({
        clientId,
        queryTimestamp: new Date(timestamp),
        path: request.path,
        params: { }
      })

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
      // TODO: Use sessions for client fingerprinting.
      // TODO: Move clientId and createTransaction into middleware.
      const clientId = `${request.ip}_${request.headers['user-agent']}`

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
      this.logger.debug(`Requesting data for timestamp: ${timestamp} cameraId: ${cameraId}`)

      // TODO: Refactor into caching middleware
      // Fetch from cache first. If no data is available,
      // then run the indexer and refetch from cache.
      let cameraDetails: CameraDetails

      try {
        this.logger.debug('Trying to fetch cached data from db.')
        cameraDetails = await this.camerasService.fetchCameraDetailsFromDb(timestamp, cameraId)
        this.logger.debug('Returning cached data.')
      } catch (error) {
        this.logger.debug(error)
        this.logger.debug('No cached data found for requested timestamp. Indexing fresh data.')
        const freshData = await this.camerasService.fetchDataForTimestamp(timestamp)

        // TODO: Move cache writing to a messaging queue so user doesn't wait for DB calls.
        // TODO: Change this to just compute the result on-the-fly from freshData
        await this.camerasService.cacheAllDataToDb(timestamp, freshData)
        cameraDetails = await this.camerasService.fetchCameraDetailsFromDb(timestamp, cameraId)
      }

      // TODO: Move to messaging queue
      await this.reportsService.createTransaction({
        clientId,
        queryTimestamp: new Date(timestamp),
        path: request.path,
        params: { 
          latitude: cameraDetails.camera.location.latitude,
          longitude: cameraDetails.camera.location.longitude,
          weather_forecast: cameraDetails.weather_forecast,
          area_name: cameraDetails.camera.area_name,
          md5: cameraDetails.camera.image_metadata.md5,
        }
      })

      return cameraDetails
    } catch (error) {
      this.logger.error(error)
      throw new HttpException('INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
