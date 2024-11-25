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
                let startIndex = startAtRow - 1;
                rows = rows.slice(startIndex);

                if (extraRow) {
                    rows.unshift(rows[0]);
                }

                return rows.join("\n");
            },
            transformHeader: function(header) {
                if (header.trim().length == 0) {
                    header = "Unnamed column";
                }
                if (existingHeaders.indexOf(header) != -1) {
                    let new_header = header;
                    let counter = 0;
                    while(existingHeaders.indexOf(new_header) != -1){
                        counter++;
                        new_header = header + " (" + counter + ")";
                    }
                    header = new_header;
                }
                existingHeaders.push(header);
                return header;
            }
        }

        if (delimiter !== null) {
            config.delimiter = delimiter;
        }

        let result = Papa.parse(csv, config);
        return (this.base_json = result);
    }

    converted_json(limit, ynab_cols, lookup, inverted_outflow = false) {
        if (this.base_json === null) return null;

        const value = [];
        if (this.base_json.data) {
            this.base_json.data.forEach((row, index) => {
                if (!limit || index < limit) {
                    const tmp_row = {};
                    ynab_cols.forEach(col => {
                        let cell = row[lookup[col]];
                        if (cell) {
                            switch (col) {
                                case "Outflow":
                                    if (lookup['Outflow'] == lookup['Inflow']) {
                                        if (!inverted_outflow) {
                                            // src/dataObject.js (continued)
                                            tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : "";
                                        } else {
                                            tmp_row[col] = cell.startsWith('-') ? "" : cell;
                                        }
                                    } else {
                                        tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : cell;
                                    }
                                    break;
                                case "Inflow":
                                    if (lookup['Outflow'] == lookup['Inflow']) {
                                        if (!inverted_outflow) {
                                            tmp_row[col] = cell.startsWith('-') ? "" : cell;
                                        } else {
                                            tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : "";
                                        }
                                    } else {
                                        tmp_row[col] = cell;
                                    }
                                    break;
                                default:
                                    tmp_row[col] = cell;
                            }
                        }
                    });
                    value.push(tmp_row);
                }
            });
        }
        return value;
    }

    converted_csv(limit, ynab_cols, lookup, inverted_outflow) {
        if (this.base_json === null) return null;

        // Create CSV header
        let string = '"' + ynab_cols.join('","') + '"\n';

        // Convert data to CSV rows
        this.converted_json(limit, ynab_cols, lookup, inverted_outflow).forEach(row => {
            const row_values = [];
            ynab_cols.forEach(col => {
                let row_value = row[col] || "";
                // escape text which might already have a quote in it
                row_value = row_value.replace(/"/g, '""').trim();
                row_values.push(row_value);
            });
            string += '"' + row_values.join('","') + '"\n';
        });

        return string;
    }

    fields() {
        return this.base_json.meta.fields;
    }

    rows() {
        return this.base_json.data;
    }
}
