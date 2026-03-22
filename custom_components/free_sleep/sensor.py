"""Sensor platform for Free Sleep."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SIDES
from .coordinator import FreeSleepCoordinator


SENSOR_TYPES: list[dict[str, Any]] = [
    {
        "key": "heart_rate",
        "name_suffix": "Heart Rate",
        "unit": "bpm",
        "icon": "mdi:heart-pulse",
        "device_class": None,
        "state_class": SensorStateClass.MEASUREMENT,
        "source": "vitals",
        "field": "avgHeartRate",
    },
    {
        "key": "hrv",
        "name_suffix": "HRV",
        "unit": "ms",
        "icon": "mdi:heart-flash",
        "device_class": None,
        "state_class": SensorStateClass.MEASUREMENT,
        "source": "vitals",
        "field": "avgHRV",
    },
    {
        "key": "breathing_rate",
        "name_suffix": "Breathing Rate",
        "unit": "breaths/min",
        "icon": "mdi:lungs",
        "device_class": None,
        "state_class": SensorStateClass.MEASUREMENT,
        "source": "vitals",
        "field": "avgBreathingRate",
    },
    {
        "key": "bed_temperature",
        "name_suffix": "Bed Temperature",
        "unit": None,
        "icon": "mdi:thermometer",
        "device_class": SensorDeviceClass.TEMPERATURE,
        "state_class": SensorStateClass.MEASUREMENT,
        "source": "device_status",
        "field": "currentTemperatureF",
    },
]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Free Sleep sensor entities."""
    coordinator: FreeSleepCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[FreeSleepSensor] = []

    for side in SIDES:
        for sensor_type in SENSOR_TYPES:
            entities.append(
                FreeSleepSensor(coordinator, entry, side, sensor_type)
            )

    async_add_entities(entities)


class FreeSleepSensor(CoordinatorEntity[FreeSleepCoordinator], SensorEntity):
    """Sensor entity for Free Sleep biometrics and temperature."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: FreeSleepCoordinator,
        entry: ConfigEntry,
        side: str,
        sensor_type: dict[str, Any],
    ) -> None:
        """Initialize the sensor entity."""
        super().__init__(coordinator)
        self._side = side
        self._sensor_type = sensor_type
        self._attr_unique_id = f"{entry.entry_id}_{side}_{sensor_type['key']}"
        self._attr_icon = sensor_type["icon"]
        self._attr_state_class = sensor_type["state_class"]
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
        }

        if sensor_type["device_class"]:
            self._attr_device_class = sensor_type["device_class"]

        if sensor_type["device_class"] == SensorDeviceClass.TEMPERATURE:
            self._attr_native_unit_of_measurement = UnitOfTemperature.FAHRENHEIT
        elif sensor_type["unit"]:
            self._attr_native_unit_of_measurement = sensor_type["unit"]

    @property
    def _settings(self) -> dict[str, Any] | None:
        """Return settings."""
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("settings")

    @property
    def name(self) -> str:
        """Return the display name."""
        suffix = self._sensor_type["name_suffix"]
        settings = self._settings
        if settings:
            side_name = settings.get(self._side, {}).get("name")
            if side_name:
                return f"{side_name}'s {suffix}"
        return f"{self._side.capitalize()} {suffix}"

    @property
    def native_value(self) -> float | None:
        """Return the sensor value."""
        if not self.coordinator.data:
            return None

        source = self._sensor_type["source"]
        field = self._sensor_type["field"]

        if source == "vitals":
            vitals = self.coordinator.data.get("vitals", {}).get(self._side)
            if vitals:
                value = vitals.get(field)
                if value is not None:
                    return round(float(value), 1)
            return None

        if source == "device_status":
            side_status = self.coordinator.data.get("device_status", {}).get(
                self._side
            )
            if side_status:
                value = side_status.get(field)
                if value is not None:
                    return round(float(value), 1)
            return None

        return None
