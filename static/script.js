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

    // 2) Load the first sheet
    await loadSheet();

    // 5) Load the full checker list from DB so we have all names:
    await loadCheckerList();

    // 3) Now that we have checkerList, build the filters
    await loadFilters();

    // 4) Initialize search
    initializeSearch();

    // If sheetSelector changes, re-load everything
    selector.addEventListener('change', async () => {
      activeFilters = {};
      searchQuery = '';
      document.getElementById('searchInput').value = '';

      await loadSheet();
      // no need to reload checkerList if it's always the same for all sheets
      await loadFilters(); // rebuild filter dropdown
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

  // Gather real columns from the current sheet data
  const realColumns = Object.keys(originalData).filter(col =>
    col &&
    col !== 'checker' &&
    originalData[col]?.some(value => value !== undefined && value !== '')
  );

  try {
    const resp = await fetch(`/filters/${sheetName}`);
    const filters = await resp.json(); // e.g. { "Country": [...], "Priority": [...], etc. }

    // Build the filter <th>/<select> for each column found in realColumns
    for (const column in filters) {
      // Skip columns that aren't in realColumns (prevents empty columns)
      if (!realColumns.includes(column)) {
        continue;
      }
      // Also skip "checker" because we'll handle it separately
      if (column === 'checker') {
        continue;
      }

      // Create TH + SELECT
      const th = document.createElement('th');
      const select = document.createElement('select');
      select.id = `filter-${column}`;
      select.classList.add('filter-dropdown');
      select.innerHTML = '<option value="">-- All --</option>';

      // Populate dropdown options ONCE
      filters[column].forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      // Add event listener for filter changes
      select.addEventListener('change', () => handleFilterChange(column, select.value));

      // Append <select> to <th> and then to filterRow
      th.appendChild(select);
      filterRow.appendChild(th);
    }

    // Now add a dedicated filter for "checker"
    const checkerTh = document.createElement('th');
    const checkerSelect = document.createElement('select');
    checkerSelect.id = 'filter-checker';
    checkerSelect.classList.add('filter-dropdown');
    checkerSelect.innerHTML = '<option value="">-- All --</option>';

    // Populate the universal checker list
    checkerList.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      checkerSelect.appendChild(option);
    });

    // Handle "checker" filter changes
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
  const headerCell = document.querySelector(`#headerTitles th[data-column="${column}"]`);

  if (value === '') {
    // Remove the filter when "All" is selected
    delete activeFilters[column];
    if (headerCell) headerCell.textContent = column; // Reset header text
  } else {
    // Update the filter with the selected value
    activeFilters[column] = value;
    if (headerCell) headerCell.textContent = `${column} (${value})`; // Display active filter
  }

  // Apply filters to update the table
  applyFilters();

  // Dynamically update dropdown options
  updateFilters();
}



/**
 * Rebuild valid filter options after we apply the current filters + search.
 */
function updateFilters() {
  // Get the currently filtered data
  const filteredData = getFilteredData();
  const updatedFilters = {};

  // Compute unique values for each column from the filtered data
  Object.keys(filteredData).forEach(col => {
    updatedFilters[col] = [...new Set(filteredData[col])];
  });

  // Update each dropdown
  for (const column in updatedFilters) {
    const select = document.getElementById(`filter-${column}`);
    if (!select) continue;

    const currentValue = select.value; // Save the current selection
    select.innerHTML = '<option value="">-- All --</option>'; // Reset to "All"

    // Populate the dropdown with updated unique values
    updatedFilters[column].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    // Retain the previous selection if it is still valid
    if (currentValue && updatedFilters[column].includes(currentValue)) {
      select.value = currentValue;
    } else {
      select.value = ''; // Reset to "All" if the previous value is no longer valid
    }
  }
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


async function populateCheckerDatalist() {
    try {
        // Fetch the checker list from the server
        const response = await fetch('/checker_list');
        const checkerList = await response.json();

        // Check if the checker list is valid
        if (!checkerList || !Array.isArray(checkerList) || checkerList.length === 0) {
            console.warn('Checker list is empty or invalid.');
            return;
        }

        // Get or create the datalist element
        let datalist = document.getElementById('checker-options');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'checker-options';
            document.body.appendChild(datalist);
        }

        // Populate the datalist only if it is not already populated
        if (datalist.childElementCount === 0) {
            checkerList.forEach(checker => {
                const option = document.createElement('option');
                option.value = checker;
                datalist.appendChild(option);
            });
            console.log('Datalist populated with checkers:', checkerList);
        } else {
            console.log('Datalist already populated. Skipping redundant updates.');
        }
    } catch (error) {
        console.error('Error fetching checker list:', error);
    }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', populateCheckerDatalist);

function renderTable(data) {
  const tableBody = document.getElementById('tableBody');
  const headerTitles = document.getElementById('headerTitles');

  // 1) Clear existing table rows & column headers,
  //    but DO NOT touch the filter row (#headerRow).
  tableBody.innerHTML = '';
  headerTitles.innerHTML = '';

  // 2) Handle no data
  if (!data || Object.keys(data).length === 0) {
    tableBody.innerHTML = '<tr><td colspan="100%">No data available</td></tr>';
    return;
  }

  // 3) Figure out which columns to show (besides "checker").
  const columns = Object.keys(data).filter(col => {
    return col && col !== 'checker' && data[col]?.some(value => value !== undefined && value !== '');
  });

  console.log("Filtered columns:", columns);

  // 4) Create column headings for each data column
  columns.forEach(col => {
    const th = document.createElement('th');
    th.setAttribute('data-column', col);
    th.textContent = col; // e.g. "COUNTRY", "DEADLINE", etc.
    headerTitles.appendChild(th);
  });

  // 5) Add column heading for "Checker"
  const checkerHeader = document.createElement('th');
  checkerHeader.textContent = "Checker";
  headerTitles.appendChild(checkerHeader);

  // 6) Add column heading for "Actions"
  const actionsHeader = document.createElement('th');
  actionsHeader.textContent = "Actions";
  headerTitles.appendChild(actionsHeader);

  // 7) Render data rows
  const rowCount = data[columns[0]]?.length || 0;
  for (let i = 0; i < rowCount; i++) {
    const row = document.createElement('tr');

    // For each data column, create a <td> with the cell value
    columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = data[col][i] || ''; // show empty string if undefined
      row.appendChild(td);
    });

    // Checker cell
    const checkerCell = document.createElement('td');
    const currentChecker = data.checker ? data.checker[i] || "Not Assigned" : "Not Assigned";

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentChecker;
    input.classList.add('checker-input'); // Optional styling
    input.setAttribute('list', 'checker-options'); // link to our datalist

    // Prevent row click events from interfering
    input.addEventListener('click', event => event.stopPropagation());

    // Save checker on blur or Enter
    input.addEventListener('blur', () => {
      saveChecker(data.ID[i], input.value.trim());
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
    });

    checkerCell.appendChild(input);
    row.appendChild(checkerCell);

    // Actions cell
    const actionsCell = document.createElement('td');
    const viewButton = document.createElement('button');
    viewButton.textContent = "View Project";
    viewButton.classList.add('view-project-button'); // styling
    viewButton.addEventListener('click', () => {
      window.location.href = `/project/${data.ID[i]}`;
    });

    actionsCell.appendChild(viewButton);
    row.appendChild(actionsCell);

    tableBody.appendChild(row);
  }

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


/* -----------------------------------------------------
   Create a Checker Dropdown for a specific project row
------------------------------------------------------ */
function createCheckerDropdown(projectId, selectedChecker) {
    const dropdown = document.createElement('select');

    // Use the global 'checkerList' we loaded from the server
    // e.g. ["Abhilash Nayak", "Ahmet Kocaturk", ...]


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
/**
 * Add a button to assign default checkers to unassigned rows
 */
/**
 * Add an Assign Checkers button to the page
 */
/**
 * Add Assign Random Checkers Button
 */
function addAssignRandomCheckersButton() {
    const assignButton = document.getElementById("assignCheckersButton");
    if (assignButton) {
        assignButton.style.display = "inline-block"; // Make the button visible
        assignButton.onclick = assignRandomCheckers; // Attach the click event
    }
}

/**
 * Assign random checkers to all rows where no checker is assigned
 */
async function assignRandomCheckers() {
    const rows = document.querySelectorAll("#tableBody tr");

    for (const row of rows) {
        const checkerInput = row.querySelector(".checker-input");
        const projectId = row.dataset.projectId;

        if (!checkerInput.value || checkerInput.value === "Not Assigned") {
            const randomChecker = checkerList[Math.floor(Math.random() * checkerList.length)];
            checkerInput.value = randomChecker;

            // Link to datalist explicitly
            checkerInput.setAttribute('list', 'checker-options');

            try {
                const response = await fetch(`/update_checker/${projectId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ checker: randomChecker }),
                });

                if (!response.ok) {
                    console.error(`Failed to update checker for project ${projectId}`);
                } else {
                    console.log(`Checker assigned to project ${projectId}: ${randomChecker}`);
                }
            } catch (error) {
                console.error(`Error updating checker for project ${projectId}:`, error);
            }
        }
    }
}


// Add the button after DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
    addAssignRandomCheckersButton();
});

/* -----------------------------------------------------
   Page startup
------------------------------------------------------ */
loadSheets();
