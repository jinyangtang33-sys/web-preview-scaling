"""Replay three proposals and verify unchanged vendor bytes without model calls."""
from pathlib import Path
import json
import hashlib
import zipfile

root = Path(__file__).resolve().parent
protocol = json.loads((root / "protocol.json").read_text("utf-8"))
audit = json.loads((root / "budget-audit.json").read_text("utf-8"))
editable = ["index.html", "index.css", "index.js"]
with zipfile.ZipFile(root / "runtime.zip") as z:
    names = set(z.namelist())
    assert names == set(protocol["source_hashes"]) - set(editable)
    for name in names:
        assert hashlib.sha256(z.read(name)).hexdigest() == protocol["source_hashes"][name], name
for arm, lane in [("without", "lane-m"), ("with", "lane-n")]:
    texts = {name: (root / "source" / name).read_text("utf-8") for name in editable}
    for phase in range(1, 4):
        response = json.loads((root / f"{arm}-proposal-{phase}.json").read_text("utf-8"))
        for edit in response["patches"]:
            assert edit["path"] in editable and edit["old"]
            assert texts[edit["path"]].count(edit["old"]) == 1
            texts[edit["path"]] = texts[edit["path"]].replace(edit["old"], edit["new"], 1)
    for name in editable:
        actual = (root / arm / name).read_text("utf-8")
        assert texts[name] == actual, (arm, name)
        assert hashlib.sha256(actual.encode("utf-8")).hexdigest() == audit["arms"][lane]["editable_hashes_lf"][name]
    assert audit["arms"][lane]["code_replies"] == 3 and audit["arms"][lane]["model_tools"] == 0
    assert audit["arms"][lane]["elapsed_seconds"] <= 900
    print(arm, "three proposals reproduced; budget and all vendor files verified")
