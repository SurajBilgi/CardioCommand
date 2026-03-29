import asyncio
import json
import math
import random
from datetime import datetime
from typing import AsyncGenerator, Dict, Any

from .scenarios import SCENARIOS

_vitals_history: Dict[str, list] = {}

# Base home coordinates per patient — small random walk simulates the patient
# moving around their home or taking short walks during recovery
_HOME_COORDS: Dict[str, Dict] = {
    "john-mercer":  {"lat": 37.7749, "lng": -122.4194},
    "rosa-delgado": {"lat": 37.7849, "lng": -122.4094},
    "marcus-webb":  {"lat": 37.7649, "lng": -122.4394},
    "sarah-kim":    {"lat": 37.7949, "lng": -122.3994},
}

# Tracks cumulative drift per patient so the walk is continuous
_location_offsets: Dict[str, Dict] = {}

# Max drift radius in degrees (~200m at SF latitude)
_MAX_DRIFT = 0.0018

# Critical patients can "leave home" further to simulate an incident
_CRITICAL_DRIFT = 0.006


def _get_location(patient_id: str, scenario_key: str, tick: int) -> Dict:
    home = _HOME_COORDS.get(patient_id, {"lat": 37.7749, "lng": -122.4194})
    if patient_id not in _location_offsets:
        _location_offsets[patient_id] = {"dlat": 0.0, "dlng": 0.0}

    offs = _location_offsets[patient_id]
    is_critical = scenario_key == "afib_detected"

    # Slow sinusoidal walk — simulates wandering around the house
    max_drift = _CRITICAL_DRIFT if is_critical else _MAX_DRIFT
    speed = 0.00008 if is_critical else 0.00003

    offs["dlat"] += random.gauss(0, speed)
    offs["dlng"] += random.gauss(0, speed)

    # Elastic pull back toward home so patient doesn't drift too far
    offs["dlat"] *= 0.97
    offs["dlng"] *= 0.97

    # Clamp to max drift radius
    dist = math.sqrt(offs["dlat"] ** 2 + offs["dlng"] ** 2)
    if dist > max_drift:
        scale = max_drift / dist
        offs["dlat"] *= scale
        offs["dlng"] *= scale

    lat = round(home["lat"] + offs["dlat"], 6)
    lng = round(home["lng"] + offs["dlng"], 6)

    # Distance from home in meters (approx)
    dist_m = int(dist * 111_000)

    return {
        "lat": lat,
        "lng": lng,
        "dist_from_home_m": dist_m,
        "status": "away" if dist_m > 150 else "at_home",
    }


class VitalsSimulator:
    def __init__(self):
        self.active_scenarios: Dict[str, str] = {}
        self.ticks: Dict[str, int] = {}
        self._alert_clients: Dict[str, list] = {}
        self._demo_clients: list = []

    def set_scenario(self, patient_id: str, scenario_key: str):
        if scenario_key not in SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario_key}")
        self.active_scenarios[patient_id] = scenario_key
        self.ticks[patient_id] = 0
        _vitals_history[patient_id] = []

    def get_scenario(self, patient_id: str) -> str:
        return self.active_scenarios.get(patient_id, "normal_recovery")

    def _generate_reading(self, patient_id: str) -> dict:
        scenario_key = self.active_scenarios.get(patient_id, "normal_recovery")
        scenario = SCENARIOS[scenario_key]
        tick = self.ticks.get(patient_id, 0)
        self.ticks[patient_id] = tick + 1

        reading = {
            "timestamp": datetime.utcnow().isoformat(),
            "tick": tick,
            "scenario": scenario_key,
            "patient_id": patient_id,
        }

        for metric, config in scenario["vitals"].items():
            if "value" in config:
                reading[metric] = config["value"]
                continue

            base = config["base"]
            noise = config.get("noise", 0)
            trend = config.get("trend", "stable")

            value = base + random.gauss(0, noise) if noise > 0 else base

            if trend == "rising":
                value += min(tick * 0.02, 5)
            elif trend == "declining":
                value -= min(tick * 0.02, 5)
            elif trend == "irregular":
                value += math.sin(tick * 0.3) * noise * 2
            elif trend == "chaotic":
                value += random.uniform(-noise * 3, noise * 3)

            reading[metric] = round(value, 1)

        reading["risk_score"] = scenario["risk_score"]
        reading["alert"] = scenario.get("alert")

        # Attach live location to every reading
        reading["location"] = _get_location(patient_id, scenario_key, tick)

        _vitals_history.setdefault(patient_id, []).append(reading)
        if len(_vitals_history[patient_id]) > 2400:
            _vitals_history[patient_id] = _vitals_history[patient_id][-2400:]

        return reading

    async def stream(self, patient_id: str) -> AsyncGenerator[str, None]:
        if patient_id not in self.active_scenarios:
            self.active_scenarios[patient_id] = "early_warning"
            self.ticks[patient_id] = 0

        while True:
            reading = self._generate_reading(patient_id)
            yield json.dumps(reading)
            await asyncio.sleep(2.0)

    def get_history(self, patient_id: str, n: int = 240) -> list:
        return _vitals_history.get(patient_id, [])[-n:]

    def get_current(self, patient_id: str) -> dict:
        history = _vitals_history.get(patient_id, [])
        if history:
            return history[-1]
        reading = self._generate_reading(patient_id)
        return reading

    async def broadcast_alert(self, patient_id: str, alert: dict):
        clients = self._alert_clients.get(patient_id, [])
        dead = []
        for q in clients:
            try:
                await q.put(json.dumps(alert))
            except Exception:
                dead.append(q)
        for d in dead:
            clients.remove(d)

    async def broadcast_demo_event(self, event: dict):
        dead = []
        for q in self._demo_clients:
            try:
                await q.put(json.dumps(event))
            except Exception:
                dead.append(q)
        for d in dead:
            self._demo_clients.remove(d)

    def register_alert_client(self, patient_id: str, queue):
        self._alert_clients.setdefault(patient_id, []).append(queue)

    def unregister_alert_client(self, patient_id: str, queue):
        if patient_id in self._alert_clients and queue in self._alert_clients[patient_id]:
            self._alert_clients[patient_id].remove(queue)

    def register_demo_client(self, queue):
        self._demo_clients.append(queue)

    def unregister_demo_client(self, queue):
        if queue in self._demo_clients:
            self._demo_clients.remove(queue)


simulator = VitalsSimulator()

_DEFAULT_PATIENT_SCENARIOS = {
    "john-mercer":  "early_warning",
    "rosa-delgado": "afib_detected",
    "marcus-webb":  "pre_visit",
    "sarah-kim":    "full_recovery",
}

for _pid, _scen in _DEFAULT_PATIENT_SCENARIOS.items():
    simulator.set_scenario(_pid, _scen)
