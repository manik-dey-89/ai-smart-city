"""Add area_lat, area_lng, status, created_by to alerts

Revision ID: alert_latlon_status
Revises: initial
Create Date: 2026-10-04 00:01:00.000000

Adds the float-based location columns and status / created_by that the ORM
model uses. Safe to run on a fresh DB (columns may already exist if the
initial migration ran with the latest model — the IF NOT EXISTS guards handle that).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'alert_latlon_status'
down_revision: Union[str, None] = 'initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col_exists(table: str, col: str) -> bool:
    """Return True if the column already exists (works on SQLite and Postgres)."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c['name'] == col for c in insp.get_columns(table))


def upgrade() -> None:
    if not _col_exists('alerts', 'area_lat'):
        op.add_column('alerts', sa.Column('area_lat', sa.Float(), nullable=True))
    if not _col_exists('alerts', 'area_lng'):
        op.add_column('alerts', sa.Column('area_lng', sa.Float(), nullable=True))
    if not _col_exists('alerts', 'status'):
        op.add_column('alerts', sa.Column('status', sa.String(), nullable=True,
                                          server_default='active'))
    if not _col_exists('alerts', 'created_by'):
        op.add_column('alerts', sa.Column('created_by', sa.String(), nullable=True))


def downgrade() -> None:
    # Only drop columns that this migration added — leave status/created_by
    # if they came from the initial migration.
    for col in ('area_lat', 'area_lng'):
        if _col_exists('alerts', col):
            op.drop_column('alerts', col)
