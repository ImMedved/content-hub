function formatValuePlaceholders(sql) {
    let index = 0;

    return sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
}

module.exports = {
    formatValuePlaceholders
};
