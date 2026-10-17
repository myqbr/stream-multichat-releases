Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region src/shared/automation/plain-text.ts
var LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/gi;
var REPEATED = /([^\d\s])\1{3,}/gu;
/**
* A text cleaned for reading: links become "link", a character repeated
* over and over is kept three times ("kkkkkkkk" → "kkk"), whitespace
* collapses to single spaces, and it is cut to `maxChars` — at a word
* boundary when one is close.
*/
var plainText = (text, { maxChars, ellipsis }) => {
	const clean = text.replace(LINK, "link").replace(REPEATED, "$1$1$1").replace(/\s+/g, " ").trim();
	const chars = Array.from(clean);
	if (chars.length <= maxChars) return clean;
	const room = ellipsis ? maxChars - 1 : maxChars;
	let cut = chars.slice(0, room).join("");
	const space = cut.lastIndexOf(" ");
	if (space > 0 && cut.length - space <= 20) cut = cut.slice(0, space);
	return `${cut.trimEnd()}${ellipsis ? "…" : ""}`;
};
//#endregion
//#region extensions/aviso-de-live/src/index.ts
/** The sentence when the form's one is empty, and the form's default (a test keeps the two equal). */
var DEFAULT_MESSAGE = "{canal} ficou ao vivo";
var ENGLISH_MESSAGE = "{channel} went live";
var flag = (value, fallback) => typeof value === "boolean" ? value : fallback;
var amount = (value, fallback, min, max) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
var percent = (value, fallback) => Math.round(amount(value, fallback, 0, 100));
var list = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
/** A channel as the owner may have typed it: no spaces, no `@` or `#`, lower case. Blank lines are dropped. */
var channelName = (entry) => entry.trim().replace(/^[@#]+/, "").toLowerCase();
/** The form's values as typed settings, with the manifest's defaults where a value is missing. */
var readSettings = (values) => ({
	twitch: flag(values.twitchEnabled, true),
	kick: flag(values.kickEnabled, true),
	channels: list(values.channels).map(channelName).filter((name) => name !== ""),
	cooldownMinutes: amount(values.cooldownMinutes, 10, 0, 1440),
	message: typeof values.message === "string" ? values.message : DEFAULT_MESSAGE,
	showNotice: flag(values.showNotice, true),
	playSound: flag(values.playSound, true),
	sound: typeof values.sound === "string" ? values.sound : "campainha",
	volume: percent(values.volume, 80),
	speak: flag(values.speak, false),
	speakRate: amount(values.speakRate, 1, .5, 2),
	speakVolume: percent(values.speakVolume, 80)
});
/** Whether a live of this channel is one the owner asked to hear about: its platform is on and it is on the list (or the list is empty). */
var wants = (settings, live) => settings[live.platform] && (settings.channels.length === 0 || settings.channels.includes(live.channel.toLowerCase()));
var PLATFORM_NAME = {
	twitch: "Twitch",
	kick: "Kick"
};
var CHANNEL_CHARS = 60;
var TITLE_CHARS = 120;
var CATEGORY_CHARS = 60;
/** What each placeholder stands for, by every name the owner may write it with (accents and case do not matter). */
var placeholderValues = (live) => {
	const clean = (text, maxChars) => plainText(text ?? "", {
		maxChars,
		ellipsis: false
	});
	const channel = clean(live.channel, CHANNEL_CHARS);
	const title = clean(live.title, TITLE_CHARS);
	const category = clean(live.category, CATEGORY_CHARS);
	const platform = PLATFORM_NAME[live.platform];
	return /* @__PURE__ */ new Map([
		["canal", channel],
		["channel", channel],
		["plataforma", platform],
		["platform", platform],
		["titulo", title],
		["title", title],
		["categoria", category],
		["category", category]
	]);
};
var fold = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** The sentence to use: the owner's, or the default of the language when it is empty or still the default. */
var sentenceFor = (message, language) => {
	if (message.trim() !== "" && message !== "{canal} ficou ao vivo") return message;
	return language === "en" ? ENGLISH_MESSAGE : DEFAULT_MESSAGE;
};
var apply = (template, values) => template.replace(/\{([^{}]{1,20})\}/g, (whole, name) => values.get(fold(name.trim())) ?? whole).replace(/\s+/g, " ").trim();
/**
* The sentence with its placeholders filled in (`{canal}`, `{plataforma}`, `{titulo}`, `{categoria}`, or
* their English names), white space tidied. A name it does not know stays as written, so a typo shows.
* A sentence that comes out empty (only `{titulo}`, and the live has none) is the default one instead.
*/
var fill = (message, live, language) => {
	const values = placeholderValues(live);
	return apply(sentenceFor(message, language), values) || apply(sentenceFor("{canal} ficou ao vivo", language), values);
};
/** The line under the notice's title: "Treino (Valorant)", or just the one the platform gave. */
var liveLine = (live) => {
	const title = plainText(live.title ?? "", {
		maxChars: TITLE_CHARS,
		ellipsis: true
	});
	const category = plainText(live.category ?? "", {
		maxChars: CATEGORY_CHARS,
		ellipsis: true
	});
	return title !== "" && category !== "" ? `${title} (${category})` : title || category;
};
/** The host lets one notice through per extension every 5 s; a bit more than that between two of ours. */
var NOTICE_GAP_MS = 5250;
/** Notices waiting for their turn past which new ones are left out (the sound and the voice still go). */
var MAX_QUEUED_NOTICES = 5;
var activate = (api) => {
	let settings = readSettings(api.values);
	const lastAlertAt = /* @__PURE__ */ new Map();
	let stopped = false;
	const notices = [];
	let draining = false;
	let wake = null;
	const pause = (ms) => new Promise((resolve) => {
		const timer = setTimeout(() => {
			wake = null;
			resolve();
		}, ms);
		wake = () => {
			clearTimeout(timer);
			wake = null;
			resolve();
		};
	});
	const drain = async () => {
		if (draining) return;
		draining = true;
		try {
			while (notices.length > 0 && !stopped) {
				const next = notices.shift();
				await api.notify(next.title, next.text, { inApp: true });
				if (notices.length > 0) await pause(NOTICE_GAP_MS);
			}
		} finally {
			draining = false;
		}
	};
	const react = async (live) => {
		if (!wants(settings, live)) return;
		const key = `${live.platform}:${live.channel.toLowerCase()}`;
		const now = performance.now();
		const last = lastAlertAt.get(key);
		if (last !== void 0 && now - last < settings.cooldownMinutes * 6e4) return;
		lastAlertAt.set(key, now);
		const sentence = fill(settings.message, live, api.language);
		try {
			if (settings.showNotice && notices.length < 5) notices.push({
				title: sentence,
				text: liveLine(live)
			});
			await Promise.all([
				...settings.playSound ? [api.sound.play(settings.sound, settings.volume)] : [],
				...settings.speak ? [api.speak(sentence, {
					rate: settings.speakRate,
					volume: settings.speakVolume
				})] : [],
				drain()
			]);
		} catch (error) {
			api.log("error", error instanceof Error ? error.message : "the alert failed");
		}
	};
	const stopLives = api.channels.onLive(react);
	const stopValues = api.onValuesChanged((values) => {
		settings = readSettings(values);
	});
	return () => {
		stopped = true;
		notices.length = 0;
		wake?.();
		stopLives();
		stopValues();
	};
};
//#endregion
exports.DEFAULT_MESSAGE = DEFAULT_MESSAGE;
exports.MAX_QUEUED_NOTICES = MAX_QUEUED_NOTICES;
exports.NOTICE_GAP_MS = NOTICE_GAP_MS;
exports.activate = activate;
exports.default = activate;
exports.channelName = channelName;
exports.fill = fill;
exports.liveLine = liveLine;
exports.readSettings = readSettings;
exports.sentenceFor = sentenceFor;
exports.wants = wants;
