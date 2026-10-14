Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region extensions/shoutout-em-raid/src/index.ts
var MIN_CONFIRM_SECONDS = 3;
var MAX_CONFIRM_SECONDS = 300;
var LOGIN = /^[A-Za-z0-9_]{1,25}$/;
var amount = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
/** The form's values as typed settings, with the manifest's defaults where a value is missing. */
var readSettings = (values) => ({
	minViewers: amount(values.minViewers, 10),
	ask: typeof values.ask === "boolean" ? values.ask : true,
	waitSeconds: Math.max(0, amount(values.waitSeconds, 10)),
	confirmSeconds: Math.min(MAX_CONFIRM_SECONDS, Math.max(MIN_CONFIRM_SECONDS, Math.round(amount(values.confirmSeconds, 30)))),
	platform: "twitch"
});
/** The login the shoutout is for, or null when the raider has no name that is safe to put in a command. */
var raiderLogin = (message) => {
	const login = message.author.login ?? message.author.displayName;
	return LOGIN.test(login) ? login : null;
};
/** The number of viewers the raid brought, when this message is a raid the settings care about. */
var raidViewers = (message, settings) => {
	if (message.event === null || message.event.type !== "raid") return null;
	if (message.platform !== settings.platform) return null;
	const viewers = message.event.amount;
	return viewers !== null && viewers >= settings.minViewers ? viewers : null;
};
var dialogTexts = (language, name, viewers) => language === "en" ? {
	title: "Raid shoutout",
	body: `Give ${name} a shoutout? (${viewers} viewers)`,
	confirmLabel: "Give shoutout",
	cancelLabel: "Not now"
} : {
	title: "Shoutout em raid",
	body: `Dar shoutout em ${name}? (${viewers} espectadores)`,
	confirmLabel: "Dar shoutout",
	cancelLabel: "Agora não"
};
var activate = (api) => {
	let settings = readSettings(api.values);
	let stopped = false;
	let busy = false;
	const waits = /* @__PURE__ */ new Map();
	const wait = (seconds) => new Promise((resolve) => {
		if (seconds <= 0) {
			resolve();
			return;
		}
		const handle = setTimeout(() => {
			waits.delete(handle);
			resolve();
		}, seconds * 1e3);
		waits.set(handle, resolve);
	});
	const run = async (message, viewers, login) => {
		busy = true;
		try {
			await wait(settings.waitSeconds);
			if (stopped) return;
			if (settings.ask) {
				const texts = dialogTexts(api.language, message.author.displayName, viewers);
				const confirmed = await api.confirm({
					...texts,
					timeoutSeconds: settings.confirmSeconds
				});
				if (stopped) return;
				if (!confirmed) {
					await api.feed.reset();
					return;
				}
			}
			await api.chat.runCommand(`/shoutout ${login}`, { target: {
				platform: message.platform,
				channel: message.channel
			} });
			await api.feed.reset();
		} catch (error) {
			api.log("error", error instanceof Error ? error.message : "the shoutout failed");
		} finally {
			busy = false;
		}
	};
	const react = async (message) => {
		const viewers = raidViewers(message, settings);
		if (viewers === null) return;
		const login = raiderLogin(message);
		if (login === null) {
			api.log("warn", "a raid came from a name that is not a login: no shoutout");
			return;
		}
		if (busy) {
			api.log("info", "a shoutout is already pending: this raid was skipped");
			return;
		}
		await run(message, viewers, login);
	};
	const stopMessages = api.chat.onMessage(react);
	const stopValues = api.onValuesChanged((values) => {
		settings = readSettings(values);
	});
	return () => {
		stopped = true;
		stopMessages();
		stopValues();
		for (const [handle, resolve] of waits) {
			clearTimeout(handle);
			resolve();
		}
		waits.clear();
	};
};
//#endregion
exports.activate = activate;
exports.default = activate;
exports.raidViewers = raidViewers;
exports.raiderLogin = raiderLogin;
exports.readSettings = readSettings;
