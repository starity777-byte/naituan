# 奶团生活页接口（2026-10-03）

本次主前端施工只修改 index.html、house.css、house.js、life.js，以及 game.js / queue.js 的小范围接口。
最新分工：日历、自习室、待办专项独立创建或修改 planner-state.js、planner.js、planner.css；主前端不会写这些文件。
当前 index.html 引入顺序为 game.js → queue.js → life.js → photo-store.js → journal-state.js → journal.js → planner-state.js → study-ambience.js → planner.js → backup.js → house.js。
life.js 只拥有单词与饮食卡片、公共存档 API；待办的渲染与事件也由专项接管。
专项可以把独立状态放在 life.planner；read/update 完整保留该对象。
如果暴露 NaituanPlanner.totalFocusMinutes()，我的页面会用它显示累计专注分钟。

## 生活状态

生活记录元数据放在 NT.S().life；照片 Blob 放在本机 IndexedDB。完整备份文件同时包含两者及整个小屋状态，旧 NT1 存档码仍可导入。
请通过 window.NaituanLife 操作，不直接写 localStorage。

## 日常记录与总览

- `life.days[date].entries` 保存 `{id,text,photoId,createdAt,updatedAt,reply}`。文字、照片、图文均各计一条，允许一天多条。
- `journal-state.js` 统一读取新记录及旧 `day.food`，只统计日常记录；单词、任务、专注仍是当天的独立事实。旧饮食照片在成功写入 IndexedDB 后才移除内联数据。
- `journal.js` 负责日期时间线、日期相册、编辑与可撤销删除、我的记录总览。`NaituanJournal.dayStats(date)` 给日历提供记录圆点。
- `photo-store.js` 的 `NaituanPhotos` 负责本机照片压缩、读写、显示和导出。照片不会上传。
- `photo-crop.js` 的 `NaituanCrop.pick(file, {maxEdge, quality})` 在选好照片后弹出裁剪框（默认方形，可换其它形状或原图），返回 JPEG Blob，取消返回 null；日常记录与饮食打卡都经过它。需要在 `life.js` 之前引入。
- 我的为独立 `profileView` 页面；保留小屋声音、游戏和专注统计，在底部导航及爪爪菜单中均可进入。

## 完整备份

`backup.js` 导出 `{format:'naituan-house',version:2,createdAt,data,photos}` JSON 文件。`data` 为整个 `NT.S()` 快照，包含 `cq` 小游戏、房间装扮、声音设置及 `life`；`photos` 为引用到的照片及其 dataURL。缺少照片时会报告错误，不生成不完整备份。

恢复先校验文件并将照片写入新 ID，再通过 `NT.restoreState(data)` 提交存档；保存失败恢复原状态并清理临时照片。成功后清理旧照片，触发 `naituan:life-change` 和 `naituan:save-import` 刷新页面。用户选择文件后需点击确认覆盖；旧 NT1 码通过两次点击确认。

- read()：返回生活状态的深拷贝。
- update(mutator, message?)：复制当前状态，把副本传给 mutator，同步保存。成功返回 true；失败恢复原状态并提示，返回 false。
- dateKey(date?)：本地日期，YYYY-MM-DD。
- selectedDate()：当前选中的日期字符串。
- selectDate(key)：切换日期，刷新其他生活卡片，触发 naituan:life-date（detail 为 { date: key }）。
- report(message)：在生活页的 role=status 中提示，也触发 naituan:notice。
- render()：从存档刷新打卡卡片。

默认数据形状：

    {
      version: 1,
      days: {
        "2026-09-29": {
          words: 50,
          wordRewarded: true,
          food: { note: "番茄面", photo: "data:image/jpeg;base64,..." },
          focusMinutes: 25,
          focusSessions: 1
        }
      },
      todos: [{ id: "…", text: "背 50 个单词", done: false }],
      gems: 0,
      timer: { duration: 1500, remaining: 1500, endAt: 0 }
    }

days 的日期与字段按需创建，不要假设某天一定存在。可以增加专项字段；主前端不会丢弃未知字段。
wordRewarded 表示当天已领过单词打卡奖励。新用户不赠送示例货币或虚构完成记录。
timer.endAt 是运行中的绝对毫秒时间戳，0 表示未开始或暂停。

update 成功会派发 window 上的 naituan:life-change。监听此事件刷新即可，不要在无变化时再调用 update。
入口切换会派发 window 上的 naituan:page，detail 为 { page: "home" | "life" | "games" }。
日历专项位于生活页，不需要自己接管整个 app 的导航或弹窗。

## 已存在的 HTML 节点

日历：

- calendarMonth（月份摘要）、calendarToggle（展开按钮）、calendarWeek（七天按钮容器）
- calendarExpanded（展开区域）、expandedMonth（月份文字）、calendarPrev / calendarNext
- calendarGrid（月历日期容器）、calendarToday（回今天按钮）
- lifeDate（页头当日日期）

自习室：

- focusTitle、focusTime（output）、focusNote（提示文字）
- focusToggle（主按钮）、focusReset（重置按钮，初始 hidden）

专项可在上述区域内添加更丰富的页面和控件，但不要同时改 house.js / life.js / index.html。
按钮需 type=button；弹窗可优先使用原生 dialog。CSS 应限定日历和自习室区域。
独立模块负责跨午夜、计时恢复、日期选择等自身交互。

## 预览

主前端临时预览服务：http://127.0.0.1:8771/ 。
8765 是之前已有的服务，不是本次新服务，请勿清空其用户进度。
http://localhost:8771/ 可用于另一个来源的首次加载与主流程验证。
最终由主前端检查整合后的手机布局和入口连通。
