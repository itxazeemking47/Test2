
"use strict";

/* =========================================================
   NOVAFLOW — AUTOMATION COMMAND CENTER
   File: script.js

   Includes:
   - Animated particle network
   - Interactive holographic core
   - Responsive mobile navigation
   - n8n POST webhook integration
   - GET fallback for request failures
   - Loading states and notification toasts
   - Activity terminal and local session metrics
========================================================= */


/* =========================================================
   01. CONFIGURATION
========================================================= */

const NOVAFLOW_CONFIG = Object.freeze({
    webhookUrl:
        "https://test41.app.n8n.cloud/webhook/482c900a-65ae-403b-8be7-9fc249a671f7",

    action: "ebay_winning_product_hunting",

    requestTimeout: 15000,

    particleCount: 90,

    maxDevicePixelRatio: 2
});


/* =========================================================
   02. DOM HELPERS
========================================================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


const dom = {
    canvas: $("#particle-canvas"),
    hologram: $("#hologram-scene"),

    mobileMenuButton: $("#mobile-menu-button"),
    navigation: $(".main-navigation"),

    systemStatusTitle: $("#system-status-title"),
    webhookStatus: $("#webhook-status"),
    webhookUrlDisplay: $("#webhook-url-display"),

    startButton: $("#start-hunting-button"),
    ebayCardStatus: $("#ebay-card-status"),

    metricExecutions: $("#metric-executions"),
    metricConnection: $("#metric-connection"),

    terminalOutput: $("#terminal-output"),
    clearActivityButton: $("#clear-activity-button"),

    accessibilityAnnouncer: $("#accessibility-announcer")
};


const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
);

const supportsHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
);


/* =========================================================
   03. LOCAL SESSION STATE
========================================================= */

const state = {
    sessionTriggers: 0,
    isRequestRunning: false,
    lastRequestStatus: "READY",
    activeToastTimers: new Map(),
    particleAnimationFrame: null
};


/* =========================================================
   04. SAFE UI UTILITIES
========================================================= */

function announce(message) {
    if (!dom.accessibilityAnnouncer) return;

    dom.accessibilityAnnouncer.textContent = message;
}


function addActivity(message, level = "info") {
    if (!dom.terminalOutput) return;

    const line = document.createElement("div");
    line.className = "terminal-line";

    if (level === "success") {
        line.classList.add("terminal-line--system");
    }

    if (level === "error") {
        line.style.color = "#ff8297";
    }

    if (level === "warning") {
        line.style.color = "#ffd38b";
    }

    const prompt = document.createElement("span");
    prompt.className = "terminal-prompt";
    prompt.textContent = "›";

    const time = document.createElement("span");
    time.className = "terminal-time";

    time.textContent =
        "[" +
        new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }) +
        "]";

    const content = document.createElement("span");
    content.textContent = message;

    line.append(prompt, time, content);
    dom.terminalOutput.appendChild(line);

    // Keep the UI responsive during long sessions.
    while (dom.terminalOutput.children.length > 40) {
        dom.terminalOutput.firstElementChild.remove();
    }

    const terminal = $(".terminal-window");

    if (terminal) {
        terminal.scrollTop = terminal.scrollHeight;
    }
}


function setIndicatorColor(indicator, color) {
    if (!indicator) return;

    indicator.style.background = color;
    indicator.style.boxShadow = `0 0 12px ${color}`;
}


function setStatusLabel(element, label, color = null) {
    if (!element) return;

    const indicator = $(".status-indicator", element);

    // Preserve the status indicator element and replace only its text.
    const textNode = [...element.childNodes].find(
        node => node.nodeType === Node.TEXT_NODE
    );

    if (textNode) {
        textNode.textContent = " " + label;
    } else {
        element.appendChild(document.createTextNode(" " + label));
    }

    if (color) {
        setIndicatorColor(indicator, color);
    }
}


function updateSystemStatus(label, tone = "ready") {
    const tones = {
        ready: "#36edba",
        sending: "#66bdff",
        success: "#36edba",
        warning: "#ffc66e",
        error: "#ff6480"
    };

    const color = tones[tone] || tones.ready;

    if (dom.systemStatusTitle) {
        dom.systemStatusTitle.textContent = label;
    }

    const statusRoot = $("#system-status");

    if (statusRoot) {
        setIndicatorColor($(".status-indicator", statusRoot), color);
    }

    const webhookStatus = dom.webhookStatus;

    if (webhookStatus) {
        webhookStatus.replaceChildren();

        const indicator = document.createElement("span");
        indicator.className = "status-indicator";

        setIndicatorColor(indicator, color);

        webhookStatus.append(
            indicator,
            document.createTextNode(" " + label)
        );
    }

    const footerStatus = $(".webhook-pulse-label");

    if (footerStatus) {
        const indicator = $(".status-indicator", footerStatus);

        setIndicatorColor(indicator, color);

        const textNode = [...footerStatus.childNodes].find(
            node => node.nodeType === Node.TEXT_NODE
        );

        if (textNode) {
            textNode.textContent = " " + label.toUpperCase();
        } else {
            footerStatus.appendChild(
                document.createTextNode(" " + label.toUpperCase())
            );
        }
    }

    if (dom.metricConnection) {
        dom.metricConnection.textContent = label.toUpperCase();

        dom.metricConnection.style.color = color;
    }

    if (tone === "error" && dom.ebayCardStatus) {
        dom.ebayCardStatus.style.color = color;
    } else if (dom.ebayCardStatus && tone === "success") {
        dom.ebayCardStatus.style.color = color;
    }

    state.lastRequestStatus = label;
}


function setCardStatus(label, tone = "ready") {
    if (!dom.ebayCardStatus) return;

    const colors = {
        ready: "#36edba",
        sending: "#66bdff",
        success: "#36edba",
        warning: "#ffc66e",
        error: "#ff6480"
    };

    const color = colors[tone] || colors.ready;

    dom.ebayCardStatus.replaceChildren();

    const indicator = document.createElement("span");
    indicator.className = "status-indicator";

    setIndicatorColor(indicator, color);

    dom.ebayCardStatus.append(
        indicator,
        document.createTextNode(" " + label.toUpperCase())
    );

    dom.ebayCardStatus.style.color = color;
}


/* =========================================================
   05. TOAST NOTIFICATIONS
========================================================= */

function showToast(
    type,
    title,
    message,
    duration = 5200
) {
    const toast = document.getElementById(`toast-${type}`);

    if (!toast) {
        console.warn("Unknown toast type:", type);
        return;
    }

    // Hide old notifications and cancel their timers.
    $$(".toast-container .toast").forEach(item => {
        item.hidden = true;

        const existingTimer = state.activeToastTimers.get(item.id);

        if (existingTimer) {
            window.clearTimeout(existingTimer);
            state.activeToastTimers.delete(item.id);
        }
    });

    const titleElement = $(".toast-title", toast);
    const messageElement = $(".toast-message", toast);

    if (titleElement) {
        titleElement.textContent = title;
    }

    if (messageElement) {
        messageElement.textContent = message;
    }

    toast.hidden = false;

    // Restart the entrance animation.
    toast.style.animation = "none";
    void toast.offsetWidth;
    toast.style.animation = "";

    announce(`${title}. ${message}`);

    if (duration > 0) {
        const timer = window.setTimeout(() => {
            toast.hidden = true;
            state.activeToastTimers.delete(toast.id);
        }, duration);

        state.activeToastTimers.set(toast.id, timer);
    }
}


$$("[data-dismiss-toast]").forEach(button => {
    button.addEventListener("click", () => {
        const toast = button.closest(".toast");

        if (!toast) return;

        toast.hidden = true;

        const timer = state.activeToastTimers.get(toast.id);

        if (timer) {
            window.clearTimeout(timer);
            state.activeToastTimers.delete(toast.id);
        }
    });
});


/* =========================================================
   06. MOBILE NAVIGATION
========================================================= */

function closeMobileNavigation() {
    if (!dom.navigation || !dom.mobileMenuButton) return;

    dom.navigation.classList.remove("is-open");

    dom.mobileMenuButton.setAttribute("aria-expanded", "false");

    const icon = $("i", dom.mobileMenuButton);

    if (icon) {
        icon.className = "fa-solid fa-bars";
    }
}


if (dom.mobileMenuButton && dom.navigation) {
    dom.mobileMenuButton.addEventListener("click", () => {
        const isOpen = dom.navigation.classList.toggle("is-open");

        dom.mobileMenuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        const icon = $("i", dom.mobileMenuButton);

        if (icon) {
            icon.className = isOpen
                ? "fa-solid fa-xmark"
                : "fa-solid fa-bars";
        }
    });
}


$$(".main-navigation a").forEach(link => {
    link.addEventListener("click", () => {
        closeMobileNavigation();

        $$(".main-navigation .nav-link").forEach(navLink => {
            navLink.classList.remove("active");
        });

        link.classList.add("active");
    });
});


window.addEventListener("resize", () => {
    if (window.innerWidth > 960) {
        closeMobileNavigation();
    }
});


/* Highlight the navigation link for the current section. */

if ("IntersectionObserver" in window) {
    const sections = $$("#home, #features, #activity, #about");

    const sectionObserver = new IntersectionObserver(entries => {
        const visibleSections = entries
            .filter(entry => entry.isIntersecting)
            .sort(
                (a, b) =>
                    b.intersectionRatio - a.intersectionRatio
            );

        if (!visibleSections.length) return;

        const visibleId = visibleSections[0].target.id;

        $$(".main-navigation .nav-link").forEach(link => {
            const active = link.getAttribute("href") === `#${visibleId}`;

            link.classList.toggle("active", active);
        });
    }, {
        rootMargin: "-15% 0px -60% 0px",
        threshold: [0, 0.1, 0.35, 0.6]
    });

    sections.forEach(section => {
        sectionObserver.observe(section);
    });
}


/* =========================================================
   07. HOLOGRAPHIC CORE — POINTER PARALLAX
========================================================= */

if (
    dom.hologram &&
    supportsHover.matches &&
    !prefersReducedMotion.matches
) {
    dom.hologram.addEventListener("pointermove", event => {
        const rect = dom.hologram.getBoundingClientRect();

        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;

        const rotateY = (x - 0.5) * 9;
        const rotateX = (0.5 - y) * 7;

        dom.hologram.style.transform =
            `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    dom.hologram.addEventListener("pointerleave", () => {
        dom.hologram.style.transform =
            "perspective(1000px) rotateX(0deg) rotateY(0deg)";
    });
}


/* =========================================================
   08. LIVE PARTICLE NETWORK
========================================================= */

function initParticleSystem() {
    const canvas = dom.canvas;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        console.warn("Canvas 2D is unavailable.");
        return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;

    let particles = [];

    let mouse = {
        x: -1000,
        y: -1000,
        active: false
    };

    let animationFrame = null;

    const reducedMotion = prefersReducedMotion.matches;

    const colors = [
        [57, 231, 255],
        [79, 151, 255],
        [159, 104, 255],
        [222, 112, 255]
    ];


    function createParticle() {
        const color =
            colors[Math.floor(Math.random() * colors.length)];

        return {
            x: Math.random() * width,
            y: Math.random() * height,

            vx: (Math.random() - 0.5) * 0.32,
            vy: (Math.random() - 0.5) * 0.32,

            radius: Math.random() * 1.6 + 0.45,

            alpha: Math.random() * 0.55 + 0.2,

            color
        };
    }


    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;

        dpr = Math.min(
            window.devicePixelRatio || 1,
            NOVAFLOW_CONFIG.maxDevicePixelRatio
        );

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const areaCount = Math.floor(
            (width * height) / 15500
        );

        const count = Math.max(
            35,
            Math.min(
                NOVAFLOW_CONFIG.particleCount,
                areaCount
            )
        );

        particles = Array.from(
            { length: count },
            createParticle
        );

        drawFrame(false);
    }


    function drawFrame(updatePositions = true) {
        ctx.clearRect(0, 0, width, height);

        const maxDistance = width < 600 ? 105 : 145;
        const mouseRadius = 135;

        // Move and render the particles.
        for (const particle of particles) {
            if (updatePositions && !reducedMotion) {
                particle.x += particle.vx;
                particle.y += particle.vy;

                if (particle.x < -10) particle.x = width + 10;
                if (particle.x > width + 10) particle.x = -10;

                if (particle.y < -10) particle.y = height + 10;
                if (particle.y > height + 10) particle.y = -10;


                // Gentle mouse repulsion creates a responsive field.
                if (mouse.active) {
                    const dx = particle.x - mouse.x;
                    const dy = particle.y - mouse.y;
                    const distance = Math.hypot(dx, dy);

                    if (distance > 0 && distance < mouseRadius) {
                        const force =
                            (1 - distance / mouseRadius) * 0.45;

                        particle.x += (dx / distance) * force;
                        particle.y += (dy / distance) * force;
                    }
                }
            }

            const [r, g, b] = particle.color;

            ctx.beginPath();

            ctx.arc(
                particle.x,
                particle.y,
                particle.radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(${r}, ${g}, ${b}, ${particle.alpha})`;

            ctx.fill();
        }


        // Connect nearby particles with delicate luminous lines.
        for (let i = 0; i < particles.length; i++) {
            const a = particles[i];

            for (let j = i + 1; j < particles.length; j++) {
                const b = particles[j];

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distanceSquared = dx * dx + dy * dy;

                if (distanceSquared > maxDistance * maxDistance) {
                    continue;
                }

                const distance = Math.sqrt(distanceSquared);

                const opacity =
                    (1 - distance / maxDistance) * 0.15;

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);

                ctx.strokeStyle =
                    `rgba(81, 161, 255, ${opacity})`;

                ctx.lineWidth = 0.65;
                ctx.stroke();
            }
        }


        // Add a local halo near the pointer.
        if (mouse.active && !reducedMotion) {
            const glow = ctx.createRadialGradient(
                mouse.x,
                mouse.y,
                0,
                mouse.x,
                mouse.y,
                170
            );

            glow.addColorStop(
                0,
                "rgba(44, 145, 255, 0.075)"
            );

            glow.addColorStop(
                1,
                "rgba(44, 145, 255, 0)"
            );

            ctx.beginPath();

            ctx.fillStyle = glow;
            ctx.arc(mouse.x, mouse.y, 170, 0, Math.PI * 2);
            ctx.fill();
        }
    }


    function animate() {
        drawFrame(true);

        animationFrame = window.requestAnimationFrame(animate);

        state.particleAnimationFrame = animationFrame;
    }


    canvas.addEventListener("pointermove", event => {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
        mouse.active = true;
    }, { passive: true });


    window.addEventListener("pointerout", event => {
        if (!event.relatedTarget) {
            mouse.active = false;
        }
    }, { passive: true });


    window.addEventListener("blur", () => {
        mouse.active = false;
    });


    window.addEventListener("resize", resizeCanvas, {
        passive: true
    });


    resizeCanvas();

    if (!reducedMotion) {
        animate();
    }
}


/* =========================================================
   09. WEBHOOK REQUEST HELPERS
========================================================= */

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        window.clearTimeout(timeoutId);
    }
}


function createFallbackUrl(payload) {
    const url = new URL(NOVAFLOW_CONFIG.webhookUrl);

    // GET sends query parameters rather than a JSON body.
    // The n8n workflow must be configured to accept GET
    // and read these values from the query string.

    url.searchParams.set("action", payload.action);
    url.searchParams.set("timestamp", payload.timestamp);

    return url.toString();
}


/* =========================================================
   10. WORKFLOW BUTTON STATE
========================================================= */

function setButtonLoading(isLoading) {
    const button = dom.startButton;

    if (!button) return;

    const normalContent = $(".button-content", button);
    const loadingContent = $(".button-loading", button);

    button.disabled = isLoading;
    button.setAttribute("aria-busy", String(isLoading));

    if (normalContent) {
        normalContent.hidden = isLoading;
    }

    if (loadingContent) {
        loadingContent.hidden = !isLoading;
    }
}


/* =========================================================
   11. PRIMARY POST REQUEST
========================================================= */

async function sendPostRequest(payload) {
    return fetchWithTimeout(
        NOVAFLOW_CONFIG.webhookUrl,
        {
            method: "POST",

            mode: "cors",

            cache: "no-store",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*"
            },

            body: JSON.stringify(payload)
        },
        NOVAFLOW_CONFIG.requestTimeout
    );
}


/* =========================================================
   12. GET FALLBACK REQUEST
========================================================= */

async function sendGetFallback(payload) {
    const fallbackUrl = createFallbackUrl(payload);

    /*
      This is deliberately a no-cors GET request.

      The browser may send the GET request without allowing
      JavaScript to read its response. If the promise resolves,
      the response will normally be opaque.

      An opaque response DOES NOT confirm that n8n executed
      the workflow. Check n8n's Executions tab to verify.

      Warning: A POST may have triggered the workflow even if
      its response was hidden by CORS. Retrying with GET can
      therefore trigger a duplicate workflow execution.
    */

    return fetchWithTimeout(
        fallbackUrl,
        {
            method: "GET",
            mode: "no-cors",
            cache: "no-store",
            redirect: "follow"
        },
        NOVAFLOW_CONFIG.requestTimeout
    );
}


/* =========================================================
   13. MAIN WORKFLOW ACTION
========================================================= */

async function startWinningProductHunting() {
    if (state.isRequestRunning) return;

    if (!navigator.onLine) {
        showToast(
            "error",
            "No Internet Connection",
            "Internet connection check karo aur phir dobara try karo."
        );

        addActivity("Request blocked: browser is offline.", "error");

        return;
    }

    if (!dom.startButton) return;

    state.isRequestRunning = true;

    setButtonLoading(true);

    updateSystemStatus("SENDING", "sending");
    setCardStatus("SENDING", "sending");

    state.sessionTriggers += 1;

    if (dom.metricExecutions) {
        dom.metricExecutions.textContent =
            String(state.sessionTriggers).padStart(2, "0");
    }


    const payload = {
        action: NOVAFLOW_CONFIG.action,
        timestamp: new Date().toISOString()
    };


    addActivity(
        "Launching eBay Winning Product Hunting workflow...",
        "info"
    );

    addActivity(
        "Sending POST request to configured n8n endpoint.",
        "info"
    );


    try {
        const response = await sendPostRequest(payload);

        if (!response.ok) {
            throw new Error(
                `POST request returned HTTP ${response.status}.`
            );
        }


        // A readable, successful HTTP response was received.
        updateSystemStatus("TRIGGERED", "success");
        setCardStatus("TRIGGERED", "success");

        addActivity(
            `POST accepted with HTTP ${response.status}.`,
            "success"
        );

        addActivity(
            "Workflow trigger acknowledged by the endpoint.",
            "success"
        );

        showToast(
            "success",
            "Workflow Triggered",
            "n8n ne POST request accept kar li. Execution details n8n mein verify kar sakte ho."
        );


    } catch (postError) {
        const postMessage =
            postError && postError.name === "AbortError"
                ? "POST request timed out."
                : postError instanceof Error
                    ? postError.message
                    : "POST request failed or was blocked.";

        console.warn(
            "POST failed or its response could not be read:",
            postError
        );

        addActivity(
            `${postMessage} Attempting GET fallback.`,
            "warning"
        );

        updateSystemStatus("RETRYING", "warning");
        setCardStatus("RETRYING", "warning");


        try {
            const fallbackResponse =
                await sendGetFallback(payload);


            /*
              A no-cors response is generally opaque. Do not
              label it as a verified successful execution.
            */

            if (fallbackResponse.type === "opaque") {
                updateSystemStatus("UNVERIFIED", "warning");
                setCardStatus("GET SENT*", "warning");

                addActivity(
                    "GET fallback dispatched; browser cannot verify the response.",
                    "warning"
                );

                showToast(
                    "info",
                    "GET Fallback Sent",
                    "GET request dispatch ho gayi, lekin execution confirm nahi hai. n8n Executions check karo; duplicate run bhi mumkin hai."
                );

            } else if (fallbackResponse.ok) {
                updateSystemStatus("GET ACCEPTED", "success");
                setCardStatus("GET ACCEPTED", "success");

                addActivity(
                    `GET fallback returned HTTP ${fallbackResponse.status}.`,
                    "success"
                );

                showToast(
                    "success",
                    "Fallback Accepted",
                    "GET request ne successful HTTP response di. Workflow execution ko n8n mein verify karo."
                );

            } else {
                throw new Error(
                    `GET fallback returned HTTP ${fallbackResponse.status}.`
                );
            }


        } catch (getError) {
            const getMessage =
                getError && getError.name === "AbortError"
                    ? "GET fallback timed out."
                    : getError instanceof Error
                        ? getError.message
                        : "GET fallback could not be dispatched.";

            console.error("GET fallback failed:", getError);

            updateSystemStatus("FAILED", "error");
            setCardStatus("FAILED", "error");

            addActivity(getMessage, "error");

            showToast(
                "error",
                "Request Could Not Be Confirmed",
                "POST aur GET fallback dono confirm nahi ho sake. n8n workflow status, CORS aur network connection check karo."
            );
        }

    } finally {
        state.isRequestRunning = false;
        setButtonLoading(false);
    }
}


/* =========================================================
   14. FEATURE BUTTON EVENTS
========================================================= */

if (dom.startButton) {
    dom.startButton.addEventListener(
        "click",
        startWinningProductHunting
    );
}


$$('[data-action="coming-soon"]').forEach(button => {
    button.addEventListener("click", () => {
        const featureName =
            button.dataset.featureName || "This feature";

        addActivity(
            `${featureName} is not available yet.`,
            "warning"
        );

        showToast(
            "info",
            "Coming Soon",
            `${featureName} abhi development mein hai. Future update ke liye stay tuned.`,
            4500
        );
    });
});


/* =========================================================
   15. CLEAR ACTIVITY LOG
========================================================= */

if (dom.clearActivityButton) {
    dom.clearActivityButton.addEventListener("click", () => {
        if (dom.terminalOutput) {
            dom.terminalOutput.replaceChildren();
        }

        showToast(
            "info",
            "Activity Cleared",
            "Dynamic activity entries clear kar di gayi hain.",
            3000
        );
    });
}


/* =========================================================
   16. ONLINE / OFFLINE STATUS
========================================================= */

window.addEventListener("offline", () => {
    addActivity(
        "Browser reported that the internet connection is offline.",
        "error"
    );

    if (!state.isRequestRunning) {
        updateSystemStatus("OFFLINE", "error");
    }
});


window.addEventListener("online", () => {
    addActivity(
        "Browser reports that the internet connection is back.",
        "success"
    );

    if (!state.isRequestRunning) {
        updateSystemStatus("READY", "ready");
        setCardStatus("READY", "ready");
    }
});


/* =========================================================
   17. INITIALIZE NOVAFLOW
========================================================= */

function initializeNovaFlow() {
    // Ensure the webhook URL displayed in the UI matches config.
    if (dom.webhookUrlDisplay) {
        dom.webhookUrlDisplay.href =
            NOVAFLOW_CONFIG.webhookUrl;
    }


    updateSystemStatus("READY", "ready");
    setCardStatus("READY", "ready");

    if (dom.metricExecutions) {
        dom.metricExecutions.textContent = "00";
    }

    if (navigator.onLine === false) {
        updateSystemStatus("OFFLINE", "error");
    }

    initParticleSystem();

    addActivity(
        "NovaFlow interface initialized.",
        "success"
    );

    addActivity(
        "Particle engine initialized.",
        "success"
    );

    addActivity(
        "n8n webhook configuration loaded.",
        "info"
    );

    addActivity(
        "Awaiting user command...",
        "info"
    );

    console.info(
        "NovaFlow initialized. Workflow requests are user-triggered."
    );
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeNovaFlow,
        { once: true }
    );
} else {
    initializeNovaFlow();
}
