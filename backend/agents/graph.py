from langgraph.graph import StateGraph, START, END

from .state import AgentState
from .nodes import (
    retrieve_guidelines,
    analyze_vitals,
    score_risk,
    decide_alert,
    generate_outreach_script,
    generate_urgent_brief,
    generate_summary,
)


def build_graph():
    g = StateGraph(AgentState)

    g.add_node("retrieve_guidelines",       retrieve_guidelines)
    g.add_node("analyze_vitals",            analyze_vitals)
    g.add_node("score_risk",                score_risk)
    g.add_node("generate_outreach_script",  generate_outreach_script)
    g.add_node("generate_urgent_brief",     generate_urgent_brief)
    g.add_node("generate_summary",          generate_summary)

    g.add_edge(START, "retrieve_guidelines")
    g.add_edge("retrieve_guidelines", "analyze_vitals")
    g.add_edge("analyze_vitals", "score_risk")

    g.add_conditional_edges("score_risk", decide_alert, {
        "none":     "generate_summary",
        "low":      "generate_summary",
        "medium":   "generate_outreach_script",
        "high":     "generate_urgent_brief",
        "critical": "generate_urgent_brief",
    })

    g.add_edge("generate_outreach_script", "generate_summary")
    g.add_edge("generate_urgent_brief",    "generate_summary")
    g.add_edge("generate_summary",         END)

    return g.compile()


agent = build_graph()
