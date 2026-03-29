import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from .state import AgentState
from risk_model.predictor import compute_risk_score, get_alert_level
from prompts.library import PROMPTS

llm = ChatOpenAI(model="gpt-4o", streaming=False, temperature=0.3)


def retrieve_guidelines(state: AgentState) -> AgentState:
    """RAG node: retrieve relevant clinical guidelines"""
    try:
        from rag.retriever import retriever
        query = (
            f"Post-cardiac surgery patient, Day {state['patient_profile'].get('days_post_op')}. "
            f"Surgery: {state['patient_profile'].get('surgery_type')}. "
            f"Current concerns: HR {state['current_vitals'].get('heart_rate')} bpm, "
            f"SpO2 {state['current_vitals'].get('spo2')}%, "
            f"ECG: {state['current_vitals'].get('ecg_rhythm')}."
        )
        text = retriever.get_relevant_text(query, k=3)
        state["retrieved_guidelines"] = text
    except Exception as e:
        state["retrieved_guidelines"] = f"[Guidelines retrieval unavailable: {e}]"
    return state


def analyze_vitals(state: AgentState) -> AgentState:
    """GPT-4o node: analyze vitals against clinical context"""
    prompt = PROMPTS["vitals_analysis"].format(
        patient=state["patient_profile"],
        vitals=state["current_vitals"],
        history=state["vitals_history"][-24:],
        guidelines=state["retrieved_guidelines"],
    )
    response = llm.invoke([
        SystemMessage(content=PROMPTS["system"]),
        HumanMessage(content=prompt),
    ])
    state["clinical_reasoning"] = response.content
    return state


def score_risk(state: AgentState) -> AgentState:
    """Risk model node: compute numerical risk score"""
    score, reasons = compute_risk_score(
        patient=state["patient_profile"],
        vitals=state["current_vitals"],
        reasoning=state.get("clinical_reasoning", ""),
    )
    state["risk_analysis"] = {"score": score, "reasons": reasons}
    return state


def decide_alert(state: AgentState) -> str:
    """Conditional router: returns edge label"""
    vitals = state["current_vitals"]
    score = state["risk_analysis"]["score"] if state.get("risk_analysis") else 0
    return get_alert_level(score, vitals)


def generate_outreach_script(state: AgentState) -> AgentState:
    prompt = PROMPTS["outreach_script"].format(
        patient_profile=state["patient_profile"],
        clinical_reasoning=state.get("clinical_reasoning", ""),
        risk_analysis=state.get("risk_analysis", {}),
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    state["recommended_actions"] = state.get("recommended_actions") or []
    state["recommended_actions"].append({"type": "outreach", "content": response.content})
    return state


def generate_urgent_brief(state: AgentState) -> AgentState:
    prompt = PROMPTS["urgent_brief"].format(
        patient_profile=state["patient_profile"],
        clinical_reasoning=state.get("clinical_reasoning", ""),
        risk_analysis=state.get("risk_analysis", {}),
        current_vitals=state["current_vitals"],
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    state["recommended_actions"] = state.get("recommended_actions") or []
    state["recommended_actions"].append({"type": "urgent", "content": response.content})
    return state


def generate_summary(state: AgentState) -> AgentState:
    risk = state.get("risk_analysis", {})
    actions = state.get("recommended_actions", [])
    action_text = "\n\n".join([a["content"] for a in actions]) if actions else "No specific actions generated."

    prompt = f"""
    Generate a concise clinical summary for this patient case.

    PATIENT: {state['patient_profile']}
    CURRENT VITALS: {state['current_vitals']}
    CLINICAL REASONING: {state.get('clinical_reasoning', '')}
    RISK SCORE: {risk.get('score', 'N/A')}/100
    RISK REASONS: {risk.get('reasons', [])}
    RECOMMENDED ACTIONS: {action_text}

    Write a 150-200 word summary covering:
    - Overall patient status
    - Key concerns
    - Risk level and primary reasons
    - Recommended next actions
    - Time sensitivity

    Be clinical but scannable. Use bullet points for key items.
    """
    response = llm.invoke([
        SystemMessage(content=PROMPTS["system"]),
        HumanMessage(content=prompt),
    ])
    state["final_summary"] = response.content
    state["alert_level"] = decide_alert(state)
    return state
