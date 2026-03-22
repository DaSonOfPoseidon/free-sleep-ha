"""DataUpdateCoordinator for Free Sleep."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    API_DEVICE_STATUS,
    API_PRESENCE,
    API_SETTINGS,
    API_VITALS_SUMMARY,
    DOMAIN,
    POLL_INTERVAL_DEVICE,
    SIDES,
)

_LOGGER = logging.getLogger(__name__)


class FreeSleepCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator that polls the Free Sleep API."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        self._host = entry.data[CONF_HOST]
        self._port = entry.data.get(CONF_PORT, 3000)
        self._base_url = f"http://{self._host}:{self._port}"
        self._session: aiohttp.ClientSession | None = None

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=POLL_INTERVAL_DEVICE),
            config_entry=entry,
        )

    @property
    def base_url(self) -> str:
        """Return the base URL."""
        return self._base_url

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create the aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=15)
            )
        return self._session

    async def _fetch(self, path: str) -> dict[str, Any]:
        """Fetch data from the Free Sleep API."""
        session = await self._get_session()
        url = f"{self._base_url}{path}"
        async with session.get(url) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def async_post(self, path: str, data: dict[str, Any]) -> None:
        """POST data to the Free Sleep API."""
        session = await self._get_session()
        url = f"{self._base_url}{path}"
        async with session.post(url, json=data) as resp:
            resp.raise_for_status()

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch all data from the Pod."""
        try:
            device_status = await self._fetch(API_DEVICE_STATUS)
            settings = await self._fetch(API_SETTINGS)

            # Fetch presence and vitals per side (best-effort)
            presence: dict[str, Any] = {}
            vitals: dict[str, Any] = {}

            for side in SIDES:
                try:
                    presence_data = await self._fetch(
                        f"{API_PRESENCE}?side={side}"
                    )
                    presence[side] = presence_data
                except (aiohttp.ClientError, KeyError):
                    presence[side] = None

                try:
                    vitals_data = await self._fetch(
                        f"{API_VITALS_SUMMARY}?side={side}"
                    )
                    vitals[side] = vitals_data
                except (aiohttp.ClientError, KeyError):
                    vitals[side] = None

            return {
                "device_status": device_status,
                "settings": settings,
                "presence": presence,
                "vitals": vitals,
            }

        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Error communicating with Pod: {err}") from err
        except Exception as err:
            raise UpdateFailed(f"Unexpected error: {err}") from err

    async def async_shutdown(self) -> None:
        """Close the session on shutdown."""
        if self._session and not self._session.closed:
            await self._session.close()
        await super().async_shutdown()
