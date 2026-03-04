(function () {
  const npcDefs = [
    { id: "shen_yi", name: "沈奕", role: "北外滩短波台维护员", initial: 52 },
    { id: "qiao_nan", name: "乔楠", role: "徐家汇物资交换组织者", initial: 48 },
    { id: "lu_chen", name: "陆琛", role: "虹桥路机动队司机", initial: 45 },
    { id: "jiang_ya", name: "姜娅", role: "瑞金医院外围志愿者", initial: 50 },
    { id: "han_song", name: "韩松", role: "杨浦防线临时指挥", initial: 44 },
    { id: "xu_ting", name: "许庭", role: "静安里弄协调员", initial: 46 }
  ];

  const districts = [
    { key: "huangpu", name: "黄浦区", roads: ["南京西路", "淮海中路", "延安高架路"], mark: "人民广场" },
    { key: "jingan", name: "静安区", roads: ["武宁路", "南京西路", "南北高架路"], mark: "静安寺" },
    { key: "xuhui", name: "徐汇区", roads: ["虹桥路", "肇嘉浜路", "龙华中路"], mark: "徐家汇" },
    { key: "pudong", name: "浦东新区", roads: ["世纪大道", "龙阳路", "内环高架路"], mark: "陆家嘴环路" },
    { key: "yangpu", name: "杨浦区", roads: ["控江路", "周家嘴路", "中环路"], mark: "五角场" },
    { key: "hongkou", name: "虹口区", roads: ["四川北路", "周家嘴路", "内环高架路"], mark: "北外滩" }
  ];

  function makeCoreEvents() {
    return [
      {
        id: "core_001_people_square",
        weight: 14,
        once: true,
        minDay: 1,
        maxDay: 2,
        category: "崩溃初期",
        title: "人民广场警报熄火",
        body: "人民广场电子屏停在半句未播完的撤离提示。南京西路的车流已经逆向，很多人开始徒步。",
        location: "人民广场",
        roads: ["南京西路", "延安高架路"],
        choices: [
          { label: "沿南京西路转入静安里弄", result: "你提早进入低密度街区，获得临时落脚点。", effects: { stats: { shelter: 10, stamina: -6, stress: 2 }, flagsSet: { hasCommunity: true }, queue: ["core_002_jingan_meeting"] } },
          { label: "下到地下商场抢水和药", result: "你背回了水和常用药，但下行通道挤压引发恐慌。", effects: { stats: { supplies: 12, stress: 8, stamina: -5 } } },
          { label: "北上外白渡桥侦察沿江线", result: "你记录到一条尚可通行的河岸路线。", effects: { stats: { stamina: -8, stress: 3 }, flagsSet: { hasWaterRoute: true }, queue: ["core_003_bund_signal"] } },
          { label: "回家固守，封闭单元门", result: "你暂时安全，但错过了第一波协同信息。", effects: { stats: { shelter: 5, trust: -4, stress: -1 } } }
        ]
      },
      {
        id: "core_002_jingan_meeting",
        weight: 12,
        once: true,
        minDay: 1,
        maxDay: 4,
        category: "封锁裂解",
        requiresFlagsAll: ["hasCommunity"],
        npcId: "xu_ting",
        title: "静安里弄守门会",
        body: "许庭在黑板上写满轮班名单。武宁路传来冲卡噪声，住户在“开门收人”与“立刻封门”间争执。",
        location: "静安区",
        roads: ["武宁路", "南京西路"],
        choices: [
          { label: "支持许庭按户登记接纳", result: "名单制度落地，秩序有所恢复。", effects: { stats: { trust: 10, stress: 3, shelter: 6 }, npc: { xu_ting: 9 }, flagsSet: { npc_xu_ting_met: true, pledgedNoAbandon: true } } },
          { label: "主张只留原住户，严格封门", result: "门口风险下降，但很多人对你心生隔阂。", effects: { stats: { shelter: 10, trust: -8, stress: 1 }, npc: { xu_ting: -8 }, flagsSet: { betrayedCivilians: true, npc_xu_ting_met: true } } },
          { label: "拆共享单车搭路障再议", result: "你们争取到两小时缓冲。", effects: { stats: { shelter: 12, stamina: -5, supplies: -2 }, npc: { xu_ting: 4 }, flagsSet: { hasBike: true, npc_xu_ting_met: true } } },
          { label: "退出会议，保留个人行动", result: "你避免卷入争吵，但失去组织资源。", effects: { stats: { trust: -6, stamina: 2, stress: -2 }, npc: { xu_ting: -4 }, flagsSet: { npc_xu_ting_met: true } } }
        ]
      },
      {
        id: "core_003_bund_signal",
        weight: 11,
        once: true,
        minDay: 2,
        maxDay: 7,
        category: "组织重构",
        requiresFlagsAll: ["hasWaterRoute"],
        npcId: "shen_yi",
        title: "北外滩短波点",
        body: "沈奕在北外滩楼顶维护短波台，声称能听到沿江补给艇和临时医疗点编码。",
        location: "北外滩",
        roads: ["四川北路", "周家嘴路"],
        choices: [
          { label: "加入维护轮班，换取频段权限", result: "你拿到一台手摇收音机，夜里能监听到坐标片段。", effects: { stats: { trust: 8, stamina: -6, stress: 2 }, npc: { shen_yi: 10 }, flagsSet: { hasRadio: true, allianceNorthBund: true, npc_shen_yi_met: true }, queue: ["npc_shen_yi_02"] } },
          { label: "只交换地图，不深度绑定", result: "你保持独立，情报却总慢半步。", effects: { stats: { stress: -1, trust: -3 }, npc: { shen_yi: -2 }, flagsSet: { npc_shen_yi_met: true } } },
          { label: "拿物资换便携发电机", result: "据点夜间照明恢复，但库存压力陡增。", effects: { stats: { supplies: -10, shelter: 10, stamina: -5 }, npc: { shen_yi: 3 }, flagsSet: { hasGenerator: true, npc_shen_yi_met: true } } },
          { label: "公开质疑短波台私留物资", result: "你掀起了争论，场面一度失控。", effects: { stats: { trust: -10, stress: 7 }, npc: { shen_yi: -12 }, flagsSet: { betrayedCivilians: true, npc_shen_yi_met: true } } }
        ]
      },
      {
        id: "core_004_ruijin_edge",
        weight: 10,
        once: true,
        minDay: 3,
        maxDay: 9,
        category: "封锁裂解",
        npcId: "jiang_ya",
        title: "瑞金医院分流带",
        body: "姜娅正带志愿者在肇嘉浜路做分流，急诊外排队长度超过三条街口。",
        location: "瑞金医院",
        roads: ["肇嘉浜路", "淮海中路"],
        choices: [
          { label: "协助分流并护送重伤者", result: "你熬到天亮，换回药包和一份后续路线图。", effects: { stats: { infection: -8, stamina: -9, trust: 8 }, npc: { jiang_ya: 10 }, flagsSet: { hasClinicRoute: true, npc_jiang_ya_met: true }, queue: ["npc_jiang_ya_02"] } },
          { label: "优先为自己队伍取药", result: "你拿到更多药，但被记录在‘插队名单’里。", effects: { stats: { supplies: 9, trust: -8, stress: 4 }, npc: { jiang_ya: -9 }, flagsSet: { hasClinicRoute: true, betrayedCivilians: true, npc_jiang_ya_met: true } } },
          { label: "转去龙华中路民间诊所", result: "你找到可处理轻伤的诊所，效率一般。", effects: { stats: { infection: -4, stamina: -4, supplies: -2 }, npc: { jiang_ya: 1 }, flagsSet: { hasClinicRoute: true, npc_jiang_ya_met: true } } },
          { label: "避免医疗区，直接回据点", result: "你规避了拥挤风险，也错过了关键医疗资源。", effects: { stats: { stress: -2, infection: 3, trust: -2 }, npc: { jiang_ya: -3 }, flagsSet: { npc_jiang_ya_met: true } } }
        ]
      },
      {
        id: "core_005_xujiahui_exchange",
        weight: 10,
        once: true,
        minDay: 5,
        maxDay: 12,
        category: "组织重构",
        npcId: "qiao_nan",
        title: "徐家汇连廊交换站",
        body: "乔楠在徐家汇地下连廊组织交换。虹桥路车队要柴油，居民更要净水片和奶粉。",
        location: "徐家汇",
        roads: ["虹桥路", "肇嘉浜路"],
        choices: [
          { label: "支持乔楠按急需等级分配", result: "争执明显下降，你被加入协管名单。", effects: { stats: { trust: 11, stress: 2, supplies: -4 }, npc: { qiao_nan: 9 }, flagsSet: { allianceXuhui: true, npc_qiao_nan_met: true }, queue: ["npc_qiao_nan_02"] } },
          { label: "优先囤积柴油与电池", result: "你短期收益最大，但口碑急剧下滑。", effects: { stats: { supplies: 10, shelter: 4, trust: -9, stress: 4 }, npc: { qiao_nan: -10 }, flagsSet: { betrayedCivilians: true, npc_qiao_nan_met: true } } },
          { label: "牵线北外滩共享守夜频段", result: "两处据点首次实现信息联动。", effects: { stats: { trust: 9, stamina: -4, stress: -1 }, npc: { qiao_nan: 6, shen_yi: 4 }, flagsSet: { metroCodeKnown: true, npc_qiao_nan_met: true } } },
          { label: "保持中立，只做旁观交易", result: "风险可控，但你对局势影响有限。", effects: { stats: { stress: -1, trust: -2, supplies: 3 }, npc: { qiao_nan: -1 }, flagsSet: { npc_qiao_nan_met: true } } }
        ]
      },
      {
        id: "core_006_hongqiao_convoy",
        weight: 9,
        once: true,
        minDay: 7,
        maxDay: 16,
        category: "高压消耗",
        npcId: "lu_chen",
        title: "虹桥路车队对峙",
        body: "陆琛带的机动队在虹桥路与两支车队对峙，三方都盯着同一批滤水器。",
        location: "虹桥路",
        roads: ["虹桥路", "延安高架路"],
        choices: [
          { label: "现场监督三方轮替分配", result: "局面勉强稳住，你据点得到固定补水配额。", effects: { stats: { supplies: 8, trust: 10, stamina: -7, stress: 4 }, npc: { lu_chen: 8 }, flagsSet: { knowsFoodDepot: true, npc_lu_chen_met: true }, queue: ["npc_lu_chen_02"] } },
          { label: "掩护弱势车队先撤", result: "你救下了家庭车队，但损失了部分库存。", effects: { stats: { trust: 12, supplies: -6, stamina: -8, stress: 4 }, npc: { lu_chen: 6 }, flagsSet: { pledgedNoAbandon: true, npc_lu_chen_met: true } } },
          { label: "趁乱强夺滤水器", result: "你抢到资源，多个据点将你列入黑名单。", effects: { stats: { supplies: 13, trust: -14, stress: 3 }, npc: { lu_chen: -12 }, flagsSet: { betrayedCivilians: true, npc_lu_chen_met: true } } },
          { label: "回避冲突，改走中环线", result: "你避免正面风险，也错失关键装备窗口。", effects: { stats: { stamina: -4, stress: -1, hunger: 3 }, npc: { lu_chen: -2 }, flagsSet: { npc_lu_chen_met: true } } }
        ]
      },
      {
        id: "core_007_yangpu_gap",
        weight: 9,
        once: true,
        minDay: 10,
        maxDay: 22,
        category: "高压消耗",
        npcId: "han_song",
        title: "杨浦防线缺口",
        body: "韩松请求各据点增援控江路-周家嘴路缺口，不堵住凌晨前会形成贯通破口。",
        location: "杨浦区",
        roads: ["控江路", "周家嘴路"],
        choices: [
          { label: "带人上前线封口", result: "最危险的两小时被守住了。", effects: { stats: { trust: 13, stamina: -12, supplies: -8, stress: 5 }, npc: { han_song: 10 }, flagsSet: { holdLineYangpu: true, npc_han_song_met: true }, queue: ["npc_han_song_02"] } },
          { label: "提供物资不派人", result: "你保留主力，但被批评过于保守。", effects: { stats: { supplies: -9, shelter: 8, trust: -3, stress: 2 }, npc: { han_song: -4 }, flagsSet: { npc_han_song_met: true } } },
          { label: "建议整体后撤至浦东内线", result: "很多人活下来了，但北段被迫放弃。", effects: { stats: { stamina: -6, trust: -8, stress: 3, shelter: -2 }, npc: { han_song: -8 }, flagsSet: { citywideBlackout: true, npc_han_song_met: true } } },
          { label: "拒绝响应，只守本据点", result: "你短期安全，却失去跨区协同资格。", effects: { stats: { trust: -12, stress: -1 }, npc: { han_song: -10 }, flagsSet: { betrayedCivilians: true, npc_han_song_met: true } } }
        ]
      },
      {
        id: "core_008_suzhou_bridge",
        weight: 8,
        once: true,
        minDay: 14,
        maxDay: 32,
        category: "长期求生",
        title: "苏州河临时过桥点",
        body: "内环高架路下搭起钢架便桥，能重接静安与虹口补给线，但需要昼夜维护。",
        location: "苏州河沿线",
        roads: ["内环高架路", "四川北路"],
        choices: [
          { label: "投入人手和钢材保桥", result: "跨区运补恢复，多据点愿意与你同步排班。", effects: { stats: { shelter: 14, trust: 11, supplies: -10, stamina: -9 }, flagsSet: { openedSuzhouCrossing: true } } },
          { label: "只保夜间窗口，白天封桥", result: "风险下降，效率也下降，但可持续。", effects: { stats: { shelter: 8, trust: 4, stamina: -5, stress: -1 }, flagsSet: { openedSuzhouCrossing: true } } },
          { label: "拒绝参与，钢材回收自用", result: "本据点更硬，城市协同继续恶化。", effects: { stats: { shelter: 11, supplies: 4, trust: -9, stress: 2 } } },
          { label: "炸毁桥架阻断追击", result: "你们短期安全，但北线居民撤离路被切断。", effects: { stats: { stress: 10, trust: -15, shelter: 4 }, flagsSet: { betrayedCivilians: true } } }
        ]
      },
      {
        id: "core_009_longyang_signal",
        weight: 8,
        once: true,
        minDay: 18,
        maxDay: 60,
        category: "长期求生",
        requiresAnyFlags: ["hasRadio", "metroCodeKnown"],
        title: "龙阳路撤离编码",
        body: "你在龙阳路收到重复编码，疑似跨江撤离窗口。是否公开，将直接改变几百人的走向。",
        location: "龙阳路",
        roads: ["龙阳路", "世纪大道"],
        choices: [
          { label: "公开编码并组织分批撤离", result: "道路拥堵但秩序仍在，许多人记住了你的坚持。", effects: { stats: { trust: 15, stamina: -10, stress: 8, supplies: -8 }, flagsSet: { evacSignalKnown: true, pledgedNoAbandon: true } } },
          { label: "只通知核心成员", result: "你保住自己人，却背上了“抛弃他人”的标签。", effects: { stats: { supplies: 10, trust: -12, stress: -2 }, flagsSet: { evacSignalKnown: true, betrayedCivilians: true } } },
          { label: "验证两天再行动", result: "编码被证实有效，但窗口只剩一次。", effects: { stats: { stress: 4, stamina: -4, trust: 2 }, flagsSet: { evacSignalKnown: true } } },
          { label: "放弃撤离，改押长期固守", result: "你将希望完全押在社区化生存。", effects: { stats: { shelter: 10, stress: -3, trust: -2 }, flagsSet: { hasCommunity: true } } }
        ]
      },
      {
        id: "core_010_day30_milestone",
        weight: 7,
        once: true,
        minDay: 30,
        maxDay: 95,
        category: "长期求生",
        title: "第30天节点",
        body: "你活过了30天。中山公园临时会提议“社区化”与“机动化”双路线重组。",
        location: "中山公园",
        roads: ["中山公园环路", "内环高架路"],
        choices: [
          { label: "升级社区化，建立教育与轮班", result: "秩序感增强，长期韧性提升。", effects: { stats: { shelter: 16, trust: 10, supplies: -10, stress: -4 }, flagsSet: { hasCommunity: true } } },
          { label: "维持机动化，降低团灭风险", result: "弹性更强，但纽带变薄。", effects: { stats: { stamina: 8, trust: -6, shelter: -4, stress: 2 } } },
          { label: "双轨并行，社区+机动", result: "执行复杂但整体更平衡。", effects: { stats: { shelter: 8, trust: 6, stamina: -2, stress: 1 } } },
          { label: "清算旧账，排除异见", result: "纪律提高，长期裂痕加深。", effects: { stats: { shelter: 6, trust: -12, stress: 6 }, flagsSet: { betrayedCivilians: true } } }
        ]
      }
    ];
  }

  function makeNpcChainEvents() {
    const events = [];
    npcDefs.forEach((npc, idx) => {
      const baseDay = 8 + idx * 2;
      const altNpc = npcDefs[(idx + 1) % npcDefs.length];

      events.push({
        id: `npc_${npc.id}_02`,
        weight: 8,
        once: true,
        minDay: baseDay,
        maxDay: baseDay + 10,
        category: "组织重构",
        npcId: npc.id,
        requiresFlagsAll: [`npc_${npc.id}_met`],
        title: `${npc.name}的协同提案`,
        body: `${npc.name}（${npc.role}）提出一项跨区协同方案，要求你牵头调度并承担争议。`,
        location: districts[idx % districts.length].name,
        roads: districts[idx % districts.length].roads.slice(0, 2),
        choices: [
          { label: "接下提案并公开流程", result: "协同效率提升，但你承担了更多责任。", effects: { stats: { trust: 8, stress: 4, stamina: -5 }, npc: { [npc.id]: 8 }, flagsSet: { [`npc_${npc.id}_support`]: true }, queue: [`npc_${npc.id}_03`] } },
          { label: "有限支持，只给资源不给授权", result: "方案勉强推进，双方都保留戒心。", effects: { stats: { trust: 2, stress: 1, supplies: -3 }, npc: { [npc.id]: 2 }, flagsSet: { [`npc_${npc.id}_neutral`]: true }, queue: [`npc_${npc.id}_03`] } },
          { label: "公开反对，质疑其动机", result: "你保住控制权，也埋下后续冲突。", effects: { stats: { trust: -7, stress: 3 }, npc: { [npc.id]: -10 }, flagsSet: { [`npc_${npc.id}_betrayed_once`]: true, betrayedCivilians: true }, queue: [`npc_${npc.id}_04`] } },
          { label: `转而支持${altNpc.name}的平行方案`, result: "新联盟形成，旧关系迅速降温。", effects: { stats: { trust: -2, stress: 2 }, npc: { [npc.id]: -6, [altNpc.id]: 5 }, flagsSet: { [`npc_${npc.id}_sidestepped`]: true }, queue: [`npc_${npc.id}_03`] } }
        ]
      });

      events.push({
        id: `npc_${npc.id}_03`,
        weight: 7,
        once: true,
        minDay: baseDay + 4,
        maxDay: baseDay + 16,
        category: "高压消耗",
        npcId: npc.id,
        requiresAnyFlags: [`npc_${npc.id}_support`, `npc_${npc.id}_neutral`, `npc_${npc.id}_sidestepped`],
        title: `${npc.name}的夜间请求`,
        body: `${npc.name}请求你在${districts[(idx + 1) % districts.length].mark}附近执行高风险夜间任务。`,
        location: districts[(idx + 1) % districts.length].name,
        roads: districts[(idx + 1) % districts.length].roads.slice(1),
        choices: [
          { label: "亲自带队执行", result: "任务完成，关系明显升温。", effects: { stats: { supplies: 6, stamina: -9, stress: 4 }, npc: { [npc.id]: 9 }, flagsSet: { [`npc_${npc.id}_bonded`]: true }, queue: [`npc_${npc.id}_05`] } },
          { label: "派副队执行并远程协同", result: "结果一般，双方继续观望。", effects: { stats: { supplies: 3, stamina: -4, stress: 2 }, npc: { [npc.id]: 2 }, queue: [`npc_${npc.id}_05`] } },
          { label: "拒绝任务，优先保全据点", result: "你保住体力，但对方判断你不可靠。", effects: { stats: { shelter: 4, trust: -4, stress: -1 }, npc: { [npc.id]: -8 }, flagsSet: { [`npc_${npc.id}_cold`]: true }, queue: [`npc_${npc.id}_04`] } },
          { label: "利用任务交换额外筹码", result: "你拿到额外物资，也被视作精于算计。", effects: { stats: { supplies: 8, trust: -5, stress: 3 }, npc: { [npc.id]: -4 }, flagsSet: { betrayedCivilians: true }, queue: [`npc_${npc.id}_05`] } }
        ]
      });

      events.push({
        id: `npc_${npc.id}_04`,
        weight: 6,
        once: true,
        minDay: baseDay + 8,
        maxDay: baseDay + 25,
        category: "高压消耗",
        npcId: npc.id,
        requiresAnyFlags: [`npc_${npc.id}_betrayed_once`, `npc_${npc.id}_cold`],
        title: `${npc.name}的反制动作`,
        body: `${npc.name}切断了你在${districts[(idx + 2) % districts.length].name}的一条补给通道，要求你给出立场。`,
        location: districts[(idx + 2) % districts.length].name,
        roads: districts[(idx + 2) % districts.length].roads.slice(0, 2),
        choices: [
          { label: "公开道歉并恢复协作", result: "双方暂时停火，损失可控。", effects: { stats: { trust: 5, supplies: -4, stress: 3 }, npc: { [npc.id]: 7 }, flagsClear: [`npc_${npc.id}_betrayed_once`], queue: [`npc_${npc.id}_05`] } },
          { label: "以强硬姿态对抗到底", result: "你守住了面子，代价是长期对立。", effects: { stats: { shelter: 3, trust: -10, stress: 6 }, npc: { [npc.id]: -12 }, flagsSet: { [`npc_${npc.id}_enemy`]: true, betrayedCivilians: true } } },
          { label: "让中立据点调停", result: "关系未修复，但冲突降级。", effects: { stats: { trust: 2, stress: 1 }, npc: { [npc.id]: 3 } } },
          { label: "切断其后勤作为报复", result: "你赢下一次博弈，却失去更多潜在盟友。", effects: { stats: { supplies: 5, trust: -11, stress: 5 }, npc: { [npc.id]: -10 }, flagsSet: { [`npc_${npc.id}_enemy`]: true, betrayedCivilians: true } } }
        ]
      });

      events.push({
        id: `npc_${npc.id}_05`,
        weight: 7,
        once: true,
        minDay: baseDay + 14,
        maxDay: baseDay + 36,
        category: "长期求生",
        npcId: npc.id,
        requiresAnyFlags: [`npc_${npc.id}_bonded`, `npc_${npc.id}_support`, `npc_${npc.id}_enemy`],
        title: `${npc.name}的最终站队`,
        body: `在${districts[(idx + 3) % districts.length].mark}的联席会上，${npc.name}要求你给出长期站队承诺。`,
        location: districts[(idx + 3) % districts.length].name,
        roads: districts[(idx + 3) % districts.length].roads.slice(1),
        choices: [
          { label: "签署互保协定", result: "你们形成稳定联盟，后续协同成本显著下降。", effects: { stats: { trust: 12, shelter: 8, supplies: -6 }, npc: { [npc.id]: 12 }, flagsSet: { [`npc_${npc.id}_allied`]: true } } },
          { label: "维持松散合作", result: "合作继续，但双方保留退路。", effects: { stats: { trust: 4, stress: -1 }, npc: { [npc.id]: 4 } } },
          { label: "拒绝绑定，保持独立", result: "机动性提升，联盟资源减少。", effects: { stats: { stamina: 5, trust: -5, shelter: -2 }, npc: { [npc.id]: -5 } } },
          { label: "倒向对立阵营换资源", result: "你得到短期资源，但关系链几乎不可逆。", effects: { stats: { supplies: 10, trust: -12, stress: 4 }, npc: { [npc.id]: -14, [altNpc.id]: -3 }, flagsSet: { betrayedCivilians: true, [`npc_${npc.id}_enemy`]: true } } }
        ]
      });
    });

    return events;
  }

  function makeDistrictEvents() {
    const events = [];
    let serial = 1;
    districts.forEach((d, idx) => {
      for (let phase = 0; phase < 3; phase += 1) {
        const minDay = 6 + idx * 2 + phase * 8;
        const maxDay = minDay + 26;
        const npc = npcDefs[(idx + phase) % npcDefs.length];
        events.push({
          id: `city_${String(serial).padStart(3, "0")}`,
          weight: 6,
          once: true,
          minDay,
          maxDay,
          category: phase === 0 ? "封锁裂解" : phase === 1 ? "高压消耗" : "长期求生",
          npcId: npc.id,
          title: `${d.name}${phase === 0 ? "补给争执" : phase === 1 ? "夜间守线" : "重构议案"}`,
          body: `${d.mark}周边在${d.roads[phase]}与${d.roads[(phase + 1) % d.roads.length]}出现连锁波动，${npc.name}请求你作出四选一决策。`,
          location: d.name,
          roads: [d.roads[phase], d.roads[(phase + 1) % d.roads.length]],
          choices: [
            { label: "公开流程并接受监督", result: "决策成本提高，但整体信任走高。", effects: { stats: { trust: 7, stress: 2, stamina: -4 }, npc: { [npc.id]: 5 } } },
            { label: "效率优先，快速执行", result: "执行很快，争议也很快出现。", effects: { stats: { supplies: 6, stress: 4, trust: -3 }, npc: { [npc.id]: -2 } } },
            { label: "以据点安全为先，降低外部投入", result: "本地稳定，跨区协同下降。", effects: { stats: { shelter: 6, trust: -4, stress: -1 }, npc: { [npc.id]: -3 } } },
            { label: "冒险押注高回报方案", result: "你拿到额外资源，但后患明显增多。", effects: { stats: { supplies: 9, stamina: -6, stress: 5, trust: -5 }, npc: { [npc.id]: -5 }, flagsSet: { betrayedCivilians: true } } }
          ]
        });
        serial += 1;
      }
    });

    return events;
  }

  function makeTemplateEvents() {
    return [
      {
        id: "t_supply_run",
        title: "{district}补给窗口",
        body: "{road}附近出现短时补给窗口。人群与低吼同时逼近，你必须在十分钟内做出策略。",
        category: "高压消耗",
        choices: [
          { label: "快进快出，限定7分钟撤离", result: "你拿到补给并完整撤离，但体能消耗极大。", effects: { stats: { supplies: 9, stamina: -8, stress: 3 } } },
          { label: "稳步推进，边搜边封门", result: "效率一般但风险可控。", effects: { stats: { supplies: 5, stamina: -4, stress: -1, shelter: 2 } } },
          { label: "护送伤员优先撤离", result: "你错过补给，却保住了人命与口碑。", effects: { stats: { trust: 8, supplies: -3, stress: 1 } } },
          { label: "诱饵转移后单点突破", result: "收获最大，也被更多人警惕。", effects: { stats: { supplies: 12, trust: -8, stress: 4 }, flagsSet: { betrayedCivilians: true } } }
        ]
      },
      {
        id: "t_night_defense",
        title: "{landmark}夜间守线",
        body: "夜色下{road}出现多点冲击。守线方式将直接决定明天片区秩序。",
        category: "长期求生",
        choices: [
          { label: "全员轮班硬守到天亮", result: "你们守住了，但几乎透支。", effects: { stats: { shelter: 8, trust: 7, stamina: -10, stress: 6 } } },
          { label: "半数守线半数休整", result: "防线后撤一层，核心区维持运转。", effects: { stats: { shelter: 4, stamina: -4, stress: 2, trust: 2 } } },
          { label: "诱导冲击转向空置街区", result: "当晚风险下降，后续清理成本上升。", effects: { stats: { stress: -2, supplies: -5, trust: -2, shelter: 3 } } },
          { label: "撤线转流动避险", result: "人活下来了，地盘失去了。", effects: { stats: { stamina: 5, shelter: -8, trust: -6, stress: 3 } } }
        ]
      },
      {
        id: "t_relation_flash",
        title: "{district}联席裂痕",
        body: "{landmark}联席会临时加开，既有联盟在细节执行上出现裂痕。",
        category: "组织重构",
        choices: [
          { label: "公开复盘并接受质询", result: "争论激烈，但结果更透明。", effects: { stats: { trust: 7, stress: 3 } } },
          { label: "闭门决策后直接执行", result: "推进速度快，外界质疑变多。", effects: { stats: { supplies: 4, trust: -5, stress: 2 } } },
          { label: "暂缓决策，换取缓冲时间", result: "压力降低，但窗口可能流失。", effects: { stats: { stress: -3, trust: -1, stamina: 2 } } },
          { label: "借机清洗异议者", result: "秩序短期统一，长期反弹加剧。", effects: { stats: { shelter: 4, trust: -9, stress: 5 }, flagsSet: { betrayedCivilians: true } } }
        ]
      }
    ];
  }

  const coreEvents = makeCoreEvents();
  const npcChainEvents = makeNpcChainEvents();
  const districtEvents = makeDistrictEvents();

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
    npcDefs,
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
        supplies: 48,
        stamina: 70,
        stress: 28,
        trust: 35,
        shelter: 24
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
    districts: districts.map(d => d.name),
    roads: Array.from(new Set(districts.flatMap(d => d.roads))),
    landmarks: districts.map(d => d.mark),
    endings: [
      {
        id: "end_overrun",
        priority: 99,
        title: "结局：城区沦陷",
        text: "你撑到了最后一班哨，却没撑过最后一次破门。魔都夜色没有回答任何人的求救。",
        condition: { any: [{ stats: { health: { lte: 0 } } }, { stats: { infection: { gte: 100 } } }] }
      },
      {
        id: "end_exhausted",
        priority: 90,
        title: "结局：体能崩断",
        text: "连续奔跑和饥饿让你在下一条路线前倒下。",
        condition: { all: [{ stats: { stamina: { lte: 0 } } }, { dayGte: 12 }] }
      },
      {
        id: "end_social_collapse",
        priority: 86,
        title: "结局：联盟断裂",
        text: "当所有人都不再信任你时，任何地图都等于废纸。",
        condition: { all: [{ stats: { trust: { lte: 4 } } }, { dayGte: 16 }] }
      },
      {
        id: "end_starvation",
        priority: 82,
        title: "结局：慢性耗尽",
        text: "你没有死于一次冲击，而是死于长期补给枯竭。",
        condition: { all: [{ stats: { supplies: { lte: 0 } } }, { stats: { hunger: { gte: 92 } } }, { dayGte: 18 }] }
      }
    ],
    events: [...coreEvents, ...npcChainEvents, ...districtEvents],
    templateEvents: makeTemplateEvents()
  };
})();
