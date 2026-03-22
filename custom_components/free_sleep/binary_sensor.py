"""Binary sensor platform for Free Sleep."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SIDES
from .coordinator import FreeSleepCoordinator


BINARY_SENSOR_TYPES: list[dict[str, Any]] = [
    {
        "key": "bed_presence",
        "name_suffix": "Bed Presence",
        "device_class": BinarySensorDeviceClass.OCCUPANCY,
        "icon_on": "mdi:bed",
        "icon_off": "mdi:bed-empty",
        "source": "presence",
    },
    {
        "key": "alarm_vibrating",
        "name_suffix": "Alarm Vibrating",
        "device_class": None,
        "icon_on": "mdi:alarm",
        "icon_off": "mdi:alarm-off",
        "source": "device_status",
    },
]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Free Sleep binary sensor entities."""
    coordinator: FreeSleepCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[FreeSleepBinarySensor] = []

    for side in SIDES:
        for sensor_type in BINARY_SENSOR_TYPES:
            entities.append(
                FreeSleepBinarySensor(coordinator, entry, side, sensor_type)
            )

    async_add_entities(entities)


class FreeSleepBinarySensor(
    CoordinatorEntity[FreeSleepCoordinator], BinarySensorEntity
):
    """Binary sensor entity for Free Sleep."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: FreeSleepCoordinator,
        entry: ConfigEntry,
        side: str,
        sensor_type: dict[str, Any],
    ) -> None:
        """Initialize the binary sensor entity."""
        super().__init__(coordinator)
        self._side = side
        self._sensor_type = sensor_type
        self._attr_unique_id = f"{entry.entry_id}_{side}_{sensor_type['key']}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
        }

        if sensor_type["device_class"]:
            self._attr_device_class = sensor_type["device_class"]

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
    def is_on(self) -> bool | None:
        """Return True if the binary sensor is on."""
        if not self.coordinator.data:
            return None

        source = self._sensor_type["source"]

        if source == "presence":
            presence = self.coordinator.data.get("presence", {}).get(self._side)
            if presence is None:
                return None
            # Presence API returns presence state
            return bool(presence.get("isPresent", False))

        if source == "device_status":
            side_status = self.coordinator.data.get("device_status", {}).get(
                self._side
            )
            if side_status is None:
                return None
            return bool(side_status.get("isAlarmVibrating", False))

        return None

    @property
    def icon(self) -> str:
        """Return the icon based on state."""
        if self.is_on:
            return self._sensor_type["icon_on"]
        return self._sensor_type["icon_off"]
