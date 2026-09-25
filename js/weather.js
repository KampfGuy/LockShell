/* Weather: Open-Meteo (free, keyless). Geolocation only when opened; city search fallback; cached for offline. */
(function () {
  'use strict';
  const { el } = LS;
  const API = 'https://api.open-meteo.com/v1/forecast';
  const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  const WMO = {
    0: ['Clear sky', '☀️', '🌙'], 1: ['Mainly clear', '🌤️', '🌙'], 2: ['Partly cloudy', '⛅', '☁️'], 3: ['Overcast', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Freezing fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'], 61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'], 71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
    77: ['Snow grains', '🌨️'], 80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Heavy showers', '⛈️'],
    85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'], 95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm, hail', '⛈️'], 99: ['Thunderstorm, hail', '⛈️']
  };
  LS.wmo = (code, isDay) => { const w = WMO[code] || ['Unknown', '🌡️']; return { text: w[0], emoji: (isDay === 0 && w[2]) ? w[2] : w[1] }; };
  const toUnit = (c) => (LS.settings.weatherUnit === 'C' ? c : c * 9 / 5 + 32);
  const deg = (c) => Math.round(toUnit(c)) + '°';
  let gen = 0;
  LS.fetchForecast = (lat, lon) => fetchForecast(lat, lon);
  LS.geoSearch = async (q) => { const r = await fetch(GEO + '?' + new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' })); if (!r.ok) throw new Error('HTTP ' + r.status); return (await r.json()).results || []; };

  async function fetchForecast(lat, lon) {
    const q = new URLSearchParams({
      latitude: lat.toFixed(4), longitude: lon.toFixed(4),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto', forecast_days: '5'
    });
    const r = await fetch(API + '?' + q.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!d.current || !d.daily) throw new Error('Bad data');
    return d;
  }

  LS.register('weather', {
    title: 'Weather', icon: 'weather', color: 'linear-gradient(135deg,#5ac8fa,#007aff)',
    open(body, actions) {
      const my = ++gen;
      body.classList.add('scroll');
      const wrap = el('div', { class: 'pad' });
      body.append(wrap);
      actions.append(el('button', { class: 'pill-btn', text: 'Search', onclick: () => showSearch() }));

      let shown = false;
      function status(emoji, title, text, btn, force) { if (shown && !force) return; wrap.innerHTML = ''; wrap.append(LS.notice(emoji, title, text, btn)); }
      function render(c, note) {
        if (my !== gen) return;
        const d = c.data, cur = d.current, day = d.daily, w = LS.wmo(cur.weather_code, cur.is_day);
        const wind = LS.settings.weatherUnit === 'C' ? Math.round(cur.wind_speed_10m) + ' km/h' : Math.round(cur.wind_speed_10m * 0.621371) + ' mph';
        shown = true; wrap.innerHTML = '';
        const hero = el('div', { class: 'wx-hero' + (cur.is_day === 0 ? ' night' : '') },
          el('div', { class: 'wx-city', text: c.place || 'My Location' }),
          el('div', { class: 'wx-temp', text: deg(cur.temperature_2m) }),
          el('div', { class: 'wx-cond', text: w.emoji + ' ' + w.text }),
          el('div', { class: 'wx-hl', text: 'H: ' + deg(day.temperature_2m_max[0]) + '   L: ' + deg(day.temperature_2m_min[0]) }),
          el('div', { class: 'wx-extra', text: 'Feels like ' + deg(cur.apparent_temperature) + ' · Humidity ' + Math.round(cur.relative_humidity_2m) + '% · Wind ' + wind }));
        const lo = Math.min.apply(null, day.temperature_2m_min.slice(0, 5)), hi = Math.max.apply(null, day.temperature_2m_max.slice(0, 5));
        const days = el('div', { class: 'wx-days' }, el('div', { class: 'wx-days-h', text: '5-DAY FORECAST' }));
        for (let i = 0; i < Math.min(5, day.time.length); i++) {
          const dw = LS.wmo(day.weather_code[i], 1);
          const name = i === 0 ? 'Today' : new Date(day.time[i] + 'T12:00').toLocaleDateString([], { weekday: 'short' });
          const span = Math.max(1, hi - lo), left = ((day.temperature_2m_min[i] - lo) / span) * 100, width = ((day.temperature_2m_max[i] - day.temperature_2m_min[i]) / span) * 100;
          const pp = day.precipitation_probability_max && day.precipitation_probability_max[i];
          days.append(el('div', { class: 'wx-day' },
            el('span', { class: 'wx-dn', text: name }),
            el('span', { class: 'wx-de', title: dw.text }, dw.emoji, pp >= 30 ? el('small', { text: pp + '%' }) : ''),
            el('span', { class: 'wx-lo', text: deg(day.temperature_2m_min[i]) }),
            el('span', { class: 'wx-track' }, el('i', { style: { left: left + '%', width: Math.max(6, width) + '%' } })),
            el('span', { class: 'wx-hi', text: deg(day.temperature_2m_max[i]) })));
        }
        wrap.append(hero, days, el('div', { class: 'wx-meta', text: (note ? note + ' · ' : '') + 'Updated ' + LS.fmtDate(c.at) + ' · Open-Meteo' }),
          el('button', { class: 'ghost-btn', text: '📍 Use my location', onclick: () => { shown = false; LS.settings.manualPlace = false; LS.saveSettings(); locate(); } }));
      }
      async function load(lat, lon, place) {
        status('⛅', 'Loading weather…', place ? place : 'Getting the forecast');
        try {
          const data = await fetchForecast(lat, lon);
          const c = { data, place, lat, lon, at: Date.now() };
          LS.settings.lastWeather = c; LS.settings.lastPlace = { lat, lon, place }; LS.saveSettings();
          render(c);
        } catch (e) {
          const c = LS.settings.lastWeather;
          if (c && c.data) render(c, navigator.onLine === false ? 'Offline, showing saved weather' : 'Could not refresh, showing saved weather');
          else status('📡', 'No weather right now', navigator.onLine === false ? "You're offline. Connect to the internet and try again." : "The weather service didn't answer. Please try again in a moment.", { label: 'Try again', onclick: () => load(lat, lon, place) }, true);
        }
      }
      function locate() {
        if (!navigator.geolocation) { showSearch("Location isn't available here. Search for your city instead."); return; }
        status('📍', 'Finding you…', 'Allow location to see your local weather.');
        navigator.geolocation.getCurrentPosition(
          (p) => { if (my === gen) load(p.coords.latitude, p.coords.longitude, 'My Location'); },
          (err) => {
            if (my !== gen) return;
            const lp = LS.settings.lastPlace;
            if (lp && lp.place && lp.place !== 'My Location') { load(lp.lat, lp.lon, lp.place); return; }
            if (shown) { LS.toast(err && err.code === 1 ? 'Location is off. Tap Search to pick a city.' : "Couldn't update your location."); return; }
            showSearch(err && err.code === 1 ? 'Location is off. You can search for a city instead.' : "Couldn't find your location. Search for a city instead.");
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60000 });
      }
      function showSearch(msg) {
        shown = false; wrap.innerHTML = '';
        const inp = el('input', { class: 'txt-in', type: 'search', placeholder: 'City name, e.g. Chicago', enterkeyhint: 'search', autocomplete: 'off', maxlength: 80 });
        const list = el('div', { class: 'list' });
        const form = el('form', { class: 'wx-search', onsubmit: (e) => { e.preventDefault(); search(); } }, inp, el('button', { class: 'pill-btn', type: 'submit', text: 'Search' }));
        wrap.append(el('h2', { class: 'wx-title', text: 'Find a city' }), msg ? el('p', { class: 'muted', text: msg }) : '', form, list);
        if (LS.settings.lastWeather) wrap.append(el('button', { class: 'ghost-btn', style: { marginTop: '12px' }, text: 'Show saved weather', onclick: () => render(LS.settings.lastWeather) }));
        setTimeout(() => inp.focus(), 80);
        async function search() {
          const q = inp.value.trim(); if (!q) return;
          list.innerHTML = ''; list.append(el('p', { class: 'muted', text: 'Searching…' }));
          try {
            const r = await fetch(GEO + '?' + new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' }));
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json(); list.innerHTML = '';
            if (!d.results || !d.results.length) { list.append(el('p', { class: 'muted', text: 'No places found. Check the spelling and try again.' })); return; }
            d.results.forEach((p) => {
              const label = [p.name, p.admin1, p.country_code || p.country].filter(Boolean).join(', ');
              list.append(el('button', { class: 'item', onclick: () => { LS.settings.manualPlace = true; LS.saveSettings(); load(p.latitude, p.longitude, p.name); } }, el('div', { class: 'meta' }, el('b', { text: p.name }), el('small', { text: label }))));
            });
          } catch (e) { list.innerHTML = ''; list.append(el('p', { class: 'muted', text: "Search didn't work. Check your internet connection and try again." })); }
        }
      }
      const c = LS.settings.lastWeather;
      if (c && c.data) render(c, 'Saved');
      const lp = LS.settings.lastPlace;
      if (LS.settings.manualPlace && lp && lp.lat != null) load(lp.lat, lp.lon, lp.place); else locate();
    },
    close() { gen++; }
  });
})();
