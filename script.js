// Sample seating list for the event hall.
// The app searches only by attendee name and maps each guest to a table.
const attendees = [
    { name: "Peter Ling", table: "1" },
    { name: "Lai Tze Khan", table: "2" },
    { name: "Danson Yong", table: "2" },
    { name: "Jackson Lim", table: "2" },
    { name: "Pamela Goh", table: "2" },
    { name: "Susan Wong", table: "2" },
    { name: "Ellie Tan", table: "2" },
    { name: "Timothy Voon", table: "2" },
    { name: "Jaycee Tang", table: "2" },
    { name: "Ru Ting", table: "2" },
    { name: "Dick Chiew", table: "2" },
    { name: "Cherry Lee", table: "3" },
    { name: "Jonathan Eng", table: "4" },
    { name: "Roy Hiu", table: "4" },
    { name: "Winston Gerard", table: "4" },
    { name: "Brenda Yeo", table: "4" },
    { name: "Teresa Chai", table: "4" },
    { name: "Tay Sian Boi", table: "4" },
    { name: "Eric Lau", table: "4" },
    { name: "Caroline Then", table: "4" },
    { name: "Connie Ho", table: "4" },
    { name: "Jacqueline Poh", table: "4" },
    { name: "Jimmyy Chin", table: "5" },
    { name: "Kayne Lau", table: "6" },
    { name: "Georgena Goh", table: "6" },
    { name: "Jimmy Tan Tuan Hock", table: "6" },
    { name: "Nelson Ryberg Lim Hock Wang", table: "6" },
    { name: "Bernie Eng Shu Jier", table: "6" },
    { name: "Charmaine Wong Xia Yi", table: "6" },
    { name: "Lawrence Lee", table: "7" },
    { name: "Lawrence's wife", table: "7" },
    { name: "Jensen Liew", table: "7" },
    { name: "Jordan Ajeng", table: "7" },
    { name: "Mr Tan Teck Meng", table: "8" },
    { name: "Andy Vong", table: "8" },
    { name: "Esther Lim", table: "8" },
    { name: "Colin Chai", table: "8" },
    { name: "Brodon Tan", table: "8" },
    { name: "Mdm Grace Kiu", table: "8" },
    { name: "Ms Tan Pei Yi", table: "8" },
    { name: "Ms Sandra Liew", table: "8" },
    { name: "Ms Mok Siao Dan", table: "8" },
    { name: "Mr Wong Chan Siew", table: "8" },
    { name: "Sia Alvin Wong & Partners", table: "9" },
    { name: "Shirley Yeo", table: "VIP" },
    { name: "Brandon Wong", table: "VIP" },
    { name: "Debbie Goh", table: "VIP" },
    { name: "Wong San San", table: "VIP" },
    { name: "Dylan Tan", table: "VIP" }
];

const elements = {};
let attendanceEndpoint = "";
const attendanceStatusCache = new Map();

const state = {
    activeGuest: null,
    activeTable: null,
    animationFrame: null,
    animationToken: 0,
    lastMatches: [],
    pendingAttendancePrompt: false,
    activeGuestAttendance: null,
    activeGuestAttendanceRequest: null
};

function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function cacheElements() {
    attendanceEndpoint = document.body.dataset.attendanceEndpoint || "";
    elements.searchForm = document.getElementById("searchForm");
    elements.searchInput = document.getElementById("searchInput");
    elements.suggestions = document.getElementById("suggestions");
    elements.guestPanel = document.getElementById("guestPanel");
    elements.guestPanelToggle = document.getElementById("guestPanelToggle");
    elements.guestPanelBody = document.getElementById("guestPanelBody");
    elements.backButton = document.getElementById("backButton");
    elements.mobileBackButton = document.getElementById("mobileBackButton");
    elements.statusText = document.getElementById("statusText");
    elements.mapStatusText = document.getElementById("mapStatusText");
    elements.selectedCard = document.getElementById("selectedCard");
    elements.selectedName = document.getElementById("selectedName");
    elements.selectedTable = document.getElementById("selectedTable");
    elements.errorText = document.getElementById("errorText");
    elements.programSection = document.getElementById("programSection");
    elements.attendanceModal = document.getElementById("attendanceModal");
    elements.attendanceMessage = document.getElementById("attendanceMessage");
    elements.confirmAttendanceButton = document.getElementById("confirmAttendanceButton");
    elements.dismissAttendanceButton = document.getElementById("dismissAttendanceButton");
    elements.programBackButton = document.getElementById("programBackButton");
    elements.searchView = document.getElementById("searchView");
    elements.mapView = document.getElementById("mapView");
    elements.programView = document.getElementById("programView");
    elements.candleCanvas = document.getElementById("candleCanvas");
    elements.hallMap = document.getElementById("hallMap");
    elements.aisle = document.querySelector(".aisle");
    elements.entranceMarker = document.getElementById("entranceMarker");
    elements.mapNextButton = document.getElementById("mapNextButton");
    elements.walker = document.getElementById("walker");
    elements.tableToast = document.getElementById("tableToast");
    elements.tables = Array.from(document.querySelectorAll(".table"));
}

function isCompactMapLayout() {
    return window.innerWidth <= 820;
}

function setGuestPanelCollapsed(collapsed) {
    elements.guestPanel.classList.toggle("collapsed", collapsed);
    elements.guestPanelToggle.setAttribute("aria-expanded", String(!collapsed));
}

function syncGuestPanelLayout() {
    if (!isCompactMapLayout()) {
        setGuestPanelCollapsed(false);
    }
}

function getTableElement(tableName) {
    return elements.tables.find((table) => table.dataset.table === tableName);
}

function getAttendanceCacheKey(guestName) {
    return normalizeText(guestName);
}

function setAttendanceCacheEntry(guestName, entry) {
    attendanceStatusCache.set(getAttendanceCacheKey(guestName), entry);
}

function getAttendanceCacheEntry(guestName) {
    return attendanceStatusCache.get(getAttendanceCacheKey(guestName)) || null;
}

function buildAttendancePayload(attendee) {
    return {
        action: "checkin",
        name: attendee.name,
        table: attendee.table,
        attended: true,
        verifiedAt: new Date().toISOString(),
        source: "seat-finder-web"
    };
}

function buildAttendanceLookupUrl(guestName, callbackName) {
    const url = new URL(attendanceEndpoint);
    url.searchParams.set("action", "status");
    url.searchParams.set("name", guestName);
    url.searchParams.set("callback", callbackName);
    return url.toString();
}

function fetchAttendanceStatusFromEndpoint(guestName) {
    if (!attendanceEndpoint) {
        return Promise.resolve({
            ok: false,
            configured: false,
            attended: false
        });
    }

    return new Promise((resolve, reject) => {
        const callbackName = `attendanceStatusCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const script = document.createElement("script");
        let settled = false;

        function cleanup() {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            delete window[callbackName];
        }

        window[callbackName] = (payload) => {
            settled = true;
            cleanup();
            resolve(payload || { ok: false, attended: false });
        };

        script.onerror = () => {
            cleanup();
            reject(new Error("Unable to reach attendance service."));
        };

        script.src = buildAttendanceLookupUrl(guestName, callbackName);
        document.body.appendChild(script);

        window.setTimeout(() => {
            if (settled) {
                return;
            }

            cleanup();
            reject(new Error("Attendance status request timed out."));
        }, 8000);
    });
}

async function postAttendanceToEndpoint(payload) {
    if (!attendanceEndpoint) {
        return { ok: false, reason: "not_configured" };
    }

    const body = JSON.stringify(payload);

    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
            const queued = navigator.sendBeacon(attendanceEndpoint, blob);
            if (queued) {
                return { ok: true, mode: "remote" };
            }
        }

        await fetch(attendanceEndpoint, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=UTF-8"
            },
            body,
            keepalive: true
        });

        return { ok: true, mode: "remote" };
    } catch (error) {
        console.error(error);
        return { ok: false, reason: "network_error", error };
    }
}

async function getAttendanceStatus(attendee, options = {}) {
    const { forceRefresh = false } = options;
    const cached = getAttendanceCacheEntry(attendee.name);

    if (!forceRefresh && cached) {
        return cached;
    }

    try {
        const payload = await fetchAttendanceStatusFromEndpoint(attendee.name);
        const entry = {
            ok: Boolean(payload?.ok),
            configured: payload?.configured !== false,
            attended: Boolean(payload?.attended),
            verifiedAt: payload?.verifiedAt || "",
            table: payload?.table || attendee.table
        };
        setAttendanceCacheEntry(attendee.name, entry);
        return entry;
    } catch (error) {
        console.error(error);
        const fallbackEntry = {
            ok: false,
            configured: Boolean(attendanceEndpoint),
            attended: false,
            error
        };
        setAttendanceCacheEntry(attendee.name, fallbackEntry);
        return fallbackEntry;
    }
}

async function syncActiveGuestAttendance(attendee) {
    const request = getAttendanceStatus(attendee);
    state.activeGuestAttendanceRequest = request;

    const status = await request;
    if (state.activeGuest !== attendee) {
        return status;
    }

    state.activeGuestAttendance = status;

    if (state.activeTable) {
        if (status.attended) {
            elements.mapStatusText.textContent = `${attendee.name} is already marked present at Table ${attendee.table}`;
        } else if (status.configured === false) {
            elements.mapStatusText.textContent = `${attendee.name} is seated at Table ${attendee.table}. Attendance service is not configured yet.`;
        }
    }

    return status;
}

// Suggestions update live as the user types, matching partial names only.
function getMatches(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return [];
    }

    return attendees.filter((attendee) => normalizeText(attendee.name).includes(normalizedQuery));
}

function renderSuggestions(matches) {
    state.lastMatches = matches;

    if (matches.length === 0) {
        elements.suggestions.classList.remove("visible");
        elements.suggestions.innerHTML = "";
        return;
    }

    elements.suggestions.innerHTML = matches
        .slice(0, 8)
        .map((match) => `
            <button class="suggestion-btn" type="button" data-name="${escapeHtml(match.name)}">
                <span class="suggestion-name">${escapeHtml(match.name)}</span>
                <span class="suggestion-table">Table ${escapeHtml(match.table)}</span>
            </button>
        `)
        .join("");

    elements.suggestions.classList.add("visible");
}

function updateSearchState() {
    const query = elements.searchInput.value.trim();
    const matches = getMatches(query);

    renderSuggestions(matches);
    elements.errorText.textContent = "";

    if (!query) {
        elements.statusText.textContent = "";
        return;
    }

    if (matches.length === 0) {
        elements.statusText.textContent = "Name not found";
        return;
    }

    elements.statusText.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"} found`;
}

function setSelectedGuest(attendee) {
    state.activeGuest = attendee;
    state.activeGuestAttendance = null;
    elements.selectedCard.hidden = false;
    elements.selectedName.textContent = attendee.name;
    elements.selectedTable.textContent = `Assigned to Table ${attendee.table}`;
    elements.mapNextButton.hidden = true;
    elements.searchView.hidden = true;
    elements.searchView.classList.remove("active");
    elements.mapView.hidden = false;
    elements.mapView.classList.add("active");
    elements.mapStatusText.textContent = `${attendee.name} is on the way to Table ${attendee.table}`;
    setGuestPanelCollapsed(isCompactMapLayout());
    syncActiveGuestAttendance(attendee);
}

function clearActiveTable() {
    if (state.activeTable) {
        state.activeTable.classList.remove("active");
        state.activeTable = null;
    }
}

function showToast(tableName, targetPoint) {
    elements.tableToast.textContent = `You are seated here, Table ${tableName}`;
    elements.tableToast.hidden = false;

    const hallRect = elements.hallMap.getBoundingClientRect();
    const toastRect = elements.tableToast.getBoundingClientRect();
    const sidePadding = 12;
    const halfWidth = toastRect.width / 2;
    const minCenter = sidePadding + halfWidth;
    const maxCenter = hallRect.width - sidePadding - halfWidth;
    const clampedCenter = Math.min(Math.max(targetPoint.x, minCenter), maxCenter);
    const shiftX = clampedCenter - targetPoint.x;
    const shouldPlaceBelow = targetPoint.y < toastRect.height + 78;

    elements.hallMap.style.setProperty("--toast-x", `${targetPoint.x}px`);
    elements.hallMap.style.setProperty(
        "--toast-y",
        shouldPlaceBelow ? `${targetPoint.y + 18}px` : `${targetPoint.y - 18}px`
    );
    elements.hallMap.style.setProperty("--toast-shift-x", `${shiftX}px`);
    elements.tableToast.dataset.placement = shouldPlaceBelow ? "below" : "above";
}

function hideToast() {
    elements.tableToast.hidden = true;
    elements.tableToast.textContent = "";
    elements.hallMap.style.setProperty("--toast-shift-x", "0px");
    delete elements.tableToast.dataset.placement;
}

function hideAttendanceModal() {
    elements.attendanceModal.hidden = true;
    state.pendingAttendancePrompt = false;
}

function showAttendanceModal() {
    if (!state.activeGuest) {
        return;
    }

    elements.attendanceMessage.textContent = `Please confirm once you are seated at Table ${state.activeGuest.table}.`;
    elements.attendanceModal.hidden = false;
    state.pendingAttendancePrompt = true;
}

function revealProgramFlow() {
    elements.mapView.hidden = true;
    elements.mapView.classList.remove("active");
    elements.programView.hidden = false;
    elements.programView.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function restoreActiveTableState() {
    if (!state.activeGuest) {
        return;
    }

    const tableElement = getTableElement(state.activeGuest.table);
    if (!tableElement) {
        return;
    }

    clearActiveTable();
    state.activeTable = tableElement;
    tableElement.classList.add("active");

    const point = getTargetPoint(tableElement);
    positionWalker(point);
    showToast(state.activeGuest.table, point);
}

function returnToMapView() {
    if (!state.activeGuest) {
        resetView();
        return;
    }

    elements.programView.hidden = true;
    elements.programView.classList.remove("active");
    elements.mapView.hidden = false;
    elements.mapView.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            restoreActiveTableState();
        });
    });
}

function getHallPoint(element) {
    const hallRect = elements.hallMap.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    return {
        x: elementRect.left - hallRect.left + elementRect.width / 2,
        y: elementRect.top - hallRect.top + elementRect.height / 2
    };
}

// Target positions are calculated from the real DOM layout so the animation
// still lines up when the hall rearranges responsively on smaller screens.
function getEntrancePoint() {
    const point = getHallPoint(elements.entranceMarker);
    return {
        x: point.x,
        y: point.y - 12
    };
}

// Table targets are calculated from the rendered layout rather than hardcoded
// coordinates so the marker still lands correctly after responsive changes.
function getTargetPoint(tableElement) {
    const point = getHallPoint(tableElement);
    return {
        x: point.x,
        y: point.y
    };
}

function positionWalker(point) {
    elements.walker.style.left = `${point.x}px`;
    elements.walker.style.top = `${point.y}px`;
    elements.walker.style.bottom = "auto";
    elements.walker.style.transform = "translate(-50%, -50%)";
}

function cancelAnimation() {
    state.animationToken += 1;
    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = null;
    }
}

function resetWalkerPosition() {
    positionWalker(getEntrancePoint());
}

function resetView() {
    cancelAnimation();
    clearActiveTable();
    hideToast();
    hideAttendanceModal();
    elements.errorText.textContent = "";
    elements.selectedCard.hidden = true;
    state.activeGuest = null;
    state.activeGuestAttendance = null;
    state.activeGuestAttendanceRequest = null;
    resetWalkerPosition();
    elements.mapNextButton.hidden = true;
    elements.mapView.hidden = true;
    elements.mapView.classList.remove("active");
    elements.programView.hidden = true;
    elements.programView.classList.remove("active");
    elements.searchView.hidden = false;
    elements.searchView.classList.add("active");
    elements.mapStatusText.textContent = "";
    setGuestPanelCollapsed(false);
}

function initCandlelight() {
    const canvas = elements.candleCanvas;
    const context = canvas.getContext("2d");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    const candleCount = 14;
    const emberCount = 22;

    function createCandle() {
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            baseRadius: Math.random() * 180 + 80,
            radius: 0,
            baseAlpha: Math.random() * 0.12 + 0.04,
            alpha: 0,
            flickerSpeed: Math.random() * 0.6 + 0.3,
            flickerAmplitude: Math.random() * 0.3 + 0.05,
            phase: Math.random() * Math.PI * 2,
            driftX: (Math.random() - 0.5) * 0.3,
            driftY: (Math.random() - 0.5) * 0.3,
            hue: Math.random() * 20 + 22
        };
    }

    function createEmber() {
        return {
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + Math.random() * 100,
            size: Math.random() * 2.5 + 0.5,
            speed: Math.random() * 0.6 + 0.2,
            drift: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.7 + 0.2,
            fade: Math.random() * 0.003 + 0.001
        };
    }

    const candles = Array.from({ length: candleCount }, createCandle);
    const embers = Array.from({ length: emberCount }, createEmber);
    let time = 0;

    function draw() {
        time += 0.016;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgba(6, 4, 1, 0.92)";
        context.fillRect(0, 0, canvas.width, canvas.height);

        candles.forEach((candle) => {
            const flicker =
                Math.sin(time * candle.flickerSpeed + candle.phase) +
                0.4 * Math.sin(time * candle.flickerSpeed * 2.3 + candle.phase) +
                0.2 * Math.sin(time * candle.flickerSpeed * 5.1 + candle.phase);

            candle.radius = candle.baseRadius * (1 + flicker * candle.flickerAmplitude);
            candle.alpha = candle.baseAlpha * (1 + flicker * 0.4);
            candle.x += candle.driftX * Math.sin(time * 0.1 + candle.phase);
            candle.y += candle.driftY * Math.cos(time * 0.13 + candle.phase);

            if (candle.x < -candle.baseRadius) candle.x = canvas.width + candle.baseRadius;
            if (candle.x > canvas.width + candle.baseRadius) candle.x = -candle.baseRadius;
            if (candle.y < -candle.baseRadius) candle.y = canvas.height + candle.baseRadius;
            if (candle.y > canvas.height + candle.baseRadius) candle.y = -candle.baseRadius;

            const gradient = context.createRadialGradient(candle.x, candle.y, 0, candle.x, candle.y, candle.radius);
            gradient.addColorStop(0, `hsla(${candle.hue}, 90%, 70%, ${candle.alpha * 1.8})`);
            gradient.addColorStop(0.3, `hsla(${candle.hue - 5}, 80%, 50%, ${candle.alpha})`);
            gradient.addColorStop(0.7, `hsla(${candle.hue - 10}, 70%, 30%, ${candle.alpha * 0.4})`);
            gradient.addColorStop(1, `hsla(${candle.hue}, 60%, 10%, 0)`);

            context.globalCompositeOperation = "lighter";
            context.beginPath();
            context.arc(candle.x, candle.y, candle.radius, 0, Math.PI * 2);
            context.fillStyle = gradient;
            context.fill();
        });

        embers.forEach((ember) => {
            ember.y -= ember.speed;
            ember.x += ember.drift * Math.sin(time + ember.y * 0.01);
            ember.alpha -= ember.fade;

            if (ember.alpha <= 0 || ember.y < -10) {
                ember.x = Math.random() * canvas.width;
                ember.y = canvas.height + 10;
                ember.alpha = Math.random() * 0.7 + 0.2;
                ember.speed = Math.random() * 0.6 + 0.2;
                ember.drift = (Math.random() - 0.5) * 0.4;
                ember.size = Math.random() * 2.5 + 0.5;
            }

            const emberGlow = context.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, ember.size * 3);
            emberGlow.addColorStop(0, `rgba(255, 220, 100, ${ember.alpha})`);
            emberGlow.addColorStop(0.5, `rgba(255, 160, 40, ${ember.alpha * 0.5})`);
            emberGlow.addColorStop(1, "rgba(200, 80, 10, 0)");

            context.beginPath();
            context.arc(ember.x, ember.y, ember.size * 3, 0, Math.PI * 2);
            context.fillStyle = emberGlow;
            context.fill();
        });

        context.globalCompositeOperation = "source-over";
        window.requestAnimationFrame(draw);
    }

    draw();
}

function easeInOutCubic(progress) {
    return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function interpolate(start, end, progress) {
    return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress
    };
}

// Movement follows a deliberate route:
// 1. start at the entrance
// 2. travel upward along the central aisle
// 3. turn left or right toward the destination table
function animateWalkerToTable(tableElement, tableName) {
    cancelAnimation();
    hideToast();
    clearActiveTable();

    const token = state.animationToken;
    const start = getEntrancePoint();
    const target = getTargetPoint(tableElement);
    const aisleCenterPoint = getHallPoint(elements.aisle);
    const aislePoint = {
        x: aisleCenterPoint.x,
        y: target.y
    };

    positionWalker(start);

    const firstDuration = 950;
    const secondDuration = 850;
    const totalDuration = firstDuration + secondDuration;
    const toastLeadMs = 180;
    let toastShown = false;
    const startTime = performance.now();

    function frame(now) {
        if (token !== state.animationToken) {
            return;
        }

        const elapsed = now - startTime;
        let point;

        if (elapsed <= firstDuration) {
            const progress = easeInOutCubic(Math.min(elapsed / firstDuration, 1));
            point = interpolate(start, aislePoint, progress);
        } else {
            const progress = easeInOutCubic(Math.min((elapsed - firstDuration) / secondDuration, 1));
            point = interpolate(aislePoint, target, progress);
        }

        positionWalker(point);

        if (!toastShown && elapsed >= totalDuration - toastLeadMs) {
            showToast(tableName, target);
            toastShown = true;
        }

        if (elapsed < totalDuration) {
            state.animationFrame = requestAnimationFrame(frame);
            return;
        }

        state.animationFrame = null;
        state.activeTable = tableElement;
        tableElement.classList.add("active");
        if (!toastShown) {
            showToast(tableName, target);
            toastShown = true;
        }
        elements.mapStatusText.textContent = `${state.activeGuest.name} is seated at Table ${tableName}`;
        elements.mapNextButton.hidden = false;

        if (state.activeGuestAttendance?.attended) {
            elements.mapStatusText.textContent = `${state.activeGuest.name} is already marked present at Table ${tableName}`;
        }
    }

    state.animationFrame = requestAnimationFrame(frame);
}

function startSelection(attendee) {
    const tableElement = getTableElement(attendee.table);
    if (!tableElement) {
        elements.errorText.textContent = "Assigned table could not be found in the hall layout.";
        return;
    }

    elements.searchInput.value = attendee.name;
    elements.suggestions.classList.remove("visible");
    elements.suggestions.innerHTML = "";
    elements.errorText.textContent = "";
    hideAttendanceModal();

    setSelectedGuest(attendee);
    animateWalkerToTable(tableElement, attendee.table);
}

function handleSearchSubmit(event) {
    event.preventDefault();

    const query = elements.searchInput.value.trim();
    const exactMatch = attendees.find((attendee) => normalizeText(attendee.name) === normalizeText(query));

    if (exactMatch) {
        startSelection(exactMatch);
        return;
    }

    const matches = getMatches(query);
    renderSuggestions(matches);

    if (matches.length === 0) {
        elements.errorText.textContent = "Name not found";
        elements.statusText.textContent = "Name not found";
        return;
    }

    if (matches.length === 1) {
        startSelection(matches[0]);
        return;
    }

    elements.errorText.textContent = "Please choose a name from the suggestions.";
}

function bindEvents() {
    elements.searchInput.addEventListener("input", updateSearchState);

    elements.searchInput.addEventListener("focus", updateSearchState);

    elements.searchForm.addEventListener("submit", handleSearchSubmit);

    elements.suggestions.addEventListener("click", (event) => {
        const button = event.target.closest(".suggestion-btn");
        if (!button) {
            return;
        }

        const attendee = attendees.find((item) => item.name === button.dataset.name);
        if (attendee) {
            startSelection(attendee);
        }
    });

    const handleBackToSearch = () => {
        elements.searchInput.value = "";
        elements.suggestions.classList.remove("visible");
        elements.suggestions.innerHTML = "";
        elements.statusText.textContent = "";
        resetView();
    };

    elements.backButton.addEventListener("click", handleBackToSearch);
    elements.mobileBackButton.addEventListener("click", handleBackToSearch);

    elements.guestPanelToggle.addEventListener("click", () => {
        if (!isCompactMapLayout()) {
            return;
        }

        const isCollapsed = elements.guestPanel.classList.contains("collapsed");
        setGuestPanelCollapsed(!isCollapsed);
    });

    elements.programBackButton.addEventListener("click", () => {
        returnToMapView();
    });

    elements.mapNextButton.addEventListener("click", () => {
        if (!state.activeGuest) {
            return;
        }

        (async () => {
            const status =
                state.activeGuestAttendance ||
                (state.activeGuestAttendanceRequest
                    ? await state.activeGuestAttendanceRequest
                    : await getAttendanceStatus(state.activeGuest));

            state.activeGuestAttendance = status;

            if (status.attended) {
                revealProgramFlow();
                return;
            }

            if (status.configured === false) {
                elements.mapStatusText.textContent = "Attendance service is not configured yet.";
                return;
            }

            if (status.error) {
                elements.mapStatusText.textContent = "Unable to check attendance right now. Please try again.";
                return;
            }

            showAttendanceModal();
        })();
    });

    elements.confirmAttendanceButton.addEventListener("click", () => {
        if (!state.activeGuest) {
            return;
        }

        const attendee = state.activeGuest;
        const originalButtonText = elements.confirmAttendanceButton.textContent;
        elements.confirmAttendanceButton.disabled = true;
        elements.confirmAttendanceButton.textContent = "Saving...";

        (async () => {
            const payload = buildAttendancePayload(attendee);
            const result = await postAttendanceToEndpoint(payload);
            elements.confirmAttendanceButton.disabled = false;
            elements.confirmAttendanceButton.textContent = originalButtonText;

            if (!result.ok) {
                elements.mapStatusText.textContent = "Unable to verify attendance right now. Please try again.";
                return;
            }

            setAttendanceCacheEntry(attendee.name, {
                ok: true,
                configured: true,
                attended: true,
                verifiedAt: payload.verifiedAt,
                table: attendee.table
            });
            state.activeGuestAttendance = getAttendanceCacheEntry(attendee.name);
            hideAttendanceModal();
            elements.mapStatusText.textContent = `${attendee.name} has been checked in at Table ${attendee.table}`;
            revealProgramFlow();
        })();
    });

    elements.dismissAttendanceButton.addEventListener("click", () => {
        hideAttendanceModal();
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".search-stack")) {
            elements.suggestions.classList.remove("visible");
        }
    });

    window.addEventListener("resize", () => {
        syncGuestPanelLayout();

        if (elements.hallMap.hidden) {
            return;
        }

        cancelAnimation();
        hideToast();
        resetWalkerPosition();

        restoreActiveTableState();
    });
}

function init() {
    cacheElements();
    bindEvents();
    initCandlelight();
    resetWalkerPosition();
    elements.searchView.hidden = false;
    elements.searchView.classList.add("active");
    elements.mapView.hidden = true;
    elements.mapView.classList.remove("active");
    elements.programView.hidden = true;
    elements.programView.classList.remove("active");
    elements.attendanceModal.hidden = true;
    elements.mapStatusText.textContent = "";
    elements.statusText.textContent = "";
    syncGuestPanelLayout();
}

document.addEventListener("DOMContentLoaded", init);
