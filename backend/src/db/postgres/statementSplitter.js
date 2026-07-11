function splitSqlStatements(sql) {
    const statements = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inDollarQuote = false;

    for (let index = 0; index < sql.length; index += 1) {
        const char = sql[index];
        const nextChar = sql[index + 1];

        if (!inSingleQuote && !inDoubleQuote && char === "$" && nextChar === "$") {
            inDollarQuote = !inDollarQuote;
            current += "$$";
            index += 1;
            continue;
        }

        if (!inDoubleQuote && !inDollarQuote && char === "'" && sql[index - 1] !== "\\") {
            inSingleQuote = !inSingleQuote;
            current += char;
            continue;
        }

        if (!inSingleQuote && !inDollarQuote && char === "\"" && sql[index - 1] !== "\\") {
            inDoubleQuote = !inDoubleQuote;
            current += char;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && char === ";") {
            const statement = current.trim();

            if (statement) {
                statements.push(statement);
            }

            current = "";
            continue;
        }

        current += char;
    }

    const tail = current.trim();

    if (tail) {
        statements.push(tail);
    }

    return statements;
}

module.exports = {
    splitSqlStatements
};
