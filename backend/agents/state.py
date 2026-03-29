from typing import TypedDict, Optional, List, Any


class AgentState(TypedDict):
    patient_id: str
    patient_profile: dict
    current_vitals: dict
    vitals_history: list
    retrieved_guidelines: str
    risk_analysis: Optional[Any]
    clinical_reasoning: Optional[str]
    recommended_actions: Optional[List[dict]]
    alert_level: Optional[str]
    final_summary: Optional[str]
    messages: list
