<h1 align="center" style="">
  📸🚦🌤<br/>
  SG Traffic + Weather Backend
</h1>


This  application contains:
- **Traffic Cams API** containing information (weather and images) for traffic cameras around Singapore. This API is consumed by [SG Traffic + Weather Frontend](https://github.com/kyle-cognizant/sg-traffic-weather-frontend).
- **Reports API** that returns data such as the most recent or top searches over a time period.

Data is sourced from [data.gov.sg](https://data.gov.sg) and cached in a local database.

## Traffic Cams API

### GET `/traffic-cams`
Lists of traffic camera locations in Singapore.

### GET `/traffic-cams/:id`
Returns details about a specific traffic camera.

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
