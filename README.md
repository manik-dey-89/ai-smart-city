# AI Smart City Dashboard - Database Documentation

## Overview

This document describes the complete database architecture for the AI Smart City Dashboard. The database is built on PostgreSQL with PostGIS for geospatial data, following 3NF normalization standards.

## Database Schema

### Core Tables

#### `users`
- **Purpose**: Store all system users
- **Key Fields**:
  - `id` (UUID, PK)
  - `username` (String, unique)
  - `email` (String, unique)
  - `hashed_password` (String)
  - `full_name` (String)
  - `phone` (String)
  - `is_active` (Boolean)
  - `created_at` (DateTime)
  - `updated_at` (DateTime)
  - `status` (String)

#### `roles`
- **Purpose**: Define user roles
- **Key Fields**:
  - `id` (UUID, PK)
  - `name` (String, unique)
  - `description` (Text)
  - Standard Roles: `citizen`, `admin`, `emergency`

#### `permissions`
- **Purpose**: Granular permissions for access control
- **Key Fields**:
  - `id` (UUID, PK)
  - `name` (String, unique)
  - `resource` (String)
  - `action` (String)
  - `description` (Text)

#### `user_roles`
- **Purpose**: Many-to-many link between users and roles
- **Key Fields**:
  - `user_id` (UUID, FK → users.id)
  - `role_id` (UUID, FK → roles.id)

#### `role_permissions`
- **Purpose**: Many-to-many link between roles and permissions
- **Key Fields**:
  - `role_id` (UUID, FK → roles.id)
  - `permission_id` (UUID, FK → permissions.id)

### User Profile Tables

#### `citizens`
- **Purpose**: Extended profile for citizen users
- **Relations**: One-to-one with `users`
- **Key Fields**:
  - `user_id` (UUID, FK → users.id, unique)
  - `address` (Text)
  - `date_of_birth` (DateTime)

#### `admins`
- **Purpose**: Extended profile for admin users
- **Relations**: One-to-one with `users`, Belongs to `departments`
- **Key Fields**:
  - `user_id` (UUID, FK → users.id, unique)
  - `department_id` (UUID, FK → departments.id)
  - `employee_id` (String, unique)
  - `position` (String)

#### `emergency_teams`
- **Purpose**: Extended profile for emergency responders
- **Relations**: One-to-one with `users`, Belongs to `departments`, Belongs to `emergency_stations`
- **Key Fields**:
  - `user_id` (UUID, FK → users.id, unique)
  - `department_id` (UUID, FK → departments.id)
  - `station_id` (UUID, FK → emergency_stations.id)
  - `team_type` (String)
  - `badge_number` (String, unique)

### Organization Tables

#### `departments`
- **Purpose**: Organization departments
- **Relations**: Has many `admins`, Has many `emergency_teams`
- **Key Fields**:
  - `name` (String, unique)
  - `description` (Text)
  - `head_id` (UUID, FK → users.id)

#### `emergency_stations`
- **Purpose**: Emergency response stations (police, fire, etc.)
- **Relations**: Has many `emergency_teams`, Has many `ambulances`, Has many `fire_trucks`, Has many `police_units`
- **Key Fields**:
  - `type` (String)
  - `name` (String)
  - `location` (Point geometry)
  - `address` (Text)
  - `phone` (String)
  - `capacity` (Integer)

### Sensor & Infrastructure Tables

#### `traffic_sensors`
- **Purpose**: Traffic monitoring sensors
- **Relations**: Belongs to `roads`
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `road_id` (UUID, FK → roads.id)
  - `sensor_type` (String)
  - `metadata` (Text)

#### `air_quality_sensors`
- **Purpose**: Air quality monitoring sensors
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `metadata` (Text)

#### `water_sensors`
- **Purpose**: Water level and quality sensors
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `sensor_type` (String)
  - `metadata` (Text)

#### `electricity_sensors`
- **Purpose**: Power grid sensors
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `transformer_id` (String)
  - `metadata` (Text)

#### `smart_bins`
- **Purpose**: IoT-enabled waste bins
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `fill_percentage` (Float)
  - `bin_type` (String)
  - `last_collected` (DateTime)

#### `weather_stations`
- **Purpose**: Weather monitoring stations
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `metadata` (Text)

#### `roads`
- **Purpose**: Road network information
- **Relations**: Has many `traffic_sensors`, Has many `traffic_incidents`
- **Key Fields**:
  - `name` (String)
  - `road_type` (String)
  - `geometry` (LineString geometry)
  - `speed_limit` (Integer)
  - `lanes` (Integer)

### Incident & Complaint Tables

#### `traffic_incidents`
- **Purpose**: Traffic-related incidents
- **Relations**: Belongs to `roads`
- **Key Fields**:
  - `type` (String)
  - `title` (String)
  - `description` (Text)
  - `location` (Point geometry)
  - `road_id` (UUID, FK → roads.id)
  - `severity` (String)

#### `crime_reports`
- **Purpose**: Reported crimes
- **Key Fields**:
  - `type` (String)
  - `title` (String)
  - `description` (Text)
  - `location` (Point geometry)
  - `severity` (String)
  - `reported_by` (UUID, FK → users.id)

#### `complaints`
- **Purpose**: Citizen complaints
- **Relations**: Belongs to `users`, Has many `complaint_images`
- **Key Fields**:
  - `type` (String)
  - `title` (String)
  - `description` (Text)
  - `location` (Point geometry)
  - `priority` (String)
  - `user_id` (UUID, FK → users.id)
  - `assigned_to` (UUID, FK → users.id)

#### `complaint_images`
- **Purpose**: Images attached to complaints
- **Relations**: Belongs to `complaints`
- **Key Fields**:
  - `complaint_id` (UUID, FK → complaints.id)
  - `image_url` (String)
  - `thumbnail_url` (String)

### Emergency Response Tables

#### `emergency_requests`
- **Purpose**: Emergency service requests
- **Relations**: Belongs to `users`
- **Key Fields**:
  - `type` (String)
  - `title` (String)
  - `description` (Text)
  - `location` (Point geometry)
  - `user_id` (UUID, FK → users.id)
  - `priority` (String)
  - `is_resolved` (Boolean)

#### `ambulances`
- **Purpose**: Ambulance fleet management
- **Relations**: Belongs to `emergency_stations`
- **Key Fields**:
  - `name` (String)
  - `station_id` (UUID, FK → emergency_stations.id)
  - `current_location` (Point geometry)
  - `is_available` (Boolean)

#### `fire_trucks`
- **Purpose**: Fire truck fleet management
- **Relations**: Belongs to `emergency_stations`
- **Key Fields**: Same as ambulances

#### `police_units`
- **Purpose**: Police unit management
- **Relations**: Belongs to `emergency_stations`
- **Key Fields**: Same as ambulances

### Facility Tables

#### `hospitals`
- **Purpose**: Hospital information
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `address` (Text)
  - `phone` (String)
  - `available_beds` (Integer)
  - `total_beds` (Integer)
  - `emergency_services` (Boolean)

#### `shelters`
- **Purpose**: Emergency shelter information
- **Key Fields**:
  - `name` (String)
  - `location` (Point geometry)
  - `address` (Text)
  - `phone` (String)
  - `capacity` (Integer)
  - `current_occupancy` (Integer)

### System Tables

#### `notifications`
- **Purpose**: User notifications
- **Relations**: Belongs to `users`
- **Key Fields**:
  - `user_id` (UUID, FK → users.id)
  - `type` (String)
  - `title` (String)
  - `message` (Text)
  - `is_read` (Boolean)

#### `alerts`
- **Purpose**: Public alerts
- **Key Fields**:
  - `type` (String)
  - `title` (String)
  - `message` (Text)
  - `severity` (String)
  - `area_affected` (Polygon geometry)

#### `analytics`
- **Purpose**: Metric storage for analytics
- **Key Fields**:
  - `metric_name` (String)
  - `metric_value` (Float)
  - `category` (String)
  - `metadata` (Text)

#### `system_logs`
- **Purpose**: System audit logs
- **Relations**: Belongs to `users`
- **Key Fields**:
  - `level` (String)
  - `message` (Text)
  - `source` (String)
  - `user_id` (UUID, FK → users.id)
  - `metadata` (Text)

#### `settings`
- **Purpose**: System configuration settings
- **Key Fields**:
  - `key` (String, unique)
  - `value` (Text)
  - `description` (Text)
  - `is_public` (Boolean)

#### `incidents`
- **Purpose**: General incident tracking
- **Relations**: Belongs to `users`
- **Key Fields**:
  - `type` (String)
  - `title` (String)
  - `description` (Text)
  - `location` (Point geometry)
  - `severity` (String)
  - `created_by` (UUID, FK → users.id)

## Geospatial Features

All location-related tables use PostGIS geometry types with SRID 4326 (WGS84):
- `POINT` - Single location coordinates
- `LINESTRING` - Road and linear feature geometry
- `POLYGON` - Area definitions (e.g., alert affected areas)

## Usage

### Starting the Database with Docker

```bash
docker-compose up -d db
```

### Seeding Test Data

```bash
cd backend
python seed.py
```

### Connecting to the Database

```bash
psql postgresql://smartcity:smartcity123@localhost:5432/smartcity
```
