# Geometry Wars 精髓调研与落地对照

本文档沉淀对 Bizarre Creations《Geometry Wars》系列（Retro Evolved 1/2、GW3: Dimensions）的精髓调研结论，并逐条对照本项目（Geometry Fighter）当前实现状态：已保留、本次已落地、有意改造、或列入后续 backlog。调研结论来自 Wikipedia、Eurogamer 回顾与评测、Guardian 开发者访谈（Cakebread）、Digital Foundry 技术分析，以及社区公认的 Tuts+ 复刻参考实现（网格/粒子/Bloom 参数的事实标准）。

## 1. 系列 facts 速览

- 2003 年诞生于《PGR2》车库彩蛋，源于摇杆测试程序；2005 年《Retro Evolved》成为 XBLA 招牌；2008 年《Retro Evolved 2》（MC 90）被视为巅峰；精神鼻祖是 1982 年《Robotron: 2084》。
- 美术上"没有宏大构想"——不会画画的程序员画方块 + HD 矢量线条，成就了霓虹可读性。
- Xbox 360 原版以原生 1080p + 恒定 60FPS 运行；Digital Foundry 指出 iPad 移植削减粒子与涟漪后观感立刻降级——"过剩"特效就是观感本体。

## 2. 精髓清单与落地对照

### 2.1 动态弹簧网格（warping grid）——最标志性元素

**原作精髓**：网格是弹簧-质点系统。参考实现参数：质点用只拉不推的橡皮筋弹簧连接（刚度 0.28/阻尼 0.06，静止长 95%），边界质点为不可动锚点，每第 3×3 内部质点加很软的锚弹簧缓慢复位；速度阻尼 ×0.98，辛欧拉积分。外力按半径施加到质点加速度再沿弹簧扩散：爆炸 `100F/(10000+d²)`、黑洞吸力 `10F/(100+d²)`、**子弹以 `0.5×弹速` 的力、半径 80 持续犁出波纹**、玩家重生以半径 50 的定向力砸出冲击波。约 1600 质点、每第 3 条线加粗、Catmull-Rom 平滑。

**落地（本次）**：
- 网格从"直接位移"改为**欠阻尼弹簧积分**（刚度 90、阻尼 7.5、ζ≈0.4）：扰动过后网格会回弹、余波摆动，"布料感"成型（`GeometryFighter.prepareWarpedGrid`）。
- **玩家船对网格持续施加斥力窝**（半径 180，力度随船速 7→16），走位即拖拽网格。
- **每颗子弹以 `0.12×弹速` 在半径 80 内对网格质点注入速度**——弹流犁出波纹（`stampBulletWakes`）。
- 爆炸涟漪/黑洞下陷原有实现保留，并入弹簧目标位移。
- 玩家重生时砸出青色冲击波涟漪 + 粒子爆发（呈现层复活沿检测）。

**有意简化**：质点数 260（间距 76）而非 1600——Graphics 逐线渲染下这是 60FPS 的安全预算；不引入邻居耦合传播，弹簧回弹本身已产生传播观感。

### 2.2 粒子洪流

**原作精髓**：复刻参考为 20,480 粒子对象池；敌死爆 120 粒持续 ~3s；玩家死亡爆 1200；速度越快拉丝越长越亮；每次爆炸在两个相近 HSV 色相间 Lerp 成"双色烟花"；全部加法混合、零 GC。

**落地（本次）**：
- 击杀粒子按敌型加权：漂移体 22 → 黑洞 84（`KILL_PARTICLE_WEIGHT`）；玩家死亡 90 → **220**。
- 粒子池 480 → **640**，并按画质分层动态收缩（见 2.6）。
- **速度增亮**：alpha 乘以 `min(1, 0.35 + speed/420)`，高速拉丝更亮（GW 公式的廉价版）。
- **双色粒子**：每第 3 颗用白色，模拟双色烟花的高光核。

### 2.3 敌人性格图鉴

**原作精髓**：每种敌人是一种"性格测验"——蓝钻直线追（速度随时间从 0.4×玩家涨到 2×）、紫风车随机漂移弹墙、绿方**会躲子弹**、粉盒死后分裂、蛇只打头、黑洞吞敌增值、喂饱爆发。速度全部写成"玩家速度的倍数"，难度自我攀升。

**落地状态**：
- ✅ 已有：漂移体/追踪体/织行体/旋翼体/长蛇/排斥体/黑洞 七类，剪影+色彩+运动签名三重编码。
- 🆕 本次：**织行体现在真的会躲子弹**（120 半径内发现闭合中弹道 → 260 侧向脉冲 + 0.7s 冷却，`dodgeIncomingFire`）；**黑洞吞噬敌人**（反线性吸力 `26000·m/(d+30)`，半径 300；吞噬不加分解、增长质量）；**黑洞过载爆发**（质量 ≥2.3 时引爆本体 + 环形喷出 6 只追踪体 + 冲击波/震屏/闪光）——GW 的混沌引擎。
- 🆕 本次：追踪体速度曲线 `min(2.05, 1+t/200)`（原 1.75），呼应"速度倍数自我攀升"；**生成点强制距玩家 ≥250 单位**（原作的公平刷怪规则）。
- ⏳ backlog：旋翼体死后分裂 3 子体；蛇身吸收子弹（当前仅头部可命中，身体不拦截）。

### 2.4 Geoms 倍率经济（GW2 革命）

**原作精髓**：击杀掉落绿色 geoms，必须冒险靠近收集才涨倍率——"微妙地迫使你以身犯险"；倍率死后（GW1 式）清零；炸弹清屏不给分。

**落地（本次）**：完整移植为"倍率晶体"：
- 击杀掉落 1–4 颗（按敌型），弹散后 8s 生命周期，最后 2s 闪烁将熄。
- **磁吸收集**：半径 160 内自动吸附（240→2340 px/s² 递增拉力），贴近即收——单手零额外输入。
- 每 6 颗倍率 +1，上限 **×25**（移动端建议封顶，防分数失控）；死亡清零倍率与晶体计数（保留场上晶体可重新收集）。
- 连锁引爆（炸弹等价物）击杀**不掉晶体**——清屏是脱困手段，不是倍率 jackpot，与原作"炸弹零分"哲学同源。

### 2.5 手感与反馈（game feel）

**原作精髓**：无 hit-stop——打击感全部来自不中断的流量（粒子+涟漪+震屏+音效层叠）；60FPS 神圣不可妥协；震屏量级小、衰减快；死亡有大场面。

**落地（本次）**：
- **屏幕震动**：击杀 +1.2~7、连锁/爆发 +13、死亡 +18，指数衰减 5.5/s，作用于战场 Graphics 节点（HUD 稳定）。
- **死亡慢动作**：0.9s 内时标 0.32→1 平滑恢复（GW2 式戏剧化）。
- **死亡白闪**：全屏遮罩 α 80 起指数衰减；黑洞爆发 0.7 强度闪。
- 击杀涟漪强度随粒子权重 14→40 缩放。
- 有意不做 hit-stop（遵循原作 flow 哲学）。

### 2.6 性能（60FPS 优先于一切特效）

**原作精髓**：恒定 60FPS 是速度感与预判的根基；移植版削减特效立即降级观感，因此正确顺序是"帧率守门 + 特征保真"。

**落地（本次）**：
- **自适应画质三层**：滚动帧耗时均值（EMA 0.08）>21.5ms 降档（0.75s 评估周期、需持续超阈值），<15.2ms 升档（更保守）。
  - T2（满画质）：粒子 640、全部辉光 pass（网格/粒子/涟漪/子弹/敌人）。
  - T1：粒子 448，跳过网格/粒子/涟漪辉光 pass，保留子弹与敌人辉光（可读性优先）。
  - T0：粒子 256，仅保留敌人和玩家核心描边。
- 粒子替换游标改用活数组长度取模（原为全局池常量，降档时存在越界隐患——顺手修复）。
- 网格弹簧积分仅 260 质点 × 常数阶计算 + 子弹尾迹 O(9/颗) 戳记，均在每帧预算内。
- 渲染仍维持 1 逻辑像素着色（`RENDER_PIXEL_RATIO=1`）。

### 2.7 单手操作约束下的双摇杆改造（维持不变）

原作双摇杆"移动/火力解耦"不可直接移植。本项目既有契约（经评审锁定，本次未动）：
- 下半屏浮动摇杆控制移动，**拖动方向即射击方向**，回中保持最后方向持续开火，松手停火。
- 发射时在 ±26° 扇区选择目标做**一次性发射角修正**，弹丸全程弹道（不跟踪）——隐形辅助最小化。
- 调研报告建议的 ±60° 锥 + 12°/帧插值方案与之方向一致，但当前契约是评审产物，保持稳定。

### 2.8 可砍 / backlog

- **Pacifism 模式**（不开火过门）——报告认为与单手"天然契合"，列为差异化模式候选。
- **Deadline 3 分钟限时赛**——碎片局时 + 好友排行榜钩子。
- 真后处理 Bloom（半分辨率两 pass 高斯）——Cocos 管线成本高，当前双描边辉光为其廉价替身。
- 旋翼体分裂、蛇身挡弹、黑洞吸积盘喷流粒子。
- 微信好友排行榜（GW2 验证过的留存钩子，替代多人模式）。

## 3. 来源

- [Geometry Wars (series) – Wikipedia](https://en.wikipedia.org/wiki/Geometry_Wars)
- [Geometry Wars: Retro Evolved 2 – Wikipedia](https://en.wikipedia.org/wiki/Geometry_Wars:_Retro_Evolved_2)
- [Eurogamer – Retro Evolved retrospective](https://www.eurogamer.net/geometry-wars-retro-evolved-retrospective) / [RE2 review](https://www.eurogamer.net/geometry-wars-retro-evolved-2-review)
- [The Guardian – Cakebread 访谈](https://www.theguardian.com/technology/gamesblog/2008/nov/06/microsoft-gameculture)
- [Digital Foundry – GW Face-Off](https://www.digitalfoundry.net/articles/geometry-wars-face-off)
- [Tuts+ – Warping Grid](https://code.tutsplus.com/make-a-neon-vector-shooter-in-xna-the-warping-grid--gamedev-9904t) / [Particle Effects](https://code.tutsplus.com/make-a-neon-vector-shooter-in-xna-particle-effects--gamedev-10111t) / [Bloom and Black Holes](https://code.tutsplus.com/make-a-neon-vector-shooter-in-xna-bloom-and-black-holes--gamedev-9877t) / [More Gameplay](https://code.tutsplus.com/make-a-neon-vector-shooter-in-xna-more-gameplay--gamedev-10103t)
- [GameDev StackExchange – Replicate the warp effect](https://gamedev.stackexchange.com/questions/11342/how-do-i-replicate-the-warp-effect-from-geometry-wars)
- [Game Developer – Dual-Stick Shooter Controls](https://www.gamedeveloper.com/design/everything-i-learned-about-dual-stick-shooter-controls)
