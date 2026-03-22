"""Config flow for Free Sleep integration."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_HOST, CONF_PORT

from .const import DEFAULT_PORT, DOMAIN, API_DEVICE_STATUS

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_HOST): str,
    }
)


async def validate_connection(host: str, port: int) -> dict[str, Any]:
    """Validate that we can connect to the Pod and return device info."""
    url = f"http://{host}:{port}{API_DEVICE_STATUS}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return {
                "hub_version": data.get("hubVersion", "Unknown"),
                "free_sleep_version": data.get("freeSleep", {}).get("version", "Unknown"),
            }


class FreeSleepConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Free Sleep."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST]
            port = DEFAULT_PORT

            # Check if already configured with this host
            await self.async_set_unique_id(host)
            self._abort_if_unique_id_configured()

            try:
                info = await validate_connection(host, port)
            except (aiohttp.ClientError, TimeoutError):
                errors["base"] = "cannot_connect"
            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"
            else:
                title = f"Free Sleep ({host})"
                return self.async_create_entry(
                    title=title,
                    data={
                        CONF_HOST: host,
                        CONF_PORT: port,
                        **info,
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )
