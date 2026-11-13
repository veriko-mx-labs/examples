#!/usr/bin/env python3
"""Read and update the account retry policy, which re-queries validations that ended without a verdict.

    VERIKO_API_KEY=veriko_... python3 python/raw/retry_policy.py

A retry belongs to the original validation and consumes no extra quota. The update replaces the
whole policy; `max_retries` and `interval_seconds` have per-plan caps (`422 retry_policy_invalid`
above them). The policy applies to validations created afterwards.
"""
# veriko:operation GET /users/me/retry-policy
# veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes
import json

from client import api, run, with_retry


def main() -> None:
    current = api("GET", "/users/me/retry-policy").body
    print("Current:", json.dumps(current["data"]["attributes"]))
    print("Plan caps:", json.dumps((current.get("meta") or {}).get("caps")))

    updated = with_retry(lambda: api("PUT", "/users/me/retry-policy",
                                     headers={"Idempotency-Key": "example-retry-policy-v1"}, body={
        "retry_policy": {
            "enabled": True,
            "max_retries": 3,
            "interval_seconds": 600,  # 300 to 86400
            "outcomes": ["not_found", "cep_unavailable", "error"],
        },
    })).body
    print("Updated:", json.dumps(updated["data"]["attributes"]))


run(main)
