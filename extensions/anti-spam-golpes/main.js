Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region extensions/anti-spam-golpes/src/patterns.ts
/** The longest text the rules are tried on. A chat line is never longer. */
var MAX_TEXT = 1e3;
var LOOK_ALIKES = {
	"0": "o",
	"1": "i",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
	"@": "a",
	$: "s"
};
/**
* The two forms of a line the owner's expressions are tried on (a rule matches if either does, so a
* rule with a digit or an `@` in it still works on the plain form).
*/
var prepare = (text) => {
	const plain = text.slice(0, MAX_TEXT).replace(/\s+/g, " ").trim();
	return {
		plain,
		letters: plain.replace(/[0134577@$]/g, (char) => LOOK_ALIKES[char] ?? char)
	};
};
//#endregion
//#region extensions/anti-spam-golpes/src/index.ts
/** A line of a rules field longer than this is ignored (a pattern of that size is a mistake). */
var MAX_RULE_LENGTH = 300;
/** Rules read from one field. */
var MAX_RULES = 50;
var NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)[+*{]/;
var MAX_TIMEOUT_SECONDS = 1209600;
var flag = (value, fallback) => typeof value === "boolean" ? value : fallback;
var list = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
var actionOf = (value) => value === "timeout" || value === "ban" ? value : "delete";
/**
* The regular expressions of a rules field: one per line, case-insensitive. Blank lines, `#` comment
* lines, lines that are not a valid expression, lines too long and nested quantifiers are skipped
* (one bad line never costs the others); at most `MAX_RULES`.
*/
var compileRules = (lines) => {
	const rules = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (line.length === 0 || line.startsWith("#") || line.length > MAX_RULE_LENGTH) continue;
		if (NESTED_QUANTIFIER.test(line)) continue;
		try {
			rules.push(new RegExp(line, "i"));
		} catch {}
		if (rules.length >= MAX_RULES) break;
	}
	return rules;
};
var minutesOf = (value) => typeof value === "number" && Number.isFinite(value) ? value : 10;
var platformSettings = (values, prefix) => ({
	enabled: flag(values[`${prefix}Enabled`], true),
	rules: compileRules(list(values[`${prefix}Rules`])),
	action: actionOf(values[`${prefix}Action`]),
	timeoutMinutes: minutesOf(values[`${prefix}TimeoutMinutes`]),
	moderatable: list(values[`${prefix}Moderatable`])
});
/** The form's values as typed settings, with the manifest's defaults where a value is missing. */
var readSettings = (values) => ({
	globalRules: compileRules(list(values.globalRules)),
	twitch: platformSettings(values, "twitch"),
	kick: platformSettings(values, "kick")
});
/**
* What in `text` makes it spam for a message of this platform, or null: the global rules, then the
* platform's own rules. The platform has to be on. A rule is tried on the line with its white space
* folded and on the same line with look-alike digits turned into letters (`prepare`).
*/
var detect = (text, settings, platform) => {
	const own = settings[platform];
	if (!own.enabled) return null;
	const { plain, letters } = prepare(text);
	const matches = (rule) => rule.test(plain) || rule.test(letters);
	return settings.globalRules.some(matches) || own.rules.some(matches) ? "rule" : null;
};
/**
* Whether the extension may act on this author: every role they hold has to be one the form names.
* A viewer holds none; the broadcaster, moderators, VIPs, staff, bots and the owner's own account are
* only touched when the form says so. A guarded author the message names no role for is refused too,
* so a message that says "guarded" and lists nothing can never be a way around the form.
*/
var mayModerate = (author, allowed) => author.roles.every((role) => allowed.includes(role)) && (!author.guarded || author.roles.length > 0);
/**
* The moderation to ask for. A timeout or a ban needs the person's login; a message that has none is
* deleted instead, which is still the spam gone and never a wrong person.
*/
var moderationFor = (message, settings) => {
	const target = {
		platform: message.platform,
		channel: message.channel
	};
	const guarded = message.author.guarded ? { allowGuarded: true } : {};
	const login = message.author.login;
	if (settings.action === "delete" || login === null) return {
		target,
		action: "delete",
		messageId: message.id,
		...guarded
	};
	if (settings.action === "ban") return {
		target,
		action: "ban",
		login,
		messageId: message.id,
		...guarded
	};
	return {
		target,
		action: "timeout",
		login,
		seconds: Math.min(MAX_TIMEOUT_SECONDS, Math.max(1, Math.round(settings.timeoutMinutes * 60))),
		messageId: message.id,
		...guarded
	};
};
var activate = (api) => {
	let settings = readSettings(api.values);
	const react = async (message) => {
		if (message.event !== null) return;
		const platform = message.platform;
		const own = settings[platform];
		if (!own.enabled) return;
		if (!mayModerate(message.author, own.moderatable)) return;
		const finding = detect(message.text, settings, platform);
		if (finding === null) return;
		try {
			const answer = await api.chat.moderate(moderationFor(message, own));
			api.log("info", `${finding}: ${own.action} (${answer.ok ? answer.simulated ? "simulated" : "done" : answer.code})`);
		} catch (error) {
			api.log("error", error instanceof Error ? error.message : "the moderation failed");
		}
	};
	const stopMessages = api.chat.onMessage(react);
	const stopValues = api.onValuesChanged((values) => {
		settings = readSettings(values);
	});
	return () => {
		stopMessages();
		stopValues();
	};
};
//#endregion
exports.activate = activate;
exports.default = activate;
exports.compileRules = compileRules;
exports.detect = detect;
exports.mayModerate = mayModerate;
exports.moderationFor = moderationFor;
exports.readSettings = readSettings;
