/*
  DatePicker - Pure JS date picker
  Public API:
    new DatePicker(inputOrSelector, options?)
    instance.open()
    instance.close()
    instance.toggle()
    instance.destroy()
    instance.getDate() -> Date|null
    instance.setDate(Date|string|null)
    instance.updateOptions(partialOptions)

  Options (all optional):
    format: string (default 'yyyy-MM-dd')
    firstDayOfWeek: 0..6 (default 0, Sunday)
    minDate: Date|string|null
    maxDate: Date|string|null
    disableDates: (date: Date) => boolean
    onSelect: (date: Date|null, ctx: { formatted: string, source: 'user'|'api' }) => void
    i18n: {
      months?: string[] (length 12, Jan..Dec)
      weekdays?: string[] (length 7, Sun..Sat)
      buttons?: { today?: string, clear?: string, close?: string }
      aria?: { previousMonth?: string, nextMonth?: string, calendar?: string }
    }
    openOnFocus: boolean (default true)
    autoClose: boolean (default true)
    showOutsideDays: boolean (default true)
    inline: boolean (default false)
    position: 'auto'|'bottom'|'top' (default 'auto')

  License: MIT
*/

(function () {
  'use strict';

  const DEFAULT_FORMAT = 'yyyy-MM-dd';
  function clampMinuteToStep(minute, step) {
    var m = Number(minute);
    var s = Number(step) || 5;
    if (s <= 0) return m;
    var down = Math.floor(m / s) * s;
    var up = Math.ceil(m / s) * s;
    if (Math.abs(m - down) <= Math.abs(up - m)) return down % 60;
    return up % 60;
  }

  function padStartNumber(value, length) {
    return String(value).padStart(length, '0');
  }

  function startOfDay(localDate) {
    return new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
  }

  function isValidDate(maybeDate) {
    return maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime());
  }

  function areSameCalendarDate(a, b) {
    if (!isValidDate(a) || !isValidDate(b)) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function clampDate(date, minDate, maxDate) {
    if (!isValidDate(date)) return date;
    let value = date;
    if (isValidDate(minDate) && value < minDate) value = minDate;
    if (isValidDate(maxDate) && value > maxDate) value = maxDate;
    return value;
  }

  function addDays(baseDate, days) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(baseDate, months) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function startOfWeek(date, firstDayOfWeek) {
    const day = date.getDay();
    const diff = (day - firstDayOfWeek + 7) % 7;
    return addDays(date, -diff);
  }

  function buildWeekdayOrder(firstDayOfWeek) {
    const order = [];
    for (let i = 0; i < 7; i += 1) order.push((firstDayOfWeek + i) % 7);
    return order;
  }

  function getDefaultLocale() {
    try {
      return (navigator && navigator.language) || 'en-US';
    } catch (_) {
      return 'en-US';
    }
  }

  function buildDefaultI18n(firstDayOfWeek) {
    const locale = getDefaultLocale();
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long' });
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    const months = Array.from({ length: 12 }, (_, idx) => monthFormatter.format(new Date(2020, idx, 1)));
    const weekdaysAll = Array.from({ length: 7 }, (_, idx) => weekdayFormatter.format(new Date(2020, 10, 1 + idx)));
    const order = buildWeekdayOrder(firstDayOfWeek);
    const weekdays = order.map((o) => weekdaysAll[o]);

    const isKorean = String(locale).startsWith('ko');
    const buttons = {
      today: isKorean ? '오늘' : 'Today',
      clear: isKorean ? '지우기' : 'Clear',
      close: isKorean ? '닫기' : 'Close',
    };
    const aria = {
      previousMonth: isKorean ? '이전 달' : 'Previous month',
      nextMonth: isKorean ? '다음 달' : 'Next month',
      calendar: isKorean ? '달력' : 'Calendar',
    };

    return { months, weekdays, buttons, aria };
  }

  function formatDate(date, formatString) {
    if (!isValidDate(date)) return '';
    const yyyy = date.getFullYear();
    const MM = padStartNumber(date.getMonth() + 1, 2);
    const dd = padStartNumber(date.getDate(), 2);
    const hours24 = date.getHours ? date.getHours() : 0;
    const HH = padStartNumber(hours24, 2);
    const h12Raw = hours24 % 12; // 0..11
    const h12Val = h12Raw === 0 ? 12 : h12Raw; // 1..12
    const hh = padStartNumber(h12Val, 2);
    const a = hours24 >= 12 ? 'PM' : 'AM';
    const mm = padStartNumber(date.getMinutes ? date.getMinutes() : 0, 2);
    return String(formatString)
      .replace(/yyyy/g, String(yyyy))
      .replace(/MM/g, MM)
      .replace(/dd/g, dd)
      .replace(/HH/g, HH)
      .replace(/hh/g, hh)
      .replace(/mm/g, mm)
      .replace(/\ba\b/g, a);
  }

  function parseDate(value, formatString) {
    if (value == null || value === '') return null;
    // Parser for tokens yyyy, MM, dd, HH, hh, mm, a
    const fmt = String(formatString || DEFAULT_FORMAT);
    const esc = fmt
      .replace(/yyyy/g, '(?<year>\\d{4})')
      .replace(/MM/g, '(?<month>\\d{1,2})')
      .replace(/dd/g, '(?<day>\\d{1,2})')
      .replace(/HH/g, '(?<hour24>\\d{1,2})')
      .replace(/hh/g, '(?<hour12>\\d{1,2})')
      .replace(/mm/g, '(?<minute>\\d{1,2})')
      .replace(/\ba/g, '(?<ampm>AM|PM|am|pm)');
    const regex = new RegExp('^' + esc + '$');
    const m = String(value).match(regex);
    if (!m) return null;
    const groups = m.groups || {};
    const year = Number(groups.year);
    const monthIndex = Number(groups.month) - 1;
    const day = Number(groups.day);
    let hour = 0;
    if (groups.hour24 != null) {
      hour = Math.min(23, Math.max(0, Number(groups.hour24)));
    } else if (groups.hour12 != null) {
      let h12 = Math.min(12, Math.max(1, Number(groups.hour12)));
      const ampm = groups.ampm || '';
      const isPm = /pm/i.test(ampm);
      if (isPm) {
        hour = (h12 % 12) + 12; // 12PM -> 12, 1PM -> 13
      } else {
        hour = h12 % 12; // 12AM or no ampm -> 0
      }
    }
    const minute = groups.minute != null ? Math.min(59, Math.max(0, Number(groups.minute))) : 0;
    const d = new Date(year, monthIndex, day, hour, minute);
    return isValidDate(d) ? d : null;
  }

  function toISODateString(date) {
    if (!isValidDate(date)) return '';
    return [
      padStartNumber(date.getFullYear(), 4),
      padStartNumber(date.getMonth() + 1, 2),
      padStartNumber(date.getDate(), 2),
    ].join('-');
  }

  function isDateOutOfBounds(date, minDate, maxDate) {
    if (!isValidDate(date)) return true;
    if (isValidDate(minDate) && date < minDate) return true;
    if (isValidDate(maxDate) && date > maxDate) return true;
    return false;
  }

  function createElement(tagName, className, attributes) {
    const el = document.createElement(tagName);
    if (className) el.className = className;
    if (attributes) {
      Object.keys(attributes).forEach((key) => {
        el.setAttribute(key, attributes[key]);
      });
    }
    return el;
  }

  function getBoundingPositionAround(element, calendarEl, preferred) {
    const rect = element.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportHeight = document.documentElement.clientHeight;
    const calendarHeight = calendarEl.offsetHeight || 308;

    let top = rect.bottom + scrollTop + 4;
    let placement = 'bottom';
    if (preferred === 'top' || (preferred === 'auto' && rect.bottom + calendarHeight > viewportHeight && rect.top > calendarHeight)) {
      top = rect.top + scrollTop - calendarHeight - 4;
      placement = 'top';
    }
    const left = rect.left + scrollLeft;
    return { top, left, placement };
  }

  class DatePicker {
    constructor(inputOrSelector, options) {
      const input = typeof inputOrSelector === 'string' ? document.querySelector(inputOrSelector) : inputOrSelector;
      if (!input) throw new Error('DatePicker: target element not found');
      this.inputElement = input;

      const initialOptions = options || {};
      const firstDayOfWeek = Number.isInteger(initialOptions.firstDayOfWeek) ? initialOptions.firstDayOfWeek : 0;
      const i18n = Object.assign({}, buildDefaultI18n(firstDayOfWeek), initialOptions.i18n || {});

      this.options = {
        format: initialOptions.format || DEFAULT_FORMAT,
        firstDayOfWeek,
        minDate: this._normalizeDate(initialOptions.minDate),
        maxDate: this._normalizeDate(initialOptions.maxDate),
        disableDates: typeof initialOptions.disableDates === 'function' ? initialOptions.disableDates : null,
        onSelect: typeof initialOptions.onSelect === 'function' ? initialOptions.onSelect : null,
        i18n,
        openOnFocus: initialOptions.openOnFocus !== false,
        autoClose: initialOptions.autoClose !== false,
        showOutsideDays: initialOptions.showOutsideDays !== false,
        inline: Boolean(initialOptions.inline),
        position: initialOptions.position || 'auto',
        enableTime: Boolean(initialOptions.enableTime),
        timeStep: Number(initialOptions.timeStep) > 0 ? Number(initialOptions.timeStep) : 5,
        showAnalogClock: Boolean(initialOptions.showAnalogClock),
        showAnalogSeconds: false,
        showAnalogNumbers: true,
        hour12: Boolean(initialOptions.hour12),
        inlineContainer: initialOptions.inlineContainer || null,
      };

      this.selectedDate = null;
      this.focusedDate = null;
      this.currentViewMonth = startOfMonth(new Date());
      this.isOpen = false;
      this.timeHours = 0;
      this.timeMinutes = 0;

      const existingValue = String(this.inputElement.value || '').trim();
      if (existingValue) {
        const parsed = parseDate(existingValue, this.options.format);
        if (parsed) {
          if (this.options.enableTime) {
            this.selectedDate = new Date(parsed.getTime());
            this._initTimeFromDate(parsed);
          } else {
            this.selectedDate = startOfDay(parsed);
          }
        }
      }

      this._build();
      if (this.options.inline) {
        this.open();
      } else if (this.options.openOnFocus) {
        this.inputElement.addEventListener('focus', () => this.open());
        this.inputElement.addEventListener('click', () => this.open());
      } else {
        this.inputElement.addEventListener('click', () => this.toggle());
      }
    }

    _normalizeDate(dateOrString) {
      if (!dateOrString) return null;
      if (isValidDate(dateOrString)) {
        if (this && this.options && this.options.enableTime) return new Date(dateOrString.getTime());
        return startOfDay(dateOrString);
      }
      const parsed = parseDate(String(dateOrString), this ? this.options && this.options.format ? this.options.format : DEFAULT_FORMAT : DEFAULT_FORMAT);
      if (!parsed) return null;
      if (this && this.options && this.options.enableTime) return new Date(parsed.getTime());
      return startOfDay(parsed);
    }

    _build() {
      this.wrapperElement = createElement('div', 'dp-popover', { 'data-dp-root': '1' });
      this.calendarElement = createElement('div', 'dp', { role: 'dialog', 'aria-label': this.options.i18n.aria.calendar });
      this.wrapperElement.appendChild(this.calendarElement);

      // Header
      const header = createElement('div', 'dp-header');
      this.prevButton = createElement('button', 'dp-nav dp-prev', { type: 'button', 'aria-label': this.options.i18n.aria.previousMonth });
      this.prevButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      this.nextButton = createElement('button', 'dp-nav dp-next', { type: 'button', 'aria-label': this.options.i18n.aria.nextMonth });
      this.nextButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      this.monthYearLabel = createElement('div', 'dp-month');
      this._buildMonthYearControls();
      this.headerRight = createElement('div', 'dp-header-right');
      this.headerRight.appendChild(this.nextButton);
      header.appendChild(this.prevButton);
      header.appendChild(this.monthYearLabel);
      header.appendChild(this.headerRight);

      // Weekdays
      this.weekdaysRow = createElement('div', 'dp-weekdays', { role: 'row' });

      // Days grid
      this.daysGrid = createElement('div', 'dp-days', { role: 'grid' });

      // Time controls (optional)
      this.timeRow = null;
      if (this.options.enableTime) {
        this._buildTimeControls();
      }

      // Footer
      this.footer = createElement('div', 'dp-footer');
      this.todayButton = createElement('button', 'dp-btn dp-today', { type: 'button' });
      this.todayButton.textContent = this.options.i18n.buttons.today;
      this.clearButton = createElement('button', 'dp-btn dp-clear', { type: 'button' });
      this.clearButton.textContent = this.options.i18n.buttons.clear;

      this.footer.appendChild(this.todayButton);
      this.footer.appendChild(this.clearButton);

      // Build content layout (main + optional clock)
      this.contentElement = createElement('div', 'dp-content');
      this.mainContainer = createElement('div', 'dp-main');
      this.mainContainer.appendChild(header);
      this.mainContainer.appendChild(this.weekdaysRow);
      this.mainContainer.appendChild(this.daysGrid);
      this.mainContainer.appendChild(this.footer);

      // Optional clock
      this.clockContainer = null;
      if (this.options.showAnalogClock) {
        this.clockContainer = createElement('div', 'dp-clock');
        this._buildClock();
      }

      this.contentElement.appendChild(this.mainContainer);
      if (this.clockContainer) {
        this.contentElement.appendChild(this.clockContainer);
        this.calendarElement.classList.add('has-clock');
      }
      // Place time controls depending on clock option
      if (this.timeRow) {
        if (this.options.showAnalogClock && this.clockContainer) {
          this.clockContainer.appendChild(this.timeRow);
        } else {
          this.mainContainer.insertBefore(this.timeRow, this.footer);
        }
      }
      this.calendarElement.appendChild(this.contentElement);

      // Attach listeners
      this.prevButton.addEventListener('click', () => this._goToPreviousMonth());
      this.nextButton.addEventListener('click', () => this._goToNextMonth());
      var self = this;
      this.todayButton.addEventListener('click', function () { self._selectToday(); });
      this.clearButton.addEventListener('click', function () { self._clearSelection(); });
      // no close icon/button
      this.calendarElement.addEventListener('keydown', function (e) { self._onKeyDown(e); });

      // Pre-render weekday names
      this._renderWeekdays();
      this._render();
      this._updateClock();

      if (this.options.inline) {
        // Insert into specified container or after input element
        var container = null;
        if (this.options.inlineContainer) {
          container = typeof this.options.inlineContainer === 'string'
            ? document.querySelector(this.options.inlineContainer)
            : this.options.inlineContainer;
        }
        if (container) {
          container.appendChild(this.calendarElement);
        } else {
          this.inputElement.insertAdjacentElement('afterend', this.calendarElement);
        }
        this.wrapperElement = null; // not used in inline
        if (this.options.showAnalogClock) this._startClockTimer();
      }
    }

    _buildClock() {
      this.clockFace = createElement('div', 'dp-clock-face');
      this.clockHourHand = createElement('div', 'dp-clock-hand dp-clock-hour');
      this.clockMinuteHand = createElement('div', 'dp-clock-hand dp-clock-minute');
      this.clockSecondHand = createElement('div', 'dp-clock-hand dp-clock-second');
      this.clockCenter = createElement('div', 'dp-clock-center');
      this.clockFace.appendChild(this.clockHourHand);
      this.clockFace.appendChild(this.clockMinuteHand);
      this.clockFace.appendChild(this.clockSecondHand);
      this.clockFace.appendChild(this.clockCenter);

      // Numbers (1..12)
      this.clockNumbers = createElement('div', 'dp-clock-numbers');
      for (var num = 1; num <= 12; num += 1) {
        var el = createElement('div', 'dp-clock-number');
        el.textContent = String(num);
        var angle = (num % 12) * 30; // degrees
        el.style.transform = 'translate(-50%, -50%) rotate(' + angle + 'deg) translateY(-74px) rotate(' + (-angle) + 'deg)';
        this.clockNumbers.appendChild(el);
      }
      this.clockFace.appendChild(this.clockNumbers);
      this.clockContainer.appendChild(this.clockFace);
    }

    _updateClock() {
      if (!this.options.showAnalogClock || !this.clockContainer) return;
      var base;
      if (this.options.enableTime) {
        var ref = this.selectedDate || new Date();
        base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), this.timeHours || 0, this.timeMinutes || 0);
      } else if (this.selectedDate) {
        base = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate());
      } else {
        base = new Date();
      }
      var hours = base.getHours();
      var minutes = base.getMinutes();
      var seconds = base.getSeconds();
      var secondBase = this.options.enableTime ? 0 : seconds;
      var hourDeg = (hours % 12) * 30 + minutes * 0.5 + secondBase / 120;
      var minuteDeg = minutes * 6 + secondBase * 0.1;
      var secondDeg = seconds * 6;
      this.clockHourHand.style.transform = 'translateX(-50%) rotate(' + String(hourDeg) + 'deg)';
      this.clockMinuteHand.style.transform = 'translateX(-50%) rotate(' + String(minuteDeg) + 'deg)';
      if (this.clockSecondHand) {
        this.clockSecondHand.style.display = 'none';
      }
    }

    _startClockTimer() {
      if (!this.options.showAnalogClock) return;
      var self = this;
      if (this.clockTimer) clearInterval(this.clockTimer);
      var interval = 30000;
      this.clockTimer = setInterval(function () { self._updateClock(); }, interval);
    }

    _stopClockTimer() {
      if (this.clockTimer) {
        clearInterval(this.clockTimer);
        this.clockTimer = null;
      }
    }

    _buildMonthYearControls() {
      var isKorean = false;
      try { isKorean = String(getDefaultLocale()).startsWith('ko'); } catch (_) {}
      this.monthSelect = createElement('select', 'dp-month-select', { 'aria-label': isKorean ? '월' : 'Month' });
      this.yearSelect = createElement('select', 'dp-year-select', { 'aria-label': isKorean ? '년' : 'Year' });
      // Month options localized
      var i;
      for (i = 0; i < 12; i += 1) {
        var opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = this.options.i18n.months[i];
        this.monthSelect.appendChild(opt);
      }
      // Year options
      this._rebuildYearOptions();
      this.monthYearLabel.textContent = '';
      this.monthYearLabel.appendChild(this.monthSelect);
      this.monthYearLabel.appendChild(this.yearSelect);
      var self = this;
      this.monthSelect.addEventListener('change', function () {
        var monthIndex = Number(self.monthSelect.value) || 0;
        var y = self.currentViewMonth.getFullYear();
        self.currentViewMonth = new Date(y, monthIndex, 1);
        self._render();
      });
      this.yearSelect.addEventListener('change', function () {
        var year = Number(self.yearSelect.value) || self.currentViewMonth.getFullYear();
        var m = self.currentViewMonth.getMonth();
        self.currentViewMonth = new Date(year, m, 1);
        self._render();
      });
      this._syncMonthYearControls();
    }

    _computeYearRange() {
      var nowYear = new Date().getFullYear();
      var start = nowYear - 50;
      var end = nowYear + 50;
      if (isValidDate(this.options.minDate)) start = this.options.minDate.getFullYear();
      if (isValidDate(this.options.maxDate)) end = this.options.maxDate.getFullYear();
      var viewYear = this.currentViewMonth ? this.currentViewMonth.getFullYear() : nowYear;
      if (viewYear < start) start = viewYear;
      if (viewYear > end) end = viewYear;
      if (start > end) {
        var tmp = start; start = end; end = tmp;
      }
      return { start: start, end: end };
    }

    _rebuildYearOptions() {
      if (!this.yearSelect) return;
      var range = this._computeYearRange();
      this.yearSelect.textContent = '';
      var y;
      for (y = range.start; y <= range.end; y += 1) {
        var optY = document.createElement('option');
        optY.value = String(y);
        optY.textContent = String(y);
        this.yearSelect.appendChild(optY);
      }
    }

    _syncMonthYearControls() {
      if (!this.monthSelect || !this.yearSelect) return;
      this._rebuildYearOptions();
      this.monthSelect.value = String(this.currentViewMonth.getMonth());
      this.yearSelect.value = String(this.currentViewMonth.getFullYear());
    }

    _buildTimeControls() {
      var self = this;
      this.timeRow = createElement('div', 'dp-time');

      // AM/PM select for 12-hour mode
      this.ampmSelect = null;
      if (this.options.hour12) {
        this.ampmSelect = createElement('select', 'dp-time-ampm', { 'aria-label': 'AM/PM' });
        var optAm = document.createElement('option'); optAm.value = 'AM'; optAm.textContent = 'AM';
        var optPm = document.createElement('option'); optPm.value = 'PM'; optPm.textContent = 'PM';
        this.ampmSelect.appendChild(optAm);
        this.ampmSelect.appendChild(optPm);
      }

      this.hourSelect = createElement('select', 'dp-time-hour', { 'aria-label': 'Hour' });
      this.minuteSelect = createElement('select', 'dp-time-minute', { 'aria-label': 'Minute' });

      // Hour options
      if (this.options.hour12) {
        var h12;
        for (h12 = 1; h12 <= 12; h12 += 1) {
          var optH12 = document.createElement('option');
          optH12.value = String(h12);
          optH12.textContent = padStartNumber(h12, 2);
          this.hourSelect.appendChild(optH12);
        }
      } else {
        var h;
        for (h = 0; h < 24; h += 1) {
          var optH = document.createElement('option');
          optH.value = String(h);
          optH.textContent = padStartNumber(h, 2);
          this.hourSelect.appendChild(optH);
        }
      }

      // Minute options by step
      this._rebuildMinuteOptions();

      // Append in order: AM/PM (if any), Hour, Minute
      if (this.ampmSelect) this.timeRow.appendChild(this.ampmSelect);
      this.timeRow.appendChild(this.hourSelect);
      this.timeRow.appendChild(this.minuteSelect);

      // Initialize from selectedDate if any
      if (this.selectedDate) {
        this._initTimeFromDate(this.selectedDate);
      }
      this._updateTimeInputs();

      // Listeners
      this.hourSelect.addEventListener('change', function () {
        var nh;
        if (self.options.hour12) {
          var h12v = Number(self.hourSelect.value) || 12; // 1..12
          var base = h12v % 12; // 12->0
          var isPm = self.ampmSelect ? self.ampmSelect.value === 'PM' : false;
          nh = isPm ? base + 12 : base;
        } else {
          nh = Number(self.hourSelect.value);
        }
        self._setTime(nh, self.timeMinutes, true);
      });
      this.minuteSelect.addEventListener('change', function () {
        var nm = Number(self.minuteSelect.value);
        self._setTime(self.timeHours, nm, true);
      });
      if (this.ampmSelect) {
        this.ampmSelect.addEventListener('change', function () {
          var h12v = Number(self.hourSelect.value) || 12;
          var base = h12v % 12;
          var isPm = self.ampmSelect.value === 'PM';
          var nh = isPm ? base + 12 : base;
          self._setTime(nh, self.timeMinutes, true);
        });
      }
    }

    _rebuildMinuteOptions() {
      var step = Number(this.options.timeStep) > 0 ? Number(this.options.timeStep) : 5;
      this.minuteSelect = this.minuteSelect || createElement('select', 'dp-time-minute', { 'aria-label': 'Minute' });
      this.minuteSelect.textContent = '';
      var m = 0;
      while (m < 60) {
        var optM = document.createElement('option');
        optM.value = String(m);
        optM.textContent = padStartNumber(m, 2);
        this.minuteSelect.appendChild(optM);
        m += step;
      }
    }

    _initTimeFromDate(d) {
      if (!isValidDate(d)) return;
      this.timeHours = d.getHours();
      this.timeMinutes = clampMinuteToStep(d.getMinutes(), this.options.timeStep);
    }

    _updateTimeInputs() {
      if (!this.options.enableTime || !this.timeRow) return;

      // Hour + AM/PM
      if (this.options.hour12) {
        var isPm = (this.timeHours >= 12);
        var disp = this.timeHours % 12; if (disp === 0) disp = 12;
        if (this.ampmSelect) this.ampmSelect.value = isPm ? 'PM' : 'AM';
        this.hourSelect.value = String(disp);
      } else {
        this.hourSelect.value = String(this.timeHours);
      }

      // Minute
      var step = Number(this.options.timeStep) > 0 ? Number(this.options.timeStep) : 5;
      var minuteValue = clampMinuteToStep(this.timeMinutes, step);
      this.timeMinutes = minuteValue;
      var exists = false;
      var i;
      for (i = 0; i < this.minuteSelect.options.length; i += 1) {
        if (Number(this.minuteSelect.options[i].value) === minuteValue) { exists = true; break; }
      }
      if (!exists) {
        var opt = document.createElement('option');
        opt.value = String(minuteValue);
        opt.textContent = padStartNumber(minuteValue, 2);
        this.minuteSelect.appendChild(opt);
      }
      this.minuteSelect.value = String(minuteValue);
    }

    _setTime(hour, minute, fromUser) {
      this.timeHours = Math.max(0, Math.min(23, Number(hour) || 0));
      this.timeMinutes = clampMinuteToStep(Math.max(0, Math.min(59, Number(minute) || 0)), this.options.timeStep);
      this._updateTimeInputs();
      this._updateClock();
      if (this.selectedDate) {
        var d = this.selectedDate;
        var newDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.timeHours, this.timeMinutes);
        this._applySelection(newDate, fromUser ? 'user' : 'api');
      }
    }

    _renderWeekdays() {
      this.weekdaysRow.textContent = '';
      const names = this.options.i18n.weekdays;
      names.forEach((n) => {
        const el = createElement('div', 'dp-weekday', { role: 'columnheader' });
        el.textContent = n;
        this.weekdaysRow.appendChild(el);
      });
    }

    _render() {
      // Header month/year select sync
      this._syncMonthYearControls();

      // Build days grid
      this.daysGrid.textContent = '';
      const firstDay = startOfMonth(this.currentViewMonth);
      const lastDay = endOfMonth(this.currentViewMonth);
      const gridStart = startOfWeek(firstDay, this.options.firstDayOfWeek);
      // Always render 6 weeks (42 days)
      for (let i = 0; i < 42; i += 1) {
        const dayDate = addDays(gridStart, i);
        const isOutside = dayDate.getMonth() !== this.currentViewMonth.getMonth();
        if (!this.options.showOutsideDays && isOutside) {
          const filler = createElement('div', 'dp-day is-empty', { role: 'gridcell', 'aria-disabled': 'true' });
          this.daysGrid.appendChild(filler);
          continue;
        }
        const isToday = areSameCalendarDate(dayDate, new Date());
        const isSelected = this.selectedDate ? areSameCalendarDate(dayDate, this.selectedDate) : false;
        const disabledByBounds = isDateOutOfBounds(dayDate, this.options.minDate, this.options.maxDate);
        const disabledByFn = this.options.disableDates ? this.options.disableDates(dayDate) : false;
        const isDisabled = disabledByBounds || Boolean(disabledByFn);

        const cell = createElement('button', 'dp-day', {
          type: 'button',
          role: 'gridcell',
          'aria-selected': String(isSelected),
          'aria-disabled': String(isDisabled),
          'data-date': toISODateString(dayDate),
        });
        cell.textContent = String(dayDate.getDate());
        if (isOutside) cell.classList.add('is-outside');
        if (isToday) cell.classList.add('is-today');
        if (isSelected) cell.classList.add('is-selected');
        if (isDisabled) cell.classList.add('is-disabled');

        if (!isDisabled) {
          var selfCell = this;
          cell.addEventListener('click', function () {
            selfCell._selectDate(dayDate, 'user');
            if (selfCell.options.autoClose && !selfCell.options.inline && !selfCell.options.enableTime) selfCell.close();
          });
        }

        this.daysGrid.appendChild(cell);
      }
      this._updateClock();
    }

    _onKeyDown(event) {
      const key = event.key;
      const prevent = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' '].includes(key)) {
        prevent();
      }
      const baseDate = this.focusedDate || this.selectedDate || new Date();
      let nextFocus = null;
      switch (key) {
        case 'ArrowLeft':
          nextFocus = addDays(baseDate, -1); break;
        case 'ArrowRight':
          nextFocus = addDays(baseDate, 1); break;
        case 'ArrowUp':
          nextFocus = addDays(baseDate, -7); break;
        case 'ArrowDown':
          nextFocus = addDays(baseDate, 7); break;
        case 'Home': {
          const weekStart = startOfWeek(baseDate, this.options.firstDayOfWeek); nextFocus = weekStart; break;
        }
        case 'End': {
          const weekStart = startOfWeek(baseDate, this.options.firstDayOfWeek); nextFocus = addDays(weekStart, 6); break;
        }
        case 'PageUp':
          nextFocus = addMonths(baseDate, -1); break;
        case 'PageDown':
          nextFocus = addMonths(baseDate, 1); break;
        case 'Enter':
        case ' ': {
          const target = this.focusedDate || this.selectedDate || new Date();
          if (!isDateOutOfBounds(target, this.options.minDate, this.options.maxDate) && !(this.options.disableDates && this.options.disableDates(target))) {
            this._selectDate(target, 'user');
            if (this.options.autoClose && !this.options.inline) this.close();
          }
          return;
        }
        case 'Escape':
          this.close();
          return;
        default:
          return;
      }

      if (nextFocus) {
        this.focusedDate = startOfDay(nextFocus);
        const nextMonth = startOfMonth(this.focusedDate);
        if (nextMonth.getTime() !== this.currentViewMonth.getTime()) {
          this.currentViewMonth = nextMonth;
        }
        this._render();
      }
    }

    _goToPreviousMonth() {
      this.currentViewMonth = addMonths(this.currentViewMonth, -1);
      this._render();
    }

    _goToNextMonth() {
      this.currentViewMonth = addMonths(this.currentViewMonth, 1);
      this._render();
    }

    _selectToday() {
      const now = new Date();
      const today = startOfDay(now);
      if (isDateOutOfBounds(today, this.options.minDate, this.options.maxDate)) return;
      if (this.options.disableDates && this.options.disableDates(today)) return;
      this.currentViewMonth = startOfMonth(today);
      if (this.options.enableTime) {
        this.timeHours = now.getHours();
        this.timeMinutes = clampMinuteToStep(now.getMinutes(), this.options.timeStep);
        this._updateTimeInputs();
      }
      this._selectDate(today, 'user');
      if (this.options.autoClose && !this.options.inline) this.close();
    }

    _clearSelection() {
      this.setDate(null, 'user');
      if (!this.options.inline && this.options.autoClose) this.close();
    }

    _selectDate(date, source) {
      var finalDate;
      if (this.options.enableTime) {
        var hh = this.timeHours || 0;
        var mm = this.timeMinutes || 0;
        finalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm);
      } else {
        finalDate = startOfDay(date);
      }
      this._applySelection(finalDate, source);
    }

    _applySelection(dateTime, source) {
      this.selectedDate = new Date(dateTime.getTime());
      const formatted = formatDate(this.selectedDate, this.options.format);
      this.inputElement.value = formatted;
      this.focusedDate = startOfDay(this.selectedDate);
      this._render();
      if (typeof this.options.onSelect === 'function') {
        try {
          this.options.onSelect(new Date(this.selectedDate.getTime()), { formatted: formatted, source: source || 'api' });
        } catch (_) {}
      }
      const changeEvent = new Event('change', { bubbles: true });
      this.inputElement.dispatchEvent(changeEvent);
    }

    open() {
      if (this.isOpen && !this.options.inline) return;
      if (this.options.inline) {
        this.isOpen = true;
        return;
      }
      document.body.appendChild(this.wrapperElement);
      this.wrapperElement.style.visibility = 'hidden';
      this.wrapperElement.style.position = 'absolute';
      this.wrapperElement.style.zIndex = '10000';
      this.wrapperElement.style.minWidth = `${Math.max(this.inputElement.offsetWidth, 260)}px`;
      this._render();
      this._reposition();
      this.isOpen = true;
      if (this.options.showAnalogClock) this._startClockTimer();

      this._boundOutsideClick = (e) => {
        if (!this.isOpen) return;
        const target = e.target;
        if (target === this.inputElement) return;
        if (this.wrapperElement && this.wrapperElement.contains(target)) return;
        if (this.calendarElement && this.calendarElement.contains(target)) return;
        this.close();
      };
      this._boundOnScroll = () => this._reposition();
      this._boundOnResize = () => this._reposition();
      document.addEventListener('mousedown', this._boundOutsideClick, true);
      window.addEventListener('scroll', this._boundOnScroll, true);
      window.addEventListener('resize', this._boundOnResize, true);

      // Focus the calendar for keyboard nav
      this.calendarElement.setAttribute('tabindex', '-1');
      this.calendarElement.focus({ preventScroll: true });
    }

    _reposition() {
      if (!this.wrapperElement) return;
      const { top, left } = getBoundingPositionAround(this.inputElement, this.wrapperElement, this.options.position);
      this.wrapperElement.style.top = `${top}px`;
      this.wrapperElement.style.left = `${left}px`;
      this.wrapperElement.style.visibility = 'visible';
    }

    close() {
      if (!this.isOpen) return;
      if (this.options.inline) {
        this.isOpen = false;
        return;
      }
      this.isOpen = false;
      this._stopClockTimer();
      if (this.wrapperElement && this.wrapperElement.parentNode) {
        this.wrapperElement.parentNode.removeChild(this.wrapperElement);
      }
      document.removeEventListener('mousedown', this._boundOutsideClick, true);
      window.removeEventListener('scroll', this._boundOnScroll, true);
      window.removeEventListener('resize', this._boundOnResize, true);
    }

    toggle() {
      if (this.isOpen) this.close(); else this.open();
    }

    getDate() {
      return this.selectedDate ? new Date(this.selectedDate.getTime()) : null;
    }

    setDate(dateOrString, source) {
      if (!dateOrString) {
        this.selectedDate = null;
        this.inputElement.value = '';
        this._render();
        if (typeof this.options.onSelect === 'function') {
          try { this.options.onSelect(null, { formatted: '', source: source || 'api' }); } catch (_) {}
        }
        const changeEvent = new Event('change', { bubbles: true });
        this.inputElement.dispatchEvent(changeEvent);
        return;
      }
      const parsed = this._normalizeDate(dateOrString);
      if (!parsed) return;
      if (isDateOutOfBounds(parsed, this.options.minDate, this.options.maxDate)) return;
      if (this.options.disableDates && this.options.disableDates(parsed)) return;
      this.currentViewMonth = startOfMonth(parsed);
      if (this.options.enableTime) {
        this._initTimeFromDate(parsed);
      }
      this._selectDate(parsed, source || 'api');
    }

    updateOptions(partial) {
      if (!partial || typeof partial !== 'object') return;
      if (Object.prototype.hasOwnProperty.call(partial, 'format')) this.options.format = partial.format || DEFAULT_FORMAT;
      if (Object.prototype.hasOwnProperty.call(partial, 'firstDayOfWeek')) this.options.firstDayOfWeek = Number(partial.firstDayOfWeek) || 0;
      if (Object.prototype.hasOwnProperty.call(partial, 'minDate')) this.options.minDate = this._normalizeDate(partial.minDate);
      if (Object.prototype.hasOwnProperty.call(partial, 'maxDate')) this.options.maxDate = this._normalizeDate(partial.maxDate);
      if (Object.prototype.hasOwnProperty.call(partial, 'disableDates')) this.options.disableDates = typeof partial.disableDates === 'function' ? partial.disableDates : null;
      if (Object.prototype.hasOwnProperty.call(partial, 'i18n')) this.options.i18n = Object.assign({}, this.options.i18n, partial.i18n || {});
      if (Object.prototype.hasOwnProperty.call(partial, 'openOnFocus')) this.options.openOnFocus = Boolean(partial.openOnFocus);
      if (Object.prototype.hasOwnProperty.call(partial, 'autoClose')) this.options.autoClose = partial.autoClose !== false;
      if (Object.prototype.hasOwnProperty.call(partial, 'showOutsideDays')) this.options.showOutsideDays = partial.showOutsideDays !== false;
      if (Object.prototype.hasOwnProperty.call(partial, 'inline')) this.options.inline = Boolean(partial.inline);
      if (Object.prototype.hasOwnProperty.call(partial, 'position')) this.options.position = partial.position || 'auto';
      if (Object.prototype.hasOwnProperty.call(partial, 'enableTime')) {
        var enable = Boolean(partial.enableTime);
        if (enable && !this.options.enableTime) {
          this.options.enableTime = true;
          if (!this.timeRow) {
            this._buildTimeControls();
            if (this.timeRow) {
              // insert before footer
              this.calendarElement.insertBefore(this.timeRow, this.footer);
            }
          }
        } else if (!enable && this.options.enableTime) {
          this.options.enableTime = false;
          if (this.timeRow && this.timeRow.parentNode) {
            this.timeRow.parentNode.removeChild(this.timeRow);
          }
          this.timeRow = null;
          this.ampmSelect = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'timeStep')) {
        var oldStep = this.options.timeStep;
        this.options.timeStep = Number(partial.timeStep) > 0 ? Number(partial.timeStep) : oldStep;
        if (this.options.enableTime && this.timeRow) {
          this._rebuildMinuteOptions();
          this._updateTimeInputs();
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'showAnalogClock')) {
        var wantClock = Boolean(partial.showAnalogClock);
        if (wantClock && !this.options.showAnalogClock) {
          this.options.showAnalogClock = true;
          if (!this.clockContainer) {
            this.clockContainer = createElement('div', 'dp-clock');
            this._buildClock();
            if (this.contentElement) this.contentElement.appendChild(this.clockContainer);
            this.calendarElement.classList.add('has-clock');
          }
          this._updateClock();
          if (this.isOpen || this.options.inline) this._startClockTimer();
        } else if (!wantClock && this.options.showAnalogClock) {
          this.options.showAnalogClock = false;
          if (this.clockContainer && this.clockContainer.parentNode) {
            this.clockContainer.parentNode.removeChild(this.clockContainer);
          }
          this.clockContainer = null;
          this.calendarElement.classList.remove('has-clock');
          this._stopClockTimer();
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'hour12')) {
        var want12 = Boolean(partial.hour12);
        if (want12 !== this.options.hour12) {
          this.options.hour12 = want12;
          if (this.options.enableTime) {
            // Rebuild time controls or adjust existing
            if (!this.timeRow) {
              this._buildTimeControls();
              if (this.timeRow) {
                this.calendarElement.insertBefore(this.timeRow, this.footer);
              }
            } else {
              // Rebuild hour options and AM/PM UI
              // Remove current hour options
              if (this.hourSelect) this.hourSelect.textContent = '';
              if (want12) {
                // Ensure AM/PM exists
                if (!this.ampmSelect) {
                  this.ampmSelect = createElement('select', 'dp-time-ampm', { 'aria-label': 'AM/PM' });
                  var optAm2 = document.createElement('option'); optAm2.value = 'AM'; optAm2.textContent = 'AM';
                  var optPm2 = document.createElement('option'); optPm2.value = 'PM'; optPm2.textContent = 'PM';
                  this.ampmSelect.appendChild(optAm2);
                  this.ampmSelect.appendChild(optPm2);
                  this.timeRow.insertBefore(this.ampmSelect, this.hourSelect);
                  var selfUpd = this;
                  this.ampmSelect.addEventListener('change', function () {
                    var h12v = Number(selfUpd.hourSelect.value) || 12;
                    var base = h12v % 12;
                    var isPm = selfUpd.ampmSelect.value === 'PM';
                    var nh = isPm ? base + 12 : base;
                    selfUpd._setTime(nh, selfUpd.timeMinutes, true);
                  });
                }
                var h12b;
                for (h12b = 1; h12b <= 12; h12b += 1) {
                  var optH12b = document.createElement('option');
                  optH12b.value = String(h12b);
                  optH12b.textContent = padStartNumber(h12b, 2);
                  this.hourSelect.appendChild(optH12b);
                }
              } else {
                // Remove AM/PM if exists
                if (this.ampmSelect && this.ampmSelect.parentNode) this.ampmSelect.parentNode.removeChild(this.ampmSelect);
                this.ampmSelect = null;
                var hb;
                for (hb = 0; hb < 24; hb += 1) {
                  var optHb = document.createElement('option');
                  optHb.value = String(hb);
                  optHb.textContent = padStartNumber(hb, 2);
                  this.hourSelect.appendChild(optHb);
                }
              }
              this._updateTimeInputs();
            }
          }
        }
      }
      this._renderWeekdays();
      this._render();
    }

    setMinDate(dateOrString) { this.updateOptions({ minDate: dateOrString }); }
    setMaxDate(dateOrString) { this.updateOptions({ maxDate: dateOrString }); }

    destroy() {
      this.close();
      this._stopClockTimer();
      if (this.calendarElement && this.calendarElement.parentNode && this.options.inline) {
        this.calendarElement.parentNode.removeChild(this.calendarElement);
      }
      // Remove input listeners
      this.inputElement.replaceWith(this.inputElement.cloneNode(true));
    }
  }

  // Helper: attach by data attribute
  function autoInit() {
    const nodes = document.querySelectorAll('[data-datepicker]');
    nodes.forEach((input) => {
      if (input.__dpInstance) return;
      const instance = new DatePicker(input, {});
      input.__dpInstance = instance;
    });
  }

  if (typeof window !== 'undefined') {
    window.DatePicker = DatePicker;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }
})();


