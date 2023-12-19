import { Controller, Get, HttpException, HttpStatus, Param, Req } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CameraDetails, CameraWithAreaName } from 'src/types';
import { z } from 'zod';
import { Request } from 'express';

@Controller('cameras')
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) { }

  @Get()
  async getCameras(
    @Req() request: Request
  ) {
    try {
      const paramsSchema = z.object({
        timestamp: z.number().min(0) // Change this to the max lookback period
      })

      // TODO: Refactor into validation middleware
      const validatedParams = paramsSchema.safeParse({
        timestamp: Number(request.query.timestamp),
      })
            
      if (!validatedParams.success) {
        throw new HttpException(validatedParams.error.issues, 400)
      }

      const { timestamp } = validatedParams.data
    
      // Fetch from cache first. If no data is available,
      // then run the indexer and refetch from cache.
      // TODO: Refactor into caching middleware
      let cameras: CameraWithAreaName[]
      try {
        cameras = await this.camerasService.fetchCameras(timestamp)
      } catch (error) {
        await this.camerasService.runIndexerForTimestamp(timestamp)
        cameras = await this.camerasService.fetchCameras(timestamp)
      }

      return cameras
    } catch (error) {
      console.error(error)
      throw new HttpException('INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(':camera_id')
  async getCameraDetails(
    @Param('camera_id') camera_id: string,
    @Req() request: Request,
  ) {
    const paramsSchema = z.object({
      timestamp: z.number().min(0), // Change this to the max lookback period
      cameraId: z.string(),
    })

    // TODO: Refactor into validation middleware
    const validatedParams = paramsSchema.safeParse({
      timestamp: Number(request.query.timestamp),
      cameraId: camera_id
    })
        
    if (!validatedParams.success) { 
      throw new HttpException(validatedParams.error.issues, 400)
    }

    const { timestamp, cameraId } = validatedParams.data

    // Fetch from cache first. If no data is available,
    // then run the indexer and refetch from cache.
    // TODO: Refactor into caching middleware
    let cameraDetails: CameraDetails
      try {
        cameraDetails = await this.camerasService.fetchCameraDetails(timestamp, cameraId)
      } catch (error) {
        await this.camerasService.runIndexerForTimestamp(timestamp)
        cameraDetails = await this.camerasService.fetchCameraDetails(timestamp, cameraId)
      }

    return cameraDetails
  }
}
