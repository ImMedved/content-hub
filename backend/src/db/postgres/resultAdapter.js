function normalizeRows(rows) {
    return Array.isArray(rows) ? rows : [];
}

function buildCommandResult(result) {
    const payload = {
        affectedRows: result.rowCount || 0
    };

    if (Array.isArray(result.rows) && result.rows.length > 0) {
        const firstRow = result.rows[0];

        if (typeof firstRow.id !== "undefined") {
            payload.insertId = Number(firstRow.id);
        }
    }

    return payload;
}

module.exports = {
    normalizeRows,
    buildCommandResult
};
