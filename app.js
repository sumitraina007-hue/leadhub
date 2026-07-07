// ============================================================================
// ZYPP ELECTRIC LEAD DASHBOARD - ADVANCED JAVASCRIPT ENGINE (app.js)
// ============================================================================

// --- Config & Defaults ---
const CONFIG = {
  REFRESH_INTERVAL_SEC: 300, // 5 minutes
  SOURCES: [
    { key: 'delivery', name: 'Delivery Services', fallbackColor: '#00d2ff', defaultId: '', defaultGid: '0' },
    { key: 'fleetease', name: 'Fleetease.ai', fallbackColor: '#a855f7', defaultId: '1YjLKRIGX1nQx7SCuMavwq4aZNqxRvdiOk4EeYgmECRc', defaultGid: '1308323268' },
    { key: 'franchise', name: 'Franchise (Foco)', fallbackColor: '#76ff03', defaultId: '1WQTGGj2A6qIWC9UVGqOd_mhksbtCM_oD_WSZwpy9_9k', defaultGid: '0' },
    { key: 'ads', name: 'Ads (Advertisment)', fallbackColor: '#f59e0b', defaultId: '1cvFVTlWSce5whci4Au3MeqRRFVRb8baIiev6WZ7tE0o', defaultGid: '2044633763' },
    { key: 'riders', name: 'Riders', fallbackColor: '#ef4444', defaultId: '', defaultGid: '0' }
  ],
  UNIFIED_FIELDS: [
    { key: 'name',        label: 'Lead Name',        synonyms: ['your name', 'name', 'lead name', 'full name', 'applicant name', 'customer name', 'contact name', 'farmer name'] },
    { key: 'email',       label: 'Email',             synonyms: ['email', 'email id', 'email address', 'e-mail', 'mail'] },
    { key: 'mobile',      label: 'Mobile',            synonyms: ['mobile no.', 'mobile no', 'mobile', 'phone', 'contact', 'mobile number', 'phone number', 'contact number', 'whatsapp'] },
    { key: 'city',        label: 'City',              synonyms: ['your city', 'city', 'location', 'area', 'district', 'region'] },
    { key: 'poc',         label: 'Lead POC',          synonyms: ['name ', 'poc', 'lead poc', 'assigned to', 'owner', 'agent', 'executive', 'sales person', 'rep', 'team'] },
    { key: 'date',        label: 'Date',              synonyms: ['lead date', 'date', 'created date', 'submission date', 'enquiry date', 'submitted on', 'entry date', 'timestamp', 'form submit date'] },
    { key: 'callStatus',  label: 'Call Status',       synonyms: ['call status', 'status', 'calling status', 'disposition', 'contact status'] },
    { key: 'callInterest',label: 'Call Interest',     synonyms: ['call interest', 'interest', 'interest level', 'lead interest', 'interest status', 'lead temperature'] },
    { key: 'leadStatus',  label: 'Pipeline Status',   synonyms: ['lead status', 'pipeline', 'pipeline status', 'stage', 'crm status', 'deal stage'] },
    { key: 'remarks',     label: 'Remarks',           synonyms: ['remark ', 'remark', 'remarks', 'notes', 'comment', 'comments', 'description', 'details', 'feedback'] },
    { key: 'budget',      label: 'Budget',            synonyms: ['budget', 'investment', 'capital', 'amount', 'potential', 'fleet size'] },
    { key: 'model',       label: 'Franchise Model',   synonyms: ['franchise model', 'model', 'nature of business', 'business type', 'category'] }
  ],
};

// --- Application State ---
let state = {
  sheetIds: {},     // { sourceKey: sheetId }
  sheetGids: {},    // { sourceKey: gid }
  colMappings: {},   // { sourceKey: { fieldKey: columnIndex/columnLabel } }
  sheetSchemas: {},  // { sourceKey: [ { id, label } ] }
  
  allLeads: {
    delivery: [],
    fleetease: [],
    franchise: [],
    ads: [],
    riders: []
  },
  errors: {
    delivery: null,
    fleetease: null,
    franchise: null,
    ads: null,
    riders: null
  },
  
  demoMode: true,
  lastUpdated: null,
  
  // Refresh Timer
  countdownSeconds: CONFIG.REFRESH_INTERVAL_SEC,
  countdownPaused: false,
  timerInterval: null,
  
  // Data Explorer UI Settings
  filters: {
    search: '',
    source: 'all',
    model: 'all',
    status: 'all',
    interest: 'all',
    city: 'all',
    poc: 'all',
    dateStart: '',
    dateEnd: ''
  },
  sort: {
    field: 'date',
    direction: 'desc' // 'asc' or 'desc'
  },
  pagination: {
    page: 1,
    size: 25
  },
  
  // Selected Leads / Slide-out CRM state
  selectedLead: null,
  notesSaveTimeout: null,
  
  // Chart Instance
  chartInstance: null
};

// --- Initializing App ---
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  initUI();
  setupEventListeners();
  fetchAndRenderAll();
  startTimer();
});

// --- Configure UI Elements on Start ---
function initUI() {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Check demo toggle in checkbox
  document.getElementById('toggle-demo').checked = state.demoMode;
  
  // Preset dates in Config inputs
  CONFIG.SOURCES.forEach(s => {
    const inputId = document.getElementById(`cfg-sheet-${s.key}`);
    const inputGid = document.getElementById(`cfg-gid-${s.key}`);
    if (inputId) inputId.value = state.sheetIds[s.key] || '';
    if (inputGid) inputGid.value = state.sheetGids[s.key] || '';
  });
}

// --- Load config from LocalStorage ---
function loadConfig() {
  const savedIds = localStorage.getItem('zypp_sheet_ids_v2');
  const savedGids = localStorage.getItem('zypp_sheet_gids_v2');
  const savedDemo = localStorage.getItem('zypp_demo_mode_v2');
  const savedMappings = localStorage.getItem('zypp_col_mappings_v2');
  // v3: bumped to invalidate old caches missing model field
  const cachedLeads = localStorage.getItem('zypp_leads_cache_v3');
  
  // Load Sheet IDs
  if (savedIds) {
    state.sheetIds = JSON.parse(savedIds);
  } else {
    // Standard Defaults
    CONFIG.SOURCES.forEach(s => {
      state.sheetIds[s.key] = s.defaultId;
    });
  }
  
  // Load Sheet GIDs
  if (savedGids) {
    state.sheetGids = JSON.parse(savedGids);
  } else {
    CONFIG.SOURCES.forEach(s => {
      state.sheetGids[s.key] = s.defaultGid;
    });
  }

  // Load demo mode
  if (savedDemo !== null) {
    state.demoMode = savedDemo === 'true';
  } else {
    state.demoMode = true; // Enabled by default
  }

  // Load custom mappings
  if (savedMappings) {
    state.colMappings = JSON.parse(savedMappings);
  } else {
    CONFIG.SOURCES.forEach(s => {
      state.colMappings[s.key] = {}; // Will trigger auto-mapping initially
    });
  }
  
  // Load Cached leads if available (fast render)
  if (cachedLeads) {
    try {
      const cache = JSON.parse(cachedLeads);
      
      // Auto-invalidate cache if it was parsed before model mapping field was introduced
      let isOutdated = false;
      const franchiseLeads = cache.leads ? (cache.leads.franchise || []) : [];
      if (franchiseLeads.length > 0) {
        const hasModelValues = franchiseLeads.some(l => l.model && l.model !== 'N/A');
        if (!hasModelValues) {
          isOutdated = true;
          console.log("Outdated leads cache detected (missing model values). Triggering clean sync.");
        }
      }
      
      if (!isOutdated) {
        state.allLeads = cache.leads;
        state.lastUpdated = new Date(cache.timestamp);
        // Wait to draw after DOM fully loads
        setTimeout(() => {
          updateConnectionStatusPills();
          renderAllMetrics();
        }, 50);
      }
    } catch(e) {
      console.warn("Could not load leads cache", e);
    }
  }

  // Load persistent CSV uploads if available
  CONFIG.SOURCES.forEach(s => {
    const csvLeads = localStorage.getItem(`zypp_csv_leads_${s.key}`);
    if (csvLeads) {
      try {
        state.allLeads[s.key] = JSON.parse(csvLeads);
      } catch (e) {
        console.warn(`Could not load CSV leads cache for ${s.key}`, e);
      }
    }
  });
}

// --- Save config in LocalStorage ---
function saveConfig() {
  localStorage.setItem('zypp_sheet_ids_v2', JSON.stringify(state.sheetIds));
  localStorage.setItem('zypp_sheet_gids_v2', JSON.stringify(state.sheetGids));
  localStorage.setItem('zypp_demo_mode_v2', state.demoMode);
  localStorage.setItem('zypp_col_mappings_v2', JSON.stringify(state.colMappings));
}

// --- Save Leads to Cache ---
function cacheLeads() {
  const dataToCache = {
    leads: state.allLeads,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem('zypp_leads_cache_v3', JSON.stringify(dataToCache));
}

// --- Reset Configuration Defaults ---
function resetConfigToDefaults() {
  CONFIG.SOURCES.forEach(s => {
    state.sheetIds[s.key] = s.defaultId;
    state.sheetGids[s.key] = s.defaultGid;
    state.colMappings[s.key] = {};
    
    const inputId = document.getElementById(`cfg-sheet-${s.key}`);
    const inputGid = document.getElementById(`cfg-gid-${s.key}`);
    if (inputId) inputId.value = s.defaultId;
    if (inputGid) inputGid.value = s.defaultGid;
  });
  
  state.demoMode = true;
  document.getElementById('toggle-demo').checked = true;
  saveConfig();
  
  // Redraw mapper
  const currentMapperSource = document.getElementById('cfg-mapper-source-selector').value;
  buildColumnMapperUI(currentMapperSource);
  
  // Fetch
  fetchAndRenderAll();
}

// ============================================================================
// DATA FETCHING ENGINE & SHEET ACCESS
// ============================================================================

async function fetchAndRenderAll() {
  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.classList.add('loading');
    btnRefresh.disabled = true;
    const btnSpan = btnRefresh.querySelector('span');
    if (btnSpan) btnSpan.innerText = 'Syncing...';
    const btnIcon = btnRefresh.querySelector('i');
    if (btnIcon) btnIcon.classList.add('icon-spin');
  }

  // Display spinners in tables during data sync
  const matrixBody = document.getElementById('matrix-perf-body');
  const explorerBody = document.getElementById('explorer-leads-body');
  if (matrixBody) {
    matrixBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding: 2.5rem;"><i data-lucide="loader-2" class="icon-spin" style="margin-right: 0.5rem; vertical-align: middle; width: 16px; height: 16px; display: inline-block;"></i>Syncing sheets data matrix...</td></tr>`;
  }
  if (explorerBody) {
    explorerBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 2.5rem;"><i data-lucide="loader-2" class="icon-spin" style="margin-right: 0.5rem; vertical-align: middle; width: 16px; height: 16px; display: inline-block;"></i>Syncing explorer database...</td></tr>`;
  }
  if (window.lucide) {
    lucide.createIcons();
  }

  const fetchPromises = CONFIG.SOURCES.map(async (source) => {
    const sheetId = state.sheetIds[source.key];
    const gid = state.sheetGids[source.key] || '0';
    state.errors[source.key] = null; // Reset errors
    
    try {
      if (sheetId) {
        state.allLeads[source.key] = await fetchSheetDataJSONP(sheetId, gid, source.key);
      } else if (state.demoMode) {
        // Fallback to generating mock data
        state.allLeads[source.key] = generateMockLeads(source.key, source.name);
      } else {
        state.allLeads[source.key] = [];
      }
    } catch (err) {
      console.error(`Sync error on source ${source.name}:`, err);
      state.errors[source.key] = err.message || 'Connection Error';
      
      // If error occurs, check if we have cached leads for this source. If not, clear it.
      if (!state.allLeads[source.key] || state.allLeads[source.key].length === 0) {
        state.allLeads[source.key] = [];
      }
    }
  });

  await Promise.all(fetchPromises);
  
  state.lastUpdated = new Date();
  cacheLeads();
  
  // Update UI Elements
  updateConnectionStatusPills();
  updateDiagnosticBanner();
  renderAllMetrics();
  
  if (btnRefresh) {
    btnRefresh.classList.remove('loading');
    btnRefresh.disabled = false;
    const btnSpan = btnRefresh.querySelector('span');
    if (btnSpan) btnSpan.innerText = 'Sync Now';
    const btnIcon = btnRefresh.querySelector('i');
    if (btnIcon) {
      btnIcon.classList.remove('icon-spin');
      // Create fresh icon to restore original rotation
      if (window.lucide) lucide.createIcons();
    }
  }
  
  // Restart countdown timer
  resetTimer();
}

// JSONP fetch utility (bypasses CORS)
function fetchSheetDataJSONP(sheetId, gid, sourceKey) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gviz_callback_v2_' + Math.random().toString(36).substring(2, 15);
    const script = document.createElement('script');
    
    // Construct gviz query URL
    let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:${callbackName}&headers=1`;
    if (gid && gid !== '0') {
      url += `&gid=${gid}`;
    }
    script.src = url;
    script.id = callbackName;
    
    // 15 seconds timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Connection timed out. Check Google Sheet sharing permissions.'));
    }, 15000);
    
    function cleanup() {
      clearTimeout(timeoutId);
      const el = document.getElementById(callbackName);
      if (el) el.remove();
      delete window[callbackName];
    }
    
    window[callbackName] = function(data) {
      cleanup();
      try {
        if (!data || data.status === 'error') {
          const errMsg = data && data.errors && data.errors[0] ? data.errors[0].detailed_message : 'Empty spreadsheet response';
          reject(new Error(errMsg));
          return;
        }
        
        const parsedLeads = parseGvizTable(data, sourceKey);
        resolve(parsedLeads);
      } catch (err) {
        reject(err);
      }
    };
    
    script.onerror = function() {
      cleanup();
      reject(new Error('Access Restricted (401/404). Ensure "Anyone with the link can view" is enabled in sheet Share options.'));
    };
    
    document.body.appendChild(script);
  });
}

// Parse Google Sheet visualization JSON structure
function parseGvizTable(data, sourceKey) {
  const table = data.table;
  if (!table || !table.cols || !table.rows) {
    throw new Error('Spreadsheet format invalid. Columns or rows are missing.');
  }
  
  // Store Schema for column mapper UI
  const schema = table.cols.map((col, idx) => {
    return {
      index: idx,
      id: col.id || String.fromCharCode(65 + idx), // A, B, C...
      label: (col.label || '').trim()
    };
  });
  state.sheetSchemas[sourceKey] = schema;

  // Perform Column Mapping: Auto map or bind saved mappings
  const mapping = state.colMappings[sourceKey] || {};
  let currentMappings = {};
  
  CONFIG.UNIFIED_FIELDS.forEach(field => {
    const savedColBind = mapping[field.key];
    
    if (savedColBind !== undefined && savedColBind !== '') {
      // User has manually mapped this column
      // Support matching by label string or numeric index
      if (typeof savedColBind === 'number') {
        currentMappings[field.key] = savedColBind;
      } else {
        const found = schema.find(c => c.label.toLowerCase() === String(savedColBind).toLowerCase());
        currentMappings[field.key] = found ? found.index : -1;
      }
    } else {
      // Auto mapping using synonyms
      let bestIndex = -1;
      
      // Attempt 1: Exact label matches synonym
      for (const col of schema) {
        const colLbl = col.label.toLowerCase();
        if (field.synonyms.includes(colLbl)) {
          bestIndex = col.index;
          break;
        }
      }
      
      // Attempt 2: Case-insensitive starts/contains mapping
      if (bestIndex === -1) {
        for (const col of schema) {
          const colLbl = col.label.toLowerCase();
          const match = field.synonyms.some(syn => colLbl.includes(syn));
          if (match) {
            bestIndex = col.index;
            break;
          }
        }
      }
      
      currentMappings[field.key] = bestIndex;
    }
  });

  // Hardcoded default column mapping fallback definitions per source type
  const DEFAULT_SOURCE_MAPPINGS = {
    franchise: {
      name: 0, email: 1, mobile: 2, budget: 3, model: 4, city: 5, date: 6,
      poc: 8, callStatus: 12, callInterest: 14, leadStatus: 15, remarks: 19
    },
    ads: {
      date: 1, name: 2, email: 3, mobile: 4, city: 5, poc: 12,
      callStatus: 14, callInterest: 14, leadStatus: 18, remarks: 19
    },
    delivery: {
      name: 0, email: 1, mobile: 2, city: 3, date: 4, callStatus: 5, remarks: 6
    },
    fleetease: {
      name: 0, email: 1, mobile: 2, city: 3, model: 4, budget: 5, date: 9,
      poc: 8, callStatus: 10, callInterest: 13, leadStatus: 13, remarks: 14
    },
    riders: {
      name: 0, email: 1, mobile: 2, city: 3, date: 4, callStatus: 5, remarks: 6
    }
  };

  // Populate unresolved (-1) index positions using defaults fallbacks
  CONFIG.UNIFIED_FIELDS.forEach(field => {
    if (currentMappings[field.key] === -1 || currentMappings[field.key] === undefined) {
      const defaults = DEFAULT_SOURCE_MAPPINGS[sourceKey];
      if (defaults && defaults[field.key] !== undefined) {
        currentMappings[field.key] = defaults[field.key];
      }
    }
  });
  
  // Store actual resolved index mappings for this session
  state.colMappings[sourceKey] = currentMappings;

  // Process rows
  const leads = [];
  table.rows.forEach((row, rowIdx) => {
    const cells = row.c || [];
    
    const getVal = (fieldKey) => {
      const idx = currentMappings[fieldKey];
      if (idx !== undefined && idx !== -1 && idx < cells.length && cells[idx]) {
        const cell = cells[idx];
        if (cell && cell.v !== null && cell.v !== undefined) {
          // Format Date objects
          if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
            return parseGvizDate(cell.v);
          }
          return String(cell.v).trim();
        }
        if (cell && cell.f !== null && cell.f !== undefined) {
          return String(cell.f).trim();
        }
      }
      return '';
    };

    const name = getVal('name');
    const email = getVal('email');
    const mobile = getVal('mobile');
    const dateVal = getVal('date');
    
    // Skip empty rows
    if (!name && !email && !mobile && !dateVal) return;
    
    // Standardize Mobile Number (Indian prefix format support)
    let cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length === 10) {
      cleanMobile = '91' + cleanMobile;
    } else if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
      // OK
    }
    
    // Parse Dates into YYYY-MM-DD
    const { ymd, fullStr } = standardizeDate(dateVal);
    
    leads.push({
      id: `${sourceKey}_r${rowIdx}`,
      source: sourceKey,
      name: name || '(No Name)',
      email: email || 'N/A',
      mobile: cleanMobile || 'N/A',
      rawMobile: mobile,
      dateStr: fullStr,
      ymd: ymd,
      city: getVal('city') || 'Unknown',
      poc: getVal('poc') || 'Unassigned',
      callStatus: getVal('callStatus'),
      callInterest: getVal('callInterest'),
      leadStatus: getVal('leadStatus'),
      remarks: getVal('remarks'),
      budget: getVal('budget') || 'N/A',
      model: getVal('model') || 'N/A'
    });
  });
  
  return leads;
}

// GViz Date string parser "Date(2026,2,25)" -> YYYY-MM-DD
function parseGvizDate(dateStr) {
  const match = dateStr.match(/Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)/);
  if (match) {
    const y = match[1];
    const m = String(Number(match[2]) + 1).padStart(2, '0'); // GViz month is 0-indexed
    const d = String(match[3]).padStart(2, '0');
    
    if (match[4]) {
      const hh = String(match[4]).padStart(2, '0');
      const mm = String(match[5] || 0).padStart(2, '0');
      const ss = String(match[6] || 0).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

// Convert date strings into standardized object
function standardizeDate(dateVal) {
  if (!dateVal) return { ymd: '', fullStr: 'N/A' };
  
  // If already in YYYY-MM-DD format (from parseGvizDate), parse in local time
  const isoDateOnly = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const y = parseInt(isoDateOnly[1]);
    const m = parseInt(isoDateOnly[2]) - 1;
    const d = parseInt(isoDateOnly[3]);
    const dateObj = new Date(y, m, d);
    const yr = dateObj.getFullYear();
    const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dy = String(dateObj.getDate()).padStart(2, '0');
    return { ymd: `${yr}-${mo}-${dy}`, fullStr: `${yr}-${mo}-${dy}` };
  }

  // If already in YYYY-MM-DD HH:MM:SS format (from parseGvizDate with time)
  const isoDateTime = dateVal.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (isoDateTime) {
    const ymd = `${isoDateTime[1]}-${isoDateTime[2]}-${isoDateTime[3]}`;
    return { ymd, fullStr: dateVal };
  }

  // Try dd/mm/yyyy format
  const dmy = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmy) {
    const year = parseInt(dmy[3]);
    const month = parseInt(dmy[2]) - 1;
    const day = parseInt(dmy[1]);
    const hr = parseInt(dmy[4] || 0);
    const min = parseInt(dmy[5] || 0);
    const sec = parseInt(dmy[6] || 0);
    const dateObj = new Date(year, month, day, hr, min, sec);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    return { ymd: `${y}-${m}-${d}`, fullStr: `${y}-${m}-${d} ${hh}:${mm}:${ss}` };
  }

  // Fallback: let JavaScript parse it
  const dateObj = new Date(dateVal);
  if (isNaN(dateObj.getTime())) {
    return { ymd: '', fullStr: dateVal };
  }
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm2 = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');
  return {
    ymd: `${y}-${m}-${d}`,
    fullStr: `${y}-${m}-${d} ${hh}:${mm2}:${ss}`
  };
}

// ============================================================================
// METRICS AGGREGATION & PIPELINE ANALYSIS
// ============================================================================

// Standardized Date Calculation Range Contexts
function getStaticDateContext() {
  const today = new Date();
  const getOffsetDateStr = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };
  
  const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endLastMonthDate = new Date(today.getFullYear(), today.getMonth(), 0);
  
  const startLastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const endLastMonth = `${endLastMonthDate.getFullYear()}-${String(endLastMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endLastMonthDate.getDate()).padStart(2, '0')}`;

  return {
    today: getOffsetDateStr(0),
    y1: getOffsetDateStr(1),
    y2: getOffsetDateStr(2),
    y3: getOffsetDateStr(3),
    y4: getOffsetDateStr(4),
    mtdStart: startOfMonth,
    mtdEnd: getOffsetDateStr(0),
    lastMonthStart: startLastMonth,
    lastMonthEnd: endLastMonth
  };
}

// Aggregate numerical metrics for a list of leads
function aggregateLeadsMetrics(leads) {
  const dates = getStaticDateContext();
  
  const counts = {
    today: 0, y1: 0, y2: 0, y3: 0, y4: 0,
    mtd: 0, lastMonth: 0, total: leads.length,
    
    // Funnel classifications
    ingested: leads.length,
    connected: 0,
    interested: 0,
    converted: 0,
    lost: 0
  };
  
  leads.forEach(lead => {
    const ymd = lead.ymd;
    if (ymd === dates.today) counts.today++;
    if (ymd === dates.y1) counts.y1++;
    if (ymd === dates.y2) counts.y2++;
    if (ymd === dates.y3) counts.y3++;
    if (ymd === dates.y4) counts.y4++;
    
    if (ymd >= dates.mtdStart && ymd <= dates.mtdEnd) counts.mtd++;
    if (ymd >= dates.lastMonthStart && ymd <= dates.lastMonthEnd) counts.lastMonth++;
    
    // Funnel classification logic
    const status = (lead.callStatus || '').toLowerCase();
    const interest = (lead.callInterest || '').toLowerCase();
    const pipeline = (lead.leadStatus || '').toLowerCase();
    
    // 1. Converted / Paid
    const isConverted = status.includes('converted') || status.includes('paid') ||
                        interest.includes('converted') || interest.includes('paid') ||
                        pipeline.includes('converted') || pipeline.includes('paid');
                        
    // 2. Interested / Warm / Hot
    const isInterested = status.includes('interested') || status.includes('intrested') || status.includes('warm') || status.includes('hot') ||
                         interest.includes('interested') || interest.includes('intrested') || interest.includes('warm') || interest.includes('hot') ||
                         pipeline.includes('interested') || pipeline.includes('intrested') || pipeline.includes('warm') || pipeline.includes('hot');

    // 3. Connected (Called and reached)
    const isConnected = status.includes('connected') || status.includes('busy') || status.includes('callback') || status.includes('call again') || status.includes('follow up') || status.includes('followup') ||
                        interest.includes('connected') || interest.includes('busy') || interest.includes('callback') || interest.includes('call again') || interest.includes('follow up') || interest.includes('followup') ||
                        isInterested || isConverted;
                        
    // 4. Lost / Not Interested
    const isLost = status.includes('not interest') || status.includes('not intrest') || status.includes('no interest') || status.includes('wrong number') || status.includes('wrong no') ||
                   interest.includes('not interest') || interest.includes('not intrest') || interest.includes('no interest') || interest.includes('wrong number') || interest.includes('wrong no') ||
                   pipeline.includes('not interest') || pipeline.includes('not intrest') || pipeline.includes('no interest');

    if (isConverted) {
      counts.converted++;
      counts.interested++;
      counts.connected++;
    } else if (isInterested) {
      counts.interested++;
      counts.connected++;
    } else if (isConnected) {
      counts.connected++;
    }
    
    if (isLost) {
      counts.lost++;
    }
  });
  
  return counts;
}

// ============================================================================
// UI RENDERING CONTROLLERS
// ============================================================================

// Master Renderer for Metrics and Views
function renderAllMetrics() {
  const combinedLeads = getCombinedLeads();
  
  // Aggregate stats
  const combinedStats = aggregateLeadsMetrics(combinedLeads);
  const dates = getStaticDateContext();
  
  // 1. KPI Cards Updates
  updateKPICard('kpi-total-leads', combinedStats.total);
  updateKPICard('kpi-today-leads', combinedStats.today);
  updateKPICard('kpi-mtd-leads', combinedStats.mtd);
  
  // Calculate and draw Trends
  // Today's Trend vs Yesterday
  const todayTrendSpan = document.getElementById('today-leads-trend');
  if (todayTrendSpan) {
    const diff = combinedStats.today - combinedStats.y1;
    let pct = 0;
    if (combinedStats.y1 > 0) {
      pct = Math.round((diff / combinedStats.y1) * 100);
    }
    
    if (diff > 0) {
      todayTrendSpan.className = 'kpi-trend trend-up';
      todayTrendSpan.innerHTML = `<i data-lucide="trending-up"></i> <span>+${pct}% vs yesterday (${combinedStats.y1})</span>`;
    } else if (diff < 0) {
      todayTrendSpan.className = 'kpi-trend trend-down';
      todayTrendSpan.innerHTML = `<i data-lucide="trending-down"></i> <span>${pct}% vs yesterday (${combinedStats.y1})</span>`;
    } else {
      todayTrendSpan.className = 'kpi-trend trend-neutral';
      todayTrendSpan.innerHTML = `<span>Flat vs yesterday (${combinedStats.y1})</span>`;
    }
  }

  // MTD Trend vs Last Month
  const mtdTrendSpan = document.getElementById('mtd-leads-trend');
  if (mtdTrendSpan) {
    const diff = combinedStats.mtd - combinedStats.lastMonth;
    if (diff > 0) {
      mtdTrendSpan.className = 'kpi-trend trend-up';
      mtdTrendSpan.innerHTML = `<i data-lucide="arrow-up-right"></i> <span>+${diff} leads vs last month (${combinedStats.lastMonth})</span>`;
    } else if (diff < 0) {
      mtdTrendSpan.className = 'kpi-trend trend-down';
      mtdTrendSpan.innerHTML = `<i data-lucide="arrow-down-right"></i> <span>${diff} leads vs last month (${combinedStats.lastMonth})</span>`;
    } else {
      mtdTrendSpan.className = 'kpi-trend trend-neutral';
      mtdTrendSpan.innerHTML = `<span>Equal to last month (${combinedStats.lastMonth})</span>`;
    }
  }
  
  // Top Source Calculation
  let topSourceName = 'None';
  let topSourceVal = 0;
  CONFIG.SOURCES.forEach(s => {
    const count = state.allLeads[s.key].length;
    if (count > topSourceVal) {
      topSourceVal = count;
      topSourceName = s.name;
    }
  });
  const topSourcePct = combinedStats.total > 0 ? Math.round((topSourceVal / combinedStats.total) * 100) : 0;
  document.getElementById('kpi-top-source-val').innerText = topSourceName;
  document.getElementById('kpi-top-source-pct').innerText = `${topSourcePct}% of total volume (${topSourceVal} leads)`;
  
  // Top City Calculation
  const cityCounts = {};
  combinedLeads.forEach(l => {
    if (l.city && l.city !== 'Unknown') {
      cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
    }
  });
  let topCityName = 'N/A';
  let topCityVal = 0;
  Object.keys(cityCounts).forEach(c => {
    if (cityCounts[c] > topCityVal) {
      topCityVal = cityCounts[c];
      topCityName = c;
    }
  });
  document.getElementById('kpi-top-city-val').innerText = topCityName;
  document.getElementById('kpi-top-city-pct').innerText = `${topCityVal} leads from this location`;

  // Restore lucide icons in KPI trends
  if (window.lucide) lucide.createIcons();

  // 2. Render Funnel
  renderFunnelChart('all'); // All sources initially
  
  // 3. Render Ingestion Performance Matrix Table
  renderPerformanceMatrixTable();
  
  // 4. Populate Database Filters
  populateExplorerFilterDropdowns(combinedLeads);
  
  // 5. Render Chart.js Panel
  renderTrendChartPanel();
  
  // 6. Draw Data Explorer leads list
  renderExplorerTable();
}

function updateKPICard(cardId, value) {
  const card = document.getElementById(cardId);
  if (card) {
    const valEl = card.querySelector('.kpi-value');
    if (valEl) {
      // Animate numerical transition
      animateNumberValue(valEl, Number(valEl.innerText.replace(/,/g, '')) || 0, value, 800);
    }
  }
}

function animateNumberValue(obj, start, end, duration) {
  if (start === end) {
    obj.innerText = end.toLocaleString();
    return;
  }
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerText = Math.floor(progress * (end - start) + start).toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Render Funnel bars based on selected source filter
function renderFunnelChart(sourceKey) {
  const labelEl = document.getElementById('funnel-source-label');
  const sourceObj = CONFIG.SOURCES.find(s => s.key === sourceKey);
  labelEl.innerText = sourceObj ? sourceObj.name : 'All Sources';
  
  let leads = [];
  if (sourceKey === 'all') {
    leads = getCombinedLeads();
  } else {
    leads = state.allLeads[sourceKey] || [];
  }
  
  const stats = aggregateLeadsMetrics(leads);
  
  // Calculations
  const pctConnected = stats.ingested > 0 ? Math.round((stats.connected / stats.ingested) * 100) : 0;
  const pctInterested = stats.ingested > 0 ? Math.round((stats.interested / stats.ingested) * 100) : 0;
  const pctConverted = stats.ingested > 0 ? Math.round((stats.converted / stats.ingested) * 100) : 0;
  
  // Update elements
  document.getElementById('funnel-val-ingested').innerText = stats.ingested;
  
  document.getElementById('funnel-val-connected').innerText = stats.connected;
  document.getElementById('funnel-pct-connected').innerText = `${pctConnected}%`;
  document.getElementById('bar-connected').style.width = `${pctConnected}%`;
  
  document.getElementById('funnel-val-interested').innerText = stats.interested;
  document.getElementById('funnel-pct-interested').innerText = `${pctInterested}%`;
  document.getElementById('bar-interested').style.width = `${pctInterested}%`;
  
  document.getElementById('funnel-val-converted').innerText = stats.converted;
  document.getElementById('funnel-pct-converted').innerText = `${pctConverted}%`;
  document.getElementById('bar-converted').style.width = `${pctConverted}%`;
  
  document.getElementById('funnel-overall-conv').innerText = `${pctConverted}%`;
  document.getElementById('funnel-lost-count').innerText = stats.lost;
}

// Render the 5-source time period matrix table
function renderPerformanceMatrixTable() {
  const tbody = document.getElementById('matrix-perf-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const grandTotals = {
    today: 0, y1: 0, y2: 0, y3: 0, y4: 0, mtd: 0, lastMonth: 0, total: 0, connected: 0, converted: 0
  };
  
  CONFIG.SOURCES.forEach(source => {
    const leads = state.allLeads[source.key] || [];
    const stats = aggregateLeadsMetrics(leads);
    const hasId = !!state.sheetIds[source.key];
    const isMocked = !hasId && state.demoMode;
    const hasError = !!state.errors[source.key];
    
    // Accumulate Grand Totals
    grandTotals.today += stats.today;
    grandTotals.y1 += stats.y1;
    grandTotals.y2 += stats.y2;
    grandTotals.y3 += stats.y3;
    grandTotals.y4 += stats.y4;
    grandTotals.mtd += stats.mtd;
    grandTotals.lastMonth += stats.lastMonth;
    grandTotals.total += stats.total;
    grandTotals.connected += stats.connected;
    grandTotals.converted += stats.converted;
    
    const tr = document.createElement('tr');
    
    // Source status icon class
    let statusClass = 'dot-inactive';
    let statusTitle = 'Not Configured';
    if (hasError) {
      statusClass = 'dot-error';
      statusTitle = `Fetch Error: ${state.errors[source.key]}`;
    } else if (hasId) {
      statusClass = 'dot-active';
      statusTitle = 'Connected to Sheets';
    } else if (isMocked) {
      statusClass = 'dot-active';
      statusTitle = 'Mock Demo Mode Active';
    }
    
    // Connection Badges
    let badgeText = '';
    if (hasError) {
      badgeText = ` <span class="funnel-badge text-danger" style="font-size: 0.6rem;" title="${statusTitle}">⚠️ Error</span>`;
    } else if (isMocked) {
      badgeText = ` <span class="funnel-badge" style="font-size: 0.6rem; background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.3); color: var(--accent-purple);">Demo</span>`;
    }
    
    // Cells builder utility
    const getCell = (val, type, relativeChange = null) => {
      const isClickable = !hasError && val > 0;
      let trendClass = '';
      if (relativeChange !== null) {
        trendClass = relativeChange > 0 ? 'cell-trend-up' : (relativeChange < 0 ? 'cell-trend-down' : '');
      }
      
      return `<td class="text-center val-cell ${isClickable ? 'clickable' : 'val-zero'} ${trendClass}"
                  data-source="${source.key}"
                  data-type="${type}"
                  data-val="${val}">
                ${hasError ? '—' : val.toLocaleString()}
              </td>`;
    };
    
    const connRate = stats.total > 0 ? Math.round((stats.connected / stats.total) * 100) : 0;
    const convRate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;
    
    // Today vs Yesterday trend indicator highlight
    const todayDiff = stats.today - stats.y1;
    
    tr.innerHTML = `
      <td class="col-source" title="${statusTitle}">
        <span class="source-status ${statusClass}"></span>
        <span class="source-name-text">${source.name}</span>
        ${badgeText}
      </td>
      ${getCell(stats.today, 'today', todayDiff)}
      ${getCell(stats.y1, 'y1')}
      ${getCell(stats.y2, 'y2')}
      ${getCell(stats.y3, 'y3')}
      ${getCell(stats.y4, 'y4')}
      ${getCell(stats.mtd, 'mtd')}
      ${getCell(stats.lastMonth, 'lastMonth')}
      <td class="text-center val-cell font-bold ${stats.total > 0 && !hasError ? 'clickable' : 'val-zero'}" 
          data-source="${source.key}" data-type="total" data-val="${stats.total}">
        ${hasError ? '—' : stats.total.toLocaleString()}
      </td>
      <td class="text-center font-bold" style="color: var(--zypp-blue);">${hasError ? '—' : connRate + '%'}</td>
      <td class="text-center font-bold" style="color: var(--zypp-green);">${hasError ? '—' : convRate + '%'}</td>
    `;
    tbody.appendChild(tr);
  });
  
  // Append Totals row in footer
  const totalsRow = document.getElementById('matrix-perf-totals');
  if (totalsRow) {
    const totalConnRate = grandTotals.total > 0 ? Math.round((grandTotals.connected / grandTotals.total) * 100) : 0;
    const totalConvRate = grandTotals.total > 0 ? Math.round((grandTotals.converted / grandTotals.total) * 100) : 0;
    
    const totalDiff = grandTotals.today - grandTotals.y1;
    
    const getGrandTotalCell = (val, type, relativeChange = null) => {
      let trendClass = '';
      if (relativeChange !== null) {
        trendClass = relativeChange > 0 ? 'cell-trend-up' : (relativeChange < 0 ? 'cell-trend-down' : '');
      }
      return `<td class="text-center val-cell font-bold clickable ${trendClass}" 
                  data-source="all" data-type="${type}" data-val="${val}">
                ${val.toLocaleString()}
              </td>`;
    };
    
    totalsRow.innerHTML = `
      <td class="col-source">Grand Total</td>
      ${getGrandTotalCell(grandTotals.today, 'today', totalDiff)}
      ${getGrandTotalCell(grandTotals.y1, 'y1')}
      ${getGrandTotalCell(grandTotals.y2, 'y2')}
      ${getGrandTotalCell(grandTotals.y3, 'y3')}
      ${getGrandTotalCell(grandTotals.y4, 'y4')}
      ${getGrandTotalCell(grandTotals.mtd, 'mtd')}
      ${getGrandTotalCell(grandTotals.lastMonth, 'lastMonth')}
      <td class="text-center val-cell font-bold clickable" data-source="all" data-type="total" data-val="${grandTotals.total}">
        ${grandTotals.total.toLocaleString()}
      </td>
      <td class="text-center font-bold" style="color: var(--zypp-blue);">${totalConnRate}%</td>
      <td class="text-center font-bold" style="color: var(--zypp-green);">${totalConvRate}%</td>
    `;
  }
}

// Populate search filter select options dynamically
function populateExplorerFilterDropdowns(leads) {
  const citySelect = document.getElementById('filter-city');
  const pocSelect = document.getElementById('filter-poc');
  
  if (!citySelect || !pocSelect) return;
  
  const prevCity = citySelect.value;
  const prevPoc = pocSelect.value;
  
  // Set lists
  const cities = new Set();
  const pocs = new Set();
  
  leads.forEach(lead => {
    if (lead.city && lead.city !== 'Unknown') cities.add(lead.city);
    if (lead.poc && lead.poc !== 'Unassigned') pocs.add(lead.poc);
  });
  
  // Build City Options
  citySelect.innerHTML = '<option value="all">All Cities</option>';
  Array.from(cities).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.innerText = c;
    citySelect.appendChild(opt);
  });
  citySelect.value = cities.has(prevCity) ? prevCity : 'all';
  
  // Build POC Options
  pocSelect.innerHTML = '<option value="all">All Lead POCs</option>';
  Array.from(pocs).sort().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.innerText = p;
    pocSelect.appendChild(opt);
  });
  pocSelect.value = pocs.has(prevPoc) ? prevPoc : 'all';
}

// Master Render for the database explorer list
function renderExplorerTable() {
  const tbody = document.getElementById('explorer-leads-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // Dynamic visibility and state sync for Franchise Model filter
  const modelWrapper = document.getElementById('filter-model-wrapper');
  if (modelWrapper) {
    if (state.filters.source === 'franchise') {
      modelWrapper.style.display = 'flex';
    } else {
      modelWrapper.style.display = 'none';
      state.filters.model = 'all';
      const modelSelect = document.getElementById('filter-model');
      if (modelSelect) modelSelect.value = 'all';
    }
  }
  
  // 1. Get filtered list
  const filteredLeads = getFilteredLeads();
  
  // 2. Perform sorting
  sortLeadsList(filteredLeads);
  
  // 3. Update Pagination Metrics
  const pag = state.pagination;
  const totalLeads = filteredLeads.length;
  const maxPage = Math.max(Math.ceil(totalLeads / pag.size), 1);
  if (pag.page > maxPage) pag.page = maxPage;
  
  const startIdx = totalLeads === 0 ? 0 : (pag.page - 1) * pag.size;
  const endIdx = Math.min(startIdx + pag.size, totalLeads);
  
  document.getElementById('pag-start').innerText = totalLeads === 0 ? 0 : startIdx + 1;
  document.getElementById('pag-end').innerText = endIdx;
  document.getElementById('pag-total').innerText = totalLeads;
  document.getElementById('pag-page-text').innerText = `Page ${pag.page} of ${maxPage}`;
  
  // Button disabled statuses
  document.getElementById('btn-pag-prev').disabled = pag.page <= 1;
  document.getElementById('btn-pag-next').disabled = pag.page >= maxPage;
  
  // Active filter badge display indicator
  const hasActiveFilters = Object.keys(state.filters).some(k => {
    if (k === 'search') return state.filters[k].trim() !== '';
    return state.filters[k] !== 'all' && state.filters[k] !== '';
  });
  const filterIndicator = document.getElementById('filter-active-indicator');
  if (filterIndicator) {
    if (hasActiveFilters) {
      filterIndicator.classList.remove('hidden');
    } else {
      filterIndicator.classList.add('hidden');
    }
  }

  // Slice paginated items
  const paginatedLeads = filteredLeads.slice(startIdx, endIdx);
  
  if (paginatedLeads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 2.5rem;"><i data-lucide="database-zap" style="width:24px; height:24px; margin-bottom:0.5rem; display:block; margin-inline:auto;"></i>No leads matched the search criteria or filters.</td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  paginatedLeads.forEach((lead, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = lead.id;
    if (state.selectedLead && state.selectedLead.id === lead.id) {
      tr.className = 'row-selected';
    }
    
    // Status Badge classes
    let statusClass = 'blank';
    const sLower = (lead.callStatus || '').toLowerCase();
    if (sLower.includes('connected') || sLower.includes('busy')) statusClass = 'connected';
    else if (sLower.includes('not connected') || sLower.includes('answering') || sLower.includes('switched off') || sLower.includes('ring')) statusClass = 'not_connected';
    else if (sLower.includes('callback') || sLower.includes('call back') || sLower.includes('follow')) statusClass = 'call_back';
    else if (sLower.includes('not interest') || sLower.includes('no interest')) statusClass = 'not_interested';
    else if (sLower.includes('wrong no') || sLower.includes('wrong number')) statusClass = 'wrong_no';
    
    const displayStatus = lead.callStatus || '(blank)';
    
    // Interest tags classes
    let interestClass = '';
    const iLower = (lead.callInterest || '').toLowerCase();
    const lLower = (lead.leadStatus || '').toLowerCase();
    if (iLower.includes('hot') || lLower.includes('hot')) interestClass = 'hot';
    else if (iLower.includes('warm') || lLower.includes('warm')) interestClass = 'warm';
    else if (iLower.includes('converted') || iLower.includes('paid') || lLower.includes('converted') || lLower.includes('paid')) interestClass = 'converted';
    
    const displayInterest = lead.callInterest || lead.leadStatus || 'N/A';
    
    // Source color pill border
    const srcObj = CONFIG.SOURCES.find(s => s.key === lead.source);
    const sourceBadge = `<span class="source-pill" style="border-color: ${srcObj.fallbackColor}; color: ${srcObj.fallbackColor};">${srcObj ? srcObj.name : lead.source}</span>`;
    
    tr.innerHTML = `
      <td class="text-center text-muted font-mono">${startIdx + index + 1}</td>
      <td style="font-weight: 700; color: #ffffff;">${lead.name}</td>
      <td>${sourceBadge}</td>
      <td>
        <div class="contact-cell">
          <span class="contact-mobile">${lead.rawMobile}</span>
          <span class="contact-email">${lead.email}</span>
        </div>
      </td>
      <td class="font-mono text-secondary">${lead.dateStr}</td>
      <td>${lead.city}</td>
      <td><span class="badge-status ${statusClass}">${displayStatus}</span></td>
      <td><span class="interest-tag ${interestClass}">${displayInterest}</span></td>
      <td style="font-weight: 600;">${lead.poc}</td>
      <td class="text-center" onclick="event.stopPropagation()">
        <div class="row-actions-btn-group">
          <a class="row-action-btn action-wa" href="https://wa.me/${lead.mobile}?text=${encodeURIComponent('Hi ' + lead.name + ', reaching out from Zypp Electric regarding your lead request.')}" target="_blank" title="WhatsApp Lead">
            <i data-lucide="message-square"></i>
          </a>
          <a class="row-action-btn action-email" href="mailto:${lead.email}?subject=Zypp Electric Inquiry" title="Email Lead">
            <i data-lucide="mail"></i>
          </a>
          <button class="row-action-btn" onclick="openLeadProfileDrawer('${lead.id}')" title="Details & CRM Notes">
            <i data-lucide="chevron-right"></i>
          </button>
        </div>
      </td>
    `;
    
    tr.addEventListener('click', () => {
      openLeadProfileDrawer(lead.id);
    });
    
    tbody.appendChild(tr);
  });
  
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Render connection diagnostic grid in the Config Modal Diagnostics tab
function renderDiagnosticTab() {
  const container = document.getElementById('diagnostic-conn-list');
  if (!container) return;
  container.innerHTML = '';
  
  CONFIG.SOURCES.forEach(source => {
    const sheetId = state.sheetIds[source.key];
    const hasId = !!sheetId;
    const error = state.errors[source.key];
    
    let statusText = 'Pending';
    let statusClass = 'pending';
    let details = 'Awaiting connection test or missing configuration ID';
    
    if (error) {
      statusText = 'Error';
      statusClass = 'err';
      details = `Sync Failed: ${error}. Verify sheet settings.`;
    } else if (hasId) {
      statusText = 'Connected';
      statusClass = 'ok';
      details = `Successful. Ingested ${state.allLeads[source.key].length} lead records.`;
    } else if (state.demoMode) {
      statusText = 'Demo Mode';
      statusClass = 'ok';
      details = `Displaying cached mock data (${state.allLeads[source.key].length} records)`;
    }
    
    const div = document.createElement('div');
    div.className = 'diagnostic-item';
    div.innerHTML = `
      <div class="diag-source-info">
        <div class="diag-source-title">
          <span class="status-dot dot-${error ? 'error' : (hasId ? 'active' : 'inactive')}"></span>
          ${source.name}
        </div>
        <div class="diag-source-desc">${details}</div>
        <div class="diag-source-desc" style="font-family: monospace; font-size: 0.65rem; margin-top: 0.15rem;">
          ID: ${sheetId || 'None configured'}
        </div>
      </div>
      <div class="diag-actions">
        <span class="diag-status-text ${statusClass}">${statusText}</span>
        <button class="btn btn-secondary btn-sm" onclick="fetchAndRenderAll()" title="Re-sync source data">Test</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// Update the Connection Hub pills in header
function updateConnectionStatusPills() {
  CONFIG.SOURCES.forEach(s => {
    const pill = document.getElementById(`pill-${s.key}`);
    if (!pill) return;
    
    const dot = pill.querySelector('.status-dot');
    if (!dot) return;
    
    const sheetId = state.sheetIds[s.key];
    const error = state.errors[s.key];
    
    dot.className = 'status-dot';
    if (error) {
      dot.classList.add('dot-error');
      pill.title = `${s.name}: Fetch Error - ${error}`;
    } else if (sheetId) {
      dot.classList.add('dot-active');
      pill.title = `${s.name}: Active (${state.allLeads[s.key].length} rows loaded)`;
    } else if (state.demoMode) {
      dot.classList.add('dot-active');
      pill.title = `${s.name}: Demo Mode Active`;
    } else {
      dot.classList.add('dot-inactive');
      pill.title = `${s.name}: Missing Sheet Configuration`;
    }
  });
}

// Update global sync error banner at top of application
function updateDiagnosticBanner() {
  const banner = document.getElementById('diagnostic-banner');
  if (!banner) return;
  
  const activeErrors = CONFIG.SOURCES.filter(s => state.errors[s.key]);
  
  if (activeErrors.length > 0) {
    const errorList = activeErrors.map(s => `${s.name}: ${state.errors[s.key]}`).join(' | ');
    const bannerText = banner.querySelector('.banner-text');
    if (bannerText) {
      bannerText.innerHTML = `<span class="banner-title">Sync Warning:</span> [${errorList}]. Ensure Google Sheets are set to <strong>"Anyone with link can view"</strong>.`;
    }
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// ============================================================================
// PROFILE DRAWER & MINI-CRM CONTROLLERS
// ============================================================================

// Open profile detail view slide-out drawer
function openLeadProfileDrawer(leadId) {
  const lead = getCombinedLeads().find(l => l.id === leadId);
  if (!lead) return;
  
  state.selectedLead = lead;
  
  // Highlight selected row in table explorer
  document.querySelectorAll('#explorer-leads-body tr').forEach(r => {
    r.classList.remove('row-selected');
    if (r.dataset.id === leadId) {
      r.classList.add('row-selected');
    }
  });
  
  // Set drawer contents
  document.getElementById('drawer-lead-name').innerText = lead.name;
  
  const srcObj = CONFIG.SOURCES.find(s => s.key === lead.source);
  const badge = document.getElementById('drawer-source-badge');
  badge.innerText = srcObj ? srcObj.name : lead.source;
  badge.style.borderColor = srcObj.fallbackColor;
  badge.style.color = srcObj.fallbackColor;
  badge.style.background = srcObj.fallbackColor + '15';
  
  // Core Info
  document.getElementById('det-name').innerText = lead.name;
  document.getElementById('det-email').innerText = lead.email;
  document.getElementById('det-mobile').innerText = lead.rawMobile;
  document.getElementById('det-city').innerText = lead.city;
  document.getElementById('det-date').innerText = lead.dateStr;
  document.getElementById('det-poc').innerText = lead.poc;
  
  // Financials block toggles based on details availability
  const finSection = document.getElementById('drawer-section-financials');
  if (lead.source === 'franchise' || lead.budget !== 'N/A' || lead.model !== 'N/A') {
    finSection.style.display = 'block';
    document.getElementById('det-budget').innerText = lead.budget;
    document.getElementById('det-model').innerText = lead.model;
  } else {
    finSection.style.display = 'none';
  }
  
  // Pipeline metadata
  document.getElementById('det-call-status').innerText = lead.callStatus || '(blank)';
  document.getElementById('det-interest').innerText = lead.callInterest || '(blank)';
  document.getElementById('det-lead-status').innerText = lead.leadStatus || '(blank)';
  document.getElementById('det-remarks').innerText = lead.remarks || '(No comments in spreadsheet)';
  
  // WhatsApp Link pre-filler templates
  const waBtn = document.getElementById('btn-cta-whatsapp');
  const customMessage = `Hi ${lead.name}, this is ${lead.poc || 'Zypp Support'} representing Zypp Electric. We received your lead inquiry and would love to connect.`;
  waBtn.href = `https://wa.me/${lead.mobile}?text=${encodeURIComponent(customMessage)}`;
  
  // Email template pre-filler
  const emailBtn = document.getElementById('btn-cta-email');
  emailBtn.href = `mailto:${lead.email}?subject=Zypp Electric Inquiry&body=Dear ${lead.name},\n\nThank you for reaching out to Zypp Electric. We would love to discuss more about your inquiry.\n\nBest regards,\n${lead.poc || 'Zypp Electric Team'}`;
  
  // Call Dial link
  document.getElementById('btn-cta-phone').href = `tel:${lead.rawMobile}`;
  
  // Load Followup CRM local Notes
  const crmNotesText = document.getElementById('drawer-crm-notes');
  const savedNotes = localStorage.getItem(`zypp_crm_notes_${lead.id}`);
  crmNotesText.value = savedNotes || '';
  
  // Hide saving status notice
  document.getElementById('notes-save-indicator').classList.remove('active');
  
  // Display drawer
  document.getElementById('lead-drawer').classList.add('active');
}

function closeLeadProfileDrawer() {
  document.getElementById('lead-drawer').classList.remove('active');
  state.selectedLead = null;
  // Clear selected highlights
  document.querySelectorAll('#explorer-leads-body tr').forEach(r => {
    r.classList.remove('row-selected');
  });
}

// Auto-saving crm notes text
function handleCrmNotesChange(e) {
  if (!state.selectedLead) return;
  const leadId = state.selectedLead.id;
  const value = e.target.value;
  
  // Set localStorage draft
  localStorage.setItem(`zypp_crm_notes_${leadId}`, value);
  
  // Visual save confirmation toggle indicator
  const indicator = document.getElementById('notes-save-indicator');
  indicator.classList.add('active');
  
  if (state.notesSaveTimeout) clearTimeout(state.notesSaveTimeout);
  state.notesSaveTimeout = setTimeout(() => {
    indicator.classList.remove('active');
  }, 2000);
}

// ============================================================================
// SETTINGS MODAL & VISUAL MAPPING BUILDER
// ============================================================================

function toggleSettingsModal(visible) {
  const modal = document.getElementById('settings-modal');
  if (visible) {
    // Populate settings inputs from state
    CONFIG.SOURCES.forEach(s => {
      document.getElementById(`cfg-sheet-${s.key}`).value = state.sheetIds[s.key] || '';
      document.getElementById(`cfg-gid-${s.key}`).value = state.sheetGids[s.key] || '';
    });
    
    // Set default selected mapper tab
    const selector = document.getElementById('cfg-mapper-source-selector');
    buildColumnMapperUI(selector.value);
    
    // Populate Diagnostics view
    renderDiagnosticTab();
    
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

// Switch between modal config panels
function handleModalTabSwitch(e) {
  const tabBtn = e.target.closest('.modal-tab');
  if (!tabBtn) return;
  
  // Set active tab buttons
  document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
  tabBtn.classList.add('active');
  
  // Set active tab content panel
  const targetId = tabBtn.dataset.tab;
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const content = document.getElementById(targetId);
  if (content) content.classList.add('active');
}

// Build dropdown selectors inside Settings modal to customize fields mappings
function buildColumnMapperUI(sourceKey) {
  const container = document.getElementById('col-mapper-fields-rows');
  if (!container) return;
  container.innerHTML = '';
  
  const schema = state.sheetSchemas[sourceKey] || [];
  const mappings = state.colMappings[sourceKey] || {};
  
  CONFIG.UNIFIED_FIELDS.forEach(field => {
    const mappedIdxVal = mappings[field.key]; // Current mapped index
    
    const row = document.createElement('div');
    row.className = 'mapper-row';
    
    // Left Label Column
    const labelCol = document.createElement('div');
    labelCol.className = 'mapper-field-lbl';
    labelCol.innerHTML = `${field.label} <span>(Synonyms: ${field.synonyms.slice(0, 3).join(', ')})</span>`;
    
    // Right Selector Column
    const selectCol = document.createElement('div');
    selectCol.className = 'mapper-select-col';
    
    const select = document.createElement('select');
    select.className = 'select-input select-xs';
    select.dataset.field = field.key;
    
    // Build default auto option
    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.innerText = 'Auto-Detect Column';
    select.appendChild(autoOpt);
    
    if (schema.length > 0) {
      // If we fetched the sheet, build options from headers
      schema.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.label; // Store mapping as column label string
        opt.innerText = `Col ${col.id}: "${col.label || '(empty)'}"`;
        
        // Mark selected
        // Support index matching or exact string match
        if (typeof mappedIdxVal === 'number' && mappedIdxVal === col.index) {
          opt.selected = true;
        } else if (String(mappedIdxVal).toLowerCase() === col.label.toLowerCase()) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    } else {
      // If sheet hasn't loaded yet, build generic numeric indexes
      for (let i = 0; i < 20; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Column Index ${i} (${String.fromCharCode(65 + i)})`;
        if (mappedIdxVal === i) opt.selected = true;
        select.appendChild(opt);
      }
    }
    
    selectCol.appendChild(select);
    row.appendChild(labelCol);
    row.appendChild(selectCol);
    container.appendChild(row);
  });
}

// Save modal settings configuration
function handleSaveSettings() {
  CONFIG.SOURCES.forEach(s => {
    const idVal = document.getElementById(`cfg-sheet-${s.key}`).value.trim();
    const gidVal = document.getElementById(`cfg-gid-${s.key}`).value.trim();
    state.sheetIds[s.key] = idVal;
    state.sheetGids[s.key] = gidVal;
  });
  
  // Save active columns maps from Mapper UI
  const activeMapperSource = document.getElementById('cfg-mapper-source-selector').value;
  const selects = document.querySelectorAll('#col-mapper-fields-rows select');
  
  if (selects.length > 0) {
    if (!state.colMappings[activeMapperSource]) {
      state.colMappings[activeMapperSource] = {};
    }
    selects.forEach(select => {
      const field = select.dataset.field;
      const val = select.value;
      
      // Parse numeric indexes vs string label mapping
      if (val === '') {
        state.colMappings[activeMapperSource][field] = ''; // Trigger auto detect
      } else if (!isNaN(val) && val !== '') {
        state.colMappings[activeMapperSource][field] = parseInt(val);
      } else {
        state.colMappings[activeMapperSource][field] = val;
      }
    });
  }
  
  saveConfig();
  toggleSettingsModal(false);
  
  // Trigger fresh fetch
  fetchAndRenderAll();
}

// ============================================================================
// INTERACTIVE CHARTING PANEL (Chart.js)
// ============================================================================

function renderTrendChartPanel() {
  const canvas = document.getElementById('mainTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const metric = document.getElementById('chart-metric-selector').value;
  const source = document.getElementById('chart-source-selector').value;
  const cType = document.querySelector('.btn-toggle.active').id === 'chart-type-line' ? 'line' : 'bar';
  
  let leads = [];
  if (source === 'all') {
    leads = getCombinedLeads();
  } else {
    leads = state.allLeads[source] || [];
  }
  
  // Destroy previous Chart instance
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }
  
  let chartData = { labels: [], datasets: [] };
  
  // Chart Color Contexts
  const srcObj = CONFIG.SOURCES.find(s => s.key === source);
  const themeColor = srcObj ? srcObj.fallbackColor : '#76ff03';
  
  if (metric === 'ingestion') {
    // Lead ingestion over the last 14 days
    const dateCounts = {};
    const dates = [];
    
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const key = `${yr}-${mo}-${dy}`;
      dateCounts[key] = 0;
      
      const labelStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      dates.push({ key, label: labelStr });
    }
    
    leads.forEach(l => {
      if (dateCounts[l.ymd] !== undefined) {
        dateCounts[l.ymd]++;
      }
    });
    
    chartData.labels = dates.map(d => d.label);
    
    if (source === 'all') {
      // Draw stacked datasets for each source
      chartData.datasets = CONFIG.SOURCES.map(s => {
        const counts = dates.map(d => {
          return state.allLeads[s.key].filter(l => l.ymd === d.key).length;
        });
        
        return {
          label: s.name,
          data: counts,
          backgroundColor: s.fallbackColor + 'bf',
          borderColor: s.fallbackColor,
          borderWidth: 1.5,
          borderRadius: 4,
          tension: 0.3,
          fill: cType === 'line' ? false : undefined
        };
      });
    } else {
      chartData.datasets = [{
        label: `${srcObj.name} Ingestion`,
        data: dates.map(d => dateCounts[d.key]),
        backgroundColor: themeColor + '40',
        borderColor: themeColor,
        borderWidth: 2,
        fill: cType === 'line',
        tension: 0.3,
        pointBackgroundColor: themeColor,
        pointBorderColor: '#ffffff',
        pointRadius: 4
      }];
    }
    
  } else if (metric === 'city') {
    // City counts chart (Horizontal bar chart)
    const cityCounts = {};
    leads.forEach(l => {
      if (l.city) {
        cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
      }
    });
    
    // Sort cities by lead counts
    const sortedCities = Object.keys(cityCounts)
      .map(k => ({ city: k, count: cityCounts[k] }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 10); // Top 10 cities
      
    chartData.labels = sortedCities.map(c => c.city);
    chartData.datasets = [{
      label: 'Leads by City',
      data: sortedCities.map(c => c.count),
      backgroundColor: themeColor + 'a0',
      borderColor: themeColor,
      borderWidth: 1.5,
      borderRadius: 4
    }];
    
  } else if (metric === 'poc') {
    // POC Performance Breakdown chart
    const pocCounts = {};
    const pocConv = {};
    
    leads.forEach(l => {
      const pocName = l.poc || 'Unassigned';
      if (!pocCounts[pocName]) {
        pocCounts[pocName] = 0;
        pocConv[pocName] = 0;
      }
      pocCounts[pocName]++;
      
      const status = (l.callStatus || '').toLowerCase();
      const interest = (l.callInterest || '').toLowerCase();
      const pipeline = (l.leadStatus || '').toLowerCase();
      if (status.includes('converted') || status.includes('paid') ||
          interest.includes('converted') || interest.includes('paid') ||
          pipeline.includes('converted') || pipeline.includes('paid')) {
        pocConv[pocName]++;
      }
    });
    
    const pocSorted = Object.keys(pocCounts)
      .map(k => ({ poc: k, count: pocCounts[k], converted: pocConv[k] }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 8); // Top 8 agents
      
    chartData.labels = pocSorted.map(p => p.poc);
    chartData.datasets = [
      {
        label: 'Total Leads Assigned',
        data: pocSorted.map(p => p.count),
        backgroundColor: 'rgba(0, 210, 255, 0.6)',
        borderColor: '#00d2ff',
        borderWidth: 1.5,
        borderRadius: 4
      },
      {
        label: 'Converted Deals',
        data: pocSorted.map(p => p.converted),
        backgroundColor: 'rgba(118, 255, 3, 0.6)',
        borderColor: '#76ff03',
        borderWidth: 1.5,
        borderRadius: 4
      }
    ];
  }
  
  // Render Chart
  state.chartInstance = new Chart(ctx, {
    type: metric === 'city' ? 'bar' : cType,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: metric === 'city' ? 'y' : 'x', // Horizontal bar chart for cities
      scales: {
        x: {
          stacked: metric === 'ingestion' && source === 'all' && cType === 'bar',
          grid: { color: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
        },
        y: {
          stacked: metric === 'ingestion' && source === 'all' && cType === 'bar',
          grid: { color: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, precision: 0 }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f8fafc',
            font: { family: 'Outfit', weight: 500, size: 11 },
            boxWidth: 12,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: '#0a0f1d',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          titleFont: { family: 'Outfit', weight: 600 },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10
        }
      }
    }
  });
}

// ============================================================================
// DATA FILTERING & DATA COMPILING ENGINE
// ============================================================================

// Returns consolidated arrays of all sources combined
function getCombinedLeads() {
  let combined = [];
  CONFIG.SOURCES.forEach(s => {
    combined = combined.concat(state.allLeads[s.key] || []);
  });
  return combined;
}

// Master lead list filter for Database Explorer
function getFilteredLeads() {
  const f = state.filters;
  let leads = getCombinedLeads();
  
  // 1. Source Filter
  if (f.source !== 'all') {
    leads = state.allLeads[f.source] || [];
  }
  
  // 2. Text Search
  const query = f.search.toLowerCase().trim();
  if (query) {
    leads = leads.filter(l => {
      return (l.name || '').toLowerCase().includes(query) ||
             (l.email || '').toLowerCase().includes(query) ||
             (l.rawMobile || '').includes(query) ||
             (l.city || '').toLowerCase().includes(query) ||
             (l.poc || '').toLowerCase().includes(query) ||
             (l.callStatus || '').toLowerCase().includes(query) ||
             (l.callInterest || '').toLowerCase().includes(query) ||
             (l.remarks || '').toLowerCase().includes(query);
    });
  }
  
  // 3. Ingestion range filters
  if (f.dateStart) {
    leads = leads.filter(l => l.ymd && l.ymd >= f.dateStart);
  }
  if (f.dateEnd) {
    leads = leads.filter(l => l.ymd && l.ymd <= f.dateEnd);
  }
  
  // 4. City Filter
  if (f.city !== 'all') {
    leads = leads.filter(l => l.city === f.city);
  }
  
  // 5. POC Filter
  if (f.poc !== 'all') {
    leads = leads.filter(l => l.poc === f.poc);
  }
  
  // 6. Call Status Categorized Filters
  if (f.status !== 'all') {
    leads = leads.filter(lead => {
      const s = (lead.callStatus || '').toLowerCase();
      switch(f.status) {
        case 'connected':
          return s.includes('connected') || s.includes('busy');
        case 'not_connected':
          return s.includes('not connected') || s.includes('answering') || s.includes('switched off') || s.includes('ring');
        case 'call_back':
          return s.includes('callback') || s.includes('call back') || s.includes('follow');
        case 'not_interested':
          return s.includes('not interest') || s.includes('no interest');
        case 'wrong_no':
          return s.includes('wrong no') || s.includes('wrong number');
        case 'blank':
          return s === '';
        default:
          return true;
      }
    });
  }
  
  // 7. Interest Level Categorized Filters
  if (f.interest !== 'all') {
    leads = leads.filter(lead => {
      const i = (lead.callInterest || '').toLowerCase();
      const pl = (lead.leadStatus || '').toLowerCase();
      switch(f.interest) {
        case 'interested':
          return (i.includes('interested') || i.includes('intrested')) && !i.includes('not');
        case 'not_interested':
          return i.includes('not interest') || i.includes('not intrest') || i.includes('no interest');
        case 'warm':
          return i.includes('warm') || pl.includes('warm');
        case 'cold':
          return i.includes('cold') || pl.includes('cold');
        case 'hot':
          return i.includes('hot') || pl.includes('hot');
        case 'converted':
          return i.includes('converted') || i.includes('paid') || pl.includes('converted') || pl.includes('paid');
        case 'blank':
          return i === '' && pl === '';
        default:
          return true;
      }
    });
  }
  
  // 8. Franchise Model Filter (only applicable when selected source is franchise)
  if (f.source === 'franchise' && f.model !== 'all') {
    leads = leads.filter(l => (l.model || '').toLowerCase() === f.model);
  }
  
  return leads;
}

// Database Explorer sorting mechanism
function sortLeadsList(leads) {
  const field = state.sort.field;
  const dir = state.sort.direction === 'asc' ? 1 : -1;
  
  leads.sort((a, b) => {
    let valA = a[field] || '';
    let valB = b[field] || '';
    
    if (field === 'date') {
      valA = a.ymd || '';
      valB = b.ymd || '';
    }
    
    // Case insensitive string compare
    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * dir;
    }
    return (valA > valB ? 1 : -1) * dir;
  });
}

// ============================================================================
// COUNTDOWN TIMER CONTROLLER
// ============================================================================

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  const progressCircle = document.querySelector('.circle-progress');
  const countText = document.getElementById('countdown-text');
  const maxDash = 81.68; // 2 * PI * 13
  
  state.timerInterval = setInterval(() => {
    if (state.countdownPaused) return;
    
    state.countdownSeconds--;
    
    // Update SVG countdown circle bar
    if (progressCircle) {
      const pct = state.countdownSeconds / CONFIG.REFRESH_INTERVAL_SEC;
      const offset = maxDash * (1 - pct);
      progressCircle.style.strokeDashoffset = offset;
    }
    
    // Update text
    const m = Math.floor(state.countdownSeconds / 60);
    const s = String(state.countdownSeconds % 60).padStart(2, '0');
    if (countText) countText.innerText = `${m}:${s}`;
    
    if (state.countdownSeconds <= 0) {
      clearInterval(state.timerInterval);
      fetchAndRenderAll();
    }
  }, 1000);
}

function resetTimer() {
  state.countdownSeconds = CONFIG.REFRESH_INTERVAL_SEC;
  const progressCircle = document.querySelector('.circle-progress');
  if (progressCircle) progressCircle.style.strokeDashoffset = 0;
  startTimer();
}

// Toggle play/pause refresh countdown timer
function togglePauseRefreshTimer() {
  state.countdownPaused = !state.countdownPaused;
  const btn = document.getElementById('btn-pause-timer');
  if (!btn) return;
  
  const icon = btn.querySelector('i');
  if (state.countdownPaused) {
    btn.title = "Resume Auto-Refresh";
    if (icon) {
      icon.setAttribute('data-lucide', 'play');
      if (window.lucide) lucide.createIcons();
    }
  } else {
    btn.title = "Pause Auto-Refresh";
    if (icon) {
      icon.setAttribute('data-lucide', 'pause');
      if (window.lucide) lucide.createIcons();
    }
  }
}

// ============================================================================
// EXPORTING LEADS TO CSV
// ============================================================================

function exportExplorerLeadsToCSV() {
  const leads = getFilteredLeads();
  if (leads.length === 0) {
    alert("No leads found matching current filter context to export.");
    return;
  }
  
  const headers = ['Lead Name', 'Source', 'Email', 'Mobile', 'Date Captured', 'City', 'Call Status', 'Interest', 'Lead POC', 'Budget', 'Model', 'Remarks'];
  
  const rows = leads.map(l => {
    const srcObj = CONFIG.SOURCES.find(s => s.key === l.source);
    const srcName = srcObj ? srcObj.name : l.source;
    
    const escapeCsv = (val) => {
      if (!val) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };
    
    return [
      escapeCsv(l.name),
      escapeCsv(srcName),
      escapeCsv(l.email),
      escapeCsv(l.rawMobile),
      escapeCsv(l.dateStr),
      escapeCsv(l.city),
      escapeCsv(l.callStatus),
      escapeCsv(l.callInterest || l.leadStatus),
      escapeCsv(l.poc),
      escapeCsv(l.budget),
      escapeCsv(l.model),
      escapeCsv(l.remarks)
    ];
  });
  
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // UTF-8 BOM
    + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  
  // Format filename using active context
  const timestamp = new Date().toISOString().slice(0,10);
  link.setAttribute("download", `Zypp_Electric_Leads_${state.filters.source}_${timestamp}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// MOCK DATA GENERATOR (DEMO MODE FALLBACK)
// ============================================================================

function generateMockLeads(sourceKey, sourceName) {
  const leads = [];
  const dates = getStaticDateContext();
  const today = new Date();
  
  // Define distribution metrics weighting based on offset days
  const dateDistribution = [
    { offset: 0, count: 8 },  // Today
    { offset: 1, count: 12 }, // Yesterday
    { offset: 2, count: 5 },
    { offset: 3, count: 6 },
    { offset: 4, count: 4 },
    { offset: 5, count: 9 },
    { offset: 6, count: 5 },
    { offset: 7, count: 3 }
  ];
  
  // Add other monthly offset leads distribution
  const mtdDays = today.getDate();
  for (let i = 8; i < mtdDays; i++) {
    dateDistribution.push({ offset: i, count: Math.floor(Math.random() * 4) + 1 });
  }
  // Last month leads distribution
  for (let i = mtdDays; i < mtdDays + 30; i++) {
    dateDistribution.push({ offset: i, count: Math.floor(Math.random() * 3) });
  }

  // Dictionaries
  const firstNames = ["Rahul", "Amit", "Priya", "Neha", "Vikas", "Siddharth", "Aman", "Rohan", "Sneha", "Karan", "Kunal", "Megha", "Shweta", "Raj", "Sunil", "Pranav", "Harsh", "Deepika", "Aditya", "Tarun", "Divya"];
  const lastNames = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Mehta", "Kumar", "Chaudhary", "Joshi", "Bose", "Dutta", "Nair", "Rao", "Jadhav", "Sinha", "Mishra", "Pandey"];
  
  const cities = ["Delhi", "Gurugram", "Noida", "Faridabad", "Ghaziabad", "Bangalore", "Pune", "Mumbai", "Hyderabad", "Kolkata"];
  const pocs = ["Sumit", "Preety", "Saurabh", "Sheetal", "Kunal"];
  
  const callStatuses = ["Connected", "Connected", "Not Connected", "Call Back", "Followup", "Wrong Number", "Busy", "Not Answering", ""];
  const interests = ["Interested", "Warm", "Hot", "Cold", "Not Interested", ""];
  const pipelines = ["Warm", "Cold", "Hot", "Converted", "Paid", ""];
  const budgets = ["5 Lakhs", "10 Lakhs", "20 Lakhs", "25 Lakhs", "50 Lakhs", "1 Crore"];
  const models = ["FOCO", "FOFO", "FOFO"];
  const remarks = [
    "Interested, shared franchise deck",
    "Call back on next Monday",
    "Wrong number, close lead",
    "Rider requirement misunderstanding",
    "VC scheduled",
    "Budget constraint, will re-engage in August",
    "No response, 3 attempts done",
    "Expecting proposal details by tonight",
    "Connected, positive response"
  ];
  
  let idCounter = 1;
  
  dateDistribution.forEach(dist => {
    // Generate dates string
    const d = new Date();
    d.setDate(d.getDate() - dist.offset);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const ymd = `${yr}-${mo}-${dy}`;
    
    for (let c = 0; c < dist.count; c++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${fn} ${ln}`;
      
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${idCounter}@gmail.com`;
      const mobile = `919${Math.floor(100000000 + Math.random() * 900000000)}`;
      
      const hh = String(Math.floor(Math.random() * 12) + 9).padStart(2, '0');
      const mm = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      const ss = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      const fullStr = `${ymd} ${hh}:${mm}:${ss}`;
      
      const callStatus = callStatuses[Math.floor(Math.random() * callStatuses.length)];
      const callInterest = interests[Math.floor(Math.random() * interests.length)];
      
      // Setup logical dependencies for converted leads
      const isPaid = Math.random() < 0.15;
      const finalStatus = isPaid ? 'Connected' : callStatus;
      const finalInterest = isPaid ? 'Converted' : callInterest;
      const finalPipeline = isPaid ? 'Paid' : pipelines[Math.floor(Math.random() * pipelines.length)];
      const finalRemarks = isPaid ? "Franchise fee paid, agreement signed." : remarks[Math.floor(Math.random() * remarks.length)];
      
      leads.push({
        id: `${sourceKey}_mock_${idCounter}`,
        source: sourceKey,
        name: name,
        email: email,
        mobile: mobile,
        rawMobile: mobile.replace('91', ''),
        dateStr: fullStr,
        ymd: ymd,
        city: cities[Math.floor(Math.random() * cities.length)],
        poc: pocs[Math.floor(Math.random() * pocs.length)],
        callStatus: finalStatus,
        callInterest: finalInterest,
        leadStatus: finalPipeline,
        remarks: finalRemarks,
        budget: budgets[Math.floor(Math.random() * budgets.length)],
        model: models[Math.floor(Math.random() * models.length)]
      });
      
      idCounter++;
    }
  });
  
  return leads;
}

// ============================================================================
// SYSTEM LISTENERS & DOM EVENT HANDLERS
// ============================================================================

function setupEventListeners() {
  // Sync button clicks
  document.getElementById('btn-refresh').addEventListener('click', fetchAndRenderAll);
  
  // Settings trigger modal
  document.getElementById('btn-settings').addEventListener('click', () => toggleSettingsModal(true));
  document.getElementById('btn-close-settings').addEventListener('click', () => toggleSettingsModal(false));
  document.getElementById('btn-close-settings-cancel').addEventListener('click', () => toggleSettingsModal(false));
  document.getElementById('btn-save-settings').addEventListener('click', handleSaveSettings);
  document.getElementById('btn-reset-defaults').addEventListener('click', resetConfigToDefaults);
  
  // Modal tab swapper
  document.querySelector('.modal-tabs').addEventListener('click', handleModalTabSwitch);
  
  // Custom column mapping source Selector Change
  document.getElementById('cfg-mapper-source-selector').addEventListener('change', (e) => {
    buildColumnMapperUI(e.target.value);
  });
  
  // Pause/Resume Refresh Countdown Timer
  document.getElementById('btn-pause-timer').addEventListener('click', togglePauseRefreshTimer);
  
  // Demo Mode Switch
  document.getElementById('toggle-demo').addEventListener('change', (e) => {
    state.demoMode = e.target.checked;
    saveConfig();
    fetchAndRenderAll();
  });
  
  // Dismiss Warn Banner
  document.getElementById('btn-dismiss-banner').addEventListener('click', () => {
    document.getElementById('diagnostic-banner').classList.add('hidden');
  });
  
  // Interactive Chart metric controls
  document.getElementById('chart-metric-selector').addEventListener('change', renderTrendChartPanel);
  document.getElementById('chart-source-selector').addEventListener('change', (e) => {
    renderTrendChartPanel();
    renderFunnelChart(e.target.value);
  });
  
  // Chart Line/Bar Type toggles
  document.getElementById('chart-type-bar').addEventListener('click', (e) => {
    document.getElementById('chart-type-line').classList.remove('active');
    document.getElementById('chart-type-bar').classList.add('active');
    renderTrendChartPanel();
  });
  document.getElementById('chart-type-line').addEventListener('click', (e) => {
    document.getElementById('chart-type-bar').classList.remove('active');
    document.getElementById('chart-type-line').classList.add('active');
    renderTrendChartPanel();
  });
  
  // Time period Matrix Cells Clicks filters Database Explorer
  document.getElementById('matrix-perf-table').addEventListener('click', handleMatrixCellClicks);
  
  // Explorer Filter controls
  document.getElementById('search-explorer').addEventListener('input', debounce((e) => {
    state.filters.search = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  }, 250));
  
  document.getElementById('filter-source').addEventListener('change', (e) => {
    state.filters.source = e.target.value;
    state.pagination.page = 1;
    
    // Toggle visibility of Franchise Model filter dropdown
    const modelWrapper = document.getElementById('filter-model-wrapper');
    if (modelWrapper) {
      if (e.target.value === 'franchise') {
        modelWrapper.style.display = 'flex';
      } else {
        modelWrapper.style.display = 'none';
        state.filters.model = 'all';
        const modelSelect = document.getElementById('filter-model');
        if (modelSelect) modelSelect.value = 'all';
      }
    }
    
    renderExplorerTable();
  });
  
  document.getElementById('filter-model').addEventListener('change', (e) => {
    state.filters.model = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  document.getElementById('filter-interest').addEventListener('change', (e) => {
    state.filters.interest = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  document.getElementById('filter-city').addEventListener('change', (e) => {
    state.filters.city = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  document.getElementById('filter-poc').addEventListener('change', (e) => {
    state.filters.poc = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  document.getElementById('filter-date-start').addEventListener('change', (e) => {
    state.filters.dateStart = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  document.getElementById('filter-date-end').addEventListener('change', (e) => {
    state.filters.dateEnd = e.target.value;
    state.pagination.page = 1;
    renderExplorerTable();
  });
  
  // Reset all filters button
  document.getElementById('btn-reset-filters').addEventListener('click', clearAllExplorerFilters);
  document.getElementById('btn-clear-filters-badge').addEventListener('click', clearAllExplorerFilters);
  
  // Table Sorting headers click
  document.querySelectorAll('#explorer-leads-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sort.field === field) {
        // Toggle direction
        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.field = field;
        state.sort.direction = 'desc'; // Default desc on new click
      }
      
      // Update sorted headers CSS arrows
      document.querySelectorAll('#explorer-leads-table th.sortable').forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (h.dataset.sort === field) {
          icon.classList.remove('hidden');
          icon.setAttribute('data-sort-dir', state.sort.direction);
          icon.style.transform = state.sort.direction === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
        } else {
          icon.classList.add('hidden');
        }
      });
      
      renderExplorerTable();
    });
  });
  
  // Export CSV Clicks
  document.getElementById('btn-export-csv').addEventListener('click', exportExplorerLeadsToCSV);
  
  // Pagination actions
  document.getElementById('btn-pag-prev').addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      renderExplorerTable();
    }
  });
  document.getElementById('btn-pag-next').addEventListener('click', () => {
    state.pagination.page++;
    renderExplorerTable();
  });
  document.getElementById('select-page-size').addEventListener('change', (e) => {
    state.pagination.size = parseInt(e.target.value);
    state.pagination.page = 1;
    renderExplorerTable();
  });
  
  // Slide Profile Drawer controls
  document.getElementById('btn-close-drawer').addEventListener('click', closeLeadProfileDrawer);
  document.getElementById('drawer-crm-notes').addEventListener('input', handleCrmNotesChange);
  
  // Modal backdrop click outsides closure trigger
  window.addEventListener('click', (e) => {
    const settingsModal = document.getElementById('settings-modal');
    if (e.target === settingsModal) toggleSettingsModal(false);
    
    const leadDrawer = document.getElementById('lead-drawer');
    if (e.target === leadDrawer) closeLeadProfileDrawer();
  });
  
  // Bind local CSV upload fallbacks change listeners
  document.querySelectorAll('.csv-file-input').forEach(input => {
    input.addEventListener('change', handleCSVUpload);
  });
  
  // Setup interactive KPI card and connection pill clicks
  setupInteractiveKPIsAndPills();
}

// Bind click handlers to Connection Hub pills and KPI overview cards
function setupInteractiveKPIsAndPills() {
  // Connection Hub Clickable Source Pills
  CONFIG.SOURCES.forEach(s => {
    const pill = document.getElementById(`pill-${s.key}`);
    if (pill) {
      pill.addEventListener('click', () => {
        state.filters.source = s.key;
        document.getElementById('filter-source').value = s.key;
        state.pagination.page = 1;
        renderExplorerTable();
        scrollToDatabaseExplorer();
      });
    }
  });

  // KPI Card - Total Leads
  const cardTotal = document.getElementById('kpi-total-leads');
  if (cardTotal) {
    cardTotal.addEventListener('click', () => {
      clearAllExplorerFilters();
      scrollToDatabaseExplorer();
    });
  }

  // KPI Card - Leads Today
  const cardToday = document.getElementById('kpi-today-leads');
  if (cardToday) {
    cardToday.addEventListener('click', () => {
      const dates = getStaticDateContext();
      clearAllExplorerFilters();
      state.filters.dateStart = dates.today;
      state.filters.dateEnd = dates.today;
      document.getElementById('filter-date-start').value = dates.today;
      document.getElementById('filter-date-end').value = dates.today;
      renderExplorerTable();
      scrollToDatabaseExplorer();
    });
  }

  // KPI Card - MTD Leads
  const cardMtd = document.getElementById('kpi-mtd-leads');
  if (cardMtd) {
    cardMtd.addEventListener('click', () => {
      const dates = getStaticDateContext();
      clearAllExplorerFilters();
      state.filters.dateStart = dates.mtdStart;
      state.filters.dateEnd = dates.mtdEnd;
      document.getElementById('filter-date-start').value = dates.mtdStart;
      document.getElementById('filter-date-end').value = dates.mtdEnd;
      renderExplorerTable();
      scrollToDatabaseExplorer();
    });
  }

  // KPI Card - Top Source
  const cardSource = document.getElementById('kpi-top-source');
  if (cardSource) {
    cardSource.addEventListener('click', () => {
      let topKey = 'all';
      let topCount = 0;
      CONFIG.SOURCES.forEach(s => {
        const count = state.allLeads[s.key].length;
        if (count > topCount) {
          topCount = count;
          topKey = s.key;
        }
      });
      clearAllExplorerFilters();
      if (topKey !== 'all') {
        state.filters.source = topKey;
        document.getElementById('filter-source').value = topKey;
      }
      renderExplorerTable();
      scrollToDatabaseExplorer();
    });
  }

  // KPI Card - Top City
  const cardCity = document.getElementById('kpi-top-city');
  if (cardCity) {
    cardCity.addEventListener('click', () => {
      const combined = getCombinedLeads();
      const cityCounts = {};
      combined.forEach(l => {
        if (l.city && l.city !== 'Unknown') {
          cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
        }
      });
      let topCity = 'all';
      let topCount = 0;
      Object.keys(cityCounts).forEach(c => {
        if (cityCounts[c] > topCount) {
          topCount = cityCounts[c];
          topCity = c;
        }
      });
      clearAllExplorerFilters();
      if (topCity !== 'all') {
        state.filters.city = topCity;
        document.getElementById('filter-city').value = topCity;
      }
      renderExplorerTable();
      scrollToDatabaseExplorer();
    });
  }
}

// Helper: Scroll directly down to Database grid with brief glow flash
function scrollToDatabaseExplorer() {
  const section = document.getElementById('section-database');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
    section.style.borderColor = 'var(--zypp-blue)';
    setTimeout(() => {
      section.style.borderColor = 'var(--border-color)';
    }, 1200);
  }
}

// Filter explorer leads database based on cell clicked in period performance matrix table
function handleMatrixCellClicks(e) {
  const cell = e.target.closest('.val-cell.clickable');
  if (!cell) return;
  
  const source = cell.dataset.source;
  const type = cell.dataset.type; // today, y1, y2, y3, y4, mtd, lastMonth, total
  
  // Apply Source filter
  state.filters.source = source;
  document.getElementById('filter-source').value = source;
  
  // Toggle visibility of Franchise Model filter dropdown
  const modelWrapper = document.getElementById('filter-model-wrapper');
  if (modelWrapper) {
    if (source === 'franchise') {
      modelWrapper.style.display = 'flex';
    } else {
      modelWrapper.style.display = 'none';
      state.filters.model = 'all';
      const modelSelect = document.getElementById('filter-model');
      if (modelSelect) modelSelect.value = 'all';
    }
  }
  
  // Apply Date context filters
  const dates = getStaticDateContext();
  let start = '';
  let end = '';
  
  switch(type) {
    case 'today':
      start = dates.today; end = dates.today;
      break;
    case 'y1':
      start = dates.y1; end = dates.y1;
      break;
    case 'y2':
      start = dates.y2; end = dates.y2;
      break;
    case 'y3':
      start = dates.y3; end = dates.y3;
      break;
    case 'y4':
      start = dates.y4; end = dates.y4;
      break;
    case 'mtd':
      start = dates.mtdStart; end = dates.mtdEnd;
      break;
    case 'lastMonth':
      start = dates.lastMonthStart; end = dates.lastMonthEnd;
      break;
    case 'total':
    default:
      start = ''; end = '';
      break;
  }
  
  state.filters.dateStart = start;
  state.filters.dateEnd = end;
  
  document.getElementById('filter-date-start').value = start;
  document.getElementById('filter-date-end').value = end;
  
  // Refresh table view
  state.pagination.page = 1;
  renderExplorerTable();
  
  // Smooth scroll user directly down to lead Database explorer database grid section
  const section = document.getElementById('section-database');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
    
    // Briefly flash database explorer header border to alert user
    section.style.borderColor = 'var(--zypp-blue)';
    setTimeout(() => {
      section.style.borderColor = 'var(--border-color)';
    }, 1200);
  }
}

function clearAllExplorerFilters() {
  state.filters = {
    search: '',
    source: 'all',
    model: 'all',
    status: 'all',
    interest: 'all',
    city: 'all',
    poc: 'all',
    dateStart: '',
    dateEnd: ''
  };
  
  // Reset form inputs values
  document.getElementById('search-explorer').value = '';
  document.getElementById('filter-source').value = 'all';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-interest').value = 'all';
  document.getElementById('filter-city').value = 'all';
  document.getElementById('filter-poc').value = 'all';
  document.getElementById('filter-date-start').value = '';
  document.getElementById('filter-date-end').value = '';
  
  // Reset model wrapper
  const modelSelect = document.getElementById('filter-model');
  if (modelSelect) modelSelect.value = 'all';
  const modelWrapper = document.getElementById('filter-model-wrapper');
  if (modelWrapper) modelWrapper.style.display = 'none';
  
  state.pagination.page = 1;
  renderExplorerTable();
}

// Helpers: Debouncer
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Client-side CSV Text parser (handles quotes and comma cells)
function parseCSVText(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

// Handle upload and parsing of CSV file fallback
function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const sourceKey = e.target.dataset.source;
  const statusEl = document.getElementById(`csv-status-${sourceKey}`);
  if (statusEl) statusEl.innerText = "Syncing...";
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const text = evt.target.result;
      const lines = parseCSVText(text);
      
      // Filter out any blank trailing lines
      const cleanLines = lines.filter(row => row.some(cell => cell.trim() !== ''));
      if (cleanLines.length < 2) {
        throw new Error('CSV file is empty or invalid.');
      }
      
      const headers = cleanLines[0];
      const cols = headers.map((h, idx) => ({ id: String.fromCharCode(65 + idx), label: h.trim() }));
      const rows = cleanLines.slice(1).map(row => {
        return { c: row.map(cell => ({ v: cell })) };
      });
      
      const data = { table: { cols, rows } };
      const parsedLeads = parseGvizTable(data, sourceKey);
      
      // Save parsed leads in application state
      state.allLeads[sourceKey] = parsedLeads;
      state.errors[sourceKey] = null;
      
      // Cache CSV leads in LocalStorage so it persists across refreshes
      localStorage.setItem(`zypp_csv_leads_${sourceKey}`, JSON.stringify(parsedLeads));
      
      // Update config indicators and refresh views
      saveConfig();
      renderAllMetrics();
      updateConnectionStatusPills();
      
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--zypp-green);">✓ Loaded (${parsedLeads.length} leads)</span>`;
      }
      
      // Trigger a visual confirmation alert
      alert(`Successfully synced ${parsedLeads.length} leads from CSV for ${sourceKey === 'fleetease' ? 'Fleetease.ai' : sourceKey}!`);
    } catch (err) {
      console.error('CSV upload parse error:', err);
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-danger">✗ Error: ${err.message}</span>`;
      }
    }
  };
  reader.readAsText(file);
}
