# 51.LA 统计脚本（自托管）

`js-sdk-pro-1.58.3.min.js` 是 51.LA 官方 SDK v1.58.3 的原样副本，2026-10-03 下载并检查。
SHA-256：`d1f1bfe698f2ffb7b3e7a885a301d58f9554d45df0a31c3e8b53c84b33c80d27`（34330 字节）。
更新时先重新检查，再替换文件并更新这里的值：

```
sha256sum assets/vendor/51la/js-sdk-pro-1.58.3.min.js
```

## 为什么不直接引用 sdk.51.la

51.LA 曾出现统计脚本被 DNS 劫持、站点被跳转到赌博网站的情况。脚本在页面里权限和游戏代码一样，
能读到浏览器里的日记、照片和存档。放在仓库里，玩家运行的永远是检查过的这一份。

## 检查结论（v1.58.3）

- 只向 `https://collect-v6.51.la/v6/collect` 发送数据：网页标题、网址、来源页、屏幕尺寸、语言、网络类型、随机访客 ID 和会话时长。
- 只读写自己的 cookie（`__51vcke__`、`__51vuft__`、`__51uvsct__`）和 `__vtins__` 记录，不读取 `naituan-house-v1` 等游戏数据。
- 没有页面跳转、弹窗或执行远程代码的逻辑。`eval` 只用于解析它自己写入的 `__vtins__` 记录。
- `autoTrack: true` 会从 sdk.51.la 额外加载 `js-sdk-event.min.js`（事件分析和自动点击记录），因此关闭。
  需要事件分析时，同样先下载、检查、放进本目录，再用 `prefix` 指向这里。

## 页面标记

`stats.js` 给每个画面写入 `#/名称`，51.LA 的 `hashMode` 会把它们记成不同页面，后台「受访页面」里可看访问量和停留时长。

| 地址 | 画面 |
| --- | --- |
| `#/home` | 窝 |
| `#/life` | 生活 |
| `#/games` | 小游戏列表 |
| `#/profile` | 我的 |
| `#/shop` | 小铺 |
| `#/games/hide` | 躲猫猫（选关页） |
| `#/games/hide/L1` … `#/games/hide/L5` | 躲猫猫第 1–5 关 |
| `#/games/hide/endless` | 躲猫猫无尽模式 |
| `#/games/stack` | 堆纸箱 |
| `#/games/cake` | 蛋糕店（排好队） |
| `#/cake-book` | 蛋糕图鉴 |
