## DatePicker (Pure JS)
<img width="1319" height="1096" alt="image" src="https://github.com/user-attachments/assets/90d68a77-308c-4348-a47f-53d2c4f2877d" />

간단하고 가벼운 순수 JavaScript 데이트피커입니다. 날짜 선택은 기본, 선택적으로 시간 선택과 아날로그 시계 표시를 지원합니다. 외부 라이브러리 의존성이 없습니다.

### 데모 페이지
- https://mydatepicker.netlify.app/

### 설치/사용
생성자에 입력 요소(노드 또는 셀렉터)와 옵션을 전달해 인스턴스를 생성합니다.

```html
<input id="date1" type="text" placeholder="yyyy-MM-dd" />
<script src="Datepicker.js"></script>
<script>
  const dp = new DatePicker('#date1', {
    format: 'yyyy-MM-dd',
  });
  // 필요 시
  // dp.open(); dp.close(); dp.destroy();
</script>
```

### 주간/월간 스케줄 선택
`scheduleMode` 옵션으로 날짜가 아닌 특정 요일이나 일을 선택하는 UI를 활성화할 수 있습니다. 주간/월간 선택은 배열 기반으로 동작하며, 기존 문자열 형식도 호환됩니다.

```html
<input id="weekly" placeholder="[1,3,5]" />
<input id="monthly" placeholder="[1,15,31]" />
<script>
  // 주간 다중 선택 (커스텀 헤더 텍스트)
  const dpWeekly = new DatePicker('#weekly', {
    scheduleMode: 'weekly',
    scheduleWeeklyMulti: true,
    confirm: true, // 완료 버튼으로 확정
    weeklyHeaderText: '요일 선택하기', // 커스텀 헤더 텍스트
    onSelectSchedule: (payload, ctx) => {
      console.log('선택된 요일 배열 (0=일~6=토):', payload.array); // [1, 3, 5]
      console.log('주간 세트:', payload.weekly); // Set {1, 3, 5}
    }
  });

  // 월간 단일 선택 (커스텀 헤더 텍스트)
  const dpMonthly = new DatePicker('#monthly', {
    scheduleMode: 'monthly',
    scheduleMonthlyMulti: false, // 하나만 선택 가능
    confirm: true,
    monthlyHeaderText: '날짜 선택하기', // 커스텀 헤더 텍스트
    onSelectSchedule: (payload, ctx) => {
      console.log('선택된 일자 배열:', payload.array); // [15]
      console.log('월간 세트:', payload.monthly); // Set {15}
    }
  });

  // API를 통한 값 설정
  dpWeekly.setSchedule({ weekly: [1, 3, 5] }); // 월, 수, 금 선택
  dpMonthly.setSchedule({ monthly: [1, 15] }); // 1일, 15일 선택

  // 값 조회
  const weeklySchedule = dpWeekly.getSchedule();
  console.log(weeklySchedule); // { mode: 'weekly', weekly: [1, 3, 5], monthly: [], array: [1, 3, 5] }
</script>
```
**값 형식:**
- 주간: `[1, 3, 5]` (월=1, 화=2, 수=3, 목=4, 금=5, 토=6, 일=7/0)
- 월간: `[1, 15, 31]` (1일, 15일, 31일)
- 기존 문자열 형식(`weekly:1,3,5`)도 호환 지원
    
### 날짜+시간 선택 예시 (24시간/12시간 모드)
```html
<input id="dt" type="text" placeholder="yyyy-MM-dd HH:mm" />
<script>
  // 24시간 모드 (기본)
  const dp24 = new DatePicker('#dt', {
    format: 'yyyy-MM-dd HH:mm',
    enableTime: true,
    timeStep: 10 // 분 단위 스텝
  });
  // 12시간 모드 (AM/PM 셀렉트 포함)
  const dp12 = new DatePicker('#dt', {
    format: 'yyyy-MM-dd hh:mm a',
    enableTime: true,
    hour12: true,
    timeStep: 10
  });
</script>
```

### 인라인 렌더링 + 컨테이너에 배치 예시
```html
<input id="inlineInput" type="text" />
<div id="inlinePane"></div>
<script>
  const inlineDp = new DatePicker('#inlineInput', {
    inline: true,
    inlineContainer: '#inlinePane', // 이 컨테이너에 달력이 렌더링됨
    showAnalogClock: true,          // 우측에 아날로그 시계 표시
    enableTime: true,               // 시간 선택 셀렉트
    format: 'yyyy-MM-dd HH:mm'
  });
</script>
```

### 주요 옵션
- **format**: 출력/파싱 포맷. 지원 토큰: `yyyy`, `MM`, `dd`, `HH`, `hh`, `mm`, `a`
- **firstDayOfWeek**: 주의 시작 요일(0=일, 1=월 …)
- **minDate / maxDate**: 선택 가능 범위 제한 (`Date` 또는 문자열)
- **disableDates(date: Date) => boolean**: 특정 날짜 비활성화 콜백
- **onSelect(date, ctx)**: 선택 시 콜백. `ctx.formatted`, `ctx.source('user'|'api')` 제공
- **i18n**: 월/요일/버튼/ARIA 텍스트 커스터마이즈
- **openOnFocus**: 입력 포커스 시 자동 오픈(기본 true)
- **autoClose**: 날짜 선택 시 자동 닫힘(기본 true, 시간 선택 활성화 시 자동 닫힘 방지됨)
- **showOutsideDays**: 이전/다음 달 날짜를 동일 그리드에 표시(기본 true)
- **inline**: 인라인 렌더 여부
- **inlineContainer**: 인라인 렌더링 시 삽입 대상 컨테이너(노드 또는 셀렉터)
- **position**: 팝오버 위치 `'auto' | 'bottom' | 'top'`
- **enableTime**: 시간 선택 드롭다운(시/분) 표시
- **hour12**: 12시간 모드(AM/PM 셀렉트, `hh`, `a` 포맷 사용)
- **timeStep**: 분 선택 스텝(기본 5)
- **showAnalogClock**: 우측에 아날로그 시계 표시
- **range**: 기간(시작~종료) 선택 모드 활성화
- **rangeSeparator**: 기간 표시 구분자(기본 ` - `)
  - `range: true`와 `enableTime: true`를 함께 사용하면 시작/종료 각각의 시간 선택 UI가 표시됩니다.
 - **confirm**: 완료 버튼 표시 및 확정 방식 사용. 버튼을 눌러야 입력값이 반영되고 창이 닫힘
   - **scheduleMode**: `'none'|'weekly'|'monthly'`. 주간/월간 스케줄 선택 모드 활성화
  - **scheduleWeeklyMulti**: 주간 모드에서 다중 선택 활성화(기본 true)
  - **scheduleMonthlyMulti**: 월간 모드에서 다중 선택 활성화(기본 true)
  - **weeklyHeaderText**: 주간 모드 헤더 텍스트 커스터마이즈 (기본: 한국어 '주간 스케줄 선택' / 영어 'Weekly Schedule')
  - **monthlyHeaderText**: 월간 모드 헤더 텍스트 커스터마이즈 (기본: 한국어 '월간 스케줄 선택' / 영어 'Monthly Schedule')
  - **onSelectSchedule(payload, ctx)**: 스케줄 선택 시 콜백. `payload`는 `{ mode, weekly, monthly, array }` 형태.
    
참고: 연/월 선택은 헤더의 셀렉트 박스로 제공됩니다. `minDate`/`maxDate`가 설정된 경우 연도 셀렉트 범위가 해당 범위에 맞춰집니다.

### 포맷 토큰
- `yyyy`: 4자리 연도
- `MM`: 2자리 월(01–12)
- `dd`: 2자리 일(01–31)
- `HH`: 2자리 24시간(00–23)
- `hh`: 2자리 12시간(01–12, hour12 모드에서 사용)
- `mm`: 2자리 분(00–59)
- `a`: AM/PM(12시간 모드에서 사용)

### 퍼블릭 API
- `open()` / `close()` / `toggle()`
- `destroy()`
- `getDate(): Date|null`
- `setDate(dateOrString, source?)`
- `getRange(): { start: Date|null, end: Date|null }` (range 모드 전용)
- `setRange(range | [start, end] | string, source?)` (range 모드 전용)
- `getSchedule(): { mode, weekly, monthly, array } | null` (schedule 모드 전용)
- `setSchedule(payload, source?)` (schedule 모드 전용)
- `updateOptions(partialOptions)`
- `setMinDate(dateOrString)` / `setMaxDate(dateOrString)`

### 접근성(ARIA)
- 캘린더 루트에 `role="dialog"`와 ARIA 라벨을 적용합니다.
- 키보드 내비게이션(방향키, Home/End, PageUp/PageDown, Enter/Space, Escape) 지원.

### 스타일 커스터마이즈
`Datepicker.css`에서 CSS 변수와 클래스(`.dp`, `.dp-day`, `.dp-time`, `.dp-clock` 등)를 수정해 테마를 변경할 수 있습니다.

### 라이선스
MIT License


