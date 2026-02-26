# Codex 终端零基础上手指南（超详细小白版）

这份文档给“几乎没写过命令”的同学用。你只要按顺序复制命令执行即可。

## 0. 先认识 4 个词（避免看不懂）

- 终端：输入命令的黑/白窗口（macOS 里常用 Terminal 或 iTerm）
- 目录：就是文件夹
- 路径：文件夹地址，例如 `/Users/liufengming/codeLab`
- 会话：你这一次打开 Codex 到关闭 Codex 的过程

## 1. 你最常用的一条命令

```bash
codex --sandbox danger-full-access --ask-for-approval never
```

含义：
- `--sandbox danger-full-access`：给 Codex 最大文件操作权限
- `--ask-for-approval never`：执行命令不再逐条问你是否同意

适用场景：你希望 Codex 自动完成更多步骤（比如 Git、发布、文件修改）。

## 2. 每次开工的标准流程（建议背下来）

1. 打开终端
2. 进入项目目录
3. 启动 Codex

命令模板：

```bash
cd /你的项目目录
codex --sandbox danger-full-access --ask-for-approval never
```

示例：

```bash
cd ~/codeLab/zombie-choice-game
codex --sandbox danger-full-access --ask-for-approval never
```

## 3. 如何新建一个全新项目（从 0 开始）

```bash
mkdir -p ~/codeLab/my-new-game
cd ~/codeLab/my-new-game
touch index.html
touch README.md
mkdir -p assets
codex --sandbox danger-full-access --ask-for-approval never
```

上面做了什么：
- `mkdir -p`：创建文件夹
- `cd`：进入文件夹
- `touch`：创建空文件
- 最后一行：启动 Codex

## 4. 怎么确认“我现在在对的地方”

启动后先执行这 3 行：

```bash
pwd
git status -sb
git remote -v
```

你会得到：
- 当前目录路径（`pwd`）
- Git 状态（是否在 `main` 分支、有没有改动）
- 远程仓库地址（是否连到 GitHub）

## 5. 怎么恢复会话（断开后继续）

先试：

```bash
codex resume
```

如果不支持，就用最稳妥方式：回原目录重新开。

```bash
cd ~/codeLab/zombie-choice-game
codex --sandbox danger-full-access --ask-for-approval never
```

说明：即使不是“原样恢复”，回到同一项目目录继续做，效果也通常足够。

## 6. 给自己做一个快捷启动（强烈推荐）

把下面这行加入 `~/.zshrc`：

```bash
alias cdx='codex --sandbox danger-full-access --ask-for-approval never'
```

让它生效：

```bash
source ~/.zshrc
```

以后你只要：

```bash
cd 项目目录
cdx
```

## 7. 你和 Codex 的正确对话方式（新手版）

尽量用“目标 + 限制”说话，Codex 更容易一次做对。

可直接套用：
- `帮我把这个项目发布到 GitHub Pages，仓库是 public。`
- `不要只告诉我步骤，请直接执行命令。`
- `出错时先自动排查，不要停在半路。`
- `最后给我可访问链接。`

## 8. 常见报错与处理（小白最常遇到）

1. `command not found: codex`
- 原因：Codex 没安装或环境变量没生效
- 处理：先确认安装；重开终端再试

2. `fatal: not a git repository`
- 原因：你不在项目目录里
- 处理：先 `cd` 到项目目录，再执行 Git 命令

3. `Permission denied (publickey)`
- 原因：GitHub SSH 公钥没配好
- 处理：重新生成/添加公钥到 GitHub Settings -> SSH keys

4. `could not read Username for 'https://github.com'`
- 原因：HTTPS 推送未登录凭据
- 处理：用 `gh auth login` 登录，或改成 SSH 远程地址

## 9. GitHub Pages 发布最短命令清单（复习用）

```bash
# 在项目目录里
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin git@github.com:你的用户名/仓库名.git
git push -u origin main
```

然后到 GitHub 仓库里开启 Pages（`main` + `/`），等待构建完成。

## 10. 一句话记忆版

进入项目目录 -> 启动 Codex（最大权限）-> 直接说目标 -> 让 Codex 执行并验证结果。
