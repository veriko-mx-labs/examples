#!/usr/bin/env python3
"""Walk every page of the validation history.

    VERIKO_API_KEY=veriko_... python3 python/raw/list_validations.py

`per_page` accepts 1 to 50 on this listing; a larger value is clamped. Move forward with `page`
until `meta.pagination.total_pages`. Parameters the operation does not declare are ignored without
an error, so check the names.
Listing consumes no quota.
"""
# veriko:operation GET /validations query=page,per_page,from,to
from client import api, run, with_retry


def main() -> None:
    page, total_pages = 1, 1
    while page <= total_pages:
        response = with_retry(lambda: api("GET", "/validations", query={
            "page": page, "per_page": 50, "from": "2025-01-01", "to": "2025-12-31"}))
        for item in response.body["data"]:
            print(item["id"], item["attributes"]["status"])
        total_pages = response.body["meta"]["pagination"]["total_pages"]
        page += 1


run(main)
