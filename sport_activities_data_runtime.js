(function () {
  var STORAGE_KEY = 'sportActivitiesDashboardUploadedDataV1';
  var MONTH_INDEX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var CARD_META = [
    { key: 'swim', name: 'Swim', emoji: '🏊', color: '#00bfff', link: 'swim_dashboard.html' },
    { key: 'walk_run', name: 'Walk & Run', emoji: '🚶', color: '#22c55e', link: 'walk_run_dashboard.html' },
    { key: 'ride', name: 'Ride', emoji: '🚴', color: '#ff9500', link: 'ride_dashboard.html' },
    { key: 'rowing', name: 'Rowing', emoji: '🚣', color: '#a78bfa', link: 'rowing_dashboard.html' },
    { key: 'workout', name: 'Workout', emoji: '💪', color: '#ef4444', link: 'workout_dashboard.html' },
    { key: 'hike', name: 'Hike', emoji: '🥾', color: '#eab308', link: 'hike_dashboard.html' },
    { key: 'other', name: 'Other', emoji: '📍', color: '#64748b', link: 'other_dashboard.html' }
  ];
  var pinLookupCache = {};

  function round(value, digits) {
    var factor = Math.pow(10, digits == null ? 2 : digits);
    return Math.round((value || 0) * factor) / factor;
  }

  function num(value) {
    if (value == null || value === '') return 0;
    var parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function numOrNull(value) {
    if (value == null || value === '') return null;
    var parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseActivityDate(value) {
    if (!value) return null;
    var match = String(value).match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})/);
    if (!match) return null;
    var month = MONTH_INDEX[match[1]];
    if (month == null) return null;
    var day = Number(match[2]);
    var year = Number(match[3]);
    var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    return {
      year: year,
      iso: iso,
      month: iso.slice(0, 7),
      label: MONTH_NAMES[month] + ' ' + String(day).padStart(2, '0') + ', ' + year,
      dow: DOW_NAMES[new Date(Date.UTC(year, month, day)).getUTCDay()]
    };
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i;
    for (i = 0; i < text.length; i += 1) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    if (!rows.length) return [];

    var headers = rows.shift();
    return rows.filter(function (cols) {
      return cols.some(function (value) { return value !== ''; });
    }).map(function (cols) {
      var record = {};
      headers.forEach(function (header, index) {
        record[header] = cols[index] || '';
      });
      return record;
    });
  }

  function activityCategory(type) {
    if (type === 'Swim') return 'swim';
    if (type === 'Walk' || type === 'Run') return 'walk_run';
    if (type === 'Ride') return 'ride';
    if (type === 'Rowing') return 'rowing';
    if (type === 'Workout') return 'workout';
    if (type === 'Hike') return 'hike';
    return 'other';
  }

  function sortByDateDesc(a, b) {
    if (a.date_iso === b.date_iso) return (a.name || '').localeCompare(b.name || '');
    return a.date_iso < b.date_iso ? 1 : -1;
  }

  function buildActivity(record) {
    var date = parseActivityDate(record['Activity Date']);
    if (!date) return null;

    var type = record['Activity Type'] || record.Type || 'Other';
    var distanceM = num(record.Distance);
    var movingTime = num(record['Moving Time']) || num(record['Elapsed Time']);
    var elapsedTime = num(record['Elapsed Time']) || movingTime;
    var avgSpeedMps = numOrNull(record['Average Speed']);
    var maxSpeedMps = numOrNull(record['Max Speed']);

    if (avgSpeedMps == null && distanceM > 0 && movingTime > 0) {
      avgSpeedMps = distanceM / movingTime;
    }

    return {
      activity_type: type,
      category: activityCategory(type),
      name: record['Activity Name'] || type,
      date: date.label,
      date_iso: date.iso,
      year: date.year,
      month: date.month,
      dow: date.dow,
      distance_m: distanceM,
      distance_km: round(distanceM / 1000, 2),
      moving_time_s: movingTime,
      elapsed_time_s: elapsedTime,
      time_min: Math.round(movingTime / 60),
      avg_speed_mps: avgSpeedMps,
      max_speed_mps: maxSpeedMps,
      avg_speed_kmh: avgSpeedMps == null ? null : round(avgSpeedMps * 3.6, 2),
      max_speed_kmh: maxSpeedMps == null ? null : round(maxSpeedMps * 3.6, 2),
      elevation_m: num(record['Elevation Gain']),
      avg_hr: numOrNull(record['Average Heart Rate']),
      max_hr: numOrNull(record['Max Heart Rate']),
      calories: numOrNull(record.Calories),
      effort: numOrNull(record['Relative Effort']),
      avg_cadence: numOrNull(record['Average Cadence']),
      filename: record.Filename || ''
    };
  }

  function cardStats(activities) {
    if (!activities.length) {
      return {
        count: 0,
        total_distance_km: 0,
        avg_distance_km: 0,
        total_time_s: 0,
        total_time_hours: 0,
        date_min: '--',
        date_max: '--',
        date_range: '--'
      };
    }

    var sorted = activities.slice().sort(function (a, b) {
      return a.date_iso < b.date_iso ? -1 : 1;
    });
    var totalDistanceM = activities.reduce(function (sum, item) { return sum + item.distance_m; }, 0);
    var totalTimeS = activities.reduce(function (sum, item) { return sum + item.moving_time_s; }, 0);
    return {
      count: activities.length,
      total_distance_km: round(totalDistanceM / 1000, 1),
      avg_distance_km: round(activities.length ? (totalDistanceM / 1000) / activities.length : 0, 2),
      total_time_s: Math.round(totalTimeS),
      total_time_hours: round(totalTimeS / 3600, 1),
      date_min: sorted[0].date,
      date_max: sorted[sorted.length - 1].date,
      date_range: sorted[0].date + ' - ' + sorted[sorted.length - 1].date
    };
  }

  function makePinKey(date, name, type, distKm) {
    var distKey = distKm == null ? '' : round(distKm, 2).toFixed(2);
    return [date || '', name || '', type || '', distKey].join('|');
  }

  function getBundledPinLookup(category) {
    if (pinLookupCache[category]) return pinLookupCache[category];
    var lookup = {};
    var bundled = window.ACTIVITY_DASHBOARD_DATA && window.ACTIVITY_DASHBOARD_DATA[category];
    if (!bundled || !Array.isArray(bundled.recent) || !Array.isArray(bundled.pins)) {
      pinLookupCache[category] = lookup;
      return lookup;
    }

    bundled.recent.forEach(function (activity) {
      var pin = bundled.pins.find(function (candidate) {
        var sameDistance = candidate.dist_km == null || Math.abs(candidate.dist_km - activity.distance_km) < 0.05;
        return candidate.date === activity.date &&
          candidate.name === activity.name &&
          (!candidate.activity_type || candidate.activity_type === activity.activity_type) &&
          sameDistance;
      });
      if (!pin) return;
      var exactKey = makePinKey(activity.date, activity.name, activity.activity_type, activity.distance_km);
      var looseKey = makePinKey(activity.date, activity.name, activity.activity_type, null);
      lookup[exactKey] = lookup[exactKey] || [];
      lookup[looseKey] = lookup[looseKey] || [];
      lookup[exactKey].push(pin);
      lookup[looseKey].push(pin);
    });

    pinLookupCache[category] = lookup;
    return lookup;
  }

  function buildPins(category, activities) {
    var lookup = getBundledPinLookup(category);
    return activities.map(function (activity) {
      var exactKey = makePinKey(activity.date, activity.name, activity.activity_type, activity.distance_km);
      var looseKey = makePinKey(activity.date, activity.name, activity.activity_type, null);
      var match = (lookup[exactKey] && lookup[exactKey][0]) || (lookup[looseKey] && lookup[looseKey][0]);
      if (!match) return null;
      return {
        lat: match.lat,
        lon: match.lon,
        date: activity.date,
        year: activity.year,
        name: activity.name,
        activity_type: activity.activity_type,
        dist_km: activity.distance_km
      };
    }).filter(Boolean);
  }

  function buildActivityDashboard(activities, category) {
    var monthlyMap = {};
    var yearlyMap = {};
    var weekdayMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    var typeMap = {};
    var recent = activities.slice().sort(sortByDateDesc);

    recent.forEach(function (item) {
      var monthlyKey = item.month;
      var yearlyKey = String(item.year);
      if (!monthlyMap[monthlyKey]) {
        monthlyMap[monthlyKey] = { year_month: monthlyKey, distance_m: 0, distance_km: 0, moving_time_s: 0, moving_time_h: 0, count: 0, calories: 0 };
      }
      if (!yearlyMap[yearlyKey]) {
        yearlyMap[yearlyKey] = { year: item.year, distance_m: 0, distance_km: 0, moving_time_s: 0, moving_time_h: 0, count: 0, calories: 0 };
      }
      if (!typeMap[item.activity_type]) {
        typeMap[item.activity_type] = { type: item.activity_type, count: 0, total_time_hours: 0, total_calories: 0 };
      }

      monthlyMap[monthlyKey].distance_m += item.distance_m;
      monthlyMap[monthlyKey].moving_time_s += item.moving_time_s;
      monthlyMap[monthlyKey].count += 1;
      monthlyMap[monthlyKey].calories += item.calories || 0;

      yearlyMap[yearlyKey].distance_m += item.distance_m;
      yearlyMap[yearlyKey].moving_time_s += item.moving_time_s;
      yearlyMap[yearlyKey].count += 1;
      yearlyMap[yearlyKey].calories += item.calories || 0;

      if (weekdayMap[item.dow] != null) weekdayMap[item.dow] += 1;
      typeMap[item.activity_type].count += 1;
      typeMap[item.activity_type].total_time_hours += item.moving_time_s / 3600;
      typeMap[item.activity_type].total_calories += item.calories || 0;
    });

    var monthly = Object.values(monthlyMap).sort(function (a, b) {
      return a.year_month.localeCompare(b.year_month);
    }).map(function (item) {
      item.distance_km = round(item.distance_m / 1000, 2);
      item.moving_time_h = round(item.moving_time_s / 3600, 1);
      item.calories = Math.round(item.calories);
      return item;
    });

    var yearly = Object.values(yearlyMap).sort(function (a, b) {
      return a.year - b.year;
    }).map(function (item) {
      item.distance_km = round(item.distance_m / 1000, 2);
      item.moving_time_h = round(item.moving_time_s / 3600, 1);
      item.calories = Math.round(item.calories);
      return item;
    });

    var hrValues = recent.map(function (item) { return item.avg_hr; }).filter(function (item) { return item != null; });
    var cadenceValues = recent.map(function (item) { return item.avg_cadence; }).filter(function (item) { return item != null; });
    var summaryDistanceM = recent.reduce(function (sum, item) { return sum + item.distance_m; }, 0);
    var summaryTimeS = recent.reduce(function (sum, item) { return sum + item.moving_time_s; }, 0);
    var summaryCalories = recent.reduce(function (sum, item) { return sum + (item.calories || 0); }, 0);
    var summaryElevation = recent.reduce(function (sum, item) { return sum + (item.elevation_m || 0); }, 0);

    return {
      summary: {
        count: recent.length,
        total_distance_m: round(summaryDistanceM, 1),
        total_distance_km: round(summaryDistanceM / 1000, 1),
        avg_distance_m: round(recent.length ? summaryDistanceM / recent.length : 0, 1),
        avg_distance_km: round(recent.length ? (summaryDistanceM / 1000) / recent.length : 0, 2),
        total_time_s: Math.round(summaryTimeS),
        total_time_hours: round(summaryTimeS / 3600, 1),
        avg_duration_min: round(recent.length ? summaryTimeS / 60 / recent.length : 0, 1),
        avg_hr: hrValues.length ? round(hrValues.reduce(function (sum, item) { return sum + item; }, 0) / hrValues.length, 1) : null,
        avg_cadence: cadenceValues.length ? round(cadenceValues.reduce(function (sum, item) { return sum + item; }, 0) / cadenceValues.length, 1) : null,
        max_speed_mps: recent.reduce(function (max, item) { return Math.max(max, item.max_speed_mps || 0); }, 0),
        max_speed_kmh: round(recent.reduce(function (max, item) { return Math.max(max, item.max_speed_kmh || 0); }, 0), 2),
        total_elevation_m: Math.round(summaryElevation),
        total_calories: Math.round(summaryCalories)
      },
      years: Array.from(new Set(recent.map(function (item) { return String(item.year); }))).sort(),
      monthly: monthly,
      yearly: yearly,
      weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (dow) {
        return { day_of_week: dow, count: weekdayMap[dow] };
      }),
      recent: recent,
      pins: buildPins(category, recent),
      type_breakdown: Object.values(typeMap).sort(function (a, b) {
        return b.count - a.count;
      }).map(function (item) {
        return {
          type: item.type,
          count: item.count,
          total_time_hours: round(item.total_time_hours, 1),
          total_calories: Math.round(item.total_calories)
        };
      })
    };
  }

  function buildRuntimeData(text, fileName) {
    var records = parseCsv(text);
    if (!records.length) throw new Error('The uploaded file appears to be empty.');

    var grouped = { swim: [], walk_run: [], ride: [], rowing: [], workout: [], hike: [], other: [] };
    records.forEach(function (record) {
      var activity = buildActivity(record);
      if (!activity) return;
      grouped[activity.category].push(activity);
    });

    var cards = CARD_META.map(function (meta) {
      return {
        name: meta.name,
        emoji: meta.emoji,
        color: meta.color,
        link: meta.link,
        stats: cardStats(grouped[meta.key])
      };
    });

    var allActivities = Object.keys(grouped).reduce(function (acc, key) {
      return acc.concat(grouped[key]);
    }, []);
    var overallStats = cardStats(allActivities);

    return {
      meta: {
        filename: fileName || 'activities.csv',
        uploaded_at: new Date().toISOString()
      },
      hero: {
        total_activities: overallStats.count,
        total_distance_km: overallStats.total_distance_km,
        total_time_hours: overallStats.total_time_hours,
        date_range: overallStats.date_range
      },
      cards: cards,
      activity_dashboards: {
        ride: buildActivityDashboard(grouped.ride, 'ride'),
        rowing: buildActivityDashboard(grouped.rowing, 'rowing'),
        workout: buildActivityDashboard(grouped.workout, 'workout'),
        hike: buildActivityDashboard(grouped.hike, 'hike'),
        other: buildActivityDashboard(grouped.other, 'other')
      }
    };
  }

  function readStoredData() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredData(payload) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function defaultHeroFromCards(cards) {
    var totals = cards.reduce(function (acc, card) {
      acc.total_activities += card.stats.count || 0;
      acc.total_distance_km += card.stats.total_distance_km || 0;
      acc.total_time_hours += card.stats.total_time_hours || 0;
      if (card.stats.date_min && card.stats.date_min !== '--') acc.date_mins.push(card.stats.date_min);
      if (card.stats.date_max && card.stats.date_max !== '--') acc.date_maxes.push(card.stats.date_max);
      return acc;
    }, { total_activities: 0, total_distance_km: 0, total_time_hours: 0, date_mins: [], date_maxes: [] });

    return {
      total_activities: totals.total_activities,
      total_distance_km: round(totals.total_distance_km, 1),
      total_time_hours: round(totals.total_time_hours, 1),
      date_range: totals.date_mins.length && totals.date_maxes.length
        ? totals.date_mins.sort()[0] + ' - ' + totals.date_maxes.sort().slice(-1)[0]
        : '--'
    };
  }

  window.STRAVA_RUNTIME = {
    saveUploadedCsvFile: function (file) {
      return file.text().then(function (text) {
        var payload = buildRuntimeData(text, file.name);
        writeStoredData(payload);
        return payload;
      });
    },
    clearUploadedData: function () {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        return false;
      }
      return true;
    },
    getStoredMeta: function () {
      var stored = readStoredData();
      return stored ? stored.meta : null;
    },
    getOverviewData: function (defaultCards) {
      var stored = readStoredData();
      if (stored && stored.cards && stored.hero) return stored;
      return {
        meta: null,
        cards: defaultCards || [],
        hero: defaultHeroFromCards(defaultCards || [])
      };
    },
    getActivityDashboardSource: function (category) {
      var stored = readStoredData();
      if (stored && stored.activity_dashboards && stored.activity_dashboards[category]) {
        return stored.activity_dashboards[category];
      }
      return window.ACTIVITY_DASHBOARD_DATA && window.ACTIVITY_DASHBOARD_DATA[category];
    }
  };
}());
