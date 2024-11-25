import { DataObject } from './dataObject.js';
import { ENCODINGS, DELIMITERS, OLD_YNAB_COLS, NEW_YNAB_COLS } from './constants.js';

class YNABConverter {
    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.dataObject = new DataObject();
        this.ynabCols = OLD_YNAB_COLS;
        this.ynabMap = {};
        this.invertedOutflow = false;

        // Cache DOM elements
        this.elements = {
            uploadSection: document.getElementById('uploadSection'),
            dropZone: document.getElementById('dropZone'),
            converterContent: document.getElementById('converterContent'),
            fileInput: document.getElementById('fileInput'),
            encodingSelect: document.getElementById('encodingSelect'),
            delimiterSelect: document.getElementById('delimiterSelect'),
            startRow: document.getElementById('startRow'),
            extraRowCheck: document.getElementById('extraRowCheck'),
            loadDifferentFile: document.getElementById('loadDifferentFile'),
            saveYnabData: document.getElementById('saveYnabData'),
            invertFlows: document.getElementById('invertFlows'),
            toggleFormat: document.getElementById('toggleFormat'),
            mappingContainer: document.getElementById('mappingContainer'),
            headerRow: document.getElementById('headerRow'),
            previewBody: document.getElementById('previewBody'),
            sourceHeaderRow: document.getElementById('sourceHeaderRow'),
            sourceBody: document.getElementById('sourceBody')
        };

        this.setupEventListeners();
        this.initializeSelects();
    }

    setupEventListeners() {
        // Drop zone handling
        this.elements.dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.add('dragging');
        });

        this.elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.elements.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('dragging');
        });

        this.elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('dragging');
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file);
        });

        // File input handling
        this.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processFile(file);
        });

        // Button handlers
        this.elements.loadDifferentFile.addEventListener('click', () => this.reset());
        this.elements.saveYnabData.addEventListener('click', () => this.downloadCSV());
        this.elements.invertFlows.addEventListener('click', () => this.toggleInvertFlows());
        this.elements.toggleFormat.addEventListener('click', () => this.toggleColumnFormat());

        // Configuration handlers
        this.elements.encodingSelect.addEventListener('change', () => this.handleConfigChange());
        this.elements.delimiterSelect.addEventListener('change', () => this.handleConfigChange());
        this.elements.startRow.addEventListener('change', () => this.handleConfigChange());
        this.elements.extraRowCheck.addEventListener('change', () => this.handleConfigChange());

        // Paste handling
        document.addEventListener('paste', (e) => this.handlePaste(e));
    }

    initializeSelects() {
        // Initialize encoding select
        ENCODINGS.forEach(encoding => {
            const option = document.createElement('option');
            option.value = option.textContent = encoding;
            this.elements.encodingSelect.appendChild(option);
        });
        this.elements.encodingSelect.value = 'UTF-8';

        // Initialize delimiter select
        DELIMITERS.forEach(delimiter => {
            const option = document.createElement('option');
            option.value = delimiter;
            option.textContent = delimiter === 'auto' ? delimiter : `"${delimiter}"`;
            this.elements.delimiterSelect.appendChild(option);
        });
        this.elements.delimiterSelect.value = 'auto';
    }

    processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const encoding = this.elements.encodingSelect.value;
                const delimiter = this.elements.delimiterSelect.value;
                const startRow = parseInt(this.elements.startRow.value);
                const extraRow = this.elements.extraRowCheck.checked;

                this.dataObject.parseCsv(
                    e.target.result,
                    encoding,
                    startRow,
                    extraRow,
                    delimiter === 'auto' ? null : delimiter
                );

                this.showConverterContent();
            } catch (error) {
                this.showError('Error processing file: ' + error.message);
            }
        };

        reader.onerror = () => {
            this.showError('Error reading file');
        };

        reader.readAsText(file);
    }

    handlePaste(e) {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText) {
            try {
                const encoding = this.elements.encodingSelect.value;
                const delimiter = this.elements.delimiterSelect.value;
                const startRow = parseInt(this.elements.startRow.value);
                const extraRow = this.elements.extraRowCheck.checked;

                this.dataObject.parseCsv(
                    pastedText,
                    encoding,
                    startRow,
                    extraRow,
                    delimiter === 'auto' ? null : delimiter
                );

                this.showConverterContent();
            } catch (error) {
                this.showError('Error processing pasted data: ' + error.message);
            }
        }
    }

    showConverterContent() {
        this.elements.uploadSection.classList.add('d-none');
        this.elements.converterContent.classList.remove('d-none');

        this.renderSourcePreview();
        this.setupColumnMapping();
        this.renderYnabPreview();
    }

    renderSourcePreview() {
        if (!this.dataObject.base_json) return;

        const fields = this.dataObject.fields();
        const rows = this.dataObject.rows().slice(0, 10);

        // Clear existing content
        this.elements.sourceHeaderRow.innerHTML = '';
        this.elements.sourceBody.innerHTML = '';

        // Add headers
        fields.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field;
            this.elements.sourceHeaderRow.appendChild(th);
        });

        // Add data rows
        rows.forEach(row => {
            const tr = document.createElement('tr');
            fields.forEach(field => {
                const td = document.createElement('td');
                td.textContent = row[field] || '';
                tr.appendChild(td);
            });
            this.elements.sourceBody.appendChild(tr);
        });
    }

    setupColumnMapping() {
        const sourceFields = this.dataObject.fields();
        this.elements.mappingContainer.innerHTML = ''; // Clear existing mappings

        this.ynabCols.forEach(ynabCol => {
            const col = document.createElement('div');
            col.className = 'col';

            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = `Map ${ynabCol} to:`;

            const select = document.createElement('select');
            select.className = 'form-select';

            // Add empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- Select Field --';
            select.appendChild(emptyOption);

            // Add source fields as options
            sourceFields.forEach(field => {
                const option = document.createElement('option');
                option.value = field;
                option.textContent = field;
                if (field.toLowerCase().includes(ynabCol.toLowerCase())) {
                    option.selected = true;
                    this.ynabMap[ynabCol] = field;
                }
                select.appendChild(option);
            });

            // Set initial value if mapping exists
            if (this.ynabMap[ynabCol]) {
                select.value = this.ynabMap[ynabCol];
            }

            select.addEventListener('change', (e) => {
                this.ynabMap[ynabCol] = e.target.value;
                this.renderYnabPreview();
            });

            formGroup.appendChild(label);
            formGroup.appendChild(select);
            col.appendChild(formGroup);
            this.elements.mappingContainer.appendChild(col);
        });
    }

    renderYnabPreview() {
        try {
            const preview = this.dataObject.converted_json(10, this.ynabCols, this.ynabMap, this.invertedOutflow);

            // Clear existing content
            this.elements.headerRow.innerHTML = '';
            this.elements.previewBody.innerHTML = '';

            // Add headers
            this.ynabCols.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col;
                this.elements.headerRow.appendChild(th);
            });

            // Add data rows
            if (preview && preview.length > 0) {
                preview.forEach(row => {
                    const tr = document.createElement('tr');
                    this.ynabCols.forEach(col => {
                        const td = document.createElement('td');
                        td.textContent = row[col] || '';
                        tr.appendChild(td);
                    });
                    this.elements.previewBody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = this.ynabCols.length;
                td.className = 'text-center';
                td.textContent = 'No preview data available';
                tr.appendChild(td);
                this.elements.previewBody.appendChild(tr);
            }
        } catch (error) {
            this.showError('Error generating preview: ' + error.message);
        }
    }

    toggleInvertFlows() {
        this.invertedOutflow = !this.invertedOutflow;
        this.renderYnabPreview();
    }

    toggleColumnFormat() {
        this.ynabCols = this.ynabCols === OLD_YNAB_COLS ? NEW_YNAB_COLS : OLD_YNAB_COLS;
        this.setupColumnMapping();
        this.renderYnabPreview();
    }

    handleConfigChange() {
        if (this.dataObject.base_json) {
            const file = this.elements.fileInput.files[0];
            if (file) {
                this.processFile(file);
            }
        }
    }

    downloadCSV() {
        try {
            const csvString = this.dataObject.converted_csv(null, this.ynabCols, this.ynabMap, this.invertedOutflow);
            if (!csvString) {
                throw new Error('No data to download');
            }

            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);

            link.href = URL.createObjectURL(blob);
            link.download = `ynab_data_${date}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            this.showError('Error downloading CSV: ' + error.message);
        }
    }

    reset() {
        this.elements.uploadSection.classList.remove('d-none');
        this.elements.converterContent.classList.add('d-none');
        this.elements.fileInput.value = '';

        // Remove error alert if it exists
        const errorAlert = document.getElementById('errorAlert');
        if (errorAlert) {
            errorAlert.remove();
        }

        this.dataObject = new DataObject();
        this.ynabMap = {};
        this.invertedOutflow = false;
    }

    showError(message) {
        let alertDiv = document.getElementById('errorAlert');
        if (!alertDiv) {
            alertDiv = document.createElement('div');
            alertDiv.id = 'errorAlert';
            alertDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
            alertDiv.innerHTML = `
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                <strong>Error:</strong> <span id="errorMessage"></span>
            `;
            document.querySelector('.container').prepend(alertDiv);
        }
        document.getElementById('errorMessage').textContent = message;
    }
}

// Initialize the application
new YNABConverter();
