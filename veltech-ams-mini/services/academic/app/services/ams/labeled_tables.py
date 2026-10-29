"""Read explicit column labels without flattening nested ASP.NET tables."""
import re

MAX_COLUMNS = 100
MAX_HEADER_ROWS = 10


def normalized(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def own_rows(table):
    return [row for row in table.find_all('tr') if row.find_parent('table') is table]


def own_cells(row):
    return row.find_all(['th', 'td'], recursive=False)


def _span(cell, attr):
    value = str(cell.get(attr, '1'))
    return int(value) if value.isdigit() and 1 <= int(value) <= MAX_COLUMNS else None


def _header_columns(rows, mapping):
    grid = {}
    width = 0
    for row_index, cells in enumerate(rows):
        column = 0
        for cell in cells:
            while (row_index, column) in grid:
                column += 1
            colspan, rowspan = _span(cell, 'colspan'), _span(cell, 'rowspan')
            if not colspan or not rowspan or column + colspan > MAX_COLUMNS or row_index + rowspan > MAX_HEADER_ROWS:
                return None, 0
            text = cell.get_text(' ', strip=True)
            for r in range(row_index, row_index + rowspan):
                for c in range(column, column + colspan):
                    if (r, c) in grid:
                        return None, 0
                    grid[r, c] = text
            column += colspan
            width = max(width, column)
    # A spanning header must be completed by actual header rows, never body rows.
    if any(row >= len(rows) for row, _ in grid) or any((r, c) not in grid for r in range(len(rows)) for c in range(width)):
        return None, 0
    columns = {}
    for c in range(width):
        labels = []
        for r in range(len(rows)):
            text = grid[r, c]
            if not labels or labels[-1] != text:
                labels.append(text)
        # Prefer the most specific leaf, then an explicitly labeled group + leaf.
        field = next((mapping[key] for start in range(len(labels) - 1, -1, -1)
                      if (key := normalized(' '.join(labels[start:]))) in mapping), None)
        if field:
            if field in columns:
                return None, 0
            columns[field] = c
    return columns, width


def labeled_rows(table, mapping, required):
    """Yield exact-width body rows under unambiguous flat or grouped headers.

    Only header spans are expanded. Merged body rows and nested layout cells are
    ignored so they cannot manufacture values or shift a course association.
    """
    headers = []
    columns, width = None, 0
    previous_header = False
    for row in own_rows(table):
        cells = own_cells(row)
        if not cells or any(cell.find('table') for cell in cells):
            continue
        values = [cell.get_text(' ', strip=True) for cell in cells]
        mapped = {mapping[normalized(value)] for value in values if normalized(value) in mapping}
        is_header = all(cell.name == 'th' for cell in cells) or required <= mapped
        if is_header:
            headers = headers + [cells] if previous_header else [cells]
            if len(headers) > MAX_HEADER_ROWS:
                columns, width = None, 0
            else:
                columns, width = _header_columns(headers, mapping)
                if columns is not None and not required <= columns.keys():
                    columns = None
            previous_header = True
            continue
        previous_header = False
        if (columns is None or len(cells) != width or any(len(value) > 1000 for value in values)
                or any(_span(cell, attr) != 1 for cell in cells for attr in ('colspan', 'rowspan'))):
            continue
        yield {field: values[index] for field, index in columns.items()}, cells, columns
