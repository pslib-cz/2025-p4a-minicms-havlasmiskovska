# Health Dashboard – Jetpack Compose Architecture

A mobile health analytics app for tracking stress, body battery, and respiration metrics with important life event annotations and impact analysis. No authentication required — single local user.

---

## Data Model

### Local Database (Room)

**User** (single row, hardcoded or auto-created on first launch)

- `userProfilePK: Int` — primary key linking all metric data

**Stress** (immutable, seeded from CSV)

- PK: `(pk_date, userProfilePK)`
- Fields: `awake_averageStressLevel (Float)`, `awake_maxStressLevel (Float)`, `awake_totalStressCount (Int)`, `awake_highDuration (Int)`, `awake_mediumDuration (Int)`, `awake_lowDuration (Int)`, `awake_restDuration (Int)`, `awake_stressDuration (Int)`, `awake_averageStressLevelIntensity (Float)`, `awake_totalStressIntensity (Float)`
- Same set of fields with `asleep_` prefix for sleep-period metrics

**Respiration** (immutable, seeded from CSV)

- PK: `(pk_date, userProfilePK)`
- Fields: `avgWakingRespirationValue (Float)`, `highestRespirationValue (Float)`, `lowestRespirationValue (Float)`

**BodyBattery** (immutable, seeded from CSV)

- PK: `(pk_date, userProfilePK)`
- Fields: `chargedValue (Int)`, `drainedValue (Int)`, `highest_statsValue (Int)`, `lowest_statsValue (Int)`, `highest_statTimestamp (Long)`, `lowest_statTimestamp (Long)`, `sleepstart_statsValue (Int)`, `sleepend_statsValue (Int)`

**ImportantEvent** (user-created, full CRUD)

- `id: String` (UUID)
- `userProfilePK: Int`
- `name: String`
- `title: String`
- `slug: String` (unique, auto-generated from title)
- `tags: List<String>`
- `expectedEffect: Enum(POSITIVE, NEGATIVE)`
- `visibility: Enum(PUBLISHED, NOT_PUBLIC, PRIVATE)`
- `startDate: LocalDate`
- `endDate: LocalDate?` (nullable)
- `descriptionHtml: String` (rich text stored as HTML)
- `publishDate: LocalDate?`
- `createdAt: Long` (timestamp)
- `updatedAt: Long` (timestamp)

**Category** (auto-managed via tags)

- `id: String` (UUID)
- `name: String`
- `slug: String` (unique)
- Many-to-many with ImportantEvent via cross-ref table `EventCategoryCrossRef(eventId, categoryId)`

---

## Navigation Structure

Use Jetpack Navigation Compose with a bottom navigation bar.

### Bottom Navigation Items

| Item         | Route                 | Icon           |
| ------------ | --------------------- | -------------- |
| Dashboard    | `dashboard`           | Home/Dashboard |
| Events       | `events`              | Calendar/Star  |
| Stress       | `metric/stress`       | Activity       |
| Body Battery | `metric/body-battery` | Battery        |
| Respiration  | `metric/respiration`  | Wind/Lungs     |

### Full Route Graph

```
dashboard
metric/{slug}                  — slug: stress | body-battery | respiration
events                         — event list with search + pagination
events/new                     — create new event
events/{id}                    — event detail + impact analysis
events/{id}/edit               — edit existing event
```

---

## Screens

### 1. Dashboard (`dashboard`)

**Purpose:** Landing screen showing a combined overview of all three health metrics.

**Data:**

- Load ALL Stress, Respiration, and BodyBattery records for the user
- Load ALL ImportantEvents for event markers

**UI Elements:**

- Combined chart (all 3 metrics normalized to 0–100% on same chart)
- Individual summary charts for each metric (stress avg, respiration avg, body battery highest)
- Event markers displayed as vertical dashed lines on charts

**ViewModel State:**

```kotlin
data class DashboardState(
    val stressPoints: List<MetricPoint>,        // date → awake_averageStressLevel
    val respirationPoints: List<MetricPoint>,   // date → avgWakingRespirationValue
    val bodyBatteryPoints: List<MetricPoint>,   // date → highest_statsValue
    val events: List<EventMarker>,              // id, name, startDate, effect
    val isLoading: Boolean
)

data class MetricPoint(val date: LocalDate, val value: Float?)
data class EventMarker(val id: String, val name: String, val startDate: LocalDate, val effect: Effect)
```

**Charts:**

- `CombinedChart` composable: overlays all 3 series, each independently min/max normalized to 0–100
- Each series has its own color
- Event markers as vertical dashed lines (green=positive, red=negative)
- Moving average smoothing (window=7 for 1-year view, window=21 for all-time)

---

### 2. Metric Detail (`metric/{slug}`)

**Purpose:** Detailed view of a single health metric with additional sub-charts.

**Slug Variants & Their Charts:**

**`stress`**

- Primary: awake average stress level over time
- Additional charts: max stress level, stress intensity, stress duration
- Color: red tones

**`body-battery`**

- Primary: highest body battery value over time
- Additional charts: charged value, drained value, lowest value
- Color: green tones

**`respiration`**

- Primary: average waking respiration over time
- Additional charts: highest respiration, lowest respiration
- Color: blue tones

**Data:**

- All records of the relevant metric table for the user
- All ImportantEvents for event markers

**ViewModel State:**

```kotlin
data class MetricDetailState(
    val slug: String,
    val primaryChart: ChartData,
    val additionalCharts: List<ChartData>,
    val combinedSeries: List<CombinedSeries>,  // all 3 metrics for combined chart
    val events: List<EventMarker>,
    val isLoading: Boolean
)

data class ChartData(
    val label: String,
    val points: List<MetricPoint>,
    val colorStart: Color,
    val colorEnd: Color,
    val smoothingWindow: Int    // default 7
)

data class CombinedSeries(
    val label: String,
    val points: List<MetricPoint>,
    val color: Color
)
```

**UI Elements:**

- `MetricChart` composable for each chart: draws raw data line (faint) + smoothed moving average line (colored gradient)
- `CombinedChart` at the bottom showing all 3 metrics normalized together
- Vertical event markers on all charts
- Scrollable column of charts

**Chart Rendering Logic (shared):**

- Moving average: sliding window of N days, average non-null values
- Y-axis: min/max value scaling
- X-axis ticks: if span > 550 days → yearly labels; if span ≤ 90 days → monthly; otherwise quarterly
- Raw data drawn as faint gray line, smoothed data as gradient-colored line

---

### 3. Events List (`events`)

**Purpose:** Searchable, paginated list of all important events with create/delete actions.

**Data:**

- Paginated query: `SELECT * FROM ImportantEvent WHERE name/tags LIKE %search% ORDER BY startDate DESC LIMIT pageSize OFFSET (page-1)*pageSize`
- Page size: 10

**ViewModel State:**

```kotlin
data class EventsListState(
    val events: List<EventRow>,
    val search: String,
    val page: Int,
    val totalPages: Int,
    val total: Int,
    val isLoading: Boolean,
    val deleteTarget: EventRow?,       // event pending delete confirmation
    val isDeleting: Boolean
)

data class EventRow(
    val id: String,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate?,
    val tags: List<String>,
    val expectedEffect: Effect,
    val visibility: Visibility,
    val descriptionHtml: String,
    val categories: List<Category>
)
```

**UI Elements:**

- Search bar at top (filters by name and tags, case-insensitive)
- "New Event" FAB or button → navigates to `events/new`
- LazyColumn of event cards, each showing:
    - Event name
    - Date range (startDate – endDate or just startDate)
    - Tags as small chips/pills
    - Expected effect badge (Positive = green, Negative = red)
    - Visibility badge (Published / Not Public / Private)
    - Description preview (HTML rendered, truncated to ~3 lines)
- Each card is tappable → navigates to `events/{id}`
- Swipe-to-delete or long-press menu with delete option
- Delete confirmation dialog
- Pagination controls (previous/next) at bottom

**Actions:**

- Search: updates query, resets to page 1, re-fetches
- Delete: removes event from DB, refreshes list
- Navigate: to detail, edit, or create

---

### 4. Create Event (`events/new`)

**Purpose:** Form to create a new important event.

**ViewModel State:**

```kotlin
data class CreateEventState(
    val name: String,
    val tags: String,               // comma-separated input
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val expectedEffect: Effect,     // default POSITIVE
    val visibility: Visibility,     // default PRIVATE
    val descriptionHtml: String,
    val isSaving: Boolean,
    val error: String?
)
```

**UI Elements:**

- Text field: Name (required)
- Text field: Tags (comma-separated, e.g. "relationship, school, free time")
- Date picker: Start date (required)
- Date picker: End date (optional)
- Dropdown/SegmentedButton: Expected effect (Positive / Negative)
- Dropdown/SegmentedButton: Visibility (Published / Not Public / Private)
- Rich text editor for description (HTML)
    - For mobile: use a simplified Markdown or basic HTML editor, or a WebView-based WYSIWYG
    - Minimum description length: 5 characters of plain text
- Save button

**Validation:**

- Name is required, non-empty
- Start date is required
- If end date is provided, it must be ≥ start date
- Description must have ≥ 5 characters of text content (strip HTML tags to check)

**On Submit:**

1. Parse tags string → `List<String>` (split by comma, trim each)
2. Generate slug from title: lowercase, remove accents, replace non-alphanumeric with `-`, deduplicate dashes
3. If slug already exists, append random suffix (try up to 10 times, then fallback to `slug-timestamp`)
4. Create ImportantEvent record in Room
5. For each tag: find or create Category by slug, link via cross-ref table
6. Navigate back to `events` list

---

### 5. Event Detail (`events/{id}`)

**Purpose:** Full event information + impact analysis showing how the event correlated with health metric changes.

**Data:**

- Load ImportantEvent by ID (with categories)
- Load ALL Stress, Respiration, BodyBattery records for the user
- Compute impact analysis (see algorithm below)

**ViewModel State:**

```kotlin
data class EventDetailState(
    val event: ImportantEvent?,
    val impacts: List<MetricImpact>,
    val charts: List<ChartData>,        // metric charts with this event highlighted
    val hasConflictingSignals: Boolean,
    val isLoading: Boolean
)

data class MetricImpact(
    val metricName: String,             // "Stress", "Respiration", "Body Battery"
    val shortTerm: HorizonResult,       // 1–7 days after event
    val mediumTerm: HorizonResult,      // 8–30 days after event
    val longTerm: HorizonResult         // 31+ days after event
)

data class HorizonResult(
    val label: String,                  // "Short-term", "Medium-term", "Long-term"
    val percentChange: Float,
    val zScore: Float?,                 // only for medium-term
    val interpretation: String,         // human-readable summary
    val hasEnoughData: Boolean
)
```

**Impact Analysis Algorithm:**
For each metric (stress, respiration, body battery):

1. **Baseline**: average of all metric values BEFORE event start date
2. **Short-term** (1–7 days post-event): average values in this window → `percentChange = ((shortTermAvg - baseline) / baseline) * 100`
3. **Medium-term** (8–30 days post-event): average values → same percent change + z-score = `(mediumTermAvg - baseline) / stdDevPreEvent`
4. **Long-term** (31+ days post-event): average values → percent change

**Conflicting signals**: flagged when different metrics show opposite directions (e.g., stress went up but body battery also went up)

**Interpretation text examples:**

- "+5.2% increase in stress (short-term)"
- "z-score 1.8: notable deviation from baseline (medium-term)"
- "No significant change (long-term)"

**UI Elements:**

- Event header: name, date range, tags as chips, expected effect badge, visibility badge
- Visibility selector dropdown (can change between PUBLISHED / NOT_PUBLIC / PRIVATE, saves immediately)
- "Edit" button → navigates to `events/{id}/edit`
- Impact Analysis section:
    - For each metric: card showing short/medium/long term results
    - Color-coded: green for improvement, red for worsening (context-dependent per metric)
    - Conflicting signals warning banner if detected
- Charts: MetricChart for each metric with this event marked as a highlighted vertical line
- "Event Days" section listing the covered date range

---

### 6. Edit Event (`events/{id}/edit`)

**Purpose:** Pre-populated form to edit an existing event.

**Data:**

- Load ImportantEvent by ID

**ViewModel State:**
Same as CreateEventState but pre-filled from existing event, plus `eventId: String`.

**UI Elements:**
Same form as Create Event, pre-populated with existing values.

**On Submit:**

1. Validate same rules as create
2. If name changed, regenerate slug (check uniqueness excluding current event ID)
3. Update ImportantEvent in Room
4. Rebuild category links (disconnect old, connect/create new)
5. Navigate back to `events/{id}` detail page

---

## Shared Composables

### `MetricChart`

Single-metric line chart drawn on Canvas.

```kotlin
@Composable
fun MetricChart(
    points: List<MetricPoint>,
    metricLabel: String,
    smoothingWindow: Int = 7,
    colorStart: Color,
    colorEnd: Color,
    events: List<EventMarker> = emptyList()
)
```

**Rendering:**

- Canvas-based (Jetpack Compose `Canvas` or a charting library like Vico/YCharts)
- Raw data: faint gray line connecting all non-null points
- Smoothed data: colored gradient line (moving average of `smoothingWindow` days)
- X-axis: date labels (monthly/quarterly/yearly depending on data span)
- Y-axis: min to max value range
- Event markers: vertical dashed lines with small labels

### `CombinedChart`

Multi-metric overlay chart with independent normalization.

```kotlin
@Composable
fun CombinedChart(
    series: List<CombinedSeries>,
    chartLabel: String,
    smoothingWindow: Int = 7,
    events: List<EventMarker> = emptyList()
)
```

**Rendering:**

- Each series independently normalized to 0–100 range (so different scales are comparable)
- Each series drawn as a separate colored line
- Legend showing series labels + colors
- Event markers: dashed vertical lines (green for positive, red for negative effects)

### Moving Average Algorithm

```
fun movingAverage(points: List<MetricPoint>, window: Int): List<MetricPoint> {
    // For each point, average the values of the surrounding `window` points
    // Skip null values in the window
    // Return smoothed points with same dates
}
```

### Slug Generation

```
fun generateSlug(title: String): String {
    // Lowercase
    // Remove diacritics/accents (Normalizer.normalize → NFD, strip combining marks)
    // Replace non-alphanumeric with "-"
    // Collapse multiple dashes
    // Trim leading/trailing dashes
}
```

---

## Data Seeding

On first app launch, seed the Room database from bundled CSV assets:

- `assets/body_battery.csv` → BodyBattery table
- `assets/respiration.csv` → Respiration table
- `assets/stress.csv` → Stress table

Use a `RoomDatabase.Callback` on `onCreate` to parse CSVs and bulk-insert. The user profile PK should be hardcoded to match the CSV data (e.g., `104768835`).

Sample seed events to pre-populate:

- "GF" (2025-12-11, Positive, Published, tags: [relationship, free time])
- "Konec s Dukliu" (2025-03-31, Negative, Not Public, tags: [free time])
- "First day on high school" (2022-09-04, Negative, Published, tags: [school])

---

## Recommended Architecture Stack

| Layer        | Technology                                        |
| ------------ | ------------------------------------------------- |
| UI           | Jetpack Compose                                   |
| Navigation   | Navigation Compose                                |
| State        | ViewModel + StateFlow                             |
| DI           | Hilt                                              |
| Database     | Room                                              |
| Charts       | Canvas API or Vico library                        |
| Rich Text    | WebView-based editor or simplified Markdown input |
| Date Pickers | Material3 DatePicker                              |
| CSV Parsing  | OpenCSV or manual BufferedReader                  |

---

## ViewModel Summary

| Screen        | ViewModel               | Repository Dependencies                                 |
| ------------- | ----------------------- | ------------------------------------------------------- |
| Dashboard     | `DashboardViewModel`    | StressRepo, RespirationRepo, BodyBatteryRepo, EventRepo |
| Metric Detail | `MetricDetailViewModel` | StressRepo, RespirationRepo, BodyBatteryRepo, EventRepo |
| Events List   | `EventsListViewModel`   | EventRepo                                               |
| Create Event  | `CreateEventViewModel`  | EventRepo, CategoryRepo                                 |
| Event Detail  | `EventDetailViewModel`  | EventRepo, StressRepo, RespirationRepo, BodyBatteryRepo |
| Edit Event    | `EditEventViewModel`    | EventRepo, CategoryRepo                                 |

Each ViewModel exposes a single `StateFlow<ScreenState>` and action methods. Repositories wrap Room DAOs and handle data transformations.
