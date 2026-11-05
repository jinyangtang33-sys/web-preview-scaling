"""Replay all three proposals without a model, browser, or filesystem mutation."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent
audit = json.loads((root / "budget-audit.json").read_text("utf-8"))
source_names = json.loads((root / "protocol.json").read_text("utf-8"))["source_hashes"]
for arm, lane in [("without", "lane-m"), ("with", "lane-n")]:
    originals = {name: (root / "source" / name).read_bytes() for name in source_names}
    texts = {name: data.decode("utf-8").replace("\r\n", "\n") for name, data in originals.items()}
    changed = set()
    for phase in range(1, 4):
        proposal = json.loads((root / f"{arm}-proposal-{phase}.json").read_text("utf-8"))
        for edit in proposal["patches"]:
            name = edit["path"]
            assert name in texts and edit["old"] and texts[name].count(edit["old"]) == 1
            texts[name] = texts[name].replace(edit["old"], edit["new"], 1)
            changed.add(name)
    for name, expected in audit["arms"][lane]["final_hashes_lf"].items():
        replay = texts[name].encode("utf-8") if name in changed else originals[name]
        actual = (root / arm / name).read_bytes()
        replay = replay.replace(b"\r\n", b"\n")
        actual = actual.replace(b"\r\n", b"\n")
        assert replay == actual and hashlib.sha256(actual).hexdigest() == expected, (arm, name)
    assert audit["arms"][lane]["code_replies"] == 3
    assert audit["arms"][lane]["model_tools"] == 0
    assert audit["arms"][lane]["elapsed_seconds"] <= audit["time_limit_seconds"]
    print(f"{arm}: three proposals reproduced all {len(originals)} final files; budget ledger valid")
