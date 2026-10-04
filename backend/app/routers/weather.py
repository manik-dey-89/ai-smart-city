from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from ..database import get_db
from ..schemas import WeatherResponse, CurrentWeather, ForecastDay
from ..dependencies import get_current_active_user

router = APIRouter(prefix="/api/weather", tags=["weather"])


def get_day_name(offset: int) -> str:
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    today = datetime.now()
    target = today + timedelta(days=offset)
    return days[target.weekday()]


def get_formatted_date(offset: int) -> str:
    today = datetime.now()
    target = today + timedelta(days=offset)
    return target.strftime("%Y-%m-%d")


@router.get("/current", response_model=WeatherResponse)
def get_weather(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    # Mock data for now - can integrate with OpenWeatherMap or similar later
    forecast = []
    conditions = ["Sunny", "Partly Cloudy", "Rain", "Thunderstorm", "Cloudy", "Sunny", "Mostly Cloudy"]
    icons = ["sunny", "partly-cloudy", "rain", "thunderstorm", "cloudy", "sunny", "cloudy"]
    
    for i in range(7):
        forecast.append(ForecastDay(
            date=get_formatted_date(i),
            day_name="Today" if i == 0 else get_day_name(i),
            high=25 + i,
            low=20 + i,
            condition=conditions[i],
            icon=icons[i]
        ))
    
    return WeatherResponse(
        current=CurrentWeather(
            temp=28.0,
            humidity=65.0,
            wind_speed=12.0,
            condition="Sunny",
            feels_like=30.0
        ),
        forecast=forecast
    )
