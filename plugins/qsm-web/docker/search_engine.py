"""Make DuckDuckGo the search engine of the address bar in the fetched Camoufox.

Camoufox removes every search engine and makes "None", which posts to
127.0.0.1, the default, so a word typed in the address bar of the live view
ends on "Problem loading page". A page cannot read which engine the browser
has, so this adds nothing a site can measure.
"""

import json
from pathlib import Path

(path,) = Path.home().glob(".cache/camoufox/browsers/*/*/distribution/policies.json")
policies = json.loads(path.read_text())
engines = policies["policies"]["SearchEngines"]
engines["Add"] = [
    {
        "Name": "DuckDuckGo Search",
        "Description": "DuckDuckGo",
        "Alias": "@ddg",
        "Method": "GET",
        "URLTemplate": "https://duckduckgo.com/?q={searchTerms}",
    }
]
engines["Default"] = "DuckDuckGo Search"
path.write_text(json.dumps(policies, indent=2))
print("search engine:", engines["Default"], "in", path)
