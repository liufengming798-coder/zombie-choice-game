window.GAME_DATA = {
  meta: {
    title: "尸潮余温",
    hook: "每一次选择都不只改一个数值，而是改写我在这座死城里还能和谁一起活到明天。",
    stages: {
      1: "开局期",
      2: "资源期",
      3: "冲突期",
      4: "崩溃/重建期",
      5: "终局期"
    }
  },
  statDefs: [
    { key: "health", label: "健康", min: 0, max: 100 },
    { key: "infection", label: "感染度", min: 0, max: 100, inverse: true },
    { key: "hunger", label: "饥饿", min: 0, max: 100, inverse: true },
    { key: "supplies", label: "物资", min: 0, max: 100 },
    { key: "ammo", label: "弹药", min: 0, max: 100 },
    { key: "noise", label: "噪音", min: 0, max: 100, inverse: true },
    { key: "humanity", label: "人性", min: 0, max: 100 },
    { key: "trust", label: "同伴信任", min: 0, max: 100 },
    { key: "stress", label: "心理压力", min: 0, max: 100, inverse: true },
    { key: "shelter", label: "庇护所稳固", min: 0, max: 100 }
  ],
  initialState: {
    day: 1,
    stats: {
      health: 78,
      infection: 8,
      hunger: 20,
      supplies: 55,
      ammo: 42,
      noise: 18,
      humanity: 58,
      trust: 46,
      stress: 30,
      shelter: 34
    },
    flags: {
      hasCompanion: false,
      knowsEvacPoint: false,
      clinicKnown: false,
      radioFixed: false,
      bridgeOpen: false,
      joinedMilitia: false,
      betrayedGroup: false,
      bloodOnHands: false,
      woundOpen: false,
      intimateBond: false,
      finalVoteDone: false,
      ledCommunity: false,
      sacrificeMade: false
    }
  },
  endings: [
    {
      id: "end_overrun",
      priority: 100,
      title: "结局：尸潮淹没",
      text: "噪音和疲惫把我拖进了最糟的节奏。楼道里最后一盏灯熄灭时，我听见的不是枪声，而是门栓断裂的声音。",
      condition: { any: [{ stats: { health: { lte: 0 } } }, { stats: { infection: { gte: 100 } } }] }
    },
    {
      id: "end_starved",
      priority: 95,
      title: "结局：慢性消失",
      text: "物资耗尽后，我的选择开始失去意义。没有一击致命，只有连续很多天的体力和判断力衰减。",
      condition: { all: [{ stats: { supplies: { lte: 1 } } }, { stats: { hunger: { gte: 96 } } }, { dayGte: 20 }] }
    },
    {
      id: "end_breakdown",
      priority: 90,
      title: "结局：精神坍塌",
      text: "我还会呼吸，但已经无法区分噪声和现实。这个城市没有杀死我，只是把我磨成了空壳。",
      condition: { all: [{ stats: { stress: { gte: 95 } } }, { stats: { humanity: { lte: 18 } } }] }
    },
    {
      id: "end_carrier_exile",
      priority: 80,
      title: "结局：带毒流亡",
      text: "感染没有立刻要我的命，但每一步都像踩在玻璃上。为了不拖累别人，我主动离开了据点。",
      condition: { all: [{ dayGte: 20 }, { stats: { infection: { gte: 78 } } }, { stats: { health: { gte: 20 } } }] }
    },
    {
      id: "end_warlord",
      priority: 70,
      title: "结局：冷血统治",
      text: "我活了下来，也成了别人夜里不敢关灯的理由。末日里有秩序，但那是恐惧做的秩序。",
      condition: { all: [{ dayGte: 24 }, { flagsAll: ["joinedMilitia"] }, { flagsAll: ["bloodOnHands"] }, { stats: { humanity: { lte: 25 } } }, { stats: { trust: { gte: 58 } } }] }
    },
    {
      id: "end_lone_walker",
      priority: 60,
      title: "结局：独行者",
      text: "我没有死，也没能真正留下谁。背包越来越轻，脚步越来越机械，城市在我身后一层层褪色。",
      condition: { all: [{ dayGte: 24 }, { stats: { trust: { lte: 30 } } }, { flagsNot: ["ledCommunity"] }, { flagsNot: ["sacrificeMade"] }] }
    },
    {
      id: "end_evac",
      priority: 55,
      title: "结局：撤离航线",
      text: "我按无线电给的时刻到达桥头。撤离艇并不体面，甲板拥挤、空气刺鼻，但它真的开走了。",
      condition: { all: [{ dayGte: 22 }, { flagsAll: ["knowsEvacPoint", "bridgeOpen"] }, { stats: { health: { gte: 30 } } }, { stats: { infection: { lte: 70 } } }] }
    },
    {
      id: "end_martyr",
      priority: 50,
      title: "结局：牺牲式胜利",
      text: "我把最后的弹链和电池都留给了身后的人。防火门落下时，我知道自己换到的是别人的明天。",
      condition: { all: [{ flagsAll: ["sacrificeMade"] }, { dayGte: 21 }] }
    },
    {
      id: "end_community",
      priority: 45,
      title: "结局：小型共同体",
      text: "我们修好了发电机，分配了守夜和口粮。没有英雄，只有一群还能互相提醒别睡着的人。",
      condition: { all: [{ dayGte: 24 }, { stats: { shelter: { gte: 66 } } }, { stats: { trust: { gte: 58 } } }, { stats: { humanity: { gte: 45 } } }, { flagsAll: ["ledCommunity"] }] }
    },
    {
      id: "end_gray_survival",
      priority: 1,
      title: "结局：灰色生还",
      text: "我活过了这一轮高峰。没有凯旋，没有庆祝，只有下一张巡逻表和下一顿怎么省出来。",
      condition: { dayGte: 30 }
    }
  ],
  events: [
    {
      id: "k_power_failure",
      isKey: true,
      once: true,
      weight: 8,
      cooldown: 99,
      category: "庇护所管理",
      condition: { stageGte: 1, stageLte: 2 },
      title: "发电机熄火",
      body: "夜里两点，发电机突然停了。我听见屋内呼吸都变快了，外面的走廊开始有拖行声。",
      choices: [
        {
          label: "拆旧设备抢修",
          effects: { stats: { supplies: -10, shelter: 12, stress: -4, noise: 6 }, flagsSet: { radioFixed: true } },
          result: "我把手电含在嘴里，硬是在天亮前把电拉起来。"
        },
        {
          label: "放弃供电，转入静默",
          effects: { stats: { shelter: -8, noise: -12, stress: 6 }, flagsSet: { radioFixed: false } },
          result: "我们关掉了几乎所有灯，只剩门口一盏红色指示灯。"
        }
      ]
    },
    {
      id: "k_clinic_mark",
      isKey: true,
      once: true,
      weight: 7,
      cooldown: 99,
      category: "探索",
      condition: { stageGte: 2, stageLte: 3 },
      title: "诊所地图",
      body: "我在公交站牌背面发现手写地图，圈出了一家还没被洗劫干净的私人诊所。",
      choices: [
        {
          label: "立刻组织小队去诊所",
          effects: { stats: { supplies: 10, infection: -8, trust: 8, noise: 10 }, flagsSet: { clinicKnown: true } },
          result: "我们拿回了消炎药和缝合包，但回程闹出的动静不小。"
        },
        {
          label: "先记下地点，等夜深再去",
          effects: { stats: { stress: -2, trust: 2 }, flagsSet: { clinicKnown: true } },
          result: "我把纸片塞进内袋，决定先稳住白天的秩序。"
        }
      ]
    },
    {
      id: "k_companion_mara",
      isKey: true,
      once: true,
      weight: 8,
      cooldown: 99,
      category: "同伴互动",
      condition: { stageGte: 2, stageLte: 3, flagsNot: ["hasCompanion"] },
      title: "狙击手玛拉",
      body: "楼顶的红点一闪，我本能蹲下。几秒后，一个女人从广告牌后走出来，说她不想浪费子弹。",
      choices: [
        {
          label: "邀请她加入据点",
          effects: { stats: { trust: 10, ammo: 8, stress: -4 }, flagsSet: { hasCompanion: true } },
          result: "她叫玛拉，语气冷，但在守夜表上签了名字。"
        },
        {
          label: "交换情报后分开",
          effects: { stats: { supplies: 4, trust: 2 }, flagsSet: { hasCompanion: false } },
          result: "我们互报了安全路线，然后朝不同街口走去。"
        }
      ]
    },
    {
      id: "k_militia_offer",
      isKey: true,
      once: true,
      weight: 7,
      cooldown: 99,
      category: "冲突",
      condition: { stageGte: 3, stageLte: 4, stats: { trust: { gte: 35 } } },
      title: "民兵招募",
      body: "仓库区的民兵头目给我两条路: 挂上他们的臂章，或者永远别进他们的补给区。",
      choices: [
        {
          label: "加入民兵",
          effects: { stats: { ammo: 14, trust: 6, humanity: -8 }, flagsSet: { joinedMilitia: true } },
          result: "我戴上臂章，换来更安全的巡逻线和更重的心理负担。"
        },
        {
          label: "拒绝并保持中立",
          effects: { stats: { trust: -6, stress: 6, humanity: 4 }, flagsSet: { joinedMilitia: false } },
          result: "他们没有当场翻脸，但我被划进了灰名单。"
        }
      ]
    },
    {
      id: "k_traitor_reveal",
      isKey: true,
      once: true,
      weight: 6,
      cooldown: 99,
      category: "道德困境",
      condition: { stageGte: 3, stageLte: 4, stats: { trust: { gte: 40 } } },
      title: "内鬼暴露",
      body: "夜巡名单泄露后，外墙被精确打穿。所有人的目光都落在新来的仓管身上。",
      choices: [
        {
          label: "按证据审问，留活口",
          effects: { stats: { trust: 8, humanity: 6, stress: 4 }, flagsSet: { betrayedGroup: false } },
          result: "我让两人见证审问，他交代了交易对象和联络时间。"
        },
        {
          label: "当场处决以立威",
          effects: { stats: { trust: 10, humanity: -14, stress: -2 }, flagsSet: { bloodOnHands: true, betrayedGroup: false } },
          result: "枪响后没人再说话，秩序回来了，空气却更冷。"
        }
      ]
    },
    {
      id: "k_radio_tower",
      isKey: true,
      once: true,
      weight: 7,
      cooldown: 99,
      category: "探索",
      condition: { stageGte: 4, stageLte: 5, flagsAll: ["radioFixed"] },
      title: "广播塔窗口",
      body: "修复后的短波收音机终于稳定下来。一个女声重复坐标和撤离窗口，只播三遍。",
      choices: [
        {
          label: "记录坐标并公开给据点",
          effects: { stats: { trust: 10, humanity: 6, stress: -3 }, flagsSet: { knowsEvacPoint: true } },
          result: "我把坐标写在白板上，人群里第一次出现了低声欢呼。"
        },
        {
          label: "先只告诉核心小队",
          effects: { stats: { trust: -8, stress: -5, supplies: 6 }, flagsSet: { knowsEvacPoint: true } },
          result: "信息变成了筹码，秩序暂时稳住，但有人看我的眼神变了。"
        }
      ]
    },
    {
      id: "k_bridge_blast",
      isKey: true,
      once: true,
      weight: 8,
      cooldown: 99,
      category: "战斗",
      condition: { stageGte: 5, flagsAll: ["knowsEvacPoint"] },
      title: "桥头爆破",
      body: "撤离桥下堆满堵塞车辆，尸群在后方压近。要么炸出一条路，要么永远困在这岸。",
      choices: [
        {
          label: "用炸药开路",
          effects: { stats: { ammo: -12, noise: 28, health: -8, stress: 8 }, flagsSet: { bridgeOpen: true } },
          result: "桥面被炸出通道，冲击波也把附近街区全部惊醒。"
        },
        {
          label: "放弃桥头，转回城区",
          effects: { stats: { trust: -10, stress: 12, humanity: -4 }, flagsSet: { bridgeOpen: false } },
          result: "我下令后撤，很多人没有回头看我。"
        }
      ]
    },
    {
      id: "k_refugee_vote",
      isKey: true,
      once: true,
      weight: 8,
      cooldown: 99,
      category: "庇护所管理",
      condition: { stageGte: 4, stageLte: 5, flagsNot: ["finalVoteDone"] },
      title: "配给投票",
      body: "新来的幸存者让口粮只够撑五天。大厅里争论升级，最后所有人都看向我。",
      choices: [
        {
          label: "平均配给，延长禁足时间",
          effects: { stats: { trust: 8, humanity: 8, hunger: 10, shelter: 6 }, flagsSet: { finalVoteDone: true, ledCommunity: true } },
          result: "没人满意，但大多数人接受了规则。"
        },
        {
          label: "优先战斗人员",
          effects: { stats: { trust: -8, ammo: 8, humanity: -10, stress: -4 }, flagsSet: { finalVoteDone: true } },
          result: "战力保住了，宿舍区却多了几声压低的咒骂。"
        }
      ]
    },
    {
      id: "k_final_hall",
      isKey: true,
      once: true,
      weight: 9,
      cooldown: 99,
      category: "终局",
      condition: { dayGte: 20, stageGte: 5 },
      title: "最后一道防火门",
      body: "尸群冲进一层后，唯一还能守的只剩防火门。我得决定谁留下拖住时间。",
      choices: [
        {
          label: "我留下断后",
          effects: { stats: { health: -40, humanity: 10, trust: 12 }, flagsSet: { sacrificeMade: true } },
          result: "我把门链绕在前臂上，听见身后脚步越来越远。"
        },
        {
          label: "带核心战力撤离",
          effects: { stats: { trust: -12, health: -12, supplies: 8 }, flagsSet: { sacrificeMade: false } },
          result: "我们冲出侧门，防火门后很快没了呼喊。"
        }
      ]
    },
    {
      id: "k_night_confession",
      isKey: true,
      once: true,
      weight: 6,
      cooldown: 99,
      category: "成人向氛围",
      condition: { stageGte: 3, stageLte: 4, flagsAll: ["hasCompanion"], stats: { stress: { gte: 40 } } },
      title: "夜班后的坦白",
      body: "玛拉在楼梯平台递给我半杯酒精兑水。她说这不是放松，只是让手不再抖。灯影把她的轮廓压得很近。",
      choices: [
        {
          label: "保持边界，只谈守夜安排",
          effects: { stats: { stress: -6, trust: 5, humanity: 3 }, flagsSet: { intimateBond: false } },
          result: "我们把话题拉回巡逻时间表，彼此都松了口气。"
        },
        {
          label: "接受靠近，但约定不影响判断",
          effects: { stats: { stress: -12, trust: 8, humanity: 2 }, flagsSet: { intimateBond: true } },
          result: "那一刻我们只是互相借了点体温，第二天依旧照常巡逻。"
        }
      ]
    },

    {
      id: "r_store_sweep",
      weight: 8,
      cooldown: 3,
      category: "探索",
      condition: { stageLte: 3 },
      title: "便利店回收",
      body: "我推开卷帘门，脚下是碎玻璃。收银台后面还有一排没开封的罐头。",
      choices: [
        { label: "慢慢搜，控制动静", effects: { stats: { supplies: 10, noise: 4, stress: -2 } }, result: "收获不多，但我没把街口惊醒。" },
        { label: "快速扫货", effects: { stats: { supplies: 16, noise: 12, health: -4 } }, result: "我背包更重了，手臂也被铁皮划开。", outcomes: [
          { weight: 3, text: "伤口不深。", effects: { stats: { infection: 2 } } },
          { weight: 1, text: "污血沾进伤口，我心里一沉。", effects: { stats: { infection: 8 }, flagsSet: { woundOpen: true } } }
        ] }
      ]
    },
    {
      id: "r_apartment_roof",
      weight: 6,
      cooldown: 4,
      category: "探索",
      condition: { stageGte: 1, stageLte: 4 },
      title: "屋顶观察点",
      body: "我爬上居民楼屋顶，风很冷，但能看清三个街区的活动。",
      choices: [
        { label: "标记安全路线", effects: { stats: { stress: -5, noise: -3, supplies: -3 } }, result: "我画出一条绕开尸群密集区的线路。" },
        { label: "顺便拆太阳能板", effects: { stats: { shelter: 8, noise: 8, health: -2 } }, result: "我扛回两块板，肩膀被金属边蹭出血痕。" }
      ]
    },
    {
      id: "r_parking_lot",
      weight: 5,
      cooldown: 5,
      category: "探索",
      condition: { stageGte: 2 },
      title: "停车场引擎",
      body: "地下停车场里还有一台能启动的面包车，只是排气声像喇叭一样响。",
      choices: [
        { label: "开车转运物资", effects: { stats: { supplies: 12, noise: 18, stress: -4 } }, result: "转运效率暴涨，附近街区也开始躁动。" },
        { label: "拆电瓶和工具", effects: { stats: { shelter: 6, supplies: 4, noise: 4 } }, result: "我放弃了机动性，换回更稳妥的维修材料。" }
      ]
    },
    {
      id: "r_pharmacy_line",
      weight: 6,
      cooldown: 4,
      category: "探索",
      condition: { flagsAll: ["clinicKnown"] },
      title: "诊所二次搜刮",
      body: "诊所药柜后面有一道暗门，里面堆着还未过期的抗生素。",
      choices: [
        { label: "拿药并登记分配", effects: { stats: { infection: -10, trust: 6, supplies: 6 } }, result: "我把药品按伤情发下去，争吵少了很多。" },
        { label: "私藏一部分", effects: { stats: { infection: -12, trust: -8, stress: -2 }, flagsSet: { betrayedGroup: true } }, result: "我留了后手，也埋下了怀疑。" }
      ]
    },
    {
      id: "r_office_archive",
      weight: 4,
      cooldown: 4,
      category: "探索",
      condition: { stageGte: 3 },
      title: "政务楼档案室",
      body: "档案室里有城市地下管网图，灰尘厚得像一层皮。",
      choices: [
        { label: "带走地图", effects: { stats: { stress: -4, shelter: 4, supplies: -2 } }, result: "我掌握了几个可绕开的死角和通风井。" },
        { label: "顺手焚毁无用文件", effects: { stats: { noise: 10, humanity: -2 } }, result: "火光把窗外的影子都引了过来。" }
      ]
    },
    {
      id: "r_ration_cache",
      weight: 5,
      cooldown: 6,
      category: "探索",
      condition: { stageGte: 3, stats: { hunger: { gte: 58 } } },
      title: "军用口粮箱",
      body: "我在倒塌的警戒岗亭里翻到一只军用口粮箱，封条还在，只是附近血迹很新。",
      choices: [
        { label: "立刻搬走", effects: { stats: { supplies: 14, hunger: -10, noise: 8 } }, result: "我背回了整箱口粮，回程脚步也快了很多。" },
        { label: "拆一半带走，留下诱饵", effects: { stats: { supplies: 8, hunger: -6, noise: -4, stress: 3 } }, result: "我没贪全拿，尽量把风险留在原地。" }
      ]
    },

    {
      id: "r_stairwell_fight",
      weight: 8,
      cooldown: 3,
      category: "战斗",
      condition: { stageGte: 1 },
      title: "楼梯间遭遇",
      body: "我刚推开防火门，一具感染者就从楼梯拐角扑下来。",
      choices: [
        { label: "近身解决", effects: { stats: { ammo: -2, health: -6, stress: 5 } }, result: "我把它顶在墙上解决掉，手腕一阵酸麻。", outcomes: [
          { weight: 1, text: "指节破皮，可能沾了污血。", effects: { stats: { infection: 6 }, flagsSet: { woundOpen: true } } },
          { weight: 3, text: "只是擦伤。", effects: { stats: { infection: 1 } } }
        ] },
        { label: "开枪压制", effects: { stats: { ammo: -8, noise: 14, stress: -2 } }, result: "战斗结束很快，但枪声让走廊回音不断。" }
      ]
    },
    {
      id: "r_alley_horde",
      weight: 7,
      cooldown: 4,
      category: "战斗",
      condition: { stats: { noise: { gte: 50 } } },
      title: "巷口尸群",
      body: "前几天留下的噪声账单终于到了，整条巷子都在朝我合拢。",
      choices: [
        { label: "扔诱饵转移", effects: { stats: { supplies: -8, noise: -14, stress: 6 } }, result: "它们跟着诱饵偏离了主路。" },
        { label: "强行突围", effects: { stats: { health: -10, ammo: -10, stress: 10, infection: 6 } }, result: "我冲了出来，背后却留下更多血迹。" }
      ]
    },
    {
      id: "r_sniper_window",
      weight: 4,
      cooldown: 5,
      category: "战斗",
      condition: { stageGte: 3 },
      title: "窗后枪焰",
      body: "我穿过十字路口时，对面窗后闪过一次枪焰。",
      choices: [
        { label: "卧倒等待空档", effects: { stats: { stress: 4, supplies: -3 } }, result: "我趴在地上等了十五分钟，终于摸进掩体。" },
        { label: "压枪反击", effects: { stats: { ammo: -12, noise: 10, trust: 4 } }, result: "我打碎了窗框，对方很快撤离。" }
      ]
    },
    {
      id: "r_checkpoint_raid",
      weight: 5,
      cooldown: 6,
      category: "战斗",
      condition: { flagsAll: ["joinedMilitia"] },
      title: "路障清剿",
      body: "民兵要求我参加路障清剿，说那是换口粮的唯一办法。",
      choices: [
        { label: "执行命令", effects: { stats: { supplies: 10, ammo: -6, humanity: -8, trust: 4 }, flagsSet: { bloodOnHands: true } }, result: "战利品充足，我却一整夜没敢摘手套。" },
        { label: "暗中放走一批人", effects: { stats: { humanity: 8, trust: -6, stress: 6 } }, result: "我保住了几条命，也给自己添了新的风险。" }
      ]
    },
    {
      id: "r_quiet_kill",
      weight: 6,
      cooldown: 4,
      category: "战斗",
      condition: { stats: { ammo: { lte: 25 } } },
      title: "无声处置",
      body: "弹药见底后，我开始依赖更安静也更脏的方式。",
      choices: [
        { label: "钢丝绞杀", effects: { stats: { noise: -6, health: -4, stress: 8 } }, result: "它倒下前挣扎得很厉害，我手臂一直在发抖。" },
        { label: "躲开冲突", effects: { stats: { hunger: 6, stress: -2 } }, result: "我绕远了两公里，天黑前才回到据点。" }
      ]
    },

    {
      id: "r_black_market",
      weight: 6,
      cooldown: 4,
      category: "交易",
      condition: { stageGte: 2, stageLte: 4 },
      title: "地下交易点",
      body: "旧地铁口有人摆摊，价码每天都变。今天他们想要弹药换药品。",
      choices: [
        { label: "弹药换药", effects: { stats: { ammo: -12, infection: -8, supplies: 8 } }, result: "我背回了药箱，枪却轻了很多。" },
        { label: "强压价格", effects: { stats: { trust: -4, supplies: 4, noise: 6 } }, result: "我省下一点物资，也得罪了看场子的人。" }
      ]
    },
    {
      id: "r_fuel_deal",
      weight: 4,
      cooldown: 5,
      category: "交易",
      condition: { stageGte: 3 },
      title: "燃料互换",
      body: "一支车队愿意用柴油换罐头和滤水片。",
      choices: [
        { label: "达成交换", effects: { stats: { supplies: -8, shelter: 8, trust: 3 } }, result: "发电能撑更久，但口粮压力立刻上来。" },
        { label: "拒绝交易", effects: { stats: { supplies: 0, stress: 4 } }, result: "我保持了库存，却错过了稳定供电的机会。" }
      ]
    },
    {
      id: "r_doctor_fee",
      weight: 5,
      cooldown: 4,
      category: "交易",
      condition: { stats: { infection: { gte: 30 } } },
      title: "黑医要价",
      body: "黑医看了我的伤口后先报了价，表情像在卖一件二手零件。",
      choices: [
        { label: "支付高价治疗", effects: { stats: { supplies: -14, infection: -18, health: 6 }, flagsClear: ["woundOpen"] }, result: "缝线很粗，但伤口终于不再渗液。" },
        { label: "讨价还价只做清创", effects: { stats: { supplies: -8, infection: -8, stress: 4 } }, result: "我省了些物资，恢复速度也慢了一截。" }
      ]
    },
    {
      id: "r_fake_currency",
      weight: 3,
      cooldown: 6,
      category: "交易",
      condition: { stageGte: 4 },
      title: "伪钞纠纷",
      body: "交易后对方指着我手里的票据说是假币，周围人开始围拢。",
      choices: [
        { label: "公开翻包对质", effects: { stats: { trust: 4, stress: 3, noise: 6 } }, result: "我把账本摊开，勉强压住了场面。" },
        { label: "认亏离场", effects: { stats: { supplies: -6, stress: -1 } }, result: "我咬牙离开，至少没把冲突升级。" }
      ]
    },

    {
      id: "r_door_knock",
      weight: 7,
      cooldown: 3,
      category: "道德困境",
      condition: { stageGte: 1 },
      title: "夜里敲门",
      body: "凌晨时分，有人连续敲了三下门，说自己没被咬，只想借一个晚上。",
      choices: [
        { label: "隔门检查后放进前厅", effects: { stats: { trust: 6, humanity: 6, shelter: -2, stress: 4 } }, result: "我让他留在前厅，所有守夜班都往前提了半小时。" },
        { label: "拒绝并丢一袋口粮", effects: { stats: { humanity: 2, supplies: -4, trust: -2 } }, result: "我没开门，但至少没让他空手走。" },
        { label: "直接驱离", effects: { stats: { humanity: -8, stress: -2, trust: -6 } }, result: "脚步声远去后，走廊安静得让人发慌。" }
      ]
    },
    {
      id: "r_prisoner_choice",
      weight: 5,
      cooldown: 5,
      category: "道德困境",
      condition: { stageGte: 3 },
      title: "抓到抢匪",
      body: "巡逻队抓到一个抢匪，背包里装着我们的药。大家等我定夺。",
      choices: [
        { label: "扣押并劳动赎罪", effects: { stats: { trust: 6, humanity: 6, shelter: 4 } }, result: "我给了他一条活路，也给据点加了双手。" },
        { label: "公开鞭罚后驱逐", effects: { stats: { trust: 8, humanity: -8, stress: -2 }, flagsSet: { bloodOnHands: true } }, result: "秩序迅速恢复，恐惧也更深了。" }
      ]
    },
    {
      id: "r_last_antibiotic",
      weight: 4,
      cooldown: 6,
      category: "道德困境",
      condition: { stats: { supplies: { lte: 30 } } },
      title: "最后一支抗生素",
      body: "药盒里只剩最后一支抗生素。一个老队员肺部感染，另一个轻伤但还能战斗。",
      choices: [
        { label: "给老队员", effects: { stats: { trust: 8, humanity: 8, ammo: -4 } }, result: "我保住了老队员，战斗班当天少了一人。" },
        { label: "给战斗人员", effects: { stats: { trust: -6, humanity: -6, ammo: 6 } }, result: "前线稳住了，休息区的气氛却更僵。" }
      ]
    },
    {
      id: "r_food_riot",
      weight: 4,
      cooldown: 6,
      category: "道德困境",
      condition: { stats: { hunger: { gte: 65 } } },
      title: "口粮争抢",
      body: "发餐时有人提前插队，争吵很快升级成推搡。",
      choices: [
        { label: "我亲自分配并减半全员口粮", effects: { stats: { trust: 4, humanity: 5, hunger: 8, shelter: 4 } }, result: "没人吃饱，但秩序撑住了。" },
        { label: "用武力压制", effects: { stats: { trust: -10, humanity: -10, stress: -3, noise: 6 } }, result: "队伍重新排好了，但眼神都变得锋利。" }
      ]
    },
    {
      id: "r_emergency_kitchen",
      weight: 6,
      cooldown: 6,
      category: "庇护所管理",
      condition: { stageGte: 3, stats: { hunger: { gte: 72 } } },
      title: "应急厨房",
      body: "厨房主管提议把备用饲料和罐头混煮成高热量糊状餐，味道糟糕，但能顶命。",
      choices: [
        { label: "全员执行应急食谱", effects: { stats: { hunger: -14, supplies: -3, trust: 3, humanity: -2 } }, result: "大家皱着眉把碗见底，至少胃里有了东西。" },
        { label: "仅给前线班组", effects: { stats: { hunger: -8, ammo: 4, trust: -6, humanity: -6 } }, result: "战斗人员状态回升，后勤区的不满也压不住了。" }
      ]
    },

    {
      id: "r_guard_shift",
      weight: 7,
      cooldown: 3,
      category: "同伴互动",
      condition: { stageGte: 2 },
      title: "守夜换班",
      body: "凌晨交班时，两个守夜员互相指责偷懒，情绪快压不住。",
      choices: [
        { label: "我顶上夜班让他们冷静", effects: { stats: { health: -4, trust: 8, stress: 4 } }, result: "我整夜没合眼，至少他们第二天还能一起干活。" },
        { label: "按规章各罚一天口粮", effects: { stats: { trust: -4, shelter: 4, hunger: 4 } }, result: "纪律是立住了，私下怨气也累积了。" }
      ]
    },
    {
      id: "r_companion_wound",
      weight: 5,
      cooldown: 5,
      category: "同伴互动",
      condition: { flagsAll: ["hasCompanion"] },
      title: "玛拉中弹",
      body: "撤回据点时，玛拉肩部中弹。她坚持说不用处理，声音却开始发虚。",
      choices: [
        { label: "立刻手术止血", effects: { stats: { supplies: -10, trust: 10, stress: 3 } }, result: "我缝了七针，她第二天还能端枪。" },
        { label: "先撤离再处理", effects: { stats: { trust: -8, stress: 6, health: -4 } }, result: "我们走得更快，但她一路都没再说话。" }
      ]
    },
    {
      id: "r_confession_fire",
      weight: 4,
      cooldown: 6,
      category: "同伴互动",
      condition: { flagsAll: ["intimateBond"] },
      title: "篝火旁的旧事",
      body: "夜里只剩一截火光。她提到灾变前的生活，我发现自己很久没想过那个世界。",
      choices: [
        { label: "认真回应，建立默契", effects: { stats: { trust: 8, stress: -8, humanity: 4 } }, result: "我们谈到天快亮，第二天协作明显顺了。" },
        { label: "刻意保持距离", effects: { stats: { trust: -6, stress: 4 } }, result: "我把话题切回任务，她点头，但气氛凉了下来。" }
      ]
    },
    {
      id: "r_leadership_challenge",
      weight: 4,
      cooldown: 7,
      category: "同伴互动",
      condition: { stageGte: 4, stats: { trust: { gte: 45 } } },
      title: "领导权挑战",
      body: "有人公开质疑我的决策，说我该让出指挥位。",
      choices: [
        { label: "接受投票", effects: { stats: { trust: 10, stress: 3, humanity: 4 }, flagsSet: { ledCommunity: true } }, result: "我让大家投票，结果比我预想更接近。" },
        { label: "强行压下声音", effects: { stats: { trust: -12, humanity: -8, stress: -2 } }, result: "短期内没人再提，但裂缝留在了人心里。" }
      ]
    },

    {
      id: "r_wall_repair",
      weight: 7,
      cooldown: 3,
      category: "庇护所管理",
      condition: { stageGte: 1 },
      title: "外墙裂缝",
      body: "北墙裂缝比昨天又长了一截，再拖下去就是入口。",
      choices: [
        { label: "消耗材料加固", effects: { stats: { supplies: -8, shelter: 12, stress: -3 } }, result: "裂缝被钢板和木梁封住，今晚能睡得踏实些。" },
        { label: "先标记，晚点再修", effects: { stats: { shelter: -8, stress: 4 } }, result: "我知道这是在赌，赌运气还能撑几天。" }
      ]
    },
    {
      id: "r_water_filter",
      weight: 5,
      cooldown: 5,
      category: "庇护所管理",
      condition: { stageGte: 2 },
      title: "净水滤芯",
      body: "滤芯寿命到了，水里开始有金属味。",
      choices: [
        { label: "更换滤芯", effects: { stats: { supplies: -6, health: 4, infection: -4 } }, result: "水恢复了清澈，肠胃问题明显减少。" },
        { label: "煮沸凑合", effects: { stats: { supplies: -2, stress: 3, infection: 3 } }, result: "暂时还能喝，但风险被悄悄推高。" }
      ]
    },
    {
      id: "r_generator_noise",
      weight: 5,
      cooldown: 4,
      category: "庇护所管理",
      condition: { stageGte: 3 },
      title: "发电机噪声",
      body: "发电机轴承磨损，夜里像在敲铁桶。",
      choices: [
        { label: "立即停机检修", effects: { stats: { shelter: -4, noise: -12, supplies: -4 } }, result: "照明短暂中断，但外面的嘶吼声确实少了。" },
        { label: "继续硬撑", effects: { stats: { noise: 12, shelter: 4, stress: -2 } }, result: "电力稳住了，噪声也把风险写在墙上。" }
      ]
    },
    {
      id: "r_medicine_inventory",
      weight: 4,
      cooldown: 6,
      category: "庇护所管理",
      condition: { stageGte: 4 },
      title: "药品盘点",
      body: "药品账册出现三处不一致，有人可能在私藏。",
      choices: [
        { label: "公开盘点并追责", effects: { stats: { trust: 6, stress: 4, humanity: 2 } }, result: "我把数据贴在墙上，至少数字开始透明。" },
        { label: "先压下不查", effects: { stats: { trust: -6, stress: -2, infection: 4 } }, result: "表面平静了，药品流向却更难追。" }
      ]
    },

    {
      id: "r_motel_breath",
      weight: 4,
      cooldown: 7,
      category: "成人向氛围",
      condition: { stageGte: 2, stageLte: 4, flagsAll: ["hasCompanion"] },
      title: "汽车旅馆短暂停靠",
      body: "我们在汽车旅馆歇脚，门后只剩一盏应急灯。她靠在墙边换绷带，呼吸很浅。",
      choices: [
        { label: "递上外套并守门", effects: { stats: { trust: 6, humanity: 4, stress: -4 } }, result: "我站在门口替她盯着走廊，谁都没多说一句。" },
        { label: "靠近安抚，随后继续赶路", effects: { stats: { trust: 8, stress: -8 }, flagsSet: { intimateBond: true } }, result: "我们短暂拥抱了一下，很快又把注意力拉回地图。" }
      ]
    },
    {
      id: "r_dirty_sink",
      weight: 3,
      cooldown: 8,
      category: "成人向氛围",
      condition: { stageGte: 3, flagsAll: ["intimateBond"] },
      title: "洗手池边界",
      body: "水龙头只有细小水流。她让我帮忙冲掉肩上的血渍，语气平静得像在讨论弹道。",
      choices: [
        { label: "专注处理伤口", effects: { stats: { trust: 6, humanity: 4, stress: -3 } }, result: "我只看着伤口和纱布，动作尽量稳。" },
        { label: "分心导致处理失误", effects: { stats: { trust: -4, stress: 5, infection: 3 } }, result: "她皱了下眉，我也意识到自己越界了。" }
      ]
    },
    {
      id: "r_lonely_night",
      weight: 4,
      cooldown: 6,
      category: "成人向氛围",
      condition: { stageGte: 2 },
      title: "长夜体温",
      body: "温度骤降，值夜间里有人提出两两靠背取暖。这个建议让气氛突然变得微妙。",
      choices: [
        { label: "按名单安排，保持纪律", effects: { stats: { shelter: 4, trust: 4, stress: -3 } }, result: "我按值班表配对，避免了不必要的误会。" },
        { label: "放任自行组合", effects: { stats: { trust: -4, stress: -6, shelter: -3 } }, result: "短期情绪缓了些，第二天流言却多了。" }
      ]
    },
    {
      id: "r_bathroom_mirror",
      weight: 3,
      cooldown: 7,
      category: "成人向氛围",
      condition: { stageGte: 4 },
      title: "镜前停顿",
      body: "我在镜前刮胡子时发现自己老了十岁。门外有人轻声问我今晚还要不要继续守夜。",
      choices: [
        { label: "继续值夜", effects: { stats: { health: -4, trust: 6, stress: 3 } }, result: "我把刀片扔进垃圾桶，回到走廊。" },
        { label: "交班休息", effects: { stats: { stress: -8, trust: -2, health: 3 } }, result: "我躺下后很久才睡着，但至少睡着了。" }
      ]
    }
  ]
};
