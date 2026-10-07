#!/usr/bin/env bash
# End-to-end API smoke test. Usage: B=http://localhost:3000 bash scripts/smoke.sh
B=${B:-http://localhost:3000}
j(){ curl -s -m 40 -H 'Content-Type: application/json' "$@"; echo; }
echo "== health"; curl -s -m 5 $B/api/health; echo
echo "== create dataset"; DS=$(j -X POST $B/api/datasets -d '{"name":"Smoke news","content":"New home sales top forecasts\nHome sales rise in July\nIncrease in home sales in July\nJuly new home sales rise"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).dataset.id))'); echo DS=$DS
echo "== synthetic"; SY=$(j -X POST $B/api/datasets -d '{"name":"Smoke synthetic","synthetic":{"type":"medium","size":50000,"seed":7}}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).dataset.id))'); echo SY=$SY
echo "== new version"; j -X POST $B/api/datasets/$DS/versions -d '{"config":{"lowercase":true}}'
echo "== detail"; curl -s -m 10 "$B/api/datasets/$DS?limit=100" | head -c 150; echo
echo "== experiment (compare on dataset)"; EX=$(j -X POST $B/api/experiments -d "{\"name\":\"Smoke battle\",\"config\":{\"mode\":\"compare\",\"algorithms\":[\"kmp\",\"boyer-moore\",\"naive\"],\"source\":{\"kind\":\"dataset\",\"datasetId\":$SY,\"params\":{\"pattern\":\"ab\"}},\"parameters\":{\"repetitions\":2}}}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).experiment.id))'); echo EX=$EX
echo "== rerun"; curl -s -m 30 -X POST $B/api/experiments/$EX/rerun | head -c 120; echo
echo "== duplicate"; curl -s -m 10 -X POST $B/api/experiments/$EX/duplicate | head -c 120; echo
echo "== export csv"; j -X POST $B/api/reports/export -d "{\"experimentId\":$EX,\"format\":\"csv\"}" | head -3
echo "== challenge"; j -X POST $B/api/challenges/lps-1/submit -d '{"answer":"0,1,0,1,2,0,1,2,3,4,5"}' | head -c 120; echo
echo "== stats"; curl -s -m 10 $B/api/stats | head -c 200; echo
for p in /api/research / /algorithms /visualizer /benchmark /datasets /experiments /learning /challenges /research /reports/$EX; do echo -n "$p "; curl -s -m 10 -o /dev/null -w "%{http_code}\n" $B$p; done
echo "== stress (12 algorithms)"; curl -s -m 90 -X POST $B/api/benchmark/stress -H 'Content-Type: application/json' -d '{"algorithms":["naive","kmp","rabin-karp","boyer-moore","aho-corasick","trie","suffix-array","kasai","edit-distance","tfidf","inverted-index","similarity"],"workloads":["random","adversarial","worst-case"],"size":100000,"repetitions":1}' -o stress.out.json -w "stress %{http_code} %{time_total}s\n"
node -e 'const r=require("./stress.out.json");if(r.error)console.log(r.error);else{console.log("budgetExceeded",r.budgetExceeded);for(const row of r.rows)console.log(row.workload,Object.values(row.results).map(e=>e.algorithmId+":"+e.status+":"+e.runtimeMs.median.toFixed(1)+"ms:"+e.correctness.status).join(" "))}'; rm -f stress.out.json
echo DONE
