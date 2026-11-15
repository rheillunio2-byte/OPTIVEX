/* JARVIX — unit converter. Real conversion tables; temperature handled specially. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});

  // category -> unit key -> [factor to base, label, ...aliases]
  const T = {
    length: { base: 'm', u: {
      m: [1, 'm', 'meter', 'meters', 'metre', 'metres'], km: [1000, 'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'],
      cm: [0.01, 'cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'], mm: [0.001, 'mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'],
      um: [1e-6, 'µm', 'micrometer', 'micrometers', 'micron', 'microns', 'µm'], mi: [1609.344, 'mi', 'mile', 'miles'],
      yd: [0.9144, 'yd', 'yard', 'yards'], ft: [0.3048, 'ft', 'foot', 'feet'], in: [0.0254, 'in', 'inch', 'inches'], nmi: [1852, 'nmi', 'nautical mile', 'nautical miles'] } },
    mass: { base: 'kg', u: {
      kg: [1, 'kg', 'kilogram', 'kilograms', 'kilo', 'kilos'], g: [0.001, 'g', 'gram', 'grams'], mg: [1e-6, 'mg', 'milligram', 'milligrams'],
      t: [1000, 't', 'tonne', 'tonnes', 'metric ton', 'metric tons'], lb: [0.45359237, 'lb', 'lbs', 'pound', 'pounds'], oz: [0.028349523125, 'oz', 'ounce', 'ounces'], st: [6.35029318, 'st', 'stone', 'stones'] } },
    volume: { base: 'l', u: {
      l: [1, 'L', 'l', 'liter', 'liters', 'litre', 'litres'], ml: [0.001, 'mL', 'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
      m3: [1000, 'm³', 'm3', 'cubic meter', 'cubic meters'], gal: [3.785411784, 'gal (US)', 'gal', 'gallon', 'gallons'], qt: [0.946352946, 'qt', 'quart', 'quarts'],
      pt: [0.473176473, 'pt', 'pint', 'pints'], cup: [0.2365882365, 'cup', 'cups'], floz: [0.0295735295625, 'fl oz', 'floz', 'fl oz', 'fluid ounce', 'fluid ounces'],
      tbsp: [0.01478676478125, 'tbsp', 'tablespoon', 'tablespoons'], tsp: [0.00492892159375, 'tsp', 'teaspoon', 'teaspoons'] } },
    area: { base: 'm2', u: {
      m2: [1, 'm²', 'm2', 'sqm', 'square meter', 'square meters'], km2: [1e6, 'km²', 'km2', 'square kilometer', 'square kilometers'], cm2: [1e-4, 'cm²', 'cm2'],
      ha: [10000, 'ha', 'hectare', 'hectares'], acre: [4046.8564224, 'acre', 'acres'], ft2: [0.09290304, 'ft²', 'ft2', 'sqft', 'square foot', 'square feet'],
      in2: [0.00064516, 'in²', 'in2', 'sqin'], mi2: [2589988.110336, 'mi²', 'mi2', 'square mile', 'square miles'] } },
    speed: { base: 'ms', u: {
      ms: [1, 'm/s', 'm/s', 'mps', 'meters per second'], kmh: [1 / 3.6, 'km/h', 'km/h', 'kph', 'kmh', 'kilometers per hour'],
      mph: [0.44704, 'mph', 'mph', 'miles per hour'], kn: [0.514444444, 'kn', 'knot', 'knots', 'kt'], fps: [0.3048, 'ft/s', 'ft/s', 'fps'] } },
    time: { base: 's', u: {
      s: [1, 's', 'sec', 'secs', 'second', 'seconds'], ms: [0.001, 'ms', 'millisecond', 'milliseconds'], min: [60, 'min', 'mins', 'minute', 'minutes'],
      h: [3600, 'h', 'hr', 'hrs', 'hour', 'hours'], d: [86400, 'd', 'day', 'days'], wk: [604800, 'wk', 'week', 'weeks'], yr: [31557600, 'yr', 'year', 'years', 'y'] } },
    data: { base: 'b', u: {
      b: [1 / 8, 'bit', 'bit', 'bits'], B: [1, 'B', 'byte', 'bytes'], KB: [1e3, 'KB', 'kb', 'kilobyte', 'kilobytes'], MB: [1e6, 'MB', 'mb', 'megabyte', 'megabytes'],
      GB: [1e9, 'GB', 'gb', 'gigabyte', 'gigabytes'], TB: [1e12, 'TB', 'tb', 'terabyte', 'terabytes'], KiB: [1024, 'KiB', 'kib'], MiB: [1048576, 'MiB', 'mib'],
      GiB: [1073741824, 'GiB', 'gib'], TiB: [1099511627776, 'TiB', 'tib'] } },
    energy: { base: 'j', u: {
      j: [1, 'J', 'joule', 'joules'], kj: [1000, 'kJ', 'kilojoule', 'kilojoules'], cal: [4.184, 'cal', 'calorie', 'calories'], kcal: [4184, 'kcal', 'kilocalorie', 'kilocalories'],
      wh: [3600, 'Wh', 'watt hour', 'watt hours'], kwh: [3.6e6, 'kWh', 'kilowatt hour', 'kilowatt hours'] } },
    pressure: { base: 'pa', u: {
      pa: [1, 'Pa', 'pascal', 'pascals'], kpa: [1000, 'kPa', 'kilopascal', 'kilopascals'], bar: [1e5, 'bar'], psi: [6894.757293168, 'psi'], atm: [101325, 'atm', 'atmosphere', 'atmospheres'] } },
    angle: { base: 'rad', u: { rad: [1, 'rad', 'radian', 'radians'], deg: [Math.PI / 180, '°', 'deg', 'degree', 'degrees', '°'], turn: [2 * Math.PI, 'turn', 'turns', 'rev'] } },
    temperature: { base: 'c', u: { c: [1, '°C', 'c', 'celsius', '°c', 'degc'], f: [1, '°F', 'f', 'fahrenheit', '°f', 'degf'], k: [1, 'K', 'k', 'kelvin'] } },
  };

  const index = new Map(); // alias -> {cat, key}
  for (const [cat, def] of Object.entries(T)) {
    for (const [key, arr] of Object.entries(def.u)) {
      index.set(key, { cat, key });
      for (const a of arr.slice(1)) {
        const al = String(a).toLowerCase();
        // case-sensitive data units (b vs B) are keyed by exact alias first
        if (cat === 'data') { index.set(a, { cat, key }); if (!index.has(al)) index.set(al, { cat, key }); } else index.set(al, { cat, key });
      }
    }
  }

  function find(name) {
    const raw = name.trim().replace(/\.$/, '').replace(/²/g, '2').replace(/³/g, '3').replace(/\s+/g, ' ');
    return index.get(raw) || index.get(raw.toLowerCase()) || null;
  }

  function label(cat, key) { return T[cat].u[key][1]; }

  function toBaseTemp(v, k) { return k === 'c' ? v : k === 'f' ? ((v - 32) * 5) / 9 : v - 273.15; }
  function fromBaseTemp(c, k) { return k === 'c' ? c : k === 'f' ? (c * 9) / 5 + 32 : c + 273.15; }

  /** Parse "10 km to miles" → {value, from, to, result}. Throws friendly errors. */
  function convert(input) {
    const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([^\d].*?)\s+(?:to|in|into|as|->|=>|=)\s+(.+?)\s*$/i.exec(input.replace(/,(?=\d{3}\b)/g, ''));
    if (!m) throw new Error('Use the form “/convert 10 km to miles”.');
    const value = parseFloat(m[1]);
    const a = find(m[2]), b = find(m[3]);
    if (!a) throw new Error(`I don't recognise the unit “${m[2].trim()}”.`);
    if (!b) throw new Error(`I don't recognise the unit “${m[3].trim()}”.`);
    if (a.cat !== b.cat) throw new Error(`Can't convert ${a.cat} (${label(a.cat, a.key)}) to ${b.cat} (${label(b.cat, b.key)}).`);
    let result;
    if (a.cat === 'temperature') {
      if (a.key === 'k' && value < 0) throw new Error('Kelvin cannot be negative.');
      result = fromBaseTemp(toBaseTemp(value, a.key), b.key);
    } else {
      result = (value * T[a.cat].u[a.key][0]) / T[b.cat].u[b.key][0];
    }
    return { value, from: label(a.cat, a.key), to: label(b.cat, b.key), category: a.cat, result };
  }

  function fmt(n) {
    if (n === 0) return '0';
    const a = Math.abs(n);
    if (a >= 1e12 || a < 1e-4) return n.toExponential(5).replace(/\.?0+e/, 'e');
    return Number(n.toPrecision(8)).toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  function categories() {
    return Object.entries(T).map(([cat, d]) => ({ cat, units: Object.values(d.u).map((a) => a[1]) }));
  }

  JX.units = { convert, fmt, categories };
})();
