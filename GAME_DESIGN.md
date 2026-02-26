# 尸潮余温 - 设计与实现说明

## 1) 游戏核心设计（可落地）
- 一句话卖点（Hook）：每一次选择都不只改一个数值，而是改写我在这座死城里还能和谁一起活到明天。
- 核心循环：事件出现 -> 选择 -> 状态变化 -> 事件池重算（权重/冷却/互斥/连锁）-> 阶段推进 -> 触发关键节点或结局。

### 可管理状态变量（10个）
1. `health` 健康（0-100）：受伤、疲劳与饥饿会持续侵蚀。
2. `infection` 感染度（0-100）：非必死，但高感染会压低生存效率并触发特殊结局。
3. `hunger` 饥饿（0-100）：高饥饿会持续扣健康并放大压力。
4. `supplies` 物资（0-100）：影响长期维持能力与交易能力。
5. `ammo` 弹药（0-100）：影响战斗成本与可选策略。
6. `noise` 噪音（0-100）：越高越容易触发高风险战斗事件。
7. `humanity` 人性（0-100）：道德底线，影响同伴关系与结局性质。
8. `trust` 同伴信任（0-100）：影响合作效率、领导权与关键节点走向。
9. `stress` 心理压力（0-100）：高压会侵蚀判断与人性。
10. `shelter` 庇护所稳固（0-100）：影响消耗速度、夜间风险和重建能力。

### 随机事件系统
- 权重：每个事件定义 `weight`，并根据当前状态动态乘算（如高噪音提高战斗类权重）。
- 触发条件：`condition` 支持 `day/stage/stats/flags/all/any` 组合。
- 冷却：`cooldown` + `recentEvents(最近5条)` 双重去重。
- 互斥：通过 `flagsNot`/`once`/`doneOnceEvents` 控制。
- 连锁：选项 `effects.queue` 支持强制后续事件。
- 反重复：同事件 `seenCounts` 会触发权重衰减（novelty factor），降低刷屏概率。

### 真实感约束
- 感染非立即死亡：会随伤口与时间缓慢累积，可用药物压制但消耗物资。
- 受伤有后效：`woundOpen` 会持续掉健康并升感染，必须用治疗事件收敛。
- 噪音有账单：高噪音提高遭遇尸群概率并增加压力。
- 人际关系会反噬：低信任会引发领导挑战/内耗，高信任可解锁共同体结局。
- 生存消耗为常态：每回合被动增长饥饿与压力、扣减物资。

## 2) 剧情结构与分支规划
### 五阶段结构
1. 开局期（Day 1-3）：建立基本生存节奏，修补庇护所。
2. 资源期（Day 4-8）：探索、交易、药品与弹药平衡。
3. 冲突期（Day 9-14）：人类冲突与团队治理开始主导风险。
4. 崩溃/重建期（Day 15-21）：资源与秩序临界，必须做治理决策。
5. 终局期（Day 22+）：撤离、坚守、牺牲或失控的多结局收束。

### 事件规划
- 随机事件：32个（探索/战斗/交易/道德困境/同伴互动/庇护所管理/成人向氛围）。
- 关键节点：10个（一次性，显著改写后续事件池/旗标）。
- 结局：10个（失控、饥饿消亡、精神坍塌、带毒流亡、冷血统治、独行、撤离、牺牲、共同体、灰色生还）。

### 结局触发（状态阈值 + 关键旗标）
- `end_overrun`: `health<=0` 或 `infection>=100`。
- `end_starved`: `supplies<=4` 且 `hunger>=88` 且 `day>=12`。
- `end_breakdown`: `stress>=95` 且 `humanity<=18`。
- `end_carrier_exile`: `day>=20` + `infection>=78` + `health>=20`。
- `end_warlord`: `day>=24` + `joinedMilitia` + `bloodOnHands` + `humanity<=25` + `trust>=58`。
- `end_lone_walker`: `day>=24` + `trust<=30` + 非社区/非牺牲路线。
- `end_evac`: `day>=22` + `knowsEvacPoint` + `bridgeOpen` + 健康与感染达标。
- `end_martyr`: `sacrificeMade` + `day>=21`。
- `end_community`: `day>=24` + `shelter>=70` + `trust>=62` + `humanity>=48` + `ledCommunity`。
- `end_gray_survival`: `day>=26` 兜底。

### 因果链示例（3层）
- 起点：`k_militia_offer` 选择“加入民兵”。
- 第一层：`ammo+14, humanity-8, joinedMilitia=true`。
- 第二层：解锁 `r_checkpoint_raid`（高收益高代价），并提高“冷血路线”概率。
- 第三层：若后续在 `k_traitor_reveal` 选择处决 + `bloodOnHands=true`，将满足 `end_warlord` 的关键旗标；若改走公开审问并提升人性，则更可能转入 `end_community` 或 `end_evac`。

## 3) 事件数据结构规范
```json
{
  "id": "event_unique_id",
  "isKey": false,
  "once": false,
  "weight": 6,
  "cooldown": 4,
  "category": "探索",
  "condition": {
    "dayGte": 1,
    "stageGte": 2,
    "stats": { "noise": { "gte": 50 } },
    "flagsAll": ["clinicKnown"],
    "flagsNot": ["bridgeOpen"],
    "all": [],
    "any": []
  },
  "title": "事件标题",
  "body": "第一人称正文",
  "choices": [
    {
      "label": "选项文案",
      "condition": { "stats": { "ammo": { "gte": 20 } } },
      "effects": {
        "stats": { "health": -5, "supplies": 8 },
        "flagsSet": { "radioFixed": true },
        "flagsClear": ["woundOpen"],
        "queue": ["next_event_id"]
      },
      "result": "选择后文本",
      "outcomes": [
        {
          "weight": 3,
          "text": "概率分支文本",
          "effects": { "stats": { "infection": 6 } }
        }
      ]
    }
  ]
}
```

### 5个完整事件样例
- 样例1：`k_night_confession`（成人向氛围 + 边界感）
  - 事件：深夜值守后与玛拉短暂靠近。
  - 选项A：保持边界，`stress-6 trust+5 humanity+3`。
  - 选项B：接受靠近但约定不影响判断，`stress-12 trust+8 intimateBond=true`。
- 样例2：`r_store_sweep`（探索 + 概率分支）
  - 事件：便利店搜刮。
  - 选项A：慢搜，低风险低收益。
  - 选项B：快搜，高收益并概率触发“伤口污染”。
- 样例3：`r_prisoner_choice`（道德困境）
  - 事件：抓到抢匪。
  - 选项A：劳动赎罪，`humanity/trust` 上升。
  - 选项B：公开惩罚，短期稳秩序但人性下降。
- 样例4：`k_bridge_blast`（关键节点）
  - 事件：桥头是否爆破开路。
  - 选项A：开路，`bridgeOpen=true` 但噪音暴增。
  - 选项B：后撤，撤离线关闭并掉信任。
- 样例5：`r_companion_wound`（同伴互动）
  - 事件：同伴中弹。
  - 选项A：立即手术，高消耗换高信任。
  - 选项B：先撤离，短期安全但关系受损。

## 4) H5 技术实现方案（无框架）
### 当前落地文件结构
```txt
index.html
style.css
engine.js
data/events.js
GAME_DESIGN.md
```

### 核心引擎
- `store`：`state.stats + flags + queue + seenCounts + cooldown + log`。
- 抽取事件：
  1. 条件过滤 `matchCondition`
  2. 冷却与 recent 去重
  3. 动态权重 + 新鲜度衰减
  4. 加权随机抽取
- 应用结果：`applyEffects` 统一处理 `stats/flags/queue`，并在每回合执行被动消耗 `applyPassiveDecay`。
- 存档：`localStorage`（`save/load`）。
- 可配置：事件/结局全部在数据层定义；新增事件无需改引擎逻辑。

### UI 组成
- 主叙事框：标题、正文、结果文本。
- 选项按钮区：按条件启用/禁用。
- 状态面板：10项状态条。
- 日志面板：可折叠，记录关键决策与后果。
