"""
app.py — Student Performance Prediction
Flask backend: model inference + metrics API.

Endpoints
  GET  /         dashboard page
  POST /predict  JSON in -> predicted math score out (validated)
  GET  /metrics  model results read from model/metrics.json
  GET  /health   liveness check
"""

import json
import math
import os

import joblib
import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# ── Load model + metrics ──────────────────────────────────────────────────────
MODEL_PATH   = os.getenv("MODEL_PATH",   "model/student_model.pkl")
METRICS_PATH = os.getenv("METRICS_PATH", "model/metrics.json")

model = joblib.load(MODEL_PATH)


def load_metrics(path):
    """Read metrics.json written by the training notebook. None if unavailable."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


METRICS = load_metrics(METRICS_PATH)

# ── Input rules (must match the values used when the model was trained) ───────
CATEGORIES = {
    "gender"            : {"female", "male"},
    "race_ethnicity"    : {f"group {c}" for c in "ABCDE"},
    "parental_education": {"some high school", "high school", "some college",
                           "associate's degree", "bachelor's degree", "master's degree"},
    "lunch"             : {"standard", "free/reduced"},
    "test_prep"         : {"none", "completed"},
}
SCORE_FIELDS = ("reading_score", "writing_score")


def validate_payload(data):
    """Return a clean dict, or raise ValueError with a message the user can act on."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    clean = {}
    for field, allowed in CATEGORIES.items():
        value = data.get(field)
        if not (isinstance(value, str) and value in allowed):
            raise ValueError(f"'{field}' must be one of: {', '.join(sorted(allowed))}.")
        clean[field] = value

    for field in SCORE_FIELDS:
        try:
            value = float(data.get(field))
        except (TypeError, ValueError):
            raise ValueError(f"'{field}' must be a number between 0 and 100.")
        if not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError(f"'{field}' must be a number between 0 and 100.")
        clean[field] = value

    return clean


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_grade(score):
    if score >= 90: return "A+", "Outstanding"
    if score >= 80: return "A",  "Excellent"
    if score >= 70: return "B",  "Good"
    if score >= 60: return "C",  "Average"
    if score >= 50: return "D",  "Below Average"
    return "F", "Needs Improvement"


def get_consistency(score, reading, writing):
    """
    Heuristic 60-98 score: how close the predicted math score is to the student's
    reading/writing average. NOT a statistical confidence interval.
    """
    avg_rw = (reading + writing) / 2
    value  = 98 - abs(score - avg_rw) * 0.8
    return round(max(60, min(98, value)), 1)


def build_features(clean):
    """One-row DataFrame whose column names match the training data exactly."""
    reading, writing = clean["reading_score"], clean["writing_score"]
    return pd.DataFrame([{
        "gender"                      : clean["gender"],
        "race/ethnicity"              : clean["race_ethnicity"],
        "parental level of education" : clean["parental_education"],
        "lunch"                       : clean["lunch"],
        "test preparation course"     : clean["test_prep"],
        "reading score"               : reading,
        "writing score"               : writing,
        "avg_rw_score"                : (reading + writing) / 2,
    }])


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        clean = validate_payload(request.get_json(silent=True))
    except ValueError as err:
        return jsonify({"success": False, "error": str(err)}), 400

    try:
        raw_pred     = float(model.predict(build_features(clean))[0])
        pred_score   = round(min(100, max(0, raw_pred)), 2)
        grade, label = get_grade(pred_score)
        reading, writing = clean["reading_score"], clean["writing_score"]

        return jsonify({
            "success"     : True,
            "score"       : pred_score,
            "grade"       : grade,
            "label"       : label,
            "consistency" : get_consistency(pred_score, reading, writing),
            "breakdown"   : {
                "math"    : pred_score,
                "reading" : reading,
                "writing" : writing,
                "average" : round((pred_score + reading + writing) / 3, 2),
            },
        })
    except Exception:
        app.logger.exception("Prediction failed")
        return jsonify({"success": False, "error": "Prediction failed on the server."}), 500


@app.route("/metrics")
def metrics():
    if METRICS is None:
        return jsonify({"error": f"{METRICS_PATH} not found or invalid."}), 503
    return jsonify(METRICS)


@app.route("/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH, "metrics_loaded": METRICS is not None})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
