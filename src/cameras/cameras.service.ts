import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { GovTrafficCamApiData, GovWeatherApiData } from 'src/types';

@Injectable()
export class CamerasService {
  constructor(private readonly httpService: HttpService) { }

  private async fetchGovTrafficCamApiData() {
    const { data } = await this.httpService.axiosRef.get<GovTrafficCamApiData>('https://api.data.gov.sg/v1/transport/traffic-images')
    return data
  }

  private async fetchGovWeatherApiData(): Promise<GovWeatherApiData> {
    const { data } = await this.httpService.axiosRef.get<GovWeatherApiData>('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast')
    return data
  }
}
