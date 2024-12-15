<script>
    let originalData = { }; // Global variable to store the full data set for re-filtering

    /**
     * Fetches and populates the list of available sheets.
     */
    async function loadSheets() {
            try {
                const response = await fetch('/sheets');
    const sheets = await response.json();
    const selector = document.getElementById('sheetSelector');
    selector.innerHTML = ''; // Clear existing options

                sheets.forEach(sheet => {
                    const option = document.createElement('option');
    option.value = sheet;
    option.textContent = sheet;
    selector.appendChild(option);
                });
            } catch (error) {
        console.error('Error loading sheets:', error);
            }
        }

    /**
     * Fetches and renders column-specific filters for the selected sheet.
     */
    async function loadFilters() {
            const sheetName = document.getElementById('sheetSelector').value;

    try {
                const response = await fetch(`/filters/${sheetName}`);
    const filters = await response.json();

    const headerRow = document.getElementById('headerRow');
    const headerTitles = document.getElementById('headerTitles');
    headerRow.innerHTML = ''; // Clear existing filters
    headerTitles.innerHTML = ''; // Clear existing titles

    for (const column in filters) {
                    const thTitle = document.createElement('th');
    const thFilter = document.createElement('th');

    // Add column title
    thTitle.textContent = column;
    thTitle.classList.add('header-title');
    headerTitles.appendChild(thTitle);

    // Create a dropdown filter for each column
    const select = document.createElement('select');
    select.id = `filter-${column}`;
    select.classList.add('filter-dropdown');
    select.innerHTML = `<option value="">-- All --</option>`;

                    filters[column].forEach(value => {
                        const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
                    });

    // Add event listener to apply filters dynamically
    select.addEventListener('change', applyFilters);

    // Append dropdown filter to the header
    thFilter.appendChild(select);
    headerRow.appendChild(thFilter);
                }
            } catch (error) {
        console.error('Error loading filters:', error);
            }
        }

    /**
     * Fetches and renders the entire dataset for the selected sheet.
     */
    async function loadSheet() {
            const sheetName = document.getElementById('sheetSelector').value;

    try {
                const response = await fetch(`/data/${sheetName}`);
    const data = await response.json();

    // Store the full dataset for future filtering
    originalData = data;

    // Render the table with the full dataset
    renderTable(data);
            } catch (error) {
        console.error('Error loading sheet data:', error);
            }
        }

    /**
     * Applies active filters to the dataset and updates the table.
     */
    let currentFilteredData = { }; // To keep track of filtered data for subsequent filters

    function applyFilters() {
        // Start with the current filtered data or original data if no filters have been applied yet
        let dataToFilter = Object.keys(currentFilteredData).length ? currentFilteredData : originalData;

    // Initialize a new object to store filtered results
    let newFilteredData = { };
            Object.keys(dataToFilter).forEach(col => newFilteredData[col] = []); // Initialize structure

    // Get all active filters
    const filterElements = document.querySelectorAll('[id^="filter-"]');
    let activeFilters = { };

            filterElements.forEach(filter => {
                const column = filter.id.replace('filter-', '');
    const filterValue = filter.value;
    if (filterValue) {
        activeFilters[column] = filterValue;
                }
            });

    // Filter rows based on ALL active filters
    const numRows = Object.values(dataToFilter)[0]?.length || 0;

    for (let i = 0; i < numRows; i++) {
        let includeRow = true;

    for (const [column, value] of Object.entries(activeFilters)) {
                    if (dataToFilter[column][i] !== value) {
        includeRow = false;
    break;
                    }
                }

    if (includeRow) {
        Object.keys(dataToFilter).forEach(col => {
            newFilteredData[col].push(dataToFilter[col][i]);
        });
                }
            }

    // Update the global filtered data to enable subsequent filters to apply correctly
    currentFilteredData = newFilteredData;

    // Render the table with the newly filtered data
    renderTable(newFilteredData);
        }

        /**
         * Renders the data table with the given dataset.
         * @param {Object} data - The dataset to render.
    */
    function renderTable(data) {
            const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = ''; // Clear the table body

    // Check if there is data to display
    if (!data || Object.keys(data).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%">No data available</td></tr>';
    return;
            }

    // Create the table header (only once)
    if (!document.getElementById('headerTitles').hasChildNodes()) {
                const headerRow = document.createElement('tr');
                Object.keys(data).forEach(col => {
                    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
                });
    tableHeader.appendChild(headerRow);
            }

    // Render rows dynamically
    const numRows = Object.values(data)[0]?.length || 0;
    for (let i = 0; i < numRows; i++) {
                const tr = document.createElement('tr');
                Object.keys(data).forEach(col => {
                    const td = document.createElement('td');
    td.textContent = data[col][i] || ''; // Handle empty cells
    tr.appendChild(td);
                });
    tableBody.appendChild(tr);
            }
        }

    // Initialize by loading sheets
    loadSheets();
</script>