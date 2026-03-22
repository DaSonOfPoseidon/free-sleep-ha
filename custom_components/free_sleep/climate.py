"""Climate platform for Free Sleep."""

from __future__ import annotations

from typing import Any

from homeassistant.components.climate import (
    ClimateEntity,
    ClimateEntityFeature,
    HVACMode,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import API_DEVICE_STATUS, DOMAIN, MAX_TEMP_F, MIN_TEMP_F, SIDES
from .coordinator import FreeSleepCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Free Sleep climate entities."""
    coordinator: FreeSleepCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        FreeSleepClimate(coordinator, entry, side) for side in SIDES
    )


class FreeSleepClimate(CoordinatorEntity[FreeSleepCoordinator], ClimateEntity):
    """Climate entity for one side of the bed."""

    _attr_has_entity_name = True
    _attr_temperature_unit = UnitOfTemperature.FAHRENHEIT
    _attr_supported_features = ClimateEntityFeature.TARGET_TEMPERATURE
    _attr_hvac_modes = [HVACMode.HEAT_COOL, HVACMode.OFF]
    _attr_min_temp = MIN_TEMP_F
    _attr_max_temp = MAX_TEMP_F
    _attr_target_temperature_step = 1

    def __init__(
        self,
        coordinator: FreeSleepCoordinator,
        entry: ConfigEntry,
        side: str,
    ) -> None:
        """Initialize the climate entity."""
        super().__init__(coordinator)
        self._side = side
        self._attr_unique_id = f"{entry.entry_id}_{side}_climate"

        # Device info groups all entities under one device
        hub_version = entry.data.get("hub_version", "Unknown")
        fs_version = entry.data.get("free_sleep_version", "Unknown")
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "Free Sleep Pod",
            "manufacturer": "Eight Sleep (Free Sleep)",
            "model": hub_version,
            "sw_version": fs_version,
        }

    @property
    def _side_status(self) -> dict[str, Any] | None:
        """Return the side status from coordinator data."""
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("device_status", {}).get(self._side)

    @property
    def _settings(self) -> dict[str, Any] | None:
        """Return settings from coordinator data."""
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("settings")

    @property
    def name(self) -> str:
        """Return the display name."""
        settings = self._settings
        if settings:
            side_settings = settings.get(self._side, {})
            side_name = side_settings.get("name")
            if side_name:
                return f"{side_name}'s Side"
        return f"{self._side.capitalize()} Side"

    @property
    def hvac_mode(self) -> HVACMode:
        """Return the current HVAC mode."""
        status = self._side_status
        if status and status.get("isOn"):
            return HVACMode.HEAT_COOL
        return HVACMode.OFF

    @property
    def current_temperature(self) -> float | None:
        """Return the current bed temperature."""
        status = self._side_status
        if status:
            return status.get("currentTemperatureF")
        return None

    @property
    def target_temperature(self) -> float | None:
        """Return the target temperature."""
        status = self._side_status
        if status:
            return status.get("targetTemperatureF")
        return None

    async def async_set_temperature(self, **kwargs: Any) -> None:
        """Set the target temperature."""
        temperature = kwargs.get("temperature")
        if temperature is None:
            return

        await self.coordinator.async_post(
            API_DEVICE_STATUS,
            {self._side: {"targetTemperatureF": int(temperature)}},
        )
        await self.coordinator.async_request_refresh()

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        """Set the HVAC mode (on/off)."""
        is_on = hvac_mode != HVACMode.OFF

        await self.coordinator.async_post(
            API_DEVICE_STATUS,
            {self._side: {"isOn": is_on}},
        )
        await self.coordinator.async_request_refresh()
