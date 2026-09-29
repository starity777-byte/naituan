(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NT = window.NT;
  var selected = dateKey();
  var foodPhoto = '', photoPending = false, foodDate = '', wordDate = '';
  function dateKey(date) {
    date = date || new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function initial() {
    return {
      version: 1, days: {}, gems: 0,
      todos: [
        { id: 'first-words', text: '背 50 个单词', done: false },
        { id: 'first-notes', text: '整理本周笔记', done: false },
        { id: 'first-sleep', text: '十二点前睡觉', done: false }
      ],
      timer: { duration: 1500, remaining: 1500, endAt: 0 }
    };
  }
  function state() {
    if (!NT.S().life || typeof NT.S().life !== 'object') NT.S().life = initial();
    var life = NT.S().life;
    if (!life.days || typeof life.days !== 'object' || Array.isArray(life.days)) life.days = {};
    if (!Array.isArray(life.todos)) life.todos = [];
    if (!Number.isFinite(life.gems)) life.gems = 0;
    if (!life.timer || typeof life.timer !== 'object') life.timer = initial().timer;
    return life;
  }
  function read() { return JSON.parse(JSON.stringify(state())); }
  function report(message) {
    $('lifeStatus').textContent = message;
    window.dispatchEvent(new CustomEvent('naituan:notice', { detail: { message: message } }));
  }
  function update(mutator, message) {
    var previous = state(), next = read();
    mutator(next);
    NT.S().life = next;
    if (!NT.save()) {
      NT.S().life = previous;
      report('这次没有保存成功，浏览器存储可能已满。可以先导出存档，再重试。');
      return false;
    }
    render();
    window.dispatchEvent(new CustomEvent('naituan:life-change'));
    if (message) { NT.sound(/完成|宝石/.test(message) ? 'reward' : 'save'); report(message); }
    return true;
  }
  function day(data, key) {
    if (!data.days[key]) data.days[key] = {};
    return data.days[key];
  }
  function selectDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    selected = key;
    renderCheckins();
    window.dispatchEvent(new CustomEvent('naituan:life-date', { detail: { date: key } }));
  }
  function renderCheckins() {
    var data = state(), record = data.days[selected] || {}, today = selected === dateKey();
    var current = new Date();
    $('lifeDate').textContent = (current.getMonth() + 1) + '月' + current.getDate() + '日 · 周' + '日一二三四五六'[current.getDay()];
    $('lifeDate').dateTime = dateKey(current);
    var parts = selected.split('-');
    $('checkinTitle').textContent = today ? '今日打卡' : +parts[1] + '月' + +parts[2] + '日的记录';
    $('wordCheckin').dataset.done = record.words > 0 ? 'true' : 'false';
    $('wordStatus').textContent = record.words > 0 ? '已打卡 · ' + record.words + ' 词' : today ? '学一点，进步一点' : '这天还没有记录';
    $('wordCheckin').setAttribute('aria-label', '单词：' + $('wordStatus').textContent);
    var food = record.food || {};
    $('foodStatus').textContent = food.note ? (food.note.length > 11 ? food.note.slice(0, 11) + '…' : food.note) : food.photo ? '好好吃饭，已记录' : today ? '拍下今天吃了什么' : '这天还没有记录';
    $('foodThumbnail').hidden = !food.photo;
    $('foodCheckin').dataset.photo = food.photo ? 'true' : 'false';
    if (food.photo) $('foodThumbnail').src = food.photo;
    else $('foodThumbnail').removeAttribute('src');
    $('gemNum').textContent = data.gems.toLocaleString();
  }
  function render() { renderCheckins(); }
  function openDialog(id) { $(id).showModal(); }
  $('wordCheckin').addEventListener('click', function () {
    var record = state().days[selected] || {};
    if (record.words > 0) { report('这天已经学了 ' + record.words + ' 个单词，慢慢积累也很棒。'); return; }
    if (selected !== dateKey()) { report('这天没有单词打卡。回到今天，和奶团开始新的进步吧。'); return; }
    wordDate = selected;
    $('wordMessage').textContent = '';
    openDialog('wordDialog');
  });
  $('wordForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var count = Number($('wordCount').value);
    if (!Number.isInteger(count) || count < 1 || count > 9999) return;
    if (wordDate !== dateKey()) { $('wordMessage').textContent = '已经是新的一天了，关闭后重新打卡吧。'; return; }
    if (update(function (next) {
      var record = day(next, wordDate);
      record.words = count;
      if (!record.wordRewarded) { next.gems++; record.wordRewarded = true; }
    }, '单词打卡完成，成长宝石 +1。奶团为你开心！')) {
      $('wordDialog').close();
      NT.setPose('happy', 2600);
    } else $('wordMessage').textContent = '还没有保存成功，可以直接重新提交。';
  });
  $('foodCheckin').addEventListener('click', function () {
    var record = state().days[selected] || {};
    foodDate = selected; foodPhoto = record.food && record.food.photo || '';
    $('foodNote').value = record.food && record.food.note || '';
    $('foodFile').value = ''; $('foodMessage').textContent = '';
    $('foodTitle').textContent = selected === dateKey() ? '好好吃饭的一天' : selected.replace(/-/g, '.') + ' 的饮食';
    paintFoodPreview();
    openDialog('foodDialog');
  });
  function paintFoodPreview() {
    $('foodPreview').hidden = !foodPhoto;
    if (foodPhoto) $('foodPreview').src = foodPhoto;
    else $('foodPreview').removeAttribute('src');
  }
  $('foodFile').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { $('foodMessage').textContent = '请选择一张图片。'; return; }
    photoPending = true; $('foodSubmit').disabled = true;
    $('foodMessage').textContent = '正在准备照片…';
    var url = URL.createObjectURL(file), img = new Image();
    function finish() { URL.revokeObjectURL(url); photoPending = false; $('foodSubmit').disabled = false; }
    img.onload = function () {
      try {
        var ratio = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * ratio); canvas.height = Math.round(img.naturalHeight * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        foodPhoto = canvas.toDataURL('image/jpeg', .8);
        paintFoodPreview(); $('foodMessage').textContent = '照片准备好了。';
      } catch (error) { $('foodMessage').textContent = '这张照片暂时读不了，请换一张或先写下饮食记录。'; }
      finish();
    };
    img.onerror = function () { finish(); $('foodMessage').textContent = '这张照片暂时读不了，请换一张图片。'; };
    img.src = url;
  });
  $('foodForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (photoPending) return;
    var note = $('foodNote').value.trim();
    if (!note && !foodPhoto) { $('foodMessage').textContent = '选一张照片，或写下今天吃了什么。'; $('foodNote').focus(); return; }
    if (update(function (next) { day(next, foodDate).food = { note: note, photo: foodPhoto }; }, '饮食记录已经收好啦。')) $('foodDialog').close();
    else $('foodMessage').textContent = '没有保存成功，可以缩小照片后重试，或先保存文字。';
  });
  $('foodDialog').addEventListener('cancel', function (event) { if (photoPending) event.preventDefault(); });
  window.NaituanLife = { read: read, update: update, dateKey: dateKey, selectedDate: function () { return selected; }, selectDate: selectDate, report: report, render: render };
  render();
})();
