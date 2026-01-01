"use cache";

import {
	db,
	type Item,
	itemPeople,
	items,
	people,
	sessions,
	users,
} from "@streamystats/database";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	lte,
	type SQL,
	sql,
	sum,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getStatisticsExclusions } from "./exclusions";

// =============================================================================
// Types
// =============================================================================

export interface WrappedParams {
	serverId: number;
	userId: string;
	year: number;
}

export interface WrappedOverview {
	totalPlays: number;
	totalWatchTimeSeconds: number;
	totalHoursWatched: number;
	uniqueItemsWatched: number;
	totalDaysWithActivity: number;
	firstWatch: {
		itemId: string;
		itemName: string;
		itemType: string;
		timestamp: string;
		primaryImageTag: string | null;
		seriesName: string | null;
		productionYear: number | null;
		genres: string[] | null;
	} | null;
	lastWatch: {
		itemId: string;
		itemName: string;
		itemType: string;
		timestamp: string;
		primaryImageTag: string | null;
		seriesName: string | null;
		productionYear: number | null;
		genres: string[] | null;
	} | null;
}

export interface ItemWithStats extends Item {
	totalPlayCount: number;
	totalPlayDuration: number;
}

export interface WrappedTopItems {
	movies: ItemWithStats[];
	series: ItemWithStats[];
}

export interface GenreStats {
	genre: string;
	watchTimeSeconds: number;
	playCount: number;
	percentageOfTotal: number;
}

export interface WrappedGenres {
	topGenres: GenreStats[];
	totalGenresExplored: number;
}

export interface PersonStats {
	id: string;
	name: string;
	primaryImageTag: string | null;
	type: "Actor" | "Director" | "Writer";
	totalWatchTime: number;
	totalPlayCount: number;
	itemCount: number;
}

export interface WrappedPeopleStats {
	topActors: PersonStats[];
	topDirectors: PersonStats[];
}

export interface DayActivity {
	date: string;
	watchTimeSeconds: number;
	playCount: number;
}

export interface HourlyPattern {
	hour: number;
	watchTimeSeconds: number;
	playCount: number;
}

export interface WeekdayPattern {
	day: string;
	dayIndex: number;
	watchTimeSeconds: number;
	playCount: number;
}

export interface MonthlyTotal {
	month: number;
	monthName: string;
	watchTimeSeconds: number;
	playCount: number;
}

export interface WrappedActivityPatterns {
	hourlyPatterns: HourlyPattern[];
	weekdayPatterns: WeekdayPattern[];
	monthlyTotals: MonthlyTotal[];
	peakHour: number;
	peakWeekday: string;
	peakMonth: number;
	longestStreak: number;
}

export interface TypeBreakdown {
	movie: {
		watchTimeSeconds: number;
		playCount: number;
		percentage: number;
	};
	episode: {
		watchTimeSeconds: number;
		playCount: number;
		percentage: number;
	};
	total: {
		watchTimeSeconds: number;
		playCount: number;
	};
}

export interface RewatchStats {
	mostRewatchedItem: {
		itemId: string;
		itemName: string;
		itemType: string;
		rewatchCount: number;
		primaryImageTag: string | null;
		seriesName: string | null;
		productionYear: number | null;
	} | null;
	totalRewatches: number;
	rewatchPercentage: number;
	topRewatchedItems: Array<{
		itemId: string;
		itemName: string;
		itemType: string;
		playCount: number;
		totalWatchTimeSeconds: number;
		primaryImageTag: string | null;
	}>;
}

export interface GenrePercentile {
	genre: string;
	userWatchTimeSeconds: number;
	serverAverageSeconds: number;
	percentile: number;
	isTopGenreForUser: boolean;
}

export interface WrappedData {
	year: number;
	userId: string;
	userName: string;
	generatedAt: string;
	overview: WrappedOverview;
	topItems: WrappedTopItems;
	genres: WrappedGenres;
	people: WrappedPeopleStats;
	activityPatterns: WrappedActivityPatterns;
	typeBreakdown: TypeBreakdown;
	rewatchStats: RewatchStats;
	genrePercentiles: GenrePercentile[];
}

// =============================================================================
// Helper Functions
// =============================================================================

function getYearDateRange(year: number): { start: Date; end: Date } {
	return {
		start: new Date(`${year}-01-01T00:00:00.000Z`),
		end: new Date(`${year}-12-31T23:59:59.999Z`),
	};
}

function getCacheLifeForYear(year: number): void {
	const currentYear = new Date().getFullYear();
	if (year < currentYear) {
		cacheLife("days");
	} else {
		cacheLife("hours");
	}
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const WEEKDAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

// =============================================================================
// Query Functions
// =============================================================================

export async function getWrappedOverview(
	params: WrappedParams,
): Promise<WrappedOverview> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(
		`wrapped-overview-${params.serverId}-${params.userId}-${params.year}`,
	);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
	];

	if (userExclusion) {
		whereConditions.push(userExclusion);
	}
	if (itemLibraryExclusion) {
		whereConditions.push(itemLibraryExclusion);
	}

	// Get aggregate stats
	const [statsResult] = await db
		.select({
			totalPlays: count(sessions.id),
			totalWatchTimeSeconds: sum(sessions.playDuration),
			uniqueItems: countDistinct(sessions.itemId),
			daysWithActivity: sql<number>`COUNT(DISTINCT DATE(${sessions.startTime}))`,
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions));

	// Get first watch
	const [firstWatchResult] = await db
		.select({
			itemId: sessions.itemId,
			itemName: items.name,
			itemType: items.type,
			timestamp: sessions.startTime,
			primaryImageTag: items.primaryImageTag,
			seriesName: items.seriesName,
			seriesId: items.seriesId,
			productionYear: items.productionYear,
			genres: items.genres,
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.orderBy(asc(sessions.startTime))
		.limit(1);

	// Get last watch
	const [lastWatchResult] = await db
		.select({
			itemId: sessions.itemId,
			itemName: items.name,
			itemType: items.type,
			timestamp: sessions.startTime,
			primaryImageTag: items.primaryImageTag,
			seriesName: items.seriesName,
			seriesId: items.seriesId,
			productionYear: items.productionYear,
			genres: items.genres,
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.orderBy(desc(sessions.startTime))
		.limit(1);

	let firstWatchGenres = firstWatchResult?.genres;
	let lastWatchGenres = lastWatchResult?.genres;

	if (
		firstWatchResult?.seriesId &&
		(!firstWatchGenres || firstWatchGenres.length === 0)
	) {
		const [seriesResult] = await db
			.select({ genres: items.genres })
			.from(items)
			.where(eq(items.id, firstWatchResult.seriesId))
			.limit(1);
		firstWatchGenres = seriesResult?.genres ?? null;
	}

	if (
		lastWatchResult?.seriesId &&
		(!lastWatchGenres || lastWatchGenres.length === 0)
	) {
		const [seriesResult] = await db
			.select({ genres: items.genres })
			.from(items)
			.where(eq(items.id, lastWatchResult.seriesId))
			.limit(1);
		lastWatchGenres = seriesResult?.genres ?? null;
	}

	const totalWatchTimeSeconds = Number(statsResult?.totalWatchTimeSeconds ?? 0);

	return {
		totalPlays: statsResult?.totalPlays ?? 0,
		totalWatchTimeSeconds,
		totalHoursWatched: Math.round(totalWatchTimeSeconds / 3600),
		uniqueItemsWatched: statsResult?.uniqueItems ?? 0,
		totalDaysWithActivity: statsResult?.daysWithActivity ?? 0,
		firstWatch: firstWatchResult?.itemId
			? {
					itemId: firstWatchResult.itemId,
					itemName: firstWatchResult.itemName,
					itemType: firstWatchResult.itemType,
					timestamp: firstWatchResult.timestamp?.toISOString() ?? "",
					primaryImageTag: firstWatchResult.primaryImageTag,
					seriesName: firstWatchResult.seriesName,
					productionYear: firstWatchResult.productionYear,
					genres: firstWatchGenres,
				}
			: null,
		lastWatch: lastWatchResult?.itemId
			? {
					itemId: lastWatchResult.itemId,
					itemName: lastWatchResult.itemName,
					itemType: lastWatchResult.itemType,
					timestamp: lastWatchResult.timestamp?.toISOString() ?? "",
					primaryImageTag: lastWatchResult.primaryImageTag,
					seriesName: lastWatchResult.seriesName,
					productionYear: lastWatchResult.productionYear,
					genres: lastWatchGenres,
				}
			: null,
	};
}

export async function getWrappedTopItems(
	params: WrappedParams,
	limit = 10,
): Promise<WrappedTopItems> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(
		`wrapped-top-items-${params.serverId}-${params.userId}-${params.year}`,
	);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
	];

	if (userExclusion) {
		whereConditions.push(userExclusion);
	}

	// Get session stats grouped by item
	const rawSessionStats = await db
		.select({
			itemId: sessions.itemId,
			totalPlayCount: count(sessions.id),
			totalPlayDuration: sum(sessions.playDuration),
		})
		.from(sessions)
		.where(and(...whereConditions))
		.groupBy(sessions.itemId)
		.orderBy(desc(sum(sessions.playDuration)));

	const sessionStats = rawSessionStats
		.map((stat) => ({
			itemId: stat.itemId ?? "",
			totalPlayCount: stat.totalPlayCount,
			totalPlayDuration: Number(stat.totalPlayDuration ?? 0),
		}))
		.filter((stat) => stat.itemId);

	// Fetch all items
	const itemIds = sessionStats.map((stat) => stat.itemId);
	const itemConditions: SQL[] = [inArray(items.id, itemIds)];
	if (itemLibraryExclusion) {
		itemConditions.push(itemLibraryExclusion);
	}

	const itemsData =
		itemIds.length > 0
			? await db
					.select()
					.from(items)
					.where(and(...itemConditions))
			: [];

	const itemsMap = new Map(itemsData.map((item) => [item.id, item]));

	// Combine stats with item data
	const itemsWithStats: ItemWithStats[] = sessionStats
		.map((stat) => {
			const item = itemsMap.get(stat.itemId);
			if (!item) return null;
			return {
				...item,
				totalPlayCount: stat.totalPlayCount,
				totalPlayDuration: stat.totalPlayDuration,
			};
		})
		.filter((item): item is ItemWithStats => item !== null);

	// Group movies and episodes
	const movies: ItemWithStats[] = [];
	const episodesBySeriesId = new Map<string, ItemWithStats[]>();

	for (const item of itemsWithStats) {
		if (item.type === "Movie") {
			movies.push(item);
		} else if (item.type === "Episode" && item.seriesId) {
			if (!episodesBySeriesId.has(item.seriesId)) {
				episodesBySeriesId.set(item.seriesId, []);
			}
			episodesBySeriesId.get(item.seriesId)?.push(item);
		}
	}

	// Aggregate series stats from episodes
	const seriesStatsMap = new Map<
		string,
		{ totalPlayCount: number; totalPlayDuration: number }
	>();

	for (const [seriesId, episodes] of episodesBySeriesId) {
		const totalPlayCount = episodes.reduce(
			(sum, ep) => sum + ep.totalPlayCount,
			0,
		);
		const totalPlayDuration = episodes.reduce(
			(sum, ep) => sum + ep.totalPlayDuration,
			0,
		);
		seriesStatsMap.set(seriesId, { totalPlayCount, totalPlayDuration });
	}

	// Get series items
	const series: ItemWithStats[] = [];
	if (seriesStatsMap.size > 0) {
		const seriesIds = Array.from(seriesStatsMap.keys());
		const seriesItems = await db
			.select()
			.from(items)
			.where(
				and(
					inArray(items.id, seriesIds),
					eq(items.type, "Series"),
					eq(items.serverId, serverId),
				),
			);

		for (const seriesItem of seriesItems) {
			const stats = seriesStatsMap.get(seriesItem.id);
			if (stats) {
				series.push({
					...seriesItem,
					totalPlayCount: stats.totalPlayCount,
					totalPlayDuration: stats.totalPlayDuration,
				});
			}
		}
	}

	// Sort and limit
	movies.sort((a, b) => b.totalPlayDuration - a.totalPlayDuration);
	series.sort((a, b) => b.totalPlayDuration - a.totalPlayDuration);

	return {
		movies: movies.slice(0, limit),
		series: series.slice(0, limit),
	};
}

export async function getWrappedGenreStats(
	params: WrappedParams,
): Promise<WrappedGenres> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(`wrapped-genres-${params.serverId}-${params.userId}-${params.year}`);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
		isNotNull(items.genres),
	];

	if (userExclusion) {
		whereConditions.push(userExclusion);
	}
	if (itemLibraryExclusion) {
		whereConditions.push(itemLibraryExclusion);
	}

	// Get genre stats using unnest
	const genreStats = await db
		.select({
			genre: sql<string>`unnest(${items.genres})`.as("genre"),
			watchTimeSeconds: sum(sessions.playDuration),
			playCount: count(sessions.id),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(sql`unnest(${items.genres})`)
		.orderBy(desc(sum(sessions.playDuration)));

	// Calculate total for percentages
	const totalWatchTime = genreStats.reduce(
		(sum, g) => sum + Number(g.watchTimeSeconds ?? 0),
		0,
	);

	const topGenres: GenreStats[] = genreStats.slice(0, 10).map((g) => ({
		genre: g.genre,
		watchTimeSeconds: Number(g.watchTimeSeconds ?? 0),
		playCount: g.playCount,
		percentageOfTotal:
			totalWatchTime > 0
				? Math.round((Number(g.watchTimeSeconds ?? 0) / totalWatchTime) * 100)
				: 0,
	}));

	return {
		topGenres,
		totalGenresExplored: genreStats.length,
	};
}

export async function getWrappedPeopleStats(
	params: WrappedParams,
	limit = 10,
): Promise<WrappedPeopleStats> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(`wrapped-people-${params.serverId}-${params.userId}-${params.year}`);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	async function getTopPeopleByType(
		personType: "Actor" | "Director",
	): Promise<PersonStats[]> {
		const results: PersonStats[] = [];

		// Movie stats
		const movieConditions: SQL[] = [
			eq(sessions.serverId, serverId),
			eq(sessions.userId, userId),
			gte(sessions.startTime, start),
			lte(sessions.startTime, end),
			isNotNull(sessions.itemId),
			eq(items.type, "Movie"),
			eq(itemPeople.type, personType),
		];

		if (userExclusion) movieConditions.push(userExclusion);
		if (itemLibraryExclusion) movieConditions.push(itemLibraryExclusion);

		const movieStats = await db
			.select({
				personId: people.id,
				personName: people.name,
				primaryImageTag: people.primaryImageTag,
				totalWatchTime: sum(sessions.playDuration),
				totalPlayCount: count(sessions.id),
				itemCount: countDistinct(items.id),
			})
			.from(sessions)
			.innerJoin(items, eq(sessions.itemId, items.id))
			.innerJoin(itemPeople, eq(items.id, itemPeople.itemId))
			.innerJoin(
				people,
				and(
					eq(itemPeople.personId, people.id),
					eq(itemPeople.serverId, people.serverId),
				),
			)
			.where(and(...movieConditions))
			.groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
			.orderBy(desc(sum(sessions.playDuration)))
			.limit(limit);

		for (const stat of movieStats) {
			results.push({
				id: stat.personId,
				name: stat.personName,
				primaryImageTag: stat.primaryImageTag,
				type: personType,
				totalWatchTime: Number(stat.totalWatchTime ?? 0),
				totalPlayCount: stat.totalPlayCount,
				itemCount: Number(stat.itemCount),
			});
		}

		// Series stats (join on seriesId for cast)
		const seriesConditions: SQL[] = [
			eq(sessions.serverId, serverId),
			eq(sessions.userId, userId),
			gte(sessions.startTime, start),
			lte(sessions.startTime, end),
			isNotNull(sessions.itemId),
			eq(items.type, "Episode"),
			isNotNull(items.seriesId),
			eq(itemPeople.type, personType),
		];

		if (userExclusion) seriesConditions.push(userExclusion);
		if (itemLibraryExclusion) seriesConditions.push(itemLibraryExclusion);

		const seriesStats = await db
			.select({
				personId: people.id,
				personName: people.name,
				primaryImageTag: people.primaryImageTag,
				totalWatchTime: sum(sessions.playDuration),
				totalPlayCount: count(sessions.id),
				itemCount: countDistinct(items.seriesId),
			})
			.from(sessions)
			.innerJoin(items, eq(sessions.itemId, items.id))
			.innerJoin(itemPeople, eq(items.seriesId, itemPeople.itemId))
			.innerJoin(
				people,
				and(
					eq(itemPeople.personId, people.id),
					eq(itemPeople.serverId, people.serverId),
				),
			)
			.where(and(...seriesConditions))
			.groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
			.orderBy(desc(sum(sessions.playDuration)))
			.limit(limit);

		// Merge series stats with movie stats
		for (const stat of seriesStats) {
			const existing = results.find((r) => r.id === stat.personId);
			if (existing) {
				existing.totalWatchTime += Number(stat.totalWatchTime ?? 0);
				existing.totalPlayCount += stat.totalPlayCount;
				existing.itemCount += Number(stat.itemCount);
			} else {
				results.push({
					id: stat.personId,
					name: stat.personName,
					primaryImageTag: stat.primaryImageTag,
					type: personType,
					totalWatchTime: Number(stat.totalWatchTime ?? 0),
					totalPlayCount: stat.totalPlayCount,
					itemCount: Number(stat.itemCount),
				});
			}
		}

		// Sort and limit
		results.sort((a, b) => b.totalWatchTime - a.totalWatchTime);
		return results.slice(0, limit);
	}

	const [topActors, topDirectors] = await Promise.all([
		getTopPeopleByType("Actor"),
		getTopPeopleByType("Director"),
	]);

	return { topActors, topDirectors };
}

export async function getWrappedActivityPatterns(
	params: WrappedParams,
): Promise<WrappedActivityPatterns> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(
		`wrapped-activity-${params.serverId}-${params.userId}-${params.year}`,
	);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
	];

	if (userExclusion) whereConditions.push(userExclusion);
	if (itemLibraryExclusion) whereConditions.push(itemLibraryExclusion);

	// Calendar heatmap - daily activity
	const dailyStats = await db
		.select({
			date: sql<string>`DATE(${sessions.startTime})`.as("date"),
			watchTimeSeconds: sum(sessions.playDuration),
			playCount: count(sessions.id),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(sql`DATE(${sessions.startTime})`)
		.orderBy(sql`DATE(${sessions.startTime})`);

	const calendarHeatmap: DayActivity[] = dailyStats.map((d) => ({
		date: d.date,
		watchTimeSeconds: Number(d.watchTimeSeconds ?? 0),
		playCount: d.playCount,
	}));

	// Hourly patterns
	const hourlyStats = await db
		.select({
			hour: sql<number>`EXTRACT(HOUR FROM ${sessions.startTime})`.as("hour"),
			watchTimeSeconds: sum(sessions.playDuration),
			playCount: count(sessions.id),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(sql`EXTRACT(HOUR FROM ${sessions.startTime})`)
		.orderBy(sql`EXTRACT(HOUR FROM ${sessions.startTime})`);

	const hourlyPatterns: HourlyPattern[] = [];
	for (let h = 0; h < 24; h++) {
		const stat = hourlyStats.find((s) => Number(s.hour) === h);
		hourlyPatterns.push({
			hour: h,
			watchTimeSeconds: Number(stat?.watchTimeSeconds ?? 0),
			playCount: stat?.playCount ?? 0,
		});
	}

	// Weekday patterns
	const weekdayStats = await db
		.select({
			dayIndex: sql<number>`EXTRACT(DOW FROM ${sessions.startTime})`.as(
				"dayIndex",
			),
			watchTimeSeconds: sum(sessions.playDuration),
			playCount: count(sessions.id),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(sql`EXTRACT(DOW FROM ${sessions.startTime})`)
		.orderBy(sql`EXTRACT(DOW FROM ${sessions.startTime})`);

	const weekdayPatterns: WeekdayPattern[] = WEEKDAY_NAMES.map((day, index) => {
		const stat = weekdayStats.find((s) => Number(s.dayIndex) === index);
		return {
			day,
			dayIndex: index,
			watchTimeSeconds: Number(stat?.watchTimeSeconds ?? 0),
			playCount: stat?.playCount ?? 0,
		};
	});

	// Monthly totals
	const monthlyStats = await db
		.select({
			month: sql<number>`EXTRACT(MONTH FROM ${sessions.startTime})`.as("month"),
			watchTimeSeconds: sum(sessions.playDuration),
			playCount: count(sessions.id),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(sql`EXTRACT(MONTH FROM ${sessions.startTime})`)
		.orderBy(sql`EXTRACT(MONTH FROM ${sessions.startTime})`);

	const monthlyTotals: MonthlyTotal[] = MONTH_NAMES.map((monthName, index) => {
		const month = index + 1;
		const stat = monthlyStats.find((s) => Number(s.month) === month);
		return {
			month,
			monthName,
			watchTimeSeconds: Number(stat?.watchTimeSeconds ?? 0),
			playCount: stat?.playCount ?? 0,
		};
	});

	// Calculate peaks
	const peakHourStat = hourlyPatterns.reduce((max, h) =>
		h.watchTimeSeconds > max.watchTimeSeconds ? h : max,
	);
	const peakWeekdayStat = weekdayPatterns.reduce((max, w) =>
		w.watchTimeSeconds > max.watchTimeSeconds ? w : max,
	);
	const peakMonthStat = monthlyTotals.reduce((max, m) =>
		m.watchTimeSeconds > max.watchTimeSeconds ? m : max,
	);
	const mostActiveDay = calendarHeatmap.reduce<DayActivity | null>(
		(max, d) => (!max || d.watchTimeSeconds > max.watchTimeSeconds ? d : max),
		null,
	);

	// Calculate longest streak
	let longestStreak = 0;
	let currentStreak = 0;
	const sortedDates = calendarHeatmap
		.map((d) => d.date)
		.sort((a, b) => a.localeCompare(b));

	for (let i = 0; i < sortedDates.length; i++) {
		if (i === 0) {
			currentStreak = 1;
		} else {
			const prevDate = new Date(sortedDates[i - 1]);
			const currDate = new Date(sortedDates[i]);
			const diffDays = Math.round(
				(currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
			);
			if (diffDays === 1) {
				currentStreak++;
			} else {
				currentStreak = 1;
			}
		}
		longestStreak = Math.max(longestStreak, currentStreak);
	}

	return {
		hourlyPatterns,
		weekdayPatterns,
		monthlyTotals,
		peakHour: peakHourStat.hour,
		peakWeekday: peakWeekdayStat.day,
		peakMonth: peakMonthStat.month,
		longestStreak,
	};
}

export async function getWrappedTypeBreakdown(
	params: WrappedParams,
): Promise<TypeBreakdown> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(
		`wrapped-type-breakdown-${params.serverId}-${params.userId}-${params.year}`,
	);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
	];

	if (userExclusion) whereConditions.push(userExclusion);
	if (itemLibraryExclusion) whereConditions.push(itemLibraryExclusion);

	const typeStats = await db
		.select({
			type: items.type,
			watchTimeSeconds: sum(sessions.playDuration),
			playCount: count(sessions.id),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(items.type);

	const movieStats = typeStats.find((t) => t.type === "Movie");
	const episodeStats = typeStats.find((t) => t.type === "Episode");

	const movieTime = Number(movieStats?.watchTimeSeconds ?? 0);
	const episodeTime = Number(episodeStats?.watchTimeSeconds ?? 0);
	const totalTime = movieTime + episodeTime;

	return {
		movie: {
			watchTimeSeconds: movieTime,
			playCount: movieStats?.playCount ?? 0,
			percentage: totalTime > 0 ? Math.round((movieTime / totalTime) * 100) : 0,
		},
		episode: {
			watchTimeSeconds: episodeTime,
			playCount: episodeStats?.playCount ?? 0,
			percentage:
				totalTime > 0 ? Math.round((episodeTime / totalTime) * 100) : 0,
		},
		total: {
			watchTimeSeconds: totalTime,
			playCount: (movieStats?.playCount ?? 0) + (episodeStats?.playCount ?? 0),
		},
	};
}

export async function getWrappedRewatchStats(
	params: WrappedParams,
): Promise<RewatchStats> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(
		`wrapped-rewatch-${params.serverId}-${params.userId}-${params.year}`,
	);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
	];

	if (userExclusion) whereConditions.push(userExclusion);
	if (itemLibraryExclusion) whereConditions.push(itemLibraryExclusion);

	// Get items with multiple plays
	const itemPlayCounts = await db
		.select({
			itemId: sessions.itemId,
			itemName: items.name,
			itemType: items.type,
			primaryImageTag: items.primaryImageTag,
			seriesName: items.seriesName,
			productionYear: items.productionYear,
			playCount: count(sessions.id),
			totalWatchTimeSeconds: sum(sessions.playDuration),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions))
		.groupBy(
			sessions.itemId,
			items.name,
			items.type,
			items.primaryImageTag,
			items.seriesName,
			items.productionYear,
		)
		.having(sql`COUNT(${sessions.id}) > 1`)
		.orderBy(desc(count(sessions.id)));

	const topRewatchedItems = itemPlayCounts.slice(0, 5).map((item) => ({
		itemId: item.itemId ?? "",
		itemName: item.itemName,
		itemType: item.itemType,
		playCount: item.playCount,
		totalWatchTimeSeconds: Number(item.totalWatchTimeSeconds ?? 0),
		primaryImageTag: item.primaryImageTag,
	}));

	// Calculate rewatch stats
	const totalRewatches = itemPlayCounts.reduce(
		(sum, item) => sum + (item.playCount - 1),
		0,
	);

	// Get total plays for percentage
	const [totalPlaysResult] = await db
		.select({ total: count(sessions.id) })
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...whereConditions));

	const totalPlays = totalPlaysResult?.total ?? 0;
	const rewatchPercentage =
		totalPlays > 0 ? Math.round((totalRewatches / totalPlays) * 100) : 0;

	const mostRewatched = itemPlayCounts[0];

	return {
		mostRewatchedItem: mostRewatched
			? {
					itemId: mostRewatched.itemId ?? "",
					itemName: mostRewatched.itemName,
					itemType: mostRewatched.itemType,
					rewatchCount: mostRewatched.playCount - 1,
					primaryImageTag: mostRewatched.primaryImageTag,
					seriesName: mostRewatched.seriesName,
					productionYear: mostRewatched.productionYear,
				}
			: null,
		totalRewatches,
		rewatchPercentage,
		topRewatchedItems,
	};
}

export async function getWrappedGenrePercentiles(
	params: WrappedParams,
): Promise<GenrePercentile[]> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(
		`wrapped-percentiles-${params.serverId}-${params.userId}-${params.year}`,
	);

	const { serverId, userId, year } = params;
	const { start, end } = getYearDateRange(year);

	const { userExclusion, itemLibraryExclusion } =
		await getStatisticsExclusions(serverId);

	// Get user's genre stats
	const userWhereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
		isNotNull(items.genres),
	];

	if (itemLibraryExclusion) userWhereConditions.push(itemLibraryExclusion);

	const userGenreStats = await db
		.select({
			genre: sql<string>`unnest(${items.genres})`.as("genre"),
			watchTimeSeconds: sum(sessions.playDuration),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...userWhereConditions))
		.groupBy(sql`unnest(${items.genres})`)
		.orderBy(desc(sum(sessions.playDuration)));

	if (userGenreStats.length === 0) {
		return [];
	}

	// Get all users' genre stats for comparison
	const serverWhereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		gte(sessions.startTime, start),
		lte(sessions.startTime, end),
		isNotNull(sessions.itemId),
		isNotNull(items.genres),
		isNotNull(sessions.userId),
	];

	if (userExclusion) serverWhereConditions.push(userExclusion);
	if (itemLibraryExclusion) serverWhereConditions.push(itemLibraryExclusion);

	// Get per-user genre totals for percentile calculation
	const allUsersGenreStats = await db
		.select({
			odUserId: sessions.userId,
			genre: sql<string>`unnest(${items.genres})`.as("genre"),
			watchTimeSeconds: sum(sessions.playDuration),
		})
		.from(sessions)
		.innerJoin(items, eq(sessions.itemId, items.id))
		.where(and(...serverWhereConditions))
		.groupBy(sessions.userId, sql`unnest(${items.genres})`);

	// Calculate percentiles
	const userTopGenre = userGenreStats[0]?.genre;
	const percentiles: GenrePercentile[] = [];

	for (const userGenre of userGenreStats.slice(0, 5)) {
		const genre = userGenre.genre;
		const userTime = Number(userGenre.watchTimeSeconds ?? 0);

		// Get all users' watch time for this genre
		const genreWatchTimes = allUsersGenreStats
			.filter((s) => s.genre === genre)
			.map((s) => Number(s.watchTimeSeconds ?? 0))
			.sort((a, b) => a - b);

		// Calculate percentile
		const usersBelow = genreWatchTimes.filter((t) => t < userTime).length;
		const percentile =
			genreWatchTimes.length > 0
				? Math.round((usersBelow / genreWatchTimes.length) * 100)
				: 0;

		// Calculate server average
		const serverAverage =
			genreWatchTimes.length > 0
				? genreWatchTimes.reduce((a, b) => a + b, 0) / genreWatchTimes.length
				: 0;

		percentiles.push({
			genre,
			userWatchTimeSeconds: userTime,
			serverAverageSeconds: Math.round(serverAverage),
			percentile,
			isTopGenreForUser: genre === userTopGenre,
		});
	}

	return percentiles;
}

export async function getAvailableWrappedYears(
	serverId: number,
	userId: string,
): Promise<number[]> {
	"use cache";
	cacheLife("hours");
	cacheTag(`wrapped-years-${serverId}-${userId}`);

	const { userExclusion } = await getStatisticsExclusions(serverId);

	const whereConditions: SQL[] = [
		eq(sessions.serverId, serverId),
		eq(sessions.userId, userId),
		isNotNull(sessions.startTime),
	];

	if (userExclusion) whereConditions.push(userExclusion);

	const years = await db
		.selectDistinct({
			year: sql<number>`EXTRACT(YEAR FROM ${sessions.startTime})`.as("year"),
		})
		.from(sessions)
		.where(and(...whereConditions))
		.orderBy(desc(sql`EXTRACT(YEAR FROM ${sessions.startTime})`));

	return years.map((y) => Number(y.year)).filter((y) => !Number.isNaN(y));
}

export async function getWrappedData(
	params: WrappedParams,
): Promise<WrappedData> {
	"use cache";
	getCacheLifeForYear(params.year);
	cacheTag(`wrapped-data-${params.serverId}-${params.userId}-${params.year}`);

	// Get user name
	const user = await db.query.users.findFirst({
		where: and(
			eq(users.id, params.userId),
			eq(users.serverId, params.serverId),
		),
		columns: { name: true },
	});

	// Fetch all data in parallel
	const [
		overview,
		topItems,
		genres,
		peopleStats,
		activityPatterns,
		typeBreakdown,
		rewatchStats,
		genrePercentiles,
	] = await Promise.all([
		getWrappedOverview(params),
		getWrappedTopItems(params),
		getWrappedGenreStats(params),
		getWrappedPeopleStats(params),
		getWrappedActivityPatterns(params),
		getWrappedTypeBreakdown(params),
		getWrappedRewatchStats(params),
		getWrappedGenrePercentiles(params),
	]);

	return {
		year: params.year,
		userId: params.userId,
		userName: user?.name ?? "User",
		generatedAt: new Date().toISOString(),
		overview,
		topItems,
		genres,
		people: peopleStats,
		activityPatterns,
		typeBreakdown,
		rewatchStats,
		genrePercentiles,
	};
}
