# Northstar + Orange Data Mining

Northstar uses Orange as a **Revenue Intelligence Lab**, not as a source of invented leads.

## What Northstar exports

The endpoint `GET /api/intelligence/orange` exports one row per real Northstar opportunity with:

- opportunity score
- website/contact/phone signals
- lead, reply and meeting counts
- deal and won-deal counts
- pipeline value
- attributed won revenue
- `converted` target

The dataset is intentionally derived from Northstar's own operational state. This lets Orange analyze which observable signals correlate with outcomes that Northstar actually recorded.

## Workflow

1. In Northstar, build up real opportunity and revenue outcomes.
2. Download `/api/intelligence/orange`.
3. Open the CSV in Orange Data Mining.
4. Set `converted` as the target.
5. Use Rank to inspect useful features.
6. Compare Random Forest and Logistic Regression in Test & Score.
7. Use Confusion Matrix to inspect false positives/negatives.
8. Only after enough labeled outcomes exist should the model influence automated prospect ranking.

Orange's workflow model is built around connected widgets for data loading, preprocessing, visualization, clustering and machine learning; its Test & Score workflow supports cross-validation of learners. citeturn0search0turn0search7

## Why this matters

This creates the Northstar feedback loop:

**Discover → Execute → Measure → Learn → Improve targeting → Execute again**

The first predictive threshold is intentionally conservative: Northstar flags the dataset as prediction-ready only after at least 20 opportunities have recorded deal outcomes. That is a guardrail, not a statistical guarantee.

## Current limitation

Orange is an analysis/workflow engine. It does not magically provide a proprietary worldwide business database. Northstar remains responsible for lawful, permitted data acquisition and for collecting enough real outcome data before training models.
