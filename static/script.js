let originalData = {}; // Store the full dataset for the current sheet
let activeFilters = {}; // Track active filters
let searchQuery = ''; // Store the search query

/**
 * Fetches and populates the list of sheets, loads the first sheet's data, and initializes filters.
 */
async function loadSheets() {
    try {
        const response = await fetch('/sheets');
        const sheets = await response.json();
        const selector = document.getElementById('sheetSelector');

        selector.innerHTML = ''; // Clear existing sheet options
        sheets.forEach((sheet, index) => {
            const option = document.createElement('option');
            option.value = sheet;
            option.textContent = sheet;
            selector.appendChild(option);

            if (index === 0) selector.value = sheet; // Auto-select the first sheet
        });

        // Load first sheet and filters
        await loadSheet();
        await loadFilters();

        // Add event listener to reload data and filters on sheet change
        selector.addEventListener('change', async () => {
            activeFilters = {}; // Reset filters
            searchQuery = ''; // Reset search
            document.getElementById('searchInput').value = '';
            await loadSheet();
            await loadFilters();
        });

        // Initialize search input event listener
        initializeSearch();
    } catch (error) {
        console.error('Error loading sheets:', error);
    }
}

/**
 * Fetches and loads the entire dataset for the selected sheet.
 */
async function loadSheet() {
    const sheetName = document.getElementById('sheetSelector').value;
    try {
        const response = await fetch(`/data/${sheetName}`);
        originalData = await response.json(); // Reset dataset
        activeFilters = {}; // Reset active filters
        searchQuery = ''; // Reset search query
        document.getElementById('searchInput').value = '';
        renderTable(originalData);
    } catch (error) {
        console.error('Error loading sheet data:', error);
    }
}

/**
 * Fetches and initializes the filter dropdowns dynamically.
 */
async function loadFilters() {
    const sheetName = document.getElementById('sheetSelector').value;

    try {
        const response = await fetch(`/filters/${sheetName}`);
        const filters = await response.json();

        const filterRow = document.getElementById('headerRow'); // Only the filter row
        filterRow.innerHTML = ''; // Clear existing filters

        // Add dropdown filters only (no column headers here)
        for (const column in filters) {
            const thFilter = document.createElement('th'); // Create a table header for filters
            const select = document.createElement('select'); // Create dropdown
            select.id = `filter-${column}`;
            select.classList.add('filter-dropdown');
            select.innerHTML = '<option value="">-- All --</option>'; // Default "All" option

            // Populate dropdown with filter values
            filters[column].forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });

            // Add event listener for filter changes
            select.addEventListener('change', () => handleFilterChange(column, select.value));
            thFilter.appendChild(select);
            filterRow.appendChild(thFilter); // Append filter dropdown to filter row
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}


/**
 * Handles filter changes, updates the active filters, and dynamically recalculates valid filter options.
 */
function handleFilterChange(column, value) {
    if (value) {
        activeFilters[column] = value; // Add filter
    } else {
        delete activeFilters[column]; // Remove filter if empty
    }
    applyFilters(); // Reapply filters and search query
    updateFilters(); // Update dropdown options dynamically
}

/**
 * Dynamically recalculates valid filter options based on active filters.
 */
function updateFilters() {
    const updatedFilters = {};

    // Start with the original dataset and apply current active filters
    const filteredData = getFilteredData();

    // Recalculate valid options for each filter column
    Object.keys(filteredData).forEach(column => {
        updatedFilters[column] = [...new Set(filteredData[column])];
    });

    // Update each dropdown filter dynamically
    for (const column in updatedFilters) {
        const select = document.getElementById(`filter-${column}`);
        if (!select) continue;

        const currentValue = select.value;
        select.innerHTML = '<option value="">-- All --</option>'; // Reset dropdown

        updatedFilters[column].forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        // Retain the current filter value if still valid
        if (currentValue && updatedFilters[column].includes(currentValue)) {
            select.value = currentValue;
        }
    }
}

/**
 * Applies all active filters and the search query to the original dataset.
 */
function applyFilters() {
    const filteredData = getFilteredData(); // Apply column filters
    const searchedData = applySearch(filteredData); // Apply search query
    renderTable(searchedData);
}

/**
 * Filters the dataset based on active column filters.
 */
function getFilteredData() {
    const filteredData = {};
    Object.keys(originalData).forEach(col => (filteredData[col] = []));

    const numRows = Object.values(originalData)[0]?.length || 0;
    for (let i = 0; i < numRows; i++) {
        let includeRow = true;

        for (const [column, value] of Object.entries(activeFilters)) {
            if (originalData[column][i] !== value) {
                includeRow = false;
                break;
            }
        }

        if (includeRow) {
            Object.keys(originalData).forEach(col => {
                filteredData[col].push(originalData[col][i]);
            });
        }
    }

    return filteredData;
}

/**
 * Applies the search query to the filtered dataset.
 */
function applySearch(data) {
    if (!searchQuery) return data;

    const searchedData = {};
    Object.keys(data).forEach(col => (searchedData[col] = []));

    const numRows = Object.values(data)[0]?.length || 0;
    for (let i = 0; i < numRows; i++) {
        const rowValues = Object.keys(data).map(col => String(data[col][i]).toLowerCase());
        if (rowValues.some(value => value.includes(searchQuery))) {
            Object.keys(data).forEach(col => {
                searchedData[col].push(data[col][i]);
            });
        }
    }

    return searchedData;
}

/**
 * Renders the table with the provided dataset.
 */
function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    const headerRow = document.getElementById('headerTitles');

    // Clear table body and header
    tableBody.innerHTML = '';
    headerRow.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%">No data available</td></tr>';
        return;
    }

    Object.keys(data).forEach(col => {
        // Instead of manually creating 'th', call createHeaderCell()
        // const headerCell = document.createElement('th');
        // headerCell.textContent = col;

        const headerCell = createHeaderCell(col);
        headerRow.appendChild(headerCell);
    });

    // Add rows and columns
    const numRows = Object.values(data)[0]?.length || 0;
    for (let i = 0; i < numRows; i++) {
        const row = document.createElement('tr');
        Object.keys(data).forEach(col => {
            // Instead of manually creating 'td', call createDataCell()
            // const cell = document.createElement('td');
            // cell.textContent = data[col][i] || '';

            const cell = createDataCell(data[col][i]);
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    }
}

/**
 * Initializes search bar functionality.
 */
/**
 * Creates a table header cell with the given text content.
 * @param {string} text - The text to display in the header cell.
 * @returns {HTMLElement} - The header cell element.
 */
function createHeaderCell(text) {
    const th = document.createElement('th');
    th.textContent = text;
    return th;
}

/**
 * Creates a table data cell with the given text content.
 * @param {string} text - The text to display in the data cell.
 * @returns {HTMLElement} - The data cell element.
 */
function createDataCell(text) {
    const td = document.createElement('td');
    td.textContent = text || '';
    return td;
}
/**
 * Initializes search bar functionality.
 */
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', event => {
        searchQuery = event.target.value.trim().toLowerCase();
        applyFilters(); // Reapply filters with the search query
    });
}

// Initialize sheet loading and search
loadSheets();
