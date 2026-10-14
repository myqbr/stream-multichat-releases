Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region extensions/destacar-no-chat/src/index.ts
/** The characters a word is made of: a "whole word" has none of them right before or after it. */
var WORD_CHARACTERS = "\\p{L}\\p{N}_";
var DIACRITICS = /\p{Diacritic}/gu;
var LINK = /\b(?:https?:\/\/|www\.)\S+/gi;
var flag = (value, fallback) => typeof value === "boolean" ? value : fallback;
var amount = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
var list = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
/** The form's values as typed settings, with the manifest's defaults where a value is missing. */
var readSettings = (values) => ({
	words: list(values.words),
	wholeWord: flag(values.wholeWord, true),
	firers: list(values.firers),
	playSound: flag(values.playSound, true),
	sound: typeof values.sound === "string" ? values.sound : "moeda",
	volume: amount(values.volume, 80),
	speak: flag(values.speak, false),
	cooldownSeconds: amount(values.cooldownSeconds, 30)
});
/** Lower case and no accents: "Ação" and "acao" are the same word, as in the automations. */
var fold = (text) => text.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
var escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
* One expression for all the words, or null when there is none. The words are folded like the text
* they are tried on; with `wholeWord`, "ana" does not match inside "banana".
*/
var compileWords = (words, wholeWord) => {
	const folded = [...new Set(words.map((word) => fold(word).trim()))].filter((word) => word.length > 0).sort((a, b) => b.length - a.length);
	if (folded.length === 0) return null;
	const body = folded.map(escapeRegExp).join("|");
	const source = wholeWord ? `(?<![${WORD_CHARACTERS}])(?:${body})(?![${WORD_CHARACTERS}])` : `(?:${body})`;
	return new RegExp(source, "u");
};
/**
* Whether an author with these roles may fire it: every role they hold has to be one the form names.
* A viewer holds none, so a viewer always may; the owner's own account (`self`), the broadcaster,
* moderators, VIPs, staff and bots may not, unless the form says so (the automations' default).
*/
var mayFire = (roles, allowed) => roles.every((role) => allowed.includes(role));
/** What the voice reads: who said it, then the words, with any address said as "link". */
var spokenText = (message, language) => {
	const words = message.text.replace(LINK, "link").trim();
	const who = message.author.displayName;
	return language === "en" ? `${who} said: ${words}` : `${who} disse: ${words}`;
};
var activate = (api) => {
	let settings = readSettings(api.values);
	let matcher = compileWords(settings.words, settings.wholeWord);
	let lastFiredAt = Number.NEGATIVE_INFINITY;
	const react = async (message) => {
		if (message.event !== null || matcher === null) return;
		if (!mayFire(message.author.roles, settings.firers)) return;
		if (!matcher.test(fold(message.text))) return;
		const now = Date.now();
		if (now - lastFiredAt < settings.cooldownSeconds * 1e3) return;
		lastFiredAt = now;
		try {
			await Promise.all([
				api.feed.highlight(message.id),
				...settings.playSound ? [api.sound.play(settings.sound, settings.volume)] : [],
				...settings.speak ? [api.speak(spokenText(message, api.language))] : []
			]);
		} catch (error) {
			api.log("error", error instanceof Error ? error.message : "the reaction failed");
		}
	};
	const stopMessages = api.chat.onMessage(react);
	const stopValues = api.onValuesChanged((values) => {
		settings = readSettings(values);
		matcher = compileWords(settings.words, settings.wholeWord);
	});
	return () => {
		stopMessages();
		stopValues();
	};
};
//#endregion
exports.activate = activate;
exports.default = activate;
exports.compileWords = compileWords;
exports.fold = fold;
exports.mayFire = mayFire;
exports.readSettings = readSettings;
exports.spokenText = spokenText;
