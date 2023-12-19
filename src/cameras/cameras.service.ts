import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { CameraDetails, CameraWithAreaName, Coordinates, GovTrafficCamApiData, GovWeatherApiData } from 'src/types';
import { PrismaService } from '../prisma/prisma.service';
import { CameraImage } from '@prisma/client';

@Injectable()
export class CamerasService {
  constructor(
    private readonly httpService: HttpService,
    private prisma: PrismaService
  ) { }

  // fetch list of cameras from postgres
  public async fetchCameras(timestamp: number): Promise<CameraWithAreaName[]> {
    const cameras = await this.prisma.camera.findMany({
      where: {
        earliestTimestamp: {
          lte: new Date(timestamp)
        }
      },
      include: {
        area: true
      }
    })

    const cameraImages: CameraImage[] = []
    for (const camera of cameras) {
      // Do this sequentially because using Promise.all 
      // will result in too many DB calls at once.
      const cameraImage = await this.prisma.cameraImage.findFirst({
        where: {
          cameraId: camera.id, // TODO: find at given timestamp
        }
      })

      if (!cameraImage) throw new Error('CAMERA_IMAGE_NOT_FOUND')
      cameraImages.push(cameraImage)
    }

    return cameras.map((camera, index) => {
      const cameraImage = cameraImages[index]
      return {
        camera_id: camera.cameraId,
        area_name: camera.area.name,
        location: {
          longitude: camera.longitude,
          latitude: camera.latitude,
        },
        timestamp: this.getFormattedDate(cameraImage.imageTimestamp),
        image: cameraImage.imageUrl,
        image_metadata: {
          width: cameraImage.width,
          height: cameraImage.height,
        }
      }
    })
  }

  // fetch camera details from postgres
  public async fetchCameraDetails(timestamp: number, cameraId: string): Promise<CameraDetails> {
    const camera = await this.prisma.camera.findFirst({ where: { cameraId }, include: { area: true } })
    if (!camera) throw new HttpException('CAMERA_NOT_FOUND', HttpStatus.NOT_FOUND)

    const [
      cameraImage,
      weatherForecast
    ] = await Promise.all([
      this.prisma.cameraImage.findFirst({ where: { cameraId: camera.id } }), // TODO: find at given timestamp 
      this.prisma.weatherForecast.findFirst({ where: { areaId: camera.areaId } }), // TODO: find at given timestamp
    ])

    if (!cameraImage) throw new HttpException('CAMERA_IMAGE_NOT_FOUND', HttpStatus.NOT_FOUND)
    if (!weatherForecast) throw new HttpException('WEATHER_FORECAST_NOT_FOUND', HttpStatus.NOT_FOUND)

    return {
      camera: {
        camera_id: camera.cameraId,
        area_name: camera.area.name,
        location: {
          longitude: camera.longitude,
          latitude: camera.latitude,
        },
        timestamp: this.getFormattedDate(cameraImage.imageTimestamp),
        image: cameraImage.imageUrl,
        image_metadata: {
          width: cameraImage.width,
          height: cameraImage.height,
        }
      },
      weather_forecast: weatherForecast.forecast
    }
  }

  // indexes all data for a given timestamp
  private async runIndexerForTimestamp({
    timestamp
  }: {
    timestamp: number
  }): Promise<any> {
    const [
      trafficCamsApiData,
      weatherApiData,
    ] = await Promise.all([
      this.fetchGovTrafficCamApiData(timestamp),
      this.fetchGovWeatherApiData(timestamp),
    ])

    const areas = weatherApiData.area_metadata.map(area => ({
      name: area.name,
      latitude: area.label_location.latitude,
      longitude: area.label_location.longitude,
    }))

    const weatherForecasts = weatherApiData.items[0].forecasts.map(({ area, forecast }) => ({
      timestamp,
      forecast,
      area,
    }))

    const {
      cameras,
      cameraImages
    } = trafficCamsApiData.items[0].cameras.reduce((results, camera) => {
      return {
        cameras: [
          ...results.cameras,
          {
            cameraId: camera.camera_id,
            latitude: camera.location.latitude,
            longitude: camera.location.longitude,
          }
        ],
        cameraImages: [
          ...results.cameraImages,
          {
            timestamp: camera.timestamp,
            imageUrl: camera.image,
            width: camera.image_metadata.width,
            height: camera.image_metadata.height,
          }
        ],
      }
    }, {
      cameras: [],
      cameraImages: [],
    })

    // TODO: Replace this with DB mutations
    return {
      areas,
      weatherForecasts,
      cameras,
      cameraImages
    }
  }

  // fetch data from data.gov.sg traffic cam api
  private async fetchGovTrafficCamApiData(timestamp: number): Promise<GovTrafficCamApiData> {
    const date_time = this.getFormattedDate(timestamp)

    const { data } = await this.httpService.axiosRef.get<GovTrafficCamApiData>(
      `https://api.data.gov.sg/v1/transport/traffic-images?date_time=${date_time}`
    )

    // TODO: Add axios error handling
    return data
  }

  // fetch data from data.gov.sg weather forecast api
  private async fetchGovWeatherApiData(timestamp: number): Promise<GovWeatherApiData> {
    const date_time = this.getFormattedDate(timestamp)

    const { data } = await this.httpService.axiosRef.get<GovWeatherApiData>(
      `https://api.data.gov.sg/v1/environment/2-hour-weather-forecast?date_time=${date_time}`
    )

    // TODO: Add axios error handling
    return data
  }

  // data.gov.sg api requires dates in a specific format
  private getFormattedDate(value: string | number | Date): string {
    return dayjs(value).format('YYYY-MM-DDTHH:mm:ss')
  }

  // returns the index of the nearest set of coordinates from a list, compared to a target point
  private getNearestCoordinatesIndex(target: Coordinates, locations: Coordinates[]): number {
    return locations.reduce((acc, curr, index) => {
      return (this.getHaversineDistance(target, curr) < this.getHaversineDistance(target, locations[acc])) ? index : acc
    }, 0)
  }

  // returns the distance between 2 sets of coordinates
  private getHaversineDistance(coords1: Coordinates, coords2: Coordinates): number {
    const lng1 = coords1.longitude;
    const lat1 = coords1.latitude;

    const lng2 = coords2.longitude;
    const lat2 = coords2.latitude;

    const R = 6371; // km

    const x1 = lat2 - lat1;
    const dLat = this.toRad(x1);

    const x2 = lng2 - lng1;
    const dLon = this.toRad(x2)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d;
  }

  // converts degrees to radians
  private toRad(n: number): number {
    return n * Math.PI / 180;
  }
}
