"""Render observations only; historical interpretation lives in a separate file."""
import collections
import json
import os
import pathlib
import statistics


def render(summary):
    rows = summary['rows']
    campaigns = {row['id']: row for row in rows}
    statuses = collections.Counter(row['status'] for row in campaigns.values())
    rounds = sum(row['rounds'] for row in campaigns.values())
    lines = [
        '# Campaign observations', '',
        f"**{len(campaigns):,} campaigns · {rounds:,} completed rounds · {len(rows):,} faction observations.**", '',
        'This report is computed from the selected summary.json. Endpoint totals can change with wall-clock cutoffs. '
        'Campaigns can share geography and are not independent maps. '
        'Historical conclusions about the committed baseline are kept separately in BASELINE_INTERPRETATION.md; '
        'they do not describe a newly collected policy.', '',
        '## Recorded campaign endpoints', '', '| Status | Campaigns |', '| --- | ---: |',
    ]
    lines += [f'| {status} | {count:,} |' for status, count in sorted(statuses.items())]
    lines += ['', '## Comparable observations at round 100', '',
              'Only recorded distant-start checkpoints are shown. The observation count states the denominator; '
              'missing checkpoints are not imputed. Medians can be fractional.', '',
              '| Terrain | Cities in world | Faction observations | Median owned cities | Median armies ashore | Median transports | Total landing events |',
              '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    checkpoints = [row for row in summary.get('common100', []) if row['profile'] == 'distant']
    for layout, density in sorted({(row['layout'], row['density']) for row in checkpoints}):
        group = [row for row in checkpoints if row['layout'] == layout and row['density'] == density]
        medians = [statistics.median(row[key] for row in group) for key in ['cities', 'ashore', 'transports']]
        lines.append(f'| {layout} | {density} | {len(group)} | ' +
                     ' | '.join(f'{value:g}' for value in medians) +
                     f" | {sum(row['landings'] for row in group):,} |")
    metrics = [
        ('Neutral-city capture events', 'neutralCaptures'),
        ('Hostile-city capture events', 'hostileCaptures'),
        ('Distinct faction/city pairs captured from a rival', 'hostileUniqueCities'),
        ('Those pairs still held at the endpoint', 'hostileCitiesRetained'),
        ('Landing events', 'landed'), ('Unique landed armies within each campaign', 'uniqueLanded'),
        ('Additional landings by already-landed armies', 'repeatLandingEvents'),
        ('Ordinary loaded transport move steps', 'loadedSteps'),
        ('Ordinary empty transport move steps', 'emptySteps'),
        ('Observed loaded departures from ports', 'loadedPortDepartures'),
        ('Full-load port departures', 'fullPortDepartures'),
        ('Port departures toward a still-hostile city', 'hostilePortDepartures'),
        ('Full-load departures in that hostile subset', 'hostileFullPortDepartures'),
        ('Transport hulls lost', 'transportsLost'),
        ('Loaded transports lost', 'loadedTransportsLost'), ('Cargo lost with transports', 'cargoLost'),
    ]
    for profile in sorted({row['profile'] for row in rows}):
        group = [row for row in rows if row['profile'] == profile]
        runs = {row['id']: row for row in group}
        lines += ['', f'## Full recorded horizons: {profile}', '',
                  f"{len(runs):,} campaigns · {sum(row['rounds'] for row in runs.values()):,} rounds · {len(group):,} faction observations. "
                  'These totals are descriptive, not equal-horizon rates.', '',
                  '| Measurement | Total |', '| --- | ---: |']
        lines += [f"| {label} | {sum(row[key] for row in group):,} |" for label, key in metrics]
        loads = [load for row in group for load in row['hostilePortDepartureLoads']]
        distribution = ', '.join(f'{load} armies: {count}' for load, count in sorted(collections.Counter(loads).items())) or 'none recorded'
        lines += ['', f'Hostile-target port-departure cargo distribution: {distribution}.']
    lines += ['', '## Interpretation limits', '',
              'Hostile-departure labels use pre-round actual ownership as evaluation context, not AI knowledge. '
              'Same-round ownership changes are excluded as ambiguous. Beach departures are not included.', '',
              'Repeated landing events are not automatically errors. Move steps are not voyages. '
              'Capture events, distinct faction/city pairs, and retained pairs use different denominators. '
              'Armies ashore include guards, scouts and active ground forces.', '',
              'This generated report makes no claim that validation passed or that a policy improved play. '
              'Inspect validation.json and the collection protocol for the selected dataset. '
              'Compare equal-round checkpoints before drawing conclusions from unequal endpoint horizons.']
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    root = pathlib.Path(os.environ.get('STUDY_OUT', 'docs/evaluation/strategy-baseline'))
    (root / 'FINDINGS.md').write_text(render(json.loads((root / 'summary.json').read_text())))
