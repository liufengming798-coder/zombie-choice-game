window.GAME_DATA = {
  meta: {
    title: "魔都生存手记",
    hook: "你不是英雄，只是上海断联后还想活下去的普通人。",
    premise: "架空叙事设定：全城断网前流出情报称，有境外势力向长三角投放了改造病毒载体。信息无法核验，但城市秩序已崩塌。",
    stages: {
      1: "崩溃初期",
      2: "封锁裂解",
      3: "组织重构",
      4: "高压消耗",
      5: "长期求生"
    }
  },
  statDefs: [
    { key: "health", label: "健康", min: 0, max: 100 },
    { key: "infection", label: "感染", min: 0, max: 100, inverse: true },
    { key: "hunger", label: "饥饿", min: 0, max: 100, inverse: true },
    { key: "supplies", label: "物资", min: 0, max: 100 },
    { key: "stamina", label: "体能", min: 0, max: 100 },
    { key: "stress", label: "压力", min: 0, max: 100, inverse: true },
    { key: "trust", label: "互信", min: 0, max: 100 },
    { key: "shelter", label: "据点", min: 0, max: 100 }
  ],
  initialState: {
    day: 1,
    stats: {
      health: 82,
      infection: 4,
      hunger: 18,
      supplies: 46,
      stamina: 70,
      stress: 28,
      trust: 34,
      shelter: 22
    },
    flags: {
      rumorForeignStrike: true,
      hasBike: false,
      hasRadio: false,
      hasWaterRoute: false,
      hasClinicRoute: false,
      knowsFoodDepot: false,
      hasGenerator: false,
      allianceNorthBund: false,
      allianceXuhui: false,
      metroCodeKnown: false,
      evacSignalKnown: false,
      hasCommunity: false,
      betrayedCivilians: false,
      citywideBlackout: false,
      holdLineYangpu: false,
      openedSuzhouCrossing: false,
      pledgedNoAbandon: false
    }
  },
  districts: [
    "黄浦区", "静安区", "徐汇区", "浦东新区", "杨浦区", "虹口区", "普陀区", "长宁区"
  ],
  roads: [
    "延安高架路", "南北高架路", "内环高架路", "中环路", "南京西路", "淮海中路", "四川北路", "武宁路", "虹桥路", "肇嘉浜路", "控江路", "周家嘴路", "龙阳路", "世纪大道", "中山公园环路"
  ],
  landmarks: [
    "人民广场", "外白渡桥", "陆家嘴环路", "北外滩国客中心", "徐家汇天主堂", "五角场", "虹桥火车站", "龙华中路", "瑞金医院", "中山公园"
  ],
  endings: [
    {
      id: "end_overrun",
      priority: 99,
      title: "结局：城区沦陷",
      text: "你撑到了最后一班哨，却没撑过最后一次破门。魔都的夜色没有回答任何人的求救。",
      condition: { any: [{ stats: { health: { lte: 0 } } }, { stats: { infection: { gte: 100 } } }] }
    },
    {
      id: "end_exhausted",
      priority: 90,
      title: "结局：体能崩断",
      text: "连续的奔跑、饥饿和高压把你掏空。你倒下时，口袋里还攥着下一条撤离路线。",
      condition: { all: [{ stats: { stamina: { lte: 0 } } }, { dayGte: 12 }] }
    },
    {
      id: "end_social_collapse",
      priority: 85,
      title: "结局：孤岛失联",
      text: "你还活着，但没人再愿意与你结队。独行让每一次出门都变成不可逆的赌博。",
      condition: { all: [{ stats: { trust: { lte: 4 } } }, { dayGte: 16 }] }
    }
  ],
  events: [
    {
      id: "c1_people_square",
      weight: 12,
      once: true,
      minDay: 1,
      maxDay: 2,
      category: "崩溃初期",
      title: "人民广场警报中断",
      body: "人民广场的大屏停在一条未播完的紧急通知。南京西路方向出现推挤和呼救，地铁广播只重复一句: 不要聚集。",
      location: "人民广场",
      roads: ["南京西路", "延安高架路"],
      choices: [
        {
          label: "顺着南京西路撤向静安里弄",
          result: "你避开了最密集的人群，抢先找到一处可封闭的旧式楼道。",
          effects: { stats: { shelter: 10, stamina: -6, stress: 3 }, flagsSet: { hasCommunity: true }, queue: ["c1_jingan_lane"] }
        },
        {
          label: "去人民广场地下商场搜水和药",
          result: "你拿到几箱矿泉水和止痛片，但地下通道回声让你心跳一直下不来。",
          effects: { stats: { supplies: 14, stress: 7, stamina: -5, hunger: 2 } }
        },
        {
          label: "徒步向外白渡桥方向侦察北侧",
          result: "你在苏州河口附近看到临时拦截线，记录了一条还没堵死的转向路线。",
          effects: { stats: { stamina: -8, stress: 2 }, flagsSet: { hasWaterRoute: true }, queue: ["c2_bund_contact"] }
        },
        {
          label: "尝试拍视频上传求证“境外投毒”传闻",
          result: "网络彻底中断，上传失败。你只保住了电量和一段无人回应的证词。",
          effects: { stats: { stress: 5, trust: -2, stamina: -2 } }
        }
      ]
    },
    {
      id: "c1_jingan_lane",
      weight: 10,
      once: true,
      minDay: 1,
      maxDay: 4,
      category: "封锁裂解",
      requiresFlagsAll: ["hasCommunity"],
      title: "静安里弄守门会议",
      body: "静安一条老里弄里，十几户居民围着手写值守表吵到凌晨。武宁路有人说看到车辆冲卡，谁都不知道还能等谁来救援。",
      location: "静安区",
      roads: ["武宁路", "南京西路"],
      choices: [
        {
          label: "主动接下夜间门岗，换取配给管理权",
          result: "你拿到了钥匙和扩音喇叭，也背上了谁先吃谁后吃的矛盾。",
          effects: { stats: { trust: 8, stress: 5, shelter: 6, hunger: 2 }, flagsSet: { pledgedNoAbandon: true } }
        },
        {
          label: "建议按家庭人口公开分配物资",
          result: "冲突明显下降，里弄里第一次有人愿意把自家罐头拿出来共用。",
          effects: { stats: { trust: 10, supplies: -4, stress: -2, shelter: 4 }, flagsSet: { hasCommunity: true } }
        },
        {
          label: "说服大家拆共享单车做移动 barricade",
          result: "你们把路口堵成锯齿形，短时间内确实挡住了冲撞。",
          effects: { stats: { shelter: 12, stamina: -6, supplies: -2 }, flagsSet: { hasBike: true } }
        },
        {
          label: "拒绝掺和，独自搬去楼顶储物间",
          result: "你躲开了争执，但也失去了多数邻居的信任。",
          effects: { stats: { trust: -9, stress: -3, shelter: 2 }, flagsSet: { betrayedCivilians: true } }
        }
      ]
    },
    {
      id: "c1_ruijin_clinic",
      weight: 8,
      once: true,
      minDay: 2,
      maxDay: 8,
      category: "封锁裂解",
      title: "瑞金医院外围通道",
      body: "瑞金医院急诊外搭了临时分流区。肇嘉浜路上混着求药者、志愿者和想插队的车队，秩序随时会崩。",
      location: "瑞金医院",
      roads: ["肇嘉浜路", "淮海中路"],
      choices: [
        {
          label: "帮分流队维持秩序，换取基础药包",
          result: "你忙到天亮，但拿回了抗炎药和体温计。",
          effects: { stats: { infection: -8, trust: 7, stamina: -10, stress: 2 }, flagsSet: { hasClinicRoute: true } }
        },
        {
          label: "掩护一名受伤少年先进入清创区",
          result: "家属把你记住了，后来在值守时给你留了两袋冻干粮。",
          effects: { stats: { trust: 9, supplies: 6, stress: 1, stamina: -6 }, flagsSet: { allianceXuhui: true } }
        },
        {
          label: "趁混乱只拿药不登记",
          result: "你确实拿到高价值药品，但现场有人把你的脸拍了下来。",
          effects: { stats: { supplies: 10, trust: -10, stress: 4 }, flagsSet: { betrayedCivilians: true } }
        },
        {
          label: "不靠近医院，改去龙华中路找民间诊所",
          result: "你找到一间简陋诊所，能处理轻伤，但药量有限。",
          effects: { stats: { infection: -4, stamina: -4, supplies: -3 }, flagsSet: { hasClinicRoute: true } }
        }
      ]
    },
    {
      id: "c2_bund_contact",
      weight: 9,
      once: true,
      minDay: 3,
      maxDay: 10,
      category: "组织重构",
      requiresFlagsAll: ["hasWaterRoute"],
      title: "北外滩无线电点",
      body: "北外滩国客中心楼顶有人架了短波台，宣称能监听到沿江补给艇频段。外白渡桥附近出现了第一批民间巡防队。",
      location: "北外滩",
      roads: ["四川北路", "周家嘴路"],
      choices: [
        {
          label: "加入巡防队轮班，换取电台监听权限",
          result: "你得到一台老式手摇收音机，夜里能听到断续坐标。",
          effects: { stats: { trust: 8, stress: 3, stamina: -8 }, flagsSet: { hasRadio: true, allianceNorthBund: true } }
        },
        {
          label: "只交换地图，不加入任何组织",
          result: "你保留独立性，但很多后续消息会晚半拍。",
          effects: { stats: { stamina: -2, trust: -3, stress: -1 }, flagsSet: { hasWaterRoute: true } }
        },
        {
          label: "用物资换走一台便携发电机",
          result: "发电机很重却很关键，你们据点终于能在夜里保持照明。",
          effects: { stats: { supplies: -12, shelter: 12, stamina: -7 }, flagsSet: { hasGenerator: true } }
        },
        {
          label: "公开指责巡防队私藏补给",
          result: "你说中了部分事实，但现场气氛立刻失控。",
          effects: { stats: { trust: -12, stress: 8, stamina: -4 }, flagsSet: { betrayedCivilians: true } }
        }
      ]
    },
    {
      id: "c2_xujiahui_hub",
      weight: 8,
      once: true,
      minDay: 5,
      maxDay: 14,
      category: "组织重构",
      title: "徐家汇地下连廊",
      body: "徐家汇连廊被改成临时交换站。虹桥路来的队伍在抢柴油，淮海中路方向的人更关心净水片和婴儿奶粉。",
      location: "徐家汇",
      roads: ["虹桥路", "肇嘉浜路"],
      choices: [
        {
          label: "主导公平交换规则，按急需程度分级",
          result: "争执减少，你的名字被写进了公告板值守名单。",
          effects: { stats: { trust: 12, stress: 3, supplies: -5 }, flagsSet: { hasCommunity: true } }
        },
        {
          label: "优先囤积柴油与电池",
          result: "短期收益明显，但很多人开始防着你。",
          effects: { stats: { supplies: 10, shelter: 4, trust: -8, stress: 4 } }
        },
        {
          label: "牵线北外滩与徐汇据点共享守夜频段",
          result: "两边首次完成信息联动，夜间救援效率提高。",
          effects: { stats: { trust: 10, stress: -2, stamina: -5 }, flagsSet: { allianceNorthBund: true, allianceXuhui: true, metroCodeKnown: true } }
        },
        {
          label: "不参与交换，直接回据点固守",
          result: "你降低了外出风险，但错过了关键信息窗口。",
          effects: { stats: { shelter: 4, trust: -3, stress: -1 } }
        }
      ]
    },
    {
      id: "c3_hongqiao_convoy",
      weight: 8,
      once: true,
      minDay: 8,
      maxDay: 18,
      category: "高压消耗",
      title: "虹桥路车队冲突",
      body: "虹桥路出现三支民间车队争夺一批军规滤水器。你赶到时，枪口、喇叭和哭声混在一起，随时会演变为近距离火拼。",
      location: "虹桥路",
      roads: ["虹桥路", "延安高架路"],
      choices: [
        {
          label: "提出三方轮替机制并现场监督分配",
          result: "局面勉强稳住，你的据点获得了固定补水配额。",
          effects: { stats: { supplies: 8, trust: 11, stress: 6, stamina: -7 }, flagsSet: { knowsFoodDepot: true } }
        },
        {
          label: "掩护弱势车队先撤离",
          result: "你救下了一批家庭车，但自己队伍损失了两箱补给。",
          effects: { stats: { trust: 13, supplies: -7, stamina: -8, stress: 4 }, flagsSet: { pledgedNoAbandon: true } }
        },
        {
          label: "趁乱夺走滤水器快速撤离",
          result: "你们得到关键装备，却在多个据点黑名单上留下名字。",
          effects: { stats: { supplies: 14, trust: -14, stress: 2 }, flagsSet: { betrayedCivilians: true } }
        },
        {
          label: "放弃争夺，改走中环路寻找仓储点",
          result: "你避开冲突，但错过了最关键的净水装备。",
          effects: { stats: { stamina: -5, stress: -2, hunger: 3 } }
        }
      ]
    },
    {
      id: "c3_yangpu_line",
      weight: 8,
      once: true,
      minDay: 10,
      maxDay: 22,
      category: "高压消耗",
      title: "杨浦防线缺口",
      body: "控江路至周家嘴路一线出现连续破口。临时广播呼叫附近据点派人堵口，不然整条线会在凌晨前失守。",
      location: "杨浦区",
      roads: ["控江路", "周家嘴路"],
      choices: [
        {
          label: "率人去一线封堵，哪怕损失物资",
          result: "你们守住了凌晨最危险的两小时，防线没有崩。",
          effects: { stats: { trust: 12, stamina: -12, supplies: -8, stress: 5 }, flagsSet: { holdLineYangpu: true } }
        },
        {
          label: "提供物资不派人，保留据点战力",
          result: "你被指责保守，但据点核心人员得以保存。",
          effects: { stats: { supplies: -10, shelter: 8, trust: -4, stress: 2 } }
        },
        {
          label: "建议撤退并转移到浦东内线",
          result: "很多人活了下来，但杨浦北段被迫放弃。",
          effects: { stats: { stamina: -6, stress: 3, trust: -7, shelter: -3 }, flagsSet: { citywideBlackout: true } }
        },
        {
          label: "拒绝响应，把防线当成他人问题",
          result: "你短期安全，却失去跨区协同资格。",
          effects: { stats: { trust: -12, stress: -1 }, flagsSet: { betrayedCivilians: true } }
        }
      ]
    },
    {
      id: "c4_suzhou_crossing",
      weight: 7,
      once: true,
      minDay: 14,
      maxDay: 28,
      category: "长期求生",
      title: "苏州河临时过桥点",
      body: "内环高架路下方搭起了钢架便桥，能把静安与虹口物资线重新接上。桥体不稳，必须有人昼夜维护。",
      location: "苏州河沿线",
      roads: ["内环高架路", "四川北路"],
      choices: [
        {
          label: "投入人手与钢材，保障过桥点",
          result: "跨区运补恢复，很多据点把你视作关键协调者。",
          effects: { stats: { shelter: 14, trust: 12, supplies: -10, stamina: -9 }, flagsSet: { openedSuzhouCrossing: true } }
        },
        {
          label: "只维护夜间窗口，白天封桥",
          result: "风险降低，效率也降低，但至少能持续运转。",
          effects: { stats: { shelter: 8, trust: 4, stamina: -5, stress: -1 }, flagsSet: { openedSuzhouCrossing: true } }
        },
        {
          label: "拒绝参与，回收钢材用于本据点",
          result: "你的据点更坚固了，但城市协同进一步恶化。",
          effects: { stats: { shelter: 12, supplies: 5, trust: -10, stress: 3 } }
        },
        {
          label: "炸毁桥架阻止尸群跨河",
          result: "你们短期安全，但北线居民再无撤离路径。",
          effects: { stats: { stress: 10, trust: -16, shelter: 4 }, flagsSet: { betrayedCivilians: true } }
        }
      ]
    },
    {
      id: "c4_final_signal",
      weight: 7,
      once: true,
      minDay: 18,
      maxDay: 60,
      category: "长期求生",
      requiresAnyFlags: ["hasRadio", "metroCodeKnown"],
      title: "龙阳路撤离编码",
      body: "你在龙阳路附近捕捉到一组重复编码，疑似跨江撤离窗口。是否公开这条信息，直接决定多少人会在同一夜奔向同一条路。",
      location: "龙阳路",
      roads: ["龙阳路", "世纪大道"],
      choices: [
        {
          label: "立即公开编码并组织分批撤离",
          result: "道路拥堵但秩序尚存，许多人记住了你坚持不抛弃的决定。",
          effects: { stats: { trust: 15, stress: 8, stamina: -10, supplies: -8 }, flagsSet: { evacSignalKnown: true, pledgedNoAbandon: true } }
        },
        {
          label: "只通知本据点核心成员",
          result: "你保住了自己人，却也听到身后越来越多的咒骂。",
          effects: { stats: { supplies: 10, trust: -12, stress: -2 }, flagsSet: { evacSignalKnown: true, betrayedCivilians: true } }
        },
        {
          label: "先验证两天再行动",
          result: "编码被证实有效，但窗口明显缩短，机会只剩一次。",
          effects: { stats: { stress: 4, stamina: -4, trust: 2 }, flagsSet: { evacSignalKnown: true } }
        },
        {
          label: "彻底不信，继续长期固守路线",
          result: "你把希望押在据点建设上，决定不再追逐撤离幻影。",
          effects: { stats: { shelter: 10, stress: -3, trust: -3 }, flagsSet: { hasCommunity: true } }
        }
      ]
    },
    {
      id: "m_day30_checkpoint",
      weight: 6,
      once: true,
      minDay: 30,
      maxDay: 90,
      category: "长期求生",
      title: "第30天生存节点",
      body: "你活过了整整三十天。有人提议把据点升级成长期社区，也有人坚持应该全员机动化，别再被地理位置绑定。",
      location: "中山公园",
      roads: ["中山公园环路", "内环高架路"],
      choices: [
        {
          label: "升级为长期社区，建立轮班和教育区",
          result: "秩序感上升，你们第一次讨论的不再只是今天怎么活。",
          effects: { stats: { shelter: 16, trust: 10, supplies: -10, stress: -4 }, flagsSet: { hasCommunity: true } }
        },
        {
          label: "保持机动化，分散小队降低团灭风险",
          result: "生存弹性更高，但人与人之间的纽带明显变薄。",
          effects: { stats: { stamina: 8, stress: 2, trust: -6, shelter: -4 } }
        },
        {
          label: "社区与机动双轨并行",
          result: "执行很难，但你找到了一种折中平衡。",
          effects: { stats: { shelter: 8, trust: 6, stamina: -2, stress: 1 } }
        },
        {
          label: "趁节点清算旧账，排除不可靠成员",
          result: "短期纪律提升，长期裂痕也被彻底留下。",
          effects: { stats: { shelter: 6, trust: -12, stress: 6 }, flagsSet: { betrayedCivilians: true } }
        }
      ]
    }
  ],
  templateEvents: [
    {
      id: "t_supply_run",
      title: "{district}补给窗口",
      body: "{road}附近出现短时补给窗口。人群和低吼同时逼近，你必须在十分钟内决定策略。",
      category: "高压消耗",
      choices: [
        {
          label: "带队快进快出，限定7分钟撤离",
          result: "你拿到补给并完整撤离，但每个人都像跑完一场无休止冲刺。",
          effects: { stats: { supplies: 9, stamina: -8, stress: 3 } }
        },
        {
          label: "稳步推进，边搜边封门",
          result: "效率一般但风险可控，队伍士气保持稳定。",
          effects: { stats: { supplies: 5, stamina: -4, stress: -1, shelter: 2 } }
        },
        {
          label: "放弃搜刮，护送伤员优先撤离",
          result: "你错过了补给，却保住了人的命和信任。",
          effects: { stats: { trust: 8, supplies: -3, stress: 1 } }
        },
        {
          label: "用诱饵吸引尸群后单点突破",
          result: "你拿到最多物资，但战术太冷，很多人开始远离你。",
          effects: { stats: { supplies: 12, trust: -8, stress: 4 }, flagsSet: { betrayedCivilians: true } }
        }
      ]
    },
    {
      id: "t_night_defense",
      title: "{landmark}夜间守线",
      body: "夜色下的{road}出现多点冲击。守不守、怎么守，都会在明天早上变成整个片区对你的评价。",
      category: "长期求生",
      choices: [
        {
          label: "全员轮班硬守到天亮",
          result: "你们守住了，但每个人都濒临崩溃。",
          effects: { stats: { shelter: 8, trust: 7, stamina: -10, stress: 6 } }
        },
        {
          label: "半数守线半数休整，放弃外圈",
          result: "防线后撤一层，但核心区得以继续运转。",
          effects: { stats: { shelter: 4, stamina: -4, stress: 2, trust: 2 } }
        },
        {
          label: "启动诱导灯，把冲击引向空置街区",
          result: "当晚风险下降，后续清理成本却上升。",
          effects: { stats: { stress: -2, supplies: -5, trust: -2, shelter: 3 } }
        },
        {
          label: "撤离守线，转入流动避险",
          result: "你们活了下来，但该片区彻底失去协调中心。",
          effects: { stats: { stamina: 5, shelter: -8, trust: -6, stress: 3 } }
        }
      ]
    }
  ]
};
