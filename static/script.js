/* -------------------------
   GLOBAL VARIABLES
------------------------- */
let originalData = {};      // Full dataset for current sheet
let activeFilters = {};     // Track active filters
let searchQuery = '';       // Current search query
let checkerList = [];       // All valid checker names from DB

/**
 * 1) Load the sheet list on page load
 * 2) Load the first sheet data
 * 3) Load filters
 * 4) Initialize search
 * 5) ALSO load the full checker list from DB
 */
async function loadSheets() {
  console.log("loadSheets called");
  try {
    // 1) Fetch list of sheets
    const response = await fetch('/sheets');
    const sheets = await response.json();
    const selector = document.getElementById('sheetSelector');

    selector.innerHTML = '';
    sheets.forEach((sheet, index) => {
      const option = document.createElement('option');
      option.value = sheet;
      option.textContent = sheet;
      selector.appendChild(option);
      if (index === 0) {
        selector.value = sheet; // auto-select the first
      }
    });

    // 2) Load first sheet + 3) load filters
    await loadSheet();
    await loadFilters();

    // 4) Initialize search
    initializeSearch();

    // 5) Load the full checker list from DB so we can populate the per-row dropdown
    await loadCheckerList();

    // If sheetSelector changes, re-load everything
    selector.addEventListener('change', async () => {
      activeFilters = {};
      searchQuery = '';
      document.getElementById('searchInput').value = '';

      await loadSheet();
      await loadFilters();
      // no need to reload checkerList if it's always the same for all sheets
      renderTable(originalData);
    });
  } catch (error) {
    console.error('Error loading sheets:', error);
  }
}

/**
 * Load the data for the selected sheet from the server.
 */
async function loadSheet() {
  const sheetName = document.getElementById('sheetSelector').value;
  try {
    const response = await fetch(`/data/${sheetName}`);
    originalData = await response.json();  // store it globally
    activeFilters = {};
    searchQuery = '';
    document.getElementById('searchInput').value = '';

    renderTable(originalData);
  } catch (err) {
    console.error('Error loading sheet data:', err);
  }
}

/**
 * Fetch the dynamic filters from the server for the selected sheet, build the filter row.
 */
async function loadFilters() {
  const sheetName = document.getElementById('sheetSelector').value;
  const filterRow = document.getElementById('headerRow');
  filterRow.innerHTML = '';

  try {
    const resp = await fetch(`/filters/${sheetName}`);
    const filters = await resp.json(); // { "Country": [...], "Priority": [...], etc. }

    // Build the filter <th>/<select> for each column
    for (const column in filters) {
      // We'll skip "checker" here, so it doesn't come from DB columns
      // We'll add a special filter dropdown for "checker" below
      if (column === 'checker') {
        continue;
      }

      const th = document.createElement('th');
      const uniqueId = `filter-${column}-${Math.random().toString(36).substring(2, 10)}`;
      select.id = uniqueId;
      select.classList.add('filter-dropdown');
      select.innerHTML = '<option value="">-- All --</option>';

      // Populate
      filters[column].forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      // Listen for changes
      select.addEventListener('change', () => handleFilterChange(column, select.value));
      th.appendChild(select);
      filterRow.appendChild(th);
    }

    // Now add a dedicated filter for "checker"
    // We'll use the globally loaded "checkerList" to build it
    const checkerTh = document.createElement('th');
    const checkerSelect = document.createElement('select');
    checkerSelect.id = 'filter-checker';
    checkerSelect.classList.add('filter-dropdown');
    checkerSelect.innerHTML = '<option value="">-- All --</option>';

    // Populate with the universal checker list
    checkerList.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      checkerSelect.appendChild(option);
    });

    // When the user picks a checker from the filter
    checkerSelect.addEventListener('change', () => {
      handleFilterChange('checker', checkerSelect.value);
    });
    checkerTh.appendChild(checkerSelect);
    filterRow.appendChild(checkerTh);

  } catch (err) {
    console.error("Error loading filters:", err);
  }
}

/**
 * Load all valid checker names from /checker_list
 * and store in the global 'checkerList' array.
 */
async function loadCheckerList() {
  try {
    const resp = await fetch('/checker_list');
    checkerList = await resp.json(); // e.g. ["Abhilash Nayak", "Ahmet Kocaturk", ...]
    console.log("Loaded checker list:", checkerList);
  } catch (error) {
    console.error("Error loading checker list:", error);
    checkerList = []; // fallback
  }
}

/**
 * When a filter changes, record it in 'activeFilters' and re-render.
 */
function handleFilterChange(column, value) {
  if (value) {
    activeFilters[column] = value;
  } else {
    delete activeFilters[column];
  }
  applyFilters();
  updateFilters();
}

/**
 * Rebuild valid filter options after we apply the current filters + search.
 */
function updateFilters() {
  // Start with the already filtered data
  const filteredData = getFilteredData();
  const updatedFilters = {};

  // Recompute which values are available for each column
  Object.keys(filteredData).forEach(col => {
    updatedFilters[col] = [...new Set(filteredData[col])];
  });

  // Update each dropdown
  for (const column in updatedFilters) {
    // We skip checker if you want to always show the *full* checkerList
    if (column === 'checker') continue;

    const select = document.getElementById(`filter-${column}`);
    if (!select) continue;

    const currentValue = select.value;
    select.innerHTML = '<option value="">-- All --</option>';

    updatedFilters[column].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    // If the old value is still valid, keep it
    if (currentValue && updatedFilters[column].includes(currentValue)) {
      select.value = currentValue;
    }
  }

  // If you prefer the "checker" filter to also be dynamically trimmed
  // to what's currently visible, you can do that here as well
  // but you'd lose the "always show all checkers" effect.
}

/**
 * Apply all active filters + the current search query to 'originalData'.
 */
function applyFilters() {
  const filteredData = getFilteredData();
  const searchedData = applySearch(filteredData);
  renderTable(searchedData);
}

/**
 * Return only rows that match all active filters.
 */
function getFilteredData() {
  const filteredData = {};
  Object.keys(originalData).forEach(col => (filteredData[col] = []));

  const rowCount = Object.values(originalData)[0]?.length || 0;
  for (let i = 0; i < rowCount; i++) {
    let includeRow = true;

    for (const [col, val] of Object.entries(activeFilters)) {
      if (originalData[col][i] !== val) {
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
 * Apply a text search to the already filtered data.
 */
function applySearch(data) {
  if (!searchQuery) return data;

  const searchedData = {};
  Object.keys(data).forEach(col => (searchedData[col] = []));

  const rowCount = Object.values(data)[0]?.length || 0;
  for (let i = 0; i < rowCount; i++) {
    // gather all cell strings in this row
    const cellValues = Object.keys(data).map(col => (data[col][i] || '').toLowerCase());
    // if ANY cell includes the search text, keep this row
    if (cellValues.some(v => v.includes(searchQuery))) {
      Object.keys(data).forEach(col => {
        searchedData[col].push(data[col][i]);
      });
    }
  }
  return searchedData;
}

function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    const headerRow = document.getElementById('headerTitles');
    const filterRow = document.getElementById('headerRow');

    // Clear existing table content
    tableBody.innerHTML = '';
    headerRow.innerHTML = '';
    filterRow.innerHTML = ''; // Clear filters

    // Handle case where no data is available
    if (!data || Object.keys(data).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%">No data available</td></tr>';
        return;
    }

    // Dynamically get columns excluding "checker" and filtering out empty or undefined keys
    const columns = Object.keys(data).filter(col => {
        // Check if the column exists, is not "checker", and contains at least one non-empty value
        return col && col !== 'checker' && data[col]?.some(value => value !== undefined && value !== '');
    });

    console.log("Filtered columns:", columns); // Debugging

    // Create header cells for each column dynamically
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);

        // Create filter dropdown for each column
        const thFilter = document.createElement('th');
        const select = document.createElement('select');
        select.id = `filter-${col}`;
        select.classList.add('filter-dropdown');
        select.innerHTML = '<option value="">-- All --</option>'; // Default "All" option

        // Populate dropdown with unique values for the column
        const uniqueValues = [...new Set(data[col].filter(value => value !== undefined && value !== ''))];
        uniqueValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        // Add event listener for filter changes
        select.addEventListener('change', () => handleFilterChange(col, select.value));
        thFilter.appendChild(select);
        filterRow.appendChild(thFilter);
    });

    // Add "Checker" column header
    const checkerHeader = document.createElement('th');
    checkerHeader.textContent = "Checker";
    headerRow.appendChild(checkerHeader);

    // Add "Actions" column header for the button
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = "Actions";
    headerRow.appendChild(actionsHeader);

    // Determine number of rows based on the length of the first column's data
    const rowCount = data[columns[0]]?.length || 0;

    // Ensure "checker-options" datalist exists and is populated
    let datalist = document.getElementById('checker-options');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'checker-options';

        // Populate the datalist with checker options
        checkerList.forEach(checker => {
            const option = document.createElement('option');
            option.value = checker;
            datalist.appendChild(option);
        });

        document.body.appendChild(datalist); // Append datalist to the DOM
    }

    // Create table rows dynamically
    for (let i = 0; i < rowCount; i++) {
        const row = document.createElement('tr');

        // Add data cells for each column dynamically
        columns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = data[col][i] || ''; // Fill empty values with an empty string
            row.appendChild(td);
        });

        // Add the "Checker" cell with a predictive input field
        const checkerCell = document.createElement('td');
        const currentChecker = data.checker ? data.checker[i] || "Not Assigned" : "Not Assigned";

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentChecker;
        input.classList.add('checker-input'); // Add optional styling class
        input.setAttribute('list', 'checker-options'); // Attach datalist for predictive suggestions

        // Prevent row click when interacting with the input
        input.addEventListener('click', (event) => event.stopPropagation());

        // Add event listeners to handle saving the updated checker
        input.addEventListener('blur', () => saveChecker(data.ID[i], input.value.trim()));
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') input.blur(); // Trigger blur on Enter key
        });

        checkerCell.appendChild(input);
        row.appendChild(checkerCell);

        // Add a button to redirect to the project page
        const actionsCell = document.createElement('td');
        const viewButton = document.createElement('button');
        viewButton.textContent = "View Project";
        viewButton.classList.add('view-project-button'); // Optional class for styling
        viewButton.addEventListener('click', () => {
            window.location.href = `/project/${data.ID[i]}`;
        });

        actionsCell.appendChild(viewButton);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    }

    // Log success for debugging purposes
    console.log(`Rendered table with ${rowCount} rows and ${columns.length} columns.`);
}





async function saveChecker(projectId, newChecker) {
    try {
        const response = await fetch(`/update_checker/${projectId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checker: newChecker }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Failed to update checker for project ${projectId}:`, errorData.error);
        } else {
            console.log(`Checker updated successfully for project ${projectId}: ${newChecker}`);
        }
    } catch (error) {
        console.error(`Error updating checker for project ${projectId}:`, error);
    }
}

async function populateCheckerDatalist() {
    try {
        // Fetch the checker list from the server
        const response = await fetch('/checker_list');
        const checkerList = await response.json();

        // Get the datalist element
        let datalist = document.getElementById('checker-options');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'checker-options';
            document.body.appendChild(datalist);
        }

        // Clear existing options in the datalist
        datalist.innerHTML = '';

        // Populate the datalist with checker names
        checkerList.forEach(checker => {
            const option = document.createElement('option');
            option.value = checker;
            datalist.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching checker list:', error);
    }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', populateCheckerDatalist);

/* -----------------------------------------------------
   Create a Checker Dropdown for a specific project row
------------------------------------------------------ */
function createCheckerDropdown(projectId, selectedChecker) {
    const dropdown = document.createElement('select');

    // Use the global 'checkerList' we loaded from the server
    // e.g. ["Abhilash Nayak", "Ahmet Kocaturk", ...]
    if (!checkerList || checkerList.length === 0) {
        // Fallback if checkerList is empty or undefined
        checkerList = ["Abhilash Nayak", "Ahmet Kocaturk","Naqueeb", "Uta Zwoelfer-Dorau", "Varun C", "Abhin A"];
    }

    // Add a blank option to allow removing the checker
    const blankOption = document.createElement('option');
    blankOption.value = "";
    blankOption.textContent = "-- None --";
    if (!selectedChecker) {
        blankOption.selected = true; // Default selection for blank
    }
    dropdown.appendChild(blankOption);

    // Add "Not Assigned" as the first dropdown option
    const notAssignedOption = document.createElement('option');
    notAssignedOption.value = "Not Assigned";
    notAssignedOption.textContent = "Not Assigned";
    if (selectedChecker === "Not Assigned" || !selectedChecker) {
        notAssignedOption.selected = true; // Default selection
    }
    dropdown.appendChild(notAssignedOption);

    // Populate the dropdown with checker names from checkerList
    checkerList.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === selectedChecker) {
            option.selected = true; // Select the current checker if it matches
        }
        dropdown.appendChild(option);
    });

    // Prevent row click when interacting with the dropdown
    dropdown.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // Handle dropdown change to assign a new checker
    dropdown.addEventListener('change', async () => {
        const newChecker = dropdown.value;
        console.log(`Updating project ${projectId} to checker: ${newChecker}`);

        try {
            const resp = await fetch(`/update_checker/${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checker: newChecker }),
            });

            if (!resp.ok) {
                const errData = await resp.json();
                console.error("Checker update error:", errData.error);
            } else {
                console.log("Checker updated successfully!");
            }
        } catch (err) {
            console.error("Error updating checker:", err);
        }
    });

    return dropdown;
}

function createCheckerInput(projectId, selectedChecker) {
    const input = document.createElement("input");
    input.type = "text";
    input.classList.add("checker-input");
    input.value = selectedChecker || "";
    input.setAttribute("list", "checker-options");

    // Fetch the checker list dynamically
    const datalist = document.getElementById("checker-options");
    if (!datalist.options.length) {
        checkerList.forEach((name) => {
            const option = document.createElement("option");
            option.value = name;
            datalist.appendChild(option);
        });
    }

    // Handle input change and save to the backend
    input.addEventListener("change", async () => {
        const newChecker = input.value;
        console.log(`Updating project ${projectId} to checker: ${newChecker}`);

        if (checkerList.includes(newChecker)) {
            try {
                const resp = await fetch(`/update_checker/${projectId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ checker: newChecker }),
                });

                if (!resp.ok) {
                    console.error("Error updating checker");
                } else {
                    console.log("Checker updated successfully!");
                }
            } catch (err) {
                console.error("Error:", err);
            }
        } else {
            alert("Invalid checker name. Please select a name from the list.");
        }
    });

    return input;
}


/* -----------------------------------------------------
   Utility: Create a TH or TD
------------------------------------------------------ */
function createHeaderCell(text) {
  const th = document.createElement('th');
  th.textContent = text;
  return th;
}
function createDataCell(text) {
  const td = document.createElement('td');
  td.textContent = text || '';
  return td;
}

/* -----------------------------------------------------
   Search Initialization
------------------------------------------------------ */
function initializeSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    applyFilters();
  });
}

/* -----------------------------------------------------
   Page startup
------------------------------------------------------ */
loadSheets();
