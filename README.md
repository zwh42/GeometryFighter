# Geometry Fighter

一款为微信小游戏从零实现的霓虹双摇杆生存射击游戏。目标是复现经典街机式几何战斗的核心感受：在不断升级的封闭网格中移动、向任意方向持续射击、维持倍率并追逐高分。

## 已实现

- 横屏双摇杆：左侧移动，右侧瞄准并自动射击
- 触屏中央智能炸弹，以及模拟器键盘控制
- 7 类程序化几何敌人：漂移体、追踪体、织行体、旋翼体、长蛇、排斥体、黑洞
- 敌人批次、难度升级、武器升级、1–10 倍计分倍率
- 3 条初始生命、3 枚初始炸弹；75,000 分奖励生命，100,000 分奖励炸弹
- 会被冲击波和黑洞扭曲的动态网格
- 程序化霓虹轮廓、弹道、拖尾、粒子爆炸、屏幕闪光与震动
- WebAudio 合成射击、爆炸、奖励和节拍音效，不包含外部版权素材
- 本地最高分存储，失焦自动暂停

## 操作

- 触屏：左半屏拖动移动；右半屏拖动瞄准并射击；底部中央点击 `BOMB`
- 开发者工具键盘：`WASD` 移动，`IJKL` 射击，空格炸弹，`P` 暂停，回车开始

## 运行

1. 微信开发者工具选择“小游戏”并导入本目录。
2. 使用横屏模拟器编译运行。
3. 首次触摸后音频解锁。

无需安装运行时依赖。纯逻辑验证可执行：

```bash
npm test
npm run check
```

## 调试接口

开发者工具控制台可通过 `GameGlobal.geometryGame` 获取当前实例：

```js
GameGlobal.geometryGame.debugSnapshot()
GameGlobal.geometryGame.debugStart()
GameGlobal.geometryGame.debugSpawn('blackhole', 1)
GameGlobal.geometryGame.debugLoseLife()
GameGlobal.geometryGame.debugBomb()
```
