// ptblsort.js — Sortable table library for Archspace.
// Implements the Table / ColumnData API used by the server-generated admiral JS.
//
// Row data format: each row is a string, columns separated by the sort delimiter.
// Within a cell, sortDelimiter separates href-suffix from display text:
//   e.g.  "6964\">#SORT#Kay Forgraves#SORT#"
//         cellStart + "6964\">" + "Kay Forgraves" + cellEnd
//   Plain numeric cells have no delimiter at all.

var ColumnData = {
    HEADER_HTML: 'headerHtml',
    CELL_START:  'cellStart',
    CELL_END:    'cellEnd',
    IS_NUMERIC:  'isNumeric'
};

function Table() {
    this._tableAttrs    = 'BORDER="1" CELLSPACING="0" CELLPADDING="2"';
    this._headerRowAttrs = '';
    this._sortDelimiter  = '#SORT#';
    this._columns        = [];   // {headerHtml, cellStart, cellEnd, isNumeric, sortOrder, priorityRank}
    this._rows           = [];   // arrays of {sortKey, display} per column
    this._rowDelimiter   = '|';
    this._sortOrders     = {};   // col → -1/0/1
    this._priorityRanks  = {};   // col → rank (1-based)
    this._nextRank       = 1;
}

// ── Configuration ─────────────────────────────────────────────────────────────

Table.prototype.setTableAttributes = function(attrs) {
    this._tableAttrs = attrs;
};

Table.prototype.setHeaderRowAttributes = function(attrs) {
    this._headerRowAttrs = attrs;
};

Table.prototype.setSortDelimiter = function(d) {
    this._sortDelimiter = d;
};

// addColumn(colIndex, isNumeric, headerHtml, cellStart, cellEnd)
// colIndex is informational — columns are appended in call order.
Table.prototype.addColumn = function(colIndex, isNumeric, headerHtml, cellStart, cellEnd) {
    this._columns.push({
        headerHtml: headerHtml,
        cellStart:  cellStart  || '<TD>',
        cellEnd:    cellEnd    || '</TD>',
        isNumeric:  !!isNumeric
    });
};

// addRows(delimiter, dataArray)
// Each element of dataArray is a pipe-delimited string of cell values.
// A cell value may contain sortDelimiter to split sortKey from displayText.
Table.prototype.addRows = function(delimiter, dataArray) {
    this._rowDelimiter = delimiter || '|';
    var sd = this._sortDelimiter;
    for (var r = 0; r < dataArray.length; r++) {
        var parts = dataArray[r].split(delimiter);
        var row = [];
        for (var c = 0; c < parts.length; c++) {
            var cell  = parts[c];
            var sdIdx = cell.indexOf(sd);
            var sortKey, display;
            if (sdIdx === -1) {
                // plain value — same for sort and display
                sortKey = display = cell;
            } else {
                // everything before first #SORT# is the href suffix (sort key)
                sortKey = cell.substring(0, sdIdx);
                // everything between first and last #SORT# is display text
                var rest     = cell.substring(sdIdx + sd.length);
                var lastSd   = rest.lastIndexOf(sd);
                display = (lastSd === -1) ? rest : rest.substring(0, lastSd);
            }
            row.push({ sortKey: sortKey, display: display });
        }
        this._rows.push(row);
    }
};

// ── Sorting ────────────────────────────────────────────────────────────────────

Table.prototype.getSortingOrder = function(col) {
    return (this._sortOrders[col] !== undefined) ? this._sortOrders[col] : -1;
};

Table.prototype.setSortingOrder = function(col, order) {
    this._sortOrders[col] = order;
};

Table.prototype.addPriorityRank = function(col, order) {
    this._sortOrders[col]    = order;
    this._priorityRanks[col] = this._nextRank++;
};

Table.prototype.removePriorityRank = function(col) {
    var rank = this._priorityRanks[col];
    delete this._priorityRanks[col];
    delete this._sortOrders[col];
    // compact ranks above the removed one
    for (var c in this._priorityRanks) {
        if (this._priorityRanks[c] > rank) this._priorityRanks[c]--;
    }
    if (this._nextRank > 1) this._nextRank--;
};

Table.prototype.getPriorityRank = function(col) {
    return (this._priorityRanks[col] !== undefined) ? this._priorityRanks[col] : 999;
};

Table.prototype.getTotalColumns = function() {
    return this._columns.length;
};

Table.prototype.setColumnData = function(col, key, value) {
    if (this._columns[col]) this._columns[col][key] = value;
};

Table.prototype.getColumnData = function(col, key) {
    return this._columns[col] ? this._columns[col][key] : '';
};

Table.prototype.sort = function() {
    // build ordered list of (col, order) by priorityRank
    var prios = [];
    for (var c in this._priorityRanks) {
        prios.push({ col: parseInt(c), rank: this._priorityRanks[c], order: this._sortOrders[c] });
    }
    prios.sort(function(a, b) { return a.rank - b.rank; });

    if (!prios.length) return;

    var cols    = this._columns;
    var sortOrders = this._sortOrders;

    this._rows.sort(function(rowA, rowB) {
        for (var i = 0; i < prios.length; i++) {
            var col   = prios[i].col;
            var order = prios[i].order;  // 0=ASCENDING 1=DESCENDING
            var aVal  = rowA[col] ? rowA[col].sortKey : '';
            var bVal  = rowB[col] ? rowB[col].sortKey : '';
            var cmp;
            if (cols[col] && cols[col].isNumeric) {
                cmp = (parseFloat(aVal) || 0) - (parseFloat(bVal) || 0);
            } else {
                cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            }
            if (cmp !== 0) return order === 1 ? -cmp : cmp;
        }
        return 0;
    });
};

// ── Rendering ─────────────────────────────────────────────────────────────────

Table.prototype.getTableHTML = function() {
    var html = '<table ' + this._tableAttrs + '>\n';

    // header row
    html += '<TR ' + this._headerRowAttrs + '>';
    for (var c = 0; c < this._columns.length; c++) {
        html += this._columns[c].headerHtml || '<TH></TH>';
    }
    html += '</TR>\n';

    // data rows
    for (var r = 0; r < this._rows.length; r++) {
        html += '<TR>';
        var row = this._rows[r];
        for (var c2 = 0; c2 < this._columns.length; c2++) {
            var col  = this._columns[c2];
            var cell = row[c2] || { sortKey: '', display: '' };
            html += col.cellStart + cell.sortKey + cell.display + col.cellEnd;
        }
        html += '</TR>\n';
    }

    html += '</table>';
    return html;
};
