import * as Papa from "papaparse";

export class DataObject {
    constructor() {
        this.base_json = null;
    }

    parseCsv(csv, encoding, startAtRow = 1, extraRow = false, delimiter = null) {
        let existingHeaders = [];
        let config = {
            header: true,
            skipEmptyLines: true,
            beforeFirstChunk: function(chunk) {
                let rows = chunk.split("\n");
                rows = rows.slice(startAtRow - 1);
                if (extraRow) {
                    rows.unshift(rows[0]);
                }
                return rows.join("\n");
            },
            transformHeader: function(header) {
                header = header.trim().length ? header : "Unnamed column";
                if (existingHeaders.includes(header)) {
                    let counter = 0;
                    let newHeader = header;
                    while(existingHeaders.includes(newHeader)) {
                        counter++;
                        newHeader = `${header} (${counter})`;
                    }
                    header = newHeader;
                }
                existingHeaders.push(header);
                return header;
            }
        }

        if (delimiter) {
            config.delimiter = delimiter;
        }

        this.base_json = Papa.parse(csv, config);
        return this.base_json;
    }

    converted_json(limit, ynab_cols, lookup, inverted_outflow = false) {
        if (!this.base_json) return null;

        const value = [];
        const data = this.base_json.data || [];

        for (let index = 0; index < (limit || data.length); index++) {
            const row = data[index];
            if (!row) break;

            const tmp_row = {};
            ynab_cols.forEach(col => {
                const cell = row[lookup[col]];
                if (!cell) return;

                switch (col) {
                    case "Outflow":
                    case "Inflow": {
                        const isOutflow = col === "Outflow";
                        const sameColumn = lookup['Outflow'] === lookup['Inflow'];
                        const isNegative = cell.startsWith('-');

                        if (sameColumn) {
                            const shouldFill = isOutflow ?
                                (inverted_outflow ? !isNegative : isNegative) :
                                (inverted_outflow ? isNegative : !isNegative);

                            tmp_row[col] = shouldFill ? cell.replace('-', '') : "";
                        } else {
                            tmp_row[col] = isNegative ? cell.slice(1) : cell;
                        }
                        break;
                    }
                    default:
                        tmp_row[col] = cell;
                }
            });
            value.push(tmp_row);
        }
        return value;
    }

    converted_csv(limit, ynab_cols, lookup, inverted_outflow) {
        if (!this.base_json) return null;

        const jsonData = this.converted_json(limit, ynab_cols, lookup, inverted_outflow);
        const header = '"' + ynab_cols.join('","') + '"\n';

        const rows = jsonData.map(row => {
            const values = ynab_cols.map(col =>
                (row[col] || "").replace(/"/g, '""').trim()
            );
            return '"' + values.join('","') + '"';
        });

        return header + rows.join('\n') + '\n';
    }

    fields() {
        return this.base_json?.meta.fields || [];
    }

    rows() {
        return this.base_json?.data || [];
    }
}
