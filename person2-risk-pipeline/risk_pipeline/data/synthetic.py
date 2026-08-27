from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from risk_pipeline.contracts import DataProvider, ProjectRecord


class SyntheticDataProvider(DataProvider):
    """Deterministic synthetic project provider; replace with a database provider later."""

    CATEGORIES = ("normal", "delayed", "high-cost", "payment-progress-mismatch", "low-utilization", "multivariate-unusual")

    def __init__(self, project_count: int = 25, seed: int = 7) -> None:
        if project_count < 1:
            raise ValueError("project_count must be positive")
        self.project_count = project_count
        self.seed = seed
        self._projects = self._generate()

    def _generate(self) -> tuple[ProjectRecord, ...]:
        randomizer = random.Random(self.seed)
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        projects: list[ProjectRecord] = []
        for index in range(self.project_count):
            category = self.CATEGORIES[index % len(self.CATEGORIES)]
            sanctioned = round(randomizer.uniform(5_000_000, 100_000_000), 2)
            cost = round(sanctioned * randomizer.uniform(0.55, 0.98), 2)
            planned_start = start + timedelta(days=index * 3)
            planned_end = planned_start + timedelta(days=randomizer.randint(180, 540))
            physical_progress = round(randomizer.uniform(25, 90), 2)
            released = round(cost * randomizer.uniform(0.35, 0.9), 2)
            paid = round(released * randomizer.uniform(0.6, 0.98), 2)
            utilized = round(paid * randomizer.uniform(0.55, 0.96), 2)
            actual_start = planned_start + timedelta(days=randomizer.randint(0, 30))
            actual_end = actual_start + timedelta(days=randomizer.randint(180, 600))
            if category == "delayed":
                actual_end += timedelta(days=randomizer.randint(90, 240))
                physical_progress = round(randomizer.uniform(10, 55), 2)
            elif category == "high-cost":
                cost = round(sanctioned * randomizer.uniform(0.94, 0.99), 2)
            elif category == "payment-progress-mismatch":
                paid = round(released * randomizer.uniform(0.9, 0.98), 2)
                physical_progress = round(randomizer.uniform(5, 30), 2)
            elif category == "low-utilization":
                utilized = round(paid * randomizer.uniform(0.05, 0.25), 2)
            elif category == "multivariate-unusual":
                cost = round(sanctioned * 0.97, 2)
                released = round(cost * 0.9, 2)
                paid = round(released * 0.97, 2)
                utilized = round(paid * 0.2, 2)
                physical_progress = 12.0
                actual_end += timedelta(days=300)
            projects.append(ProjectRecord(
                project_id=f"project-{index:04d}",
                sanctioned_amount=sanctioned,
                project_cost=cost,
                amount_released=released,
                amount_paid=paid,
                amount_utilized=utilized,
                physical_progress=physical_progress,
                planned_start=planned_start,
                planned_end=planned_end,
                actual_start=actual_start,
                actual_end=actual_end,
                implementing_agency=f"Agency-{index % 4 + 1}",
                district=f"District-{index % 5 + 1}",
                constituency=f"Constituency-{index % 8 + 1}",
                latitude=round(8.0 + randomizer.uniform(0, 27), 6),
                longitude=round(68.0 + randomizer.uniform(0, 29), 6),
                category=category,
                dataset_label="SYNTHETIC",
                metadata={"generator_seed": self.seed},
            ))
        return tuple(projects)

    def get_project(self, project_id: str) -> ProjectRecord | None:
        return next((project for project in self._projects if project.project_id == project_id), None)

    def get_projects(self) -> tuple[ProjectRecord, ...]:
        return self._projects

    def get_project_count(self) -> int:
        return len(self._projects)
