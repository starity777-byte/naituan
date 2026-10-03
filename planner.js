/* Owns the calendar, dated tasks and study room; NaituanLife owns persistence. */
(function () {
  'use strict';
  var D = window.NaituanPlannerState, L, data, selected, month, expanded = false, started = false;
  var $ = function (id) { return document.getElementById(id); };
  var editingId = null, preparedTask = null, duration = 25, custom = false, mode = '', lastDay;
  var originalTitle = document.title;
  var ambience = null;
  var scenes = [
    { id: 'sunny-desk', name: '午后书桌', position: '71%' },
    { id: 'rainy-desk', name: '雨夜书桌', position: '27%' },
    { id: 'sunny-window', name: '晴日窗边', position: '82%' },
    { id: 'rainy-sofa', name: '雨夜沙发', position: '77%' }
  ];
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (s) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]; }); }
  function icon(name) { return '<svg class="ui-icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function clock(ms) { var seconds = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  function timeText(ms) {
    if (ms < 60000) return Math.floor(ms / 1000) + ' 秒';
    var n = Math.floor(ms / 60000);
    return n < 60 ? n + ' 分钟' : Math.floor(n / 60) + ' 小时' + (n % 60 ? ' ' + n % 60 + ' 分钟' : '');
  }
  function dateLabel(key) { var d = D.date(key); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function dayLabel(key) { return key === D.dateKey() ? '今天' : key === D.shift(D.dateKey(), 1) ? '明天' : dateLabel(key); }
  function hour(value) { return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  function state() { return data.planner; }
  function ambiencePrefs() { return Object.assign({ scene: 'sunny-desk', enabled: false, rain: 30, purr: 35 }, state().ambience); }
  function saveAmbience(value) { return write(function (p) { p.ambience = Object.assign(ambiencePrefs(), value); }); }
  function ambienceMarkup() {
    return '<div class="study-environment" id="studyEnvironment" hidden><div class="study-environment-bar"><button type="button" id="studySceneButton" data-planner-action="scenes" aria-expanded="false" aria-controls="studyScenePanel">' + icon('leaf') + '<span id="studySceneName">午后书桌</span></button><span class="study-bar-divider" aria-hidden="true"></span><button type="button" id="studySoundButton" data-planner-action="sounds" aria-expanded="false" aria-controls="studySoundPanel"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg><span id="studySoundLabel">环境音</span><i id="studySoundLight" aria-hidden="true"></i></button></div>' +
      '<section class="study-environment-panel" id="studyScenePanel" aria-label="选择自习风景" hidden><div class="study-panel-heading"><h3>换个风景，继续陪你</h3><button class="icon-button" type="button" data-planner-action="close-environment" aria-label="收起风景选择">' + icon('close') + '</button></div><div class="study-scene-options">' + scenes.map(function (s) { return '<button type="button" data-study-scene="' + s.id + '" aria-pressed="false"><img src="assets/study/' + s.id + '.webp" alt="" loading="lazy"><span>' + s.name + '</span>' + icon('check') + '</button>'; }).join('') + '</div></section>' +
      '<section class="study-environment-panel" id="studySoundPanel" aria-label="自习环境声音" hidden><div class="study-panel-heading"><h3>给安静加一点声音</h3><button class="icon-button" type="button" data-planner-action="close-environment" aria-label="收起声音设置">' + icon('close') + '</button></div><button class="study-sound-switch" id="studySoundToggle" type="button" data-planner-action="sound-toggle" aria-pressed="false">开启环境声音</button>' +
      '<label class="study-mixer-row" for="studyRain"><span>窗外的雨</span><output id="studyRainValue" for="studyRain">30%</output><input id="studyRain" type="range" min="0" max="100" step="1" value="30" aria-label="雨声音量"></label>' +
      '<label class="study-mixer-row" for="studyPurr"><span>奶团的呼噜</span><output id="studyPurrValue" for="studyPurr">35%</output><input id="studyPurr" type="range" min="0" max="100" step="1" value="35" aria-label="呼噜声音量"></label>' +
      '<p class="study-sound-status" id="studySoundStatus" role="status">可以混合着听，调到 0 即可关闭其中一种。</p><button class="text-button" id="studyGlobalSound" type="button" data-planner-action="unmute-house" hidden>开启小屋音效</button></section></div>';
  }
  function closeEnvironment() {
    $('studyScenePanel').hidden = $('studySoundPanel').hidden = true;
    $('studySceneButton').setAttribute('aria-expanded', 'false');
    $('studySoundButton').setAttribute('aria-expanded', 'false');
  }
  function toggleEnvironment(kind) {
    var panel = $(kind === 'scenes' ? 'studyScenePanel' : 'studySoundPanel'), open = panel.hidden;
    closeEnvironment(); panel.hidden = !open;
    $(kind === 'scenes' ? 'studySceneButton' : 'studySoundButton').setAttribute('aria-expanded', String(open));
  }
  function paintAmbience() {
    if (!started) return;
    var pref = ambiencePrefs(), scene = scenes.find(function (s) { return s.id === pref.scene; }) || scenes[0];
    var src = 'assets/study/' + scene.id + '.webp';
    if ($('studyBackdropImage').getAttribute('src') !== src) $('studyBackdropImage').src = src;
    $('studyBackdropImage').style.setProperty('--study-focal-x', scene.position);
    $('studySceneName').textContent = scene.name;
    document.querySelectorAll('[data-study-scene]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.studyScene === scene.id)); });
    $('studyRain').value = pref.rain; $('studyPurr').value = pref.purr;
    $('studyRainValue').textContent = pref.rain + '%'; $('studyPurrValue').textContent = pref.purr + '%';
    paintAudioStatus();
  }
  function paintAudioStatus() {
    if (!started) return;
    var pref = ambiencePrefs(), status = ambience ? ambience.status() : {}, muted = window.NT.S().mute;
    var timer = state().timer, paused = timer && timer.runningSince == null;
    $('studySoundToggle').textContent = pref.enabled ? status.needsGesture && !muted && !paused ? '轻点恢复声音' : '关闭环境声音' : '开启环境声音';
    $('studySoundToggle').setAttribute('aria-pressed', String(pref.enabled));
    $('studySoundLabel').textContent = status.playing ? '声音播放中' : pref.enabled && paused ? '声音已暂停' : '环境音';
    $('studySoundLight').classList.toggle('is-playing', !!status.playing);
    $('studyGlobalSound').hidden = !muted;
    $('studySoundStatus').textContent = muted ? '小屋的音效已关闭，开启后就能听见。' : status.error || (paused && pref.enabled ? '暂停时声音也会歇一歇，继续专注时恢复。' : pref.enabled && Number(pref.rain) + Number(pref.purr) === 0 ? '两种声音都调到了 0，拖动滑块就能听见。' : '可以混合着听，调到 0 即可关闭其中一种。');
  }
  function syncAmbience(gesture) {
    if (!started || !ambience) return;
    var pref = ambiencePrefs(), timer = state().timer;
    ambience.setMix(pref);
    ambience.setPlaying(!!(pref.enabled && timer && timer.runningSince != null && $('plannerStudy').open && !window.NT.S().mute), gesture);
  }
  function write(fn, message) {
    var saved = L.update(function (next) { next.planner = D.create(next.planner); fn(next.planner, next); }, message);
    if (!saved) refresh();
    return saved;
  }
  function syncFocus(p, life) {
    var result = p.result, session = result && p.sessions.find(function (s) { return s.id === result.sessionId; });
    if (!session) return;
    session.days.forEach(function (day) {
      var record = life.days[day.date] || (life.days[day.date] = {}), summary = D.stats(p, day.date);
      record.focusMinutes = Math.floor(summary.ms / 60000);
      record.focusSessions = summary.count;
    });
  }
  function migrate(next) {
    var p = D.create(next.planner);
    if (!p.migrated) {
      (next.todos || []).forEach(function (item) {
        if (!p.tasks.some(function (t) { return t.id === item.id; })) p.tasks.push({ id: item.id || D.uid(), title: item.text || item.title || '', date: item.date || D.dateKey(), done: !!item.done, createdAt: Date.now() });
      });
      Object.keys(next.days || {}).forEach(function (key) {
        var old = next.days[key];
        if (old.focusMinutes > 0) {
          var ms = old.focusMinutes * 60000, at = D.date(key).getTime();
          p.sessions.push({ id: 'legacy-' + key, taskId: null, title: '之前的专注', startedAt: at, endedAt: at, durationMs: ms, plannedMs: ms, completed: true, legacy: true, days: [{ date: key, ms: ms }] });
        }
      });
      p.migrated = true;
    }
    next.planner = p;
  }
  function markup() {
    document.querySelector('.calendar-card').innerHTML =
      '<div class="planner-calendar-heading"><div><span class="planner-eyebrow">日子慢慢过，小事慢慢做</span><h2 id="calendarMonth"></h2></div>' +
      '<div class="planner-view-switch" aria-label="日历视图"><button type="button" data-planner-action="week" aria-pressed="true">周</button><button type="button" id="calendarToggle" data-planner-action="month" aria-pressed="false">月</button></div></div>' +
      '<div class="planner-calendar-nav"><button class="icon-button" type="button" id="calendarPrev" data-planner-action="previous">‹</button><span id="expandedMonth"></span><button class="text-button" type="button" id="calendarToday" data-planner-action="today">今天</button><button class="icon-button" type="button" id="calendarNext" data-planner-action="next">›</button></div>' +
      '<div class="week-labels" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="calendar-days" id="calendarWeek"></div>' +
      '<div id="calendarExpanded" hidden><div class="calendar-days full-month" id="calendarGrid"></div></div>' +
      '<div class="planner-calendar-foot"><span><i class="planner-dot task-dot"></i>待办 <i class="planner-dot focus-dot"></i>专注</span><span id="plannerDaySummary"></span></div>';
    document.querySelector('.todo-card').innerHTML =
      '<div class="section-line"><div><span class="planner-eyebrow" id="plannerSelectedDate"></span><h2 id="todoTitle">今天的小计划 <span id="plannerTaskCount"></span></h2></div><button class="planner-add" id="todoAdd" type="button" data-planner-action="add">' + icon('plus') + '添一件</button></div>' +
      '<ul class="todo-list planner-tasks" id="todoList"></ul><div class="planner-empty" id="todoEmpty"><span>给这一天，留一件想做的小事。</span><small>不用排满，慢慢来就好。</small></div>' +
      '<button class="text-button planner-undo" id="plannerUndo" data-planner-action="undo" type="button" hidden>已删除待办 · 撤销</button>' +
      '<details class="planner-records" id="plannerRecords"><summary><span>留下的专注</span><span id="plannerRecordTotal"></span></summary><ol id="plannerRecordList"></ol></details>';
    document.querySelector('.focus-card').innerHTML =
      '<div class="planner-focus-top"><span class="planner-room-label">' + icon('book') + '奶团自习室</span><span class="planner-focus-today" id="plannerFocusToday"></span></div>' +
      '<div class="planner-focus-main"><div><h2 id="focusTitle">一起，专注一小会儿</h2><output id="focusTime" aria-label="专注剩余时间">25:00</output><p id="focusNote">把眼前的一件小事，慢慢做好。</p></div><img class="planner-card-cat" src="assets/animated/眨眼.webp" alt="安静陪伴的奶团" draggable="false"></div>' +
      '<div class="planner-focus-bottom"><span id="plannerFocusHint">留一点安静的时间给自己</span><button class="primary-button" id="focusToggle" type="button" data-planner-action="study">去自习 ' + icon('back') + '</button></div>';
    var calendar = document.querySelector('.calendar-card'), tasks = document.querySelector('.todo-card'), focus = document.querySelector('.focus-card');
    calendar.insertAdjacentElement('afterend', tasks);
    tasks.insertAdjacentElement('afterend', focus);
    var dialogs = document.createElement('div');
    dialogs.id = 'plannerDialogs';
    dialogs.innerHTML =
      '<dialog class="house-dialog planner-task-dialog" id="plannerTaskDialog" aria-labelledby="plannerTaskHeading"><button class="dialog-close icon-button" type="button" data-planner-action="close-task" aria-label="关闭待办编辑">' + icon('close') + '</button>' +
      '<span class="planner-eyebrow">一张小小的计划纸</span><h2 id="plannerTaskHeading">添一件想做的事</h2><form id="plannerTaskForm"><label for="plannerTaskTitle">想做什么</label><input id="plannerTaskTitle" type="text" maxlength="120" placeholder="比如：看完书的第 3 章" required autocomplete="off"><label for="plannerTaskDate">放在哪一天</label><input id="plannerTaskDate" type="date" required><p class="planner-form-error" id="plannerTaskError" role="status"></p><button class="primary-button" type="submit">记到日历里</button></form><button class="text-button planner-delete" id="plannerTaskDelete" type="button" data-planner-action="delete">删除这件待办</button></dialog>' +
      '<dialog class="planner-study" id="plannerStudy" aria-labelledby="studyTitle"><div class="study-backdrop" id="studyBackdrop" aria-hidden="true" hidden><img id="studyBackdropImage" alt="" draggable="false"></div><div class="study-shell"><header class="study-header"><button class="text-button" type="button" data-planner-action="close-study">' + icon('back') + '回到生活</button><span>奶团自习室</span><span class="study-quiet">安静陪伴</span></header>' +
      '<div class="study-scene" aria-hidden="true"><div class="study-window"><span></span><i></i></div><div class="study-surface"></div><img class="study-books" src="assets/decor/attic/15-books-notebook.webp" alt=""><img class="study-cat" id="studyCat" src="assets/animated/眨眼.webp" alt=""><img class="study-lamp" src="assets/decor/attic/16-table-lamp.webp" alt=""></div>' +
      '<div class="study-content"><span class="study-kicker" id="studyKicker">现在，只管这一件事</span><h2 id="studyTitle">今天想专注做什么？</h2><p class="study-caption" id="studyCaption">奶团找好位置，准备陪你啦。</p>' +
      '<form id="studySetup"><label for="studyTask">带上一件待办 <span>可不选</span></label><select id="studyTask" aria-label="关联待办"></select><label for="studyGoal">这一小段的目标</label><input id="studyGoal" maxlength="120" placeholder="例如：看完书的第 3 章" autocomplete="off"><fieldset class="study-durations"><legend>留多少时间给它？</legend><div class="study-presets"><button type="button" data-minutes="15">15 <small>分钟</small></button><button type="button" data-minutes="25">25 <small>分钟</small></button><button type="button" data-minutes="50">50 <small>分钟</small></button><button type="button" id="studyCustom" data-planner-action="custom">自定义</button></div><label class="study-custom-row" id="studyCustomRow" hidden><input id="studyMinutes" type="number" min="1" max="180" step="1" aria-label="自定义专注分钟数"><span>分钟 · 1–180 分钟</span></label></fieldset><p class="planner-form-error" id="studyError" role="status"></p><button class="primary-button study-primary" type="submit">让奶团陪我开始</button><p class="study-small-note">先专注一小会儿，随时可以暂停。</p></form>' +
      '<section id="studyRunning" hidden><p id="studyRunningGoal" class="study-running-goal"></p><div class="study-clock" id="studyClock"><div><span id="studyPhase">正在专注</span><output id="studyTime" role="timer" aria-live="off">25:00</output><small id="studyElapsed"></small></div></div><p class="study-running-note" id="studyRunningNote"></p><div class="study-running-actions"><button class="primary-button study-primary" id="studyPause" type="button" data-planner-action="pause">暂停一下</button><button class="text-button" id="studyFinish" type="button" data-planner-action="finish">结束并保存</button></div><p class="study-small-note">回到生活页后，计时也会继续。</p></section>' +
      '<section id="studyResult" hidden><div class="study-result-time" id="studyResultTime"></div><p id="studyResultNote"></p><label class="study-complete-task" id="studyCompleteTask"><input type="checkbox" id="studyTaskDone"><span id="studyTaskDoneLabel"></span></label><button class="primary-button study-primary" id="studyRest" type="button" data-planner-action="rest">伸个懒腰，休息 5 分钟</button><button class="secondary-button" type="button" data-planner-action="again">再专注一小会儿</button><button class="text-button study-record-link" type="button" data-planner-action="view-record">去日历看看</button></section>' +
      '<p class="planner-form-error" id="studySaveError" role="status"></p></div><footer class="study-footer">一点点，也是在往前走。</footer>' + ambienceMarkup() + '</div></dialog>';
    $('app').append(dialogs);
  }
  function refresh() {
    if (!started) return;
    data = L.read();
    if (!data.planner || !data.planner.migrated) {
      if (L.update(migrate)) return;
      migrate(data);
    }
    data.planner = D.create(data.planner);
    selected = L.selectedDate();
    renderCalendar(); renderTasks(); renderFocus(); renderStudy();
  }
  function renderCalendar() {
    var p = state(), today = D.dateKey(), m = expanded ? month : D.date(selected);
    $('lifeDate').textContent = dateLabel(today) + ' · 星期' + '日一二三四五六'[D.date(today).getDay()];
    $('lifeDate').dateTime = today;
    $('calendarMonth').textContent = m.getFullYear() + ' 年 ' + (m.getMonth() + 1) + ' 月';
    $('calendarWeek').hidden = expanded;
    $('calendarExpanded').hidden = !expanded;
    document.querySelector('[data-planner-action="week"]').setAttribute('aria-pressed', String(!expanded));
    $('calendarToggle').setAttribute('aria-pressed', String(expanded));
    $('calendarPrev').setAttribute('aria-label', expanded ? '上个月' : '上一周');
    $('calendarNext').setAttribute('aria-label', expanded ? '下个月' : '下一周');
    var first = expanded ? new Date(m.getFullYear(), m.getMonth(), 1, 12) : D.date(selected);
    var offset = (first.getDay() + 6) % 7;
    var start = D.shift(D.dateKey(first), -offset);
    var length = expanded ? Math.ceil((offset + new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()) / 7) * 7 : 7;
    $('expandedMonth').textContent = expanded ? '给日子留一点期待' : dateLabel(start) + ' — ' + dateLabel(D.shift(start, 6));
    var html = '';
    for (var i = 0; i < length; i++) {
      var key = D.shift(start, i), d = D.date(key), s = D.stats(p, key), records = window.NaituanJournal ? window.NaituanJournal.dayStats(key).count : 0;
      var label = key.replace(/-/g, ' ') + (records ? '，' + records + ' 条日常记录' : '') + (key === today ? '，今天' : '') + (s.tasks ? '，' + s.tasks + ' 件待办' : '') + (s.ms ? '，专注 ' + timeText(s.ms) : '');
      html += '<button type="button" data-date="' + key + '" aria-label="' + label + '" aria-pressed="' + (key === selected) + '"' + (key === today ? ' aria-current="date"' : '') + (expanded && d.getMonth() !== m.getMonth() ? ' class="planner-outside"' : '') + '><span>' + d.getDate() + '</span><span class="planner-day-dots" aria-hidden="true">' + (s.tasks ? '<i class="planner-dot task-dot"></i>' : '') + (s.ms ? '<i class="planner-dot focus-dot"></i>' : '') + (records ? '<i class="planner-dot record-dot"></i>' : '') + '</span></button>';
    }
    $(expanded ? 'calendarGrid' : 'calendarWeek').innerHTML = html;
    var summary = D.stats(p, selected);
    $('plannerDaySummary').textContent = dayLabel(selected) + ' · ' + (summary.ms ? '专注 ' + timeText(summary.ms) : summary.tasks ? summary.done + '/' + summary.tasks + ' 件完成' : '留一点空白也很好');
  }
  function renderTasks() {
    var p = state(), tasks = p.tasks.filter(function (t) { return t.date === selected; }).slice().sort(function (a, b) { return Number(a.done) - Number(b.done); });
    $('plannerSelectedDate').textContent = selected.replace(/-/g, '.') + ' · 星期' + '日一二三四五六'[D.date(selected).getDay()];
    $('todoTitle').firstChild.textContent = dayLabel(selected) + '的小计划 ';
    $('plannerTaskCount').textContent = tasks.length ? tasks.filter(function (t) { return t.done; }).length + '/' + tasks.length : '';
    $('todoList').innerHTML = tasks.map(function (t) {
      return '<li class="planner-task' + (t.done ? ' is-done' : '') + '"><label><input type="checkbox" data-task-check="' + esc(t.id) + '"' + (t.done ? ' checked' : '') + '><span>' + esc(t.title) + '</span></label><div class="planner-task-actions">' + (!t.done ? '<button class="planner-task-start" type="button" data-start-task="' + esc(t.id) + '" aria-label="专注：' + esc(t.title) + '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z"/></svg></button>' : '') + '<button class="planner-task-edit" type="button" data-edit-task="' + esc(t.id) + '" aria-label="编辑：' + esc(t.title) + '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 12 9-9 4 4-9 9-5 1ZM11 5l4 4"/></svg></button></div></li>';
    }).join('');
    $('todoEmpty').hidden = !!tasks.length;
    $('plannerUndo').hidden = !p.deletedTask;
    var records = p.sessions.filter(function (s) { return D.dayMs(s, selected) > 0; }).slice().reverse();
    $('plannerRecords').hidden = !records.length;
    $('plannerRecordTotal').textContent = timeText(D.stats(p, selected).ms) + ' · ' + records.length + ' 段';
    $('plannerRecordList').innerHTML = records.map(function (s) {
      return '<li><span class="planner-record-mark" aria-hidden="true">' + icon('check') + '</span><div><b>' + esc(s.title) + '</b><small>' + (s.legacy ? '之前留下的记录' : hour(s.startedAt) + ' 开始' + (s.days.length > 1 ? ' · 跨日专注' : '') + (s.completed ? ' · 完成一段' : ' · 已保存')) + '</small></div><strong>' + timeText(D.dayMs(s, selected)) + '</strong></li>';
    }).join('');
  }
  function renderFocus() {
    var p = state(), timer = p.timer, today = D.stats(p, D.dateKey());
    $('plannerFocusToday').textContent = today.ms ? '今天 ' + timeText(today.ms) : timer ? '今天的第一小段' : '等你一起开始';
    $('focusTitle').textContent = timer ? timer.kind === 'break' ? '歇一歇，也很好' : '奶团正在陪着你' : '一起，专注一小会儿';
    $('focusTime').hidden = !timer;
    $('focusNote').textContent = timer ? timer.title : '把眼前的一件小事，慢慢做好。';
    $('focusToggle').innerHTML = (timer ? '回自习室' : p.result ? p.result.kind === 'break' ? '回到自习室' : '查看这次专注' : '去自习') + ' ' + icon('back');
    $('plannerFocusHint').textContent = timer ? timer.runningSince == null ? '已经暂停，准备好再继续' : '不用赶，跟着自己的节奏' : '留一点安静的时间给自己';
    document.querySelector('.focus-card').classList.toggle('planner-focus-active', !!timer);
    tickDisplay();
  }
  function select(key) { month = D.date(key); L.selectDate(key); }
  function editTask(id) {
    var task = id && state().tasks.find(function (t) { return t.id === id; });
    editingId = task ? task.id : null;
    $('plannerTaskHeading').textContent = task ? '把小计划改一改' : '添一件想做的事';
    $('plannerTaskTitle').value = task ? task.title : '';
    $('plannerTaskDate').value = task ? task.date : selected;
    $('plannerTaskDelete').hidden = !task;
    $('plannerTaskError').textContent = '';
    $('plannerTaskDialog').showModal();
    $('plannerTaskTitle').focus();
  }
  function prepare(taskId) {
    preparedTask = taskId || null;
    var task = state().tasks.find(function (t) { return t.id === preparedTask; });
    var options = state().tasks.filter(function (t) { return !t.done; });
    options.sort(function (a, b) { return Number(b.date === selected) - Number(a.date === selected) || a.date.localeCompare(b.date); });
    $('studyTask').innerHTML = '<option value="">先不关联待办</option>' + options.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(dayLabel(t.date) + ' · ' + t.title) + '</option>'; }).join('');
    $('studyTask').value = task ? task.id : '';
    $('studyGoal').value = task ? task.title : '';
    duration = state().minutes;
    custom = [15, 25, 50].indexOf(duration) < 0;
    $('studyMinutes').value = duration;
    $('studyError').textContent = '';
    renderDurations();
  }
  function openStudy(taskId) {
    settle();
    if (!state().timer) {
      if (taskId && state().result && !write(function (p) { p.result = null; })) return;
      if (!state().result) prepare(taskId);
    }
    mode = '';
    renderStudy();
    if (!$('plannerStudy').open) $('plannerStudy').showModal();
    syncAmbience(true);
  }
  function renderDurations() {
    document.querySelectorAll('[data-minutes]').forEach(function (b) { b.setAttribute('aria-pressed', String(!custom && Number(b.dataset.minutes) === duration)); });
    $('studyCustom').setAttribute('aria-pressed', String(custom));
    $('studyCustomRow').hidden = !custom;
  }
  function renderStudy() {
    var p = state(), timer = p.timer, result = p.result;
    var nextMode = timer ? 'running' : result ? 'result' : 'setup';
    $('studySetup').hidden = nextMode !== 'setup';
    $('studyRunning').hidden = nextMode !== 'running';
    $('studyResult').hidden = nextMode !== 'result';
    if (mode !== nextMode) { mode = nextMode; $('studySaveError').textContent = ''; }
    $('plannerStudy').dataset.mode = nextMode;
    $('plannerStudy').dataset.break = String(!!(timer && timer.kind === 'break'));
    $('studyBackdrop').hidden = $('studyEnvironment').hidden = nextMode !== 'running';
    if (nextMode !== 'running') closeEnvironment();
    paintAmbience();
    syncAmbience(false);
    if (nextMode === 'setup') {
      $('studyKicker').textContent = '现在，只管这一件事';
      $('studyTitle').textContent = '今天想专注做什么？';
      $('studyCaption').textContent = '奶团找好位置，准备陪你啦。';
      setCat('眨眼');
    } else if (timer) {
      var rest = timer.kind === 'break', paused = timer.runningSince == null;
      $('studyKicker').textContent = rest ? '认真休息，也是照顾自己' : paused ? '让思绪，稍微歇一歇' : '现在，只管这一件事';
      $('studyTitle').textContent = rest ? '伸个懒腰，喝口水' : paused ? '停一停，没关系' : '奶团在这里陪你';
      $('studyCaption').textContent = rest ? '看看远处，让眼睛也放个小假。' : paused ? '这段暂停的时间不会计入专注。' : '不用着急，我们慢慢来。';
      $('studyRunningGoal').textContent = rest ? '5 分钟的小休息' : timer.title;
      $('studyPause').textContent = paused ? '准备好了，继续' : '暂停一下';
      $('studyFinish').textContent = rest ? '结束休息' : '结束并保存';
      $('studyRunningNote').textContent = rest ? '休息不会计入专注记录。' : '每一小段认真，都会被好好记住。';
      setCat(rest ? '伸懒腰' : paused ? '睡觉' : '眨眼');
    } else {
      var isBreak = result.kind === 'break';
      $('studyKicker').textContent = isBreak ? '休息的小片刻' : '今天，又往前走了一点点';
      $('studyTitle').textContent = isBreak ? '准备好，再慢慢继续' : result.sessionId ? '这一小段，已经留下了' : '没关系，随时再开始';
      $('studyCaption').textContent = isBreak ? '奶团也舒舒服服地伸了个懒腰。' : result.title;
      $('studyResultTime').textContent = isBreak ? '歇好了' : timeText(result.durationMs);
      $('studyResultNote').textContent = isBreak ? '接下来想做什么，由你决定。' : result.sessionId ? '实际专注时间已记进日历。' : '这次还没有计时满 1 秒，先不给日历添记录。';
      var task = p.tasks.find(function (t) { return t.id === result.taskId; });
      $('studyCompleteTask').hidden = isBreak || !task || !result.sessionId;
      if (task) { $('studyTaskDone').checked = !!task.done; $('studyTaskDoneLabel').textContent = '也完成了「' + task.title + '」'; }
      $('studyRest').hidden = isBreak || !result.sessionId;
      $('studyResultTime').classList.toggle('is-break', isBreak);
      setCat(isBreak ? '伸懒腰' : '开心');
    }
    tickDisplay();
  }
  function setCat(name) {
    var el = $('studyCat'), src = 'assets/animated/' + name + '.webp';
    if (el.getAttribute('src') !== src) el.src = src;
  }
  function tickDisplay() {
    if (!started) return;
    var t = state().timer;
    if (!t) { document.title = originalTitle; if ($('journalStudyNote')) $('journalStudyNote').textContent = state().result ? '这一段已收好，点开看看' : '陪你专注一小会儿'; return; }
    var elapsed = D.elapsed(t, Date.now()), remaining = t.plannedMs - elapsed, text = clock(remaining);
    $('focusTime').textContent = text;
    $('studyTime').textContent = text;
    $('studyPhase').textContent = t.runningSince == null ? '已暂停' : t.kind === 'break' ? '休息时间' : '正在专注';
    if ($('journalStudyNote')) $('journalStudyNote').textContent = $('studyPhase').textContent + ' · ' + text;
    $('studyElapsed').textContent = (t.kind === 'break' ? '已经休息 ' : '已经专注 ') + timeText(elapsed);
    $('studyClock').style.setProperty('--study-progress', (elapsed / t.plannedMs * 100) + '%');
    document.title = text + ' · ' + (t.runningSince == null ? '已暂停' : t.kind === 'break' ? '奶团陪你休息' : '奶团陪你专注');
  }
  function settle() {
    var t = state().timer;
    if (!t || D.elapsed(t, Date.now()) < t.plannedMs) return false;
    return write(function (p, life) { D.settle(p, Date.now()); syncFocus(p, life); }, t.kind === 'break' ? '小休息结束啦，准备好了再继续。' : '这一段专注完成，奶团替你记好了。');
  }
  function tick() {
    var today = D.dateKey();
    if (lastDay !== today) {
      var wasToday = selected === lastDay;
      lastDay = today;
      if (wasToday) select(today); else refresh();
    }
    if (!settle()) tickDisplay();
  }
  function action(name) {
    var p = state();
    if (name === 'week' || name === 'month') { expanded = name === 'month'; month = D.date(selected); renderCalendar(); }
    if (name === 'previous' || name === 'next') {
      var direction = name === 'next' ? 1 : -1;
      if (expanded) { month = new Date(month.getFullYear(), month.getMonth() + direction, 1, 12); renderCalendar(); }
      else select(D.shift(selected, direction * 7));
    }
    if (name === 'today') select(D.dateKey());
    if (name === 'add') editTask();
    if (name === 'close-task') $('plannerTaskDialog').close();
    if (name === 'delete' && editingId) {
      if (write(function (next) { next.deletedTask = next.tasks.find(function (t) { return t.id === editingId; }); next.tasks = next.tasks.filter(function (t) { return t.id !== editingId; }); }, '待办已删除，可以在列表下面撤销。')) $('plannerTaskDialog').close();
    }
    if (name === 'undo' && p.deletedTask) {
      var restoreDate = p.deletedTask.date;
      if (write(function (next) { if (!next.tasks.some(function (t) { return t.id === next.deletedTask.id; })) next.tasks.push(next.deletedTask); next.deletedTask = null; }, '小计划找回来啦。')) select(restoreDate);
    }
    if (name === 'study') openStudy();
    if (name === 'close-study') $('plannerStudy').close();
    if (name === 'custom') { custom = true; renderDurations(); $('studyMinutes').focus(); }
    if (name === 'scenes' || name === 'sounds') toggleEnvironment(name);
    if (name === 'close-environment') closeEnvironment();
    if (name === 'sound-toggle') {
      var soundPref = ambiencePrefs(), soundStatus = ambience && ambience.status();
      if (!(soundPref.enabled && soundStatus && soundStatus.needsGesture) && !saveAmbience({ enabled: !soundPref.enabled })) return;
      syncAmbience(true);
    }
    if (name === 'unmute-house') { window.NT.setMute(false); syncAmbience(true); }
    if (name === 'pause') {
      if (settle()) return;
      if (!write(function (next) { if (next.timer.runningSince == null) D.resume(next, Date.now()); else D.pause(next, Date.now()); })) $('studySaveError').textContent = '这次变更还没保存，请再试一次。';
      syncAmbience(true);
    }
    if (name === 'finish') {
      if (!write(function (next, life) { D.finish(next, Date.now()); syncFocus(next, life); }, p.timer && p.timer.kind === 'break' ? '休息结束，按自己的节奏来。' : '这段认真已经记进日历了。')) $('studySaveError').textContent = '记录还没有保存成功，计时保留着，可以再试一次。';
    }
    if (name === 'rest') { write(function (next) { D.start(next, { kind: 'break', title: '伸个懒腰，喝口水' }, Date.now()); }); syncAmbience(true); }
    if (name === 'again') {
      var taskId = p.result && p.result.taskId;
      if (write(function (next) { next.result = null; })) prepare(taskId);
    }
    if (name === 'view-record') {
      var session = p.result && p.sessions.find(function (s) { return s.id === p.result.sessionId; });
      select(session && session.days.length ? session.days[session.days.length - 1].date : D.dateKey());
      $('plannerRecords').open = true;
      $('plannerStudy').close();
      $('plannerRecords').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  function bind() {
    $('app').addEventListener('click', function (event) {
      var el = event.target.closest('button');
      if (!el) return;
      if (el.dataset.plannerAction) action(el.dataset.plannerAction);
      if (el.dataset.date) { select(el.dataset.date); var current = document.querySelector((expanded ? '#calendarGrid' : '#calendarWeek') + ' [data-date="' + el.dataset.date + '"]'); if (current) current.focus({ preventScroll: true }); }
      if (el.dataset.editTask) editTask(el.dataset.editTask);
      if (el.dataset.startTask) openStudy(el.dataset.startTask);
      if (el.dataset.minutes) { duration = Number(el.dataset.minutes); custom = false; $('studyMinutes').value = duration; renderDurations(); }
      if (el.dataset.studyScene) { if (saveAmbience({ scene: el.dataset.studyScene })) closeEnvironment(); }
    });
    $('plannerStudy').addEventListener('close', function () { closeEnvironment(); syncAmbience(false); });
    $('plannerStudy').addEventListener('cancel', function (event) { if (!$('studyScenePanel').hidden || !$('studySoundPanel').hidden) { event.preventDefault(); closeEnvironment(); } });
    $('plannerStudy').addEventListener('pointerdown', function (event) { if (!event.target.closest('.study-environment')) closeEnvironment(); });
    ['studyRain', 'studyPurr'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        var mix = { rain: Number($('studyRain').value), purr: Number($('studyPurr').value) };
        $('studyRainValue').textContent = mix.rain + '%'; $('studyPurrValue').textContent = mix.purr + '%';
        if (ambience) ambience.setMix(mix);
      });
      $(id).addEventListener('change', function () { saveAmbience({ rain: Number($('studyRain').value), purr: Number($('studyPurr').value) }); syncAmbience(true); });
    });
    window.addEventListener('naituan:sound-change', function () { syncAmbience(false); paintAudioStatus(); });
    window.addEventListener('pagehide', function () { if (ambience) ambience.destroy(); });
    $('todoList').addEventListener('change', function (event) {
      var id = event.target.dataset.taskCheck, done = event.target.checked;
      if (!id) return;
      write(function (p) { var task = p.tasks.find(function (t) { return t.id === id; }); if (task) task.done = done; }, done ? '又完成了一件小事。' : '已经放回小计划里。');
      var input = Array.from($('todoList').querySelectorAll('input')).find(function (el) { return el.dataset.taskCheck === id; });
      if (input) input.focus({ preventScroll: true });
    });
    $('plannerTaskForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var title = $('plannerTaskTitle').value.trim(), key = $('plannerTaskDate').value;
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(key)) { $('plannerTaskError').textContent = '写下一件小事，并选好日期。'; return; }
      if (write(function (p) { var task = p.tasks.find(function (t) { return t.id === editingId; }); if (task) { task.title = title; task.date = key; } else p.tasks.push({ id: D.uid(), title: title, date: key, done: false, createdAt: Date.now() }); }, '小计划已经放进日历啦。')) { $('plannerTaskDialog').close(); select(key); }
      else $('plannerTaskError').textContent = '暂时没保存成功，内容还在，可以再试一次。';
    });
    $('studyTask').addEventListener('change', function () { var task = state().tasks.find(function (t) { return t.id === $('studyTask').value; }); preparedTask = task ? task.id : null; $('studyGoal').value = task ? task.title : ''; });
    $('studySetup').addEventListener('submit', function (event) {
      event.preventDefault();
      var value = custom ? Number($('studyMinutes').value) : duration;
      if (!Number.isInteger(value) || value < 1 || value > 180) { $('studyError').textContent = '选一个 1–180 分钟的整数吧。'; return; }
      var options = { minutes: value, taskId: $('studyTask').value || null, title: $('studyGoal').value.trim() || '专注一小会儿' };
      if (!write(function (p) { D.start(p, options, Date.now()); })) $('studyError').textContent = '暂时没保存成功，还没有开始计时，可以再试一次。';
      syncAmbience(true);
    });
    $('studyTaskDone').addEventListener('change', function () { var done = this.checked; write(function (p) { var task = p.tasks.find(function (t) { return p.result && t.id === p.result.taskId; }); if (task) task.done = done; }); });
    window.addEventListener('naituan:life-change', refresh);
    window.addEventListener('naituan:life-date', function () { selected = L.selectedDate(); refresh(); });
    window.addEventListener('naituan:page', function (event) { if (event.detail.page === 'life') { tick(); refresh(); } });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { refresh(); tick(); } });
  }
  function init() {
    if (started || !window.NaituanLife || !D) return;
    L = window.NaituanLife;
    data = L.read();
    if (!data.planner || !data.planner.migrated) { if (!L.update(migrate)) return; data = L.read(); }
    selected = L.selectedDate(); month = D.date(selected); lastDay = D.dateKey();
    markup(); started = true;
    if (window.NaituanStudyAmbience) ambience = window.NaituanStudyAmbience.create(paintAudioStatus);
    bind(); refresh(); prepare(); tick();
    setInterval(tick, 1000);
  }
  window.NaituanPlanner = { init: init, render: refresh, open: openStudy, selectDate: select,
    totalFocusMinutes: function () { return started ? D.totalMs(state()) / 60000 : 0; },
    summary: function (key) { return started ? D.stats(state(), key || D.dateKey()) : { tasks: 0, done: 0, count: 0, ms: 0 }; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
