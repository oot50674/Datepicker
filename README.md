## DatePicker (Pure JS)
<img width="2475" height="1333" alt="image" src="https://github.com/user-attachments/assets/b90cf817-6801-4f11-ae8d-d3ece9edab40" />

간단하고 가벼운 순수 JavaScript 데이트피커입니다. 날짜 선택은 기본, 선택적으로 시간 선택과 아날로그 시계 표시를 지원합니다. 외부 라이브러리 의존성이 없습니다.

### 데모 실행
- 프로젝트를 로컬에 클론/다운로드한 뒤 `Index.html`을 브라우저로 열면 데모를 확인할 수 있습니다.

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

### 날짜+시간 선택 예시
```html
<input id="dt" type="text" placeholder="yyyy-MM-dd HH:mm" />
<script>
  const dp = new DatePicker('#dt', {
    format: 'yyyy-MM-dd HH:mm',
    enableTime: true,
    timeStep: 10 // 분 단위 스텝
  });
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
```

### 주요 옵션
- **format**: 출력/파싱 포맷. 지원 토큰: `yyyy`, `MM`, `dd`, `HH`, `mm`
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
- **timeStep**: 분 선택 스텝(기본 5)
- **showAnalogClock**: 우측에 아날로그 시계 표시

참고: 연/월 선택은 헤더의 셀렉트 박스로 제공됩니다. `minDate`/`maxDate`가 설정된 경우 연도 셀렉트 범위가 해당 범위에 맞춰집니다.

### 포맷 토큰
- `yyyy`: 4자리 연도
- `MM`: 2자리 월(01–12)
- `dd`: 2자리 일(01–31)
- `HH`: 2자리 24시간(00–23)
- `mm`: 2자리 분(00–59)

### 퍼블릭 API
- `open()` / `close()` / `toggle()`
- `destroy()`
- `getDate(): Date|null`
- `setDate(dateOrString, source?)`
- `updateOptions(partialOptions)`
- `setMinDate(dateOrString)` / `setMaxDate(dateOrString)`

### 접근성(ARIA)
- 캘린더 루트에 `role="dialog"`와 ARIA 라벨을 적용합니다.
- 키보드 내비게이션(방향키, Home/End, PageUp/PageDown, Enter/Space, Escape) 지원.

### 스타일 커스터마이즈
`Datepicker.css`에서 CSS 변수와 클래스(`.dp`, `.dp-day`, `.dp-time`, `.dp-clock` 등)를 수정해 테마를 변경할 수 있습니다.

### 라이선스
MIT License


