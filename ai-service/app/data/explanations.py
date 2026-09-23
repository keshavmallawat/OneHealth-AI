"""Plain-language, non-diagnostic notes used by the deterministic summary.

SAFETY RULES applied to every string in this file:
  * Describes what the parameter measures and what a high/low reading commonly
    prompts a clinician to look at. It never states a diagnosis.
  * Never recommends a medicine, dose, supplement or treatment.
  * Always frames the next step as a conversation with a qualified clinician.
These strings are static text reviewed by a human - they are not model output.
"""
from __future__ import annotations

EXPLANATIONS: dict[str, dict[str, str]] = {
    "HEMOGLOBIN": {
        "LOW": "A lower-than-usual haemoglobin level is commonly associated with anaemia, "
               "which can cause tiredness or breathlessness. Doctors usually look at iron "
               "studies and the rest of the blood count before drawing any conclusion.",
        "HIGH": "A higher-than-usual haemoglobin level can occur with dehydration, smoking "
                "or living at high altitude, among other causes. It is usually rechecked "
                "alongside the rest of the blood count.",
    },
    "WBC": {
        "LOW": "A lower white cell count can follow some viral infections or medicines. "
               "It is normally interpreted together with the differential count.",
        "HIGH": "A raised white cell count most often reflects the body responding to an "
                "infection or inflammation, and is usually rechecked once you are well.",
    },
    "RBC": {
        "LOW": "A lower red cell count often accompanies a low haemoglobin and is "
               "interpreted together with it.",
        "HIGH": "A raised red cell count is interpreted alongside haemoglobin and "
                "haematocrit, and can reflect dehydration among other causes.",
    },
    "PLATELETS": {
        "LOW": "A lower platelet count means fewer of the cells that help blood clot. "
               "Mild reductions are common and are usually simply rechecked.",
        "HIGH": "A raised platelet count is frequently a temporary reaction to infection "
                "or inflammation and is usually confirmed on a repeat sample.",
    },
    "GLUCOSE_FASTING": {
        "LOW": "A low fasting glucose reading can occur after a long fast or with certain "
               "medicines, and is usually confirmed with a repeat test.",
        "HIGH": "A fasting glucose above the usual range is what doctors use to screen for "
                "prediabetes and diabetes. A single reading is not enough to decide - it is "
                "normally confirmed with a repeat test or an HbA1c.",
    },
    "HBA1C": {
        "LOW": "A low HbA1c is uncommon and is generally interpreted alongside your "
               "haemoglobin and red cell results.",
        "HIGH": "HbA1c reflects your average blood sugar over roughly the last three "
                "months. A raised value is the main measure doctors use when assessing "
                "prediabetes or diabetes control.",
    },
    "CREATININE": {
        "LOW": "A low creatinine is often related to lower muscle mass and is usually not "
               "a concern on its own.",
        "HIGH": "A raised creatinine can indicate the kidneys are filtering less "
                "efficiently, but it is also affected by hydration, muscle mass and recent "
                "exercise. Doctors normally look at eGFR alongside it.",
    },
    "TSH": {
        "LOW": "A low TSH can point towards an overactive thyroid and is normally followed "
               "up with free T4 and T3 measurements.",
        "HIGH": "A raised TSH can point towards an underactive thyroid and is normally "
                "followed up with free T4 measurement before anything is concluded.",
    },
    "CHOLESTEROL_TOTAL": {
        "LOW": "A low total cholesterol is rarely a concern on its own and is read "
               "alongside the rest of the lipid profile.",
        "HIGH": "A total cholesterol above the desirable level is one of several factors "
                "doctors weigh when estimating long-term heart risk, together with LDL, "
                "HDL, blood pressure and lifestyle.",
    },
    "LDL": {
        "LOW": "A low LDL is generally considered favourable for heart health.",
        "HIGH": "LDL is the cholesterol fraction most closely linked to build-up in the "
                "arteries, so a raised value is usually discussed as part of your overall "
                "cardiovascular risk rather than in isolation.",
    },
    "HDL": {
        "LOW": "HDL helps clear cholesterol from the circulation, so a lower value is "
               "generally considered less favourable and is usually discussed alongside "
               "activity levels and the rest of the lipid profile.",
        "HIGH": "A higher HDL is generally considered favourable for heart health.",
    },
    "TRIGLYCERIDES": {
        "LOW": "A low triglyceride level is not usually a concern on its own.",
        "HIGH": "Triglycerides are strongly affected by what you ate before the test, "
                "alcohol and recent illness, so a raised value is often rechecked after a "
                "proper fast before any conclusion is drawn.",
    },
    "ALT": {
        "LOW": "A low ALT is not usually clinically significant.",
        "HIGH": "ALT rises when liver cells are irritated. Mild elevations are common and "
                "can follow recent alcohol, some medicines or a recent infection; doctors "
                "usually repeat the test before investigating further.",
    },
    "AST": {
        "LOW": "A low AST is not usually clinically significant.",
        "HIGH": "AST can rise from the liver but also from muscle, so recent strenuous "
                "exercise can raise it. It is interpreted alongside ALT.",
    },
}


def note_for(key: str, status: str) -> str | None:
    return EXPLANATIONS.get(key, {}).get(status)
