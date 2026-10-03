(function () {
  'use strict';
  var database, urls = new Map();
  function open() {
    if (!database) database = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('这个浏览器暂不支持本机照片保存，请先记录文字。')); return; }
      var request = indexedDB.open('naituan-life-photos-v1', 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('photos'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { database = null; reject(new Error('照片存储暂时打不开，请稍后重试。')); };
    });
    return database;
  }
  async function run(mode, operation) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('photos', mode), request = operation(tx.objectStore('photos')), value;
      request.onsuccess = function () { value = request.result; };
      tx.oncomplete = function () { resolve(value); };
      tx.onerror = tx.onabort = function () { reject(new Error('照片没有保存成功，可以先保存文字，或导出备份后再试。')); };
    });
  }
  function uid() { return 'photo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  async function put(blob, id) { id = id || uid(); await run('readwrite', function (store) { return store.put(blob, id); }); return id; }
  function get(id) { return run('readonly', function (store) { return store.get(id); }); }
  async function remove(id) {
    if (!id) return;
    await run('readwrite', function (store) { return store.delete(id); });
    if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
  }
  async function url(id) {
    if (urls.has(id)) return urls.get(id);
    var blob = await get(id);
    if (!blob) throw new Error('这张照片没有找到，请用包含照片的完整备份恢复。');
    if (!urls.has(id)) urls.set(id, URL.createObjectURL(blob));
    return urls.get(id);
  }
  function compress(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type.startsWith('image/')) { reject(new Error('请选择一张图片。')); return; }
      var image = new Image(), source = URL.createObjectURL(file);
      image.onload = function () {
        try {
          var scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          var context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) { URL.revokeObjectURL(source); if (blob) resolve(blob); else reject(new Error('这张照片暂时读不了，请换一张图片。')); }, 'image/jpeg', .82);
        } catch (error) { URL.revokeObjectURL(source); reject(new Error('这张照片暂时读不了，请换一张图片。')); }
      };
      image.onerror = function () { URL.revokeObjectURL(source); reject(new Error('这张照片暂时读不了，请换一张图片。')); };
      image.src = source;
    });
  }
  function toDataURL(blob) {
    return new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(blob); });
  }
  function fromDataURL(value) {
    var match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(value || '');
    if (!match) throw new Error('备份中的照片格式不正确。');
    var binary = atob(match[2]), bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] });
  }
  async function exportPhotos(ids) {
    var photos = [];
    for (var id of ids) { var blob = await get(id); if (!blob) throw new Error('有照片没有找到，尚未导出完整备份。请先恢复照片后再试。'); photos.push({ id: id, dataURL: await toDataURL(blob) }); }
    return photos;
  }
  window.NaituanPhotos = { put: put, get: get, remove: remove, url: url, compress: compress, fromDataURL: fromDataURL, exportPhotos: exportPhotos };
})();
