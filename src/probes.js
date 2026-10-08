  function fnv32a(bytes, seed) {
    var h = (seed || 0x811c9dc5) ^ 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function hex32(n) { return ('00000000' + n.toString(16)).slice(-8); }
  function strBytes(t) {
    var out = [];
    for (var i = 0; i < t.length; i++) out.push(t.charCodeAt(i) & 0xff, (t.charCodeAt(i) >> 8) & 0xff);
    return out;
  }
  function hash(text) { return hex32(fnv32a(strBytes(String(text)))); }
  function safe(fn) { try { return fn(); } catch (e) { return null; } }
  function safeAsync(fn, done) { try { fn(done); } catch (e) { done(null); } }

  // ================= DEVICE (PX/DataDome/Akamai/Arkose common core) =================
  function drawCanvasProbe(kind, c) {
    c = c || document.createElement('canvas');
    c.width = 240; c.height = kind === 'combined' ? 60 : 80;
    var x = c.getContext('2d');
    if (!x) throw new Error('Canvas 2D unavailable');
    if (kind === 'combined') {
      x.textBaseline = 'top'; x.font = "14px 'Arial'";
      x.fillStyle = '#f60'; x.fillRect(125, 1, 62, 20);
      x.fillStyle = '#069'; x.fillText('Cwm fjordbank glyphs vext quiz, \ud83d\ude03', 2, 15);
      x.fillStyle = 'rgba(102, 204, 0, 0.7)'; x.fillText('Cwm fjordbank glyphs vext quiz, \ud83d\ude03', 4, 17);
    } else {
      x.clearRect(0, 0, c.width, c.height);
      x.textBaseline = 'alphabetic'; x.font = '18px Arial'; x.fillStyle = '#246';
      if (kind === 'text') x.fillText('Cwm fjordbank glyphs vext quiz', 4, 30);
      if (kind === 'emoji') x.fillText('😃 🌍 🚀', 4, 30);
      if (kind === 'gradient') {
        var g = x.createLinearGradient(0, 0, 240, 80);
        g.addColorStop(0, '#f60'); g.addColorStop(1, '#069');
        x.fillStyle = g; x.fillRect(0, 0, 240, 80);
      }
      if (kind === 'shapes') {
        x.beginPath(); x.arc(40, 40, 25, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(102,204,0,0.7)'; x.fillRect(30, 20, 50, 40);
      }
    }
    return c;
  }
  function canvasHash() {
    return safe(function () { return hash(drawCanvasProbe('combined').toDataURL()); });
  }
  function canvasDetails() {
    return safe(function () {
      var c = document.createElement('canvas');
      function render(kind) { return hash(drawCanvasProbe(kind, c).toDataURL()); }
      var samples = {};
      ['text', 'emoji', 'gradient', 'shapes'].forEach(function (kind) {
        var first = render(kind), second = render(kind);
        samples[kind] = { hash: first, repeatMatches: first === second };
      });
      var x = c.getContext('2d'); x.font = '18px Arial';
      var measured = x.measureText('Cwm fjordbank glyphs vext quiz');
      var metrics = {};
      ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight',
       'actualBoundingBoxAscent', 'actualBoundingBoxDescent',
       'fontBoundingBoxAscent', 'fontBoundingBoxDescent'].forEach(function (key) {
        metrics[key] = Number.isFinite(measured[key]) ? Math.round(measured[key] * 1000) / 1000 : null;
      });
      return { status: 'measured', attributes: safe(function () {
        return x.getContextAttributes ? x.getContextAttributes() : null;
      }), metrics: metrics, samples: samples };
    });
  }
  function canvasPreview() {
    return ['combined', 'text', 'emoji', 'gradient', 'shapes'].map(function (kind) {
      try {
        var c = drawCanvasProbe(kind), png = c.toDataURL();
        return { kind: kind, width: c.width, height: c.height, png: png,
          hash: hash(png), repeatMatches: hash(drawCanvasProbe(kind).toDataURL()) === hash(png) };
      } catch (e) { return { kind: kind, error: String(e) }; }
    });
  }
  function webglInfo() {
    return safe(function () {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl');
      if (!gl) return null;
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var exts = gl.getSupportedExtensions();
      var params = {};
      ['MAX_TEXTURE_SIZE','MAX_RENDERBUFFER_SIZE','MAX_VERTEX_ATTRIBS','MAX_VARYING_VECTORS',
       'MAX_VERTEX_UNIFORM_VECTORS','MAX_FRAGMENT_UNIFORM_VECTORS','MAX_COMBINED_TEXTURE_IMAGE_UNITS',
       'ALIASED_LINE_WIDTH_RANGE','ALIASED_POINT_SIZE_RANGE'].forEach(function (n) {
        try {
          var v = gl.getParameter(gl[n]);
          params[n] = v && v.length !== undefined ? Array.from(v).join(',') : v;
        } catch (e) {}
      });
      var precision = {};
      [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach(function (stage) {
        ['LOW_FLOAT','MEDIUM_FLOAT','HIGH_FLOAT','LOW_INT','MEDIUM_INT','HIGH_INT'].forEach(function (p) {
          try {
            var f = gl.getShaderPrecisionFormat(stage, gl[p]);
            precision[(stage === gl.VERTEX_SHADER ? 'vs' : 'fs') + '_' + p] = f ? [f.rangeMin, f.rangeMax, f.precision].join(',') : null;
          } catch (e) {}
        });
      });
      var uRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
      return {
        vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION), slVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: uRenderer,
        extensions: exts, params: params, precision: precision,
        hash: hash([gl.getParameter(gl.RENDERER), uRenderer || '', exts.join('|')].join('|')),
      };
    });
  }
  function collectDevice() {
    var nav = navigator;
    var plugins = [];
    safe(function () {
      for (var i = 0; i < nav.plugins.length; i++)
        plugins.push([nav.plugins[i].name, nav.plugins[i].description, nav.plugins[i].filename, nav.plugins[i].length].join('::'));
    });
    return {
      userAgent: nav.userAgent, platform: nav.platform, language: nav.language,
      languages: Array.from(nav.languages || []), hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory || null, maxTouchPoints: nav.maxTouchPoints,
      webdriver: nav.webdriver === true, vendor: nav.vendor, productSub: nav.productSub,
      oscpu: nav.oscpu || null,
      screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth,
                availHeight: screen.availHeight, colorDepth: screen.colorDepth, pixelDepth: screen.pixelDepth },
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ow: outerWidth, oh: outerHeight },
      timezone: safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }),
      timezoneOffset: new Date().getTimezoneOffset(),
      plugins: plugins,
      mimeTypes: safe(function () { return Array.from(nav.mimeTypes).map(function (m) { return m.type; }); }) || [],
      canvasHash: canvasHash(), canvas: canvasDetails(), webgl: webglInfo(),
      storage: { localStorage: safe(function () { return !!window.localStorage; }), indexedDB: safe(function () { return !!window.indexedDB; }), cookies: nav.cookieEnabled },
      features: { serviceWorker: 'serviceWorker' in nav, webassembly: typeof WebAssembly === 'object',
                  offscreenCanvas: !!window.OffscreenCanvas, touch: 'ontouchstart' in window },
    };
  }

  // ================= VENDOR-MATRIX SIGNALS (v2) =================

  var FONT_PROBE = ['Arial','Arial Black','Arial Narrow','Arial Rounded MT Bold','Avenir','Avenir Next',
    'Baskerville','Bodoni 72','Bradley Hand','Brush Script MT','Calibri','Cambria','Candara','Chalkboard',
    'Chalkduster','Charter','Chicago','Cochin','Comic Sans MS','Consolas','Constantia','Copperplate',
    'Courier New','Didot','Futura','Geneva','Georgia','Gill Sans','Helvetica','Helvetica Neue',
    'Herculanum','Impact','Lucida Grande','Luminari','Marker Felt','Menlo','Microsoft Sans Serif','Monaco',
    'Optima','Palatino','Papyrus','Perpetua','Rockwell','SF Pro Text','Skia','Snell Roundhand',
    'Tahoma','Times','Times New Roman','Trattatello','Trebuchet MS','Verdana','Zapfino',
    'Noto Sans','Noto Sans JP','Noto Sans SC','Roboto','Segoe UI','Ubuntu','Cantarell','DejaVu Sans','Fira Sans'];
  function fonts() {
    return safe(function () {
      var span = document.createElement('span');
      span.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;white-space:nowrap;';
      span.textContent = 'mmmmmmmmmmlliWQ@%0O';
      document.body.appendChild(span);
      function widthFor(family) {
        span.style.fontFamily = family + ', monospace';
        return span.offsetWidth + 'x' + (span.getBoundingClientRect().width || 0).toFixed(2);
      }
      var base = widthFor('monospace');
      var present = [];
      FONT_PROBE.forEach(function (font) {
        var w = widthFor("'" + font + "'");
        if (w !== base) present.push(font + ':' + w);
      });
      document.body.removeChild(span);
      return { count: present.length, fonts: present, hash: hash(present.join('|')) };
    });
  }

  function mathProbes() {
    return safe(function () {
      var out = {};
      out.sin1e300 = Math.sin(1e300);
      out.tanNeg1e300 = Math.tan(-1e300);
      out.pow = Math.pow(Math.PI, -100);
      out.acos = Math.acos(0.123);
      out.roundHalves = [Math.round(0.5), Math.round(-0.5), Math.round(1.5)].join('/');
      out.fround = Math.fround(1.1);
      out.strHash = hash(JSON.stringify(out));
      return out;
    });
  }

  function permissions(done) {
    safeAsync(function (finish) {
      var out = { notification: safe(function () { return Notification.permission; }) };
      if (!navigator.permissions || !navigator.permissions.query) return finish(out);
      var names = ['geolocation', 'notifications', 'camera', 'microphone'];
      var pending = names.length;
      names.forEach(function (name) {
        navigator.permissions.query({ name: name }).then(function (status) {
          out[name] = status.state;
        }).catch(function (e) {
          out[name] = 'err:' + (e && e.name);
        }).then(function () { if (--pending === 0) finish(out); });
      });
    }, done);
  }

  function integrity() {
    return {
      webdriver: navigator.webdriver === true,
      codexAnnotationRoot: safe(function () {
        var root = document.getElementById('codex-browser-sidebar-comments-root');
        return !!(root && root.tagName === 'DIV' && root.shadowRoot);
      }),
      pluginCoherence: safe(function () {
        return navigator.plugins.length > 0 && /PDF/.test(navigator.plugins[0].name);
      }),
      windowDelta: [outerWidth - innerWidth, outerHeight - innerHeight],
      fnToString: ['fetch', 'setTimeout', 'createElement'].map(function (name) {
        return safe(function () { return /\{\s*\[native code\]\s*\}/.test(window[name].toString()); });
      }),
      chromeRuntime: !!(window.chrome && window.chrome.runtime),
      stackFormat: safe(function () {
        try { null.x; } catch (e) { return String(e.stack).split('\n').length + ':' + (/chrome-extension/.test(e.stack) ? 'ext' : 'plain'); }
      }),
      hasNotification: 'Notification' in window,
      languagesEmpty: !(navigator.languages && navigator.languages.length),
      isIframed: window.top !== window.self,
      historyLength: history.length,
      hasReferrer: !!document.referrer,
      battery: safe(function () { return navigator.getBattery ? 'supported' : 'absent'; }),
      gamepads: safe(function () { return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean).length : null; }),
      hasBluetooth: !!navigator.bluetooth, hasUsb: !!navigator.usb, hasHid: !!navigator.hid,
      codecs: safe(function () {
        var v = document.createElement('video');
        var tests = { h264: 'video/mp4; codecs="avc1.42E01E"', vp9: 'video/webm; codecs="vp9"',
                      av1: 'video/mp4; codecs="av01.0.05M.08"', hevc: 'video/mp4; codecs="hvc1"' };
        return Object.keys(tests).map(function (c) { return c + ':' + v.canPlayType(tests[c]); }).join('|');
      }),
    };
  }

  function timingSignals() {
    return safe(function () {
      var t0 = performance.now(), d0 = Date.now();
      var a = performance.now();
      for (var i = 0; i < 1e5; i++) {}
      var b = performance.now();
      return {
        nowPrecision: b - a,
        perfVsDate: (performance.now() - t0) - (Date.now() - d0),
        timeOrigin: performance.timeOrigin || (performance.timing && performance.timing.navigationStart),
        navigationTiming: safe(function () {
          var nav = performance.getEntriesByType('navigation')[0];
          if (!nav) return null;
          return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd),
                   transferSize: nav.transferSize, type: nav.type, redirect: nav.redirectCount,
                   dnsMs: Math.max(0, nav.domainLookupEnd - nav.domainLookupStart),
                   connectMs: Math.max(0, nav.connectEnd - nav.connectStart),
                   tlsMs: nav.secureConnectionStart > 0 ? Math.max(0, nav.connectEnd - nav.secureConnectionStart) : null,
                   responseWaitMs: Math.max(0, nav.responseStart - nav.requestStart),
                   responseDownloadMs: Math.max(0, nav.responseEnd - nav.responseStart),
                   domInteractive: nav.domInteractive, responseEnd: nav.responseEnd };
        }),
        paintTiming: safe(function () {
          return performance.getEntriesByType('paint').map(function (p) { return p.name + ':' + Math.round(p.startTime); });
        }),
        resourceCount: safe(function () { return performance.getEntriesByType('resource').length; }),
      };
    });
  }

  function cssEnvironment() {
    return safe(function () {
      var probes = {};
      ['(hover: hover)', '(any-hover: hover)', '(pointer: fine)', '(any-pointer: fine)',
       '(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(display-mode: standalone)',
       '(forced-colors: active)', '(inverted-colors: inverted)'].forEach(function (q) {
        probes[q] = matchMedia(q).matches;
      });
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;height:100px;width:100px;';
      document.body.appendChild(probe);
      probes.scrollHeightRatio = probe.scrollHeight / 100;
      document.body.removeChild(probe);
      return probes;
    });
  }

  function connection() {
    return safe(function () {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return null;
      return { effectiveType: c.effectiveType, rtt: c.rtt, downlink: c.downlink, saveData: c.saveData };
    });
  }


export { collectDevice, fonts, mathProbes, timingSignals, cssEnvironment, connection, integrity, canvasPreview, canvasDetails };
