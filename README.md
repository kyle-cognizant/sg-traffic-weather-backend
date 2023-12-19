<h1 align="center" style="">
  📸🚦🌤<br/>
  SG Traffic + Weather Backend
</h1>

> This is my submission for a technical assessment as part of an interview process.

This application exposes two APIs:
1. **Traffic Cams API** containing information (weather and images) for traffic cameras around Singapore. This API is consumed by [SG Traffic + Weather Frontend](https://github.com/kyle-cognizant/sg-traffic-weather-frontend).
2. **Reports API** that returns data such as the most recent or top searches over a time period.

Data is sourced from [data.gov.sg](https://data.gov.sg) and cached in a local database.

## Cameras API

### GET `/cameras?datetime=1693843200000`
**Lists traffic camera locations in Singapore at the given date.**

```
{ 
    "cameras": [
        {
            "camera_id": "1001",
            "area_name": "Bukit Batok"
            "location": {
                "latitude": 1.29531332,
                "longitude": 103.871146
            },
            "timestamp": 1693843200000,
            "image": "<image_url>",
            "image_metadata": {
                "height": 240,
                "width": 320,
                "md5": "9df1ef723ed80098a18fe8757f921fa9"
            },
        },
        // ...
    ],

}
```

### GET `/cameras/:camera_id?datetime=1693843200000`
Returns details about a specific traffic camera at the given date.

```
{ 
    "camera": {
        "camera_id": "1001",
        "area_name": "Bukit Batok"
        "location": {
            "latitude": 1.29531332,
            "longitude": 103.871146
        },
        "timestamp": 1693843200000,
        "image": "<image_url>",
        "image_metadata": {
            "height": 240,
            "width": 320,
            "md5": "9df1ef723ed80098a18fe8757f921fa9"
        },
    },
    "weather_forecast": "Partly Cloudy"
}
```

## Reports API

### GET `/reports`
Lists available reports

### GET `/reports/recent`
Returns the 10 most recent searches

### GET `/reports/top`
Returns top 10 searches within a period

### GET `/reports/hot`
Returns period where there are most searches performed



## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Notes

### Architecture & Design
- Our system is designed to minimize API calls to data.gov.sg by caching as much data as possible.
- All historical data will still be available in the event that data.gov.sg is unreachable. The drawback of this is that it requires much more complicated database queries and mutations.
- An indexer function runs when necessary, fetching data from data.gov.sg APIs, and storing it in Postgres (depending on requirements, Redis might be a better alternative for this). 
- The database schema is designed to cater for growing requirements.
- We only expose the necessary API endpoints and data for our frontend application and reporting requirements.
- In a real world situation, we would run the indexer to seed our DB with historical data, then set up a recurring job to trigger the indexer at short intervals.
- It is easy to extend this app to including things like PSI data, temperature, etc using the relevant APIs. If we want to display charts, consider using a time-series database.

### Possible Enhancements
- Split logic from Cameras service out into smaller modules.
- Add Axios retries and throttling (wasn't sure how to do this with Nest).
- Add rate limits to our API to prevent abuse.
- Use .env vars for config stuff

### Assumptions
- Cameras will never be moved or removed. (It's possible to handle these cases with added business logic; out of scope for this assignment).
- The "area" associated with each camera can change over time as more areas are indexed in the DB.
- Data at each timestamp is immutable.
