"""Switch platform for Free Sleep."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import API_DEVICE_STATUS, DOMAIN, SIDES
from .coordinator import FreeSleepCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Free Sleep switch entities."""
    coordinator: FreeSleepCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        FreeSleepPowerSwitch(coordinator, entry, side) for side in SIDES
    )


class FreeSleepPowerSwitch(CoordinatorEntity[FreeSleepCoordinator], SwitchEntity):
    """Switch entity for controlling power on one side."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: FreeSleepCoordinator,
        entry: ConfigEntry,
        side: str,
    ) -> None:
        """Initialize the switch entity."""
        super().__init__(coordinator)
        self._side = side
        self._attr_unique_id = f"{entry.entry_id}_{side}_power"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
        }

    @property
    def _side_status(self) -> dict[str, Any] | None:
        """Return the side status."""
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("device_status", {}).get(self._side)

    @property
    def _settings(self) -> dict[str, Any] | None:
        """Return settings."""
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("settings")

    @property
    def name(self) -> str:
        """Return the display name."""
        settings = self._settings
        if settings:
            side_name = settings.get(self._side, {}).get("name")
            if side_name:
                return f"{side_name}'s Power"
        return f"{self._side.capitalize()} Power"

    @property
    def is_on(self) -> bool:
        """Return True if the side is on."""
        status = self._side_status
        if status:
            return bool(status.get("isOn", False))
        return False

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn on the side."""
        await self.coordinator.async_post(
            API_DEVICE_STATUS,
            {self._side: {"isOn": True}},
        )
        await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn off the side."""
        await self.coordinator.async_post(
            API_DEVICE_STATUS,
            {self._side: {"isOn": False}},
        )
        await self.coordinator.async_request_refresh()
