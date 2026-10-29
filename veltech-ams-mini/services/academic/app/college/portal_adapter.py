from __future__ import annotations

"""
Compatibility wrapper for the college portal adapter.

The active implementation lives in:

    app/services/parent_portal/veltech_adapter.py

Keep this module so older imports of:

    app.college.portal_adapter.PortalAdapter

continue to work.

Do not maintain a second copy of the Parent Portal login,
attendance parser or subject parser here.
"""

from app.services.parent_portal.veltech_adapter import (
    VeltechAdapter,
)


class PortalAdapter(VeltechAdapter):
    """Backward-compatible alias for VeltechAdapter."""

    pass
