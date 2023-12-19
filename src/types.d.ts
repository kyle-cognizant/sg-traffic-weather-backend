export type Coordinates = {
  latitude: number
  longitude: number
}

export type Area = Coordinates & {
  name: string
} 

export type Camera = {
  camera_id: string
  location: Coordinates
}

export type CameraWithAreaName = Camera & {
  area_name: string
}

export type CameraImage = {
  image: string
  image_metadata: {
    height: number
    width: number
    md5: string
  }
  timestamp: string
}

export type CameraDetails = {
  camera: CameraWithAreaName & CameraImage
  weather_forecast: string
}

export type GovTrafficCamApiData = {
  items: {
    timestamp: string
    cameras: (Camera & CameraImage)[]
  }[]
  api_info: {
    status: string
  }
}

export type GovWeatherApiData = {
  area_metadata: {
    name: string
    label_location: Coordinates
  }[]
  items: {
    update_timestamp: string
    timestamp: string
    valid_period: {
      start: string
      end: string
    }
    forecasts: WeatherForecast[]
  }[]
  api_info: {
    status: string
  }
}

export type WeatherForecast = {
  area: string
  forecast: string
}

export type IndexerResult = {
  areas: Area[],
  weatherForecasts: WeatherForecast[],
  cameras: (Coordinates & {
    cameraId: string
  })[]
  cameraImages: CameraImage[]
  forecastTimestamp: string,
}
