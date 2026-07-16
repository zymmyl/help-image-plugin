import plugin from "../../../lib/plugins/plugin.js"
import Config from "../components/Config.js"
import fs from "fs"
import path from "path"
import schedule from "node-schedule"
import { execCommand, updateState } from "../components/update/common.js"
import { checkGit, getCommitId, getTime, getLogLines, replyGitError, PLUGIN_NAME } from "../components/update/git.js"

let scheduledJob = null

export class HelpImagePlugin extends plugin {
  constructor() {
    super({
      name: "帮助图片插件",
      dsc: "上传和管理帮助图片",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#上传帮助图(\\s+.+)?$",
          fnc: "uploadHelpImage",
          permission: "master"
        },
        {
          reg: "^#全部帮助$",
          fnc: "sendAllHelp",
          permission: "all"
        },
        {
          reg: "^#删除帮助图\\s*(\\d+)$",
          fnc: "deleteHelpImage",
          permission: "master"
        },
        {
          reg: "^#清空帮助图$",
          fnc: "clearHelpImages",
          permission: "master"
        },
        {
          reg: "^#帮助图数量$",
          fnc: "imageCount",
          permission: "master"
        },
        {
          reg: "^#设置帮助图备注\\s*(\\d+)\\s*(.+)$",
          fnc: "setNote",
          permission: "master"
        },
        {
          reg: "^#删除帮助图备注\\s*(\\d+)$",
          fnc: "deleteNote",
          permission: "master"
        },
        {
          reg: "^#帮助指令$",
          fnc: "helpCommand",
          permission: "all"
        },
        {
          reg: "^#更新帮助图(强制)?$",
          fnc: "updatePlugin",
          permission: "master"
        }
      ]
    })

    this.initScheduledJob()
  }

  initScheduledJob() {
    if (scheduledJob) {
      scheduledJob.cancel()
      scheduledJob = null
    }

    const config = Config.getConfig("config")
    if (!config.scheduledPush?.enabled) return
    if (!config.scheduledPush.cron) return

    try {
      scheduledJob = schedule.scheduleJob(config.scheduledPush.cron, () => {
        this.scheduledPush()
      })
      logger.info(`[帮助图片插件] 定时推送已启动，cron: ${config.scheduledPush.cron}`)
    } catch (err) {
      logger.error(`[帮助图片插件] 定时任务启动失败:`, err)
    }
  }

  async uploadHelpImage(e) {
    const noteMatch = e.msg.match(/^#上传帮助图\s+(.+)$/)
    const noteText = noteMatch ? noteMatch[1].trim() : ""

    let sourceMsg = null

    if (e.getReply) {
      sourceMsg = await e.getReply()
    } else if (e.source) {
      if (e.group?.getChatHistory) {
        sourceMsg = (await e.group.getChatHistory(e.source.seq, 1)).pop()
      } else if (e.friend?.getChatHistory) {
        sourceMsg = (await e.friend.getChatHistory(e.source.time, 1)).pop()
      }
    }

    if (!sourceMsg) {
      await e.reply("请引用一张图片后再发送此命令")
      return false
    }

    const images = []
    for (let msg of sourceMsg.message) {
      if (msg.type === "image") {
        images.push(msg)
      }
    }

    if (images.length === 0) {
      await e.reply("引用的消息中没有找到图片")
      return false
    }

    if (noteText && images.length > 1) {
      await e.reply("带备注上传仅支持单张图片，请只引用一张图片后再发送")
      return false
    }

    let savedCount = 0
    const savedFilenames = []
    for (let img of images) {
      try {
        const buffer = await this.downloadImage(img.url)
        if (!buffer) continue

        const ext = this.getImageExt(img.url)
        const filepath = Config.saveImage(buffer, ext)
        logger.info(`[帮助图片插件] 保存图片: ${filepath}`)
        savedFilenames.push(path.basename(filepath))
        savedCount++
      } catch (err) {
        logger.error("[帮助图片插件] 保存图片失败:", err)
      }
    }

    if (savedCount > 0) {
      if (noteText && savedFilenames.length > 0) {
        for (const filename of savedFilenames) {
          Config.setNoteByFilename(filename, noteText)
        }
        await e.reply(`✅ 成功保存 ${savedCount} 张帮助图，已全部设置备注：${noteText}`)
      } else {
        await e.reply(`✅ 成功保存 ${savedCount} 张帮助图`)
      }
      return true
    } else {
      await e.reply("❎ 保存图片失败")
      return false
    }
  }

  async downloadImage(url) {
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (err) {
      logger.error("[帮助图片插件] 下载图片失败:", err)
      return null
    }
  }

  getImageExt(url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|#|$)/)
    if (match) {
      const ext = match[1].toLowerCase()
      if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) {
        return ext
      }
    }
    return "png"
  }

  async sendAllHelp(e) {
    const config = Config.getConfig("config")

    if (!this.checkBot(e)) {
      return false
    }

    if (!this.checkGroup(e)) {
      return false
    }

    const imageList = Config.getImageList()

    if (imageList.length === 0) {
      await e.reply("暂无帮助图片")
      return false
    }

    const customText = config.customText || ""

    if (imageList.length === 1 && !customText) {
      const img = segment.image(imageList[0])
      await e.reply(img)
      return true
    }

    const forwardMsg = this.buildForwardMsg(imageList, customText, e)
    const msg = Bot.makeForwardMsg(forwardMsg)
    await e.reply(msg)
    return true
  }

  checkBot(e) {
    const config = Config.getConfig("config")
    const botList = config.botList || []
    if (botList.length === 0) return true

    const selfId = e?.self_id || Bot.uin
    if (!botList.includes(Number(selfId)) && !botList.includes(String(selfId))) {
      logger.info(`[帮助图片插件] 机器人 ${selfId} 不在发送名单中`)
      return false
    }
    return true
  }

  checkGroup(e) {
    const config = Config.getConfig("config")
    const whitelist = config.groupWhitelist || []
    const blacklist = config.groupBlacklist || []

    if (!e.group_id) return true

    const groupId = Number(e.group_id)

    if (blacklist.includes(groupId) || blacklist.includes(String(e.group_id))) {
      logger.info(`[帮助图片插件] 群 ${groupId} 在黑名单中，跳过`)
      return false
    }

    if (whitelist.length > 0 && !whitelist.includes(groupId) && !whitelist.includes(String(e.group_id))) {
      logger.info(`[帮助图片插件] 群 ${groupId} 不在白名单中，跳过`)
      return false
    }

    return true
  }

  checkGroupById(groupId) {
    const config = Config.getConfig("config")
    const whitelist = config.groupWhitelist || []
    const blacklist = config.groupBlacklist || []
    const gid = Number(groupId)

    if (blacklist.includes(gid) || blacklist.includes(String(groupId))) {
      logger.info(`[帮助图片插件] 群 ${groupId} 在黑名单中，跳过`)
      return false
    }

    if (whitelist.length > 0 && !whitelist.includes(gid) && !whitelist.includes(String(groupId))) {
      logger.info(`[帮助图片插件] 群 ${groupId} 不在白名单中，跳过`)
      return false
    }

    return true
  }

  buildForwardMsg(imageList, customText, e) {
    const forwardMsg = []
    const userId = Bot.uin || e?.self_id || 10000
    const nickname = Bot.nickname || "帮助图"

    const notes = Config.getAllNotes()

    for (let i = 0; i < imageList.length; i++) {
      const filename = path.basename(imageList[i])
      const note = notes[filename] || ""
      const title = `${i + 1}.${note}`

      forwardMsg.push({
        user_id: userId,
        nickname,
        message: [
          title,
          segment.image(imageList[i])
        ]
      })
    }

    if (customText) {
      forwardMsg.push({
        user_id: userId,
        nickname,
        message: customText
      })
    }

    return forwardMsg
  }

  async clearHelpImages(e) {
    const imageList = Config.getImageList()
    if (imageList.length === 0) {
      await e.reply("当前没有帮助图片")
      return false
    }

    for (let imgPath of imageList) {
      try {
        const filename = path.basename(imgPath)
        fs.unlinkSync(imgPath)
        Config.deleteNoteByFilename(filename)
      } catch (err) {
        logger.error("[帮助图片插件] 删除图片失败:", err)
      }
    }

    const notesFile = Config.getNotesFile()
    if (fs.existsSync(notesFile)) {
      fs.unlinkSync(notesFile)
    }

    await e.reply(`✅ 已清空 ${imageList.length} 张帮助图`)
    return true
  }

  async deleteHelpImage(e) {
    const match = e.msg.match(/^#删除帮助图\s*(\d+)$/)
    if (!match) return false

    const index = parseInt(match[1])
    const imageList = Config.getImageList()

    if (imageList.length === 0) {
      await e.reply("当前没有帮助图片")
      return false
    }

    if (index < 1 || index > imageList.length) {
      await e.reply(`序号无效，当前共 ${imageList.length} 张帮助图，请输入 1-${imageList.length} 之间的序号`)
      return false
    }

    const deletedFile = path.basename(imageList[index - 1])
    const ok = Config.deleteImage(index)
    if (ok) {
      await e.reply(`✅ 已删除第 ${index} 张帮助图（${deletedFile}）`)
    } else {
      await e.reply("❎ 删除失败")
    }
    return true
  }

  async imageCount(e) {
    const imageList = Config.getImageList()
    await e.reply(`当前共有 ${imageList.length} 张帮助图`)
    return true
  }

  async setNote(e) {
    const match = e.msg.match(/^#设置帮助图备注\s*(\d+)\s*(.+)$/)
    if (!match) return false

    const index = parseInt(match[1])
    const note = match[2].trim()
    const imageList = Config.getImageList()

    if (imageList.length === 0) {
      await e.reply("当前没有帮助图片")
      return false
    }

    if (index < 1 || index > imageList.length) {
      await e.reply(`序号无效，当前共 ${imageList.length} 张帮助图，请输入 1-${imageList.length} 之间的序号`)
      return false
    }

    const ok = Config.setNote(index, note)
    if (ok) {
      await e.reply(`✅ 已设置第 ${index} 张帮助图备注：${note}`)
    } else {
      await e.reply("❎ 设置失败")
    }
    return true
  }

  async deleteNote(e) {
    const match = e.msg.match(/^#删除帮助图备注\s*(\d+)$/)
    if (!match) return false

    const index = parseInt(match[1])
    const imageList = Config.getImageList()

    if (imageList.length === 0) {
      await e.reply("当前没有帮助图片")
      return false
    }

    if (index < 1 || index > imageList.length) {
      await e.reply(`序号无效，当前共 ${imageList.length} 张帮助图，请输入 1-${imageList.length} 之间的序号`)
      return false
    }

    const ok = Config.setNote(index, "")
    if (ok) {
      await e.reply(`✅ 已删除第 ${index} 张帮助图备注`)
    } else {
      await e.reply("❎ 删除失败")
    }
    return true
  }

  async helpCommand(e) {
    if (!e.runtime) {
      logger.warn("[帮助图片插件] 未找到e.runtime，请升级至最新版Yunzai")
      await e.reply("渲染失败，请稍后重试")
      return true
    }

    try {
      const result = await e.runtime.render("help-image-plugin", "help/index", {}, {
        retType: "default",
        beforeRender({ data }) {
          return {
            ...data,
            _res_path: data.pluResPath,
            pageGotoParams: {
              waitUntil: "networkidle2"
            }
          }
        }
      })

      if (result) {
        return result
      } else {
        await e.reply("渲染失败，请稍后重试")
      }
    } catch (err) {
      logger.error("[帮助图片插件] 渲染帮助指令图片失败:", err)
      await e.reply("渲染失败，请稍后重试")
    }
    return true
  }

  async scheduledPush() {
    const config = Config.getConfig("config")
    const imageList = Config.getImageList()

    if (imageList.length === 0) {
      logger.info("[帮助图片插件] 定时推送：暂无图片，跳过")
      return
    }

    const botList = config.botList || []
    const customText = config.customText || ""
    const forwardMsg = this.buildForwardMsg(imageList, customText)
    const msg = Bot.makeForwardMsg(forwardMsg)

    const groupMap = Bot.getGroupMap?.() || Bot.gl
    if (!groupMap) {
      logger.info("[帮助图片插件] 定时推送：未获取到群列表，跳过")
      return
    }

    for (const [groupId] of groupMap) {
      if (!this.checkGroupById(groupId)) continue

      try {
        if (botList.length > 0) {
          for (let botId of botList) {
            const bot = Bot[botId] || (Bot.uin === Number(botId) ? Bot : null)
            if (bot?.pickGroup) {
              await bot.pickGroup(groupId).sendMsg(msg)
              logger.info(`[帮助图片插件] 机器人 ${botId} 已向群 ${groupId} 推送帮助图`)
            }
          }
        } else if (Bot.pickGroup) {
          await Bot.pickGroup(groupId).sendMsg(msg)
          logger.info(`[帮助图片插件] 已向群 ${groupId} 推送帮助图`)
        }
      } catch (err) {
        logger.error(`[帮助图片插件] 向群 ${groupId} 推送失败:`, err)
      }
    }
  }

  async updatePlugin(e) {
    if (!e.isMaster) return false

    if (updateState.running) {
      await e.reply("已有更新命令执行中，请勿重复操作")
      return true
    }

    if (!(await checkGit((msg) => e.reply(msg)))) {
      return true
    }

    const isForce = e.msg.includes("强制")
    let command = `git -C ./plugins/${PLUGIN_NAME}/ pull --no-rebase`
    if (isForce) {
      command = `git -C ./plugins/${PLUGIN_NAME}/ checkout . && ${command}`
      await e.reply("正在执行强制更新操作，请稍等")
    } else {
      await e.reply("正在执行更新操作，请稍等")
    }

    const oldCommitId = getCommitId()
    updateState.running = true
    const ret = await execCommand(command)
    updateState.running = false

    if (ret.error) {
      logger.mark(`[帮助图片插件] 更新失败`)
      await replyGitError((msg) => e.reply(msg), ret.error, ret.stdout)
      return true
    }

    const time = getTime()
    const stdout = ret.stdout || ""

    if (/(Already up[ -]to[ -]date|已经是最新的)/.test(stdout)) {
      await e.reply(`帮助图片插件已经是最新版本\n最后更新时间：${time}`)
    } else {
      const logMsg = this.getUpdateLog(oldCommitId)
      if (logMsg) {
        const forwardMsg = this.buildUpdateForward(time, logMsg)
        const msg = Bot.makeForwardMsg(forwardMsg)
        await e.reply(msg)
      } else {
        await e.reply(`帮助图片插件更新成功\n最后更新时间：${time}\n请重启 Yunzai 以应用更新`)
      }
    }

    logger.mark(`[帮助图片插件] 最后更新时间：${time}`)
    return true
  }

  getUpdateLog(oldCommitId) {
    let logAll
    try {
      logAll = getLogLines()
    } catch (error) {
      logger.error(error.toString())
      return ""
    }

    if (!logAll) return ""

    const logList = logAll.split("\n")
    const logs = []
    for (let str of logList) {
      let item = str.split("||")
      if (item[0] === oldCommitId) break
      if (item[1]?.includes("Merge branch")) continue
      if (item[1]) logs.push(item[1])
    }

    return logs.join("\n")
  }

  buildUpdateForward(time, logText) {
    const userId = Bot.uin || 10000
    const nickname = Bot.nickname || "帮助图"
    return [
      {
        user_id: userId,
        nickname,
        message: `帮助图片插件更新成功\n最后更新时间：${time}\n请重启 Yunzai 以应用更新\n\n更新日志：`
      },
      {
        user_id: userId,
        nickname,
        message: logText
      },
      {
        user_id: userId,
        nickname,
        message: "更多详细信息请前往 Gitee 查看\nhttps://gitee.com/zymmbtu/help-image-plugin/commits/main"
      }
    ]
  }
}
