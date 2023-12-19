import { Controller, Get, HttpException, Param, Req } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { z } from 'zod';
import { Request } from 'express';

@Controller('cameras')
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) { }

  @Get()
  async getCameras(
    @Req() request: Request
  ) {
    const paramsSchema = z.object({
      timestamp: z.number().min(0) // Change this to the max lookback period
    })

    const validatedParams = paramsSchema.safeParse({
      timestamp: Number(request.query.timestamp),
    })
    
    console.log({ validatedParams })
    
    if (!validatedParams.success) {
      throw new HttpException(validatedParams.error.issues, 400)
    }

    const { timestamp } = validatedParams.data

    const cameras = await this.camerasService.fetchCameras(timestamp)

    return {
      cameras,
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

    const validatedParams = paramsSchema.safeParse({
      timestamp: Number(request.query.timestamp),
      cameraId: camera_id
    })
    
    console.log({ validatedParams })
    
    if (!validatedParams.success) { 
      throw new HttpException(validatedParams.error.issues, 400)
    }

    const { timestamp, cameraId } = validatedParams.data

    const cameraDetails = await this.camerasService.fetchCameraDetails(timestamp, cameraId)

    return {
      ...cameraDetails
    }
  }
}
