# Project Risk Detection & Explainability System

## 📌 What is this project?

This project is a **Project Risk Detection System**.

Its job is to take project data and determine whether a project shows signs of risk, unusual behavior, financial inconsistency, delay, or other problems.

The system does not depend on only one ML model.

Instead, it combines:

- Data validation
- Feature engineering
- Business rules
- Statistical analysis
- Isolation Forest anomaly detection
- Supervised ML prediction (ready for real labelled data)
- Risk aggregation
- Explainable reasons
- REST API

The final output looks like:

```text
Project
   ↓
Risk Score
   ↓
Risk Level
   ↓
Reasons explaining the risk