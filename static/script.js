let isTyping = false;
let isAppStopped = false;
let isMediaStopped = false;
let longPressTimer = null;
let lastClickTime = 0;
let validUsers = [];

const ROBOT_ID_MULTI = "SR05_2502110006";
const ROBOT_ID_POWERFUL = "SR06_2509180019";
// const ROBOT_ID_MULTI = "SR05_2505070010";
// const ROBOT_ID_POWERFUL = "SR05_2505070010";
const ALL_ROBOT_IDS = [ROBOT_ID_MULTI, ROBOT_ID_POWERFUL];
const MULTI_BUTTON_LABELS = new Set(["1", "2", "7", "9", "11", "multi-5", "multi-6", "multi-7-8"]);
const POWERFUL_BUTTON_LABELS = new Set(["3", "4", "5", "6", "8", "powerful-5", "powerful-6", "powerful-7", "powerful-8"]);
const SEQUENCE_5_TO_8 = [
    { label: "powerful-5", mediaId: "a514c34c-056d-4f2c-b392-70093b4ae806" },
    { label: "multi-5", mediaId: "1c6cdb92-2817-403d-8a9c-176cd70f1890" },
    { label: "powerful-6", mediaId: "1139b2da-d639-4d2d-90a2-1ac205a393ef" },
    { label: "multi-6", mediaId: "65e19e0b-3717-4b37-99d8-24230c8e7546" },
    { label: "powerful-7", mediaId: "903110d5-cd82-4a57-befe-fb4db01c7701" },
    { label: "multi-7-8", mediaId: "d73f8c1e-c133-4ff0-9a39-de4c47c6bc82" },
    { label: "powerful-8", mediaId: "bc3dac76-60e3-4438-9479-0c11f6c6e344" },
];
const mediaListCache = new Map();
const BUTTON_PRESSED_MS = 3000;
const buttonPressTimers = new WeakMap();

function showButtonPressed(btn) {
    clearTimeout(buttonPressTimers.get(btn));
    btn.classList.add("is-pressed");
    buttonPressTimers.set(btn, setTimeout(() => {
        btn.classList.remove("is-pressed");
        buttonPressTimers.delete(btn);
    }, BUTTON_PRESSED_MS));
}

// ===== メディア設定（長押しで表示） =====
const header = document.getElementById("header");
const popup = document.getElementById("mediaConfigPopup");

const listEl = document.getElementById("mediaConfigList");
const btnSave = document.getElementById("mediaConfigSave");
const btnCancel = document.getElementById("mediaConfigCancel");

const MEDIA_MAP_STORAGE_KEY = "mediaIdMapByLabel";
const LONG_PRESS_MS = 700;

function getButtonRobotId(btn) {
    return getRobotIdForLabel(btn.dataset.label);
}

function getRobotIdForLabel(label) {
    if (MULTI_BUTTON_LABELS.has(label)) {
        return ROBOT_ID_MULTI;
    }
    if (POWERFUL_BUTTON_LABELS.has(label)) {
        return ROBOT_ID_POWERFUL;
    }
    return ROBOT_ID_MULTI;
}

function getMediaMapKey(robotId, label) {
    return `${robotId}::${label}`;
}

async function runForAllRobots(action) {
    await Promise.all(ALL_ROBOT_IDS.map((robotId) => action(robotId)));
}

document.addEventListener("DOMContentLoaded", async () => {
    setInterval(updateTime, 10000);
    updateTime();

    // ★ ポップアップを強制的に非表示
    const loginPopup = document.getElementById("loginPopup");
    const robotPopup = document.getElementById("robotPopup");
    if (loginPopup) loginPopup.style.display = "none";
    if (robotPopup) robotPopup.style.display = "none";

    document.querySelectorAll(".play-button").forEach((btn) => {
        btn.classList.toggle("multi-button", MULTI_BUTTON_LABELS.has(btn.dataset.label));
        btn.classList.toggle("powerful-button", POWERFUL_BUTTON_LABELS.has(btn.dataset.label));
        btn.addEventListener("click", async () => {
            showButtonPressed(btn);

            if (btn.classList.contains("sequence-button")) {
                try {
                    for (const item of SEQUENCE_5_TO_8) {
                        await play_media(getRobotIdForLabel(item.label), item.mediaId, false);
                    }
                } catch (err) {
                    console.error("連続再生中にエラー:", err);
                }
                return;
            }

            const label = btn.dataset.label;
            const mediaId = btn.dataset.mediaId;
            const robotId = getButtonRobotId(btn);

            console.log(`${label}のボタンが押されました: ${robotId}`);

            try {
                await play_media(robotId, mediaId, false);
            } catch (err) {
                console.error("play_media 実行中にエラー:", err);
            }
        });
    });

    const stopBtn = document.querySelector(".stop-button");
    if (stopBtn) {
        stopBtn.addEventListener("click", async () => {
            showButtonPressed(stopBtn);
            console.log("停止ボタンが押されました");
            try {
                await runForAllRobots((robotId) => stop_media(robotId));
            } catch (err) {
                console.error("stop_media 実行中にエラー:", err);
            }
        });
    }
    document.querySelectorAll(".mode-button").forEach((btn) => {
        btn.addEventListener("click", async () => {
            showButtonPressed(btn);
            const mode = btn.dataset.mode;

            try {
                if (mode === "heart_eye") {
                    console.log("目♥ が押されました");
                    await runForAllRobots((robotId) => gathering(robotId));
                // } else if (mode === "sad_image") {
                //     console.log("悲しい が押されました");
                //     const mediaId = btn.dataset.mediaId;
                //     await play_media(ROBOT_ID, mediaId, false);
                // } else if (mode === "heart_image") {
                //     console.log("画像♥ が押されました");
                //     const mediaId = btn.dataset.mediaId;
                //     await play_media(ROBOT_ID, mediaId, false);
                } else if (mode === "normal") {
                    console.log("通常 が押されました");
                    await runForAllRobots((robotId) => leading_navigate(robotId, 0, 0, 0));
                    await runForAllRobots((robotId) => stop_media(robotId));
                }
            } catch (err) {
                console.error("mode 処理中にエラー:", err);
            }
        });
    });

    // DOMContentLoaded の中に入れる
    const header = document.getElementById("header");
    if (!header) console.error("header not found");

    let pressTimer = null;

    header.addEventListener("contextmenu", (e) => e.preventDefault()); // 長押しメニュー抑止

    const startPress = (e) => {
        if (e.cancelable) e.preventDefault();
        pressTimer = setTimeout(() => {}, 700);
    };

    const endPress = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
    };

    header.addEventListener("mousedown", startPress);
    header.addEventListener("mouseup", endPress);
    header.addEventListener("mouseleave", endPress);

    header.addEventListener("touchstart", startPress, { passive: false });
    header.addEventListener("touchend", endPress);
    header.addEventListener("touchcancel", endPress);
});

// 時刻表示
function updateTime() {
    const el = document.getElementById("current-time");
    const now = new Date();
    const formatted = now.toLocaleDateString("ja-JP", { month: "long", day: "numeric" }) + " " + now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    el.textContent = formatted;
}

function setupLongPress(el, onLongPress) {
    let timer = null;

    const start = (e) => {
        // タッチ長押しでブラウザに奪われるのを防ぐ
        if (e && e.cancelable) e.preventDefault();
        timer = setTimeout(() => onLongPress(), LONG_PRESS_MS);
    };

    const cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    el.addEventListener("contextmenu", (e) => e.preventDefault());

    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);

    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchend", cancel);
    el.addEventListener("touchcancel", cancel);
    el.addEventListener("touchmove", cancel); // ← これ重要（微妙に動くと解除）
}

function getSavedMediaMap() {
    try {
        return JSON.parse(localStorage.getItem(MEDIA_MAP_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveMediaMap(map) {
    localStorage.setItem(MEDIA_MAP_STORAGE_KEY, JSON.stringify(map));
}

function applyMediaMapToButtons(map) {
    document.querySelectorAll(".play-button").forEach((btn) => {
        const label = btn.dataset.label;
        const robotId = getButtonRobotId(btn);
        const mapKey = getMediaMapKey(robotId, label);
        if (!label) return;
        if (map[mapKey]) {
            btn.dataset.mediaId = map[mapKey];
        }
    });
    document.querySelectorAll('.mode-button[data-mode="heart_image"], .mode-button[data-mode="sad_image"]').forEach((btn) => {
        const label = btn.dataset.label;
        const robotId = btn.dataset.robotId || ROBOT_ID_MULTI;
        const mapKey = getMediaMapKey(robotId, label);
        if (!label) return;
        if (map[mapKey]) btn.dataset.mediaId = map[mapKey];
    });
}

async function fetchMediaList(robotId) {
    if (mediaListCache.has(robotId)) {
        return mediaListCache.get(robotId);
    }

    let data = await GETmedia(url, robotId);

    const items = data.media || [];

    const mediaList = items.map((m) => ({
        id: m.media_id,
        name: m.filename,
        mime: m.mime_type,
    }));

    mediaListCache.set(robotId, mediaList);
    return mediaList;
}

function openPopup() {
    popup.style.display = "flex";
}
function closePopup() {
    popup.style.display = "none";
}

async function buildMediaConfigUI() {
    listEl.innerHTML = "";

    // ①現在のボタン（デフォルト or 保存値反映後）をベースにUI生成
    const saved = getSavedMediaMap();
    const targetButtons = [
        ...document.querySelectorAll(".play-button"),
        ...document.querySelectorAll('.mode-button[data-mode="heart_image"]'),
        ...document.querySelectorAll('.mode-button[data-mode="sad_image"]'),
    ].filter((b) => b.dataset.label && b.dataset.mediaId);

    const mediaLists = new Map(
        await Promise.all(
            ALL_ROBOT_IDS.map(async (robotId) => [robotId, await fetchMediaList(robotId)])
        )
    );

    targetButtons.forEach((btn) => {
        const label = btn.dataset.label;
        const robotId = btn.classList.contains("play-button") ? getButtonRobotId(btn) : btn.dataset.robotId || ROBOT_ID_MULTI;
        const mapKey = getMediaMapKey(robotId, label);
        const currentId = saved[mapKey] || btn.dataset.mediaId;
        const mediaList = mediaLists.get(robotId) || [];

        const row = document.createElement("div");
        row.className = "popup-row";

        const lab = document.createElement("label");
        lab.textContent = `${label} (${robotId})`;

        const sel = document.createElement("select");
        sel.dataset.label = label;
        sel.dataset.robotId = robotId;

        if (!mediaList.length) {
            const opt = document.createElement("option");
            opt.textContent = "メディア一覧を取得できませんでした";
            opt.disabled = true;
            opt.selected = true;
            sel.appendChild(opt);
        }

        mediaList.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.name;
            if (m.id === currentId) opt.selected = true;
            sel.appendChild(opt);
        });

        row.appendChild(lab);
        row.appendChild(sel);
        listEl.appendChild(row);
    });
}

setupLongPress(header, async () => {
    applyMediaMapToButtons(getSavedMediaMap());

    try {
        await buildMediaConfigUI();
    } catch (e) {
        console.error("buildMediaConfigUI failed:", e);
        listEl.innerHTML = `<p>メディア一覧の取得に失敗しました</p>`;
    } finally {
        openPopup(); // ← 何があっても開く
    }
});

btnCancel.addEventListener("click", () => closePopup());

// 保存：選択値を localStorage & ボタンに反映
btnSave.addEventListener("click", () => {
    const map = getSavedMediaMap();

    listEl.querySelectorAll("select").forEach((sel) => {
        const label = sel.dataset.label;
        const robotId = sel.dataset.robotId;
        const id = sel.value;
        if (label && id && robotId) map[getMediaMapKey(robotId, label)] = id;
    });

    saveMediaMap(map);
    applyMediaMapToButtons(map);
    closePopup();
});
