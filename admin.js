const ATTENDANCE_STORAGE_KEY = "propnex_attendance_records";

function loadAttendanceRecords() {
    try {
        const raw = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error(error);
        return {};
    }
}

function removeAttendanceRecord(guestName) {
    const records = loadAttendanceRecords();
    if (!records[guestName]) {
        return false;
    }

    delete records[guestName];
    window.localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
    return true;
}

function clearAllAttendanceRecords() {
    window.localStorage.removeItem(ATTENDANCE_STORAGE_KEY);
}

function initCandlelight() {
    const canvas = document.getElementById("candleCanvas");
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

document.addEventListener("DOMContentLoaded", () => {
    const adminGuestInput = document.getElementById("adminGuestInput");
    const adminResetGuestButton = document.getElementById("adminResetGuestButton");
    const adminResetAllButton = document.getElementById("adminResetAllButton");
    const adminStatusText = document.getElementById("adminStatusText");

    initCandlelight();

    adminResetGuestButton.addEventListener("click", () => {
        const guestName = adminGuestInput.value.trim();

        if (!guestName) {
            adminStatusText.textContent = "Enter a guest name to reset.";
            return;
        }

        const removed = removeAttendanceRecord(guestName);
        if (removed) {
            adminStatusText.textContent = `${guestName} has been reset for this browser.`;
            adminGuestInput.value = "";
        } else {
            adminStatusText.textContent = `No local attendance record found for ${guestName}.`;
        }
    });

    adminResetAllButton.addEventListener("click", () => {
        clearAllAttendanceRecords();
        adminStatusText.textContent = "All local attendance records have been cleared for this browser.";
        adminGuestInput.value = "";
    });
});
