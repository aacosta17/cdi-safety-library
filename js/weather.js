(function () {
  const state = {
    hourly: [],
    daily: [],
    alerts: [],
    work: null,
    dailyMap: new Map()
  };

  const byId = id => document.getElementById(id);
  const numberFromWind = value => {
    const values = String(value || '').match(/\d+(?:\.\d+)?/g);
    return values ? Math.max(...values.map(Number)) : null;
  };
  const dateKey = value => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const timeLabel = value => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fieldTimeLabel = value => {
    if (!value) return '';
    const [hour, minute] = value.split(':').map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  const heatIndex = (temperature, humidity) => {
    if (typeof window.wxHeatIndexF === 'function') return window.wxHeatIndexF(temperature, humidity);
    if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || temperature < 80 || humidity < 40) return temperature;
    return -42.379 + 2.04901523 * temperature + 10.14333127 * humidity - .22475541 * temperature * humidity - .00683783 * temperature * temperature - .05481717 * humidity * humidity + .00122874 * temperature * temperature * humidity + .00085282 * temperature * humidity * humidity - .00000199 * temperature * temperature * humidity * humidity;
  };

  function selectedWindow() {
    const startValue = byId('forecastStart')?.value || '04:40';
    const endValue = byId('forecastEnd')?.value || '18:00';
    const selectedDate = byId('dateStarted')?.value || dateKey(new Date());
    const start = new Date(`${selectedDate}T${startValue}:00`);
    const end = new Date(`${selectedDate}T${endValue}:00`);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { start, end, startValue, endValue, selectedDate };
  }

  function summarizeWorkWindow() {
    const windowRange = selectedWindow();
    const periods = state.hourly.filter(period => {
      const start = new Date(period.startTime);
      return start >= windowRange.start && start <= windowRange.end;
    });
    if (!periods.length) return { ...windowRange, periods: [], available: false };

    let peakHeat = null;
    let lowTemp = null;
    let peakWind = null;
    let rain = null;
    let lightning = null;
    periods.forEach(period => {
      const temp = Number(period.temperature);
      const humidity = Number(period.relativeHumidity?.value);
      const hi = heatIndex(temp, humidity);
      const wind = numberFromWind(period.windSpeed);
      if (Number.isFinite(hi) && (!peakHeat || hi > peakHeat.value)) peakHeat = { value: hi, time: period.startTime };
      if (Number.isFinite(temp) && (!lowTemp || temp < lowTemp.value)) lowTemp = { value: temp, time: period.startTime };
      if (Number.isFinite(wind) && (!peakWind || wind > peakWind.value)) peakWind = { value: wind, time: period.startTime };
      const forecastText = `${period.shortForecast || ''} ${period.detailedForecast || ''}`;
      if (!rain && /rain|showers|drizzle|precip/i.test(forecastText)) rain = { time: period.startTime, text: period.shortForecast };
      if (!lightning && /thunder|lightning/i.test(forecastText)) lightning = { time: period.startTime, text: period.shortForecast };
    });
    const severe = state.alerts.find(feature => /Extreme|Severe/i.test(feature.properties?.severity || '')) || null;
    return { ...windowRange, periods, available: true, peakHeat, lowTemp, peakWind, rain, lightning, severe };
  }

  function workMessages(work) {
    if (!work?.available) return [];
    const messages = [];
    if (work.severe) messages.push(`Active NWS ${work.severe.properties?.event || 'severe weather alert'}`);
    if (work.peakHeat?.value >= 90) messages.push(`Heat index may reach ${Math.round(work.peakHeat.value)}°F around ${timeLabel(work.peakHeat.time)}`);
    if (work.lowTemp?.value <= 40) messages.push(`Temperature may fall to ${Math.round(work.lowTemp.value)}°F around ${timeLabel(work.lowTemp.time)}`);
    if (work.peakWind?.value >= 20) messages.push(`Wind may reach ${Math.round(work.peakWind.value)} mph around ${timeLabel(work.peakWind.time)}`);
    if (work.lightning) messages.push(`Thunderstorms are possible around ${timeLabel(work.lightning.time)}`);
    else if (work.rain) messages.push(`Rain or wet conditions are possible around ${timeLabel(work.rain.time)}`);
    return messages;
  }

  function updateWorkSummary() {
    state.work = summarizeWorkWindow();
    const work = state.work;
    const summary = byId('forecastSummary');
    const dashboard = byId('dashboardForecastSummary');
    const windowText = `${fieldTimeLabel(work.startValue)} – ${fieldTimeLabel(work.endValue)}`;
    const messages = workMessages(work);
    const indoor = (byId('workSetting')?.value || 'outdoor') === 'indoor';
    let text;
    if (!work.available) text = `NWS hourly forecast is not available for ${work.selectedDate} (${windowText}).`;
    else if (!messages.length) text = `No automatic weather hazard trigger found for the ${windowText} work window.`;
    else text = `${indoor ? 'Indoor setting selected; PTP weather hazards are suppressed. ' : ''}${messages.join('. ')}.`;
    if (summary) {
      summary.textContent = text;
      summary.classList.toggle('forecast-alert', messages.length > 0 && !indoor);
    }
    if (dashboard) dashboard.textContent = text;
    return work;
  }

  function dailyForecastMap() {
    const map = new Map();
    state.hourly.forEach(period => {
      const key = dateKey(period.startTime);
      const existing = map.get(key) || { high: -Infinity, low: Infinity, rain: false, lightning: false, wind: 0, label: '' };
      const temp = Number(period.temperature);
      if (Number.isFinite(temp)) {
        existing.high = Math.max(existing.high, temp);
        existing.low = Math.min(existing.low, temp);
      }
      existing.wind = Math.max(existing.wind, numberFromWind(period.windSpeed) || 0);
      const text = `${period.shortForecast || ''} ${period.detailedForecast || ''}`;
      existing.rain ||= /rain|showers|drizzle|precip/i.test(text);
      existing.lightning ||= /thunder|lightning/i.test(text);
      existing.label = period.shortForecast || existing.label;
      map.set(key, existing);
    });
    state.dailyMap = map;
  }

  function calendarLevel(day) {
    if (!day) return 'none';
    if (day.lightning || day.high > 103 || day.wind >= 35) return 'danger';
    if (day.high > 95 || day.wind >= 25) return 'high';
    if (day.high > 85 || day.wind >= 20) return 'caution';
    if (day.high < 60) return 'cold';
    return 'normal';
  }

  function iconFor(day) {
    if (!day) return '';
    if (day.lightning) return '⛈';
    if (day.rain) return '🌧';
    if (day.wind >= 25) return '💨';
    if (/cloud|overcast/i.test(day.label)) return '☁';
    return '☀';
  }

  function renderCalendar() {
    const root = byId('weatherCalendar');
    if (!root) return;
    const today = new Date();
    const compact = window.matchMedia('(max-width: 650px)').matches;
    const year = today.getFullYear(), month = today.getMonth();
    const first = compact ? new Date(year, month, today.getDate()) : new Date(year, month, 1);
    const last = compact ? new Date(year, month, today.getDate() + 6) : new Date(year, month + 1, 0);
    const dates = [];
    for (let date = new Date(first); date <= last; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
    const weekdayNames = compact ? dates.map(date => date.toLocaleDateString([], { weekday: 'short' })) : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells = [];
    if (!compact) for (let i = 0; i < first.getDay(); i++) cells.push('<div class="calendar-day empty" aria-hidden="true"></div>');
    dates.forEach(date => {
      const dayNumber = date.getDate();
      const key = dateKey(date);
      const day = state.dailyMap.get(key);
      const range = day && Number.isFinite(day.high) ? `<span class="calendar-temp">${Math.round(day.high)}° <small>${Math.round(day.low)}°</small></span>` : '<span class="calendar-unavailable">—</span>';
      cells.push(`<div class="calendar-day ${calendarLevel(day)} ${key === dateKey(today) ? 'today' : ''}" title="${day ? `${day.label || 'Forecast'} · Wind up to ${Math.round(day.wind)} mph` : 'Forecast not available'}"><b>${dayNumber}</b><span class="calendar-icon">${iconFor(day)}</span>${range}</div>`);
    });
    const heading = compact ? 'Next 7 Days' : today.toLocaleDateString([], { month: 'long', year: 'numeric' });
    root.innerHTML = `<div class="calendar-head"><div><span class="calendar-kicker">WORKDAY WEATHER</span><h2>${heading}</h2></div><span class="calendar-source">NWS · available forecast days only</span></div><div class="calendar-weekdays">${weekdayNames.map(name => `<b>${name}</b>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div><div class="calendar-legend"><span class="cold">Cold</span><span class="normal">Normal</span><span class="caution">Heat caution</span><span class="high">High heat / wind</span><span class="danger">Danger / storm</span></div>`;
  }

  function ingest(hourlyPeriods, dailyPeriods, alerts) {
    state.hourly = Array.isArray(hourlyPeriods) ? hourlyPeriods : [];
    state.daily = Array.isArray(dailyPeriods) ? dailyPeriods : [];
    state.alerts = Array.isArray(alerts) ? alerts : [];
    dailyForecastMap();
    updateWorkSummary();
    renderCalendar();
  }

  function forecastHazards(text, currentWeather) {
    const indoor = (byId('workSetting')?.value || 'outdoor') === 'indoor';
    if (indoor) return [];
    const work = state.work || updateWorkSummary();
    if (!work?.available) return [];
    const low = String(text || '').toLowerCase();
    const anchor = /review|work area|controls|stage|set up|weather/.test(low);
    const lift = /lift|mewp|scissor|boom|aerial|elevat/.test(low);
    const driving = /drive|driving|vehicle|travel|road/.test(low);
    const hazards = [];
    if (anchor && work.lowTemp?.value <= 40) hazards.push({
      hazard: 'Cold stress / cold-related illness',
      control: `Temperature may fall to ${Math.round(work.lowTemp.value)}°F around ${timeLabel(work.lowTemp.time)}. Wear suitable dry layers, provide warm-up breaks, and monitor workers for shivering, numbness, fatigue, or confusion.`,
      source: 'Work-window forecast · NWS', selected: true, required: true, custom: false, weatherAdded: true, tags: ['cold', 'weather']
    });
    if (anchor && work.peakHeat?.value >= 90) hazards.push({
      hazard: 'Heat stress / heat illness',
      control: `Plan for the forecast peak near ${Math.round(work.peakHeat.value)}°F around ${timeLabel(work.peakHeat.time)}; provide frequent water and recovery breaks in shade or a cooled area, and monitor workers for heat illness.`,
      source: 'Work-window forecast · NWS', selected: true, required: true, custom: false, weatherAdded: true, tags: ['heat', 'weather']
    });
    if ((anchor || lift) && work.peakWind?.value >= 20) hazards.push({
      hazard: 'Forecast wind affects elevated work and loose materials',
      control: `Wind may reach ${Math.round(work.peakWind.value)} mph around ${timeLabel(work.peakWind.time)}. Check equipment and project limits, secure loose material, and lower or stop elevated work if safe limits are exceeded.`,
      source: 'Work-window forecast · NWS', selected: true, required: true, custom: false, weatherAdded: true, tags: ['wind', 'lift', 'weather']
    });
    if ((anchor || lift) && work.lightning) hazards.push({
      hazard: 'Lightning / thunderstorm exposure',
      control: `Thunderstorms are possible around ${timeLabel(work.lightning.time)}. Follow the project lightning stand-down procedure, move to safe shelter when required, and resume only after the project all-clear requirement is met.`,
      source: 'Work-window forecast · NWS', selected: true, required: true, custom: false, weatherAdded: true, tags: ['lightning', 'weather', 'stand-down']
    });
    if ((anchor || lift || driving) && work.rain) hazards.push({
      hazard: 'Forecast rain / wet surfaces / reduced visibility',
      control: driving ? 'Slow down, increase following distance, and reassess travel if visibility or road conditions become unsafe.' : 'Watch for slick surfaces and reduced visibility; use equipment suited to the conditions and stop or reassess exposed work if controls are no longer effective.',
      source: 'Work-window forecast · NWS', selected: true, required: true, custom: false, weatherAdded: true, tags: ['rain', 'weather', 'slip']
    });
    return hazards;
  }

  function bindControls() {
    ['forecastStart', 'forecastEnd', 'dateStarted', 'workSetting'].forEach(id => byId(id)?.addEventListener('change', updateWorkSummary));
    byId('forecastSettingsToggle')?.addEventListener('click', () => byId('forecastSettings')?.classList.toggle('hidden'));
  }

  window.CDIWeather = { ingest, updateWorkSummary, renderCalendar, forecastHazards, state };
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderCalendar, 120); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindControls);
  else bindControls();
})();
