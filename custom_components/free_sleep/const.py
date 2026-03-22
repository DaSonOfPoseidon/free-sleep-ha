"""Constants for the Free Sleep integration."""

DOMAIN = "free_sleep"
DEFAULT_PORT = 3000

# API endpoints
API_DEVICE_STATUS = "/api/deviceStatus"
API_SETTINGS = "/api/settings"
API_VITALS_SUMMARY = "/api/metrics/vitals/summary"
API_PRESENCE = "/api/metrics/presence"

# Poll intervals (seconds)
POLL_INTERVAL_DEVICE = 30
POLL_INTERVAL_VITALS = 60

# Temperature range (Fahrenheit)
MIN_TEMP_F = 55
MAX_TEMP_F = 110

# Sides
SIDES = ("left", "right")
