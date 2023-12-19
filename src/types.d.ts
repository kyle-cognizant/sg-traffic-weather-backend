export type Coordinates = {
  latitude: number
  longitude: number
}

export type Camera = {
  camera_id: string
  location: Coordinates
  image: string
  image_metadata: {
    height: number
    width: number
    md5?: string
  }
  timestamp: string
}

export type CameraWithAreaName = Camera & {
  area_name: string
}

export type CameraDetails = {
  camera: CameraWithAreaName
  weather_forecast: string
}

export type GovTrafficCamApiData = {
  items: {
    timestamp: string
    cameras: Camera[]
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
    forecasts: {
      area: string
      forecast: string
    }[]
  }[]
  api_info: {
    status: string
  }
}
