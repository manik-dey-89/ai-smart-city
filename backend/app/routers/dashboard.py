from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..schemas import DashboardStats
from ..models import Alert, Incident, TrafficIncident
from ..dependencies import get_current_active_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    total_alerts = db.query(Alert).filter(Alert.status == "active").count()
    active_emergencies = db.query(Incident).filter(Incident.status == "active", Incident.severity == "high").count()
    traffic_incidents = db.query(TrafficIncident).filter(TrafficIncident.status == "active").count()
    
    return DashboardStats(
        total_alerts=total_alerts,
        active_emergencies=active_emergencies,
        traffic_incidents=traffic_incidents,
        aqi_status="moderate",
        weather={"temp": 28, "condition": "Sunny", "humidity": 65}
    )
