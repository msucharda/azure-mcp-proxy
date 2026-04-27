#!/usr/bin/env python3
"""Shared verifier for Azure MCP tool selection evals.

Parses the Copilot CLI JSONL trajectory and checks whether the agent
invoked the expected Azure MCP tool with the required parameters.

Usage:
    python verify_tool.py <trajectory_path> <expected_tool_pattern> [required_param ...]

Exit code 0 = pass, 1 = fail.
Writes reward (1 or 0) to /logs/verifier/reward.txt.
"""

import json
import os
import re
import sys
from pathlib import Path


REWARD_DIR = Path("/logs/verifier")
REWARD_FILE = REWARD_DIR / "reward.txt"


def read_trajectory(path: str) -> list[dict]:
    """Read and parse JSONL trajectory file."""
    events = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        print(f"ERROR: Trajectory file not found: {path}", file=sys.stderr)
    return events


def extract_tool_uses(events: list[dict]) -> list[dict]:
    """Extract all tool_use events from the trajectory."""
    return [e for e in events if e.get("type") == "tool_use"]


def check_tool_selection(
    tool_uses: list[dict],
    expected_pattern: str,
    required_params: list[str],
) -> tuple[bool, str]:
    """Check if any tool_use matches the expected pattern and params.

    Args:
        tool_uses: List of tool_use events from trajectory.
        expected_pattern: Regex pattern to match against tool name.
        required_params: List of strings that must appear (case-insensitive)
                         in the serialized tool arguments.

    Returns:
        (passed, reason) tuple.
    """
    if not tool_uses:
        return False, "No tool_use events found in trajectory"

    pattern = re.compile(expected_pattern, re.IGNORECASE)

    for tool_use in tool_uses:
        tool_name = tool_use.get("name", "")

        if not pattern.search(tool_name):
            continue

        # Tool name matches — check required params
        args = tool_use.get("input", {})
        args_str = json.dumps(args).lower()

        missing = []
        for param in required_params:
            if param.lower() not in args_str:
                missing.append(param)

        if missing:
            return (
                False,
                f"Tool '{tool_name}' matched but missing params: {missing}",
            )

        return True, f"PASS: Tool '{tool_name}' called with all required params"

    # No matching tool found
    called_tools = [t.get("name", "?") for t in tool_uses]
    return (
        False,
        f"No tool matching /{expected_pattern}/ found. Called tools: {called_tools}",
    )


def write_reward(passed: bool) -> None:
    """Write reward file for Harbor verifier."""
    REWARD_DIR.mkdir(parents=True, exist_ok=True)
    REWARD_FILE.write_text("1" if passed else "0")


def main() -> None:
    if len(sys.argv) < 3:
        print(
            "Usage: verify_tool.py <trajectory_path> <expected_tool_pattern> "
            "[required_param ...]",
            file=sys.stderr,
        )
        sys.exit(1)

    trajectory_path = sys.argv[1]
    expected_pattern = sys.argv[2]
    required_params = sys.argv[3:]

    events = read_trajectory(trajectory_path)
    tool_uses = extract_tool_uses(events)

    print(f"Found {len(events)} events, {len(tool_uses)} tool_use events")
    for tu in tool_uses:
        print(f"  tool_use: {tu.get('name', '?')}")

    passed, reason = check_tool_selection(tool_uses, expected_pattern, required_params)
    print(reason)

    write_reward(passed)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
