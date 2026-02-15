/**
 * Holiday/Season configuration for contextual recommendations.
 * Date ranges include lead time before the actual holiday.
 */

export type DateRange = {
  startMonth: number; // 1-12
  startDay: number; // 1-31
  endMonth: number; // 1-12
  endDay: number; // 1-31
};

export type Holiday = {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  description: string;
  dateRanges: DateRange[]; // Can span year boundaries or have multiple ranges
  keywords: string[]; // Match in name, overview
  genres: string[]; // Match in genres array
  priority: number; // Higher = more specific, takes precedence
};

function getChineseZodiacAnimal(year: number): string {
  const animals = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
  return animals[(year - 4) % 12];
}

export const HOLIDAYS: Holiday[] = [
  // =============================================================================
  // Pop Culture Days (High Priority - Very Specific)
  // =============================================================================
  {
    id: "star-wars-day",
    name: "May the 4th",
    icon: "Sparkles",
    description: "May the Force be with you",
    dateRanges: [{ startMonth: 5, startDay: 1, endMonth: 5, endDay: 5 }],
    keywords: [
      "star wars",
      "jedi",
      "sith",
      "skywalker",
      "mandalorian",
      "darth vader",
      "luke skywalker",
      "yoda",
      "force awakens",
      "empire strikes",
      "new hope",
      "clone wars",
      "boba fett",
      "grogu",
      "baby yoda",
      "lightsaber",
      "galactic",
    ],
    genres: [],
    priority: 100,
  },
  {
    id: "pi-day",
    name: "Pi Day",
    icon: "Calculator",
    description: "Celebrate math and science",
    dateRanges: [{ startMonth: 3, startDay: 12, endMonth: 3, endDay: 15 }],
    keywords: [
      "mathematics",
      "scientist",
      "genius",
      "equation",
      "physics",
      "quantum",
      "theory",
      "professor",
      "nasa",
      "space exploration",
    ],
    genres: ["Science Fiction", "Documentary"],
    priority: 90,
  },
  {
    id: "back-to-the-future-day",
    name: "Back to the Future Day",
    icon: "Clock",
    description: "Great Scott!",
    dateRanges: [{ startMonth: 10, startDay: 19, endMonth: 10, endDay: 22 }],
    keywords: [
      "back to the future",
      "time travel",
      "delorean",
      "marty mcfly",
      "doc brown",
      "flux capacitor",
    ],
    genres: [],
    priority: 95,
  },
  {
    id: "alien-day",
    name: "Alien Day",
    icon: "Bug",
    description: "In space, no one can hear you scream",
    dateRanges: [{ startMonth: 4, startDay: 24, endMonth: 4, endDay: 27 }],
    keywords: [
      "alien",
      "xenomorph",
      "ripley",
      "prometheus",
      "predator",
      "facehugger",
    ],
    genres: [],
    priority: 90,
  },
  {
    id: "batman-day",
    name: "Batman Day",
    icon: "Moon",
    description: "The Dark Knight rises",
    dateRanges: [{ startMonth: 9, startDay: 14, endMonth: 9, endDay: 17 }],
    keywords: [
      "batman",
      "gotham",
      "dark knight",
      "bruce wayne",
      "joker",
      "catwoman",
      "robin",
      "batgirl",
      "arkham",
    ],
    genres: [],
    priority: 90,
  },
  {
    id: "tolkien-reading-day",
    name: "Tolkien Reading Day",
    icon: "BookOpen",
    description: "Journey through Middle-earth",
    dateRanges: [{ startMonth: 3, startDay: 23, endMonth: 3, endDay: 26 }],
    keywords: [
      "lord of the rings",
      "hobbit",
      "middle earth",
      "frodo",
      "gandalf",
      "mordor",
      "tolkien",
      "rings of power",
      "sauron",
      "aragorn",
      "legolas",
    ],
    genres: [],
    priority: 90,
  },

  // =============================================================================
  // Major Holidays (High Priority)
  // =============================================================================
  {
    id: "christmas",
    name: "Christmas",
    icon: "Gift",
    description: "Tis the season for holiday classics",
    dateRanges: [{ startMonth: 12, startDay: 1, endMonth: 12, endDay: 26 }],
    keywords: [
      // Strong title keywords (specific to Christmas)
      "christmas",
      "xmas",
      "santa claus",
      "north pole",
      "scrooge",
      "grinch",
      "nutcracker",
      "home alone",
      "wonderful life",
      "miracle on 34th",
      "polar express",
      "die hard",
      "bad santa",
      "elf movie",
      "jingle",
      "rudolph",
      "frosty the snowman",
      "a christmas carol",
      "nightmare before christmas",
      "love actually",
      "the holiday",
      "klaus",
      "krampus",
      "gremlins",
      "nativity",
    ],
    genres: ["Holiday", "Christmas"],
    priority: 85,
  },
  {
    id: "halloween",
    name: "Halloween",
    icon: "Ghost",
    description: "Spooky season is here",
    dateRanges: [{ startMonth: 10, startDay: 15, endMonth: 11, endDay: 1 }],
    keywords: [
      "halloween",
      "horror",
      "scary",
      "monster",
      "zombie",
      "vampire",
      "witch",
      "ghost",
      "haunted",
      "demon",
      "nightmare",
      "slasher",
      "possessed",
      "exorcist",
      "frankenstein",
      "dracula",
      "werewolf",
      "pumpkin",
    ],
    genres: ["Horror", "Thriller"],
    priority: 80,
  },
  {
    id: "valentines-day",
    name: "Valentine's Day",
    icon: "Heart",
    description: "Love is in the air",
    dateRanges: [{ startMonth: 2, startDay: 7, endMonth: 2, endDay: 15 }],
    keywords: [
      "love",
      "romance",
      "valentine",
      "wedding",
      "romantic",
      "proposal",
      "soulmate",
      "cupid",
      "heart",
      "kiss",
      "dating",
    ],
    genres: ["Romance", "Romantic Comedy"],
    priority: 75,
  },
  {
    id: "st-patricks-day",
    name: "St. Patrick's Day",
    icon: "Clover",
    description: "Luck of the Irish",
    dateRanges: [{ startMonth: 3, startDay: 14, endMonth: 3, endDay: 18 }],
    keywords: [
      "irish",
      "ireland",
      "dublin",
      "leprechaun",
      "shamrock",
      "celtic",
      "st patrick",
    ],
    genres: [],
    priority: 70,
  },
  {
    id: "easter",
    name: "Easter",
    icon: "Egg",
    description: "Spring has sprung",
    dateRanges: [{ startMonth: 3, startDay: 20, endMonth: 4, endDay: 25 }],
    keywords: [
      "easter",
      "bunny",
      "resurrection",
      "spring",
      "eggs",
      "religious",
      "faith",
      "miracle",
    ],
    genres: ["Family", "Faith"],
    priority: 70,
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    icon: "UtensilsCrossed",
    description: "Gather round for family favorites",
    dateRanges: [{ startMonth: 11, startDay: 20, endMonth: 11, endDay: 29 }],
    keywords: [
      "thanksgiving",
      "turkey",
      "family gathering",
      "gratitude",
      "pilgrim",
      "harvest",
      "feast",
    ],
    genres: ["Family", "Comedy"],
    priority: 75,
  },
  {
    id: "new-years",
    name: "New Year's",
    icon: "PartyPopper",
    description: "Ring in the new year",
    dateRanges: [
      { startMonth: 12, startDay: 28, endMonth: 12, endDay: 31 },
      { startMonth: 1, startDay: 1, endMonth: 1, endDay: 3 },
    ],
    keywords: [
      "new year",
      "resolution",
      "midnight",
      "countdown",
      "celebration",
      "party",
      "champagne",
    ],
    genres: [],
    priority: 72,
  },
  {
    id: "independence-day",
    name: "Independence Day",
    icon: "Flag",
    description: "Celebrate freedom",
    dateRanges: [{ startMonth: 7, startDay: 1, endMonth: 7, endDay: 5 }],
    keywords: [
      "independence",
      "fourth of july",
      "america",
      "patriot",
      "freedom",
      "fireworks",
      "revolution",
      "founding fathers",
    ],
    genres: ["Action", "War"],
    priority: 70,
  },
  {
    id: "lunar-new-year",
    name: "Lunar New Year",
    icon: "Moon",
    get description() {
      return `Celebrate the Year of the ${getChineseZodiacAnimal(new Date().getFullYear())}`;
    },
    dateRanges: [{ startMonth: 1, startDay: 20, endMonth: 2, endDay: 15 }],
    keywords: [
      "chinese new year",
      "lunar",
      "asia",
      "chinese",
      "korean",
      "vietnamese",
      "dynasty",
      "martial arts",
      "kung fu",
    ],
    genres: ["Martial Arts", "Action"],
    priority: 70,
  },
  {
    id: "diwali",
    name: "Diwali",
    icon: "Flame",
    description: "Festival of Lights",
    dateRanges: [{ startMonth: 10, startDay: 25, endMonth: 11, endDay: 15 }],
    keywords: [
      "diwali",
      "india",
      "bollywood",
      "hindu",
      "lights",
      "indian",
      "mumbai",
      "delhi",
    ],
    genres: ["Bollywood"],
    priority: 70,
  },
  {
    id: "hanukkah",
    name: "Hanukkah",
    icon: "Sparkles",
    description: "Festival of Lights",
    dateRanges: [{ startMonth: 12, startDay: 1, endMonth: 12, endDay: 31 }],
    keywords: [
      "hanukkah",
      "chanukah",
      "jewish",
      "menorah",
      "dreidel",
      "israel",
      "hebrew",
    ],
    genres: [],
    priority: 65,
  },

  // =============================================================================
  // Awareness Months (Medium Priority)
  // =============================================================================
  {
    id: "pride-month",
    name: "Pride Month",
    icon: "Rainbow",
    description: "Celebrate love and identity",
    dateRanges: [{ startMonth: 6, startDay: 1, endMonth: 6, endDay: 30 }],
    keywords: [
      "pride",
      "lgbtq",
      "queer",
      "coming out",
      "gay",
      "lesbian",
      "transgender",
      "bisexual",
      "drag",
      "rainbow",
    ],
    genres: ["LGBTQ", "Drama"],
    priority: 60,
  },
  {
    id: "black-history-month",
    name: "Black History Month",
    icon: "Users",
    description: "Celebrating Black excellence",
    dateRanges: [{ startMonth: 2, startDay: 1, endMonth: 2, endDay: 28 }],
    keywords: [
      "civil rights",
      "slavery",
      "african american",
      "black history",
      "segregation",
      "mlk",
      "martin luther king",
      "rosa parks",
      "malcolm x",
    ],
    genres: ["History", "Drama"],
    priority: 55,
  },
  {
    id: "womens-history-month",
    name: "Women's History Month",
    icon: "User",
    description: "Celebrating women who made history",
    dateRanges: [{ startMonth: 3, startDay: 1, endMonth: 3, endDay: 31 }],
    keywords: [
      "women",
      "feminist",
      "suffrage",
      "empowerment",
      "women's rights",
      "equality",
      "pioneer",
      "trailblazer",
    ],
    genres: ["Drama", "Biography"],
    priority: 50,
  },
  {
    id: "hispanic-heritage-month",
    name: "Hispanic Heritage Month",
    icon: "Globe",
    description: "Celebrating Hispanic and Latino culture",
    dateRanges: [{ startMonth: 9, startDay: 15, endMonth: 10, endDay: 15 }],
    keywords: [
      "hispanic",
      "latino",
      "latina",
      "mexico",
      "spanish",
      "latin america",
      "caribbean",
      "salsa",
    ],
    genres: [],
    priority: 50,
  },

  // =============================================================================
  // Fun Days (Medium Priority)
  // =============================================================================
  {
    id: "friday-the-13th",
    name: "Friday the 13th",
    icon: "Skull",
    description: "Unlucky for some...",
    dateRanges: [], // Special handling - only active on actual Friday the 13th
    keywords: [
      "friday the 13th",
      "jason",
      "voorhees",
      "slasher",
      "camp crystal lake",
      "superstition",
      "unlucky",
    ],
    genres: ["Horror", "Slasher"],
    priority: 85,
  },
  {
    id: "april-fools",
    name: "April Fools' Day",
    icon: "Laugh",
    description: "Time for laughs",
    dateRanges: [{ startMonth: 3, startDay: 30, endMonth: 4, endDay: 2 }],
    keywords: [
      "comedy",
      "prank",
      "funny",
      "hilarious",
      "joke",
      "fool",
      "laugh",
      "spoof",
      "parody",
      "satire",
    ],
    genres: ["Comedy"],
    priority: 65,
  },
  {
    id: "earth-day",
    name: "Earth Day",
    icon: "Globe",
    description: "Celebrate our planet",
    dateRanges: [{ startMonth: 4, startDay: 20, endMonth: 4, endDay: 23 }],
    keywords: [
      "earth",
      "environment",
      "nature",
      "climate",
      "wildlife",
      "ocean",
      "forest",
      "conservation",
      "planet",
      "ecology",
    ],
    genres: ["Documentary", "Nature"],
    priority: 60,
  },
  {
    id: "shark-week",
    name: "Shark Week",
    icon: "Fish",
    description: "Dive into shark territory",
    dateRanges: [{ startMonth: 7, startDay: 20, endMonth: 7, endDay: 31 }],
    keywords: [
      "shark",
      "jaws",
      "ocean",
      "deep blue sea",
      "megalodon",
      "great white",
    ],
    genres: ["Documentary", "Thriller"],
    priority: 70,
  },
];

/**
 * Check if a date falls within a date range.
 * Handles year boundaries (e.g., Dec 28 - Jan 3).
 */
function isDateInRange(date: Date, range: DateRange): boolean {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Simple case: range doesn't cross year boundary
  if (
    range.startMonth < range.endMonth ||
    (range.startMonth === range.endMonth && range.startDay <= range.endDay)
  ) {
    if (month < range.startMonth || month > range.endMonth) return false;
    if (month === range.startMonth && day < range.startDay) return false;
    if (month === range.endMonth && day > range.endDay) return false;
    return true;
  }

  // Range crosses year boundary (e.g., Dec 28 - Jan 3)
  // In range if: (month >= startMonth && day >= startDay) OR (month <= endMonth && day <= endDay)
  if (
    month > range.startMonth ||
    (month === range.startMonth && day >= range.startDay)
  ) {
    return true;
  }
  if (
    month < range.endMonth ||
    (month === range.endMonth && day <= range.endDay)
  ) {
    return true;
  }

  return false;
}

/**
 * Check if today is Friday the 13th.
 */
function isFridayThe13th(date: Date): boolean {
  return date.getDate() === 13 && date.getDay() === 5;
}

/**
 * Get all holidays that are currently active.
 * Returns them sorted by priority (highest first).
 */
export function getActiveHolidays(date: Date = new Date()): Holiday[] {
  const active: Holiday[] = [];

  for (const holiday of HOLIDAYS) {
    // Special case for Friday the 13th
    if (holiday.id === "friday-the-13th") {
      if (isFridayThe13th(date)) {
        active.push(holiday);
      }
      continue;
    }

    // Check if date falls within any of the holiday's date ranges
    for (const range of holiday.dateRanges) {
      if (isDateInRange(date, range)) {
        active.push(holiday);
        break;
      }
    }
  }

  // Sort by priority (highest first)
  return active.sort((a, b) => b.priority - a.priority);
}

/**
 * Get the highest priority active holiday.
 * Returns null if no holiday is currently active.
 */
export function getActiveHoliday(date: Date = new Date()): Holiday | null {
  const active = getActiveHolidays(date);
  return active.length > 0 ? active[0] : null;
}

/**
 * Get a holiday by its ID.
 */
export function getHolidayById(id: string): Holiday | undefined {
  return HOLIDAYS.find((h) => h.id === id);
}
