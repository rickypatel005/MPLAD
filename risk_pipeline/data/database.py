from __future__ import annotations

from typing import Any, Sequence

from risk_pipeline.contracts import DataProvider, ProjectRecord


class DatabaseProvider(DataProvider):
    """Future database adapter; query and mapping are deliberately deferred."""

    def __init__(self, connection: Any) -> None:
        self.connection = connection

    def get_project(self, project_id: str) -> ProjectRecord | None:
        raise NotImplementedError("Implement database query and ProjectRecord mapping")

    def get_projects(self) -> Sequence[ProjectRecord]:
        raise NotImplementedError("Implement database query and ProjectRecord mapping")

    def get_project_count(self) -> int:
        raise NotImplementedError("Implement database count query")
