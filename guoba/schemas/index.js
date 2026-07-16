import schedule_ from "./schedule.js"
import permission from "./permission.js"
import Config from "../../components/Config.js"

export const schemas = [
  ...schedule_,
  ...permission
]

function arrayToText(arr) {
  if (!arr || !Array.isArray(arr)) return ""
  return arr.join(",")
}

function textToArray(text) {
  if (!text) return []
  return text.split(",").map(s => s.trim()).filter(s => s)
}

export function getConfigData() {
  const config = Config.getConfig("config")
  const scheduledPush = config.scheduledPush || {}
  return {
    customText: config.customText || "",
    botList: arrayToText(config.botList),
    groupWhitelist: arrayToText(config.groupWhitelist),
    groupBlacklist: arrayToText(config.groupBlacklist),
    "scheduledPush.enabled": scheduledPush.enabled || false,
    "scheduledPush.cron": scheduledPush.cron || "0 9 * * *"
  }
}

export function setConfigData(data, { Result }) {
  const config = Config.getConfig("config")

  if (data.customText !== undefined) {
    config.customText = data.customText || ""
  }

  if (data.botList !== undefined) {
    config.botList = textToArray(data.botList)
  }

  if (data.groupWhitelist !== undefined) {
    config.groupWhitelist = textToArray(data.groupWhitelist)
  }

  if (data.groupBlacklist !== undefined) {
    config.groupBlacklist = textToArray(data.groupBlacklist)
  }

  if (data["scheduledPush.enabled"] !== undefined || data["scheduledPush.cron"] !== undefined) {
    const sp = config.scheduledPush || {}
    if (data["scheduledPush.enabled"] !== undefined) {
      sp.enabled = data["scheduledPush.enabled"]
    }
    if (data["scheduledPush.cron"] !== undefined) {
      sp.cron = data["scheduledPush.cron"] || "0 9 * * *"
    }
    config.scheduledPush = sp
  }

  Config.setConfig("config", config)

  if (typeof Bot !== "undefined" && Bot?.fl) {
    try {
      const plugin = Bot?.plugins?.find?.(p => p.name === "帮助图片插件")
      if (plugin && typeof plugin.initScheduledJob === "function") {
        plugin.initScheduledJob()
      }
    } catch (e) {}
  }

  return Result.ok({}, "保存成功")
}
