"""
Tests for the Flask app. Run from the project root:  pytest -q

They use Flask's built-in test client, so no server needs to be running.
"""

import json
import os

import pytest

from app import app, get_consistency, get_grade, METRICS_PATH

VALID = {
    "gender": "female",
    "race_ethnicity": "group C",
    "parental_education": "bachelor's degree",
    "lunch": "standard",
    "test_prep": "none",
    "reading_score": 72,
    "writing_score": 74,
}


@pytest.fixture()
def client():
    app.config["TESTING"] = True
    return app.test_client()


def post(client, **overrides):
    return client.post("/predict", json={**VALID, **overrides})


# ── Basic routes ──────────────────────────────────────────────────────────────
def test_health_is_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_home_page_loads(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"EduPredict" in res.data


def test_metrics_has_required_keys(client):
    res = client.get("/metrics")
    assert res.status_code == 200
    data = res.get_json()
    for key in ("r2", "mae", "rmse", "deployed_model", "model_comparison", "feature_importance"):
        assert key in data
    assert 0 < data["r2"] < 1
    assert data["mae"] > 0 and data["rmse"] >= data["mae"]


# ── /predict: happy path ──────────────────────────────────────────────────────
def test_predict_valid_input(client):
    res = post(client)
    body = res.get_json()
    assert res.status_code == 200
    assert body["success"] is True
    assert 0 <= body["score"] <= 100
    assert body["grade"] in {"A+", "A", "B", "C", "D", "F"}
    assert 60 <= body["consistency"] <= 98


def test_predict_accepts_scores_sent_as_strings(client):
    # the browser form sends numbers as strings
    res = post(client, reading_score="72", writing_score="74")
    assert res.status_code == 200


def test_stronger_reading_and_writing_give_higher_math_prediction(client):
    low  = post(client, reading_score=30, writing_score=30).get_json()["score"]
    high = post(client, reading_score=90, writing_score=90).get_json()["score"]
    assert high > low


# ── /predict: bad input must be rejected with a clear 400 ─────────────────────
@pytest.mark.parametrize("field,value", [
    ("reading_score", 150),
    ("reading_score", -5),
    ("writing_score", 101),
    ("reading_score", "abc"),
    ("writing_score", None),
    ("gender", "robot"),
    ("race_ethnicity", "group Z"),
    ("lunch", "premium"),
    ("test_prep", "maybe"),
    ("parental_education", "phd"),
])
def test_predict_rejects_bad_values(client, field, value):
    res = post(client, **{field: value})
    body = res.get_json()
    assert res.status_code == 400
    assert body["success"] is False
    assert field in body["error"]


def test_predict_rejects_missing_field(client):
    payload = dict(VALID)
    del payload["lunch"]
    res = client.post("/predict", json=payload)
    assert res.status_code == 400


def test_predict_rejects_non_json_body(client):
    res = client.post("/predict", data="not json", content_type="text/plain")
    assert res.status_code == 400


# ── Pure functions ────────────────────────────────────────────────────────────
@pytest.mark.parametrize("score,grade", [
    (100, "A+"), (90, "A+"), (89.99, "A"), (80, "A"), (70, "B"),
    (60, "C"), (50, "D"), (49.99, "F"), (0, "F"),
])
def test_grade_boundaries(score, grade):
    assert get_grade(score)[0] == grade


def test_consistency_is_bounded():
    assert get_consistency(50, 50, 50) == 98.0          # perfectly consistent
    assert get_consistency(0, 100, 100) == 60.0         # very inconsistent, floored at 60


# ── Guard against the classic deployment bug: sklearn version mismatch ────────
def test_sklearn_version_matches_training():
    """
    The notebook cell (notebooks/export_metrics_cell.py) records the scikit-learn
    version used for training. A model pickled with one version can misbehave when
    loaded with another, so the installed version should match.
    """
    import sklearn

    with open(METRICS_PATH, encoding="utf-8") as f:
        trained_with = json.load(f).get("sklearn_version")
    if trained_with is None:
        pytest.skip("metrics.json has no sklearn_version yet; regenerate it from the notebook")
    assert sklearn.__version__ == trained_with, (
        f"Model trained with scikit-learn {trained_with} but {sklearn.__version__} is installed. "
        f"Pin scikit-learn=={trained_with} in requirements.txt."
    )
