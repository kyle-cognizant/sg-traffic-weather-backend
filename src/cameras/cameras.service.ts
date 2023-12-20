import { HttpService } from '@nestjs/axios';
import { Logger, Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { Area, CameraDetails, CameraWithAreaName, Coordinates, GovTrafficCamApiData, GovWeatherApiData, IndexerResult, WeatherForecast } from 'src/types';
import { PrismaService } from '../prisma/prisma.service';
import { CameraImage, Prisma } from '@prisma/client';
import { AxiosError } from 'axios';

@Injectable()
export class CamerasService {
  constructor(
    private readonly httpService: HttpService,
    private prisma: PrismaService
  ) { }

  private readonly logger = new Logger(CamerasService.name);


  // fetches all data for a given timestamp
  public async fetchDataForTimestamp(timestamp: number): Promise<IndexerResult> {
    this.logger.debug(`Fetching fresh data for timestamp ${timestamp}`)

    try {
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

      const weatherForecasts = [ ...weatherApiData.items[0].forecasts ]
      const forecastTimestamp = weatherApiData.items[0].timestamp

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
              image: camera.image,
              image_metadata: {
                width: camera.image_metadata.width,
                height: camera.image_metadata.height,
                md5: camera.image_metadata.md5,
              }
            }
          ],
        }
      }, {
        cameras: [],
        cameraImages: [],
      })

      this.logger.debug({
        areas: areas.length,
        weatherForecasts: weatherForecasts.length,
        cameras: cameras.length,
        cameraImages: cameraImages.length,
        forecastTimestamp
      })

      return {
        areas,
        weatherForecasts,
        cameras,
        cameraImages,
        forecastTimestamp: weatherApiData.items[0].timestamp,
      }

    } catch (error) {
      this.logger.error(error)
      throw new Error('INDEXER_ERROR')
    }
  }

  // fetch list of cameras from postgres
  public async fetchCamerasFromDb(timestamp: number): Promise<CameraWithAreaName[]> {
    this.logger.debug('Fetching cameras from db.')
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

    if (cameras.length === 0) throw new Error('NO_CAMERAS_FOUND')

    const cameraImages: CameraImage[] = []
    for (const camera of cameras) {
      // Do this sequentially because using Promise.all 
      // will result in too many DB calls at once.
      const cameraImage = await this.prisma.cameraImage.findFirst({
        where: {
          cameraId: camera.id, // TODO: find at given timestamp
        }
      })

      if (!cameraImage) throw new Error('NO_CAMERA_IMAGE_FOUND')
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
          md5: cameraImage.md5,
        }
      }
    })
  }

  // fetch camera details from postgres
  public async fetchCameraDetailsFromDb(timestamp: number, cameraId: string): Promise<CameraDetails> {
    this.logger.debug('Fetching camera details from db.')
    const camera = await this.prisma.camera.findFirst({ where: { cameraId }, include: { area: true } })
    if (!camera) throw new Error('NO_CAMERA_FOUND')

    const [
      cameraImage,
      weatherForecast
    ] = await Promise.all([
      this.prisma.cameraImage.findFirst({ where: { cameraId: camera.id } }), // TODO: find at given timestamp 
      this.prisma.weatherForecast.findFirst({ where: { areaId: camera.areaId } }), // TODO: find at given timestamp
    ])

    if (!cameraImage) throw new Error('NO_CAMERA_IMAGE_FOUND')
    if (!weatherForecast) throw new Error('NO_WEATHER_FORECAST_FOUND')

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
          md5: cameraImage.md5,
        }
      },
      weather_forecast: weatherForecast.forecast
    }
  }

  public async cacheAllDataToDb(timestamp: number, data: IndexerResult): Promise<{ success: boolean }> {
    // TODO: Do not start the indexer if it has already indexed the given timestamp.
    this.logger.debug(`Caching data for timestamp ${timestamp}`)

    let success: boolean
    try {
      // Do this sequentially, or else there will be a 
      // race condition error while creating Areas.
      await this.saveCameraImagesToDb(data, timestamp)
      await this.saveWeatherForecastsToDb(data, timestamp)
      success = true
    } catch (error) {
      this.logger.error(error)
      success = false
    }

    this.logger.debug(`Caching data ${success ? 'succeeded' : 'failed'}`)

    return { success }
  }

  private async saveWeatherForecastsToDb(data: IndexerResult, timestamp: number) {
    this.logger.debug('Upserting areas and weather forecasts')

    const { weatherForecasts, areas, forecastTimestamp } = data

    for (const weatherForecast of weatherForecasts) {
      const area = areas.find(area => area.name === weatherForecast.area)
      if (!area) throw new Error('NO_AREA_FOUND')

      const createParams : Prisma.WeatherForecastCreateInput = {
        forecast: weatherForecast.forecast,
        area: {
          connectOrCreate: {
            where: {
              name: area.name,
              latitude: area.latitude,
              longitude: area.longitude,
            },
            create: {
              name: area.name,
              latitude: area.latitude,
              longitude: area.longitude,
              earliestTimestamp: new Date(timestamp)
            }
          }
        },
        forecastTimestamp: new Date(forecastTimestamp),
      }

      const newForecast = await this.prisma.weatherForecast.create({
        data: createParams,
      })
    }

    // Update earliestTimestamp for areas
    // TODO: Optimize this
    for (const area of areas) {
      const areaFromDb = await this.prisma.area.findFirst({
        where: {
          name: area.name
        }
      })

      if (!areaFromDb) return;

      const earliestTimestampFromDb = areaFromDb.earliestTimestamp
      if (new Date(timestamp) < new Date(earliestTimestampFromDb)) {
        await this.prisma.area.update({
          where: {
            name: area.name,
            latitude: area.latitude,
            longitude: area.longitude,
          },
          data: {
            earliestTimestamp: new Date(timestamp)
          }
        })
      }
    }

    this.logger.debug('Done upserting Areas and WeatherForecasts')
  }

  private async saveCameraImagesToDb(data: IndexerResult, timestamp: number) {
    this.logger.debug('Upserting cameras and camera images')

    const { cameras, areas, cameraImages } = data

    for (const [index, camera] of cameras.entries()) {
      const nearestArea = areas[this.getNearestCoordinatesIndex({
        latitude: camera.latitude,
        longitude: camera.longitude
      }, areas)]

      const cameraImage = cameraImages[index]

      const params = {
        ...camera,
        earliestTimestamp: new Date(timestamp),
        cameraImages: {
          connectOrCreate: {
            where: {
              md5: cameraImage.image_metadata.md5,
            },
            create: {
              imageTimestamp: new Date(cameraImage.timestamp),
              imageUrl: cameraImage.image,
              width: cameraImage.image_metadata.width,
              height: cameraImage.image_metadata.height,
              md5: cameraImage.image_metadata.md5,
            }
          }
        },
        area: {
          connectOrCreate: {
            where: {
              name: nearestArea.name
            },
            create: {
              ...nearestArea,
              earliestTimestamp: new Date(timestamp)
            }
          }
        },
      }

      const newCamera = await this.prisma.camera.upsert({
        where: { cameraId: camera.cameraId },
        update: params,
        create: params
      })
    }

    // Update earliestTimestamp for cameras
    // TODO: Optimize this
    for (const camera of cameras) {
      const cameraFromDb = await this.prisma.camera.findFirst({
        where: {
          cameraId: camera.cameraId
        }
      })

      if (!cameraFromDb) return;

      const earliestTimestampFromDb = cameraFromDb.earliestTimestamp
      if (new Date(timestamp) < new Date(earliestTimestampFromDb)) {
        await this.prisma.camera.update({
          where: {
            cameraId: camera.cameraId
          },
          data: {
            earliestTimestamp: new Date(timestamp)
          }
        })
      }
    }

    this.logger.debug('Done upserting Cameras and CameraImages')
  }

  // fetch data from data.gov.sg traffic cam api
  private async fetchGovTrafficCamApiData(timestamp: number): Promise<GovTrafficCamApiData> {
    this.logger.debug(`Fetching data from data.gov.sg Traffic Cam API`)
    try {
      const date_time = this.getFormattedDate(timestamp)
      const { data } = await this.httpService.axiosRef.get<GovTrafficCamApiData>(
        `https://api.data.gov.sg/v1/transport/traffic-images?date_time=${date_time}`,
        {
          withCredentials: true
        }
      )

      return data
    } catch (error) {
      this.logAxiosError(error)
      throw new Error('FETCH_TRAFFIC_API_FAILED')
    }
  }

  // fetch data from data.gov.sg weather forecast api
  private async fetchGovWeatherApiData(timestamp: number): Promise<GovWeatherApiData> {
    this.logger.debug(`Fetching data from data.gov.sg Weather API`)
    try {
      const date_time = this.getFormattedDate(timestamp)
      const { data } = await this.httpService.axiosRef.get<GovWeatherApiData>(
        `https://api.data.gov.sg/v1/environment/2-hour-weather-forecast?date_time=${date_time}`,
        {
          withCredentials: true
        }
      )

      return data
    } catch (error) {
      this.logAxiosError(error)
      throw new Error('FETCH_WEATHER_API_FAILED')
    }
  }

  private logAxiosError(error: AxiosError): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      this.logger.debug('Axios unsuccessful error');
      this.logger.debug(error.response.data);
      this.logger.debug(error.response.status);
      this.logger.debug(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      this.logger.debug('Axios no response received');
      this.logger.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      this.logger.debug('Axios unexpected error');
      this.logger.log('Error', error.message);
    }

    this.logger.log(error.config);
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
