# Geometry Fighter

一款受 Geometry Wars 启发的微信小游戏，采用几何艺术风格，带来炫酷的视觉体验和刺激的游戏玩法。

## 游戏特点

### 视觉风格
- 几何艺术风格：使用简单的几何图形构建游戏元素
- 霓虹色彩：明亮的色彩搭配和发光效果
- 动态背景：深色渐变背景配合网格线效果
- 粒子效果：爆炸效果采用几何粒子系统

### 游戏玩法
- 三种敌机类型：
  - 小型敌机：速度快，生命值低
  - 中型敌机：速度适中，生命值中等
  - 大型敌机：速度慢，生命值高，有概率掉落宝物
- 霰弹模式：
  - 收集宝物后获得15秒霰弹模式
  - 同时发射5发子弹，呈扇形分布
  - 更容易击落敌机

### 操作方式
- 触摸控制：通过触摸屏幕移动飞机
- 自动射击：玩家飞机会自动发射子弹
- 碰撞检测：子弹击中敌机造成伤害，玩家碰到敌机游戏结束

## 技术实现
- 基于微信小游戏框架开发
- 使用 Canvas 进行游戏渲染
- 对象池管理游戏对象
- 帧动画系统实现特效

## 灵感来源
本游戏的设计灵感来源于经典游戏 Geometry Wars。我们借鉴了其标志性的几何艺术风格和快节奏的游戏玩法，同时加入了独特的宝物系统和霰弹模式，为玩家带来新的游戏体验。

## 开发环境
- 微信开发者工具
- JavaScript/ES6+
- Canvas API

## 如何运行
1. 克隆项目到本地
2. 使用微信开发者工具打开项目
3. 点击预览或真机调试即可开始游戏

## 未来计划
- [ ] 添加更多敌机类型
- [ ] 实现更多宝物效果
- [ ] 添加音效和背景音乐
- [ ] 优化游戏性能
- [ ] 添加排行榜系统

## 贡献
欢迎提交 Issue 和 Pull Request 来帮助改进游戏！

## 许可证
MIT License
