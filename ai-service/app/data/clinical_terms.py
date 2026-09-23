"""Curated clinical lexicons for the prescription / discharge-summary extractor.

DESIGN NOTE — why a lexicon and not a statistical model:

The project's governing rule is that clinical content is never *invented*. A
general-purpose statistical NER model will happily label an arbitrary token as a
DRUG with 0.6 confidence, and there is no way for a patient or an examiner to
audit why. Everything here is an explicit term with an explicit category, so any
entity the system reports can be traced to a line in this file.

spaCy supplies tokenisation, sentence segmentation and the matching engine;
medspaCy supplies clinical context (negation, historical, hypothetical, family)
and section detection. Neither is asked to *decide* what a drug is.

Coverage is deliberately India-weighted — generic names plus the brand names that
actually appear on prescriptions from Indian pharmacies — because that is what
this platform's documents look like.

Sources for the drug and condition names: WHO Model List of Essential Medicines
(22nd list), India's National List of Essential Medicines 2022, and ICD-11
category titles. No dosing guidance is encoded anywhere in this project.
"""
from __future__ import annotations

# --- Medications ------------------------------------------------------------
# generic -> list of surface forms (generic first, then common brands).
MEDICATIONS: dict[str, list[str]] = {
    # Analgesics / antipyretics
    "Paracetamol": ["paracetamol", "acetaminophen", "crocin", "dolo", "calpol", "dolo 650"],
    "Ibuprofen": ["ibuprofen", "brufen", "combiflam"],
    "Aspirin": ["aspirin", "acetylsalicylic acid", "ecosprin", "disprin"],
    "Diclofenac": ["diclofenac", "voveran", "volini"],
    "Tramadol": ["tramadol", "ultracet"],
    # Antibiotics
    "Amoxicillin": ["amoxicillin", "amoxycillin", "mox", "novamox"],
    "Amoxicillin-Clavulanate": ["amoxicillin-clavulanate", "co-amoxiclav", "augmentin", "clavam"],
    "Azithromycin": ["azithromycin", "azithral", "azee", "zithromax"],
    "Ciprofloxacin": ["ciprofloxacin", "ciplox", "cifran"],
    "Levofloxacin": ["levofloxacin", "levoflox"],
    "Doxycycline": ["doxycycline", "doxt", "doxy"],
    "Cefixime": ["cefixime", "taxim-o", "zifi"],
    "Ceftriaxone": ["ceftriaxone", "monocef"],
    "Metronidazole": ["metronidazole", "flagyl", "metrogyl"],
    # Diabetes
    "Metformin": ["metformin", "glycomet", "glucophage"],
    "Glimepiride": ["glimepiride", "amaryl", "glimy"],
    "Insulin Glargine": ["insulin glargine", "lantus", "basalog"],
    "Insulin Human": ["human insulin", "actrapid", "huminsulin"],
    "Sitagliptin": ["sitagliptin", "januvia", "istamet"],
    "Empagliflozin": ["empagliflozin", "jardiance"],
    # Cardiovascular
    "Atorvastatin": ["atorvastatin", "atorva", "lipitor", "storvas"],
    "Rosuvastatin": ["rosuvastatin", "rosuvas", "crestor"],
    "Amlodipine": ["amlodipine", "amlong", "amlopress"],
    "Telmisartan": ["telmisartan", "telma", "telsartan"],
    "Losartan": ["losartan", "losar", "repace"],
    "Ramipril": ["ramipril", "cardace"],
    "Metoprolol": ["metoprolol", "metolar", "betaloc"],
    "Clopidogrel": ["clopidogrel", "clopilet", "plavix"],
    "Furosemide": ["furosemide", "frusemide", "lasix"],
    # Gastro
    "Pantoprazole": ["pantoprazole", "pantop", "pan-d", "pan 40"],
    "Omeprazole": ["omeprazole", "omez"],
    "Rabeprazole": ["rabeprazole", "razo"],
    "Ondansetron": ["ondansetron", "emeset", "vomikind"],
    "Domperidone": ["domperidone", "domstal"],
    # Thyroid / hormones
    "Levothyroxine": ["levothyroxine", "thyronorm", "eltroxin", "thyrox"],
    # Respiratory
    "Salbutamol": ["salbutamol", "albuterol", "asthalin", "ventolin"],
    "Montelukast": ["montelukast", "montair", "montek"],
    "Budesonide": ["budesonide", "budecort"],
    "Cetirizine": ["cetirizine", "cetzine", "alerid"],
    "Levocetirizine": ["levocetirizine", "levocet", "xyzal"],
    # Supplements commonly prescribed
    "Vitamin D3": ["vitamin d3", "cholecalciferol", "calcirol", "uprise d3"],
    "Vitamin B12": ["vitamin b12", "cyanocobalamin", "methylcobalamin", "neurobion"],
    "Ferrous Sulphate": ["ferrous sulphate", "ferrous sulfate", "iron supplement", "livogen", "orofer"],
    "Folic Acid": ["folic acid", "folvite"],
    "Calcium Carbonate": ["calcium carbonate", "shelcal", "calcimax"],
}

# --- Conditions / diagnoses -------------------------------------------------
CONDITIONS: dict[str, list[str]] = {
    # The fully spelled-out forms are listed even though they contain the shorter
    # ones: the scanner claims spans longest-first, so without
    # "type 2 diabetes mellitus" the shorter generic "diabetes mellitus" would win
    # the span and the specific diagnosis would be reported as plain diabetes.
    "Type 2 Diabetes Mellitus": [
        "type 2 diabetes mellitus", "type ii diabetes mellitus",
        "diabetes mellitus type 2", "diabetes mellitus type ii",
        "type 2 diabetes", "type ii diabetes", "t2dm", "niddm",
    ],
    "Type 1 Diabetes Mellitus": [
        "type 1 diabetes mellitus", "type i diabetes mellitus",
        "diabetes mellitus type 1", "diabetes mellitus type i",
        "type 1 diabetes", "type i diabetes", "t1dm", "iddm",
    ],
    "Diabetes Mellitus": ["diabetes mellitus", "diabetes", "dm"],
    "Hypertension": ["hypertension", "high blood pressure", "htn", "raised blood pressure"],
    "Hypothyroidism": ["hypothyroidism", "underactive thyroid"],
    "Hyperthyroidism": ["hyperthyroidism", "overactive thyroid", "thyrotoxicosis"],
    "Iron Deficiency Anaemia": ["iron deficiency anaemia", "iron deficiency anemia", "ida"],
    "Anaemia": ["anaemia", "anemia"],
    "Dyslipidaemia": ["dyslipidaemia", "dyslipidemia", "hyperlipidaemia", "hyperlipidemia", "high cholesterol"],
    "Asthma": ["asthma", "bronchial asthma"],
    "Chronic Obstructive Pulmonary Disease": ["copd", "chronic obstructive pulmonary disease"],
    "Coronary Artery Disease": ["coronary artery disease", "cad", "ischaemic heart disease", "ischemic heart disease"],
    "Chronic Kidney Disease": ["chronic kidney disease", "ckd", "renal impairment"],
    "Fatty Liver Disease": ["fatty liver", "hepatic steatosis", "nafld"],
    "Urinary Tract Infection": ["urinary tract infection", "uti"],
    "Upper Respiratory Tract Infection": ["upper respiratory tract infection", "urti"],
    "Gastritis": ["gastritis", "acid peptic disease", "apd"],
    "Gastro-oesophageal Reflux Disease": ["gerd", "gord", "acid reflux", "reflux disease"],
    "Migraine": ["migraine"],
    "Vitamin D Deficiency": ["vitamin d deficiency", "hypovitaminosis d"],
    "Vitamin B12 Deficiency": ["vitamin b12 deficiency", "b12 deficiency"],
    "Obesity": ["obesity"],
    "Dengue Fever": ["dengue", "dengue fever"],
    "Enteric Fever": ["typhoid", "enteric fever"],
    "Tuberculosis": ["tuberculosis", "pulmonary tuberculosis", "ptb"],
}

# --- Procedures / investigations --------------------------------------------
PROCEDURES: dict[str, list[str]] = {
    "Electrocardiogram": ["electrocardiography", "electrocardiogram", "ecg", "ekg"],
    "Echocardiogram": ["echocardiography", "echocardiogram", "2d echo", "echo"],
    "Chest X-ray": ["chest x-ray", "chest xray", "cxr"],
    "Ultrasound Abdomen": ["ultrasound abdomen", "usg abdomen", "abdominal ultrasound", "usg whole abdomen"],
    "CT Scan": ["ct scan", "computed tomography"],
    "MRI": ["mri", "magnetic resonance imaging"],
    "Endoscopy": ["endoscopy", "upper gi endoscopy", "ogd"],
    "Colonoscopy": ["colonoscopy"],
    "Mammography": ["mammography", "mammogram"],
    "Dialysis": ["dialysis", "haemodialysis", "hemodialysis"],
    "Angioplasty": ["angioplasty", "ptca"],
    "Appendicectomy": ["appendicectomy", "appendectomy"],
    "Cholecystectomy": ["cholecystectomy", "gall bladder removal"],
}

# --- Allergens --------------------------------------------------------------
ALLERGENS: dict[str, list[str]] = {
    "Penicillin": ["penicillin", "penicillins"],
    "Sulfa Drugs": ["sulfa", "sulphonamides", "sulfonamides"],
    "Aspirin": ["aspirin"],
    "NSAIDs": ["nsaid", "nsaids"],
    "Peanuts": ["peanut", "peanuts"],
    "Shellfish": ["shellfish", "prawn", "prawns"],
    "Dust": ["dust", "dust mite", "dust mites"],
    "Pollen": ["pollen"],
    "Lactose": ["lactose"],
    "Iodine Contrast": ["iodine", "contrast dye", "iodinated contrast"],
}

# --- Dose forms and routes --------------------------------------------------
DOSE_FORMS = [
    "tablet", "tablets", "tab", "tabs", "capsule", "capsules", "cap", "caps",
    "syrup", "suspension", "injection", "inj", "drops", "ointment", "cream",
    "inhaler", "puff", "puffs", "sachet", "spray", "gel", "lotion", "patch",
]

ROUTES: dict[str, list[str]] = {
    "oral": ["oral", "orally", "by mouth", "p.o.", "po"],
    "intravenous": ["intravenous", "iv", "i.v."],
    "intramuscular": ["intramuscular", "im", "i.m."],
    "subcutaneous": ["subcutaneous", "sc", "s.c.", "subcut"],
    "topical": ["topical", "topically", "local application"],
    "inhaled": ["inhaled", "inhalation", "nebulised", "nebulized"],
    "sublingual": ["sublingual", "under the tongue"],
    "rectal": ["rectal", "per rectum", "pr"],
}

# Latin / Indian prescription frequency abbreviations, expanded to plain English
# for the patient. The expansion is a translation, never a recommendation.
FREQUENCIES: dict[str, list[str]] = {
    "once daily": ["once daily", "once a day", "od", "o.d.", "qd", "q.d.", "1-0-0", "0-0-1", "daily"],
    "twice daily": ["twice daily", "twice a day", "bd", "b.d.", "bid", "b.i.d.", "1-0-1", "1-1-0"],
    "three times daily": ["three times daily", "thrice daily", "tds", "t.d.s.", "tid", "t.i.d.", "1-1-1"],
    "four times daily": ["four times daily", "qds", "q.d.s.", "qid", "q.i.d.", "1-1-1-1"],
    "at bedtime": ["at bedtime", "at night", "hs", "h.s.", "nocte", "bedtime"],
    "as needed": ["as needed", "when required", "sos", "s.o.s.", "prn", "p.r.n.", "if needed"],
    "every 4 hours": ["every 4 hours", "q4h", "4 hourly"],
    "every 6 hours": ["every 6 hours", "q6h", "6 hourly"],
    "every 8 hours": ["every 8 hours", "q8h", "8 hourly"],
    "every 12 hours": ["every 12 hours", "q12h", "12 hourly"],
    "weekly": ["weekly", "once a week", "once weekly"],
}

# Food timing is NOT a dosing frequency. Keeping the two in one table made the
# longest-match scan return "after food" for "Metformin 500 mg 1-0-1 after food",
# losing the actual schedule. They are separate fields because they answer
# separate questions: how often, and when relative to meals.
FOOD_TIMING: dict[str, list[str]] = {
    "before food": ["before food", "before meals", "before meal", "ac", "a.c.", "empty stomach"],
    "after food": ["after food", "after meals", "after meal", "pc", "p.c.", "with food"],
}


def _invert(mapping: dict[str, list[str]]) -> dict[str, str]:
    """surface form (lowercased) -> canonical label."""
    out: dict[str, str] = {}
    for canonical, surfaces in mapping.items():
        for surface in surfaces:
            out[surface.lower()] = canonical
    return out


MEDICATION_LOOKUP = _invert(MEDICATIONS)
CONDITION_LOOKUP = _invert(CONDITIONS)
PROCEDURE_LOOKUP = _invert(PROCEDURES)
ALLERGEN_LOOKUP = _invert(ALLERGENS)
ROUTE_LOOKUP = _invert(ROUTES)
FREQUENCY_LOOKUP = _invert(FREQUENCIES)
FOOD_TIMING_LOOKUP = _invert(FOOD_TIMING)

LEXICON_SIZES = {
    "medications": len(MEDICATION_LOOKUP),
    "conditions": len(CONDITION_LOOKUP),
    "procedures": len(PROCEDURE_LOOKUP),
    "allergens": len(ALLERGEN_LOOKUP),
    "routes": len(ROUTE_LOOKUP),
    "frequencies": len(FREQUENCY_LOOKUP),
    "foodTiming": len(FOOD_TIMING_LOOKUP),
}
