(function () {
  const npcDefs = [
    { id: "lin_shuang", name: "林霜", role: "17层夜班总编", initial: 54 },
    { id: "gu_xing", name: "顾行", role: "楼宇夜巡协管", initial: 49 },
    { id: "tang_miao", name: "唐渺", role: "19层播客主持人", initial: 52 },
    { id: "he_yun", name: "何筠", role: "临时医护志愿者", initial: 51 },
    { id: "zhou_qi", name: "周启", role: "机房与配电维护员", initial: 47 },
    { id: "mo_yan", name: "莫言", role: "楼内跑腿实习生", initial: 50 }
  ];

  const zones = [
    { key: "floor17", name: "17层开放办公区", roads: ["东侧消防梯", "复印机走廊", "玻璃门厅"], mark: "17层主工位岛" },
    { key: "studio19", name: "19层录音棚", roads: ["混音间通道", "隔音走廊", "A棚门口"], mark: "19层主控室" },
    { key: "b2_power", name: "B2配电层", roads: ["维修坡道", "柴油机房", "管线夹层"], mark: "备用发电间" },
    { key: "skybridge", name: "空中连桥", roads: ["连桥南段", "观景玻璃廊", "广告灯箱旁"], mark: "风压观察点" },
    { key: "archive", name: "档案夹层", roads: ["旧服务器间", "纸档通道", "封箱储物间"], mark: "磁带档案库" },
    { key: "rooftop", name: "天台雨棚", roads: ["北侧雨棚", "排风井旁", "塔台底座"], mark: "临时信标架" }
  ];

  function makeCoreEvents() {
    return [
      {
        id: "core_001_blackout_minute",
        weight: 16,
        once: true,
        minDay: 1,
        maxDay: 2,
        category: "崩溃初期",
        npcId: "lin_shuang",
        title: "17层熄灯后的第一分钟",
        body: "灯在三次闪烁后全部熄灭。门禁失灵，楼外的雾像有人拿着黑布往玻璃上压。哭声先从消防梯传来，然后是手机同时失去信号的提示音。17层的人还没来得及商量，谁先被照顾、谁被挡在门外，已经要由你来定。",
        location: "17层开放办公区",
        roads: ["东侧消防梯", "玻璃门厅"],
        choices: [
          {
            label: "先拉下玻璃门和消防门，把17层变成可守空间",
            result: "你不是先找答案，而是先给这层楼划出一条还算像边界的线。",
            risk: 34,
            effects: {
              stats: { shelter: 10, trust: 7, stamina: -4, stress: 2 },
              modules: { defense: 8, water: -2 },
              npc: { lin_shuang: 6, gu_xing: 4 },
              flagsSet: { securedFloor17: true, hasCommunity: true, npc_lin_shuang_met: true, npc_gu_xing_met: true },
              decisionTagsAdd: ["first_lockdown"],
              debtsAdd: [{ id: "debt_shift_roster", title: "你答应今晚后排出17层轮班表", dueDay: 3, severity: "medium", note: "不兑现会迅速失控" }],
              memoriesAdd: { lin_shuang: ["记得你先把17层变成了能守的空间"] },
              queue: ["core_002_stairwell_keys"]
            }
          },
          {
            label: "冲去茶水间和零食柜，先把最容易拿的库存背回来",
            result: "你抱回来的不是安全，只是今晚还能分的筹码。",
            risk: 48,
            effects: {
              stats: { supplies: 12, trust: -4, stress: 4, stamina: -3 },
              modules: { water: 6, medical: 3, defense: -2 },
              flagsSet: { npc_lin_shuang_met: true },
              delayedConsequences: [{ id: "cons_stock_before_people", dueDay: 2, text: "你先抢库存的事被17层记住了，受伤的人开始追问为什么药比人先被带回来。", payload: { stats: { trust: -4, stress: 3 }, modules: { medical: -3 } } }]
            }
          },
          {
            label: "顺着哭声去消防梯，把散开的同事一个个带回来",
            result: "走廊里第一次有人喊你的名字，不是求助，是确认自己还没被落下。",
            risk: 40,
            effects: {
              stats: { trust: 10, stamina: -6, stress: 2, shelter: 4 },
              modules: { defense: 3, water: -1 },
              npc: { lin_shuang: 5, mo_yan: 3 },
              flagsSet: { securedFloor17: true, hasCommunity: true, promisedNoOneLeft: true, npc_lin_shuang_met: true, npc_mo_yan_met: true },
              decisionTagsAdd: ["first_rescue"],
              debtsAdd: [{ id: "debt_open_door", title: "你承诺给没赶回的人留回楼窗口", dueDay: 2, severity: "high", note: "失约会重伤互信" }],
              delayedConsequences: [{ id: "cons_open_door_window", dueDay: 2, text: "更多人开始在夜里敲门，17层必须兑现你留出的回楼窗口。", payload: { stats: { stress: 4, threat: 3 }, modules: { defense: -3 } } }],
              queue: ["core_002_stairwell_keys"]
            }
          },
          {
            label: "躲进会议室，等楼下恢复供电再说",
            result: "会议室的长桌很稳，但它并没有比外面的黑更可靠。",
            risk: 24,
            effects: {
              stats: { stress: -4, trust: -8, shelter: 3 },
              modules: { defense: -2, intel: -2 },
              flagsSet: { quietCode: true },
              delayedConsequences: [{ id: "cons_hide_in_meeting_room", dueDay: 2, text: "因为第一分钟没人拍板，17层的人开始私自占位、藏水和抢充电口。", payload: { stats: { trust: -5, stress: 5 }, modules: { water: -2, power: -2 } } }]
            }
          }
        ]
      },
      {
        id: "core_002_stairwell_keys",
        weight: 14,
        once: true,
        minDay: 1,
        maxDay: 3,
        category: "封锁裂解",
        npcId: "gu_xing",
        requiresAnyFlags: ["securedFloor17", "first_lockdown"],
        title: "消防梯钥匙到底归谁",
        body: "顾行把最后一串还能开的机械钥匙拍在桌上。17层的人盯着门，楼下的人在拍门。没有人相信‘先等等’能解决任何事，而你之前做的第一步决定，现在已经开始要利息。",
        location: "17层开放办公区",
        roads: ["东侧消防梯", "复印机走廊"],
        choices: [
          {
            label: "让顾行接管门禁，今晚开始宵禁",
            result: "一层楼第一次听见了统一口令，但空气也立刻绷紧。",
            risk: 44,
            effects: {
              stats: { shelter: 11, trust: -3, stamina: -1, stress: 2 },
              modules: { defense: 9, intel: -2 },
              npc: { gu_xing: 8, lin_shuang: -2 },
              flagsSet: { sealedLevels: true, quietCode: true, securedFloor17: true, npc_gu_xing_met: true },
              decisionTagsAdd: ["iron_protocol"],
              debtsClear: ["debt_open_door", "debt_shift_roster"],
              memoriesAdd: { gu_xing: ["记得你最终把钥匙交给了秩序"] }
            }
          },
          {
            label: "钥匙不交给任何人，名单公开、轮班共管",
            result: "大家都累，但至少谁进谁出不再是一个人的秘密。",
            risk: 32,
            effects: {
              stats: { trust: 9, shelter: 6, stress: -1 },
              modules: { defense: 4, water: -2, intel: 2 },
              npc: { gu_xing: -2, lin_shuang: 6 },
              flagsSet: { hasCommunity: true, securedFloor17: true, npc_gu_xing_met: true },
              decisionTagsAdd: ["aid_protocol"],
              debtsClear: ["debt_shift_roster"],
              debtsAdd: [{ id: "debt_food_board", title: "你承诺公开17层食物与床位分配板", dueDay: 4, severity: "medium", note: "失约会直接打脸这套共管规则" }],
              memoriesAdd: { lin_shuang: ["记得你愿意把钥匙和规则公开"] }
            }
          },
          {
            label: "拆消防箱做临时封门，不立新规",
            result: "你拿材料换来几个小时缓冲，但问题被钉在木板后面，并没有消失。",
            risk: 39,
            effects: {
              stats: { shelter: 8, supplies: -3, stress: 2 },
              modules: { defense: 7, power: -1 },
              npc: { gu_xing: 2 },
              flagsSet: { securedFloor17: true, npc_gu_xing_met: true },
              debtsAdd: [{ id: "debt_temp_barricade", title: "临时封门两小时后必须给出正式规则", dueDay: 3, severity: "high", note: "否则堵门会变成冲门" }]
            }
          },
          {
            label: "给没赶回的人留一个回楼窗口",
            result: "这会让夜里更难守，但也让17层还像是给活人留门的地方。",
            risk: 51,
            effects: {
              stats: { trust: 6, shelter: -4, stress: 5 },
              modules: { defense: -3, water: -1 },
              npc: { gu_xing: -7, lin_shuang: 4 },
              flagsSet: { promisedNoOneLeft: true, securedFloor17: true, hasCommunity: true, npc_gu_xing_met: true },
              decisionTagsAdd: ["open_window"],
              debtsClear: ["debt_open_door"],
              debtsAdd: [{ id: "debt_return_window", title: "夜里回楼窗口必须有人守到底", dueDay: 2, severity: "high", note: "守不住就会变成灾难" }],
              delayedConsequences: [{ id: "cons_return_window", dueDay: 3, text: "因为回楼窗口被更多人知道，17层守夜负担骤增，所有人都开始问这值不值。", payload: { stats: { stress: 4, trust: -2 }, modules: { defense: -4, water: -1 } } }]
            }
          }
        ]
      },
      {
        id: "core_003_studio_whisper",
        weight: 13,
        once: true,
        minDay: 2,
        maxDay: 5,
        category: "组织重构",
        npcId: "tang_miao",
        title: "19层录音棚还有声音",
        body: "唐渺在失效的提词器边等你。她说整栋楼最安静的地方不是会议室，是录音棚。那里还能接到一条断断续续的窄频，但每多亮一分钟设备，就多一分把17层暴露出去的可能。",
        location: "19层录音棚",
        roads: ["隔音走廊", "A棚门口"],
        choices: [
          {
            label: "帮她重启监听台，先把别人没听到的消息听全",
            result: "耳机里全是噪点，但你还是从里面抠出了几句不该存在的指令。",
            risk: 36,
            effects: {
              stats: { trust: 5, stamina: -5, stress: 2 },
              modules: { intel: 10, power: -2 },
              npc: { tang_miao: 8 },
              flagsSet: { hasRadio: true, npc_tang_miao_met: true },
              decisionTagsAdd: ["signal_protocol"],
              debtsAdd: [{ id: "debt_radio_watch", title: "你答应继续守录音棚夜班", dueDay: 5, severity: "medium", note: "失约会断掉频段线" }],
              memoriesAdd: { tang_miao: ["记得你愿意把体力押给监听台"] },
              queue: ["npc_tang_miao_midnight"]
            }
          },
          {
            label: "只拿走对讲机和电池，不暴露17层位置",
            result: "你得到了设备，也得到了唐渺看你的那个保留一半的眼神。",
            risk: 28,
            effects: {
              stats: { supplies: 4, trust: -3, stress: -1 },
              modules: { intel: 5, power: -1 },
              npc: { tang_miao: -2 },
              flagsSet: { hasRadio: true, npc_tang_miao_met: true },
              delayedConsequences: [{ id: "cons_half_shared_signal", dueDay: 4, text: "因为你没把频段内容讲全，楼里开始怀疑你在私藏情报。", payload: { stats: { trust: -4, stress: 2 }, modules: { intel: -2 } } }]
            }
          },
          {
            label: "用录音棚广播安抚楼里的人，先让恐慌降下来",
            result: "每一层都静了几秒。有人开始哭，有人开始排队，有人终于肯把门打开。",
            risk: 42,
            effects: {
              stats: { trust: 11, stress: 3, shelter: 4 },
              modules: { intel: 7, power: -1 },
              npc: { tang_miao: 9, lin_shuang: 3 },
              flagsSet: { hasRadio: true, openedRefugeFloor: true, hasCommunity: true, npc_tang_miao_met: true },
              decisionTagsAdd: ["public_voice"],
              debtsAdd: [{ id: "debt_public_voice", title: "既然用广播安抚了全楼，你就得继续给出解释", dueDay: 4, severity: "medium", note: "沉默会比没广播更糟" }]
            }
          },
          {
            label: "拆掉会发声的设备，避免声音把雾里的东西引上来",
            result: "楼里安静了，但也失去了一个原本可能属于你们的主动权。",
            risk: 30,
            effects: {
              stats: { shelter: 4, trust: -6, stress: -2 },
              modules: { intel: -8, defense: 2 },
              npc: { tang_miao: -8 },
              flagsSet: { quietCode: true, npc_tang_miao_met: true },
              memoriesAdd: { tang_miao: ["记得你亲手掐掉了本来能说话的设备"] }
            }
          }
        ]
      },
      {
        id: "core_004_medbay_triage",
        weight: 12,
        once: true,
        minDay: 3,
        maxDay: 6,
        category: "封锁裂解",
        npcId: "he_yun",
        title: "临时医务点的分诊纸条",
        body: "何筠把每个人的伤口和体温写在便利贴上，一张张贴满了会议室白板。药不够，人也不够，只有你们的顺序会决定谁能熬过今晚。所有人都盯着你的手，想知道你把谁排在前面。",
        location: "17层开放办公区",
        roads: ["复印机走廊", "玻璃门厅"],
        choices: [
          {
            label: "跟何筠一起做分诊，把最重的人先稳住",
            result: "你们用最普通的东西拼出了一个还像样的医务点。",
            risk: 38,
            effects: {
              stats: { infection: -8, trust: 9, stamina: -7, stress: 2 },
              modules: { medical: 10, water: -2 },
              npc: { he_yun: 10 },
              flagsSet: { hasClinicRoute: true, hasCommunity: true, npc_he_yun_met: true },
              decisionTagsAdd: ["triage_first"],
              debtsClear: ["debt_lobby_wounded", "debt_unchecked_wound"],
              memoriesAdd: { he_yun: ["记得你把最重的伤先往前排"] }
            }
          },
          {
            label: "先把药包留给17层自己人",
            result: "你换来的是短期安全感，和被记住的那种偏心。",
            risk: 35,
            effects: {
              stats: { supplies: 8, trust: -7, stress: 3 },
              modules: { medical: 6, intel: -2 },
              npc: { he_yun: -9 },
              flagsSet: { hasClinicRoute: true, betrayedCivilians: true, npc_he_yun_met: true },
              delayedConsequences: [{ id: "cons_triage_bias", dueDay: 5, text: "你偏袒自己人的分诊顺序传开了，之后每次医务决定都会被盯得更紧。", payload: { stats: { trust: -4, stress: 3 }, modules: { medical: -3, intel: -2 } } }]
            }
          },
          {
            label: "把一间会议室改成长期医务点",
            result: "床位少了，但人终于有了一个会被照顾的地方。",
            risk: 33,
            effects: {
              stats: { shelter: 8, supplies: -4, trust: 5, stress: 1 },
              modules: { medical: 8, defense: -1 },
              npc: { he_yun: 6 },
              flagsSet: { hasClinicRoute: true, hasCommunity: true, openedRefugeFloor: true, npc_he_yun_met: true }
            }
          },
          {
            label: "避开伤口和病号，先处理门禁和库存",
            result: "你把看得见的麻烦处理掉了，身体里的账却会在后面追上来。",
            risk: 26,
            effects: {
              stats: { stress: -2, infection: 4, trust: -3, shelter: 3 },
              modules: { medical: -4, defense: 2 },
              npc: { he_yun: -4 },
              flagsSet: { npc_he_yun_met: true },
              debtsAdd: [{ id: "debt_wounds_unchecked", title: "17层还有没被正规处理的伤口", dueDay: 4, severity: "high", note: "再拖就不是一两片药能补回来的" }]
            }
          }
        ]
      },
      {
        id: "core_005_bridge_scout",
        weight: 12,
        once: true,
        minDay: 4,
        maxDay: 8,
        category: "高压消耗",
        npcId: "mo_yan",
        title: "空中连桥的第一次试探",
        body: "莫言说对面楼还亮过一次应急灯。连桥外侧全是风，玻璃内侧全是脚印。你们只要踏出去，就再也不能假装自己只有楼内问题。桥这边要的是补给，那边要的可能是你给出的承诺。",
        location: "空中连桥",
        roads: ["连桥南段", "观景玻璃廊"],
        choices: [
          {
            label: "你亲自带莫言摸桥，确认对面有没有活路",
            result: "风把话吹碎了，但路线和时机终于被你们摸出来了。",
            risk: 56,
            effects: {
              stats: { stamina: -8, trust: 5, stress: 4 },
              modules: { intel: 7, defense: -2 },
              npc: { mo_yan: 9 },
              flagsSet: { bridgeMapped: true, escapePlanKnown: true, npc_mo_yan_met: true },
              decisionTagsAdd: ["bridge_first"],
              debtsAdd: [{ id: "debt_bridge_route", title: "既然摸出了桥路，就得决定什么时候真正带人过去", dueDay: 6, severity: "medium", note: "继续拖只会让窗口消失" }],
              memoriesAdd: { mo_yan: ["记得你亲自迈上了连桥第一段"] }
            }
          },
          {
            label: "让莫言先去，你在这边盯回传和绳扣",
            result: "你把风险推给了更快的人，也接受了自己不是第一个迈出去的人。",
            risk: 47,
            effects: {
              stats: { stress: 2, trust: -2, stamina: -2 },
              modules: { intel: 5 },
              npc: { mo_yan: 2 },
              flagsSet: { bridgeMapped: true, npc_mo_yan_met: true },
              delayedConsequences: [{ id: "cons_runner_sent_first", dueDay: 5, text: "莫言把你没先迈出去的事记在心里，其他人也开始重新估量你会不会让别人替你冒险。", payload: { stats: { trust: -3, stress: 2 }, modules: { intel: -1 } } }]
            }
          },
          {
            label: "只在玻璃内侧观察，不真正过桥",
            result: "你得到了一张不完整的地图，足够犹豫，不够决断。",
            risk: 24,
            effects: {
              stats: { supplies: 2, trust: -3, stress: -1 },
              modules: { intel: 3 },
              npc: { mo_yan: -4 },
              flagsSet: { escapePlanKnown: true, npc_mo_yan_met: true }
            }
          },
          {
            label: "关掉连桥灯箱，先让这栋楼更难被看见",
            result: "你选了隐身而不是探索。它很稳，也很像退回壳里。",
            risk: 29,
            effects: {
              stats: { shelter: 6, trust: -5, stress: 1 },
              modules: { defense: 5, intel: -4 },
              npc: { mo_yan: -6, gu_xing: 3 },
              flagsSet: { sealedLevels: true, quietCode: true, npc_mo_yan_met: true }
            }
          }
        ]
      },
      {
        id: "core_006_generator_bargain",
        weight: 11,
        once: true,
        minDay: 5,
        maxDay: 10,
        category: "组织重构",
        npcId: "zhou_qi",
        title: "B2 发电机还能撑几夜",
        body: "周启把一把沾油的扳手递给你。他说发电机不是‘能不能修’，而是‘修好了给谁用’。灯一亮，争夺也会跟着亮起来，而每一盏亮起来的灯背后都要烧掉你们本来就不多的柴油。",
        location: "B2配电层",
        roads: ["维修坡道", "柴油机房"],
        choices: [
          {
            label: "给周启人手和柴油，恢复整栋楼的基础供电",
            result: "你点亮的不只是线路，还有更多必须兑现的承诺。",
            risk: 41,
            effects: {
              stats: { shelter: 10, supplies: -8, stamina: -4, trust: 4 },
              modules: { power: 12, medical: 2, intel: 3 },
              npc: { zhou_qi: 8 },
              flagsSet: { generatorOnline: true, npc_zhou_qi_met: true },
              decisionTagsAdd: ["power_for_all"],
              debtsAdd: [{ id: "debt_generator_fuel", title: "你承诺把柴油优先留给公用供电", dueDay: 7, severity: "medium", note: "一旦跳票，所有亮灯的人都会记得" }]
            }
          },
          {
            label: "只恢复17层和19层的关键回路",
            result: "你们稳住了核心层，但楼里人很快就会察觉灯为什么只亮到这里。",
            risk: 31,
            effects: {
              stats: { shelter: 6, stress: -1, supplies: -4 },
              modules: { power: 8, intel: 4 },
              npc: { zhou_qi: 3, lin_shuang: -1 },
              flagsSet: { generatorOnline: true, quietCode: true, npc_zhou_qi_met: true },
              delayedConsequences: [{ id: "cons_power_only_core", dueDay: 7, text: "楼里很快发现灯只亮到核心层，‘谁被算作核心’开始变成新的冲突。", payload: { stats: { trust: -5, stress: 4 }, modules: { defense: -2, power: -2 } } }]
            }
          },
          {
            label: "把发电机优先权换成你自己的物资和名单优先",
            result: "周启答应得很快，因为他知道这种债以后一定要翻倍还。",
            risk: 37,
            effects: {
              stats: { supplies: 6, trust: -8, stress: 2 },
              modules: { power: 7, intel: -2 },
              npc: { zhou_qi: -6 },
              flagsSet: { generatorOnline: true, liedToGroup: true, npc_zhou_qi_met: true },
              delayedConsequences: [{ id: "cons_private_power_deal", dueDay: 6, text: "发电机优先权交易的风声漏出去了，大家开始怀疑你是不是把公共资源换成了私人名单。", payload: { stats: { trust: -6, stress: 3 }, modules: { intel: -3 } } }]
            }
          },
          {
            label: "放弃地下层，把体力留给上层门禁",
            result: "你省下了人手，也放弃了几乎所有之后的主动权。",
            risk: 22,
            effects: {
              stats: { stress: 4, shelter: -6, trust: -2 },
              modules: { power: -6, defense: 2 },
              npc: { zhou_qi: -5 },
              flagsSet: { npc_zhou_qi_met: true }
            }
          }
        ]
      },
      {
        id: "core_007_refugee_knock",
        weight: 10,
        once: true,
        minDay: 8,
        maxDay: 13,
        category: "高压消耗",
        npcId: "lin_shuang",
        requiresAnyFlags: ["securedFloor17", "hasRadio", "generatorOnline"],
        title: "22层来敲门的人",
        body: "门外不是尸潮，是人。有人抱着孩子，有人拖着箱子，还有人说自己知道楼外第一个真正能走的窗口。所有人都在等你决定门是向里还是向外开。",
        location: "17层开放办公区",
        roads: ["玻璃门厅", "东侧消防梯"],
        choices: [
          {
            label: "开放一层作为收容层，按名单分床和配给",
            result: "楼里立刻更挤了，但也第一次有了像制度一样的东西。",
            risk: 45,
            effects: {
              stats: { trust: 12, supplies: -8, stress: 3, shelter: 2 },
              npc: { lin_shuang: 10, he_yun: 4 },
              flagsSet: { openedRefugeFloor: true, hasCommunity: true, promisedNoOneLeft: true, npc_lin_shuang_met: true },
              decisionTagsAdd: ["refuge_floor"]
            }
          },
          {
            label: "只收儿童和伤者，其余人留在门外交换信息",
            result: "这不是最善良的决定，但可能是今晚最能执行下去的决定。",
            risk: 39,
            effects: {
              stats: { trust: 6, supplies: -4, stress: 2, shelter: 3 },
              npc: { lin_shuang: 4, he_yun: 3 },
              flagsSet: { openedRefugeFloor: true, hasCommunity: true }
            }
          },
          {
            label: "不开门，只通过门缝和绳篮做交换",
            result: "你保住了边界，也让不少人记住了17层的灯只照自己人。",
            risk: 27,
            effects: {
              stats: { supplies: 5, trust: -6, stress: 1 },
              npc: { lin_shuang: -5, gu_xing: 3 },
              flagsSet: { liedToGroup: true }
            }
          },
          {
            label: "关掉门厅灯和对讲，不再回应",
            result: "外面很久都没有散。你知道他们不是没走，只是不再相信这里值得再敲一次。",
            risk: 23,
            effects: {
              stats: { shelter: 4, trust: -10, stress: 5 },
              npc: { lin_shuang: -10, gu_xing: 4 },
              flagsSet: { sealedLevels: true, betrayedCivilians: true, quietCode: true }
            }
          }
        ]
      },
      {
        id: "core_008_archive_tapes",
        weight: 10,
        once: true,
        minDay: 10,
        maxDay: 16,
        category: "组织重构",
        requiresAnyFlags: ["hasRadio", "bridgeMapped", "generatorOnline"],
        title: "档案夹层的 W-17 磁带",
        body: "纸箱背后藏着一排被人匆忙贴错标签的磁带，第一盘外壳写着 W-17。它提到封闭楼宇、压力测试、撤离名单和‘筛选成功率’。你终于意识到自己活在别人提前写好的剧本边缘。",
        location: "档案夹层",
        roads: ["旧服务器间", "磁带档案库"],
        choices: [
          {
            label: "把整盘磁带听完并复制，准备让更多人知道",
            result: "真相没有减轻恐慌，只是让恐慌终于有了准确的名字。",
            risk: 43,
            effects: {
              stats: { trust: 6, stress: 6, supplies: -2 },
              npc: { tang_miao: 4, zhou_qi: 4 },
              flagsSet: { archiveTruth: true },
              decisionTagsAdd: ["truth_found"],
              queue: ["core_009_boardroom_trial"]
            }
          },
          {
            label: "只告诉最核心的人，把磁带当筹码压在手里",
            result: "你捏住了一张很重的牌，但它也开始反过来压你。",
            risk: 28,
            effects: {
              stats: { supplies: 2, trust: -7, stress: -1 },
              flagsSet: { archiveTruth: true, liedToGroup: true }
            }
          },
          {
            label: "烧掉磁带，别让楼里再多一层失控",
            result: "火光很稳，像某种人为的遗忘。你知道自己烧掉的不止是证据。",
            risk: 24,
            effects: {
              stats: { stress: -3, trust: -5, shelter: 3 },
              flagsSet: { sealedLevels: true }
            }
          },
          {
            label: "把磁带交给林霜，推动一次公开表决",
            result: "你把真相扔回了人群，后果也就不再只属于你。",
            risk: 39,
            effects: {
              stats: { trust: 10, stress: 4 },
              npc: { lin_shuang: 7 },
              flagsSet: { archiveTruth: true, hasCommunity: true, towerVoteDone: true },
              decisionTagsAdd: ["public_vote"],
              queue: ["core_009_boardroom_trial"]
            }
          }
        ]
      },
      {
        id: "core_009_boardroom_trial",
        weight: 9,
        once: true,
        minDay: 13,
        maxDay: 20,
        category: "高压消耗",
        requiresAnyFlags: ["archiveTruth", "openedRefugeFloor", "sealedLevels"],
        npcId: "gu_xing",
        title: "22层董事会议室的清算",
        body: "会议室长桌上放着剩余电池、配电权限表和几张已经被撕开的撤离名单。有人要审那群之前锁门的人，有人要审现在掌灯的人。你发现‘秩序’这两个字从来都不便宜。",
        location: "22层董事会议室",
        roads: ["观景玻璃廊", "会议区走廊"],
        choices: [
          {
            label: "公开听证，把名单、权限和证据全部摊开",
            result: "争吵比预期更大，但至少所有人第一次在同一张桌上看见了同样的东西。",
            risk: 47,
            effects: {
              stats: { trust: 10, stress: 4, stamina: -3 },
              npc: { lin_shuang: 5, gu_xing: -2 },
              flagsSet: { towerVoteDone: true, hasCommunity: true },
              decisionTagsAdd: ["public_hearing"]
            }
          },
          {
            label: "借机清掉最危险的几个人，把门彻底关死",
            result: "你换来的是更安静的楼层，和以后谁都不敢真正靠近你的距离。",
            risk: 55,
            effects: {
              stats: { shelter: 7, trust: -9, stress: 3 },
              npc: { gu_xing: 6, lin_shuang: -7 },
              flagsSet: { sealedLevels: true, betrayedCivilians: true },
              decisionTagsAdd: ["purge"]
            }
          },
          {
            label: "假装表决，实际只为再拖两天时间",
            result: "台词都很像民主，但你知道那只是另一种门禁。",
            risk: 33,
            effects: {
              stats: { trust: -3, supplies: 4, stress: -1 },
              flagsSet: { liedToGroup: true, towerVoteDone: true }
            }
          },
          {
            label: "解散委员会，各层自己回去守自己的灯",
            result: "会议结束得很快，分裂也来得一样快。",
            risk: 29,
            effects: {
              stats: { stamina: 3, trust: -5, shelter: -2, stress: -1 }
            }
          }
        ]
      },
      {
        id: "core_010_beacon_rehearsal",
        weight: 9,
        once: true,
        minDay: 16,
        maxDay: 22,
        category: "长期求生",
        requiresAnyFlags: ["archiveTruth", "escapePlanKnown", "hasRadio"],
        title: "天台信标和彩排过的谎言",
        body: "天台已经能看到更远的雾墙。你们手里有广播、有路线、有一部分真相，也有足够把人骗上楼的技术。真正难的是决定灯为谁亮、话要怎么说。",
        location: "天台雨棚",
        roads: ["北侧雨棚", "塔台底座"],
        choices: [
          {
            label: "准备信标和撤离脚本，给所有还愿意走的人一个窗口",
            result: "这意味着你要对所有看见灯的人负责，不管他们是不是你的人。",
            risk: 46,
            effects: {
              stats: { trust: 8, supplies: -5, stress: 4 },
              flagsSet: { beaconReady: true, escapePlanKnown: true, promisedNoOneLeft: true },
              decisionTagsAdd: ["beacon_open"],
              queue: ["core_011_fog_breach"]
            }
          },
          {
            label: "伪造一份窄名单，只把核心成员写进去",
            result: "名单确实更安全，只是它从此也像一把已经开过人的刀。",
            risk: 34,
            effects: {
              stats: { supplies: 6, trust: -10, stress: 1 },
              flagsSet: { beaconReady: true, liedToGroup: true, betrayedCivilians: true },
              decisionTagsAdd: ["false_beacon"],
              queue: ["core_011_fog_breach"]
            }
          },
          {
            label: "直接广播真相，告诉大家根本没有官方来接",
            result: "楼里立刻更乱了，但你也终于不需要再拿沉默和希望交换秩序。",
            risk: 41,
            effects: {
              stats: { trust: 12, stress: 7, stamina: -2 },
              flagsSet: { truthOnAir: true, hasRadio: true, promisedNoOneLeft: true },
              decisionTagsAdd: ["truth_on_air"],
              queue: ["core_011_fog_breach"]
            }
          },
          {
            label: "封掉天台和频段，把最后的决定留在少数人之间",
            result: "你保住了可控性，也把未来压缩成了一间只剩自己人的房间。",
            risk: 27,
            effects: {
              stats: { shelter: 8, trust: -8, stress: -2 },
              flagsSet: { sealedLevels: true, quietCode: true },
              decisionTagsAdd: ["sealed_future"],
              queue: ["core_011_fog_breach"]
            }
          }
        ]
      },
      {
        id: "core_011_fog_breach",
        weight: 8,
        once: true,
        minDay: 20,
        maxDay: 26,
        category: "高压消耗",
        requiresAnyFlags: ["beaconReady", "truthOnAir", "sealedLevels"],
        title: "雾潮开始上楼",
        body: "低层门禁被连续撞开，监控画面只剩破碎反光。你们终于要为之前所有决定付账了: 是把人往外导、往上提，还是把某些门永远锁死。",
        location: "17层开放办公区",
        roads: ["玻璃门厅", "东侧消防梯"],
        choices: [
          {
            label: "你带诱饵队走连桥，给后面的人争整段撤离时间",
            result: "这不漂亮，但很有效。有人能跑出去，是因为你先朝另一边跑了。",
            risk: 61,
            effects: {
              stats: { health: -4, stamina: -8, trust: 10, stress: 4 },
              flagsSet: { escapePlanKnown: true, promisedNoOneLeft: true },
              decisionTagsAdd: ["bridge_decoy"],
              queue: ["core_012_final_window"]
            }
          },
          {
            label: "全塔通电一小时，强行把所有仍能动的人推上流程",
            result: "整栋楼短暂亮得像还活在正常世界，代价是你知道下一次停电会更重。",
            risk: 49,
            effects: {
              stats: { supplies: -10, shelter: 4, stress: 5, trust: 6 },
              flagsSet: { generatorOnline: true, beaconReady: true },
              decisionTagsAdd: ["one_hour_power"],
              queue: ["core_012_final_window"]
            }
          },
          {
            label: "切断低层，把仍在上层的人全部带走",
            result: "你救下了眼前这些人，也把很多未来彻底留在了下面。",
            risk: 38,
            effects: {
              stats: { shelter: 10, trust: -12, stress: 6 },
              flagsSet: { sealedLevels: true, betrayedCivilians: true },
              decisionTagsAdd: ["cut_lower_floors"],
              queue: ["core_012_final_window"]
            }
          },
          {
            label: "用广播把分散楼层串起来，边打边报位",
            result: "你让人群第一次像协同而不是恐慌地移动，哪怕只有这一次。",
            risk: 44,
            effects: {
              stats: { trust: 8, stress: 3, stamina: -3 },
              flagsSet: { truthOnAir: true, hasRadio: true, hasCommunity: true },
              decisionTagsAdd: ["broadcast_grid"],
              queue: ["core_012_final_window"]
            }
          }
        ]
      },
      {
        id: "core_012_final_window",
        weight: 7,
        once: true,
        minDay: 22,
        maxDay: 34,
        category: "长期求生",
        requiresAnyFlags: ["beaconReady", "truthOnAir", "sealedLevels", "escapePlanKnown"],
        title: "最后一个窗口不够所有人通过",
        body: "清晨前有一个很短的空档。连桥、天台、楼内封层，全都还能选，但你已经知道每个答案都只能救一部分人。最后的决定不是‘对不对’，而是谁来承担剩下的那部分黑。",
        location: "空中连桥",
        roads: ["连桥南段", "塔台底座"],
        choices: [
          {
            label: "你留下来维持门禁和灯，让别人先走",
            result: "你把自己变成了这栋楼最后一个还在发声的部件。",
            risk: 58,
            effects: {
              stats: { health: -12, trust: 14, stress: 3 },
              flagsSet: { sacrificeMade: true, promisedNoOneLeft: true, sealedLevels: true },
              decisionTagsAdd: ["last_keeper"]
            }
          },
          {
            label: "按体力和技能拆队，多路线同步撤离",
            result: "没有完美方案，但至少你没有把所有命压在一条线上。",
            risk: 43,
            effects: {
              stats: { stamina: 6, trust: 4, supplies: -4 },
              flagsSet: { escapePlanKnown: true, bridgeMapped: true, hasCommunity: true },
              decisionTagsAdd: ["split_routes"]
            }
          },
          {
            label: "关闭名单，只护送最核心的小队",
            result: "你把风险缩到最小，也把自己彻底钉在了最窄的那条道德线上。",
            risk: 32,
            effects: {
              stats: { supplies: 8, trust: -14, stress: 2 },
              flagsSet: { liedToGroup: true, betrayedCivilians: true, beaconReady: true },
              decisionTagsAdd: ["core_only"]
            }
          },
          {
            label: "把最终决定交还给全体表决，自己只负责执行",
            result: "你放弃了最后的独断，换回来的不是轻松，是一种更难躲开的共同责任。",
            risk: 37,
            effects: {
              stats: { trust: 10, stress: 2, stamina: -2 },
              flagsSet: { hasCommunity: true, towerVoteDone: true },
              decisionTagsAdd: ["final_vote"]
            }
          }
        ]
      }
    ];
  }

  function makeNpcEvents() {
    return [
      {
        id: "npc_lin_shuang_beds",
        weight: 7,
        once: true,
        minDay: 6,
        maxDay: 14,
        category: "组织重构",
        npcId: "lin_shuang",
        requiresFlagsAll: ["npc_lin_shuang_met"],
        condition: {
          any: [
            { debtsAny: ["debt_food_board", "debt_shift_roster"] },
            { npcMemoryAny: { lin_shuang: ["记得你愿意把钥匙和规则公开", "记得你先把17层变成了能守的空间"] } }
          ]
        },
        title: "林霜要你公开床位和库存",
        body: "林霜把记号笔拍到你手里。她说楼里最大的恐慌不是缺东西，而是不知道谁在藏东西。你前几天答应过的公开和轮班，现在该不该兑现，所有人都在看。",
        location: "17层开放办公区",
        roads: ["玻璃门厅", "17层主工位岛"],
        choices: [
          {
            label: "全公开，让名单和库存一起见光",
            result: "有人立刻开始挑刺，但更多人终于不再胡猜。",
            risk: 34,
            effects: {
              stats: { trust: 8, supplies: -3, stress: 1, morale: 3 },
              modules: { intel: 5, water: -2 },
              npc: { lin_shuang: 8 },
              flagsSet: { openedRefugeFloor: true, hasCommunity: true },
              debtsClear: ["debt_food_board", "debt_shift_roster"],
              memoriesAdd: { lin_shuang: ["记得你真的把名单贴了出去"] }
            }
          },
          {
            label: "只公开床位，不公开具体库存",
            result: "这像一种折中，也像一种很快会被看穿的遮掩。",
            risk: 27,
            effects: {
              stats: { trust: 3, stress: -1, morale: -1 },
              modules: { intel: 2 },
              npc: { lin_shuang: 2 },
              delayedConsequences: [{ id: "cons_half_inventory_board", dueDay: 8, text: "因为你只公开了一半信息，17层开始流传‘真正的库存另有一本账’。", payload: { stats: { trust: -3, stress: 2 }, modules: { intel: -2 } } }]
            }
          },
          {
            label: "让她闭嘴，先守住17层别再引人上来",
            result: "你守住了安静，也几乎把她推到了你的对立面。",
            risk: 24,
            effects: {
              stats: { shelter: 4, trust: -6, morale: -4 },
              modules: { defense: 3, intel: -4 },
              npc: { lin_shuang: -8 },
              flagsSet: { betrayedCivilians: true, sealedLevels: true },
              memoriesAdd: { lin_shuang: ["记得你让她闭嘴别再提公开"] }
            }
          },
          {
            label: "把公开这件事交给广播和志愿者去做",
            result: "你没站到最前面，但也没有把她一个人晾在火线上。",
            risk: 31,
            effects: {
              stats: { trust: 5, stamina: -2, morale: 2 },
              modules: { intel: 4, power: -1 },
              npc: { lin_shuang: 5, tang_miao: 2 },
              debtsClear: ["debt_food_board"]
            }
          }
        ]
      },
      {
        id: "npc_gu_xing_search",
        weight: 7,
        once: true,
        minDay: 7,
        maxDay: 16,
        category: "高压消耗",
        npcId: "gu_xing",
        requiresFlagsAll: ["npc_gu_xing_met"],
        title: "顾行提议对新来者搜身",
        body: "顾行说楼里迟早会出事，问题只在于你是提前搜出来，还是等它在夜里炸开。他希望你授权对每个新进楼层的人做一次彻底检查。",
        location: "17层开放办公区",
        roads: ["东侧消防梯", "玻璃门厅"],
        choices: [
          {
            label: "同意搜身，但把流程写成公开规则",
            result: "没有人喜欢这件事，但至少它不像暗地里的猎巫。",
            risk: 38,
            effects: {
              stats: { shelter: 6, trust: 2, stress: 1 },
              npc: { gu_xing: 6, lin_shuang: -1 },
              flagsSet: { sealedLevels: true }
            }
          },
          {
            label: "拒绝，楼里不能靠羞辱换安全感",
            result: "你守住了边界感，也让顾行开始怀疑你是不是过于天真。",
            risk: 29,
            effects: {
              stats: { trust: 6, shelter: -2, stress: -1 },
              npc: { gu_xing: -6, he_yun: 4 }
            }
          },
          {
            label: "只搜可疑包裹，不碰人",
            result: "这是个中间值，也因此谁都不完全满意。",
            risk: 25,
            effects: {
              stats: { shelter: 3, trust: 2 },
              npc: { gu_xing: 2 }
            }
          },
          {
            label: "让顾行自己组人去做，你不背书",
            result: "你把后果推开了，但楼里还是会记得是谁默许了它。",
            risk: 22,
            effects: {
              stats: { stress: -1, trust: -4 },
              npc: { gu_xing: 3 },
              flagsSet: { liedToGroup: true }
            }
          }
        ]
      },
      {
        id: "npc_tang_miao_midnight",
        weight: 7,
        once: true,
        minDay: 8,
        maxDay: 18,
        category: "组织重构",
        npcId: "tang_miao",
        requiresFlagsAll: ["npc_tang_miao_met"],
        condition: {
          any: [
            { debtsAny: ["debt_radio_watch", "debt_public_voice"] },
            { npcMemoryAny: { tang_miao: ["记得你愿意把体力押给监听台"] } }
          ]
        },
        title: "唐渺想做一档深夜节目",
        body: "她说楼里现在最缺的不是信息，而是有人在凌晨两点还愿意好好说话。你既然让广播亮起来，就不能只在需要秩序的时候才让它开口。",
        location: "19层录音棚",
        roads: ["A棚门口", "混音间通道"],
        choices: [
          {
            label: "让节目上线，固定每夜开麦十分钟",
            result: "楼里多了一条不是命令的声音，很多人因此没在夜里失控。",
            risk: 28,
            effects: {
              stats: { stress: -5, trust: 6, morale: 6 },
              modules: { intel: 5, power: -2 },
              npc: { tang_miao: 8 },
              flagsSet: { hasRadio: true, hasCommunity: true },
              debtsClear: ["debt_radio_watch", "debt_public_voice"],
              memoriesAdd: { tang_miao: ["记得你没有把声音只留给命令"] }
            }
          },
          {
            label: "只播路况、药讯和门禁，不谈情绪",
            result: "它很有效，但也冷得像给机器听的节目。",
            risk: 22,
            effects: {
              stats: { supplies: 3, trust: 2, stress: -1, morale: -1 },
              modules: { intel: 4 },
              npc: { tang_miao: 2, gu_xing: 2 },
              debtsClear: ["debt_radio_watch"]
            }
          },
          {
            label: "否决，任何多余声音都可能惹来麻烦",
            result: "你保住了安静，也让最会说话的人从此开始省着开口。",
            risk: 18,
            effects: {
              stats: { shelter: 2, trust: -5, morale: -5 },
              modules: { intel: -4, defense: 2 },
              npc: { tang_miao: -9 },
              flagsSet: { quietCode: true },
              memoriesAdd: { tang_miao: ["记得你否决了她唯一还能做的事"] }
            }
          },
          {
            label: "同意，但要求她只播你审核过的内容",
            result: "节目还是上线了，只是每一句都更像命令，不像安慰。",
            risk: 24,
            effects: {
              stats: { trust: -2, stress: -2, morale: -2 },
              modules: { intel: 3 },
              npc: { tang_miao: -3 },
              flagsSet: { liedToGroup: true },
              delayedConsequences: [{ id: "cons_censored_radio", dueDay: 10, text: "楼里的人开始把广播当成你的喇叭，而不是大家的声音。", payload: { stats: { trust: -3, morale: -2 }, modules: { intel: -2 } } }]
            }
          }
        ]
      },
      {
        id: "npc_he_yun_priority",
        weight: 7,
        once: true,
        minDay: 9,
        maxDay: 18,
        category: "高压消耗",
        npcId: "he_yun",
        requiresFlagsAll: ["npc_he_yun_met"],
        condition: {
          any: [
            { debtsAny: ["debt_wounds_unchecked"] },
            { npcMemoryAny: { he_yun: ["记得你把最重的伤先往前排"] } }
          ]
        },
        title: "何筠要你决定止血包优先级",
        body: "伤员越来越多，止血包越来越少。何筠把名单推给你，说她不想再一个人扛‘谁先活’这件事。你之前欠下的那些伤口账，现在已经没有借口能继续拖。",
        location: "17层开放办公区",
        roads: ["会议室", "复印机走廊"],
        choices: [
          {
            label: "按伤情最重优先，不看关系和岗位",
            result: "这是最慢也最难争辩的方案，但它能让一些眼神重新抬起来。",
            risk: 30,
            effects: {
              stats: { trust: 8, supplies: -5, stress: 2, morale: 4 },
              modules: { medical: 6, water: -1 },
              npc: { he_yun: 8 },
              debtsClear: ["debt_wounds_unchecked"],
              memoriesAdd: { he_yun: ["记得你没有把止血包变成关系票"] }
            }
          },
          {
            label: "优先关键岗位，先保住楼层运转",
            result: "系统更稳定了，但白板前的沉默也更重了。",
            risk: 33,
            effects: {
              stats: { shelter: 6, trust: -5, stress: 1, morale: -3 },
              modules: { defense: 3, medical: 2 },
              npc: { he_yun: -5, zhou_qi: 3 },
              delayedConsequences: [{ id: "cons_priority_staff", dueDay: 11, text: "有人开始默认‘关键岗位比普通人更值钱’，这套排序正在反过来腐蚀你。", payload: { stats: { trust: -3, morale: -3 }, modules: { defense: -1, intel: -1 } } }]
            }
          },
          {
            label: "让何筠自己定，你不插手",
            result: "你把决定还给了专业的人，也把怨气大半留给了她。",
            risk: 21,
            effects: {
              stats: { stress: -2, trust: -2, morale: -1 },
              npc: { he_yun: -2 },
              memoriesAdd: { he_yun: ["记得你在最难的时候把决定推回给了她"] }
            }
          },
          {
            label: "秘密给自己人留一包，以防最坏情况",
            result: "它很实用，也很像一种正在成型的自私习惯。",
            risk: 26,
            effects: {
              stats: { supplies: 4, trust: -6, stress: 1, morale: -4 },
              modules: { medical: 1, intel: -2 },
              npc: { he_yun: -8 },
              flagsSet: { liedToGroup: true, betrayedCivilians: true },
              delayedConsequences: [{ id: "cons_hidden_bandage", dueDay: 10, text: "那包被你藏起来的止血包还是被人发现了，医务点的信任感当场塌了一截。", payload: { stats: { trust: -5, stress: 3 }, modules: { medical: -3, intel: -2 } } }]
            }
          }
        ]
      },
      {
        id: "npc_zhou_qi_server",
        weight: 7,
        once: true,
        minDay: 10,
        maxDay: 20,
        category: "组织重构",
        npcId: "zhou_qi",
        requiresFlagsAll: ["npc_zhou_qi_met"],
        condition: {
          any: [
            { debtsAny: ["debt_generator_fuel"] },
            { flagsAny: ["generatorOnline"] }
          ]
        },
        title: "周启想重启一台旧服务器",
        body: "周启说服务器里可能有楼宇备用图、员工名单和出入记录。重启它要耗电，也可能把更多不该亮的东西一起点亮。你之前拍板把电点给了谁，现在就决定你敢不敢继续往下挖。",
        location: "档案夹层",
        roads: ["旧服务器间", "纸档通道"],
        choices: [
          {
            label: "重启，哪怕只换来几分钟完整数据",
            result: "屏幕亮起的那刻，你们都知道自己刚把某段旧秩序又拉回来了。",
            risk: 37,
            effects: {
              stats: { supplies: -3, trust: 4, stress: 2, morale: 2 },
              modules: { intel: 8, power: -3 },
              npc: { zhou_qi: 8 },
              flagsSet: { archiveTruth: true, generatorOnline: true },
              debtsClear: ["debt_generator_fuel"],
              memoriesAdd: { zhou_qi: ["记得你没把电只用来维持表面秩序"] }
            }
          },
          {
            label: "只复制出入口记录和楼层图",
            result: "够用了，但也意味着很多更深的东西会继续躺在黑里。",
            risk: 24,
            effects: {
              stats: { shelter: 4, stress: -1 },
              modules: { intel: 4, power: -1 },
              npc: { zhou_qi: 3 },
              flagsSet: { escapePlanKnown: true }
            }
          },
          {
            label: "否决，电留给门禁和医务点",
            result: "这很务实，也很容易让你失去下一次提前知道真相的机会。",
            risk: 17,
            effects: {
              stats: { shelter: 3, trust: -2, morale: -1 },
              modules: { power: 2, intel: -3 },
              npc: { zhou_qi: -5 },
              delayedConsequences: [{ id: "cons_truth_buried", dueDay: 12, text: "因为档案没被及时拉起来，你们错过了一条本该更早知道的楼宇线索。", payload: { stats: { threat: 3, stress: 2 }, modules: { intel: -2 } } }]
            }
          },
          {
            label: "让他私下重启，只把结果汇报给你",
            result: "你得到了优先知情权，也失去了被人主动相信的资格。",
            risk: 23,
            effects: {
              stats: { supplies: 2, trust: -5, morale: -2 },
              modules: { intel: 5, power: -2 },
              npc: { zhou_qi: 1 },
              flagsSet: { liedToGroup: true },
              delayedConsequences: [{ id: "cons_private_archive", dueDay: 11, text: "楼里迟早会知道你把档案信息变成了只有自己先看的东西。", payload: { stats: { trust: -4, stress: 2 }, modules: { intel: -2 } } }]
            }
          }
        ]
      },
      {
        id: "npc_mo_yan_runner",
        weight: 7,
        once: true,
        minDay: 11,
        maxDay: 21,
        category: "高压消耗",
        npcId: "mo_yan",
        requiresFlagsAll: ["npc_mo_yan_met"],
        condition: {
          any: [
            { debtsAny: ["debt_bridge_route", "debt_return_window"] },
            { npcMemoryAny: { mo_yan: ["记得你亲自迈上了连桥第一段"] } }
          ]
        },
        title: "莫言想把自己变成固定跑楼员",
        body: "他已经把各层门缝、绳篮和暗号记得比谁都熟。现在他想要正式权限，说自己一个人能顶三条慢吞吞的会议流程。你之前承诺过的桥路和回楼窗口，最终都要落在某个人的腿上。",
        location: "空中连桥",
        roads: ["广告灯箱旁", "风压观察点"],
        choices: [
          {
            label: "给他权限和备份搭档，把跑线制度正式化",
            result: "路线终于不是靠胆子维持，而是靠轮班。",
            risk: 41,
            effects: {
              stats: { stamina: 4, trust: 6, supplies: -2, morale: 3 },
              modules: { intel: 5, defense: 2 },
              npc: { mo_yan: 9 },
              flagsSet: { bridgeMapped: true, escapePlanKnown: true },
              debtsClear: ["debt_bridge_route", "debt_return_window"],
              memoriesAdd: { mo_yan: ["记得你没有让他一个人扛整条线"] }
            }
          },
          {
            label: "让他继续单人跑线，但只传最关键消息",
            result: "效率很高，但你知道这事一旦断在他身上，就会整条线一起断。",
            risk: 46,
            effects: {
              stats: { supplies: 5, trust: -2, stress: 2, morale: -1 },
              modules: { intel: 4, defense: -1 },
              npc: { mo_yan: 3 },
              delayedConsequences: [{ id: "cons_single_runner", dueDay: 13, text: "单人跑线太脆，一次迟归就足够让整个传递系统开始抖。", payload: { stats: { stress: 3, threat: 2 }, modules: { intel: -3, defense: -1 } } }]
            }
          },
          {
            label: "叫停，他太年轻，不该把命耗在这上面",
            result: "你像在保护他，也像在提前砍掉一条可能最好用的腿。",
            risk: 19,
            effects: {
              stats: { stress: -2, stamina: -1, morale: -1 },
              modules: { defense: 1, intel: -2 },
              npc: { mo_yan: -7, he_yun: 2 },
              memoriesAdd: { mo_yan: ["记得你宁可叫停也不肯真的信任他"] }
            }
          },
          {
            label: "让他先跑一趟最险的桥段，回来再说",
            result: "这更像测试，不像授权。莫言听得出来。",
            risk: 54,
            effects: {
              stats: { supplies: 6, trust: -5, stress: 3, morale: -4 },
              modules: { intel: 3, defense: -2 },
              npc: { mo_yan: -8 },
              flagsSet: { betrayedCivilians: true },
              delayedConsequences: [{ id: "cons_tested_runner", dueDay: 12, text: "大家都看出来你拿莫言做了一次风险测试，之后再谈共同承担就难了。", payload: { stats: { trust: -4, morale: -3 }, modules: { defense: -2 } } }]
            }
          }
        ]
      }
    ];
  }

  function makeZoneEvents() {
    const events = [];

    zones.forEach((zone, idx) => {
      const npc = npcDefs[idx % npcDefs.length];
      events.push({
        id: `zone_${zone.key}_pressure`,
        weight: 3,
        once: false,
        minDay: 6 + idx,
        maxDay: 60,
        category: idx % 2 === 0 ? "高压消耗" : "封锁裂解",
        npcId: npc.id,
        title: `${zone.name}的空白十分钟`,
        body: `${zone.mark}附近突然空出一段没人敢先动的窗口。是补货、修门、救人还是继续假装它不会出问题，全看你现在押哪边。`,
        location: zone.name,
        roads: [zone.roads[0], zone.roads[1]],
        choices: [
          {
            label: "趁窗口补一轮货，再把门重新封上",
            result: "收获不算少，但你们也更像一台靠抢时间运转的机器。",
            risk: 44,
            effects: {
              stats: { supplies: 8, stamina: -5, stress: 2 },
              modules: { water: 2, defense: -1 },
              delayedConsequences: [{ dueIn: 2, text: `${zone.name}的补货窗口被你拿成了抢时间的机器，接下来会有人问配给是不是又向17层倾斜。`, payload: { stats: { trust: -2, stress: 2 }, modules: { intel: -1 } } }]
            }
          },
          {
            label: "优先护送慢的人和伤的人通过",
            result: "你错过了一部分资源，却换来楼里真正会记得的东西。",
            risk: 36,
            effects: { stats: { trust: 8, supplies: -3, stress: 1, morale: 3 }, modules: { medical: 2 }, npc: { [npc.id]: 4 } }
          },
          {
            label: "修补结构和门禁，准备把这里长期化",
            result: "你没赚到立刻能吃的东西，但这里明天会比今天更像据点。",
            risk: 28,
            effects: { stats: { shelter: 7, supplies: -2, stress: -1 }, modules: { defense: 4 } }
          },
          {
            label: "把最好的那部分资源先抽回17层",
            result: "这很有效率，也会在下一次分配时留下阴影。",
            risk: 31,
            effects: {
              stats: { supplies: 9, trust: -6, stress: 2, morale: -2 },
              modules: { water: 2, intel: -2 },
              flagsSet: { liedToGroup: true },
              debtsAdd: [{ id: `debt_${zone.key}_allocation`, title: `${zone.name}的人在记你抽走了最好那批资源`, severity: "medium", note: "下一次分配会被追问" }]
            }
          }
        ]
      });

      events.push({
        id: `zone_${zone.key}_governance`,
        weight: 2.5,
        once: false,
        minDay: 12 + idx,
        maxDay: 60,
        category: idx % 2 === 0 ? "长期求生" : "组织重构",
        npcId: npc.id,
        title: `${zone.name}的分配争执`,
        body: `${zone.roads[1]}到${zone.roads[2]}这一段又有人因为轮班、床位或钥匙吵起来了。你可以把它处理成流程，也可以处理成一段记仇。`,
        location: zone.name,
        roads: [zone.roads[1], zone.roads[2]],
        choices: [
          {
            label: "公开规则，哪怕执行起来更慢",
            result: "你让争执变长了，也让它更难在夜里偷偷发酵。",
            risk: 29,
            effects: { stats: { trust: 7, stress: 2, stamina: -3, morale: 2 }, modules: { intel: 2 }, npc: { [npc.id]: 4 } }
          },
          {
            label: "效率优先，先拍板再解释",
            result: "事情很快结束，但‘为什么是你说了算’也更快开始冒头。",
            risk: 33,
            effects: { stats: { shelter: 4, trust: -3, stress: 1, morale: -1 }, modules: { defense: 2 } }
          },
          {
            label: "给最有意见的人一点补偿，先把声音压下去",
            result: "短期有效，长期会让每次抱怨都更像讨价还价。",
            risk: 25,
            effects: { stats: { supplies: -4, trust: 2, stress: -1 }, modules: { water: -1 } }
          },
          {
            label: "交给当地小组自己解决，你只保留否决权",
            result: "你省了力气，也接受了掌控力正在一点点散开。",
            risk: 22,
            effects: {
              stats: { stamina: 2, trust: -2, stress: -1 },
              npc: { [npc.id]: 1 },
              delayedConsequences: [{ dueIn: 2, text: `${zone.name}的小组自处理把问题压住了表面，但你也正在失去谁还把你当最后拍板的人。`, payload: { stats: { trust: -2, stress: 1 }, modules: { intel: -1 } } }]
            }
          }
        ]
      });
    });

    return events;
  }

  function makeTemplateEvents() {
    return [
      {
        id: "t_aftershock_window",
        title: "{district}留下来的后遗症",
        body: "{landmark}这段时间的秩序不是稳住了，只是被你暂时压住了。现在又有一处窗口、一处缺口或一句旧话回来了，逼你为之前的决定继续付款。",
        category: "组织重构",
        choices: [
          {
            label: "公开补洞，把旧账摊开一起处理",
            result: "这会立刻变慢，也会立刻变难，但至少不是继续把问题踢给明晚。",
            risk: 34,
            effects: {
              stats: { trust: 7, stress: 2, morale: 3, stamina: -2 },
              modules: { intel: 3, defense: 1 }
            }
          },
          {
            label: "先把最危险的一角缝上，别管观感",
            result: "你救的是眼前局面，不是别人对你的评价。",
            risk: 29,
            effects: { stats: { shelter: 5, stress: 1, trust: -1 }, modules: { defense: 4, power: -1 } }
          },
          {
            label: "先安抚被牵连的人，接受效率下滑",
            result: "你知道这样最不划算，但有些关系一旦断了，后面什么流程都接不回来。",
            risk: 24,
            effects: { stats: { trust: 5, morale: 4, supplies: -2, stress: -1 }, modules: { medical: 2 } }
          },
          {
            label: "把代价继续往外推，先保核心层",
            result: "你又一次让核心层更稳，也又一次让外圈更清楚自己排在第几顺位。",
            risk: 38,
            effects: {
              stats: { supplies: 6, trust: -6, stress: 3, morale: -4 },
              modules: { defense: 3, intel: -2 },
              flagsSet: { liedToGroup: true },
              debtsAdd: [{ id: "debt_hidden_cache", title: "你又一次把代价留给了外圈的人", severity: "medium", note: "这笔账不会自己消失" }]
            }
          }
        ]
      },
      {
        id: "t_pressure_night",
        title: "{landmark}这一夜会逼你选边",
        body: "{road}外侧的声响、楼里的抱怨和你手头快到期的承诺撞在了一起。今晚不一定会死人，但一定会有人更清楚你到底站在哪边。",
        category: "长期求生",
        choices: [
          {
            label: "全员轮换，硬扛过去",
            result: "你用集体一起累坏，换掉了少数人单独崩掉。",
            risk: 40,
            effects: { stats: { shelter: 7, trust: 5, stamina: -7, stress: 4, morale: 2 }, modules: { defense: 5, power: -1 } }
          },
          {
            label: "缩线保核心，把外围先让出去",
            result: "你保住了最要紧的，但也等于正式承认有些人和有些地方今晚不值得你再分力。",
            risk: 27,
            effects: { stats: { shelter: 4, stamina: -4, stress: 1, morale: -2 }, modules: { defense: 2, intel: -1 } }
          },
          {
            label: "让广播、暗号和流程替人顶一半",
            result: "这一夜更像系统在运转，而不是人在咬牙撑。",
            risk: 23,
            effects: { stats: { stamina: 2, trust: 3, supplies: -2, morale: 1 }, modules: { intel: 3, power: -1 } }
          },
          {
            label: "后撤一个门区，把代价留给明天",
            result: "你保住了今晚，却把明天会变得更难这件事也一起保了下来。",
            risk: 21,
            effects: {
              stats: { shelter: -5, stress: -1, trust: -3, morale: -2 },
              modules: { defense: -4 },
              delayedConsequences: [{ dueIn: 2, text: "你今晚放掉的那一段，明天会变成更贵的缺口回来找你。", payload: { stats: { threat: 3, stress: 2 }, modules: { defense: -2 } } }]
            }
          }
        ]
      }
    ];
  }

  const coreEvents = makeCoreEvents();
  const npcEvents = makeNpcEvents();
  const zoneEvents = makeZoneEvents();

  window.GAME_DATA = {
    meta: {
      title: "雾港 17 层",
      hook: "停电、断网、封楼，外面的雾在贴着玻璃往上爬。你不是救世主，你只是这栋楼里第一个意识到今晚必须有人做决定的人。",
      premise: "架空封楼求生叙事。凌晨的综合办公楼突然失去电力和外部联络，楼外雾潮吞掉街道，楼内开始自行分层、自救、抢电、抢名单。你要在一栋会不断长出派系和秘密的高楼里，决定谁能一起活到下一个清晨。",
      setupHint: "玩法目标: 稳住据点、摸清信号和路线、处理幸存者之间的秩序冲突，最终把这栋楼带向收容、封层、迁移或广播中的某一条路。\n提示: 新版更强调人物关系、阶段目标和路线站队，不是单纯堆数值。",
      identityTag: "雾港 17 层幸存者",
      stages: {
        1: "封楼夜",
        2: "搜层期",
        3: "连桥期",
        4: "失真期",
        5: "终局回声"
      }
    },
    profileRoles: [
      { id: "night_editor", company: "栖灯传媒", label: "夜班总编", desc: "能把混乱快速压成可执行流程。", startBonus: { trust: 4, stress: -1, shelter: 2 } },
      { id: "sound_engineer", company: "栖灯传媒", label: "录音工程师", desc: "熟悉线路、隔音与临时监听设备。", startBonus: { supplies: 2, stress: -1, stamina: 1 } },
      { id: "sys_admin", company: "维序科技", label: "系统管理员", desc: "对门禁、配电和应急回路更敏感。", startBonus: { shelter: 4, supplies: 1, stress: 1 } },
      { id: "field_producer", company: "栖灯传媒", label: "外拍制片", desc: "跑动能力强，敢在不完整信息下先行动。", startBonus: { stamina: 4, stress: 1, trust: 1 } },
      { id: "community_ops", company: "楼宇服务", label: "社区运营", desc: "更容易安抚人群并维护协作氛围。", startBonus: { trust: 5, stress: -2, supplies: -1 } },
      { id: "security_runner", company: "楼宇安保", label: "夜巡协管", desc: "守线更稳，但会更快把世界看成门和敌我。", startBonus: { shelter: 5, stamina: 2, trust: -2 } }
    ],
    npcDefs,
    statDefs: [
      { key: "health", label: "体况", min: 0, max: 100 },
      { key: "infection", label: "雾蚀", min: 0, max: 100, inverse: true },
      { key: "hunger", label: "饥饿", min: 0, max: 100, inverse: true },
      { key: "supplies", label: "库存", min: 0, max: 100 },
      { key: "stamina", label: "执行力", min: 0, max: 100 },
      { key: "stress", label: "精神压强", min: 0, max: 100, inverse: true },
      { key: "trust", label: "团队凝聚", min: 0, max: 100 },
      { key: "shelter", label: "据点稳固", min: 0, max: 100 }
    ],
    initialState: {
      day: 1,
      stats: {
        health: 84,
        infection: 3,
        hunger: 16,
        supplies: 44,
        stamina: 72,
        stress: 30,
        trust: 38,
        shelter: 26
      },
      flags: {
        securedFloor17: false,
        hasRadio: false,
        hasClinicRoute: false,
        bridgeMapped: false,
        generatorOnline: false,
        archiveTruth: false,
        openedRefugeFloor: false,
        truthOnAir: false,
        sealedLevels: false,
        escapePlanKnown: false,
        beaconReady: false,
        liedToGroup: false,
        quietCode: false,
        promisedNoOneLeft: false,
        sacrificeMade: false,
        betrayedCivilians: false,
        hasCommunity: false,
        towerVoteDone: false
      }
    },
    districts: zones.map(z => z.name),
    roads: Array.from(new Set(zones.flatMap(z => z.roads))),
    landmarks: zones.map(z => z.mark),
    endings: [
      {
        id: "end_black_glass",
        priority: 99,
        title: "结局：黑玻璃后面",
        text: "你最后一次看见这栋楼时，玻璃上映出来的已经不是人影，而是雾里某种更慢、更近的东西。",
        condition: { any: [{ stats: { health: { lte: 0 } } }, { stats: { infection: { gte: 100 } } }] }
      },
      {
        id: "end_starve",
        priority: 92,
        title: "结局：灯还亮着，库存先空了",
        text: "你不是死在某次冲击里，而是死在所有人都知道要省、却已经没什么可省的那种日子里。",
        condition: { all: [{ stats: { supplies: { lte: 0 } } }, { stats: { hunger: { gte: 95 } } }, { dayGte: 24 }] }
      },
      {
        id: "end_mutiny",
        priority: 90,
        title: "结局：楼层兵变",
        text: "当没有人再相信你时，门禁、广播和名单都会瞬间失效。你不是失去控制，而是从来没真正拥有过它。",
        condition: { all: [{ stats: { trust: { lte: 4 } } }, { dayGte: 18 }] }
      },
      {
        id: "end_breakdown",
        priority: 88,
        title: "结局：夜里先塌的是人",
        text: "真正先坏掉的不是门，不是灯，是人的判断。你在持续失眠和压强里把自己用碎了。",
        condition: { all: [{ stats: { stress: { gte: 100 } } }, { dayGte: 20 }] }
      },
      {
        id: "end_false_beacon",
        priority: 84,
        title: "结局：假的名单，真的清算",
        text: "你用名单拖时间，最后却被名单反过来定义。楼里终于明白，自己不是被保护，而是被排序。",
        condition: { all: [{ dayGte: 22 }, { flagsAll: ["liedToGroup", "beaconReady"] }, { stats: { trust: { lte: 34 } } }] }
      },
      {
        id: "end_fog_keeper",
        priority: 82,
        title: "结局：关门者",
        text: "你把最后的电、最后的门和最后一段广播都留在自己身后。这栋楼活了下来，而你被留在了它最安静的那层。",
        condition: { all: [{ dayGte: 22 }, { flagsAll: ["sacrificeMade", "sealedLevels"] }] }
      },
      {
        id: "end_gray_carrier",
        priority: 80,
        title: "结局：半步留在雾里",
        text: "你没有立刻倒下。你只是越来越不适合再站在人群中间，于是主动把自己留在了门外。",
        condition: { all: [{ dayGte: 22 }, { stats: { infection: { gte: 82 }, health: { gte: 25 } } }, { flagsAny: ["promisedNoOneLeft", "truthOnAir"] }] }
      }
    ],
    events: [...coreEvents, ...npcEvents, ...zoneEvents],
    templateEvents: makeTemplateEvents()
  };
})();
