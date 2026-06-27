"""Politeness — robots.txt + crawl-delay + jitter (NOT IMPLEMENTED in Phase 1).

Phase 2: cache robots.txt per host, respect Disallow + crawl-delay, add jittered
delays, set a real User-Agent. Satisfies the TZ "responsible data collection" rule.
"""


def is_allowed(url: str) -> bool:
    raise NotImplementedError("robots policy lands in the 'one source end-to-end' pass")
