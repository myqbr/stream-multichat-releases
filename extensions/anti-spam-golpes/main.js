Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region extensions/anti-spam-golpes/src/patterns.ts
/** The longest text the patterns are tried on. */
var MAX_TEXT = 1e3;
var DIACRITICS = /\p{Diacritic}/gu;
var INVISIBLE = /[\u00ad\u200b-\u200f\u2060\ufeff]/g;
var CURLY_APOSTROPHES = /[\u2018\u2019\u00b4`]/g;
/** The text the patterns see. Also used for the owner's own terms, so both sides are alike. */
var normalize = (text) => text.slice(0, MAX_TEXT).normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(INVISIBLE, "").replace(CURLY_APOSTROPHES, "'").replace(/\s+/g, " ").trim();
/** What spam sells: audience. */
var AUDIENCE = "(?:viewers?|followers?|views?|subs|subscribers?|primes?|chatters?)";
/** What spam sells, as a list: "followers, primes and viewers". */
var AUDIENCE_LIST = `${AUDIENCE}(?:\\s?(?:,|and|&|\\+)\\s?${AUDIENCE}){0,4}`;
var PLATFORM = "(?:twitch\\s|kick\\s)?";
/** Either: the seller says where to go. */
var CONTACT = `(?:(?:https?:\\/\\/\\S{3,}|www\\.\\S{3,}|[a-z0-9-]{2,30}(?:\\.|\\s?\\(?dot\\)?\\s?)(?:com|net|org|io|gg|tv|co|me|xyz|shop|store|online|site|live|pro|top|info|ly|cc|app)\\b)|(?:link in (?:my )?bio|(?:check|see|visit) (?:my )?(?:bio|profile|page)|in my bio|(?:dm|pm|message|whisper|text|inbox) me|dm for))`;
/** Both of two expressions are somewhere in the text (each scanned once). */
var both = (first, second) => `^(?=.*${first})(?=.*${second})`;
var re = (source) => new RegExp(source, "i");
var GROUPS = [
	{
		id: "viewerBots",
		patterns: [
			{
				reason: "a \"buy/get … followers/viewers\" offer that also gives an address or a way to reach it",
				expression: re(both(`\\b(?:buy|get|purchase|order|need)\\b.{0,25}\\b${AUDIENCE}\\b`, CONTACT))
			},
			{
				reason: "\"best/cheap/fast … viewers service\": the audience as a product on sale",
				expression: re(`\\b(?:cheap(?:est)?|best|top|fast|real|instant)\\s${PLATFORM}${AUDIENCE_LIST}\\s(?:service|provider|seller|shop|store|panel|site|website|bots?|sale|promo|offer|prices?)\\b`)
			},
			{
				reason: "\"followers and viewers bots/boost/service\": a list of audiences followed by what sells it",
				expression: re(`\\b${AUDIENCE}(?:\\s?(?:,|and|&|\\+)\\s?${AUDIENCE}){1,3}\\s(?:bots?|boost(?:ing)?|sale|for sale|seller|services?|provider|promotion|promo)\\b`)
			}
		]
	},
	{
		id: "strangerApproach",
		patterns: [
			{
				reason: "\"hey stranger\" together with \"how is your day/evening going\"",
				expression: re(both("\\bhey,?\\sstranger\\b", "\\bhow(?:'s|s| is)?\\s(?:your|ur)\\s(?:day|evening|night|week)\\b"))
			},
			{
				reason: "\"how is your day going\" followed by a call to talk somewhere private",
				expression: re("\\bhow(?:'s|s| is)?\\s(?:your|ur)\\s(?:day|evening|night)\\s(?:going|been|so far)\\b.{0,100}\\b(?:dm|pm|inbox|private|whisper|message me|text me|add me|telegram|whatsapp|snap|instagram)\\b")
			},
			{
				reason: "\"hey stranger\" followed by a plea or a call to talk in private",
				expression: re("\\bhey,?\\sstranger\\b.{0,80}\\b(?:i(?:'m| am) (?:bored|lonely|alone|looking for)|(?:dm|message|add|text|whisper) me|in private|privately)\\b")
			}
		]
	},
	{
		id: "streamUpgrades",
		patterns: [
			{
				reason: "\"AI stream upgrades/boost/growth/manager…\": the pitch itself",
				expression: re("\\b(?:ai|a\\.i\\.)(?:[- ]powered)?\\sstream(?:ing)?\\s(?:upgrades?|boost(?:s|er|ing)?|growth|manager|assistant|service|tools?|upgrader)\\b")
			},
			{
				reason: "\"stream upgrade(s)\" with an address, a way to reach the seller or an offer word",
				expression: re(both("\\bstream\\supgrades?\\b", `(?:${CONTACT}|\\b(?:visit|check out|click|offering|free trial|promo code|discount)\\b)`))
			},
			{
				reason: "\"upgrade your stream/channel\" with an address or a way to reach the seller",
				expression: re(both(`\\bupgrade\\s(?:your|ur)\\s${PLATFORM}(?:stream|channel)\\b`, CONTACT))
			}
		]
	},
	{
		id: "servicesSale",
		patterns: [
			{
				reason: "\"I/we sell, offer, provide … followers/viewers/services\": the seller introducing the shop",
				expression: re(`\\b(?:i|we)(?:\\sam|'m|'re|\\sare)?\\s(?:currently\\s|now\\s)?(?:sell(?:ing)?|offer(?:ing)?|provid(?:e|ing)|promot(?:e|ing))\\s(?:cheap\\s|high quality\\s|real\\s)?${PLATFORM}(?:${AUDIENCE}|services?|promotions?|packages?)\\b`)
			},
			{
				reason: "\"selling followers/viewers/accounts\"",
				expression: re(`\\bselling\\s(?:cheap\\s)?${PLATFORM}(?:${AUDIENCE}|accounts?)\\b`)
			},
			{
				reason: "a price or discount word, an audience word and a way to reach the seller, all in one line",
				expression: re(`^(?=.*(?:\\b(?:cheap|low price|lowest price|discount|promo code|price list)\\b|\\$\\d))(?=.*\\b${AUDIENCE}\\b)(?=.*${CONTACT})`)
			},
			{
				reason: "\"dm me for followers/services/promotion\"",
				expression: re(`\\b(?:dm|pm|message)\\sme\\s(?:for|to get|if you want|if you need)\\s(?:cheap\\s)?(?:${AUDIENCE}|services?|promotion)\\b`)
			}
		]
	},
	{
		id: "boostLinks",
		patterns: [{
			reason: "\"boost/grow/promote your stream…\" or \"get more viewers\" with an address or \"link in bio\" / \"dm me\"",
			expression: re(both(`\\b(?:(?:boost|grow|increase|promote|level up|skyrocket|blow up)\\s(?:your|ur)\\s${PLATFORM}(?:stream|channel|account|audience|community|views?|viewers?|followers?|growth)|(?:get|gain)\\s(?:more|free)\\s${AUDIENCE})\\b`, CONTACT))
		}]
	},
	{
		id: "telegramLinks",
		patterns: [
			{
				reason: "a t.me / telegram.me / telegram.dog address (spaces around the dot or slash included)",
				expression: re("\\b(?:t|telegram)\\s?\\.\\s?(?:me|dog)\\s?\\/\\s?[a-z0-9_+]{3,}")
			},
			{
				reason: "\"telegram\" followed by an @handle",
				expression: re("\\btelegram\\b.{0,30}@[a-z0-9_]{4,}")
			},
			{
				reason: "a call to join/add/contact followed by telegram and a handle, group, channel or link",
				expression: re("\\b(?:join|add|contact|message|text|dm|find|reach)\\b.{0,20}\\btelegram\\b.{0,30}(?:@\\w{3,}|\\bgroup\\b|\\bchannel\\b|\\blink\\b)")
			}
		]
	}
];
/** The id of the first enabled group with a pattern that matches, or null. `text` is already normalized. */
var firstGroupMatching = (text, enabled) => {
	for (const group of GROUPS) {
		if (!enabled.has(group.id)) continue;
		if (group.patterns.some((pattern) => pattern.expression.test(text))) return group.id;
	}
	return null;
};
//#endregion
//#region extensions/anti-spam-golpes/src/index.ts
var MAX_TIMEOUT_SECONDS = 1209600;
var flag = (value, fallback) => typeof value === "boolean" ? value : fallback;
var list = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
/** Every group is on unless the form says it is off. */
var enabledGroups = (values) => new Set(GROUPS.map((group) => group.id).filter((id) => flag(values[id], true)));
var actionOf = (value) => value === "timeout" || value === "ban" ? value : "delete";
var scopeOf = (value) => value === "twitch" || value === "kick" ? value : "all";
/** The form's values as typed settings, with the manifest's defaults where a value is missing. */
var readSettings = (values) => ({
	groups: enabledGroups(values),
	terms: [...new Set(list(values.customTerms).map(normalize))].filter((term) => term.length > 0),
	action: actionOf(values.action),
	timeoutMinutes: typeof values.timeoutMinutes === "number" && Number.isFinite(values.timeoutMinutes) ? values.timeoutMinutes : 10,
	moderatable: list(values.moderatable),
	scope: scopeOf(values.scope)
});
/** What in `text` makes it spam to these settings, or null. */
var detect = (text, settings) => {
	const normalized = normalize(text);
	const group = firstGroupMatching(normalized, settings.groups);
	if (group !== null) return group;
	return settings.terms.some((term) => normalized.includes(term)) ? "custom" : null;
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
		if (settings.scope !== "all" && message.platform !== settings.scope) return;
		if (!mayModerate(message.author, settings.moderatable)) return;
		const finding = detect(message.text, settings);
		if (finding === null) return;
		try {
			const answer = await api.chat.moderate(moderationFor(message, settings));
			api.log("info", `${finding}: ${settings.action} (${answer.ok ? answer.simulated ? "simulated" : "done" : answer.code})`);
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
exports.detect = detect;
exports.mayModerate = mayModerate;
exports.moderationFor = moderationFor;
exports.readSettings = readSettings;
