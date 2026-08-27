from __future__ import annotations

import math
from datetime import datetime
from typing import Sequence

from risk_pipeline.contracts import ProjectRecord, Validator


class BasicValidator(Validator):
    def validate(self, records: Sequence[ProjectRecord]) -> Sequence[ProjectRecord]:
        if not records:
            raise ValueError("No records received")
        seen: set[str] = set()
        for record in records:
            values = (record.project_id, record.implementing_agency, record.district, record.constituency, record.category, record.dataset_label, record.planned_start, record.planned_end)
            if any(value is None or (isinstance(value, str) and not value.strip()) for value in values):
                raise ValueError(f"Missing required value for {record.project_id!r}")
            if not record.project_id or record.project_id in seen:
                raise ValueError(f"Invalid or duplicate project_id: {record.project_id!r}")
            if record.physical_progress is None or not math.isfinite(record.physical_progress) or not 0 <= record.physical_progress <= 100:
                raise ValueError(f"Invalid physical progress for {record.project_id}")
            amounts = (record.sanctioned_amount, record.project_cost, record.amount_released, record.amount_paid, record.amount_utilized)
            if any(amount is None or not math.isfinite(amount) or amount < 0 for amount in amounts) or record.project_cost > record.sanctioned_amount:
                raise ValueError(f"Invalid project finances for {record.project_id}")
            if not (record.amount_utilized <= record.amount_paid <= record.amount_released <= record.project_cost):
                raise ValueError(f"Invalid release/payment/utilization relationship for {record.project_id}")
            if not isinstance(record.planned_start, datetime) or not isinstance(record.planned_end, datetime):
                raise ValueError(f"Invalid dates for {record.project_id}")
            if (record.actual_start is None) != (record.actual_end is None):
                raise ValueError(f"Incomplete actual dates for {record.project_id}")
            if record.planned_end <= record.planned_start or (record.actual_start and record.actual_end and record.actual_end < record.actual_start):
                raise ValueError(f"Invalid dates for {record.project_id}")
            if record.latitude is None or record.longitude is None or not math.isfinite(record.latitude) or not math.isfinite(record.longitude) or not -90 <= record.latitude <= 90 or not -180 <= record.longitude <= 180:
                raise ValueError(f"Invalid coordinates for {record.project_id}")
            seen.add(record.project_id)
        return records
