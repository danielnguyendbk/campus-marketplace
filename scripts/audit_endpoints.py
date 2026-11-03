import yaml
import re
import sys

with open('packages/api-contract/openapi.yaml', 'r', encoding='utf-8') as f:
    spec = yaml.safe_load(f)

openapi_ops = {}
for path, methods in spec.get('paths', {}).items():
    for method, op in methods.items():
        if method.lower() in ['get', 'post', 'put', 'patch', 'delete']:
            openapi_ops[(method.upper(), path)] = op.get('summary', '')

print(f"Total OpenAPI operations: {len(openapi_ops)}")

def audit_file(rel_path):
    print(f"\n=== Auditing {rel_path} ===")
    with open(rel_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            # Check table lines
            if line.strip().startswith('|'):
                parts = [p.strip() for p in line.strip().split('|')]
                if len(parts) >= 5:
                    c2 = parts[2].strip('` ')
                    c3 = parts[3].strip('` ')
                    if c3 in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'CONNECT']:
                        endpoint = c2
                        method = c3
                        norm = re.sub(r'\{[a-zA-Z0-9_]+\}', '{param}', endpoint)
                        found = False
                        for (om, op), summary in openapi_ops.items():
                            if om == method and re.sub(r'\{[a-zA-Z0-9_]+\}', '{param}', op) == norm:
                                found = True
                                if op != endpoint:
                                    print(f"  Line {idx+1:2} [PARAM_DIFF] {method:6} {endpoint:35} -> OpenAPI: {op}")
                                break
                        if not found:
                            print(f"  Line {idx+1:2} [NOT_IN_OPENAPI] {method:6} {endpoint:35}")
                        continue
            
            # Check non-table / inline lines
            inline = re.findall(r'\b(GET|POST|PUT|PATCH|DELETE)\s+([/a-zA-Z0-9_\-\{\}]+)', line)
            for m, p in inline:
                p_clean = p.strip('`.,:;)')
                if not p_clean.startswith('/'):
                    continue
                norm = re.sub(r'\{[a-zA-Z0-9_]+\}', '{param}', p_clean)
                found = False
                for (om, op), summary in openapi_ops.items():
                    if om == m and re.sub(r'\{[a-zA-Z0-9_]+\}', '{param}', op) == norm:
                        found = True
                        if op != p_clean:
                            print(f"  Line {idx+1:2} [PARAM_DIFF] {m:6} {p_clean:35} -> OpenAPI: {op}")
                        break
                if not found:
                    print(f"  Line {idx+1:2} [NOT_IN_OPENAPI] {m:6} {p_clean:35}")

audit_file('docs/architecture/authorization_matrix.md')
audit_file('docs/api/integration_guide.md')
audit_file('docs/architecture/state_machines.md')
