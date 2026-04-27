#!/bin/bash
set -euo pipefail

TRAJECTORY="/logs/agent/copilot-cli.jsonl"
REWARD_DIR="/logs/verifier"
REWARD_FILE="$REWARD_DIR/reward.txt"

mkdir -p "$REWARD_DIR"

if [ ! -f "$TRAJECTORY" ]; then
    echo "ERROR: Trajectory file not found at $TRAJECTORY"
    echo "0" > "$REWARD_FILE"
    exit 1
fi

echo "=== Trajectory contents (first 50 lines) ==="
head -50 "$TRAJECTORY"
echo ""
echo "=== Checking tool selection ==="

python3 -c "
import sys, json, re

events = []
for line in open('$TRAJECTORY'):
    line = line.strip()
    if not line:
        continue
    try:
        events.append(json.loads(line))
    except json.JSONDecodeError:
        continue

tool_uses = [e for e in events if e.get('type') == 'tool_use']
print(f'Found {len(tool_uses)} tool_use events')

if not tool_uses:
    print('FAIL: No tool_use events found')
    sys.exit(1)

pattern = re.compile(r'aks|kubernetes|azure', re.IGNORECASE)
required_params = ['prod-cluster', 'k8s-rg']

for tu in tool_uses:
    name = tu.get('name', '')
    print(f'  tool: {name}')
    if pattern.search(name):
        args_str = json.dumps(tu.get('input', {})).lower()
        missing = [p for p in required_params if p.lower() not in args_str]
        if not missing:
            print(f'PASS: Tool {name} called with all required params')
            sys.exit(0)
        else:
            print(f'WARN: Tool {name} matched but missing params: {missing}')

all_tools = [tu.get('name', '?') for tu in tool_uses]
print(f'FAIL: No matching tool found. Called: {all_tools}')
sys.exit(1)
"

RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "1" > "$REWARD_FILE"
    echo "RESULT: PASS"
else
    echo "0" > "$REWARD_FILE"
    echo "RESULT: FAIL"
fi
