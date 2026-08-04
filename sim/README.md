# 数值编辑器 + 批量胜率模拟器

平衡性调整工作流：

```
编辑数值（editor.html）──保存──▶ 游戏（index.html）直接生效
        │
        └──导出 balance.json──▶ 模拟（图形界面 sim.html 或命令行 sim/simulate.js）
                                └──▶ 自动平衡（sim/balance_tune.js）
```

---

## 0. 自动平衡脚本（重点）

`node sim/balance_tune.js` 自动调整所有球种的数值，让每个球种对全体对手的
**平均胜率**落在 35%–65%，并尽量消除 0%/100% 一边倒。

- **只调 伤害 / 速度 / CD**（`--tune damage,speed,cd` 可限定）；**血量、半径固定不动**
- 结果写入 `balance.json` → 数值编辑器「📥 导入」即可应用到游戏
- 增量模式：以后加新球种用 `--new 新球id`，老球全部锁定为标杆，绝不调整老球

```bash
# 全量平衡（所有球种互相比，首次使用）
node sim/balance_tune.js --n 6 --rounds 10

# 增量平衡（以后加了新球：只调新球，老球锁定）
node sim/balance_tune.js --new chemist,tsunami

# 只调伤害 / 指定标杆 / 逐对打磨硬克制对
node sim/balance_tune.js --tune damage
node sim/balance_tune.js --bench pulse,missile,shield
node sim/balance_tune.js --pairs 6

# 只验证不调整（--rounds 0）、不写文件（--no-write）、固定种子（--seed 7）
node sim/balance_tune.js --rounds 0 --no-write --seed 7
```

输出：
- 每轮越界数/平均分（迭代收敛过程）
- **每个球种的调整内容**（伤害/速度/CD 变化，血量半径未动）
- 最终验证：每个球种对全体对手的平均胜率 + 硬克制对清单
  （🔴 硬克制 = 0%/100% 级，多为机制克制，数值难修复，可接受 15%–85%）

> 已知局限：机制硬克制的对（如液袋 vs 骑枪）靠伤害/速度/CD 无法完全修复，
> 脚本会尽力拉近并如实报告；这类对建议从机制层面调整。

---

## 1. 图形化模拟器（推荐，无需命令行）

双击 **`start_sim.bat`**（或直接双击 `sim.html`、从游戏/编辑器顶部链接进入）。

- **⚔ 1v1 对决**：A/B 各选能力 + 调数值（默认取数值编辑器的保存配置），设场数点运行
- **📊 强度排行**：B 为基准，自动遍历全部 49 个能力对打，输出胜率排行表
- **🧮 全能力矩阵**：49×49 两两对战，输出强度排行 + 一键下载完整矩阵 CSV（较慢）
- **💥 混战 3P/4P**：用编辑器保存的球位配置混战，统计各球位胜率
- 支持场数 / 超时 / 随机种子（可复现）；运行中可停止；进度条实时显示

> 模拟引擎与命令行版完全一致（直接运行游戏真实逻辑 + 每场随机换位消除位置偏差）。
> 编辑器与模拟器请用同一种方式打开（都走 `http://localhost:8080` 或都双击文件）。

---

## 1. 数值编辑器（本地窗口式图形界面）

**打开方式**：双击 `start_editor.bat`，或游戏选择屏的「⚙ 数值」按钮。

**功能**：
- **全局平衡参数**（作用于所有球）：
  - 全局基础伤害倍率（原硬编码 1.5）、技能伤害倍率、碰撞伤害倍率
  - 回复/吸血倍率、巡航速度倍率、技能冷却倍率、超时秒数
- **各球位数值**（2P 用 `left/right`；3P 用 `left/right/p2`；4P 全用）：
  - 生命值、半径、巡航速度、伤害倍率、技能 CD 倍率、名称、模拟用能力
- 点「💾 保存」→ 刷新游戏页面即生效（localStorage 同源共享）
- 「📤 导出 JSON」→ 生成 `balance.json` 供命令行模拟器读取
- 「📥 导入 / ↺ 重置」支持备份恢复

## 2. 命令行模拟器

```bash
# 1v1：能力直选（默认数值，不受编辑器影响）
node sim/simulate.js --a pulse --b missile --n 500

# 1v1：使用编辑器配置的球位（数值+能力）
node sim/simulate.js --a left --b right --n 300 --balance balance.json

# 全能力两两对阵矩阵（--bench 固定基准对手；--csv 导出完整矩阵）
node sim/simulate.js --matrix --n 20 --csv matrix.csv
node sim/simulate.js --matrix --bench shield --n 100

# 混战模式（3P/4P）
node sim/simulate.js --mode 4 --n 200

# 自定义单球配置（JSON 文件）
node sim/simulate.js --a file:myBuild.json --b file:other.json
```

**参数**：
| 参数 | 说明 |
|---|---|
| `--a / --b` | `left/right/p2/p3` 球位名 ｜ 能力 id ｜ `file:路径.json` |
| `--n` | 场数（1v1 默认 200，矩阵默认 10） |
| `--balance` | 编辑器导出的数值配置（默认自动读根目录 `balance.json`） |
| `--seed` | 随机种子（可复现结果） |
| `--max-time` | 覆盖超时秒数 |
| `--mode` | 2/3/4 混战 |
| `--matrix` | 全能力两两矩阵，`--bench <id>` 固定 B |
| `--csv` | 矩阵结果存 CSV（Excel 可直接打开） |

**说明**：
- 模拟场地固定 720×720（游戏桌面窗口的场地上限），步长 1/60s。
- 每场随机交换左右位置（ABBA 轮换），消除游戏原生"左位先手"偏差，
  胜率反映的是**配置本身**的强弱。
- 模拟引擎直接加载游戏的 `js/battle.js` 等真实逻辑，与游戏行为一致。

**运行效率**：Node 版约 25 场/秒；浏览器版（sim.html）约 80 场/秒；
1v1 500 场约 20 秒，矩阵 49×49×10 约 5 分钟。
