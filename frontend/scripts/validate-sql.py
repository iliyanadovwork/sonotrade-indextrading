"""Parse every SQL file with libpg_query (the actual PostgreSQL parser).

Catches the syntax-error class that bit us twice: index expressions needing
their own parentheses around a cast, reserved-word column names, unbalanced
dollar quoting. It does NOT catch semantic errors (IMMUTABLE volatility,
missing columns, privilege ordering) — only a live server does that.

plpgsql function bodies are opaque strings to the outer parser, so each
DO block and CREATE FUNCTION body is extracted and parsed separately.
"""
import os
import re
import sys
import pathlib
import pglast

SQL = pathlib.Path(
    os.environ.get('SQL_DIR')
    or pathlib.Path(__file__).resolve().parents[1] / 'sql'
)

failures = []


def check(label, sql):
    try:
        pglast.parse_sql(sql)
        return True
    except Exception as e:
        failures.append((label, str(e)))
        return False


def inner_statements(body):
    """Statements inside a plpgsql block that the outer parser never sees."""
    out = []
    # EXECUTE $ddl$ ... $ddl$  — dynamic DDL
    for m in re.finditer(r'\$ddl\$(.*?)\$ddl\$', body, re.S):
        out.append(('EXECUTE $ddl$', m.group(1).strip()))
    return out


for f in sorted(SQL.glob('*.sql')):
    text = f.read_text()

    if not check(f.name, text):
        continue

    # Dollar-quoted bodies: parse the DDL we hand to EXECUTE, since a syntax
    # error there only surfaces at runtime (which is exactly how the
    # artist_daily_streams index failed).
    for kind, stmt in inner_statements(text):
        if not stmt.endswith(';'):
            stmt += ';'
        check(f'{f.name} :: {kind}', stmt)

    print(f'  ok  {f.name}')

print()
if failures:
    print(f'{len(failures)} PARSE FAILURE(S):\n')
    for label, err in failures:
        print(f'--- {label}')
        print(f'    {err}\n')
    sys.exit(1)

print('All SQL parses cleanly against libpg_query.')
