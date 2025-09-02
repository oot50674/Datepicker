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
    range: boolean (default false) — 기간 선택 모드
    rangeSeparator: string (default ' - ')
    onSelectRange: ({ start: Date|null, end: Date|null }, ctx: { formatted: string, source: 'user'|'api' }) => void
    confirm: boolean (default false) — 완료 버튼으로 확정하는 모드

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

  function endOfWeek(date, firstDayOfWeek) {
    var start = startOfWeek(date, firstDayOfWeek);
    return addDays(start, 6);
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
      done: isKorean ? '완료' : 'Done',
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
        onSelectRange: typeof initialOptions.onSelectRange === 'function' ? initialOptions.onSelectRange : null,
        i18n,
        openOnFocus: initialOptions.openOnFocus !== false,
        autoClose: initialOptions.autoClose !== false,
        showOutsideDays: initialOptions.showOutsideDays !== false,
        inline: Boolean(initialOptions.inline),
        position: initialOptions.position || 'auto',
        enableTime: Boolean(initialOptions.enableTime),
        timeStep: Number(initialOptions.timeStep) > 0 ? Number(initialOptions.timeStep) : 5,
        showAnalogClock: Boolean(initialOptions.showAnalogClock),
        hour12: Boolean(initialOptions.hour12),
        inlineContainer: initialOptions.inlineContainer || null,
        range: Boolean(initialOptions.range),
        rangeSeparator: initialOptions.rangeSeparator || ' - ',
        confirm: Boolean(initialOptions.confirm),
        // Schedule options
        scheduleMode: initialOptions.scheduleMode || 'none', // 'none' | 'weekly' | 'monthly'
        scheduleWeeklyMulti: initialOptions.scheduleWeeklyMulti !== false,
        scheduleMonthlyMulti: initialOptions.scheduleMonthlyMulti !== false,
        onSelectSchedule: typeof initialOptions.onSelectSchedule === 'function' ? initialOptions.onSelectSchedule : null,
        // Schedule header text options
        weeklyHeaderText: initialOptions.weeklyHeaderText || null, // null means use default
        monthlyHeaderText: initialOptions.monthlyHeaderText || null, // null means use default
      };

      // 스케줄 모드에서는 시간/범위 기능 비활성화
      if (this.options.scheduleMode && this.options.scheduleMode !== 'none') {
        this.options.enableTime = false;
        this.options.range = false;
      }

      // 시간 선택이 가능한 경우, 완료 버튼은 항상 활성화
      if (this.options.enableTime) {
        this.options.confirm = true;
      }

      this.selectedDate = null;
      // Schedule state
      this.scheduleWeeklySelected = new Set(); // values: 0..6 (Sun..Sat)
      this.scheduleMonthlySelected = new Set(); // values: 1..31
      this.weeklyRow = null;
      this.rangeStart = null;
      this.rangeEnd = null;
      this.hoveringDate = null;
      // Range time state
      this.startHours = 0; this.startMinutes = 0;
      this.endHours = 0; this.endMinutes = 0;
      this.focusedDate = null;
      this.currentViewMonth = startOfMonth(new Date());
      this.isOpen = false;
      this.timeHours = 0;
      this.timeMinutes = 0;

      const existingValue = String(this.inputElement.value || '').trim();
      if (existingValue) {
        if (this.options.scheduleMode === 'weekly' || this.options.scheduleMode === 'monthly') {
          var daysArray = this._parseScheduleArray(existingValue);
          var targetSet = this.options.scheduleMode === 'weekly' ? this.scheduleWeeklySelected : this.scheduleMonthlySelected;
          var i;
          for (i = 0; i < daysArray.length; i += 1) { targetSet.add(daysArray[i]); }
        } else if (this.options.range) {
          const rg = this._parseRangeString(existingValue);
          if (rg) {
            this.rangeStart = rg.start;
            this.rangeEnd = rg.end;
            if (this.options.enableTime) {
              if (this.rangeStart) { this.startHours = this.rangeStart.getHours(); this.startMinutes = clampMinuteToStep(this.rangeStart.getMinutes(), this.options.timeStep); }
              if (this.rangeEnd) { this.endHours = this.rangeEnd.getHours(); this.endMinutes = clampMinuteToStep(this.rangeEnd.getMinutes(), this.options.timeStep); }
            }
          }
        } else {
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

    _parseRangeString(value) {
      const sep = this.options.rangeSeparator || ' - ';
      const parts = String(value).split(sep);
      if (parts.length !== 2) return null;
      const s = parseDate(parts[0].trim(), this.options.format);
      const e = parseDate(parts[1].trim(), this.options.format);
      const keepTime = this.options.enableTime;
      const start = s ? (keepTime ? new Date(s.getTime()) : startOfDay(s)) : null;
      const end = e ? (keepTime ? new Date(e.getTime()) : startOfDay(e)) : null;
      if (!start && !end) return null;
      let rs = start;
      let re = end;
      if (rs && re && re < rs) { const tmp = rs; rs = re; re = tmp; }
      // Bounds/disabled check
      if (rs && isDateOutOfBounds(rs, this.options.minDate, this.options.maxDate)) rs = null;
      if (re && isDateOutOfBounds(re, this.options.minDate, this.options.maxDate)) re = null;
      if (rs && this.options.disableDates && this.options.disableDates(rs)) rs = null;
      if (re && this.options.disableDates && this.options.disableDates(re)) re = null;
      return { start: rs, end: re };
    }

    _formatRangeString(start, end) {
      const sep = this.options.rangeSeparator || ' - ';
      if (start && end) return `${formatDate(start, this.options.format)}${sep}${formatDate(end, this.options.format)}`;
      if (start && !end) return `${formatDate(start, this.options.format)}`;
      return '';
    }

    getRange() {
      if (!this.options.range) return { start: null, end: null };
      const s = this.rangeStart ? new Date(this.rangeStart.getTime()) : null;
      const e = this.rangeEnd ? new Date(this.rangeEnd.getTime()) : null;
      return { start: s, end: e };
    }

    setRange(rangeOrString, source) {
      if (!this.options.range) return;
      let start = null, end = null;
      if (!rangeOrString) {
        this.rangeStart = null; this.rangeEnd = null; this.hoveringDate = null;
        if (!this.options.confirm) this.inputElement.value = '';
        this._render();
        if (typeof this.options.onSelectRange === 'function') {
          try { this.options.onSelectRange({ start: null, end: null }, { formatted: '', source: source || 'api' }); } catch (_) {}
        }
        if (!this.options.confirm) {
          const changeEvent = new Event('change', { bubbles: true });
          this.inputElement.dispatchEvent(changeEvent);
        }
        return;
      }
      if (typeof rangeOrString === 'string') {
        const rg = this._parseRangeString(rangeOrString);
        if (rg) { start = rg.start; end = rg.end; }
      } else if (Array.isArray(rangeOrString)) {
        start = this._normalizeDate(rangeOrString[0]);
        end = this._normalizeDate(rangeOrString[1]);
      } else if (typeof rangeOrString === 'object') {
        start = this._normalizeDate(rangeOrString.start);
        end = this._normalizeDate(rangeOrString.end);
      }
      if (start && end && end < start) { const tmp = start; start = end; end = tmp; }
      if (start && isDateOutOfBounds(start, this.options.minDate, this.options.maxDate)) start = null;
      if (end && isDateOutOfBounds(end, this.options.minDate, this.options.maxDate)) end = null;
      if (start && this.options.disableDates && this.options.disableDates(start)) start = null;
      if (end && this.options.disableDates && this.options.disableDates(end)) end = null;
      this.rangeStart = start || null;
      this.rangeEnd = end || null;
      if (this.options.enableTime) {
        if (this.rangeStart) { this.startHours = this.rangeStart.getHours(); this.startMinutes = clampMinuteToStep(this.rangeStart.getMinutes(), this.options.timeStep); }
        if (this.rangeEnd) { this.endHours = this.rangeEnd.getHours(); this.endMinutes = clampMinuteToStep(this.rangeEnd.getMinutes(), this.options.timeStep); }
        this._updateRangeTimeInputs();
      }
      if (this.rangeStart) this.currentViewMonth = startOfMonth(this.rangeStart);
      const formatted = this._formatRangeString(this.rangeStart, this.rangeEnd);
      if (!this.options.confirm) this.inputElement.value = formatted;
      this._render();
      if (typeof this.options.onSelectRange === 'function') {
        try { this.options.onSelectRange({ start: this.rangeStart, end: this.rangeEnd }, { formatted, source: source || 'api' }); } catch (_) {}
      }
      if (!this.options.confirm) {
        const changeEvent = new Event('change', { bubbles: true });
        this.inputElement.dispatchEvent(changeEvent);
      }
    }

    _syncRangeValue(source) {
      const formatted = this._formatRangeString(this.rangeStart, this.rangeEnd);
      if (!this.options.confirm) this.inputElement.value = formatted;
      if (typeof this.options.onSelectRange === 'function') {
        try { this.options.onSelectRange({ start: this.rangeStart, end: this.rangeEnd }, { formatted, source: source || 'api' }); } catch (_) {}
      }
      if (!this.options.confirm) {
        const changeEvent = new Event('change', { bubbles: true });
        this.inputElement.dispatchEvent(changeEvent);
      }
    }

    _build() {
      this.wrapperElement = createElement('div', 'dp-popover', { 'data-dp-root': '1' });
      this.calendarElement = createElement('div', 'dp', { role: 'dialog', 'aria-label': this.options.i18n.aria.calendar });
      this.wrapperElement.appendChild(this.calendarElement);

      // Header
      const header = createElement('div', 'dp-header');
      this.headerElement = header;
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

      // Days grid (주간 모드에서는 생성하지 않음)
      this.daysGrid = null;
      if (this.options.scheduleMode !== 'weekly') {
        this.daysGrid = createElement('div', 'dp-days', { role: 'grid' });
      }
      // Weekly controls (optional)
      this.weeklyRow = null;
      if (this.options.scheduleMode === 'weekly') {
        this._buildWeeklyControls();
        this._buildWeeklyHeader();
      }
      // Monthly header (optional)
      if (this.options.scheduleMode === 'monthly') {
        this._buildMonthlyHeader();
      }
      // Hover leave handler for range preview (daysGrid가 있을 때만)
      if (this.daysGrid) {
        var selfGrid = this;
        this.daysGrid.addEventListener('mouseleave', function () {
          if (selfGrid.options.range && selfGrid.hoveringDate) {
            selfGrid.hoveringDate = null;
            selfGrid._updateRangeHighlight();
          }
        });
      }

      // Time controls (optional)
      this.timeRow = null;
      this.timeRangeRow = null;
      if (this.options.enableTime) {
        if (this.options.range) {
          this._buildRangeTimeControls();
        } else {
          this._buildTimeControls();
        }
      }

      // Footer
      this.footer = createElement('div', 'dp-footer');
      this.todayButton = createElement('button', 'dp-btn dp-today', { type: 'button' });
      this.todayButton.textContent = this.options.i18n.buttons.today;
      this.clearButton = createElement('button', 'dp-btn dp-clear', { type: 'button' });
      this.clearButton.textContent = this.options.i18n.buttons.clear;
      this.doneButton = null;
      if (this.options.confirm) {
        this.doneButton = createElement('button', 'dp-btn dp-done', { type: 'button' });
        this.doneButton.textContent = this.options.i18n.buttons.done;
      }

      this.footer.appendChild(this.todayButton);
      this.footer.appendChild(this.clearButton);
      if (this.doneButton) this.footer.appendChild(this.doneButton);

      // Build content layout (main + optional clock)
      this.contentElement = createElement('div', 'dp-content');
      this.mainContainer = createElement('div', 'dp-main');
      if (this.options.scheduleMode === 'weekly') {
        if (this.weeklyHeaderElement) this.mainContainer.appendChild(this.weeklyHeaderElement);
        if (this.weeklyRow) this.mainContainer.appendChild(this.weeklyRow);
      } else if (this.options.scheduleMode === 'monthly') {
        // monthly: header + days grid (no weekdays)
        if (this.monthlyHeaderElement) this.mainContainer.appendChild(this.monthlyHeaderElement);
        this.mainContainer.appendChild(this.daysGrid);
      } else {
        this.mainContainer.appendChild(header);
        this.mainContainer.appendChild(this.weekdaysRow);
        this.mainContainer.appendChild(this.daysGrid);
      }
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
      if (this.timeRangeRow) {
        this.mainContainer.insertBefore(this.timeRangeRow, this.footer);
      }
      this.calendarElement.appendChild(this.contentElement);

      // Attach listeners
      this.prevButton.addEventListener('click', () => this._goToPreviousMonth());
      this.nextButton.addEventListener('click', () => this._goToNextMonth());
      var self = this;
      this.todayButton.addEventListener('click', function () { self._selectToday(); });
      this.clearButton.addEventListener('click', function () { self._clearSelection(); });
      if (this.doneButton) {
        this.doneButton.addEventListener('click', function () { self._commitValue(); });
      }
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
      this.clockCenter = createElement('div', 'dp-clock-center');
      this.clockFace.appendChild(this.clockHourHand);
      this.clockFace.appendChild(this.clockMinuteHand);
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

    _buildWeeklyControls() {
      this.weeklyRow = createElement('div', 'dp-weekly');
      var order = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun in JS getDay index
      var self = this;
      this.weeklyButtons = [];
      var i;
      for (i = 0; i < order.length; i += 1) {
        var dayIndex = order[i];
        var label = '';
        try {
          // Try localized short weekday names, fallback to numbers
          var fmt = new Intl.DateTimeFormat(getDefaultLocale(), { weekday: 'short' });
          label = fmt.format(new Date(2020, 10, 1 + dayIndex));
        } catch (_) {
          label = String(dayIndex);
        }
        var btn = createElement('button', 'dp-weekday-toggle', { type: 'button', 'data-day': String(dayIndex) });
        btn.textContent = label;
        (function (el, idx) {
          el.addEventListener('click', function () {
            self._toggleWeeklyDay(idx, true);
          });
        })(btn, dayIndex);
        this.weeklyButtons.push(btn);
        this.weeklyRow.appendChild(btn);
      }
      this._updateWeeklyUI();
    }

    _buildWeeklyHeader() {
      var title = this.options.weeklyHeaderText;
      if (!title) {
        try {
          var isKo = String(getDefaultLocale()).startsWith('ko');
          title = isKo ? '주간 스케줄 선택' : 'Weekly Schedule';
        } catch (_) {
          title = 'Weekly Schedule';
        }
      }
      this.weeklyHeaderElement = createElement('div', 'dp-weekly-header');
      var left = createElement('div', 'dp-weekly-title');
      left.textContent = title;
      var right = createElement('div', 'dp-header-right');
      // 재사용 가능한 Clear/Today/D one 은 하단에 이미 존재하므로 우측은 비워둠
      this.weeklyHeaderElement.appendChild(left);
      this.weeklyHeaderElement.appendChild(right);
    }

    _buildMonthlyHeader() {
      var title = this.options.monthlyHeaderText;
      if (!title) {
        try {
          var isKo = String(getDefaultLocale()).startsWith('ko');
          title = isKo ? '월간 스케줄 선택' : 'Monthly Schedule';
        } catch (_) {
          title = 'Monthly Schedule';
        }
      }
      this.monthlyHeaderElement = createElement('div', 'dp-monthly-header');
      var left = createElement('div', 'dp-monthly-title');
      left.textContent = title;
      var right = createElement('div', 'dp-header-right');
      // 재사용 가능한 Clear/Today/Done 은 하단에 이미 존재하므로 우측은 비워둠
      this.monthlyHeaderElement.appendChild(left);
      this.monthlyHeaderElement.appendChild(right);
    }

    _updateWeeklyUI() {
      if (!this.weeklyButtons) return;
      var i;
      for (i = 0; i < this.weeklyButtons.length; i += 1) {
        var btn = this.weeklyButtons[i];
        var idx = Number(btn.getAttribute('data-day'));
        if (this.scheduleWeeklySelected.has(idx)) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
    }

    _toggleWeeklyDay(dayIndex, fromUser) {
      if (this.options.scheduleMode !== 'weekly') return;
      var idx = Math.max(0, Math.min(6, Number(dayIndex) || 0));
      if (this.options.scheduleWeeklyMulti) {
        if (this.scheduleWeeklySelected.has(idx)) {
          this.scheduleWeeklySelected.delete(idx);
        } else {
          this.scheduleWeeklySelected.add(idx);
        }
      } else {
        this.scheduleWeeklySelected.clear();
        this.scheduleWeeklySelected.add(idx);
      }
      this._updateWeeklyUI();
      this._syncScheduleValue(fromUser ? 'user' : 'api');
    }

    _toggleMonthlyDay(dayOfMonth, fromUser) {
      if (this.options.scheduleMode !== 'monthly') return;
      var d = Math.max(1, Math.min(31, Number(dayOfMonth) || 1));
      if (this.options.scheduleMonthlyMulti) {
        if (this.scheduleMonthlySelected.has(d)) {
          this.scheduleMonthlySelected.delete(d);
        } else {
          this.scheduleMonthlySelected.add(d);
        }
      } else {
        this.scheduleMonthlySelected.clear();
        this.scheduleMonthlySelected.add(d);
      }
      this._syncScheduleValue(fromUser ? 'user' : 'api');
      this._render();
    }

    _formatScheduleArray() {
      if (this.options.scheduleMode === 'weekly') {
        var arrW = Array.from(this.scheduleWeeklySelected);
        arrW.sort(function (a, b) { return a - b; });
        // Display 1..7 with Mon=1..Sun=7
        var disp = arrW.map(function (v) { return v === 0 ? 7 : v; });
        return disp;
      }
      if (this.options.scheduleMode === 'monthly') {
        var arrM = Array.from(this.scheduleMonthlySelected);
        arrM.sort(function (a, b) { return a - b; });
        return arrM;
      }
      return [];
    }

    _parseScheduleArray(value) {
      // Support both string format (backward compatibility) and array format
      if (Array.isArray(value)) {
        return value;
      }

      if (!value) return [];
      var v = String(value).trim();
      var low = v.toLowerCase();
      var listStr = '';

      if (low.indexOf('weekly:') === 0 || low.indexOf('w:') === 0) {
        listStr = v.substring(v.indexOf(':') + 1);
      } else if (low.indexOf('monthly:') === 0 || low.indexOf('m:') === 0) {
        listStr = v.substring(v.indexOf(':') + 1);
      } else {
        // Try to parse as comma-separated numbers
        listStr = v;
      }

      var raw = listStr.split(/[,\s]+/).filter(function (s) { return s.length > 0; });
      var days = [];
      var i;
      for (i = 0; i < raw.length; i += 1) {
        var n = Number(raw[i]);
        if (!Number.isFinite(n)) continue;
        // For weekly mode, convert 7 (Sun) to 0
        if (this.options.scheduleMode === 'weekly' && n === 7) {
          n = 0;
        }
        days.push(n);
      }
      return days;
    }

    _syncScheduleValue(source) {
      if (!this.options || (this.options.scheduleMode === 'none')) return;
      var scheduleArray = this._formatScheduleArray();
      var formattedString = scheduleArray.join(',');

      // Keep input element value as string for backward compatibility
      if (!this.options.confirm) {
        this.inputElement.value = formattedString;
      }

      if (typeof this.options.onSelectSchedule === 'function') {
        try {
          this.options.onSelectSchedule({
            mode: this.options.scheduleMode,
            weekly: Array.from(this.scheduleWeeklySelected),
            monthly: Array.from(this.scheduleMonthlySelected),
            array: scheduleArray
          }, { formatted: formattedString, source: source || 'api' });
        } catch (_) {}
      }
      if (!this.options.confirm) {
        var changeEvent = new Event('change', { bubbles: true });
        this.inputElement.dispatchEvent(changeEvent);
      }
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
      this.clockHourHand.style.transform = 'translateX(-50%) rotate(' + String(hourDeg) + 'deg)';
      this.clockMinuteHand.style.transform = 'translateX(-50%) rotate(' + String(minuteDeg) + 'deg)';
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

    _buildRangeTimeControls() {
      var self = this;
      this.timeRangeRow = createElement('div', 'dp-time-range');

      function buildGroup(prefix) {
        var group = createElement('div', 'dp-time-group');
        var label = createElement('div', 'dp-time-label');
        label.textContent = prefix === 'start' ? '시작' : '종료';
        group.appendChild(label);

        var ampmSelect = null;
        if (self.options.hour12) {
          ampmSelect = createElement('select', 'dp-time-ampm', { 'aria-label': prefix + ' AM/PM' });
          var optAm = document.createElement('option'); optAm.value = 'AM'; optAm.textContent = 'AM';
          var optPm = document.createElement('option'); optPm.value = 'PM'; optPm.textContent = 'PM';
          ampmSelect.appendChild(optAm); ampmSelect.appendChild(optPm);
        }

        var hourSelect = createElement('select', 'dp-time-hour', { 'aria-label': prefix + ' Hour' });
        var minuteSelect = createElement('select', 'dp-time-minute', { 'aria-label': prefix + ' Minute' });

        if (self.options.hour12) {
          var h12;
          for (h12 = 1; h12 <= 12; h12 += 1) {
            var optH12 = document.createElement('option');
            optH12.value = String(h12);
            optH12.textContent = padStartNumber(h12, 2);
            hourSelect.appendChild(optH12);
          }
        } else {
          var h;
          for (h = 0; h < 24; h += 1) {
            var optH = document.createElement('option');
            optH.value = String(h);
            optH.textContent = padStartNumber(h, 2);
            hourSelect.appendChild(optH);
          }
        }
        // minutes by step
        var step = Number(self.options.timeStep) > 0 ? Number(self.options.timeStep) : 5;
        var m = 0; minuteSelect.textContent = '';
        while (m < 60) { var optM = document.createElement('option'); optM.value = String(m); optM.textContent = padStartNumber(m, 2); minuteSelect.appendChild(optM); m += step; }

        if (ampmSelect) group.appendChild(ampmSelect);
        group.appendChild(hourSelect);
        group.appendChild(minuteSelect);

        return { group, ampmSelect, hourSelect, minuteSelect };
      }

      var start = buildGroup('start');
      var end = buildGroup('end');
      this.timeRangeRow.appendChild(start.group);
      this.timeRangeRow.appendChild(end.group);

      // store refs
      this.startAmpmSelect = start.ampmSelect; this.endAmpmSelect = end.ampmSelect;
      this.startHourSelect = start.hourSelect; this.endHourSelect = end.hourSelect;
      this.startMinuteSelect = start.minuteSelect; this.endMinuteSelect = end.minuteSelect;

      // init from range dates or internal state
      this._updateRangeTimeInputs();

      // listeners
      var onStartChange = function () {
        var nh;
        if (self.options.hour12) {
          var h12v = Number(self.startHourSelect.value) || 12;
          var base = h12v % 12;
          var isPm = self.startAmpmSelect ? self.startAmpmSelect.value === 'PM' : false;
          nh = isPm ? base + 12 : base;
        } else { nh = Number(self.startHourSelect.value) || 0; }
        var nm = Number(self.startMinuteSelect.value) || 0;
        self.startHours = Math.max(0, Math.min(23, nh));
        self.startMinutes = clampMinuteToStep(Math.max(0, Math.min(59, nm)), self.options.timeStep);
        if (self.rangeStart) {
          self.rangeStart = new Date(self.rangeStart.getFullYear(), self.rangeStart.getMonth(), self.rangeStart.getDate(), self.startHours, self.startMinutes);
          self._syncRangeValue('user');
        }
        self._updateRangeHighlight();
      };
      var onEndChange = function () {
        var nh;
        if (self.options.hour12) {
          var h12v = Number(self.endHourSelect.value) || 12;
          var base = h12v % 12;
          var isPm = self.endAmpmSelect ? self.endAmpmSelect.value === 'PM' : false;
          nh = isPm ? base + 12 : base;
        } else { nh = Number(self.endHourSelect.value) || 0; }
        var nm = Number(self.endMinuteSelect.value) || 0;
        self.endHours = Math.max(0, Math.min(23, nh));
        self.endMinutes = clampMinuteToStep(Math.max(0, Math.min(59, nm)), self.options.timeStep);
        if (self.rangeEnd) {
          self.rangeEnd = new Date(self.rangeEnd.getFullYear(), self.rangeEnd.getMonth(), self.rangeEnd.getDate(), self.endHours, self.endMinutes);
          self._syncRangeValue('user');
        }
        self._updateRangeHighlight();
      };
      this.startHourSelect.addEventListener('change', onStartChange);
      this.startMinuteSelect.addEventListener('change', onStartChange);
      if (this.startAmpmSelect) this.startAmpmSelect.addEventListener('change', onStartChange);
      this.endHourSelect.addEventListener('change', onEndChange);
      this.endMinuteSelect.addEventListener('change', onEndChange);
      if (this.endAmpmSelect) this.endAmpmSelect.addEventListener('change', onEndChange);
    }

    _updateRangeTimeInputs() {
      if (!this.options.enableTime || !this.options.range) return;
      // start
      var sh = this.startHours, sm = this.startMinutes;
      if (this.rangeStart) { sh = this.rangeStart.getHours(); sm = clampMinuteToStep(this.rangeStart.getMinutes(), this.options.timeStep); }
      if (this.options.hour12) {
        var isPmS = sh >= 12; var dispS = sh % 12; if (dispS === 0) dispS = 12;
        if (this.startAmpmSelect) this.startAmpmSelect.value = isPmS ? 'PM' : 'AM';
        if (this.startHourSelect) this.startHourSelect.value = String(dispS);
      } else { if (this.startHourSelect) this.startHourSelect.value = String(sh); }
      if (this.startMinuteSelect) this.startMinuteSelect.value = String(clampMinuteToStep(sm, this.options.timeStep));
      this.startHours = sh; this.startMinutes = clampMinuteToStep(sm, this.options.timeStep);
      // end
      var eh = this.endHours, em = this.endMinutes;
      if (this.rangeEnd) { eh = this.rangeEnd.getHours(); em = clampMinuteToStep(this.rangeEnd.getMinutes(), this.options.timeStep); }
      if (this.options.hour12) {
        var isPmE = eh >= 12; var dispE = eh % 12; if (dispE === 0) dispE = 12;
        if (this.endAmpmSelect) this.endAmpmSelect.value = isPmE ? 'PM' : 'AM';
        if (this.endHourSelect) this.endHourSelect.value = String(dispE);
      } else { if (this.endHourSelect) this.endHourSelect.value = String(eh); }
      if (this.endMinuteSelect) this.endMinuteSelect.value = String(clampMinuteToStep(em, this.options.timeStep));
      this.endHours = eh; this.endMinutes = clampMinuteToStep(em, this.options.timeStep);
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
      if (!this.weekdaysRow) return; // 주간 모드에서는 weekdaysRow가 없음
      this.weekdaysRow.textContent = '';
      const names = this.options.i18n.weekdays;
      names.forEach((n) => {
        const el = createElement('div', 'dp-weekday', { role: 'columnheader' });
        el.textContent = n;
        this.weekdaysRow.appendChild(el);
      });
    }

    _render() {
      // 헤더 월/연도 선택 동기화
      this._syncMonthYearControls();

      // 날짜 그리드 생성 (주간 모드에서는 daysGrid가 없으므로 스킵)
      if (this.daysGrid) {
        this.daysGrid.textContent = '';
      }
      if (this.options.scheduleMode === 'monthly' && this.daysGrid) {
        // 1~31일의 순수 일자 그리드
        for (let d = 1; d <= 31; d += 1) {
          const cell = createElement('button', 'dp-day', {
            type: 'button',
            role: 'gridcell',
            'aria-selected': String(this.scheduleMonthlySelected.has(d)),
            'aria-disabled': 'false',
            'data-day': String(d),
          });
          cell.textContent = String(d);
          if (this.scheduleMonthlySelected.has(d)) cell.classList.add('is-selected');
          const selfMon = this;
          cell.addEventListener('click', function () { selfMon._toggleMonthlyDay(d, true); });
          this.daysGrid.appendChild(cell);
        }
        this._updateClock();
        return;
      }
      if (this.daysGrid && this.options.scheduleMode === 'none') {
        const firstDay = startOfMonth(this.currentViewMonth);
        const gridStart = startOfWeek(firstDay, this.options.firstDayOfWeek);
        // 항상 6주(42일) 렌더링
        for (let i = 0; i < 42; i += 1) {
          const dayDate = addDays(gridStart, i);
          const isOutside = dayDate.getMonth() !== this.currentViewMonth.getMonth();
          if (!this.options.showOutsideDays && isOutside) {
            const filler = createElement('div', 'dp-day is-empty', { role: 'gridcell', 'aria-disabled': 'true' });
            this.daysGrid.appendChild(filler);
            continue;
          }
          const isToday = areSameCalendarDate(dayDate, new Date());
          const isSelectedSingle = (this.options.scheduleMode === 'none' && !this.options.range && this.selectedDate)
            ? areSameCalendarDate(dayDate, this.selectedDate)
            : false;
          const disabledByBounds = isDateOutOfBounds(dayDate, this.options.minDate, this.options.maxDate);
          const disabledByFn = this.options.disableDates ? this.options.disableDates(dayDate) : false;
          const isDisabled = disabledByBounds || Boolean(disabledByFn);

          const cell = createElement('button', 'dp-day', {
            type: 'button',
            role: 'gridcell',
            'aria-selected': String(isSelectedSingle),
            'aria-disabled': String(isDisabled),
            'data-date': toISODateString(dayDate),
          });
          cell.textContent = String(dayDate.getDate());
          if (isOutside) cell.classList.add('is-outside');
          if (isToday) cell.classList.add('is-today');
          if (isSelectedSingle) cell.classList.add('is-selected');
          if (isDisabled) cell.classList.add('is-disabled');

          if (!isDisabled) {
            var selfCell = this;
            if (this.options.range) {
              cell.addEventListener('click', function () {
                selfCell._handleRangeClick(dayDate);
              });
              cell.addEventListener('mouseenter', function () {
                if (selfCell.options.range && selfCell.rangeStart && !selfCell.rangeEnd) {
                  selfCell.hoveringDate = startOfDay(dayDate);
                  selfCell._updateRangeHighlight();
                }
              });
            } else {
              cell.addEventListener('click', function () {
                selfCell._selectDate(dayDate, 'user');
                if (!selfCell.options.confirm && selfCell.options.autoClose && !selfCell.options.inline && !selfCell.options.enableTime) selfCell.close();
              });
            }
          }

          this.daysGrid.appendChild(cell);
        }
      }
      if (this.options.range && this.options.scheduleMode === 'none' && this.daysGrid) this._updateRangeHighlight();
      this._updateClock();
      if (this.options.scheduleMode === 'weekly') this._updateWeeklyUI();
    }

    _updateRangeHighlight() {
      if (!this.options.range || !this.daysGrid) return;
      const nodes = this.daysGrid.querySelectorAll('.dp-day');
      let rs = this.rangeStart ? startOfDay(this.rangeStart) : null;
      let re = this.rangeEnd ? startOfDay(this.rangeEnd) : null;
      let previewEnd = this.hoveringDate && rs && !re ? this.hoveringDate : null;
      if (rs && previewEnd && previewEnd < rs) { const tmp = rs; rs = previewEnd; re = tmp; previewEnd = null; }
      const effStart = rs;
      const effEnd = re || (previewEnd ? startOfDay(previewEnd) : null) || null;
      nodes.forEach((el) => {
        el.classList.remove('is-in-range', 'is-range-start', 'is-range-end');
        if (!el.dataset || !el.dataset.date) return;
        const parts = el.getAttribute('data-date').split('-');
        if (parts.length !== 3) return;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (effStart && effEnd && d >= effStart && d <= effEnd) el.classList.add('is-in-range');
        if (effStart && areSameCalendarDate(d, effStart)) el.classList.add('is-range-start');
        if (effEnd && areSameCalendarDate(d, effEnd)) el.classList.add('is-range-end');
        if (el.classList.contains('is-range-start') || el.classList.contains('is-range-end')) {
          el.setAttribute('aria-selected', 'true');
        } else {
          el.setAttribute('aria-selected', 'false');
        }
      });
    }

    _commitValue() {
      // Commit current selection into input and close
      if (!this.options.confirm) return;
      // Schedule commit
      if (this.options.scheduleMode && this.options.scheduleMode !== 'none') {
        var scheduleArray = this._formatScheduleArray();
        var formattedString = scheduleArray.join(',');
        this.inputElement.value = formattedString;
        if (typeof this.options.onSelectSchedule === 'function') {
          try {
            this.options.onSelectSchedule({
              mode: this.options.scheduleMode,
              weekly: Array.from(this.scheduleWeeklySelected),
              monthly: Array.from(this.scheduleMonthlySelected),
              array: scheduleArray
            }, { formatted: formattedString, source: 'confirm' });
          } catch (_) {}
        }
        var chEvtS = new Event('change', { bubbles: true });
        this.inputElement.dispatchEvent(chEvtS);
        if (!this.options.inline) this.close();
        return;
      }
      let formatted = '';
      if (this.options.range) {
        formatted = this._formatRangeString(this.rangeStart, this.rangeEnd);
        this.inputElement.value = formatted;
        if (typeof this.options.onSelectRange === 'function') {
          try { this.options.onSelectRange({ start: this.rangeStart, end: this.rangeEnd }, { formatted, source: 'confirm' }); } catch (_) {}
        }
      } else {
        if (this.selectedDate) formatted = formatDate(this.selectedDate, this.options.format);
        this.inputElement.value = formatted;
        if (typeof this.options.onSelect === 'function') {
          try { this.options.onSelect(this.selectedDate ? new Date(this.selectedDate.getTime()) : null, { formatted, source: 'confirm' }); } catch (_) {}
        }
      }
      const changeEvent = new Event('change', { bubbles: true });
      this.inputElement.dispatchEvent(changeEvent);
      if (!this.options.inline) this.close();
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
          const target = startOfDay(this.focusedDate || this.selectedDate || new Date());
          if (this.options.scheduleMode === 'monthly') {
            this._toggleMonthlyDay(target.getDate(), true);
            return;
          }
          if (this.options.scheduleMode === 'weekly') {
            this._toggleWeeklyDay(target.getDay(), true);
            return;
          }
          if (isDateOutOfBounds(target, this.options.minDate, this.options.maxDate)) return;
          if (this.options.disableDates && this.options.disableDates(target)) return;
          if (this.options.range) {
            this._handleRangeClick(target);
          } else {
            this._selectDate(target, 'user');
            if (!this.options.confirm && this.options.autoClose && !this.options.inline) this.close();
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
      if (this.options.scheduleMode === 'weekly') {
        this._toggleWeeklyDay(today.getDay(), true);
        return;
      }
      if (this.options.scheduleMode === 'monthly') {
        this._toggleMonthlyDay(today.getDate(), true);
        return;
      }
      if (isDateOutOfBounds(today, this.options.minDate, this.options.maxDate)) return;
      if (this.options.disableDates && this.options.disableDates(today)) return;
      this.currentViewMonth = startOfMonth(today);
      if (this.options.range) {
        if (!this.rangeStart && !this.rangeEnd) {
          if (this.options.enableTime) {
            this.startHours = now.getHours();
            this.startMinutes = clampMinuteToStep(now.getMinutes(), this.options.timeStep);
            this.setRange(new Date(today.getFullYear(), today.getMonth(), today.getDate(), this.startHours, this.startMinutes), 'user');
          } else {
            this.setRange({ start: today, end: null }, 'user');
          }
        } else if (this.rangeStart && !this.rangeEnd) {
          if (today < this.rangeStart) {
            if (this.options.enableTime) {
              this.startHours = now.getHours();
              this.startMinutes = clampMinuteToStep(now.getMinutes(), this.options.timeStep);
              this.setRange(new Date(today.getFullYear(), today.getMonth(), today.getDate(), this.startHours, this.startMinutes), 'user');
            } else {
              this.setRange({ start: today, end: null }, 'user');
            }
          } else {
            if (this.options.enableTime) {
              this.endHours = now.getHours();
              this.endMinutes = clampMinuteToStep(now.getMinutes(), this.options.timeStep);
              this.setRange({ start: this.rangeStart, end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), this.endHours, this.endMinutes) }, 'user');
            } else {
              this.setRange({ start: this.rangeStart, end: today }, 'user');
            }
            if (!this.options.confirm && this.options.autoClose && !this.options.inline) this.close();
          }
        } else {
          if (this.options.enableTime) {
            this.startHours = now.getHours(); this.endHours = now.getHours();
            this.startMinutes = this.endMinutes = clampMinuteToStep(now.getMinutes(), this.options.timeStep);
            this.setRange({ start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), this.startHours, this.startMinutes), end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), this.endHours, this.endMinutes) }, 'user');
          } else {
            this.setRange({ start: today, end: today }, 'user');
          }
          if (!this.options.confirm && this.options.autoClose && !this.options.inline) this.close();
        }
      } else {
        if (this.options.enableTime) {
          this.timeHours = now.getHours();
          this.timeMinutes = clampMinuteToStep(now.getMinutes(), this.options.timeStep);
          this._updateTimeInputs();
        }
        this._selectDate(today, 'user');
        if (this.options.autoClose && !this.options.inline) this.close();
      }
    }

    _clearSelection() {
      if (this.options.scheduleMode === 'weekly') {
        this.scheduleWeeklySelected.clear();
        this._updateWeeklyUI();
        this._syncScheduleValue('user');
      } else if (this.options.scheduleMode === 'monthly') {
        this.scheduleMonthlySelected.clear();
        this._syncScheduleValue('user');
        this._render();
      } else if (this.options.range) {
        this.setRange(null, 'user');
      } else {
        this.setDate(null, 'user');
      }
      if (!this.options.confirm && !this.options.inline && this.options.autoClose) this.close();
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
      this.focusedDate = startOfDay(this.selectedDate);
      this._render();
      if (typeof this.options.onSelect === 'function') {
        try {
          this.options.onSelect(new Date(this.selectedDate.getTime()), { formatted: formatted, source: source || 'api' });
        } catch (_) {}
      }
      if (!this.options.confirm) {
        this.inputElement.value = formatted;
        const changeEvent = new Event('change', { bubbles: true });
        this.inputElement.dispatchEvent(changeEvent);
      }
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
      if (this.options.range) {
        // Range 모드에서는 setDate를 start만 설정하도록 동작시킴
        if (!dateOrString) {
          this.setRange(null, source || 'api');
          return;
        }
        this.setRange({ start: dateOrString, end: this.rangeEnd }, source || 'api');
        return;
      }
      if (!dateOrString) {
        this.selectedDate = null;
        if (!this.options.confirm) this.inputElement.value = '';
        this._render();
        if (typeof this.options.onSelect === 'function') {
          try { this.options.onSelect(null, { formatted: '', source: source || 'api' }); } catch (_) {}
        }
        if (!this.options.confirm) {
          const changeEvent = new Event('change', { bubbles: true });
          this.inputElement.dispatchEvent(changeEvent);
        }
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
      // Schedule related options first to control other features
      if (Object.prototype.hasOwnProperty.call(partial, 'onSelectSchedule')) {
        this.options.onSelectSchedule = typeof partial.onSelectSchedule === 'function' ? partial.onSelectSchedule : null;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'scheduleWeeklyMulti')) {
        this.options.scheduleWeeklyMulti = partial.scheduleWeeklyMulti !== false;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'scheduleMonthlyMulti')) {
        this.options.scheduleMonthlyMulti = partial.scheduleMonthlyMulti !== false;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'weeklyHeaderText')) {
        this.options.weeklyHeaderText = partial.weeklyHeaderText || null;
        // Update existing header if it exists
        if (this.weeklyHeaderElement && this.options.scheduleMode === 'weekly') {
          var titleElement = this.weeklyHeaderElement.querySelector('.dp-weekly-title');
          if (titleElement) {
            var title = this.options.weeklyHeaderText;
            if (!title) {
              try {
                var isKo = String(getDefaultLocale()).startsWith('ko');
                title = isKo ? '주간 스케줄 선택' : 'Weekly Schedule';
              } catch (_) {
                title = 'Weekly Schedule';
              }
            }
            titleElement.textContent = title;
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'monthlyHeaderText')) {
        this.options.monthlyHeaderText = partial.monthlyHeaderText || null;
        // Update existing header if it exists
        if (this.monthlyHeaderElement && this.options.scheduleMode === 'monthly') {
          var titleElement = this.monthlyHeaderElement.querySelector('.dp-monthly-title');
          if (titleElement) {
            var title = this.options.monthlyHeaderText;
            if (!title) {
              try {
                var isKo = String(getDefaultLocale()).startsWith('ko');
                title = isKo ? '월간 스케줄 선택' : 'Monthly Schedule';
              } catch (_) {
                title = 'Monthly Schedule';
              }
            }
            titleElement.textContent = title;
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'scheduleMode')) {
        var prevMode = this.options.scheduleMode || 'none';
        var nextMode = partial.scheduleMode || 'none';
        if (nextMode !== prevMode) {
          this.options.scheduleMode = nextMode;
          // disable time/range when schedule mode is active
          if (nextMode !== 'none') {
            this.options.enableTime = false;
            this.options.range = false;
            if (this.timeRow && this.timeRow.parentNode) this.timeRow.parentNode.removeChild(this.timeRow);
            if (this.timeRangeRow && this.timeRangeRow.parentNode) this.timeRangeRow.parentNode.removeChild(this.timeRangeRow);
            this.timeRow = null; this.timeRangeRow = null;
            this.ampmSelect = null; this.startAmpmSelect = null; this.endAmpmSelect = null;
          }
          // weekly UI
          if (nextMode === 'weekly') {
            if (!this.weeklyRow) {
              this._buildWeeklyControls();
            }
            if (!this.weeklyHeaderElement) {
              this._buildWeeklyHeader();
            }
            if (this.mainContainer) {
              // Remove calendar parts if attached
              if (this.headerElement && this.headerElement.parentNode) this.headerElement.parentNode.removeChild(this.headerElement);
              if (this.weekdaysRow && this.weekdaysRow.parentNode) this.weekdaysRow.parentNode.removeChild(this.weekdaysRow);
              if (this.daysGrid && this.daysGrid.parentNode) this.daysGrid.parentNode.removeChild(this.daysGrid);
              // Insert weekly row before footer
              if (this.weeklyHeaderElement && !this.weeklyHeaderElement.parentNode) this.mainContainer.insertBefore(this.weeklyHeaderElement, this.footer);
              if (this.weeklyRow && !this.weeklyRow.parentNode) this.mainContainer.insertBefore(this.weeklyRow, this.footer);
            }
          } else if (nextMode === 'monthly') {
            if (!this.monthlyHeaderElement) {
              this._buildMonthlyHeader();
            }
            if (this.mainContainer) {
              // Remove calendar parts if attached
              if (this.headerElement && this.headerElement.parentNode) this.headerElement.parentNode.removeChild(this.headerElement);
              if (this.weekdaysRow && this.weekdaysRow.parentNode) this.weekdaysRow.parentNode.removeChild(this.weekdaysRow);
              if (this.weeklyRow && this.weeklyRow.parentNode) this.weeklyRow.parentNode.removeChild(this.weeklyRow);
              if (this.weeklyHeaderElement && this.weeklyHeaderElement.parentNode) this.weeklyHeaderElement.parentNode.removeChild(this.weeklyHeaderElement);
              // Insert monthly header and days grid
              if (this.monthlyHeaderElement && !this.monthlyHeaderElement.parentNode) this.mainContainer.insertBefore(this.monthlyHeaderElement, this.footer);
              if (this.daysGrid && !this.daysGrid.parentNode) this.mainContainer.insertBefore(this.daysGrid, this.footer);
            }
          } else {
            // Leaving schedule mode: remove schedule parts and re-attach calendar parts
            if (this.weeklyRow && this.weeklyRow.parentNode) this.weeklyRow.parentNode.removeChild(this.weeklyRow);
            if (this.weeklyHeaderElement && this.weeklyHeaderElement.parentNode) this.weeklyHeaderElement.parentNode.removeChild(this.weeklyHeaderElement);
            if (this.monthlyHeaderElement && this.monthlyHeaderElement.parentNode) this.monthlyHeaderElement.parentNode.removeChild(this.monthlyHeaderElement);
            this.weeklyRow = null;
            this.weeklyHeaderElement = null;
            this.monthlyHeaderElement = null;
            if (this.mainContainer) {
              if (this.headerElement && !this.headerElement.parentNode) this.mainContainer.insertBefore(this.headerElement, this.footer);
              if (this.weekdaysRow && !this.weekdaysRow.parentNode) this.mainContainer.insertBefore(this.weekdaysRow, this.footer);
              if (this.daysGrid && !this.daysGrid.parentNode) this.mainContainer.insertBefore(this.daysGrid, this.footer);
            }
          }
          // sync value on mode change
          this._syncScheduleValue('api');
        }
      }
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
        // ignore enableTime in schedule mode
        if ((this.options.scheduleMode && this.options.scheduleMode !== 'none')) {
          enable = false;
        }
        if (enable && !this.options.enableTime) {
          this.options.enableTime = true;
          // 시간 선택 활성화 시 완료 버튼 강제 활성화
          if (!this.options.confirm) {
            this.options.confirm = true;
            if (!this.doneButton) {
              var selfConfirm = this;
              this.doneButton = createElement('button', 'dp-btn dp-done', { type: 'button' });
              this.doneButton.textContent = this.options.i18n.buttons.done;
              this.doneButton.addEventListener('click', function () { selfConfirm._commitValue(); });
              if (this.footer) this.footer.appendChild(this.doneButton);
            }
          }
          if (this.options.range) {
            if (this.timeRow && this.timeRow.parentNode) this.timeRow.parentNode.removeChild(this.timeRow);
            this.timeRow = null; this.ampmSelect = null;
            if (!this.timeRangeRow) { this._buildRangeTimeControls(); if (this.timeRangeRow) this.calendarElement.insertBefore(this.timeRangeRow, this.footer); }
          } else {
            if (!this.timeRow) { this._buildTimeControls(); if (this.timeRow) this.calendarElement.insertBefore(this.timeRow, this.footer); }
          }
        } else if (!enable && this.options.enableTime) {
          this.options.enableTime = false;
          if (this.timeRow && this.timeRow.parentNode) this.timeRow.parentNode.removeChild(this.timeRow);
          if (this.timeRangeRow && this.timeRangeRow.parentNode) this.timeRangeRow.parentNode.removeChild(this.timeRangeRow);
          this.timeRow = null; this.timeRangeRow = null;
          this.ampmSelect = null; this.startAmpmSelect = null; this.endAmpmSelect = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'timeStep')) {
        var oldStep = this.options.timeStep;
        this.options.timeStep = Number(partial.timeStep) > 0 ? Number(partial.timeStep) : oldStep;
        if (this.options.enableTime && this.timeRow) {
          this._rebuildMinuteOptions();
          this._updateTimeInputs();
        } else if (this.options.enableTime && this.timeRangeRow) {
          // Rebuild minutes for both range minute selects
          const rebuild = (select) => {
            if (!select) return;
            const step = Number(this.options.timeStep) > 0 ? Number(this.options.timeStep) : 5;
            select.textContent = '';
            let m = 0; while (m < 60) { const opt = document.createElement('option'); opt.value = String(m); opt.textContent = padStartNumber(m, 2); select.appendChild(opt); m += step; }
          };
          rebuild(this.startMinuteSelect); rebuild(this.endMinuteSelect);
          this._updateRangeTimeInputs();
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
      if (Object.prototype.hasOwnProperty.call(partial, 'range')) {
        var wantRange = Boolean(partial.range);
        // ignore range in schedule mode
        if ((this.options.scheduleMode && this.options.scheduleMode !== 'none')) {
          wantRange = false;
        }
        if (wantRange !== this.options.range) {
          this.options.range = wantRange;
          if (this.options.range) {
            // Switch to range mode
            if (this.timeRow && this.timeRow.parentNode) { this.timeRow.parentNode.removeChild(this.timeRow); }
            this.timeRow = null; this.ampmSelect = null;
            if (this.options.enableTime && !this.timeRangeRow) { this._buildRangeTimeControls(); if (this.timeRangeRow) this.calendarElement.insertBefore(this.timeRangeRow, this.footer); }
            this.selectedDate = null;
            const existing = String(this.inputElement.value || '').trim();
            const rg = existing ? this._parseRangeString(existing) : null;
            this.rangeStart = rg ? rg.start : null;
            this.rangeEnd = rg ? rg.end : null;
          } else {
            // Switch to single mode
            const carry = this.rangeStart ? new Date(this.rangeStart.getTime()) : null;
            this.rangeStart = null; this.rangeEnd = null; this.hoveringDate = null;
            if (this.timeRangeRow && this.timeRangeRow.parentNode) { this.timeRangeRow.parentNode.removeChild(this.timeRangeRow); }
            this.timeRangeRow = null; this.startAmpmSelect = null; this.endAmpmSelect = null;
            if (this.options.enableTime && !this.timeRow) { this._buildTimeControls(); if (this.timeRow) this.calendarElement.insertBefore(this.timeRow, this.footer); }
            this.setDate(carry, 'api');
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'rangeSeparator')) {
        this.options.rangeSeparator = partial.rangeSeparator || this.options.rangeSeparator || ' - ';
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'confirm')) {
        var wantConfirm = Boolean(partial.confirm);
        if (wantConfirm !== this.options.confirm) {
          this.options.confirm = wantConfirm;
          var selfUpd2 = this;
          if (wantConfirm) {
            if (!this.doneButton) {
              this.doneButton = createElement('button', 'dp-btn dp-done', { type: 'button' });
              this.doneButton.textContent = this.options.i18n.buttons.done;
              this.doneButton.addEventListener('click', function () { selfUpd2._commitValue(); });
              if (this.footer) this.footer.appendChild(this.doneButton);
            }
          } else {
            if (this.doneButton && this.doneButton.parentNode) this.doneButton.parentNode.removeChild(this.doneButton);
            this.doneButton = null;
          }
        }
      }
      this._renderWeekdays();
      this._render();
    }

    _handleRangeClick(dayDate) {
      if (!this.options.range) return;
      if (!this.rangeStart || (this.rangeStart && this.rangeEnd)) {
        // 시작 새로 지정
        if (this.options.enableTime) {
          this.rangeStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), this.startHours || 0, this.startMinutes || 0);
        } else {
          this.rangeStart = startOfDay(dayDate);
        }
        this.rangeEnd = null;
        this.hoveringDate = null;
        this._syncRangeValue('user');
        this._updateRangeTimeInputs();
        this._render();
        return;
      }
      // start만 있고 end 없음
      const start = this.rangeStart;
      let end = this.options.enableTime
        ? new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), this.endHours || 0, this.endMinutes || 0)
        : startOfDay(dayDate);
      if (end < start) {
        this.rangeEnd = start;
        this.rangeStart = end;
      } else {
        this.rangeEnd = end;
      }
      this.hoveringDate = null;
      this._syncRangeValue('user');
      this._updateRangeTimeInputs();
      this._render();
      if (!this.options.confirm && this.options.autoClose && !this.options.inline) this.close();
    }

    setMinDate(dateOrString) { this.updateOptions({ minDate: dateOrString }); }
    setMaxDate(dateOrString) { this.updateOptions({ maxDate: dateOrString }); }

    getSchedule() {
      if (this.options.scheduleMode === 'none') return null;
      return {
        mode: this.options.scheduleMode,
        weekly: Array.from(this.scheduleWeeklySelected),
        monthly: Array.from(this.scheduleMonthlySelected),
        array: this._formatScheduleArray()
      };
    }

    setSchedule(payload, source) {
      if (!payload || typeof payload !== 'object') return;
      if (payload.mode && payload.mode !== this.options.scheduleMode) {
        this.updateOptions({ scheduleMode: payload.mode });
      }
      if (this.options.scheduleMode === 'weekly' && payload.weekly && Array.isArray(payload.weekly)) {
        this.scheduleWeeklySelected.clear();
        for (var i = 0; i < payload.weekly.length; i += 1) {
          this.scheduleWeeklySelected.add(payload.weekly[i]);
        }
      } else if (this.options.scheduleMode === 'monthly' && payload.monthly && Array.isArray(payload.monthly)) {
        this.scheduleMonthlySelected.clear();
        for (var j = 0; j < payload.monthly.length; j += 1) {
          this.scheduleMonthlySelected.add(payload.monthly[j]);
        }
      }
      this._syncScheduleValue(source || 'api');
      this._render();
    }

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
